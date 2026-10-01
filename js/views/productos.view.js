// ============================================================
// Orange Cantina Escolar — productos.view.js
// Pantalla de gestión de Productos de la Cantina
// ============================================================

import { showNotification, showConfirm, formatCurrencyDE, bcvToBS, parseAtmAmount, applyAtmMask, capitalizeWords } from '../utils.js';
import { getProductos, createProducto, updateProducto } from '../services/productos.service.js';

let businessId = null;
let currentProductos = [];
let currentBcvRate = 1;
let filterMode = 'all'; // 'all' o 'active'

export async function renderProductos(container) {
    businessId = localStorage.getItem('businessId');
    currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    if (!businessId) {
        showNotification('Error: Negocio no identificado', 'error');
        return;
    }

    container.innerHTML = `
        <div id="productosListado">
            <div class="flex gap-sm mb-md">
                <div class="search-bar" style="flex: 1; margin-bottom: 0;">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="searchProductos" class="form-input" placeholder="Buscar producto...">
                </div>
                <button class="btn btn-primary" id="btnCrearProductoTop" style="white-space: nowrap;">
                    ➕ Nuevo
                </button>
            </div>

            <!-- Filtros -->
            <div class="flex gap-sm mb-md" style="overflow-x: auto;">
                <button class="btn btn-sm btn-primary" id="btnFilterAll">Todos</button>
                <button class="btn btn-sm btn-ghost" id="btnFilterActive">Solo Activos</button>
            </div>

            <div id="productosGrid" class="mobile-cards">
                <div class="loading-screen"><div class="spinner"></div></div>
            </div>

            <!-- Botón Flotante -->
            <button class="fab" id="btnCrearProducto" title="Nuevo Producto">
                ➕
            </button>
        </div>

        <!-- Contenedor del formulario -->
        <div id="productosFormContainer" class="hidden"></div>
    `;

    await cargarDatosYRenderizar();

    // Listeners
    document.getElementById('btnCrearProductoTop').addEventListener('click', () => mostrarFormulario());
    document.getElementById('btnCrearProducto').addEventListener('click', () => mostrarFormulario());
    
    document.getElementById('searchProductos').addEventListener('input', (e) => {
        filtrarYRenderizar(e.target.value);
    });

    document.getElementById('btnFilterAll').addEventListener('click', (e) => {
        filterMode = 'all';
        e.target.className = 'btn btn-sm btn-primary';
        document.getElementById('btnFilterActive').className = 'btn btn-sm btn-ghost';
        filtrarYRenderizar(document.getElementById('searchProductos').value);
    });

    document.getElementById('btnFilterActive').addEventListener('click', (e) => {
        filterMode = 'active';
        e.target.className = 'btn btn-sm btn-primary';
        document.getElementById('btnFilterAll').className = 'btn btn-sm btn-ghost';
        filtrarYRenderizar(document.getElementById('searchProductos').value);
    });
}

async function cargarDatosYRenderizar() {
    try {
        currentProductos = await getProductos(businessId);
        // Ordenar alfabéticamente
        currentProductos.sort((a, b) => a.nombre.localeCompare(b.nombre));
        filtrarYRenderizar(document.getElementById('searchProductos').value || '');
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error al cargar productos', 'error');
    }
}

