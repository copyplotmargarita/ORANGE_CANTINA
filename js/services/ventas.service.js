// ============================================================
// Orange Cantina Escolar — ventas.service.js
// Servicio transaccional para Ventas y Pagos
// ============================================================

import { db, collection, doc, query, where, getDocs, runTransaction, serverTimestamp } from '../firebase-config.js';
import { getTodayISO } from '../utils.js';

const COLLECTION = 'ventas';

/**
 * Registra una venta y maneja la transacción completa:
 * - Guarda la Venta.
 * - Si es a CRÉDITO, actualiza la deuda del estudiante.
 * - Si es de CONTADO, guarda el Pago y procesa el excedente hacia el wallet.
 */
export async function registrarVenta(businessId, ventaData, pagoData = null) {
    return await runTransaction(db, async (transaction) => {
        const estRef = doc(db, 'negocios', businessId, 'estudiantes', ventaData.estudianteId);
        const estSnap = await transaction.get(estRef);
        
        if (!estSnap.exists()) {
            throw new Error("El estudiante ya no existe en la base de datos.");
        }
        
        const est = estSnap.data();
        let nuevoEstadoCuenta = est.estadoCuentaUSD || 0;
        let nuevoWallet = est.walletSaldoUSD || 0;
        
        // 1. Preparar documento de Venta
        const ventaRef = doc(collection(db, 'negocios', businessId, COLLECTION));
        
        const venta = {
            ...ventaData,
            fechaHora: serverTimestamp(),
            fechaISO: getTodayISO(),
            nombreEstudiante: est.nombre + ' ' + est.apellido, // Snapshot
            representanteId: est.representanteId || null
        };

        if (ventaData.estado === 'CRÉDITO') {
            // Aumenta la deuda
            nuevoEstadoCuenta += venta.totalUSD;
            venta.saldoPendienteUSD = venta.totalUSD;
            
        } else if (ventaData.estado === 'CONTADO' && pagoData) {
            // Pagado al instante
            venta.saldoPendienteUSD = 0;
            
            // Descontar wallet si fue usado
            if (pagoData.walletUsadoUSD) {
                nuevoWallet -= pagoData.walletUsadoUSD;
                if (nuevoWallet < 0) nuevoWallet = 0; // Prevenir negativos por errores de redondeo
            }

            // Lógica de excedente
            let excedenteUSD = pagoData.montoRecibidoUSD - venta.totalUSD;
            let montoEnviadoAWalletUSD = 0;
            let montoVueltoUSD = 0;

            if (excedenteUSD > 0) {
                if (pagoData.destinoExcedente === 'WALLET') {
                    nuevoWallet += excedenteUSD;
                    montoEnviadoAWalletUSD = excedenteUSD;
                } else if (pagoData.destinoExcedente === 'VUELTO') {
                    montoVueltoUSD = excedenteUSD;
                }
            }

            // Preparar documento de Pago
            const pagoRef = doc(collection(db, 'negocios', businessId, 'pagos'));
            const pago = {
                ...pagoData,
                fechaHora: serverTimestamp(),
                estudianteId: ventaData.estudianteId,
                ventasAfectadas: [{
                    ventaId: ventaRef.id,
                    montoAplicadoUSD: venta.totalUSD,
                    estadoResultante: 'PAGADO'
                }],
                montoEnviadoAWalletUSD,
                montoVueltoUSD
            };
            
            transaction.set(pagoRef, pago);
        }

        // 2. Actualizar saldos del estudiante (si cambiaron)
        if (nuevoEstadoCuenta !== (est.estadoCuentaUSD || 0) || nuevoWallet !== (est.walletSaldoUSD || 0)) {
            transaction.update(estRef, {
                estadoCuentaUSD: nuevoEstadoCuenta,
                walletSaldoUSD: nuevoWallet,
                updatedAt: serverTimestamp()
            });
        }

        // 3. Guardar Venta
        transaction.set(ventaRef, venta);
        
        return ventaRef.id;
    });
}

/**
 * Obtiene las deudas pendientes (CRÉDITO) de un estudiante, ordenadas por más antigua primero (FIFO).
 */
export async function getDeudasEstudiante(businessId, estudianteId) {
    const qDeudas = query(
        collection(db, 'negocios', businessId, COLLECTION),
        where('estudianteId', '==', estudianteId),
        where('estado', '==', 'CRÉDITO')
    );
    const snap = await getDocs(qDeudas);
    let deudas = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.saldoPendienteUSD > 0.005) {
            deudas.push({ id: d.id, ...data });
        }
    });
    
    // Ordenar más vieja a más nueva
    deudas.sort((a, b) => {
        const tA = a.fechaHora?.toMillis() || 0;
        const tB = b.fechaHora?.toMillis() || 0;
        return tA - tB;
    });
    
    return deudas;
}

