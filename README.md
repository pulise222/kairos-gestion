# Nivel · Control de tienda

Sistema de **ventas, inventario y ganancias** para tiendas y pequeños negocios. Pensado para usarse todos los días y rápido, desde el computador del mostrador, una tablet o el celular, con **modo claro y oscuro**.

Se instala en **un solo PC del negocio** (funciona sin internet, dentro de la red del local) y se puede personalizar con la marca de cada cliente sin tocar código.

> Proyecto de portafolio de Juan Sebastián Pulido Bojaca. Diseño, reglas de negocio y pruebas pensados como un producto real.

## Qué hace
| Módulo | Qué resuelve |
| --- | --- |
| **Venta** | Caja rápida: buscar por nombre, código o lector de barras; carrito; cobro y vueltas; protegida contra doble clic. |
| **Ventas** | Historial con filtros; anular una venta; **devoluciones** de clientes (parciales, producto dañado, reembolso). |
| **Productos** | Ficha completa: foto, código propio o automático, descripción, categoría, proveedor, costo y precio (con historial de precios); **importar desde Excel/CSV**. |
| **Inventario** | Estado del stock, entradas de mercancía, ajustes, **conteo físico masivo** y libro de movimientos. |
| **Proveedores** | Qué pedirle a cada uno y **devoluciones de mercancía** (llegó de más, dañada, vencida). |
| **Panel** | Ventas, ganancia, más vendidos y categorías, **netas de devoluciones**, con filtros de período y comparación. |
| **Configuración** | Negocio, usuarios y roles, categorías, apariencia, **copias de seguridad reales** (y reporte semanal por correo). |

Dos roles: **Dueño** (todo) y **Vendedor** (vende y consulta; no ve costos ni ganancias). Los permisos los aplica el servidor, no solo la pantalla.

## Tres versiones, un solo código
1. **Demo pública**: solo la pantalla con datos de ejemplo en memoria, en su propio repositorio: **[nivel-demo](https://github.com/pulise222/nivel-demo)**. Se genera con `npm run build:demo` en `apps/web`.
2. **Producto genérico**: la versión completa, instalable en cualquier PC con Windows.
3. **Versión del cliente**: la misma, con su logo y paleta mediante la carpeta `personalizacion` (sin tocar código).

## Reglas de negocio que lo hacen confiable
- **Una sola fuente de verdad:** el cálculo vive en el servidor; la pantalla solo muestra.
- **El stock de cada producto es la suma de sus movimientos** (`movimiento_stock`): todo cambio deja rastro y se puede explicar.
- **Dinero en pesos enteros** (nunca decimales flotantes). Precios y costos se **copian** en cada venta: lo ya vendido nunca cambia.
- **Concurrencia:** ventas y devoluciones en transacciones; descuento de stock atómico (`UPDATE … WHERE stock >= n`); dos cajas no pueden vender la última unidad.
- **Idempotencia** (`Idempotency-Key`): un doble clic o un reintento tras un corte de red nunca duplica una venta ni una devolución.
- **Zona horaria del negocio** (America/Bogota) para los días y rangos.
- **Validación en el servidor** (Zod) además de la del formulario. Sin `alert/confirm` del navegador: avisos y diálogos propios.

## Tecnología
- **Front:** React 19, TypeScript, Vite, Tailwind CSS v4, react-hook-form + Zod, Recharts. Dos modos: *demo* (datos en memoria) y *real* (API) detrás de un mismo contrato.
- **Back:** Node + Express 5, Prisma 7 + PostgreSQL 16, JWT, bcrypt, Helmet, límite de intentos de acceso.
- **Pruebas:** Vitest + Supertest contra una base de pruebas real (más de 190 pruebas de la API y 130 del front), con **simulación de una semana de tienda** que compara stock, movimientos y panel contra un cálculo independiente.
- **Copias y reportes:** zip verificado (datos + fotos), restauración transaccional, Excel semanal por correo (ExcelJS + Nodemailer).

## Estructura
```
apps/
  api/   Servidor: prisma/ (esquema y migraciones), src/modules (rutas), src/lib (reglas), scripts/ (seed, ver, producción), test/
  web/   Pantalla: src/pages, src/components, src/data (demo y real), src/lib (reglas puras con pruebas), src/design
docs/    CASOS_DE_PRUEBA.md · INSTALACION.md · MANUAL_USUARIO.md
```

## Probar en desarrollo
Requisitos: Node 20+ (en Windows).
```powershell
.\iniciar-desarrollo.ps1      # abre base de datos, API y pantalla, y el navegador en http://localhost:5183
```
En `apps/api`: `npm run seed` (negocio de ejemplo con 45 días de ventas), `npm run ver` (mira la base), `npm run studio` (Prisma Studio en http://localhost:5555), `npm test`.
La guía para probarlo como lo usaría un negocio está en [`docs/CASOS_DE_PRUEBA.md`](docs/CASOS_DE_PRUEBA.md).

## Instalar en el PC de un negocio
Sin Docker: `instalar-nivel.ps1` y un acceso directo «Nivel». Paso a paso en [`docs/INSTALACION.md`](docs/INSTALACION.md). Manual para quien lo usa: [`docs/MANUAL_USUARIO.md`](docs/MANUAL_USUARIO.md).

## Seguridad
- Sin contraseñas por defecto: el dueño se crea en el asistente de primer arranque.
- Claves aleatorias generadas en cada instalación (`.env` nunca se sube al repositorio).
- Uso previsto en red local por HTTP: **no exponer a internet** sin un proxy con HTTPS.
- Un usuario desactivado pierde el acceso al instante; la personalización valida los colores para no permitir inyección de CSS; las fotos se validan por su contenido real, no por la extensión.

## Qué queda fuera por ahora
Impresión de recibo (el negocio piloto no tiene impresora), clientes y fiado, cierre de caja, gastos. Los módulos de la siguiente versión aparecen como «Próximamente» en *Configuración → Módulos*.
