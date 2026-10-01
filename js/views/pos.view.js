// ============================================================
// Orange Cantina Escolar — pos.view.js
// Punto de Venta (Carrito, Selección de Estudiante y Pagos)
// ============================================================

import { showNotification, showConfirm, formatCurrencyDE, bcvToBS, bsToUSD, applyAtmMask, parseAtmAmount } from '../utils.js';
import { getEstudiantes } from '../services/estudiantes.service.js';
import { getProductos } from '../services/productos.service.js';
import { registrarVenta } from '../services/ventas.service.js';

const METODOS_BS = ['Bs. Efectivo', 'Transferencia', 'Pago Móvil', 'Punto de Venta', 'BioPago'];
const METODOS_USD = ['Dólares en Efectivo', 'Binance', 'PayPal', 'Zelle', 'Zinli', 'Wallet'];

let businessId = null;
let currentBcvRate = 1;

let estudiantes = [];
let productos = [];

// Estado del POS
let estudianteSeleccionado = null;
let carrito = {}; // { prodId: cantidad }
let metodosPago = []; // Array de { metodo, moneda, monto, referencia }

export async function renderPOS(container) {
    businessId = localStorage.getItem('businessId');
    currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    // Reset estado local
    estudianteSeleccionado = null;
    carrito = {};
    metodosPago = [];

    container.innerHTML = `
        <div id="posContainer" class="flex flex-col h-full gap-md">
            
            <!-- Selector de Alumno -->
            <div class="card card-accent-top">
                <h3 class="mb-sm text-primary">1. Seleccionar Alumno</h3>
                <input type="text" id="posBuscadorAlumno" class="form-input" list="listaAlumnosPOS" autocomplete="off" placeholder="Buscar por nombre...">
                <datalist id="listaAlumnosPOS"></datalist>
                
                <div id="posAlumnoSeleccionado" class="mt-sm hidden">
                    <div class="flex justify-between items-center bg-gray p-sm rounded">
                        <div>
                            <span class="font-bold" id="posNombreAlumno"></span>
                            <div class="text-xs text-muted">Deuda: <span id="posDeudaAlumno" class="text-danger font-bold"></span> | Wallet: <span id="posWalletAlumno" class="text-success font-bold"></span></div>
                        </div>
                        <button class="btn btn-sm btn-ghost text-danger" id="btnQuitarAlumno">❌</button>
                    </div>
                </div>
            </div>

            <!-- Catálogo de Productos -->
            <div class="card" style="flex: 1; display: flex; flex-direction: column;">
                <h3 class="mb-sm text-primary">2. Productos</h3>
                <div class="search-bar" style="margin-bottom: var(--space-sm);">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="posBuscadorProducto" class="form-input" placeholder="Buscar producto...">
                </div>
                <div id="posProductosGrid" class="flex flex-col gap-sm" style="overflow-y: auto; max-height: 40vh; padding-right: 4px;">
                    <div class="loading-screen"><div class="spinner"></div></div>
                </div>
            </div>

            <!-- Total y Cobrar -->
            <div class="card sticky-bottom-pos" style="display: flex; flex-direction: column; max-height: 40vh;">
                <!-- Carrito Resumen -->
                <div id="posCarritoList" style="flex: 1; overflow-y: auto; margin-bottom: var(--space-sm); padding-bottom: var(--space-sm); border-bottom: 1px solid var(--border);">
                    <div class="text-muted text-center text-sm py-sm">Carrito vacío</div>
                </div>

                <div class="flex justify-between items-center mb-sm">
                    <span class="font-bold">TOTAL</span>
                    <div class="text-right flex flex-col items-end">
                        <div class="text-primary font-bold" style="font-size: 1.25rem;" id="posTotalUSD">$0,00</div>
                        <div class="text-info font-bold" style="font-size: 1.25rem;" id="posTotalBS">Bs. 0,00</div>
                    </div>
                </div>
                <div class="flex gap-sm">
                    <button class="btn btn-outline" style="flex: 1; border-color: var(--danger); color: var(--danger);" id="btnVentaCredito" disabled>
                        A CRÉDITO
                    </button>
                    <button class="btn btn-success" style="flex: 2;" id="btnVentaContado" disabled>
                        PAGAR AHORA
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal de Multi-Pago -->
        <div id="modalPago" class="modal-overlay">
            <div class="modal" style="max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3>Procesar Pago</h3>
                    <button class="modal-close" id="btnCerrarModalPago">✖</button>
                </div>
                
                <div class="modal-body" style="overflow-y: auto; flex: 1; padding: var(--space-md);">
                    <div class="bg-gray p-sm rounded text-center mb-md">
                        <div class="text-sm text-muted mb-xs">Total a Pagar</div>
                        <div class="flex justify-center gap-md items-center">
                            <div class="text-primary font-bold" style="font-size: 1.5rem;" id="modalTotalPagarUSD"></div>
                            <div class="text-muted" style="font-size: 1.2rem;">|</div>
                            <div class="text-info font-bold" style="font-size: 1.5rem;" id="modalTotalPagarBS"></div>
                        </div>
                    </div>

                    <div id="listaPagosAgregados" class="flex flex-col gap-sm mb-md"></div>

                    <div class="card bg-gray">
                        <h4 class="mb-sm text-sm">Agregar Método</h4>
                        <div class="form-stack">
                            <div class="form-group">
                                <select id="modalMetodo" class="form-select">
                                    <optgroup label="BOLÍVARES (Bs.)">
                                        ${METODOS_BS.map(m => `<option value="${m}">${m}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="DÓLARES (USD)">
                                        ${METODOS_USD.map(m => `<option value="${m}">${m}</option>`).join('')}
                                    </optgroup>
                                </select>
                            </div>
                            <div class="flex gap-sm">
                                <div class="form-group" style="flex: 1;">
                                    <div class="search-bar" style="margin-bottom:0;">
                                        <span class="search-icon" id="lblMonedaPago">Bs.</span>
                                        <input type="tel" id="modalMontoPago" class="form-input" placeholder="0,00">
                                    </div>
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <input type="text" id="modalReferencia" class="form-input" placeholder="Referencia (Opcional)">
                                </div>
                            </div>
                            <button class="btn btn-outline btn-sm btn-block mt-xs" id="btnAgregarLineaPago">Sumar al total ➕</button>
                        </div>
                    </div>
                </div>

                <div class="modal-footer flex-col">
                    <div class="flex justify-between w-full mb-xs" style="font-size: 1.1rem;">
                        <span>Recibido USD:</span>
                        <span id="modalResumenRecibido" class="font-bold"></span>
                    </div>
                    
                    <div class="flex justify-between items-center w-full mb-sm text-danger hidden" id="divFaltante" style="font-size: 1.1rem;">
                        <span class="font-bold">Faltante:</span>
                        <div class="text-right">
                            <span class="font-extrabold" id="modalResumenFaltanteUSD"></span> |
                            <span class="font-extrabold" id="modalResumenFaltanteBS"></span>
                        </div>
                    </div>

                    <div id="divExcedenteContainer" class="hidden w-full bg-success-bg p-sm rounded mb-sm" style="border: 1px solid var(--success);">
                        <div class="flex justify-between items-center text-success">
                            <span class="font-bold">EXCEDENTE:</span>
                            <div class="text-right">
                                <div class="font-extrabold" style="font-size: 1.1rem;" id="modalResumenExcedenteBS"></div>
                                <div class="text-xs text-muted">Eq. a <span id="modalResumenExcedenteUSD"></span></div>
                            </div>
                        </div>
                        <div class="flex gap-sm mt-sm">
                            <button class="btn btn-sm btn-outline btn-block" style="border-color: var(--success); color: var(--success);" id="btnAccionVuelto">
                                Dar Vuelto 💸
                            </button>
                            <button class="btn btn-sm btn-success btn-block" id="btnAccionWallet">
                                Al Wallet 👛
                            </button>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary btn-block btn-lg" id="btnProcesarVentaContado" disabled>
                        Confirmar Pago y Venta
                    </button>
                </div>
            </div>
        </div>
    `;

    applyAtmMask(document.getElementById('modalMontoPago'));

    await cargarDatosIniciales();
    configurarEventos();
}

async function cargarDatosIniciales() {
    try {
        const [est, prods] = await Promise.all([
            getEstudiantes(businessId),
            getProductos(businessId)
        ]);
        
        estudiantes = est.sort((a,b) => a.nombre.localeCompare(b.nombre));
        productos = prods.filter(p => p.activo).sort((a,b) => a.nombre.localeCompare(b.nombre));

        // Poblar datalist
        const dl = document.getElementById('listaAlumnosPOS');
        dl.innerHTML = estudiantes.map(e => `<option value="${e.nombre} ${e.apellido}">${e.grado} "${e.seccion}"</option>`).join('');

        renderCatálogo();
    } catch(err) {
        showNotification('Error cargando datos para Venta', 'error');
    }
}

function configurarEventos() {
    // Alumno
    document.getElementById('posBuscadorAlumno').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const est = estudiantes.find(x => `${x.nombre} ${x.apellido}` === val);
        if (est) {
            seleccionarAlumno(est);
            e.target.value = '';
        }
    });

    document.getElementById('btnQuitarAlumno').addEventListener('click', () => {
        estudianteSeleccionado = null;
        document.getElementById('posAlumnoSeleccionado').classList.add('hidden');
        document.getElementById('posBuscadorAlumno').classList.remove('hidden');
        actualizarBotones();
    });

    // Productos
    document.getElementById('posBuscadorProducto').addEventListener('input', () => {
        renderCatálogo();
    });

    // Botones Principales
    document.getElementById('btnVentaCredito').addEventListener('click', procesarCredito);
    document.getElementById('btnVentaContado').addEventListener('click', abrirModalPago);

    // Modal
    document.getElementById('btnCerrarModalPago').addEventListener('click', () => {
        document.getElementById('modalPago').classList.remove('active');
    });

    document.getElementById('modalMetodo').addEventListener('change', (e) => {
        const met = e.target.value;
        const isBs = METODOS_BS.includes(met);
        document.getElementById('lblMonedaPago').textContent = isBs ? 'Bs.' : '$';
        
        const inputMonto = document.getElementById('modalMontoPago');
        
        // Métodos digitales o transferencias autocompletan el faltante
        if (met !== 'Bs. Efectivo' && met !== 'Dólares en Efectivo' && met !== 'Wallet') {
            const faltanteUSD = calcularFaltanteUSD();
            if (faltanteUSD > 0) {
                if (isBs) {
                    inputMonto.value = formatCurrencyDE(bcvToBS(faltanteUSD, currentBcvRate));
                } else {
                    inputMonto.value = formatCurrencyDE(faltanteUSD);
                }
            } else {
                inputMonto.value = '';
            }
        } else {
            inputMonto.value = '';
        }
    });

    document.getElementById('btnAgregarLineaPago').addEventListener('click', () => {
        const metodo = document.getElementById('modalMetodo').value;
        const isBs = METODOS_BS.includes(metodo);
        const montoStr = document.getElementById('modalMontoPago').value;
        const montoOriginal = parseAtmAmount(montoStr);
        const referencia = document.getElementById('modalReferencia').value.trim();

        if (montoOriginal <= 0) {
            showNotification('El monto debe ser mayor a cero', 'warning');
            return;
        }

        const montoUSD = isBs ? bsToUSD(montoOriginal, currentBcvRate) : montoOriginal;

        metodosPago.push({
            metodo,
            montoOriginal,
            isBs,
            montoUSD,
            referencia
        });

        document.getElementById('modalMontoPago').value = '';
        document.getElementById('modalReferencia').value = '';
        renderLineasPago();
    });

    document.getElementById('btnAccionVuelto').addEventListener('click', async () => {
        const confirmed = await showConfirm('Confirmar Vuelto', '¿Confirmas que le has entregado el vuelto en efectivo al alumno?');
        if (confirmed) procesarContado('VUELTO');
    });

    document.getElementById('btnAccionWallet').addEventListener('click', async () => {
        const confirmed = await showConfirm('Al Wallet', '¿Confirmas enviar el excedente al Wallet del alumno para futuras compras?');
        if (confirmed) procesarContado('WALLET');
    });

    document.getElementById('btnProcesarVentaContado').addEventListener('click', () => procesarContado('NINGUNO'));

    // Las funciones globales para el carrito se definen fuera de esta función
}

function seleccionarAlumno(est) {
    estudianteSeleccionado = est;
    document.getElementById('posBuscadorAlumno').classList.add('hidden');
    const panel = document.getElementById('posAlumnoSeleccionado');
    panel.classList.remove('hidden');
    
    document.getElementById('posNombreAlumno').textContent = `${est.nombre} ${est.apellido}`;
    document.getElementById('posDeudaAlumno').textContent = `$${formatCurrencyDE(est.estadoCuentaUSD)}`;
    document.getElementById('posWalletAlumno').textContent = `$${formatCurrencyDE(est.walletSaldoUSD)}`;
    
    actualizarBotones();
}

function renderCatálogo() {
    const grid = document.getElementById('posProductosGrid');
    const inputFiltro = document.getElementById('posBuscadorProducto');
    const filtro = inputFiltro ? inputFiltro.value.toLowerCase().trim() : '';
    
    let prods = productos;
    if (filtro) {
        prods = productos.filter(p => p.nombre.toLowerCase().includes(filtro));
    }
    
    if (prods.length === 0) {
        grid.innerHTML = '<p class="text-center text-muted">No se encontraron productos.</p>';
        return;
    }

    grid.innerHTML = prods.map(p => {
        const qty = carrito[p.id] || 0;
        return `
            <div class="flex justify-between items-center bg-white p-sm rounded" style="border: 1px solid var(--border);">
                <div style="flex: 1;">
                    <div class="font-bold">${p.nombre}</div>
                    <div class="text-xs text-muted">$${formatCurrencyDE(p.precioUSD)} / Bs. ${formatCurrencyDE(bcvToBS(p.precioUSD, currentBcvRate))}</div>
                </div>
                <div class="flex items-center gap-xs">
                    <button class="btn btn-sm btn-ghost" onclick="window.posUpdateQty('${p.id}', -1)">➖</button>
                    <span class="font-bold" style="width: 24px; text-align: center;">${qty}</span>
                    <button class="btn btn-sm btn-primary" onclick="window.posUpdateQty('${p.id}', 1)">➕</button>
                </div>
            </div>
        `;
    }).join('');
}

// Global para los botones onClick inline
window.posUpdateQty = function(prodId, delta) {
    if (!carrito[prodId]) carrito[prodId] = 0;
    carrito[prodId] += delta;
    if (carrito[prodId] <= 0) delete carrito[prodId];
    
    renderCatálogo();
    actualizarTotal();
    renderCarrito();
};

window.posRemoveItem = function(prodId) {
    if (carrito[prodId]) {
        delete carrito[prodId];
        renderCatálogo();
        actualizarTotal();
        renderCarrito();
    }
};

function renderCarrito() {
    const list = document.getElementById('posCarritoList');
    if (!list) return;

    let html = '';
    let hasItems = false;
    for (const id in carrito) {
        if (carrito[id] > 0) {
            hasItems = true;
            const prod = productos.find(p => p.id === id);
            if(prod) {
                html += `
                    <div class="flex justify-between items-center p-xs bg-gray rounded mb-xs border">
                        <div class="flex flex-col" style="flex: 1;">
                            <span class="text-sm font-bold text-primary">${prod.nombre}</span>
                            <span class="text-xs text-muted">${formatCurrencyDE(prod.precioUSD)}$ c/u</span>
                        </div>
                        
                        <div class="flex items-center gap-sm">
                            <div class="flex items-center gap-xs">
                                <button class="btn btn-sm btn-ghost" onclick="window.posUpdateQty('${id}', -1)">➖</button>
                                <span class="font-bold" style="width: 24px; text-align: center;">${carrito[id]}</span>
                                <button class="btn btn-sm btn-primary" onclick="window.posUpdateQty('${id}', 1)">➕</button>
                            </div>
                            <span class="text-sm font-bold text-right" style="width: 50px;">${formatCurrencyDE(prod.precioUSD * carrito[id])}$</span>
                            <button class="btn btn-sm btn-primary" onclick="window.posRemoveItem('${id}')" title="Eliminar" style="display: flex; align-items: center; justify-content: center; padding: 4px 8px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007BFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    }

    if (!hasItems) {
        list.innerHTML = `<div class="text-muted text-center text-sm py-sm">Carrito vacío</div>`;
    } else {
        list.innerHTML = html;
    }
}