function filtrarYRenderizar(query) {
    const grid = document.getElementById('productosGrid');
    if (!grid) return;

    const q = query.toLowerCase().trim();
    
    let filtrados = currentProductos.filter(p => p.nombre.toLowerCase().includes(q));

    if (filterMode === 'active') {
        filtrados = filtrados.filter(p => p.activo === true);
    }

    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🍔</span>
                <h3>Sin productos</h3>
                <p>No se encontraron productos con esos criterios.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtrados.map(p => {
        const precioBs = bcvToBS(p.precioUSD, currentBcvRate);
        const opacity = p.activo ? '1' : '0.5';
        const badge = p.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge" style="background: var(--text-muted); color: white;">Inactivo</span>';

        return `
            <div class="mobile-card-row card-clickable" data-id="${p.id}" style="opacity: ${opacity};">
                <div class="flex justify-between items-center mb-sm">
                    <h3 class="text-primary font-bold" style="font-size: 1.1rem;">${p.nombre}</h3>
                    ${badge}
                </div>
                
                <div class="divider" style="margin: 0.5rem 0;"></div>

                <div class="flex justify-between items-center">
                    <div class="flex flex-col">
                        <span class="text-xs text-muted">PRECIO USD</span>
                        <span class="row-value font-bold text-success">$${formatCurrencyDE(p.precioUSD)}</span>
                    </div>
                    <div class="flex flex-col text-right">
                        <span class="text-xs text-muted">EQUIVALENTE BS</span>
                        <span class="row-value font-bold">Bs. ${formatCurrencyDE(precioBs)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.card-clickable').forEach(card => {
        card.addEventListener('click', () => {
            const prod = currentProductos.find(p => p.id === card.dataset.id);
            if (prod) mostrarFormulario(prod);
        });
    });
}

function mostrarFormulario(producto = null) {
    const isEdit = !!producto;
    
    document.getElementById('productosListado').classList.add('hidden');
    const container = document.getElementById('productosFormContainer');
    container.classList.remove('hidden');

    // Formatear valor inicial para la máscara ATM (necesita estar en el formato correcto visualmente)
    const precioValue = producto ? formatCurrencyDE(producto.precioUSD) : '';

    container.innerHTML = `
        <div class="view-header">
            <button class="btn btn-ghost btn-back" id="btnCerrarProdForm">⬅️ Volver</button>
            <h2>${isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <div></div> <!-- Espaciador para centrar -->
        </div>

        <div class="form-container">
            <div class="card card-accent-top">
                <div class="form-stack">
                    <div class="form-group">
                        <label class="form-label">NOMBRE DEL PRODUCTO</label>
                        <input type="text" id="prodNombre" class="form-input" placeholder="Ej: Empanada de Queso" value="${producto?.nombre || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">PRECIO EN DÓLARES (USD)</label>
                        <div class="search-bar" style="margin-bottom: 0;">
                            <span class="search-icon" style="color: var(--success); font-weight: bold;">$</span>
                            <input type="tel" id="prodPrecio" class="form-input" placeholder="Ej: 1,50" value="${precioValue}">
                        </div>
                        <p class="text-xs text-muted mt-xs">Escribe los números de corrido. Ejemplo: para 1,50 escribe 150.</p>
                    </div>

                    ${isEdit ? `
                    <div class="divider"></div>
                    <div class="form-group">
                        <label class="form-label">ESTADO DEL PRODUCTO</label>
                        <select id="prodEstado" class="form-select">
                            <option value="true" ${producto.activo ? 'selected' : ''}>✅ Activo (Disponible)</option>
                            <option value="false" ${!producto.activo ? 'selected' : ''}>🚫 Inactivo (Agotado/No disponible)</option>
                        </select>
                    </div>
                    ` : ''}
                </div>
            </div>

            <button class="btn btn-primary btn-lg btn-block mt-lg" id="btnGuardarProducto">
                ${isEdit ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
        </div>
    `;

    // Aplicar máscara ATM
    applyAtmMask(document.getElementById('prodPrecio'));

    document.getElementById('btnCerrarProdForm').addEventListener('click', ocultarFormulario);

    document.getElementById('btnGuardarProducto').addEventListener('click', async (e) => {
        const btn = e.target;
        
        const nombre = capitalizeWords(document.getElementById('prodNombre').value.trim());
        const precioUSD = parseAtmAmount(document.getElementById('prodPrecio').value);

        if (!nombre) {
            showNotification('El nombre del producto es obligatorio', 'warning');
            return;
        }

        if (isNaN(precioUSD) || precioUSD < 0) {
            showNotification('Ingresa un precio válido', 'warning');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Guardando...';

        try {
            const data = {
                nombre: nombre,
                precioUSD: precioUSD
            };

            if (isEdit) {
                // Leer el estado si existe
                const estadoSelect = document.getElementById('prodEstado');
                if (estadoSelect) {
                    data.activo = estadoSelect.value === 'true';
                }
                await updateProducto(businessId, producto.id, data);
                showNotification('Producto actualizado', 'success');
            } else {
                data.activo = true;
                await createProducto(businessId, data);
                showNotification('Producto creado exitosamente', 'success');
            }

            await cargarDatosYRenderizar();
            ocultarFormulario();

        } catch (error) {
            console.error('Error guardando producto:', error);
            showNotification('Error al guardar el producto', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Producto';
        }
    });
}

function ocultarFormulario() {
    document.getElementById('productosFormContainer').classList.add('hidden');
    document.getElementById('productosListado').classList.remove('hidden');
}
