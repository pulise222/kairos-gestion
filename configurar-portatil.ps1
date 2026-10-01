# Deja el portátil listo para trabajar todo el día como caja de la tienda (se ejecuta UNA vez, en el PC del cliente):
#   clic derecho → «Ejecutar con PowerShell»
# Qué cambia (solo cuando el portátil está CONECTADO al cargador; con batería no se toca):
#   • No se duerme ni se apaga la pantalla de golpe (la pantalla se apaga a los 30 min; el equipo no se duerme).
#   • Cerrar la tapa no hace nada (así no se corta el sistema si la cierran por descuido).
# Es reversible: Panel de control → Opciones de energía → «Restaurar configuración predeterminada del plan».
# Sobre la batería: los portátiles actuales dejan de cargar al llegar al 100 %, así que dejarlo conectado es seguro.
# Si la marca del equipo ofrece «límite de carga al 80 %» (Lenovo Vantage, ASUS MyASUS, Dell Power Manager…), activarlo alarga la vida de la batería.

$ErrorActionPreference = 'Stop'

Write-Host 'Ajustando energía (con cargador conectado)…' -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0      # nunca suspender con cargador
powercfg /change hibernate-timeout-ac 0    # nunca hibernar con cargador
powercfg /change monitor-timeout-ac 30     # pantalla se apaga a los 30 min sin uso
# Acción al cerrar la tapa con cargador: 0 = no hacer nada
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT

Write-Host '✔ Listo. El portátil no se dormirá mientras esté conectado al cargador.' -ForegroundColor Green
Read-Host 'Pulsa Enter para cerrar'