function calcularTotal() {
    let total = 0;
    for (const id in carrito) {
        const prod = productos.find(p => p.id === id);
        if (prod) {
            total += prod.precioUSD * carrito[id];
        }
    }
    return total;
}

function calcularFaltanteUSD() {
    const totalRequerido = calcularTotal();
    let totalRecibidoUSD = 0;
    for (const m of metodosPago) {
        totalRecibidoUSD += m.montoUSD;
    }
    return Math.max(0, totalRequerido - totalRecibidoUSD);
}

function actualizarTotal() {
    const totalUSD = calcularTotal();
    const totalBS = bcvToBS(totalUSD, currentBcvRate);
    
    document.getElementById('posTotalUSD').textContent = `$${formatCurrencyDE(totalUSD)}`;
    document.getElementById('posTotalBS').textContent = `Bs. ${formatCurrencyDE(totalBS)}`;
    
    actualizarBotones();
}

function actualizarBotones() {
    const total = calcularTotal();
    const hasItems = total > 0;
    
    document.getElementById('btnVentaCredito').disabled = !hasItems;
    document.getElementById('btnVentaContado').disabled = !hasItems;
}

// ────────────── CRÉDITO ──────────────

async function procesarCredito() {
    if (!estudianteSeleccionado) {
        showNotification('⚠️ Por favor, selecciona un alumno arriba antes de procesar la venta.', 'warning');
        return;
    }

    const btn = document.getElementById('btnVentaCredito');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    try {
        await guardarVentaCore('CRÉDITO', null);
        showNotification('Venta registrada exitosamente', 'success');
        renderPOS(document.getElementById('posContainer').parentElement); // Reset view
    } catch(err) {
        console.error(err);
        showNotification(err.message || 'Error al guardar venta', 'error');
        btn.disabled = false;
        btn.textContent = 'A CRÉDITO';
    }
}

