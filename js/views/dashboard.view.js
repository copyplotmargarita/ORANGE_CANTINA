// ============================================================
// Orange Cantina Escolar — dashboard.view.js
// Shell principal: sidebar (desktop) + bottom nav (móvil)
// Header con tasa BCV + contenido dinámico
// ============================================================

import { auth, db, signOut, doc, getDoc } from '../firebase-config.js';
import { showNotification, toggleTheme, formatCurrencyDE, formatDateToDDMMYYYY } from '../utils.js';
import { renderEstudiantes } from './estudiantes.view.js';
import { renderProductos } from './productos.view.js';
import { renderPOS } from './pos.view.js';
import { renderCuentas } from './cuentas.view.js';
import { renderReportes } from './reportes.view.js';

// ──────────── Módulos de navegación ────────────
const NAV_ITEMS = [
    { id: 'inicio',       emoji: '🏠', label: 'Inicio',       mobileNav: false },
    { id: 'ventas',       emoji: '🛒', label: 'Ventas',       mobileNav: true },
    { id: 'estudiantes',  emoji: '🎓', label: 'Alumnos',      mobileNav: true },
    { id: 'cuentas',      emoji: '💰', label: 'Cuentas',      mobileNav: true },
    { id: 'productos',    emoji: '📦', label: 'Productos',    mobileNav: true },
    { id: 'reportes',     emoji: '📊', label: 'Reportes',     mobileNav: true },
];

// ──────────── Vista activa ────────────
let activeView = 'inicio';
let businessData = null;
let userData = null;

/**
 * Renderiza el dashboard completo.
 * @param {HTMLElement} container
 */
