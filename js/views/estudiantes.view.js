// ============================================================
// Orange Cantina Escolar — estudiantes.view.js
// Pantalla de gestión de Alumnos y Representantes
// ============================================================

import { showNotification, showConfirm, formatCurrencyDE, bcvToBS, capitalizeWords } from '../utils.js';
import { getEstudiantes, createEstudiante, updateEstudiante, deleteEstudiante } from '../services/estudiantes.service.js';
import { getRepresentantes, createRepresentante, updateRepresentante, buscarRepresentante } from '../services/representantes.service.js';

let businessId = null;
let currentEstudiantes = [];
let currentRepresentantes = [];

/**
 * Grados disponibles según definición del usuario.
 */
const GRADOS = [
    'Pre-Kinder', 'Kinder',
    '1ro Primaria', '2do Primaria', '3ro Primaria', '4to Primaria', '5to Primaria', '6to Primaria',
    '1ro Bachillerato', '2do Bachillerato', '3ro Bachillerato', '4to Bachillerato', '5to Bachillerato'
];

const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Renderiza la vista principal de Alumnos.
 */
export async function renderEstudiantes(container) {
    businessId = localStorage.getItem('businessId');
    if (!businessId) {
        showNotification('Error: Negocio no identificado', 'error');
        return;
    }

    container.innerHTML = `
        <div id="estudiantesListado">
            <div class="flex gap-sm mb-md">
                <div class="search-bar" style="flex: 1; margin-bottom: 0;">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="searchEstudiantes" class="form-input" placeholder="Buscar alumno...">
                </div>
                <button class="btn btn-primary" id="btnCrearEstudianteTop" style="white-space: nowrap;">
                    ➕ Nuevo
                </button>
            </div>

            <div id="estudiantesGrid" class="mobile-cards">
                <div class="loading-screen"><div class="spinner"></div></div>
            </div>

            <!-- Botón Flotante para crear (móvil) -->
            <button class="fab" id="btnCrearEstudiante" title="Nuevo Alumno">
                ➕
            </button>
        </div>

        <!-- Contenedor dinámico para el formulario (oculto inicialmente) -->
        <div id="estudiantesFormContainer" class="hidden"></div>
    `;

    // Cargar datos
    await cargarDatosYRenderizar();

    // Event listeners
    document.getElementById('btnCrearEstudiante').addEventListener('click', () => mostrarFormulario());
    document.getElementById('btnCrearEstudianteTop').addEventListener('click', () => mostrarFormulario());
    
    document.getElementById('searchEstudiantes').addEventListener('input', (e) => {
        filtrarYRenderizar(e.target.value);
    });
}

/**
 * Carga estudiantes y representantes, y cruza los datos.
 */
async function cargarDatosYRenderizar() {
    try {
        const [estudiantes, reps] = await Promise.all([
            getEstudiantes(businessId),
            getRepresentantes(businessId)
        ]);

        currentRepresentantes = reps;
        
        // Mapear representante a cada estudiante para mostrarlo fácilmente
        currentEstudiantes = estudiantes.map(est => {
            const rep = reps.find(r => r.id === est.representanteId);
            return {
                ...est,
                representanteNombre: rep ? rep.nombre : 'Sin asignar',
                representanteTelefono: rep ? rep.telefono : ''
            };
        });

        // Ordenar alfabéticamente
        currentEstudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre));

        filtrarYRenderizar('');
    } catch (error) {
        console.error('Error cargando estudiantes:', error);
        showNotification('Error al cargar la lista', 'error');
    }
}

/**
 * Filtra la lista en memoria y renderiza las tarjetas.
 */
