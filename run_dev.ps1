# Orange Cantina Escolar — Servidor de Desarrollo Local
# Ejecutar: .\run_dev.ps1
# Abre http://localhost:8088

$port = 8088
$root = $PSScriptRoot

Write-Host ""
Write-Host "  🟠 Orange Cantina Escolar" -ForegroundColor Yellow
Write-Host "  Servidor local en http://localhost:$port" -ForegroundColor Cyan
Write-Host "  Presiona Ctrl+C para detener" -ForegroundColor DarkGray
Write-Host ""

# Intentar abrir en el navegador
Start-Process "http://localhost:$port"

# Iniciar servidor HTTP con Python
python -m http.server $port --directory $root
