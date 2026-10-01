import { getEstudiantes } from '../services/estudiantes.service.js';
import { getRepresentantes } from '../services/representantes.service.js';
import { getDeudasEstudiante } from '../services/ventas.service.js';
import { showNotification, formatCurrencyDE, showConfirm } from '../utils.js';

let businessId = null;
let estudiantes = [];
let currentEstudiante = null;
let deudasPendientes = [];
let currentBcvRate = 0;

export async function renderCuentas(container) {
    businessId = localStorage.getItem('businessId');
    const bcvStr = localStorage.getItem('bcvRate');
    currentBcvRate = bcvStr ? parseFloat(bcvStr) : 0;

    container.innerHTML = `
        <div class="card mb-md">
            <h3 class="mb-sm">1. Seleccionar Alumno</h3>
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input type="text" id="cuentasSearchAlumno" class="form-input" placeholder="Buscar por nombre o apellido..." autocomplete="off">
            </div>
            <div id="cuentasListaAlumnos" class="hidden" style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);"></div>
            
            <div id="cuentasEstudianteSeleccionado" class="hidden flex justify-between items-center bg-gray p-sm rounded mt-sm">
                <div>
                    <h4 id="cuentasNombreEstudiante" class="text-primary mb-xs font-bold text-lg"></h4>
                    <p class="text-sm text-muted" id="cuentasDatosEstudiante"></p>
                </div>
                <button class="btn btn-icon text-danger" id="btnCuentasClearEstudiante" title="Cambiar Alumno">✖</button>
            </div>
        </div>

        <div id="cuentasPanel" class="hidden">
            <!-- Perfil Financiero -->
            <div class="card mb-md text-center">
                <h3 class="mb-sm">Resumen Financiero</h3>
                <div class="flex flex-col gap-sm">
                    <div class="bg-gray p-sm rounded border border-danger">
                        <p class="text-sm text-muted">Deuda Total Pendiente</p>
                        <p class="text-danger font-bold" style="font-size: 2rem;" id="cuentasDeudaTotal">$0,00</p>
                        <p class="text-sm text-muted font-bold" id="cuentasDeudaTotalBS">Bs. 0,00</p>
                    </div>
                    <div class="bg-gray p-sm rounded border border-success">
                        <p class="text-sm text-muted">Saldo a Favor (Wallet)</p>
                        <p class="text-success font-bold" style="font-size: 1.5rem;" id="cuentasWallet">$0,00</p>
                        <p class="text-sm text-muted font-bold" id="cuentasWalletBS">Bs. 0,00</p>
                    </div>
                </div>
            </div>

            <!-- Lista de Deudas -->
            <div class="card mb-md" id="cuentasListaDeudasContainer">
                <h3 class="mb-sm">Facturas Pendientes</h3>
                <div id="cuentasListaDeudas"></div>
            </div>
        </div>
    `;

    setupEventHandlers();
    loadEstudiantes();
}

async function loadEstudiantes() {
    const [estData, reps] = await Promise.all([
        getEstudiantes(businessId),
        getRepresentantes(businessId)
    ]);
    
    estudiantes = estData.map(est => {
        const rep = reps.find(r => r.id === est.representanteId);
        return {
            ...est,
            nombreRepresentante: rep ? rep.nombre : 'N/A'
        };
    });
    
    mostrarDeudores();
}

function mostrarDeudores() {
    const listAlumnos = document.getElementById('cuentasListaAlumnos');
    const deudores = estudiantes.filter(e => (e.estadoCuentaUSD || 0) > 0);
    
    // Ordenar de mayor a menor deuda
    deudores.sort((a, b) => (b.estadoCuentaUSD || 0) - (a.estadoCuentaUSD || 0));

    listAlumnos.innerHTML = '';
    
    if (deudores.length === 0) {
        listAlumnos.innerHTML = '<div class="p-sm text-sm text-muted text-center">No hay alumnos con deudas pendientes 🎉</div>';
    } else {
        const header = document.createElement('div');
        header.className = 'p-xs text-xs font-bold text-muted text-center';
        header.style.backgroundColor = 'var(--bg-color)';
        header.style.borderBottom = '1px solid var(--border-color)';
        header.textContent = 'ALUMNOS CON DEUDA PENDIENTE';
        listAlumnos.appendChild(header);

        deudores.forEach(est => {
            const div = document.createElement('div');
            div.className = 'p-sm border-b hover-bg-gray cursor-pointer flex justify-between items-center';
            const deuda = est.estadoCuentaUSD || 0;
            
            div.innerHTML = `
                <div>
                    <div class="font-bold text-sm text-primary">${est.nombre} ${est.apellido}</div>
                    <div class="text-xs text-muted">Rep: ${est.nombreRepresentante || 'N/A'}</div>
                </div>
                <span class="badge badge-danger" style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">Deuda: $${formatCurrencyDE(deuda)}</span>
            `;
            div.addEventListener('click', () => seleccionarEstudiante(est));
            listAlumnos.appendChild(div);
        });
    }
    listAlumnos.classList.remove('hidden');
}

