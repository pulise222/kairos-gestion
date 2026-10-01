# Instalar Servicios Kairos en el portátil del negocio

El sistema se instala en **un solo computador** (el portátil de la tienda). Funciona **sin internet**: solo se necesita internet durante la instalación. Todo se guarda en ese equipo, por eso las **copias de seguridad** (más abajo) son lo más importante.

## Qué se necesita
- Windows 10 u 11.
- [Node.js](https://nodejs.org) versión **LTS** (20 o superior). Se instala una sola vez, con «Siguiente, siguiente».
- Internet **solo durante la instalación**.
- Unos 500 MB libres.

## Instalación (una vez)
1. Copia la carpeta del proyecto al portátil, por ejemplo a `C:\Kairos`.
2. Clic derecho en **`instalar-nivel.ps1`** → *Ejecutar con PowerShell*. (Si Windows no lo deja: abre PowerShell en esa carpeta y escribe `powershell -ExecutionPolicy Bypass -File .\instalar-nivel.ps1`.)
   - Instala lo necesario, compila la pantalla, crea el archivo `apps\api\.env` con **claves aleatorias**, crea la carpeta del Excel de respaldo en `Documentos\Kairos\Respaldos` y deja el acceso directo **«Servicios Kairos»** en el escritorio.
3. *(Recomendado)* Ejecuta **`configurar-portatil.ps1`** (clic derecho → Ejecutar con PowerShell): deja el portátil sin dormirse mientras esté conectado y sin apagarse al cerrar la tapa.

> El archivo se llama `instalar-nivel.ps1` por herencia del proyecto base; instala **Servicios Kairos**.

## Primer uso
1. Abre **«Servicios Kairos»** desde el escritorio. Se abre una ventana minimizada (el *servidor*: **no la cierres mientras trabajan**) y el navegador.
2. Aparece el **asistente** de primer arranque: crear el usuario, nombre del negocio y secciones (vienen las siete de Kairos ya marcadas).
3. Entrar, cargar los productos (uno a uno o desde Excel) y vender.
4. Dejar la clave anotada en un lugar seguro. **No se guarda en ningún archivo del proyecto.**

## Uso diario
- **Encender:** abrir «Servicios Kairos» en el escritorio.
- **Apagar:** cerrar la ventana «Servicios Kairos · Servidor». Es seguro.
- Para que abra solo al prender el PC: copia el acceso directo a la carpeta de inicio (`Win + R` → `shell:startup`).

## Copias de seguridad y Excel (¡lo más importante!)
| Qué | Dónde queda | Para qué |
| --- | --- | --- |
| Copia automática (cada 24 h, últimas 30) | `apps\api\datos\copias` | Restaurar todo si algo se daña. |
| **Excel de respaldo** (cada día, últimos 30 días) | `Documentos\Kairos\Respaldos` | Ver ventas, cierres y precios **sin necesitar el sistema**. |
| Segunda copia (opcional pero muy recomendada) | `COPIAS_EXTRA_DIR` en `apps\api\.env` | Que la copia quede **fuera** del PC. |

**Dejar la copia en el Drive del cliente:** instala *Google Drive para escritorio* (inicia sesión con la cuenta del cliente) y en `apps\api\.env` activa
`COPIAS_EXTRA_DIR="G:/Mi unidad/Kairos-respaldos"` (la ruta que muestre Drive). Cada copia se repite allí y Drive la sube sola cuando haya WiFi. Si no hay Drive, sirve una USB: `COPIAS_EXTRA_DIR="E:/respaldos-kairos"`.

**Si el PC se daña:** instalar el sistema en otro PC, copiar el `nivel-copia-….zip` a `apps\api\datos\copias` y restaurarlo desde *Configuración → Copias de seguridad* (el asistente de primer arranque crea un usuario temporal para poder entrar; la copia trae el usuario original). **Probar la restauración una vez** antes de entregar.

## Otros dispositivos (celular, tablet)
1. En el PC, `ipconfig` → «Dirección IPv4» (por ejemplo `192.168.1.20`).
2. Una sola vez, PowerShell **como administrador**:
   ```powershell
   New-NetFirewallRule -DisplayName "Servicios Kairos" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```
3. Desde el celular (mismo WiFi): `http://192.168.1.20:3001`. En el router conviene reservar esa IP.

> Funciona dentro de la red del local con `http`. No exponer a internet.

## Actualizar el sistema
Copia la carpeta nueva encima de la anterior **sin borrar `apps\api\.env` ni `apps\api\datos`** y vuelve a ejecutar `instalar-nivel.ps1`. Las mejoras de la base se aplican solas al arrancar (si algo falla, el sistema **no arranca** para no dañar datos).

## Qué hay dónde
| Ruta | Qué es |
| --- | --- |
| `apps\api\.env` | Configuración y claves. **Privado.** |
| `apps\api\datos\pg` | La base de datos (todo el negocio). |
| `apps\api\datos\copias` | Copias de seguridad. |
| `apps\api\personalizacion` | Logo y colores de Kairos (`marca.json`). |
| `Documentos\Kairos\Respaldos` | Excel diarios de respaldo. |

## Si algo falla
| Síntoma | Qué hacer |
| --- | --- |
| No abre | Mirar la ventana «Servicios Kairos · Servidor»: ahí aparece el motivo. Si dice que el puerto está ocupado, cambiar `PORT` en `.env`. |
| «No se pudo conectar con el servidor» | La ventana del servidor se cerró: abrir «Servicios Kairos» de nuevo. |
| Olvidó la clave | Requiere intervención técnica (no hay correo de recuperación). |
| Aviso de copia en amarillo/rojo | Abrir *Configuración → Copias de seguridad* y ejecutar «Hacer copia ahora»; revisar la segunda carpeta. |
