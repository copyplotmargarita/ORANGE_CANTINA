// ============================================================
// Orange Cantina Escolar — login.view.js
// Pantalla de inicio de sesión
// ============================================================

import { auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '../firebase-config.js';
import { showNotification } from '../utils.js';

/**
 * Renderiza la pantalla de login en el contenedor dado.
 * @param {HTMLElement} container
 */
export function renderLogin(container) {
    container.innerHTML = `
        <div class="auth-screen">
            <div class="auth-logo">🍊</div>
            <h1 class="auth-title">Orange Cantina</h1>
            <p class="auth-subtitle">Gestión de cantina escolar</p>

            <div class="auth-card card card-accent-top">
                <div class="form-stack" style="padding: 0.5rem 0;">
                    <div class="form-group">
                        <label class="form-label" for="loginEmail">CORREO ELECTRÓNICO</label>
                        <input type="email" id="loginEmail" class="form-input"
                               placeholder="tucorreo@email.com" autocomplete="email">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="loginPassword">CONTRASEÑA</label>
                        <input type="password" id="loginPassword" class="form-input"
                               placeholder="Tu contraseña" autocomplete="current-password">
                    </div>

                    <button id="btnLogin" class="btn btn-primary btn-lg btn-block mt-lg">
                        Iniciar Sesión
                    </button>

                    <button id="btnForgotPassword" class="btn btn-ghost btn-block mt-sm"
                            style="font-size: 0.85rem;">
                        ¿Olvidaste tu contraseña?
                    </button>
                </div>
            </div>

            <div class="auth-footer">
                ¿No tienes cuenta?
                <a href="#register">Crear cuenta nueva</a>
            </div>
        </div>
    `;

    // ──────────── Referencias a elementos ────────────
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const btnLogin = document.getElementById('btnLogin');
    const btnForgot = document.getElementById('btnForgotPassword');

    // ──────────── Login ────────────
    btnLogin.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showNotification('Completa todos los campos', 'warning');
            return;
        }

        btnLogin.disabled = true;
        btnLogin.innerHTML = '<div class="spinner"></div> Ingresando...';

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showNotification('¡Bienvenido! 🎉', 'success');
            // El auth guard redirige automáticamente a #dashboard
        } catch (error) {
            console.error('Error de login:', error);
            const msgs = {
                'auth/user-not-found': 'No existe una cuenta con ese correo',
                'auth/wrong-password': 'Contraseña incorrecta',
                'auth/invalid-email': 'Correo electrónico inválido',
                'auth/too-many-requests': 'Demasiados intentos. Espera un momento',
                'auth/invalid-credential': 'Correo o contraseña incorrectos',
            };
            showNotification(msgs[error.code] || 'Error al iniciar sesión', 'error');
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = 'Iniciar Sesión';
        }
    });

    // ──────────── Recuperar contraseña ────────────
    btnForgot.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
            showNotification('Escribe tu correo primero', 'warning');
            emailInput.focus();
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showNotification('Se envió un correo para restablecer tu contraseña 📧', 'success');
        } catch (error) {
            console.error('Error al recuperar contraseña:', error);
            showNotification('No se pudo enviar el correo de recuperación', 'error');
        }
    });

    // ──────────── Enter para enviar ────────────
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnLogin.click();
    });

    emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') passwordInput.focus();
    });

    // Autofocus en email
    emailInput.focus();
}