function filtrarYRenderizar(query) {
    const grid = document.getElementById('estudiantesGrid');
    if (!grid) return;

    const q = query.toLowerCase().trim();
    
    const filtrados = currentEstudiantes.filter(est => 
        est.nombre.toLowerCase().includes(q) ||
        est.apellido.toLowerCase().includes(q) ||
        est.grado.toLowerCase().includes(q)
    );

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎓</span>
                <h3>Sin resultados</h3>
                <p>No se encontraron alumnos con esa búsqueda.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtrados.map(est => `
        <div class="mobile-card-row card-clickable" data-id="${est.id}">
            <div class="flex justify-between items-center mb-sm">
                <h3 class="text-primary">${est.nombre} ${est.apellido}</h3>
                <span class="badge badge-info">${est.grado} "${est.seccion}"</span>
            </div>
            
            <div class="flex flex-col gap-xs mb-sm">
                <div class="text-sm">
                    <span class="text-muted">Representante:</span> 
                    <span class="font-bold">${est.representanteNombre}</span>
                </div>
            </div>

            <div class="divider" style="margin: 0.5rem 0;"></div>

            <div class="flex justify-between items-center">
                <div class="flex flex-col">
                    <span class="row-label">DEUDA PENDIENTE</span>
                    <span class="row-value text-danger font-bold">$${formatCurrencyDE(est.estadoCuentaUSD)}</span>
                </div>
                <div class="flex flex-col text-right">
                    <span class="row-label">SALDO A FAVOR</span>
                    <span class="row-value text-success font-bold">$${formatCurrencyDE(est.walletSaldoUSD)}</span>
                </div>
            </div>
        </div>
    `).join('');

    // Escuchar clicks en tarjetas para editar
    grid.querySelectorAll('.card-clickable').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const estudiante = currentEstudiantes.find(e => e.id === id);
            if (estudiante) mostrarFormulario(estudiante);
        });
    });
}

/**
 * Muestra el formulario para crear o editar.
 */
