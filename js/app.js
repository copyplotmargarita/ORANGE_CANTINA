// ============================================================
// Orange Cantina Escolar — app.js
// Hash Router principal y orquestador de vistas
// ============================================================

import { auth, onAuthStateChanged } from './firebase-config.js';
import { loadSavedTheme } from './utils.js';
import { renderLogin } from './views/login.view.js';
import { renderRegister } from './views/register.view.js';
import { renderDashboard } from './views/dashboard.view.js';

// ──────────── Contenedor principal ────────────
const appContainer = document.getElementById('app');

// ──────────── Rutas disponibles ────────────
const routes = {
    '#login': renderLogin,
    '#register': renderRegister,
    '#dashboard': renderDashboard,
};

// ──────────── Vista actual (para evitar re-renders innecesarios) ────────────
let currentRoute = null;

/**
 * Limpia el contenedor y renderiza la vista correspondiente al hash actual.
 */
function navigateTo(hash) {
    // Evitar re-render si ya estamos en la misma ruta
    if (hash === currentRoute) return;
    currentRoute = hash;

    // Limpiar contenedor
    appContainer.innerHTML = '';

    // Buscar la función de render
    const renderFn = routes[hash];

    if (renderFn) {
        renderFn(appContainer);
    } else {
        // Ruta no encontrada — redirigir a dashboard o login
        const user = auth.currentUser;
        window.location.hash = user ? '#dashboard' : '#login';
    }
}

/**
 * Manejador del evento hashchange.
 */
function onHashChange() {
    const hash = window.location.hash || '#login';
    navigateTo(hash);
}

// ──────────── Guardia de Autenticación ────────────
function setupAuthGuard() {
    onAuthStateChanged(auth, (user) => {
        const hash = window.location.hash;

        if (user) {
            // Usuario autenticado
            if (hash === '#login' || hash === '#register' || !hash) {
                window.location.hash = '#dashboard';
            } else {
                navigateTo(hash);
            }
        } else {
            // No autenticado — solo puede ver login y register
            if (hash !== '#login' && hash !== '#register') {
                window.location.hash = '#login';
            } else {
                navigateTo(hash);
            }
        }
    });
}

// ──────────── Inicialización ────────────
function init() {
    // Cargar tema guardado
    loadSavedTheme();

    // Escuchar cambios de hash
    window.addEventListener('hashchange', onHashChange);

    // Configurar guardia de autenticación
    setupAuthGuard();
}

// Arrancar la app
init();
