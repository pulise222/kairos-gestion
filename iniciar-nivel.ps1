# Arranca Nivel (base de datos + sistema) y abre el navegador. Es lo que ejecuta el acceso directo del escritorio.
# La ventana que se abre es el «servidor»: mientras esté abierta, el sistema funciona. Para apagarlo, ciérrala.
# (Cerrarla es seguro: la base de datos se recupera sola y además hay copias de seguridad.)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$api = Join-Path $raiz 'apps\api'
$puerto = 3001
if (Test-Path (Join-Path $api '.env')) {
  $linea = Get-Content (Join-Path $api '.env') | Where-Object { $_ -match '^PORT=' } | Select-Object -First 1
  if ($linea) { $puerto = [int]($linea -replace '^PORT=', '').Trim('"') }
}
$direccion = "http://localhost:$puerto"

# ¿Ya está encendido? Entonces solo se abre el navegador.
try {
  Invoke-WebRequest "$direccion/api/salud" -UseBasicParsing -TimeoutSec 2 | Out-Null
  Start-Process $direccion
  exit 0
} catch { }

Start-Process powershell -WindowStyle Minimized -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = 'Nivel · Servidor (no cierres esta ventana mientras trabajas)'; Set-Location '$api'; node --env-file=.env scripts/produccion.mjs"

# Espera a que responda (la primera vez crea la base y tarda un poco más).
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 2
  try { Invoke-WebRequest "$direccion/api/salud" -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $direccion; exit 0 } catch { }
}
Write-Host 'Nivel no respondió a tiempo. Mira la ventana «Nivel · Servidor» para ver el motivo.' -ForegroundColor Red
Read-Host 'Pulsa Enter para cerrar'
