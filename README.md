# Servicios Kairos · Sistema de ventas e inventario

Sistema **a la medida** para **Servicios Kairos** (insumos de calzado), construido sobre la base [Nivel](https://github.com/pulise222/nivel-gestion-negocio). **Repositorio privado: no compartir.**

Se instala en el portátil de la tienda, funciona **sin internet** y está pensado para que lo use cualquier persona, incluso quien usa el computador por primera vez: letra grande ajustable, pasos guiados en pantalla y **modo claro y oscuro**.

## Lo propio de Kairos
- **Venta por monto:** se escribe la sección y el valor (`12000 + 9000`); no hay que buscar el producto.
- **Productos sin control de inventario** y venta **nunca bloqueada** por falta de stock.
- **Producto al vuelo:** si no existe, se crea desde la misma venta.
- **Cierre del día:** cuadre de caja (base + ventas en efectivo vs. lo contado) con historial.
- **Excel de respaldo diario** y copias automáticas (con segunda carpeta/Drive).
- **Meta diaria opcional** en el Panel; **comentarios** de las vendedoras durante el piloto.
- Identidad propia: logo, paleta «Tinta y carmesí» y barra lateral de cristal (`apps/api/personalizacion`).

## Documentos
- Manual de usuario (PDF): `docs/manual/Manual de uso - Servicios Kairos.pdf`
- Instalación en el portátil: `docs/INSTALACION.md`
- Guía de pruebas: `docs/PRUEBAS_KAIROS.md`
- Ficha del cliente y decisiones: `docs/CLIENTE_KAIROS.md`

## Desarrollo local
`./iniciar-desarrollo.ps1` levanta base de datos, API (3002) y pantalla (5184). Pruebas: `npm test` en `apps/api` y `npx vitest run` en `apps/web`.

---
# Sobre la base (Nivel)

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
1. **Demo pública**: solo la pantalla con datos de ejemplo en memoria, en su propio repositorio: **[nivel-gestion-negocio-demo](https://github.com/pulise222/nivel-gestion-negocio-demo)**. Se genera con `npm run build:demo` en `apps/web`.
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
