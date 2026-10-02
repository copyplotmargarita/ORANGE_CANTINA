import { getEstudiantes } from '../services/estudiantes.service.js';
import { getRepresentantes } from '../services/representantes.service.js';
import { getDeudasEstudiante, registrarAbono } from '../services/ventas.service.js';
import { formatCurrencyDE, showNotification, showConfirm, applyAtmMask, parseAtmAmount } from '../utils.js';

const GRADOS = [
    'Pre-Kinder', 'Kinder',
    '1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria',
    '1ro Bachillerato', '2do Bachillerato', '3ro Bachillerato', '4to Bachillerato', '5to Bachillerato'
];

let businessId = null;
let estudiantes = [];
let representantesMap = {}; // { "Nombre Rep": [hijo1, hijo2] }
let currentBcvRate = 0;
let currentRepresentante = null;
let hijosActuales = [];
let deudasPorHijo = {}; // { estudianteId: [deudas...] }

export async function renderReportes(container) {
    businessId = localStorage.getItem('businessId');
    const bcvStr = localStorage.getItem('bcvRate');
    currentBcvRate = bcvStr ? parseFloat(bcvStr) : 0;

    container.innerHTML = `
        <div class="card mb-md">
            <h3 class="mb-sm">1. Buscar Representante</h3>
            <p class="text-xs text-muted mb-sm">Busca el nombre del padre/representante para generar su Corte de Cuenta.</p>
            <div class="search-box">
                <span class="search-icon">👨‍👩‍👧</span>
                <input type="text" id="reportesSearchRep" class="form-input" placeholder="Nombre del representante..." autocomplete="off">
            </div>
            <div id="reportesListaReps" class="hidden" style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);"></div>
        </div>

        <div id="reportesPanel" class="hidden">
            <div class="card mb-md">
                <div class="flex justify-between items-center mb-md">
                    <div>
                        <h3 class="text-primary">Corte de Cuenta</h3>
                        <p class="text-sm font-bold" id="repNombreTitular"></p>
                    </div>
                    <button class="btn btn-icon text-danger" id="btnClearRep" title="Limpiar">✖</button>
                </div>
                
                <div id="repHijosList" class="flex flex-col gap-sm mb-md"></div>
                
                <div class="bg-gray p-sm rounded border border-success text-center mb-sm hidden" id="repWalletContainer">
                    <p class="text-sm text-muted">Saldo a Favor (Wallet Global)</p>
                    <p class="text-success font-bold" style="font-size: 1.5rem;" id="repWalletUSD">-$0,00</p>
                </div>

                <div class="bg-gray p-sm rounded border border-primary text-center">
                    <p class="text-sm text-muted" id="repTotalLabel">Total a Pagar (Todos los representados)</p>
                    <p class="text-primary font-bold" style="font-size: 2rem;" id="repTotalUSD">$0,00</p>
                    <p class="text-sm text-muted font-bold" id="repTotalBS">Bs. 0,00</p>
                </div>

                <div class="flex flex-col gap-sm mt-md">
                    <button class="btn btn-primary btn-lg w-full" id="btnGenerarPDF">📄 Generar Reporte PDF</button>
                    <button class="btn btn-success btn-lg w-full hidden" id="btnAbonarRep">💰 Registrar Abono / Pago</button>
                </div>
            </div>
        </div>

        <!-- Modal de Pago / Abono -->
        <div class="modal-overlay" id="modalAbonoRep">
            <div class="modal" style="max-width: 400px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-drag-bar"></div>
                <div class="modal-header">
                    <h3>Registrar Abono</h3>
                    <button class="modal-close" id="btnCerrarModalAbonoRep">✕</button>
                </div>
                
                <div class="modal-body" style="overflow-y: auto; flex: 1;">
                    <div class="text-center mb-md">
                        <p class="text-sm text-muted" id="modalAbonoRepLabelDeuda">Deuda Máxima a Cancelar</p>
                        <p class="text-primary font-bold" style="font-size: 1.5rem;" id="modalAbonoRepDeuda">$0,00</p>
                        <p class="text-sm text-muted font-bold" id="modalAbonoRepDeudaBS">Bs. 0,00</p>
                    </div>

                    <div class="form-group mb-md">
                        <label class="form-label">Monto a Abonar</label>
                        <div class="flex items-center gap-sm">
                            <div class="relative w-full">
                                <span class="absolute left-sm top-1/2 -translate-y-1/2 text-muted font-bold">$</span>
                                <input type="text" inputmode="numeric" id="inputAbonoRepUSD" class="form-input text-right font-bold text-primary" style="padding-left: 1.5rem; font-size: 1.25rem;" placeholder="0,00">
                            </div>
                            <span class="font-bold text-muted">=</span>
                            <div class="relative w-full">
                                <span class="absolute left-sm top-1/2 -translate-y-1/2 text-muted font-bold">Bs.</span>
                                <input type="text" inputmode="numeric" id="inputAbonoRepBS" class="form-input text-right font-bold text-primary" style="padding-left: 2rem; font-size: 1.25rem;" placeholder="0,00">
                            </div>
                        </div>
                        <p class="text-xs text-muted text-center mt-xs">El abono cubrirá las facturas pendientes. Si el pago es mayor (o no hay deuda), el excedente irá al Wallet del hijo de mayor grado.</p>
                    </div>

                    <div class="form-group mb-sm">
                        <label class="form-label">Método de Pago</label>
                        <select id="modalAbonoRepMetodo" class="form-input">
                            <optgroup label="Bolívares">
                                <option value="Bs. Efectivo">Bs. Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Pago Móvil">Pago Móvil</option>
                                <option value="Punto de Venta">Punto de Venta</option>
                                <option value="BioPago">BioPago</option>
                            </optgroup>
                            <optgroup label="Divisas">
                                <option value="Dólares en Efectivo">Dólares en Efectivo</option>
                                <option value="Zelle">Zelle</option>
                                <option value="Zinli">Zinli</option>
                                <option value="Binance">Binance</option>
                                <option value="Euros en Efectivo">Euros en Efectivo</option>
                            </optgroup>
                        </select>
                    </div>
                    
                    <div class="form-group mb-sm">
                        <label class="form-label">Referencia (Opcional)</label>
                        <input type="text" id="modalAbonoRepReferencia" class="form-input" placeholder="Nro. Ref">
                    </div>
                </div>

                <div class="modal-footer flex-col">
                    <button class="btn btn-primary btn-block btn-lg" id="btnConfirmarAbonoRep">Confirmar Abono</button>
                </div>
            </div>
        </div>
    `;

    applyAtmMask(document.getElementById('inputAbonoRepUSD'));
    applyAtmMask(document.getElementById('inputAbonoRepBS'));

    setupEventHandlers();
    
    await loadEstudiantesGrouped();
}

