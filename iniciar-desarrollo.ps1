# Arranca todo lo necesario para PROBAR Nivel en tu PC, cada cosa en su propia ventana:
#   1) la base de datos PostgreSQL local   2) la API   3) la pantalla (front)
# Uso: clic derecho → "Ejecutar con PowerShell", o desde una terminal en esta carpeta:  .\iniciar-desarrollo.ps1
# Para detener todo: cierra las tres ventanas.

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$api = Join-Path $raiz 'apps\api'
$web = Join-Path $raiz 'apps\web'

function Abrir($titulo, $carpeta, $comando) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = '$titulo'; Set-Location '$carpeta'; $comando"
}

Write-Host "Iniciando la base de datos..." -ForegroundColor Cyan
Abrir 'Nivel · Base de datos' $api 'npm run db:dev'
Start-Sleep -Seconds 8   # la base debe estar lista antes que la API

Write-Host "Iniciando la API..." -ForegroundColor Cyan
Abrir 'Nivel · API' $api 'npm run start'
Start-Sleep -Seconds 4

Write-Host "Iniciando la pantalla..." -ForegroundColor Cyan
Abrir 'Nivel · Pantalla' $web 'npm run dev -- --port 5183'
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "Listo. Abre en el navegador:  http://localhost:5183" -ForegroundColor Green
Write-Host "Las claves de prueba están en apps\api\.env (variables SEED_*)." -ForegroundColor Yellow
Start-Process 'http://localhost:5183'