/**
 * Registra un pago/abono a una cuenta, distribuyéndolo automáticamente (FIFO)
 * sobre las deudas pendientes. El excedente se maneja igual que en ventas de contado.
 */
export async function registrarAbono(businessId, estudianteId, pagoData) {
    // 1. Buscar las deudas antes de la transacción para conocer sus referencias
    const qDeudas = query(collection(db, 'negocios', businessId, COLLECTION), 
        where('estudianteId', '==', estudianteId), 
        where('estado', '==', 'CRÉDITO')
    );
    const deudasSnap = await getDocs(qDeudas);
    let deudasRefs = [];
    deudasSnap.forEach(d => {
        if (d.data().saldoPendienteUSD > 0) {
            deudasRefs.push({ ref: d.ref, data: d.data() });
        }
    });
    deudasRefs.sort((a, b) => (a.data.fechaHora?.toMillis()||0) - (b.data.fechaHora?.toMillis()||0));

    return await runTransaction(db, async (transaction) => {
        const estRef = doc(db, 'negocios', businessId, 'estudiantes', estudianteId);
        const estSnap = await transaction.get(estRef);
        if (!estSnap.exists()) throw new Error("El estudiante ya no existe.");
        
        const est = estSnap.data();
        let walletActual = est.walletSaldoUSD || 0;
        let deudaTotalActual = est.estadoCuentaUSD || 0;

        // Descontar wallet si fue usado
        if (pagoData.walletUsadoUSD) {
            walletActual -= pagoData.walletUsadoUSD;
            if (walletActual < 0) walletActual = 0;
        }

        let montoDisponible = pagoData.montoRecibidoUSD;
        let ventasAfectadas = [];
        
        // 2. Leer explicitamente los documentos de deuda en la transacción
        let deudasActualizadas = [];
        for (const item of deudasRefs) {
            const docSnap = await transaction.get(item.ref);
            if (docSnap.exists() && docSnap.data().saldoPendienteUSD > 0) {
                deudasActualizadas.push({ ref: item.ref, data: docSnap.data() });
            }
        }

        // 3. Aplicar pago FIFO
        for (const d of deudasActualizadas) {
            if (montoDisponible <= 0.005) break; // EPSILON
            
            const deuda = d.data.saldoPendienteUSD;
            let montoAplicado = 0;

            if (montoDisponible >= (deuda - 0.005)) {
                montoAplicado = deuda;
                montoDisponible -= deuda;
                d.data.saldoPendienteUSD = 0;
                d.data.estado = 'PAGADO';
            } else {
                montoAplicado = montoDisponible;
                d.data.saldoPendienteUSD -= montoDisponible;
                montoDisponible = 0;
            }

            ventasAfectadas.push({
                ventaId: d.ref.id,
                montoAplicadoUSD: montoAplicado,
                estadoResultante: d.data.estado
            });

            transaction.update(d.ref, {
                saldoPendienteUSD: d.data.saldoPendienteUSD,
                estado: d.data.estado,
                updatedAt: serverTimestamp()
            });
        }

        // Calcular nueva deuda (restándole lo que realmente se aplicó, es decir, Recibido menos lo que quedó Disponible)
        const montoAplicadoDeudas = pagoData.montoRecibidoUSD - montoDisponible;
        let nuevaDeuda = deudaTotalActual - montoAplicadoDeudas;
        if (nuevaDeuda < 0) nuevaDeuda = 0;

        // 4. Manejo de Excedente
        let montoEnviadoAWalletUSD = 0;
        let montoVueltoUSD = 0;

        if (montoDisponible > 0.005) {
            if (pagoData.destinoExcedente === 'WALLET') {
                walletActual += montoDisponible;
                montoEnviadoAWalletUSD = montoDisponible;
            } else if (pagoData.destinoExcedente === 'VUELTO') {
                montoVueltoUSD = montoDisponible;
            }
        }

        // 5. Guardar el Pago
        const pagoRef = doc(collection(db, 'negocios', businessId, 'pagos'));
        transaction.set(pagoRef, {
            ...pagoData,
            fechaHora: serverTimestamp(),
            estudianteId,
            ventasAfectadas,
            montoEnviadoAWalletUSD,
            montoVueltoUSD,
            tipo: 'ABONO_DEUDA'
        });

        // 6. Actualizar Estudiante
        transaction.update(estRef, {
            estadoCuentaUSD: nuevaDeuda,
            walletSaldoUSD: walletActual,
            updatedAt: serverTimestamp()
        });

        return pagoRef.id;
    });
}
