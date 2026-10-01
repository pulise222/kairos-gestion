# Instala Servicios Kairos en este PC (se ejecuta UNA vez, desde la carpeta del proyecto):
#   clic derecho → «Ejecutar con PowerShell»   o   .\instalar-nivel.ps1
# Qué hace:
#   1) revisa que Node.js esté instalado,
#   2) instala las dependencias y compila la pantalla,
#   3) crea el archivo de configuración con claves aleatorias (solo si no existe),
#   4) crea el acceso directo «Servicios Kairos» en el escritorio.
# No toca ningún dato: si ya estaba instalado, solo actualiza el programa (la base de datos se conserva).

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$api = Join-Path $raiz 'apps\api'
$web = Join-Path $raiz 'apps\web'

function Paso($t) { Write-Host "`n▶ $t" -ForegroundColor Cyan }
function Falla($t) { Write-Host "`n✖ $t" -ForegroundColor Red; Read-Host 'Pulsa Enter para cerrar'; exit 1 }

Paso 'Revisando Node.js'
try { $v = (node -v) } catch { Falla 'Falta Node.js. Instálalo desde https://nodejs.org (versión LTS) y vuelve a ejecutar este archivo.' }
$mayor = [int]($v.TrimStart('v').Split('.')[0])
if ($mayor -lt 20) { Falla "Node.js $v es muy viejo. Instala la versión LTS desde https://nodejs.org" }
Write-Host "Node.js $v ✔"

Paso 'Instalando dependencias (necesita internet la primera vez)'
foreach ($c in @($api, $web)) {
  Push-Location $c
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Pop-Location; Falla "Falló «npm install» en $c" }
  Pop-Location
}

Paso 'Compilando la pantalla'
Push-Location $web
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Falla 'Falló la compilación de la pantalla.' }
Pop-Location

Paso 'Configuración'
$env_ = Join-Path $api '.env'
if (Test-Path $env_) {
  Write-Host 'Ya existía apps\api\.env: no se toca (conserva tus claves y tus datos).'
} else {
  # Claves aleatorias de verdad (no «Get-Random», que no es criptográfico).
  function Aleatorio($bytes) {
    $b = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    -join ($b | ForEach-Object { $_.ToString('x2') })
  }
  $claveBase = Aleatorio 16
  $excelDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Kairos\Respaldos').Replace('', '/')
  New-Item -ItemType Directory -Force -Path $excelDir | Out-Null
  $secreto = Aleatorio 32
  @"
# Generado por instalar-nivel.ps1 (instalador de Servicios Kairos). NO compartas este archivo ni lo subas a ningún repositorio.
DATABASE_URL="postgresql://postgres:$claveBase@localhost:54329/kairos"
JWT_SECRET="$secreto"
PORT=3001
DB_DIR="./datos/pg"
UPLOADS_DIR="./datos/fotos"
COPIAS_DIR="./datos/copias"
# Recomendado: una segunda carpeta en OTRO disco o USB donde se repite cada copia de seguridad.
# COPIAS_EXTRA_DIR="E:/respaldos-kairos"   (o la carpeta de Google Drive para escritorio, si la usan)
# Excel de respaldo diario: queda en Documentos\Kairos\Respaldos (visible, se puede abrir sin el sistema).
EXCEL_DIR="$excelDir"
PERSONALIZACION_DIR="./personalizacion"
"@ | Set-Content -Path $env_ -Encoding UTF8
  Write-Host 'Archivo apps\api\.env creado con claves aleatorias ✔'
}

Paso 'Acceso directo en el escritorio'
$destino = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Servicios Kairos.lnk'
$w = New-Object -ComObject WScript.Shell
$a = $w.CreateShortcut($destino)
$a.TargetPath = 'powershell.exe'
$a.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $raiz 'iniciar-nivel.ps1')`""
$a.WorkingDirectory = $raiz
$a.WindowStyle = 7   # minimizada
$a.Description = 'Abre el sistema de Servicios Kairos'
$a.Save()
Write-Host 'Acceso directo «Servicios Kairos» creado en el escritorio ✔'

Write-Host "`n✔ Instalación lista." -ForegroundColor Green
Write-Host 'Abre «Servicios Kairos» desde el escritorio. La primera vez aparece el asistente para crear al dueño y el negocio.'
Write-Host 'Para usarlo desde la tablet o el celular (misma red WiFi) lee docs\INSTALACION.md, sección «Otros dispositivos».'
Read-Host 'Pulsa Enter para cerrar'