function mostrarFormulario(estudiante = null) {
    const isEdit = !!estudiante;
    
    document.getElementById('estudiantesListado').classList.add('hidden');
    const container = document.getElementById('estudiantesFormContainer');
    container.classList.remove('hidden');

    container.innerHTML = `
        <div class="view-header">
            <button class="btn btn-ghost btn-back" id="btnCerrarForm">⬅️ Volver</button>
            <h2>${isEdit ? 'Editar Alumno' : 'Nuevo Alumno'}</h2>
            ${isEdit ? `<button class="btn btn-ghost" id="btnEliminarEstudiante" style="color: var(--danger);" title="Eliminar">🗑️</button>` : ''}
        </div>

        <div class="form-container">
            <div class="form-sections">
                <!-- Datos del Alumno -->
                <div class="card card-accent-top">
                    <h3 style="color: var(--primary); margin-bottom: var(--space-md);">🎓 Datos del Alumno</h3>
                    <div class="form-stack">
                        <div class="form-group">
                            <label class="form-label">NOMBRE Y APELLIDO</label>
                            <input type="text" id="estNombreCompleto" class="form-input" placeholder="Ej: Juan Pérez" value="${estudiante ? (estudiante.nombre + ' ' + estudiante.apellido).trim() : ''}">
                        </div>
                        <div class="flex gap-sm">
                            <div class="form-group" style="flex: 2;">
                                <label class="form-label">GRADO</label>
                                <select id="estGrado" class="form-select">
                                    ${GRADOS.map(g => `<option value="${g}" ${estudiante?.grado === g ? 'selected' : ''}>${g}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label class="form-label">SECCIÓN</label>
                                <select id="estSeccion" class="form-select">
                                    ${SECCIONES.map(s => `<option value="${s}" ${estudiante?.seccion === s ? 'selected' : ''}>${s}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Datos del Representante -->
                <div class="card card-accent-top">
                    <h3 style="color: var(--primary); margin-bottom: var(--space-md);">👤 Representante</h3>
                    <p class="text-xs text-muted mb-sm">Escribe para buscar un representante existente, o ingresa un nombre nuevo. Si el teléfono ya existe, se actualizarán los datos.</p>
                    <div class="form-stack">
                        <div class="form-group">
                            <label class="form-label">NOMBRE Y APELLIDO (REPRESENTANTE)</label>
                            <input type="text" id="repNombre" class="form-input" list="listaRepresentantes" autocomplete="off" placeholder="Buscar o escribir nombre..." value="${estudiante?.representanteNombre || ''}">
                            <datalist id="listaRepresentantes">
                                ${currentRepresentantes.map(r => `<option value="${r.nombre}">${r.telefono}</option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label class="form-label">TELÉFONO DEL REPRESENTANTE</label>
                            <input type="tel" id="repTelefono" class="form-input" placeholder="Ej: 04141234567" value="${estudiante?.representanteTelefono || ''}">
                        </div>
                    </div>
                </div>

                <button class="btn btn-primary btn-lg btn-block mt-lg" id="btnGuardarEstudiante">
                    ${isEdit ? 'Guardar Cambios' : 'Registrar Alumno'}
                </button>
            </div>
        </div>
    `;

    // Cerrar formulario
    document.getElementById('btnCerrarForm').addEventListener('click', ocultarFormulario);

    // Auto-rellenar teléfono si elige un representante existente
    document.getElementById('repNombre').addEventListener('input', (e) => {
        const nombreIngresado = e.target.value.trim();
        const rep = currentRepresentantes.find(r => r.nombre === nombreIngresado);
        if (rep && rep.telefono) {
            document.getElementById('repTelefono').value = rep.telefono;
        }
    });

    // Eliminar (solo si es edición)
    if (isEdit) {
        document.getElementById('btnEliminarEstudiante').addEventListener('click', () => manejarEliminacion(estudiante));
    }

    // Guardar
    document.getElementById('btnGuardarEstudiante').addEventListener('click', async (e) => {
        const btn = e.target;
        
        const nombreCompleto = document.getElementById('estNombreCompleto').value.trim();
        const partesNombre = nombreCompleto.split(/\s+/);
        
        if (partesNombre.length < 2) {
            showNotification('El alumno debe tener al menos un nombre y un apellido', 'warning');
            return;
        }

        const estData = {
            nombre: capitalizeWords(partesNombre[0]),
            apellido: capitalizeWords(partesNombre.slice(1).join(' ')),
            grado: document.getElementById('estGrado').value,
            seccion: document.getElementById('estSeccion').value
        };

        const repData = {
            telefono: document.getElementById('repTelefono').value.trim(),
            nombre: capitalizeWords(document.getElementById('repNombre').value.trim())
        };

        if (!repData.telefono || !repData.nombre) {
            showNotification('Completa los datos del representante', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Guardando...';

        try {
            // Lógica para el Representante (buscar por teléfono exacto)
            let repId = null;
            const repExistente = currentRepresentantes.find(r => r.telefono === repData.telefono);

            if (repExistente) {
                // Actualizar nombre si cambió
                if (repExistente.nombre !== repData.nombre) {
                    await updateRepresentante(businessId, repExistente.id, { nombre: repData.nombre });
                }
                repId = repExistente.id;
            } else {
                // Crear nuevo
                repId = await createRepresentante(businessId, repData);
            }

            estData.representanteId = repId;

            // Lógica para el Estudiante
            if (isEdit) {
                await updateEstudiante(businessId, estudiante.id, estData);
                showNotification('Alumno actualizado', 'success');
            } else {
                await createEstudiante(businessId, estData);
                showNotification('Alumno registrado exitosamente', 'success');
            }

            // Recargar vista
            await cargarDatosYRenderizar();
            ocultarFormulario();

        } catch (error) {
            console.error('Error guardando:', error);
            showNotification('Ocurrió un error al guardar', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Guardar Cambios' : 'Registrar Alumno';
        }
    });
}

/**
 * Oculta el formulario y vuelve a la lista.
 */
function ocultarFormulario() {
    document.getElementById('estudiantesFormContainer').classList.add('hidden');
    document.getElementById('estudiantesListado').classList.remove('hidden');
}

/**
 * Maneja el flujo de eliminación.
 */
async function manejarEliminacion(estudiante) {
    if (estudiante.estadoCuentaUSD > 0) {
        showNotification('No puedes eliminar un alumno con deuda pendiente.', 'error');
        return;
    }

    const confirma = await showConfirm(
        'Eliminar Alumno', 
        `¿Estás seguro de que deseas eliminar a ${estudiante.nombre} ${estudiante.apellido}? Esta acción es irreversible.`,
        'Eliminar',
        'Cancelar'
    );

    if (confirma) {
        try {
            await deleteEstudiante(businessId, estudiante.id);
            showNotification('Alumno eliminado', 'success');
            await cargarDatosYRenderizar();
            ocultarFormulario();
        } catch (error) {
            console.error(error);
            showNotification(error.message || 'Error al eliminar', 'error');
        }
    }
}
