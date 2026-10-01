1.Fase 1: Repositorio, Servidor Local (run_dev.ps1) y Utilidades:Servidor local y módulos base.
1.	Configuración de Ejecución: Probar la ejecución con .\run_dev.ps1 en Windows y python3 -m http.server 8088 en macOS.
2.	Archivos Estáticos: Crear index.html, style.css y la estructura modular dentro de js/.
3.	Utilidades Base (utils.js):
o	formatDateToDDMMYYYY(date)
o	formatCurrencyDE(val)
o	applyAtmMask(dígitos): Formatea entradas numéricas de derecha a izquierda (101536 $\rightarrow$ 1.015,36).
o	parseAtmAmount(textoFormat): Convierte el texto formateado a flotante (1015.36).
o	showNotification(msg, type)
2.Fase 2: Hash Router, Autenticación y Layout Base:Router y Autenticación.
1.	Hash Router (app.js): Rutas #login, #pos, #clientes, #pagos, #reportes.
2.	Autenticación: Integración con Firebase Auth.
3.	Layout Base: Header con control de sesión e indicador de tasa BCV.
3.Fase 3: Módulo de Tasa BCV y Cache Local:Integración multimoneda.
1.	Consulta API: Implementar bcv.service.js con soporte para consulta web y almacenamiento local en localStorage.
2.	Historial: Guardar la tasa del día en /negocios/{businessId}/bcv_history/{fechaISO}.
4.Fase 4: Clientes y Monedero Virtual:Clientes y Wallet.
1.	Registro: Clientes con número de teléfono en formato E.164.
2.	Wallet: Mantenimiento de walletSaldoUSD para abonos y saldos a favor.
5.Fase 5: Catálogo de Productos y POS:Punto de Venta.
1.	Programación Semanal: Productos filtrables por días de producción (Lunes a Viernes vs. Sábados).
2.	POS: Carrito interactivo con persistencia en sessionStorage y cálculo automático de totales en USD y Bolívares.
6.Fase 6: Cobranza Dinámica y Transacciones Atómicas:Modal de cobro y FIFO.
1.	Modal de Cobro: Entrada con máscara ATM estilo cajero y asignación de referencias según el medio de pago.
2.	Distribución FIFO: Liquidación atómica en Firestore mediante runTransaction.
7.Fase 7: Emisión de PDF y Notificaciones WhatsApp:Reportes y WhatsApp.
1.	PDFs: Generación automática de comprobantes con jspdf.
2.	WhatsApp API: Enlace directo para envío del resumen de cuenta y recibos a clientes.