async function loadEstudiantesGrouped() {
    const [estData, reps] = await Promise.all([
        getEstudiantes(businessId),
        getRepresentantes(businessId)
    ]);
    
    estudiantes = estData.map(est => {
        const rep = reps.find(r => r.id === est.representanteId);
        return {
            ...est,
            nombreRepresentante: rep ? rep.nombre : 'Sin Representante Registrado'
        };
    });

    representantesMap = {};
    
    // Agrupar por representante
    estudiantes.forEach(est => {
        let repName = (est.nombreRepresentante || '').trim();
        if (!repName) repName = 'Sin Representante Registrado';
        
        if (!representantesMap[repName]) {
            representantesMap[repName] = [];
        }
        representantesMap[repName].push(est);
    });
    
    mostrarRepsConDeuda();
}

function mostrarRepsConDeuda() {
    const listReps = document.getElementById('reportesListaReps');
    const repsNombres = Object.keys(representantesMap);
    
    // Filtrar solo los reps que tienen deuda total > 0
    const repsConDeuda = repsNombres.map(rep => {
        const hijos = representantesMap[rep];
        const totalDeuda = hijos.reduce((acc, h) => acc + (h.estadoCuentaUSD || 0), 0);
        return { rep, hijos, totalDeuda };
    }).filter(r => r.totalDeuda > 0 && r.rep !== 'Sin Representante Registrado');
    
    repsConDeuda.sort((a, b) => b.totalDeuda - a.totalDeuda); // Mayor a menor

    listReps.innerHTML = '';
    
    if (repsConDeuda.length === 0) {
        listReps.innerHTML = '<div class="p-sm text-sm text-muted text-center">No hay representantes con deudas pendientes 🎉</div>';
    } else {
        const header = document.createElement('div');
        header.className = 'p-xs text-xs font-bold text-muted text-center';
        header.style.backgroundColor = 'var(--bg-color)';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.textContent = 'REPRESENTANTES CON DEUDA';
        listReps.appendChild(header);

        repsConDeuda.forEach(({ rep, hijos, totalDeuda }) => {
            const div = document.createElement('div');
            div.className = 'p-sm border-b hover-bg-gray cursor-pointer flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <div class="font-bold text-sm text-primary">👨‍👩‍👧 ${rep}</div>
                    <div class="text-xs text-muted">${hijos.length} representados</div>
                </div>
                <span class="badge badge-danger" style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">Deuda Total: $${formatCurrencyDE(totalDeuda)}</span>
            `;
            div.addEventListener('click', () => seleccionarRepresentante(rep, hijos));
            listReps.appendChild(div);
        });
    }
    listReps.classList.remove('hidden');
}

function setupEventHandlers() {
    const searchInput = document.getElementById('reportesSearchRep');
    const listReps = document.getElementById('reportesListaReps');
    const btnClear = document.getElementById('btnClearRep');
    const btnPDF = document.getElementById('btnGenerarPDF');
    
    const btnAbonar = document.getElementById('btnAbonarRep');
    const inputUSD = document.getElementById('inputAbonoRepUSD');
    const inputBS = document.getElementById('inputAbonoRepBS');
    
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val.length === 0) {
            mostrarRepsConDeuda();
            return;
        }

        const repsNombres = Object.keys(representantesMap);
        const filtrados = repsNombres.filter(n => n.toLowerCase().includes(val) && n !== 'Sin Representante Registrado');

        listReps.innerHTML = '';
        if (filtrados.length === 0) {
            listReps.innerHTML = '<div class="p-sm text-sm text-muted text-center">No se encontraron representantes</div>';
        } else {
            filtrados.forEach(rep => {
                const hijos = representantesMap[rep];
                const totalDeuda = hijos.reduce((acc, h) => acc + (h.estadoCuentaUSD || 0), 0);
                
                const div = document.createElement('div');
                div.className = 'p-sm border-b hover-bg-gray cursor-pointer flex justify-between items-center';
                div.innerHTML = `
                    <div>
                        <div class="font-bold text-sm text-primary">👨‍👩‍👧 ${rep}</div>
                        <div class="text-xs text-muted">${hijos.length} representados</div>
                    </div>
                    ${totalDeuda > 0 ? `<span class="badge badge-danger" style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">Deuda Total: $${formatCurrencyDE(totalDeuda)}</span>` : '<span class="text-xs text-success font-bold">Solvente</span>'}
                `;
                div.addEventListener('click', () => seleccionarRepresentante(rep, hijos));
                listReps.appendChild(div);
            });
        }
        listReps.classList.remove('hidden');
    });

    btnClear.addEventListener('click', () => {
        currentRepresentante = null;
        hijosActuales = [];
        deudasPorHijo = {};
        document.getElementById('reportesPanel').classList.add('hidden');
        searchInput.value = '';
        searchInput.disabled = false;
        mostrarRepsConDeuda();
        searchInput.focus();
    });

    btnPDF.addEventListener('click', generarReportePDF);
    btnAbonar.addEventListener('click', abrirModalAbonoRep);
    
    document.getElementById('btnCerrarModalAbonoRep').addEventListener('click', () => {
        document.getElementById('modalAbonoRep').classList.remove('active');
    });

    inputUSD.addEventListener('input', (e) => {
        if(e.target.value) {
            const valUsd = parseAtmAmount(e.target.value);
            const eqBs = valUsd * currentBcvRate;
            inputBS.value = formatCurrencyDE(eqBs);
        } else {
            inputBS.value = '';
        }
    });

    inputBS.addEventListener('input', (e) => {
        if(e.target.value && currentBcvRate > 0) {
            const valBs = parseAtmAmount(e.target.value);
            const eqUsd = valBs / currentBcvRate;
            inputUSD.value = formatCurrencyDE(eqUsd);
        } else {
            inputUSD.value = '';
        }
    });

    document.getElementById('btnConfirmarAbonoRep').addEventListener('click', procesarAbonoRepresentante);
}

async function seleccionarRepresentante(repNombre, hijos) {
    currentRepresentante = repNombre;
    hijosActuales = hijos;
    deudasPorHijo = {};
    
    document.getElementById('reportesSearchRep').disabled = true;
    document.getElementById('reportesSearchRep').value = repNombre;
    document.getElementById('reportesListaReps').classList.add('hidden');
    
    document.getElementById('repNombreTitular').textContent = repNombre;
    
    const panel = document.getElementById('reportesPanel');
    const listContainer = document.getElementById('repHijosList');
    listContainer.innerHTML = '<div class="text-center p-md"><div class="spinner"></div><p class="text-sm mt-xs">Cargando deudas...</p></div>';
    panel.classList.remove('hidden');

    let granTotalUSD = 0;
    let totalWalletUSD = 0;
    
    // Fetch debts for all kids
    for (const hijo of hijos) {
        const deudas = await getDeudasEstudiante(businessId, hijo.id);
        deudasPorHijo[hijo.id] = deudas;
        granTotalUSD += deudas.reduce((acc, d) => acc + (d.saldoPendienteUSD || 0), 0);
        totalWalletUSD += (hijo.walletSaldoUSD || 0);
    }

    // Renderizar
    listContainer.innerHTML = '';
    hijos.forEach(hijo => {
        const deudas = deudasPorHijo[hijo.id] || [];
        const deudaHijo = deudas.reduce((acc, d) => acc + (d.saldoPendienteUSD || 0), 0);
        
        const walletHijo = hijo.walletSaldoUSD || 0;
        
        listContainer.innerHTML += `
            <div class="p-sm bg-gray border rounded">
                <div class="flex justify-between items-center mb-xs">
                    <span class="font-bold text-sm">🎓 ${hijo.nombre} ${hijo.apellido}</span>
                    <div class="text-right">
                        <span class="font-bold ${deudaHijo > 0 ? 'text-danger' : 'text-success'}">$${formatCurrencyDE(deudaHijo)}</span>
                        ${walletHijo > 0 ? `<div class="text-xs text-success font-bold mt-xs">Wallet: $${formatCurrencyDE(walletHijo)}</div>` : ''}
                    </div>
                </div>
                ${deudas.length > 0 ? `
                    <div class="text-xs text-muted ml-md border-l pl-xs" style="border-left-color: var(--border-color);">
                        ${deudas.map(d => {
                            const dDate = d.fechaHora?.toDate() ? d.fechaHora.toDate().toLocaleDateString('es-VE') : '';
                            return `• ${dDate}: $${formatCurrencyDE(d.saldoPendienteUSD)}`;
                        }).join('<br>')}
                    </div>
                ` : '<span class="text-xs text-muted ml-md">Sin facturas pendientes.</span>'}
            </div>
        `;
    });

    const deudaNetaUSD = Math.max(0, granTotalUSD - totalWalletUSD);
    
    if (totalWalletUSD > 0) {
        document.getElementById('repWalletContainer').classList.remove('hidden');
        document.getElementById('repWalletUSD').textContent = `-$${formatCurrencyDE(totalWalletUSD)}`;
    } else {
        document.getElementById('repWalletContainer').classList.add('hidden');
    }

    const lblDeuda = document.getElementById('repTotalLabel');
    if (deudaNetaUSD === 0 && totalWalletUSD > granTotalUSD) {
        lblDeuda.textContent = 'Saldo a Favor Disponible (Wallet Restante)';
        const restante = totalWalletUSD - granTotalUSD;
        document.getElementById('repTotalUSD').textContent = `$${formatCurrencyDE(restante)}`;
        document.getElementById('repTotalBS').textContent = `Bs. ${formatCurrencyDE(restante * currentBcvRate)}`;
    } else {
        lblDeuda.textContent = 'Total a Pagar (Todos los representados)';
        document.getElementById('repTotalUSD').textContent = `$${formatCurrencyDE(deudaNetaUSD)}`;
        document.getElementById('repTotalBS').textContent = `Bs. ${formatCurrencyDE(deudaNetaUSD * currentBcvRate)}`;
    }
    
    const btnPDF = document.getElementById('btnGenerarPDF');
    const btnAbonar = document.getElementById('btnAbonarRep');
    
    if (deudaNetaUSD > 0) {
        btnPDF.disabled = false;
    } else {
        btnPDF.disabled = true; // No genera PDF si es 0
    }
    
    // El botón de abonar siempre está visible para recargar wallet
    btnAbonar.classList.remove('hidden');
    // Actualizar el texto del botón si no hay deuda
    btnAbonar.textContent = deudaNetaUSD > 0 ? 'Registrar Abono / Pago 💰' : 'Recargar Wallet 💰';
}

function abrirModalAbonoRep() {
    let granTotalUSD = 0;
    let totalWalletUSD = 0;
    hijosActuales.forEach(h => {
        const deudas = deudasPorHijo[h.id] || [];
        granTotalUSD += deudas.reduce((acc, d) => acc + (d.saldoPendienteUSD || 0), 0);
        totalWalletUSD += (h.walletSaldoUSD || 0);
    });

    const deudaNetaUSD = Math.max(0, granTotalUSD - totalWalletUSD);

    const lblDeuda = document.getElementById('modalAbonoRepLabelDeuda');
    if (deudaNetaUSD === 0) {
        lblDeuda.textContent = 'Recarga Directa a Wallet';
    } else {
        lblDeuda.textContent = 'Deuda Máxima a Cancelar (Con Wallet Descontado)';
    }

    document.getElementById('modalAbonoRepDeuda').textContent = `$${formatCurrencyDE(deudaNetaUSD)}`;
    document.getElementById('modalAbonoRepDeudaBS').textContent = `Bs. ${formatCurrencyDE(deudaNetaUSD * currentBcvRate)}`;
    
    document.getElementById('inputAbonoRepUSD').value = formatCurrencyDE(deudaNetaUSD);
    document.getElementById('inputAbonoRepBS').value = formatCurrencyDE(deudaNetaUSD * currentBcvRate);
    document.getElementById('modalAbonoRepReferencia').value = '';
    
    document.getElementById('modalAbonoRep').classList.add('active');
}

async function procesarAbonoRepresentante() {
    const montoUSD = parseAtmAmount(document.getElementById('inputAbonoRepUSD').value);
    const montoBS = parseAtmAmount(document.getElementById('inputAbonoRepBS').value);

    if (isNaN(montoUSD) || montoUSD <= 0) {
        showNotification('Ingrese un monto válido a abonar', 'error');
        return;
    }

    const conf = await showConfirm('Confirmar Abono', `¿Registrar abono de $${formatCurrencyDE(montoUSD)} para los representados de ${currentRepresentante}?`);
    if(!conf) return;

    try {
        const btn = document.getElementById('btnConfirmarAbonoRep');
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        const metodo = document.getElementById('modalAbonoRepMetodo').value;
        const ref = document.getElementById('modalAbonoRepReferencia').value.trim();
        const isBs = document.getElementById('modalAbonoRepMetodo').selectedOptions[0].parentElement.label === 'Bolívares';

        let targetWalletChildId = hijosActuales[0].id;
        let maxGradeIndex = -1;
        hijosActuales.forEach(hijo => {
            const gradeIdx = GRADOS.indexOf(hijo.grado);
            if (gradeIdx > maxGradeIndex) {
                maxGradeIndex = gradeIdx;
                targetWalletChildId = hijo.id;
            }
        });

        let efectivoDisponible = montoUSD;
        
        const infoPorHijo = {};
        hijosActuales.forEach(h => {
            infoPorHijo[h.id] = {
                walletSaldo: h.walletSaldoUSD || 0,
                deudaTotal: deudasPorHijo[h.id] ? deudasPorHijo[h.id].reduce((acc, d) => acc + (d.saldoPendienteUSD || 0), 0) : 0,
                walletAUsarParaSiMismo: 0,
                walletExtraido: 0,
                efectivoVirtualRecibido: 0,
                efectivoRealRecibido: 0
            };
        });

        // 1. Usar wallet propio
        hijosActuales.forEach(h => {
            const info = infoPorHijo[h.id];
            const uso = Math.min(info.walletSaldo, info.deudaTotal);
            info.walletAUsarParaSiMismo = uso;
            info.walletSaldo -= uso;
            info.deudaTotal -= uso;
        });

        // 2. Usar wallet de otros hermanos
        hijosActuales.forEach(h => {
            const info = infoPorHijo[h.id];
            if (info.deudaTotal > 0) {
                hijosActuales.forEach(other => {
                    const otherInfo = infoPorHijo[other.id];
                    if (otherInfo.walletSaldo > 0 && info.deudaTotal > 0) {
                        const transfer = Math.min(info.deudaTotal, otherInfo.walletSaldo);
                        otherInfo.walletSaldo -= transfer;
                        otherInfo.walletExtraido += transfer;
                        
                        info.deudaTotal -= transfer;
                        info.efectivoVirtualRecibido += transfer;
                    }
                });
            }
        });

        // 3. Usar efectivo real
        hijosActuales.forEach(h => {
            const info = infoPorHijo[h.id];
            if (info.deudaTotal > 0 && efectivoDisponible > 0) {
                const cash = Math.min(info.deudaTotal, efectivoDisponible);
                efectivoDisponible -= cash;
                info.deudaTotal -= cash;
                info.efectivoRealRecibido += cash;
            }
        });

        // 4. Excedente de efectivo al hermano de mayor grado
        if (efectivoDisponible > 0.001) {
            infoPorHijo[targetWalletChildId].efectivoRealRecibido += efectivoDisponible;
        }

        // Ejecutar los pagos
        for (const hijo of hijosActuales) {
            const info = infoPorHijo[hijo.id];
            const totalWalletUsado = info.walletAUsarParaSiMismo + info.walletExtraido;
            const totalMontoRecibido = info.walletAUsarParaSiMismo + info.efectivoVirtualRecibido + info.efectivoRealRecibido;

            if (totalWalletUsado > 0 || totalMontoRecibido > 0) {
                const bsReal = (isBs && montoUSD > 0) ? (montoBS * (info.efectivoRealRecibido / montoUSD)) : (info.efectivoRealRecibido * currentBcvRate);
                const bsVirtual = (info.walletAUsarParaSiMismo + info.efectivoVirtualRecibido) * currentBcvRate;
                
                const pagoData = {
                    montoRecibidoUSD: totalMontoRecibido,
                    montoRecibidoBS: bsReal + bsVirtual,
                    tasaAplicada: currentBcvRate,
                    metodoPago: totalMontoRecibido === 0 ? 'WALLET' : metodo, // Si solo se extrae wallet, metodo es WALLET
                    numeroReferencia: ref || 'N/A',
                    destinoExcedente: 'WALLET',
                    walletUsadoUSD: totalWalletUsado
                };
                await registrarAbono(businessId, hijo.id, pagoData);
            }
        }

        showNotification('Abono registrado con éxito', 'success');
        document.getElementById('modalAbonoRep').classList.remove('active');
        
        // Recargar datos y volver a seleccionar el representante para refrescar
        await loadEstudiantesGrouped();
        const hijosNuevos = representantesMap[currentRepresentante] || [];
        await seleccionarRepresentante(currentRepresentante, hijosNuevos);

    } catch (error) {
        console.error(error);
        showNotification('Error al registrar abono', 'error');
    } finally {
        const btn = document.getElementById('btnConfirmarAbonoRep');
        btn.disabled = false;
        btn.textContent = 'Confirmar Abono';
    }
}

function generarReportePDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Colores y Fuentes
        const primaryColor = [255, 126, 39]; // Naranja #ff7e27
        const darkColor = [26, 32, 44];
        
        // Cabecera
        doc.setFontSize(18);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("Orange Cantina Escolar", 14, 20);
        
        doc.setFontSize(14);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text("Estado de Cuenta", 14, 28);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Representante: ${currentRepresentante}`, 14, 35);
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`, 14, 40);
        doc.text(`Tasa BCV del día: ${formatCurrencyDE(currentBcvRate)} Bs/$`, 14, 45);
        
        let startY = 55;
        let granTotalUSD = 0;

        // Por cada hijo
        hijosActuales.forEach(hijo => {
            const deudas = deudasPorHijo[hijo.id] || [];
            if (deudas.length === 0) return; // Skip si no debe nada

            const deudaHijo = deudas.reduce((acc, d) => acc + (d.saldoPendienteUSD || 0), 0);
            granTotalUSD += deudaHijo;

            // Titulo del hijo
            doc.setFontSize(11);
            doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            doc.setFont("helvetica", "bold");
            doc.text(`Alumno: ${hijo.nombre} ${hijo.apellido} (${hijo.grado} ${hijo.seccion})`, 14, startY);
            
            // Tabla de facturas
            const tableData = deudas.map(d => {
                const f = d.fechaHora?.toDate() ? d.fechaHora.toDate().toLocaleDateString('es-VE') : 'N/A';
                const itemsStr = d.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
                return [
                    f,
                    itemsStr,
                    `$${formatCurrencyDE(d.totalUSD)}`,
                    `$${formatCurrencyDE(d.saldoPendienteUSD)}`
                ];
            });

            doc.autoTable({
                startY: startY + 3,
                head: [['Fecha', 'Consumo', 'Total Factura', 'Saldo Pendiente']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: primaryColor },
                styles: { fontSize: 9 },
                columnStyles: {
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' }
                },
                margin: { left: 14, right: 14 }
            });

            startY = doc.lastAutoTable.finalY + 15;
        });

        // Totales Finales
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(`TOTAL A PAGAR: $${formatCurrencyDE(granTotalUSD)}`, 14, startY);
        doc.text(`EQUIVALENTE BS: Bs. ${formatCurrencyDE(granTotalUSD * currentBcvRate)}`, 14, startY + 6);
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text("Gracias por su pago oportuno. ¡Feliz día!", 14, startY + 20);

        // Descargar PDF
        const safeName = currentRepresentante.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Corte_Cuenta_${safeName}.pdf`);
        
        showNotification('Reporte PDF descargado con éxito', 'success');

    } catch(err) {
        console.error(err);
        showNotification('Error al generar PDF. Asegurese de estar conectado a internet para cargar las librerias.', 'error');
    }
}
