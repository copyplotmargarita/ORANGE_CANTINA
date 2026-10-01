# Orange Cantina Escolar — Contexto del Proyecto

> Este archivo es la fuente de verdad para cualquier IA o desarrollador que trabaje en este proyecto.
> Léelo completo antes de hacer cualquier cambio. Mantenlo actualizado.

---

## ¿Qué es el sistema?

Aplicación web SaaS multi-tenant para la gestión integral de una **cantina escolar**. Permite:

- Registrar ventas a crédito y al contado por alumno
- Cobrar en múltiples métodos de pago (Bs. y USD)
- Manejar un wallet (saldo a favor) por alumno
- Generar reportes en PDF y compartirlos por WhatsApp
- Consultar y actualizar la tasa BCV diariamente

> 📱 **Diseñada para el celular:** La app se opera principalmente desde un smartphone.
> Cada pantalla, botón y flujo está pensado para ser usable con el pulgar, sin instrucciones.

---

## Stack Técnico

| Capa | Tecnología | Descripción |
|---|---|---|
| Frontend | Vanilla JS (ES Modules) | Sin compiladores, bundlers ni frameworks |
| Arquitectura | Hash Router + Pure DOM Views | Navegación `#hash` con `document.createElement` |
| Backend / BD | Firebase Firestore v10.10.0 (CDN) | NoSQL en tiempo real, aislado por negocio |
| Autenticación | Firebase Auth v10.10.0 (CDN) | Login, registro, recuperación de contraseña |
| Estilos | CSS3 Puro (`style.css`) | Variables CSS, temas claro/oscuro, Mobile-First |
| Teléfonos | intl-tel-input v17.0.8 (CDN) | Formato E.164 para WhatsApp |
| PDF | jsPDF + jspdf-autotable (CDN) | Reportes de cuenta generados en el cliente |
| Íconos | Lucide Icons (SVG via CDN) | Iconografía limpia y ligera |
| Tipografía | Google Fonts — Inter | Fuente principal, mín. 16px en body |
| BCV API | fetch nativo → `ve.dolarapi.com` | Con fallback manual editable por el usuario |
| Control de versiones | Git + GitHub | Ramas `feature/dax-*` |

---

## 📱 Principios de UX y Diseño Mobile-First

> **Regla de oro:** Si no funciona bien con el pulgar en un celular de 6", no está terminado.

### Responsividad
- CSS escrito **base para móvil primero**, luego `@media (min-width: Xpx)` para pantallas mayores
- Breakpoints: móvil `< 480px` | tablet `≥ 768px` | escritorio `≥ 1024px`
- Sidebar → **bottom navigation bar** en móvil
- Tablas → **tarjetas apiladas** en móvil (sin scroll horizontal)
- Modales → 95% del ancho en móvil, con scroll interno
- Inputs y botones: mínimo **44px de alto** (zona táctil cómoda)
- `<meta name="viewport" content="width=device-width, initial-scale=1">`

### Simplicidad Operativa
- **Máximo 2-3 toques** para cualquier acción frecuente (nueva venta, cargar pago)
- **Sin menús anidados** — navegación plana y directa
- **Feedback inmediato** en toda acción → toast de éxito o error
- **Confirmación solo en acciones irreversibles** (ej. eliminar alumno)
- **Buscador siempre visible** al entrar a listas de alumnos y productos
- **Botones de acción principal** siempre visibles, nunca escondidos
- **Estados vacíos amigables** con mensaje y botón para crear el primer registro
- **FAB** (botón `+` flotante) en listas para crear registros nuevos

---

## Estructura de Archivos

```
orange-cantina/
├── run_dev.ps1                # Servidor local Windows — puerto 8088
├── index.html                 # Punto de entrada + viewport + CDNs
├── style.css                  # Estilos globales Mobile-First, temas, componentes
├── js/
│   ├── app.js                 # Hash Router y guardia de autenticación
│   ├── firebase-config.js     # Inicialización Firebase Auth + Firestore
│   ├── utils.js               # Helpers compartidos (ver lista abajo)
│   ├── services/
│   │   ├── auth.service.js    # Login, registro, logout, resetPassword
│   │   ├── bcv.service.js     # API BCV + cache localStorage + historial Firestore
│   │   ├── estudiantes.service.js
│   │   ├── representantes.service.js
│   │   ├── productos.service.js
│   │   ├── ventas.service.js  # POS + lógica FIFO de cobros (runTransaction)
│   │   └── pdf.service.js     # Generación de reportes con jsPDF
│   └── views/
│       ├── login.view.js
│       ├── register.view.js
│       ├── dashboard.view.js  # Shell con bottom nav (móvil) / sidebar (escritorio)
│       ├── estudiantes.view.js
│       ├── productos.view.js
│       ├── pos.view.js        # Punto de venta (carrito en sessionStorage)
│       ├── cuentas.view.js    # Cuentas por alumno/representante + modal de cobro
│       └── reportes.view.js   # PDF + WhatsApp
```

---

## Convenciones de Código

- UI 100% en **español**
- Números: locale `de-DE` → `1.234,56` (punto miles, coma decimales)
- Fechas en UI: **`dd/mm/yyyy`** — usar `formatDateToDDMMYYYY()` de `utils.js`
- Fechas en DB/inputs: ISO `yyyy-mm-dd`
- Montos: almacenados en **USD**, mostrados en Bs. multiplicando por tasa BCV
- Notificaciones: **siempre** via `showNotification(msg, type)` de `utils.js`
- CSS: **Mobile-First** — estilos base para móvil, luego media queries `min-width`
- Zona táctil mínima: todo elemento interactivo ≥ `44px`
- Sin npm, sin bundlers — corre directo en el navegador con ES Modules
- Comentarios 100% en **español**