export async function renderDashboard(container) {
    // Cargar datos del usuario y negocio
    await loadUserData();

    container.innerHTML = `
        <!-- Sidebar (solo visible en desktop ≥1024px) -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-logo" id="navHome">
                <span class="logo-icon">🍊</span>
                <span class="logo-text">${businessData?.nombreCantina || 'Orange Cantina'}</span>
            </div>
            <nav class="sidebar-nav" id="sidebarNav">
                ${NAV_ITEMS.map(item => `
                    <button class="sidebar-item ${item.id === activeView ? 'active' : ''}"
                            data-view="${item.id}">
                        <span class="nav-emoji">${item.emoji}</span>
                        <span>${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="divider"></div>
            <div class="flex flex-col gap-xs">
                <button class="sidebar-item" id="btnThemeDesktop">
                    <span class="nav-emoji">🌙</span>
                    <span>Cambiar Tema</span>
                </button>
                <button class="sidebar-item" id="btnLogoutDesktop" style="color: var(--danger);">
                    <span class="nav-emoji">🚪</span>
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>

        <!-- Contenido Principal -->
        <main class="main-content" id="mainContent">
            <!-- Header con Fecha y BCV -->
            <header class="flex items-center justify-between mb-lg" style="gap: 0.25rem; flex-wrap: nowrap;">
                <div style="flex-shrink: 0;">
                    <h2 style="color: var(--primary); font-size: 1.25rem; font-weight: 800; margin: 0; white-space: nowrap;">${formatDateToDDMMYYYY(new Date())}</h2>
                </div>
                <div class="flex items-center" style="gap: 0.25rem; flex-shrink: 1; overflow-x: auto; justify-content: flex-end;">
                    <!-- Tasa BCV -->
                    <div class="card" style="padding: 0.25rem 0.5rem; display: flex; align-items: center; gap: 0.25rem; margin: 0; white-space: nowrap; border-radius: 1.5rem;">
                        <span class="text-xs font-bold text-muted">BCV</span>
                        <span class="font-bold text-primary" id="bcvRateDisplay" style="font-size: 1rem;">--</span>
                        <span class="text-xs text-muted">Bs/$</span>
                        <button class="btn btn-ghost btn-sm" id="btnEditBcv" title="Editar tasa" style="padding: 0.15rem; min-height: auto;">
                            ✏️
                        </button>
                    </div>
                    <!-- Tema (móvil) -->
                    <button class="theme-toggle" id="btnThemeMobile" title="Cambiar tema" style="flex-shrink: 0; width: 38px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center;">
                        🌙
                    </button>
                    <!-- Menú hamburguesa (móvil) — para opciones extra -->
                    <button class="theme-toggle" id="btnMenuMobile" title="Más opciones" style="flex-shrink: 0; width: 38px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center;">
                        ☰
                    </button>
                </div>
            </header>

            <!-- Área de contenido dinámico -->
            <div id="dynamicContent"></div>
        </main>

        <!-- Bottom Navigation (solo visible en móvil <1024px) -->
        <nav class="bottom-nav" id="bottomNav">
            ${NAV_ITEMS.filter(i => i.mobileNav).map(item => `
                <button class="bottom-nav-item ${item.id === activeView ? 'active' : ''}"
                        data-view="${item.id}">
                    <span class="nav-icon">${item.emoji}</span>
                    <span>${item.label}</span>
                </button>
            `).join('')}
        </nav>
    `;

    // ──────────── Event Listeners ────────────
    setupNavigation();
    setupBcvDisplay();
    setupHeaderActions();

    // Renderizar vista inicial
    renderActiveView();
}

/**
 * Carga los datos del usuario y negocio desde Firestore / localStorage.
 */
async function loadUserData() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // Cargar datos del usuario
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
            // Guardar businessId en localStorage
            if (userData.businessId) {
                localStorage.setItem('businessId', userData.businessId);
            }
        }

        // Cargar datos del negocio
        const businessId = localStorage.getItem('businessId');
        if (businessId) {
            const bizDoc = await getDoc(doc(db, 'negocios', businessId));
            if (bizDoc.exists()) {
                businessData = bizDoc.data();
            }
        }
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}

/**
 * Configura la navegación entre vistas (sidebar + bottom nav).
 */
function setupNavigation() {
    // Sidebar clicks
    document.getElementById('sidebarNav')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-view]');
        if (btn) switchView(btn.dataset.view);
    });

    // Bottom nav clicks
    document.getElementById('bottomNav')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-view]');
        if (btn) switchView(btn.dataset.view);
    });

    // Logo → Inicio
    document.getElementById('navHome')?.addEventListener('click', () => switchView('inicio'));
}

/**
 * Cambia la vista activa.
 * @param {string} viewId
 */
function switchView(viewId) {
    activeView = viewId;

    // Actualizar clases activas en sidebar
    document.querySelectorAll('.sidebar-item[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // Actualizar clases activas en bottom nav
    document.querySelectorAll('.bottom-nav-item[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    // (El título de la vista y subtitulo han sido removidos del header a favor de la fecha)

    // Renderizar vista
    renderActiveView();
}

/**
 * Renderiza el contenido de la vista activa.
 */
async function renderActiveView() {
    const content = document.getElementById('dynamicContent');
    if (!content) return;

    // Limpiar contenido
    content.innerHTML = '<div class="loading-screen"><div class="spinner spinner-lg"></div></div>';

    switch (activeView) {
        case 'inicio':
            renderHome(content);
            break;
        case 'ventas':
            renderPOS(content);
            break;
        case 'estudiantes':
            renderEstudiantes(content);
            break;
        case 'cuentas':
            renderCuentas(content);
            break;
        case 'productos':
            renderProductos(content);
            break;
        case 'reportes':
            renderReportes(content);
            break;
        default:
            renderHome(content);
    }
}

/**
 * Renderiza la pantalla de inicio / dashboard principal.
 */
function renderHome(content) {
    content.innerHTML = `
        <div class="card-grid" style="margin-bottom: var(--space-lg);">
            <!-- Resumen rápido — placeholders hasta que se conecten los módulos -->
            <div class="card card-clickable" data-goto="ventas">
                <div class="flex items-center gap-sm mb-sm">
                    <span style="font-size: 1.5rem;">🛒</span>
                    <h3>Ventas del Día</h3>
                </div>
                <p class="text-secondary text-sm">Registrar ventas rápidamente</p>
            </div>

            <div class="card card-clickable" data-goto="estudiantes">
                <div class="flex items-center gap-sm mb-sm">
                    <span style="font-size: 1.5rem;">🎓</span>
                    <h3>Alumnos</h3>
                </div>
                <p class="text-secondary text-sm">Gestionar estudiantes y representantes</p>
            </div>

            <div class="card card-clickable" data-goto="cuentas">
                <div class="flex items-center gap-sm mb-sm">
                    <span style="font-size: 1.5rem;">💰</span>
                    <h3>Cuentas</h3>
                </div>
                <p class="text-secondary text-sm">Cobrar deudas y ver estados de cuenta</p>
            </div>

            <div class="card card-clickable" data-goto="productos">
                <div class="flex items-center gap-sm mb-sm">
                    <span style="font-size: 1.5rem;">📦</span>
                    <h3>Productos</h3>
                </div>
                <p class="text-secondary text-sm">Administrar catálogo y precios</p>
            </div>

            <div class="card card-clickable" data-goto="reportes">
                <div class="flex items-center gap-sm mb-sm">
                    <span style="font-size: 1.5rem;">📊</span>
                    <h3>Reportes</h3>
                </div>
                <p class="text-secondary text-sm">Ver e imprimir reportes generales</p>
            </div>
        </div>
    `;

    // Clicks en tarjetas para navegar
    content.querySelectorAll('[data-goto]').forEach(card => {
        card.addEventListener('click', () => switchView(card.dataset.goto));
    });
}

/**
 * Configura el display de la tasa BCV.
 */
function setupBcvDisplay() {
    const display = document.getElementById('bcvRateDisplay');
    const btnEdit = document.getElementById('btnEditBcv');

    // Cargar tasa desde localStorage o mostrar placeholder
    const savedRate = localStorage.getItem('bcvRate');
    if (savedRate && display) {
        display.textContent = formatCurrencyDE(parseFloat(savedRate));
    }

    // Botón editar BCV
    btnEdit?.addEventListener('click', () => {
        showBcvEditModal();
    });

    // Intentar cargar tasa del día automáticamente
    fetchBcvRate();
}

/**
 * Intenta obtener la tasa BCV de la API.
 */
async function fetchBcvRate() {
    try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (!response.ok) throw new Error('API no disponible');
        const data = await response.json();

        if (data && data.promedio) {
            const tasa = data.promedio;
            localStorage.setItem('bcvRate', tasa.toString());
            localStorage.setItem('bcvDate', new Date().toISOString().split('T')[0]);

            const display = document.getElementById('bcvRateDisplay');
            if (display) {
                display.textContent = formatCurrencyDE(tasa);
            }

            // Guardar en historial Firestore
            saveBcvToHistory(tasa, 'API');
        }
    } catch (error) {
        console.warn('No se pudo obtener la tasa BCV automáticamente:', error.message);
        // No mostrar error al usuario — la tasa manual es el fallback
    }
}

/**
 * Guarda la tasa BCV en el historial de Firestore.
 */
async function saveBcvToHistory(tasa, origen) {
    try {
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;

        const { setDoc, doc, serverTimestamp } = await import('../firebase-config.js');
        const fechaISO = new Date().toISOString().split('T')[0];

        await setDoc(doc(db, 'negocios', businessId, 'bcv_history', fechaISO), {
            tasa,
            origen,
            fechaActualizacion: serverTimestamp()
        });
    } catch (error) {
        console.error('Error guardando tasa BCV:', error);
    }
}

/**
 * Muestra un modal para editar la tasa BCV manualmente.
 */
function showBcvEditModal() {
    const currentRate = localStorage.getItem('bcvRate') || '';

    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 360px;">
            <div class="modal-drag-bar"></div>
            <div class="modal-header">
                <h3>💱 Editar Tasa BCV</h3>
                <button class="modal-close" id="closeBcvModal">✕</button>
            </div>
            <div class="form-stack">
                <div class="form-group">
                    <label class="form-label">TASA BS. POR DÓLAR</label>
                    <input type="text" id="bcvInput" class="form-input"
                           placeholder="Ej: 36,50" value="${currentRate ? formatCurrencyDE(parseFloat(currentRate)) : ''}"
                           inputmode="decimal">
                </div>
                <p class="text-xs text-muted mt-sm">
                    Esta tasa se usará para todas las conversiones USD → Bs. del día.
                </p>
                <button class="btn btn-primary btn-block mt-lg" id="btnSaveBcv">
                    Guardar Tasa
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cerrar modal
    const closeModal = () => overlay.remove();
    overlay.querySelector('#closeBcvModal').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Guardar tasa
    overlay.querySelector('#btnSaveBcv').addEventListener('click', () => {
        const input = document.getElementById('bcvInput');
        const rawValue = input.value.replace(/\./g, '').replace(',', '.');
        const tasa = parseFloat(rawValue);

        if (isNaN(tasa) || tasa <= 0) {
            showNotification('Ingresa una tasa válida', 'warning');
            return;
        }

        localStorage.setItem('bcvRate', tasa.toString());
        localStorage.setItem('bcvDate', new Date().toISOString().split('T')[0]);

        const display = document.getElementById('bcvRateDisplay');
        if (display) display.textContent = formatCurrencyDE(tasa);

        saveBcvToHistory(tasa, 'MANUAL');
        showNotification(`Tasa BCV actualizada: ${formatCurrencyDE(tasa)} Bs/$`, 'success');
        closeModal();
    });

    // Focus en input
    document.getElementById('bcvInput')?.focus();
}

/**
 * Configura botones del header (tema, logout, menú móvil).
 */
function setupHeaderActions() {
    // Tema
    document.getElementById('btnThemeDesktop')?.addEventListener('click', toggleTheme);
    document.getElementById('btnThemeMobile')?.addEventListener('click', toggleTheme);

    // Logout desktop
    document.getElementById('btnLogoutDesktop')?.addEventListener('click', handleLogout);

    // Menú hamburguesa móvil
    document.getElementById('btnMenuMobile')?.addEventListener('click', showMobileMenu);
}

/**
 * Muestra menú extra en móvil (Productos, Reportes, Cerrar Sesión).
 */
function showMobileMenu() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 320px; padding-bottom: 2rem;">
            <div class="modal-drag-bar"></div>
            <div class="flex flex-col gap-xs">
                <button class="sidebar-item" id="btnLogoutMobile" style="color: var(--danger); padding: 1rem;">
                    <span class="nav-emoji" style="font-size: 1.3rem;">🚪</span>
                    <span style="font-size: 1rem;">Cerrar Sesión</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Cerrar al hacer clic fuera
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Logout desde menú móvil
    overlay.querySelector('#btnLogoutMobile')?.addEventListener('click', () => {
        overlay.remove();
        handleLogout();
    });
}

/**
 * Cierra la sesión del usuario.
 */
async function handleLogout() {
    try {
        await signOut(auth);
        localStorage.removeItem('businessId');
        showNotification('Sesión cerrada', 'info');
        // El auth guard redirige a #login
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
}
