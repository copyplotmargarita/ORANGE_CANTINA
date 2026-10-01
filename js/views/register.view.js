// ============================================================
// Orange Cantina Escolar — register.view.js
// Pantalla de registro de nueva cuenta
// ============================================================

import { auth, db, createUserWithEmailAndPassword, sendEmailVerification, doc, setDoc, serverTimestamp } from '../firebase-config.js';
import { showNotification, generateId } from '../utils.js';

/**
 * Renderiza la pantalla de registro en el contenedor dado.
 * @param {HTMLElement} container
 */
export function renderRegister(container) {
    container.innerHTML = `
        <div class="auth-screen">
            <div class="auth-logo">🍊</div>
            <h1 class="auth-title">Crear Cuenta</h1>
            <p class="auth-subtitle">Registra tu cantina escolar</p>

            <div class="form-container">
                <div class="form-sections">

                    <!-- Sección 1: Datos Personales -->
                    <div class="card card-accent-top">
                        <h3 style="color: var(--primary); margin-bottom: var(--space-md);">👤 Datos Personales</h3>
                        <div class="form-stack">
                            <div class="form-group">
                                <label class="form-label" for="regNombre">NOMBRE</label>
                                <input type="text" id="regNombre" class="form-input" placeholder="Tu nombre">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regApellido">APELLIDO</label>
                                <input type="text" id="regApellido" class="form-input" placeholder="Tu apellido">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regTelefono">TELÉFONO</label>
                                <input type="tel" id="regTelefono" class="form-input" placeholder="+58 412 1234567">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regEmail">CORREO ELECTRÓNICO</label>
                                <input type="email" id="regEmail" class="form-input" placeholder="tucorreo@email.com" autocomplete="email">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regPassword">CONTRASEÑA</label>
                                <input type="password" id="regPassword" class="form-input" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regPasswordConfirm">CONFIRMAR CONTRASEÑA</label>
                                <input type="password" id="regPasswordConfirm" class="form-input" placeholder="Repite tu contraseña" autocomplete="new-password">
                            </div>
                        </div>
                    </div>

                    <!-- Sección 2: Datos del Colegio y Cantina -->
                    <div class="card card-accent-top">
                        <h3 style="color: var(--primary); margin-bottom: var(--space-md);">🏫 Datos del Colegio y Cantina</h3>
                        <div class="form-stack">
                            <div class="form-group">
                                <label class="form-label" for="regColegio">NOMBRE DEL COLEGIO</label>
                                <input type="text" id="regColegio" class="form-input" placeholder="Ej: U.E. Simón Bolívar">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regCantina">NOMBRE DE LA CANTINA</label>
                                <input type="text" id="regCantina" class="form-input" placeholder="Ej: Cantina Don Pepe">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regEstado">ESTADO</label>
                                <select id="regEstado" class="form-select">
                                    <option value="">Selecciona un estado</option>
                                    <option value="Amazonas">Amazonas</option>
                                    <option value="Anzoátegui">Anzoátegui</option>
                                    <option value="Apure">Apure</option>
                                    <option value="Aragua">Aragua</option>
                                    <option value="Barinas">Barinas</option>
                                    <option value="Bolívar">Bolívar</option>
                                    <option value="Carabobo">Carabobo</option>
                                    <option value="Cojedes">Cojedes</option>
                                    <option value="Delta Amacuro">Delta Amacuro</option>
                                    <option value="Distrito Capital">Distrito Capital</option>
                                    <option value="Falcón">Falcón</option>
                                    <option value="Guárico">Guárico</option>
                                    <option value="La Guaira">La Guaira</option>
                                    <option value="Lara">Lara</option>
                                    <option value="Mérida">Mérida</option>
                                    <option value="Miranda">Miranda</option>
                                    <option value="Monagas">Monagas</option>
                                    <option value="Nueva Esparta">Nueva Esparta</option>
                                    <option value="Portuguesa">Portuguesa</option>
                                    <option value="Sucre">Sucre</option>
                                    <option value="Táchira">Táchira</option>
                                    <option value="Trujillo">Trujillo</option>
                                    <option value="Yaracuy">Yaracuy</option>
                                    <option value="Zulia">Zulia</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regCiudad">CIUDAD</label>
                                <input type="text" id="regCiudad" class="form-input" placeholder="Ej: Caracas">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="regDireccion">DIRECCIÓN</label>
                                <input type="text" id="regDireccion" class="form-input" placeholder="Dirección del colegio">
                            </div>
                        </div>
                    </div>

                    <!-- Botones de acción -->
                    <div class="form-actions">
                        <a href="#login" class="btn btn-outline" style="flex: 1; min-height: 50px; font-weight: 700; text-decoration: none;">
                            Cancelar
                        </a>
                        <button id="btnRegister" class="btn btn-primary" style="flex: 1; min-height: 50px; font-weight: 700;">
                            Crear Cuenta
                        </button>
                    </div>

                </div>
            </div>

            <div class="auth-footer">
                ¿Ya tienes cuenta?
                <a href="#login">Iniciar sesión</a>
            </div>
        </div>
    `;

    // ──────────── Referencias a elementos ────────────
    const btnRegister = document.getElementById('btnRegister');

    // ──────────── Registro ────────────
    btnRegister.addEventListener('click', async () => {
        // Recoger valores
        const nombre = document.getElementById('regNombre').value.trim();
        const apellido = document.getElementById('regApellido').value.trim();
        const telefono = document.getElementById('regTelefono').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;
        const colegio = document.getElementById('regColegio').value.trim();
        const cantina = document.getElementById('regCantina').value.trim();
        const estado = document.getElementById('regEstado').value;
        const ciudad = document.getElementById('regCiudad').value.trim();
        const direccion = document.getElementById('regDireccion').value.trim();

        // ──── Validaciones ────
        if (!nombre || !apellido || !email || !password) {
            showNotification('Completa los campos obligatorios (nombre, apellido, correo y contraseña)', 'warning');
            return;
        }

        if (password.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'warning');
            return;
        }

        if (password !== passwordConfirm) {
            showNotification('Las contraseñas no coinciden', 'warning');
            return;
        }

        if (!colegio || !cantina) {
            showNotification('El nombre del colegio y la cantina son obligatorios', 'warning');
            return;
        }

        // ──── Crear cuenta ────
        btnRegister.disabled = true;
        btnRegister.innerHTML = '<div class="spinner"></div> Creando cuenta...';

        try {
            // 1. Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Enviar verificación de correo
            await sendEmailVerification(user);

            // 3. Generar businessId único
            const businessId = generateId();

            // 4. Guardar datos del usuario en Firestore
            await setDoc(doc(db, 'usuarios', user.uid), {
                nombre,
                apellido,
                telefono,
                email,
                nombreCantina: cantina,
                nombreColegio: colegio,
                direccion,
                estado,
                ciudad,
                businessId,
                fechaRegistro: serverTimestamp()
            });

            // 5. Crear documento del negocio
            await setDoc(doc(db, 'negocios', businessId), {
                nombreCantina: cantina,
                nombreColegio: colegio,
                direccion,
                estado,
                ciudad,
                adminUid: user.uid,
                fechaCreacion: serverTimestamp()
            });

            // 6. Guardar businessId en localStorage
            localStorage.setItem('businessId', businessId);

            showNotification('¡Cuenta creada exitosamente! Revisa tu correo para verificarlo 📧', 'success', 5000);

            // El auth guard redirige automáticamente a #dashboard
        } catch (error) {
            console.error('Error de registro:', error);
            const msgs = {
                'auth/email-already-in-use': 'Ya existe una cuenta con ese correo',
                'auth/invalid-email': 'El correo electrónico no es válido',
                'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres)',
            };
            showNotification(msgs[error.code] || 'Error al crear la cuenta', 'error');
        } finally {
            btnRegister.disabled = false;
            btnRegister.textContent = 'Crear Cuenta';
        }
    });

    // Autofocus en nombre
    document.getElementById('regNombre').focus();
}