### Máscara de Entrada de Montos (Estilo ATM)
- El usuario teclea solo dígitos: `101536`
- El sistema empuja de derecha a izquierda: `1.015,36`
- Antes de calcular o guardar → `parseAtmAmount()` convierte a `1015.36`

### Helpers de `utils.js`
| Función | Descripción |
|---|---|
| `applyAtmMask(input)` | Aplica máscara cajero al evento del input |
| `parseAtmAmount(text)` | Convierte texto formateado a número flotante |
| `formatCurrencyDE(val)` | Formatea número a string `de-DE` |
| `formatDateToDDMMYYYY(date)` | Fecha → `dd/mm/yyyy` |
| `showNotification(msg, type)` | Toast de éxito / error / info |
| `bcvToBS(usd, tasa)` | Convierte USD a Bs. usando la tasa activa |

---

## Modelo de Datos Firestore

```
/usuarios/{userId}
  ├── nombre, apellido, telefono, email
  ├── nombreCantina, nombreColegio
  ├── direccion, estado, ciudad
  └── fechaRegistro: timestamp

/negocios/{businessId}/
  │
  ├── bcv_history/{fechaISO}
  │     └── { tasa, origen: "API"|"MANUAL", fechaActualizacion }
  │
  ├── representantes/{repId}
  │     └── { nombre, telefono }
  │
  ├── estudiantes/{estudianteId}
  │     └── { nombre, apellido, grado, seccion,
  │           representanteId, walletSaldoUSD, estadoCuentaUSD }
  │
  ├── productos/{productoId}
  │     └── { nombre, precioUSD, activo }
  │
  ├── ventas/{ventaId}
  │     └── { fechaHora, fechaISO, estudianteId, representanteId,
  │           nombreEstudiante (snapshot), nombreRepresentante (snapshot),
  │           items[], totalUSD, saldoPendienteUSD, tasaBcvUsada,
  │           estado: "CONTADO"|"CREDITO"|"ABONO"|"PAGADO" }
  │
  └── pagos/{pagoId}
        └── { fechaHora, estudianteId,
              lineasPago: [ { metodo, montoUSD, montoBs, referencia } ],
              totalRecibidoUSD, tasaAplicada,
              ventasAfectadas: [ { ventaId, montoAplicadoUSD, estadoResultante } ],
              montoEnviadoAWalletUSD }
```

---

## Métodos de Pago y Reglas del Modal de Cobro

> ⚠️ **Multi-Pago:** Un solo cobro puede combinar múltiples métodos simultáneamente.
> El usuario agrega líneas con `+ Agregar Método`. Cada línea suma al total recibido.
> Los montos en Bs. se convierten a USD usando la tasa BCV del día.

| Método | Moneda | Solicitar Referencia |
|---|---|---|
| Bs. Efectivo | Bolívares | No |
| Transferencia | Bolívares | Sí |
| Pago Móvil | Bolívares | Sí |
| Punto de Venta | Bolívares | No |
| BioPago | Bolívares | No |
| Dólares en Efectivo | Dólares | No |
| Binance | Dólares | Sí |
| PayPal | Dólares | Sí |
| Zelle | Dólares | Sí |
| Zinli | Dólares | Sí |
| Wallet (Saldo a favor) | Dólares | No |

### Lógica FIFO de Distribución de Pagos
1. Ordenar las ventas pendientes del alumno de **más antigua a más reciente**
2. Aplicar el dinero recibido venta por venta hasta agotarlo
3. Si una venta queda **saldada completamente** → estado `PAGADO`
4. Si una venta queda **parcialmente pagada** → estado `ABONO`
5. Si **sobra dinero** después de saldar todo → va al **wallet del alumno**
6. Todo esto se ejecuta con `runTransaction` en Firestore (atómico)

---

## Reglas de Negocio Clave

| Regla | Comportamiento |
|---|---|
| Venta CONTADO | Abre modal multi-pago inmediatamente antes de guardar |
| Venta CRÉDITO | Se guarda directamente, queda pendiente de cobro |
| Eliminar alumno con deuda | **Bloqueado** — el sistema no lo permite |
| Eliminar alumno sin deuda | Borrado en cascada (ventas + pagos), irreversible |
| Editar representante | Actualiza para **todos** los hermanos vinculados |
| Excedente de pago | Va automáticamente al wallet del alumno |
| Grados disponibles | Pre-Kinder, Kinder, 1ro-6to Primaria, 1ro-5to Bachillerato |
| Secciones | Fijas: A, B, C, D |

---

## Flujo Git

```
main                    ← Producción (código estable)
└── feature/dax-*       ← Ramas de desarrollo
```

```bash
# Antes de empezar
git checkout main && git pull origin main
git checkout -b feature/dax-nombre-funcionalidad

# Commits frecuentes
git add -A
git commit -m "modulo: descripcion corta"

# Al terminar → Pull Request
git push origin feature/dax-nombre-funcionalidad
gh pr create --title "Módulo: Descripción" --body "Detalle" --reviewer Dasaev
# REGLA: Nunca hacer merge local a main
```

---

## Cómo Correr Localmente

```powershell
# Windows
.\run_dev.ps1
# Abre http://localhost:8088
```