// ────────────── CONTADO (MODAL) ──────────────

function abrirModalPago() {
    if (!estudianteSeleccionado) {
        showNotification('⚠️ Por favor, selecciona un alumno arriba antes de proceder al pago.', 'warning');
        return;
    }

    const total = calcularTotal();
    document.getElementById('modalTotalPagarUSD').textContent = `$${formatCurrencyDE(total)}`;
    document.getElementById('modalTotalPagarBS').textContent = `Bs. ${formatCurrencyDE(bcvToBS(total, currentBcvRate))}`;
    
    metodosPago = [];
    
    // Si el alumno tiene wallet, sugerir usarlo si no es cero
    if (estudianteSeleccionado.walletSaldoUSD > 0) {
        const aUsar = Math.min(total, estudianteSeleccionado.walletSaldoUSD);
        metodosPago.push({
            metodo: 'Wallet',
            montoOriginal: aUsar,
            isBs: false,
            montoUSD: aUsar,
            referencia: 'Saldo a favor'
        });
    }

    renderLineasPago();
    document.getElementById('modalPago').classList.add('active');
}

function renderLineasPago() {
    const container = document.getElementById('listaPagosAgregados');
    const totalRequerido = calcularTotal();
    
    let totalRecibidoUSD = 0;
    
    container.innerHTML = metodosPago.map((m, idx) => {
        totalRecibidoUSD += m.montoUSD;
        const sufijo = m.isBs ? 'Bs.' : '$';
        return `
            <div class="flex justify-between items-center bg-white p-xs rounded border text-sm">
                <div>
                    <div class="font-bold">${m.metodo}</div>
                    <div class="text-xs text-muted">${m.referencia || 'Sin Ref'}</div>
                </div>
                <div class="flex items-center gap-sm">
                    <span class="font-bold">${formatCurrencyDE(m.montoOriginal)} ${sufijo}</span>
                    <button class="text-danger border-none bg-transparent" onclick="window.posQuitarPago(${idx})">✖</button>
                </div>
            </div>
        `;
    }).join('');

    const btnProcesar = document.getElementById('btnProcesarVentaContado');
    const divExcedente = document.getElementById('divExcedenteContainer');
    const divFaltante = document.getElementById('divFaltante');
    
    document.getElementById('modalResumenRecibido').textContent = `$${formatCurrencyDE(totalRecibidoUSD)}`;

    btnProcesar.classList.remove('hidden');
    divExcedente.classList.add('hidden');
    divFaltante.classList.add('hidden');

    // EPSILON para evitar problemas de precisión en decimales (ej. 1.499999 vs 1.50)
    const EPSILON = 0.005;

    if (totalRecibidoUSD - totalRequerido > EPSILON) {
        // Hay excedente
        const excUSD = totalRecibidoUSD - totalRequerido;
        const excBS = bcvToBS(excUSD, currentBcvRate);
        
        divExcedente.classList.remove('hidden');
        btnProcesar.classList.add('hidden'); // Se oculta el botón principal a favor de los dos botones de decisión
        
        document.getElementById('modalResumenExcedenteBS').textContent = `Bs. ${formatCurrencyDE(excBS)}`;
        document.getElementById('modalResumenExcedenteUSD').textContent = `$${formatCurrencyDE(excUSD)}`;
        
    } else if (Math.abs(totalRecibidoUSD - totalRequerido) <= EPSILON && totalRequerido > 0) {
        // Monto exacto
        btnProcesar.disabled = false;
    } else {
        // Faltante o vacío
        const falt = Math.max(0, totalRequerido - totalRecibidoUSD);
        const faltBS = Math.max(0, bcvToBS(falt, currentBcvRate));
        divFaltante.classList.remove('hidden');
        document.getElementById('modalResumenFaltanteUSD').textContent = `$${formatCurrencyDE(falt)}`;
        document.getElementById('modalResumenFaltanteBS').textContent = `Bs. ${formatCurrencyDE(faltBS)}`;
        btnProcesar.disabled = true;
    }
}