function setupEventHandlers() {
    const searchInput = document.getElementById('cuentasSearchAlumno');
    const listAlumnos = document.getElementById('cuentasListaAlumnos');
    const btnClear = document.getElementById('btnCuentasClearEstudiante');
    
    // Búsqueda
    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val.length === 0) {
            mostrarDeudores();
            return;
        }

        const filtrados = estudiantes.filter(est => 
            est.nombre.toLowerCase().includes(val) || 
            est.apellido.toLowerCase().includes(val) ||
            (est.nombreRepresentante && est.nombreRepresentante.toLowerCase().includes(val))
        );

        listAlumnos.innerHTML = '';
        if (filtrados.length === 0) {
            listAlumnos.innerHTML = '<div class="p-sm text-sm text-muted text-center">No se encontraron alumnos</div>';
        } else {
            filtrados.forEach(est => {
                const div = document.createElement('div');
                div.className = 'p-sm border-b hover-bg-gray cursor-pointer flex justify-between items-center';
                const deuda = est.estadoCuentaUSD || 0;
                
                div.innerHTML = `
                    <div>
                        <div class="font-bold text-sm text-primary">${est.nombre} ${est.apellido}</div>
                        <div class="text-xs text-muted">Rep: ${est.nombreRepresentante || 'N/A'}</div>
                    </div>
                    ${deuda > 0 ? `<span class="badge badge-danger" style="background: var(--danger); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">Deuda: $${formatCurrencyDE(deuda)}</span>` : ''}
                `;
                div.addEventListener('click', () => seleccionarEstudiante(est));
                listAlumnos.appendChild(div);
            });
        }
        listAlumnos.classList.remove('hidden');
    });

    // Limpiar selección
    btnClear.addEventListener('click', () => {
        currentEstudiante = null;
        document.getElementById('cuentasEstudianteSeleccionado').classList.add('hidden');
        document.getElementById('cuentasPanel').classList.add('hidden');
        searchInput.value = '';
        searchInput.disabled = false;
        mostrarDeudores();
        searchInput.focus();
    });
}

async function seleccionarEstudiante(est) {
    currentEstudiante = est;
    document.getElementById('cuentasSearchAlumno').disabled = true;
    document.getElementById('cuentasSearchAlumno').value = `${est.nombre} ${est.apellido}`;
    document.getElementById('cuentasListaAlumnos').classList.add('hidden');
    
    const selBox = document.getElementById('cuentasEstudianteSeleccionado');
    document.getElementById('cuentasNombreEstudiante').textContent = `${est.nombre} ${est.apellido}`;
    document.getElementById('cuentasDatosEstudiante').textContent = `${est.grado || ''} ${est.seccion || ''} | Rep: ${est.nombreRepresentante || 'N/A'}`;
    selBox.classList.remove('hidden');

    document.getElementById('cuentasPanel').classList.remove('hidden');
    
    await cargarDatosFinancieros();
}

async function cargarDatosFinancieros() {
    deudasPendientes = await getDeudasEstudiante(businessId, currentEstudiante.id);
    
    const deudaCalculada = deudasPendientes.reduce((acc, d) => acc + (d.saldoPendienteUSD || 0), 0);
    const wallet = currentEstudiante.walletSaldoUSD || 0;

    document.getElementById('cuentasDeudaTotal').textContent = `$${formatCurrencyDE(deudaCalculada)}`;
    document.getElementById('cuentasDeudaTotalBS').textContent = `Bs. ${formatCurrencyDE(deudaCalculada * currentBcvRate)}`;
    
    document.getElementById('cuentasWallet').textContent = `$${formatCurrencyDE(wallet)}`;
    document.getElementById('cuentasWalletBS').textContent = `Bs. ${formatCurrencyDE(wallet * currentBcvRate)}`;

    const listContainer = document.getElementById('cuentasListaDeudas');
    if (deudasPendientes.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-muted py-md text-sm">No hay facturas pendientes.</div>';
    } else {
        listContainer.innerHTML = deudasPendientes.map((d, index) => {
            const f = d.fechaHora?.toDate() || new Date();
            const dateStr = f.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
            return `
                <div class="flex justify-between items-center p-sm bg-gray rounded mb-xs border border-danger">
                    <div>
                        <div class="text-sm font-bold text-primary">#${index + 1} - ${dateStr}</div>
                        <div class="text-xs text-muted">${d.items.map(i => i.nombre).join(', ')}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-bold text-danger">Pendiente: $${formatCurrencyDE(d.saldoPendienteUSD)}</div>
                        <div class="text-xs text-muted">Original: $${formatCurrencyDE(d.totalUSD)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
