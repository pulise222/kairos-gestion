# Instalar Nivel en el PC de un negocio

Nivel se instala en **un solo computador del negocio** (el «servidor»). Desde ahí se usa en el mismo PC, y también desde la tablet o el celular si están en el mismo WiFi. **No necesita internet para funcionar** (solo para instalar, y para enviar el correo semanal si se activa).

## Qué se necesita
- Windows 10 u 11.
- [Node.js](https://nodejs.org) versión **LTS** (20 o superior). Se instala una sola vez, con «Siguiente, siguiente».
- Conexión a internet **solo durante la instalación**.
- Unos 500 MB de espacio libre (más lo que crezca el negocio; una tienda usa muy poco).

## Instalación (una vez)
1. Copia la carpeta del proyecto al PC (por ejemplo a `C:\Nivel`).
2. Clic derecho en **`instalar-nivel.ps1`** → *Ejecutar con PowerShell*.
   - Si Windows no deja ejecutarlo, abre PowerShell en esa carpeta y escribe: `powershell -ExecutionPolicy Bypass -File .\instalar-nivel.ps1`
3. Espera a que termine (instala lo necesario, compila la pantalla, crea el archivo de configuración con **claves aleatorias** y deja un acceso directo **«Nivel»** en el escritorio).

## Primer uso
1. Abre **«Nivel»** desde el escritorio. Se abre una ventana minimizada (el *servidor*: **no la cierres mientras trabajan**) y el navegador en `http://localhost:3001`.
2. La primera vez aparece el **asistente**: crear al dueño, nombre del negocio, color y categorías.
3. Listo. Ya puede crear productos (o importarlos desde Excel) y vender.

## Uso diario
- **Encender:** abrir «Nivel» en el escritorio.
- **Apagar:** cerrar la ventana «Nivel · Servidor». Es seguro: la base de datos se recupera sola y además hay copias de seguridad.
- Para que arranque solo al prender el PC: pon un acceso directo a `iniciar-nivel.ps1` en la carpeta de inicio (`Win + R` → `shell:startup`).

## Otros dispositivos (tablet, celular, otro PC)
1. Averigua la IP del PC servidor: en PowerShell, `ipconfig` → «Dirección IPv4» (por ejemplo `192.168.1.20`).
2. Permite el acceso en el firewall (una sola vez, PowerShell **como administrador**):
   ```powershell
   New-NetFirewallRule -DisplayName "Nivel" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```
3. Desde la tablet o el celular, en el navegador: `http://192.168.1.20:3001`.
4. Recomendado: en el router, reserva esa IP para el PC (así no cambia).

> El sistema usa `http` (sin certificado) porque funciona **dentro de la red del local**. No lo expongas a internet.

## Copias de seguridad (¡lo más importante!)
- El sistema hace **una copia automática cada 24 horas** mientras el PC esté encendido, y guarda las últimas 30 (en `apps\api\datos\copias`).
- Una copia en el mismo disco **no sirve si el disco se daña**. Configura una **segunda carpeta** en otro disco o una USB: en `apps\api\.env` quita el `#` de `COPIAS_EXTRA_DIR` y pon la ruta (por ejemplo `E:/respaldos-nivel`). Cada copia se repite allí.
- *Configuración → Copias de seguridad* permite hacer una copia ahora, **descargarla** y **restaurarla**.
- **Reporte semanal por correo (opcional):** cada 7 días llega un Excel con las ventas y el inventario, y la copia de seguridad adjunta (así hay una copia fuera del PC). Se activa en `apps\api\.env` (secciones `SMTP_*` y `REPORTE_PARA`; con Gmail se usa una «contraseña de aplicación», no la clave normal).
- **Si el PC se daña:** instala Nivel en otro PC y, **sin pasar por el asistente**, copia el archivo `nivel-copia-….zip` (de la USB, del correo o de la segunda carpeta) a `apps\api\datos\copias` del PC nuevo. Restáurala desde *Configuración → Copias de seguridad*. Nota: el asistente de primer arranque crea un dueño nuevo; para poder entrar a *Configuración* de un sistema recién instalado, crea ese dueño temporal y luego restaura (la copia trae al dueño original).
- **Prueba la restauración al menos una vez** (con datos de ejemplo). Una copia que nunca se probó no es una garantía.

## Personalizar para el cliente (logo y colores)
Sin tocar código: copia `appspi\personalizacion.ejemplo` como `appspi\personalizacion`, cambia el logo y los colores de `marca.json` (las instrucciones están en `LEEME.md` dentro de esa carpeta) y reinicia. El nombre del negocio se escribe en el asistente o en *Configuración → Negocio*.

## Instalar como app en el celular o la tablet
Con el sistema abierto en el navegador del celular (`http://IP-DEL-PC:3001`): en **Android (Chrome)** menú ⋮ → *Agregar a la pantalla de inicio*; en **iPhone/iPad (Safari)** botón *Compartir* → *Agregar a inicio*. Queda un ícono «Nivel» que abre el sistema a pantalla completa. (Sigue necesitando estar en el WiFi del negocio: no es una app sin conexión.)

## Actualizar el sistema
Copia la carpeta nueva encima de la anterior **sin borrar `apps\api\.env` ni `apps\api\datos`** (ahí están las claves y todos los datos), y vuelve a ejecutar `instalar-nivel.ps1`. Las mejoras a la base de datos se aplican solas al arrancar (y si algo falla, el sistema **no arranca** para no dañar nada).

## Qué hay dónde
| Ruta | Qué es |
| --- | --- |
| `apps\api\.env` | Configuración y claves. **Privado**: no lo compartas. |
| `apps\api\datos\pg` | La base de datos (todo el negocio). |
| `apps\api\datos\fotos` | Fotos de los productos. |
| `apps\api\datos\copias` | Copias de seguridad. |

## Si algo falla
| Síntoma | Qué hacer |
| --- | --- |
| «Nivel» no abre | Mira la ventana «Nivel · Servidor»: ahí aparece el motivo. Si dice que el puerto está ocupado, cambia `PORT` en `.env`. |
| Dice «No se pudo conectar con el servidor» | La ventana del servidor se cerró. Abre «Nivel» de nuevo. |
| Olvidó la clave del dueño | Hoy se resuelve con una intervención técnica (no hay «olvidé mi contraseña» sin correo). Guarda las claves en un lugar seguro. |
| Las tildes salen mal | No debería pasar (la base es UTF-8). Avísame con una captura. |

## Nota sobre Docker
Esta instalación **no usa Docker**: es más simple para un PC de negocio (sin WSL2 ni virtualización). Docker queda como alternativa si algún día el sistema se instala en un servidor Linux.
