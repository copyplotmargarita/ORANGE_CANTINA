// ============================================================
// Orange Cantina Escolar — utils.js
// Funciones utilitarias compartidas
// ============================================================

/**
 * Aplica máscara de cajero ATM a un input de monto.
 * El usuario teclea dígitos y el sistema los empuja de derecha a izquierda
 * colocando automáticamente coma para decimales y puntos para miles.
 * Ejemplo: 101536 → 1.015,36
 *
 * @param {HTMLInputElement} input - El elemento input al que aplicar la máscara
 */
export function applyAtmMask(input) {
    input.addEventListener('input', (e) => {
        // Extraer solo dígitos del valor actual
        let digits = e.target.value.replace(/\D/g, '');

        // Limitar a un máximo razonable (12 dígitos = hasta 9.999.999.999,99)
        if (digits.length > 12) {
            digits = digits.slice(0, 12);
        }

        // Si no hay dígitos, limpiar
        if (!digits) {
            e.target.value = '';
            return;
        }

        // Convertir a número con 2 decimales
        const number = parseInt(digits, 10) / 100;

        // Formatear con locale de-DE (punto miles, coma decimal)
        e.target.value = number.toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    });

    // Prevenir teclas no numéricas
    input.addEventListener('keydown', (e) => {
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(e.key)) return;
        if (e.key >= '0' && e.key <= '9') return;
        e.preventDefault();
    });

    // Establecer atributos para móvil
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]*');
}

/**
 * Convierte un texto formateado por la máscara ATM a número flotante.
 * Ejemplo: "1.015,36" → 1015.36
 *
 * @param {string} text - El texto formateado (ej. "1.015,36")
 * @returns {number} - El valor numérico (ej. 1015.36)
 */
export function parseAtmAmount(text) {
    if (!text || typeof text !== 'string') return 0;
    // Quitar puntos de miles, reemplazar coma por punto decimal
    const cleaned = text.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Formatea un número al formato visual de-DE (punto miles, coma decimal).
 * Ejemplo: 1015.36 → "1.015,36"
 *
 * @param {number} val - El número a formatear
 * @param {number} [decimals=2] - Cantidad de decimales
 * @returns {string} - El texto formateado
 */
export function formatCurrencyDE(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return '0,00';
    return Number(val).toLocaleString('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Convierte una fecha a formato DD/MM/YYYY para mostrar en la UI.
 *
 * @param {Date|string} date - Fecha (objeto Date o string ISO)
 * @returns {string} - Fecha formateada "dd/mm/yyyy"
 */
export function formatDateToDDMMYYYY(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Obtiene la fecha actual en formato ISO (YYYY-MM-DD).
 * Útil para claves de Firestore y valores de input[type=date].
 *
 * @returns {string} - Fecha ISO "yyyy-mm-dd"
 */
export function getTodayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convierte un monto en USD a Bolívares usando la tasa BCV.
 *
 * @param {number} usd - Monto en dólares
 * @param {number} tasa - Tasa BCV del día
 * @returns {number} - Monto en bolívares
 */
export function bcvToBS(usd, tasa) {
    if (!usd || !tasa) return 0;
    return usd * tasa;
}

/**
 * Convierte un monto en Bolívares a USD usando la tasa BCV.
 *
 * @param {number} bs - Monto en bolívares
 * @param {number} tasa - Tasa BCV del día
 * @returns {number} - Monto en dólares
 */
export function bsToUSD(bs, tasa) {
    if (!bs || !tasa) return 0;
    return bs / tasa;
}

/**
 * Muestra una notificación toast en la pantalla.
 *
 * @param {string} msg - Mensaje a mostrar
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - Tipo de notificación
 * @param {number} [duration=3000] - Duración en ms antes de desaparecer
 */
export function showNotification(msg, type = 'info', duration = 3000) {
    // Crear contenedor si no existe
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Crear toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Ícono según tipo
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(toast);

    // Auto-remover
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

/**
 * Muestra un diálogo de confirmación antes de acciones irreversibles.
 *
 * @param {string} title - Título del diálogo
 * @param {string} message - Mensaje descriptivo
 * @param {string} [confirmText='Confirmar'] - Texto del botón de confirmar
 * @param {string} [cancelText='Cancelar'] - Texto del botón de cancelar
 * @returns {Promise<boolean>} - true si confirma, false si cancela
 */
export function showConfirm(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="btn btn-outline" id="confirmCancel">${cancelText}</button>
                    <button class="btn btn-danger" id="confirmOk">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#confirmCancel').addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        overlay.querySelector('#confirmOk').addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        // Cerrar con click en overlay (fuera del diálogo)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

/**
 * Genera un ID único corto basado en timestamp + random.
 * Útil para IDs temporales antes de guardar en Firestore.
 *
 * @returns {string} - ID único (ej. "abc1234def")
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Aplica o quita el tema oscuro/claro y lo persiste en localStorage.
 */
export function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

/**
 * Carga el tema guardado en localStorage al iniciar la app.
 */
export function loadSavedTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    }
}

/**
 * Capitaliza la primera letra de cada palabra en un texto.
 * Ejemplo: "juan pérez" -> "Juan Pérez"
 */
export function capitalizeWords(text) {
    if (!text || typeof text !== 'string') return '';
    return text.toLowerCase().split(/\s+/).map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}
