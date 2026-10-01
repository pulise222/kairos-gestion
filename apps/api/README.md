# API de Nivel · Control de tienda

Node.js + Express + TypeScript · Prisma 7 · PostgreSQL 16 · Zod · JWT · Vitest + Supertest.

## Cómo levantarla (desarrollo)

```bash
cp .env.example .env        # y cambia JWT_SECRET y la clave de DATABASE_URL
npm install
npm run db:dev              # PostgreSQL local (sin Docker). Déjalo abierto en otra terminal.
npm run prisma -- migrate deploy
npm run dev                 # API en http://localhost:3001/api
npm test                    # pruebas contra una base real (nivel_test)
```

## Reglas que el backend garantiza (única fuente de verdad)

- **Dinero en pesos enteros**; nunca decimales.
- El **precio y el costo salen de la base de datos**, nunca del cliente.
- Una venta es **una transacción**: se guarda completa (venta, ítems, stock, movimientos) o no se guarda nada.
- El descuento de stock es **atómico**: con ventas simultáneas nunca se vende dos veces la misma unidad.
- `venta_item` **copia nombre, precio y costo**: las ventas pasadas no cambian si luego cambian los precios.
- Todo cambio de stock deja un **movimiento**; el stock siempre es la suma de sus movimientos.
- El stock **no se edita a mano** en la ficha del producto: solo cambia con ventas, compras y ajustes.
- La base de datos tiene restricciones `CHECK` como última defensa (precios ≥ 0, venta que cuadra, etc.).
- El **vendedor nunca recibe costos ni ganancias**. Los roles se validan en el servidor.
- Un usuario desactivado pierde el acceso **al instante** (no a las 12 h del token).

## Endpoints

| Método y ruta | Quién | Para qué |
| --- | --- | --- |
| `GET /api/salud` | público | Estado de la API y la base (lo usará Docker) |
| `GET /api/setup/estado`, `POST /api/setup` | público, **una sola vez** | Primer arranque: crea el dueño |
| `POST /api/auth/login`, `GET /api/auth/yo`, `PATCH /api/auth/contrasena` | todos | Sesión |
| `GET/POST/PATCH /api/usuarios`, `POST /api/usuarios/:id/restablecer-contrasena` | dueño | Usuarios (HU-02) |
| `GET/PUT /api/configuracion` | leer: todos · cambiar: dueño | Ajustes del negocio |
| `GET/POST/PATCH /api/categorias` | leer: todos · escribir: dueño | HU-05 |
| `GET/POST/PATCH /api/proveedores` | dueño | HU-06 |
| `GET /api/productos` (`q`, `categoriaId`, `proveedorId`, `estado`, paginación), `GET /api/productos/codigo/:codigo` | todos (sin costo para el vendedor) | HU-11, lector de barras |
| `POST/PATCH /api/productos`, `GET /api/productos/:id/historial-precios`, `.../movimientos` | dueño | HU-07, HU-09 |
| `POST /api/ventas`, `GET /api/ventas`, `GET /api/ventas/:id` | todos (el vendedor solo ve las suyas) | HU-12 a HU-14 |
| `POST /api/ventas/:id/anular` | dueño | HU-16 |
| `POST/GET /api/compras` | dueño | HU-17 |
| `POST /api/inventario/ajustes`, `GET /api/inventario/movimientos` | dueño | HU-18, HU-20 |
| `GET /api/inventario/resumen` | todos | HU-19 |
| `GET /api/panel/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (y opcional `compararDesde`/`compararHasta`) | dueño | HU-21 a HU-24, con filtro por período |

Los errores siempre tienen la forma `{ "error": { "codigo": "STOCK_INSUFICIENTE", "mensaje": "...", "detalles": {...} } }`.

## Estructura

```
prisma/schema.prisma   modelo de datos (11 tablas)      prisma/migrations/   historial de cambios de la base
src/app.ts             arma Express (seguridad, rutas)  src/server.ts        arranque
src/modules/           un archivo por área: auth, usuarios, catalogo, ventas, inventario, panel, configuracion
src/middleware/        autenticación/roles y manejo de errores
test/                  pruebas automáticas (base real)
```

## Panel por período

`GET /api/panel/resumen` sin parámetros devuelve **hoy** comparado con **ayer**. Con `desde` y `hasta` (días completos,
ambos incluidos, máximo 366) devuelve ese rango; si no se indica comparación, se usa el tramo de igual duración
inmediatamente anterior (7 días contra los 7 de antes). El front puede pedir otra comparación con
`compararDesde`/`compararHasta` (por ejemplo, «este mes» contra el mismo tramo del mes pasado).

Los días se cuentan en la **zona horaria del negocio** (`America/Bogota`), no en UTC: una venta a las 11:59 p. m. es del
día, y la de las 12:00 a. m. es del siguiente. La respuesta trae `periodo`, `comparacion`, `serie` (todos los días, con 0 en
los sin ventas), `masVendidos`, `porCategoria`, `ultimasVentas` (dentro del rango) y `stockBajo` (estado actual, no
depende del rango).