window.posQuitarPago = function(idx) {
    metodosPago.splice(idx, 1);
    renderLineasPago();
};

async function procesarContado(destinoExcedente) {
    // Deshabilitar todos los botones de acción para evitar doble click
    const btnMain = document.getElementById('btnProcesarVentaContado');
    const btnVuelto = document.getElementById('btnAccionVuelto');
    const btnWallet = document.getElementById('btnAccionWallet');
    
    btnMain.disabled = true;
    btnVuelto.disabled = true;
    btnWallet.disabled = true;
    
    // Armar el objeto de pagoData
    let totalRecibidoUSD = 0;
    let totalRecibidoBS = 0;
    let walletUsadoUSD = 0;
    const metodosUtilizados = []; // String de todos los métodos ej: "Efectivo USD, Zelle"
    let numeroReferencia = [];

    for (const m of metodosPago) {
        totalRecibidoUSD += m.montoUSD;
        if (m.isBs) totalRecibidoBS += m.montoOriginal;
        if (m.metodo === 'Wallet') walletUsadoUSD += m.montoUSD;
        if (!metodosUtilizados.includes(m.metodo)) metodosUtilizados.push(m.metodo);
        if (m.referencia) numeroReferencia.push(m.referencia);
    }

    const pagoData = {
        montoRecibidoUSD: totalRecibidoUSD,
        montoRecibidoBS: totalRecibidoBS,
        tasaAplicada: currentBcvRate,
        metodoPago: metodosUtilizados.join(' + '),
        numeroReferencia: numeroReferencia.join(' | ') || 'N/A',
        destinoExcedente: destinoExcedente,
        walletUsadoUSD: walletUsadoUSD
    };

    try {
        await guardarVentaCore('CONTADO', pagoData);
        showNotification('Pago y Venta registrados exitosamente', 'success');
        document.getElementById('modalPago').classList.remove('active');
        renderPOS(document.getElementById('posContainer').parentElement); // Reset view
    } catch(err) {
        console.error(err);
        showNotification(err.message || 'Error al procesar pago', 'error');
        btnMain.disabled = false;
        btnVuelto.disabled = false;
        btnWallet.disabled = false;
    }
}

// ────────────── CORE GUARDADO ──────────────

async function guardarVentaCore(estado, pagoData) {
    const items = [];
    for (const id in carrito) {
        const prod = productos.find(p => p.id === id);
        const qty = carrito[id];
        items.push({
            productoId: id,
            nombre: prod.nombre,
            cantidad: qty,
            precioUnitarioUSD: prod.precioUSD,
            subtotalUSD: prod.precioUSD * qty
        });
    }

    const ventaData = {
        estudianteId: estudianteSeleccionado.id,
        items,
        totalUSD: calcularTotal(),
        tasaBcvUsada: currentBcvRate,
        estado: estado
    };

    return await registrarVenta(businessId, ventaData, pagoData);
}
