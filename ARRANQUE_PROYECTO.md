# Control de Tienda · Documento de arranque

> **Nombre provisional** (por definir). Este documento es el punto de partida para desarrollar el proyecto en un chat nuevo.
> Léelo completo antes de proponer nada. Las reglas de trabajo están en `CLAUDE.md`.
> Todo lo **visual y de navegación** (diseño elegido, módulos, flujo de pantallas, permisos y la Fase 0 de aprobación)
> está en **`DISENO_Y_PANTALLAS.md`**: léelo también. Decisiones de diseño ya tomadas: modo claro **H · Porcelana**,
> modo oscuro **E · Obsidiana y oro** (propuesto), fondo generado con patrón de curvas de nivel.

---

## 1. Visión

Un sistema web **para llevar la operación diaria de una tienda o pequeño establecimiento**: registrar ventas, controlar
el stock, conocer la ganancia y ver cómo va el negocio en un panel visual. Reemplaza el cuaderno de ventas en papel.

- **Cliente real (primera instalación):** una tienda que hoy registra las ventas a mano, tiene unas **5 categorías** de productos
  y unos **7 proveedores**, y necesita calcular ganancias y ver su stock de forma visual.
- **Objetivo del autor:** un producto de **portafolio** con tecnologías demandadas por el mercado, que además funcione como
  **servicio real** (instalación en el local del cliente + mantenimiento periódico, por ejemplo cada dos meses).
- **Reutilizable:** un mismo producto que se pueda **instalar para otros establecimientos** (una instalación por cliente) y adaptar
  con una configuración sencilla (nombre, logo, colores, moneda, categorías), sin reescribir código.

### Lo que NO es (para no perder el foco)
- No es facturación electrónica ni contabilidad legal: es **control interno** de ventas e inventario.
- No es una plataforma con muchos clientes en un mismo servidor (multi-inquilino). Es **una instalación por cliente**.
- No es una tienda en línea.

---

## 2. Usuarios y roles

| Rol | Quién es | Qué necesita |
| --- | --- | --- |
| **Dueño (admin)** | El dueño o encargado | Ver el panel, administrar productos, proveedores, precios, usuarios y configuración; revisar reportes y ganancias |
| **Vendedor** | Quien atiende el mostrador | Registrar ventas **rápido**, consultar productos y stock. No ve costos ni ganancias |

La pantalla que el vendedor usa todos los días es la de **registrar venta**: es la más importante del sistema.

---

## 3. Alcance

### MVP (versión 1: lo mínimo para usarlo en el local)
1. Acceso con usuario y contraseña, con los dos roles.
2. Categorías y proveedores (CRUD).
3. Productos (CRUD) con nombre, código, imagen opcional, categoría, proveedor, costo, precio, stock y stock mínimo.
4. **Pantalla de venta** con buscador por nombre o código, resultados con foto, carrito con varios productos, total y vueltas.
5. Descuento automático de stock al vender.
6. Entradas de mercancía (compras a proveedores) que suben el stock.
7. Historial de ventas.
8. **Panel (dashboard)**: ventas, ganancia, productos más vendidos y estado visual del stock.
9. Modo claro y oscuro.
10. Instalación con Docker y **copias de seguridad automáticas**.

### Después del MVP (v2)
Importar productos desde Excel/CSV · imprimir recibo · cierre de caja diario · anular/devolver ventas · reportes exportables ·
lector de código de barras optimizado · gastos del negocio · metas de venta · notificaciones de stock bajo · varios medios de pago.

### Fuera de alcance por ahora
Facturación electrónica · multi-sucursal · tienda en línea · app móvil nativa · contabilidad.

---

## 4. Historias de usuario (prioridad: M = imprescindible, S = importante, C = deseable)

### Acceso y configuración
- **HU-01 (M)** Como usuario, quiero iniciar sesión para acceder al sistema según mi rol.
- **HU-02 (M)** Como dueño, quiero crear y desactivar usuarios (vendedores) para controlar quién usa el sistema.
- **HU-03 (S)** Como dueño, quiero configurar el nombre, el logo, los colores y la moneda del negocio para que el sistema se vea como mío.
- **HU-04 (M)** Como usuario, quiero cambiar entre modo claro y oscuro, y que el sistema recuerde mi elección.

### Catálogo
- **HU-05 (M)** Como dueño, quiero administrar categorías (crear, editar, desactivar).
- **HU-06 (M)** Como dueño, quiero administrar proveedores con nombre y contacto.
- **HU-07 (M)** Como dueño, quiero registrar un producto con nombre, código, categoría, proveedor, costo, precio, stock y stock mínimo.
- **HU-08 (S)** Como dueño, quiero adjuntar una imagen al producto (opcional) para reconocerlo rápido al vender.
- **HU-09 (S)** Como dueño, quiero editar precios y ver el historial de cambios para no perder el rastro.
- **HU-10 (S)** Como dueño, quiero importar mis productos desde un archivo Excel/CSV para no registrar cientos uno por uno.

### Venta (el corazón del sistema)
- **HU-11 (M)** Como vendedor, quiero buscar productos escribiendo parte del **nombre o el código** y ver coincidencias con su **foto** mientras escribo.
  - *Criterios:* resultados en menos de 300 ms con miles de productos; muestra foto (o ícono si no tiene), nombre, precio y stock; funciona con el teclado (flechas y Enter); un lector de código de barras (que “teclea” el código y pulsa Enter) agrega el producto directo.
- **HU-12 (M)** Como vendedor, quiero **agregar varios productos** a una misma venta, cambiar cantidades y quitar productos.
- **HU-13 (M)** Como vendedor, quiero ver el **total** y, al ingresar con cuánto paga el cliente, las **vueltas** (cambio) calculadas.
  - *Criterios:* si paga menos del total no deja confirmar; el dinero se maneja en pesos enteros, sin decimales.
- **HU-14 (M)** Como vendedor, quiero **confirmar la venta** y que el stock baje solo.
  - *Criterios:* si algún producto no tiene stock suficiente, avisa antes de confirmar y no deja el stock en negativo (o lo permite solo con advertencia, a definir con el cliente).
- **HU-15 (S)** Como vendedor, quiero **cancelar** la venta en curso sin guardar nada.
- **HU-16 (S)** Como dueño, quiero **anular una venta** ya registrada (con motivo) y que el stock vuelva.

### Inventario
- **HU-17 (M)** Como dueño, quiero registrar **entradas de mercancía** de un proveedor (productos, cantidades y costo) para aumentar el stock.
- **HU-18 (S)** Como dueño, quiero **ajustar el stock** (conteo físico, pérdidas, daños) dejando un motivo.
- **HU-19 (M)** Como dueño, quiero ver el **estado visual del stock** (verde, amarillo, rojo según el mínimo) y filtrar los que están bajos.
- **HU-20 (C)** Como dueño, quiero ver el **movimiento** de cada producto (entradas, ventas, ajustes).

### Panel y reportes
- **HU-21 (M)** Como dueño, quiero ver en el panel las **ventas** de hoy, la semana y el mes.
- **HU-22 (M)** Como dueño, quiero ver la **ganancia** (venta menos costo) del período.
- **HU-23 (S)** Como dueño, quiero ver los **productos más vendidos** y las **ventas por categoría** en gráficos.
- **HU-24 (S)** Como dueño, quiero ver alertas de **stock bajo** en el panel.
- **HU-25 (C)** Como dueño, quiero **exportar** el historial de ventas a Excel.

### Operación
- **HU-26 (M)** Como dueño, quiero que el sistema haga **copias de seguridad automáticas** y poder **restaurarlas**.
- **HU-27 (S)** Como dueño, quiero **imprimir un recibo** de la venta.
- **HU-28 (C)** Como dueño, quiero hacer el **cierre de caja** del día.

---

## 5. Tecnologías (decisiones tomadas)

| Capa | Elección | Por qué |
| --- | --- | --- |
| Front-end | **React + TypeScript + Vite** | Muy demandado; Vite es rápido y simple |
| Estilos | **Tailwind CSS** + variables CSS para los temas claro/oscuro | Estándar del mercado; los *tokens* de color permiten la personalización por cliente |
| Datos del front | **TanStack Query** (servidor) + **React Hook Form + Zod** (formularios) | Práctica actual y limpia |
| Gráficos | **Recharts** | Sencillo para el panel |
| Back-end | **Node.js + TypeScript + Express** | Lenguaje único en todo el proyecto |
| Base de datos | **PostgreSQL 16** + **Prisma** (ORM y migraciones) | Muy pedido; ideal para practicar SQL y JOINs |
| Validación | **Zod** en el backend (los mismos esquemas ayudan a validar el front) | Seguridad y consistencia |
| Autenticación | **JWT** con contraseña cifrada (bcrypt/argon2) y roles | Lo que ya conoce, mejorado |
| Pruebas | **Vitest** + **Supertest** (API) + **Testing Library** (front); *Playwright* opcional | Calidad demostrable |
| Infraestructura | **Docker Compose**: `db`, `api` y `web` (nginx) | Instalación idéntica en cualquier PC |
| Calidad | ESLint + Prettier + GitHub Actions (CI) | Profesionalismo |
| Demo | Front con **MSW** (API simulada) publicado en **GitHub Pages** | Mismo truco que la demo anterior |

Se deja **NestJS, MongoDB y .NET** para proyectos futuros.

---

## 6. Arquitectura y despliegue

**Instalación en el local del cliente (sin necesidad de internet):**

```
PC del cliente (Windows con Docker Desktop)
 ├─ web  (nginx, sirve el front)        → http://localhost  (o la IP del PC en la red del local)
 ├─ api  (Node + Express)               → solo accesible desde web
 ├─ db   (PostgreSQL, volumen persistente)
 └─ backup (tarea programada: pg_dump → carpeta/USB y, opcional, nube)
```

- Otros dispositivos del local (tablet, celular) pueden usar el sistema entrando a la **IP del PC** por la red WiFi local.
- **Copias de seguridad:** `pg_dump` automático diario (y al cerrar el día), con **rotación** (guardar las últimas N), hacia una carpeta
  configurable (por ejemplo una USB) y, si hay internet, hacia la nube (por ejemplo con `rclone`). Incluir un script de **restauración** y probarlo.
- **Actualizaciones:** `docker compose pull && docker compose up -d` + migraciones automáticas. Se documenta el procedimiento de la visita de mantenimiento.
- **Arranque automático** con el PC y recuperación ante cortes de luz (reinicio de contenedores `restart: unless-stopped`).
- **Seguridad:** sin contraseñas por defecto; el instalador pide crear el usuario dueño; `.env` fuera del repositorio; HTTPS no necesario en red local.

### Estructura propuesta del repositorio (monorepo)
```
control-tienda/
├─ apps/
│  ├─ api/        (Node + Express + Prisma)
│  └─ web/        (React + Vite)
├─ docker/        (Dockerfiles, nginx.conf)
├─ scripts/       (backup.sh, restore.sh, instalar.ps1)
├─ docs/          (manual de usuario, guía de instalación, capturas)
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

---

## 7. Modelo de datos inicial (PostgreSQL)

> **Regla clave:** el dinero se guarda como **entero en pesos** (sin decimales). Fechas con zona horaria.

| Tabla | Campos principales |
| --- | --- |
| `usuario` | id, nombre, usuario, contraseña_hash, rol (`DUENO`/`VENDEDOR`), activo, creado_en |
| `categoria` | id, nombre, color, activa |
| `proveedor` | id, nombre, telefono, correo, notas, activo |
| `producto` | id, nombre, codigo (único), imagen, categoria_id → , proveedor_id → , costo, precio, stock, stock_minimo, activo |
| `venta` | id, numero, usuario_id → , total, pagado, vueltas, medio_pago, estado (`COMPLETADA`/`ANULADA`), creada_en |
| `venta_item` | id, venta_id → , producto_id → , **nombre_producto**, cantidad, **precio_unitario**, **costo_unitario** |
| `compra` | id, proveedor_id → , total, fecha, usuario_id → |
| `compra_item` | id, compra_id → , producto_id → , cantidad, costo_unitario |
| `movimiento_stock` | id, producto_id → , tipo (`ENTRADA`/`VENTA`/`AJUSTE`/`ANULACION`), cantidad, motivo, venta_id?, compra_id?, creado_en |
| `configuracion` | clave, valor (nombre del negocio, logo, moneda, colores, texto del recibo, módulos activos) |

**Por qué `venta_item` guarda copia de nombre, precio y costo:** si mañana cambia el precio o el costo de un producto, las ventas
pasadas no deben cambiar. La **ganancia** se calcula así: `Σ (precio_unitario − costo_unitario) × cantidad`.

**Consultas que practican JOINs:** ventas por categoría (`venta_item → producto → categoria`), productos más vendidos, stock bajo por
proveedor, ganancia por día.

---

## 8. Pantalla de venta (diseño de referencia)

- Disposición en dos zonas: **izquierda, buscador y resultados**; **derecha, carrito, total y cobro**. En tablet/celular se apilan.
- Buscador grande, con foco automático al abrir. Escribir muestra tarjetas con **foto, nombre, precio y stock**; Enter o clic agrega.
- Cada línea del carrito: cantidad con botones **+ / −**, subtotal y quitar.
- Bloque de cobro: **Total** grande, campo **“Paga con”** y **Vueltas** calculadas en tiempo real; atajos de billetes (por ejemplo 10.000, 20.000, 50.000).
- Botones: **Confirmar venta** (destacado) y **Cancelar**. Tras confirmar: mensaje de éxito y pantalla lista para la siguiente venta.
- Pensada para uso rápido: grandes áreas táctiles, teclado completo, sin ventanas que estorben.

---

## 9. Calidad y experiencia

- Interfaz **limpia y profesional**, con sistema de diseño (tokens de color, tipografía, espacios) y **tema claro/oscuro**.
- Responsive (escritorio, tablet, celular) y accesible (contraste, foco visible, etiquetas).
- Estados de carga, vacío y error cuidados; sin `alert/confirm` del navegador.
- Pruebas automáticas de las reglas críticas (cálculo de total y vueltas, descuento de stock, ganancia, anulaciones, permisos).
- README claro, manual de usuario corto y guía de instalación.

---

## 10. Plan por fases (una sección a la vez, con visto bueno antes de seguir)

| Fase | Entregable | Listo cuando… |
| --- | --- | --- |
| **0. Diseño y aprobación** | **Prototipo navegable** (sin backend, claro/oscuro, escritorio/tablet/celular), nombre, logo y fondo generado. Detalle en `DISENO_Y_PANTALLAS.md` (sección 10) | **El autor aprueba el diseño** (no se desarrolla el sistema antes) |
| **0b. Descubrimiento** (en paralelo) | Entrevista al cliente con las preguntas del punto 11 | Se confirma el alcance del MVP |
| **1. Base** | Monorepo, Docker Compose, base de datos, migraciones, login con roles, layout y temas claro/oscuro | Se puede entrar al sistema en Docker |
| **2. Catálogo** | Categorías, proveedores y productos (con imagen) | Se registra todo el catálogo |
| **3. Venta** | Pantalla de venta completa (HU-11 a HU-15) | Se hace una venta de punta a punta |
| **4. Inventario** | Entradas de mercancía, ajustes, estado visual del stock | El stock siempre cuadra |
| **5. Panel** | Dashboard y reportes (HU-21 a HU-24) | Las cifras coinciden con las ventas |
| **6. Operación** | Copias de seguridad, restauración, recibo imprimible, importar Excel | Se restaura un respaldo con éxito |
| **7. Demo y salida** | Demo pública (front simulado), README, manual, instalador | Instalación probada en un PC limpio |
| **8. Piloto** | Instalación en el cliente y ajustes con uso real | El cliente la usa una semana sin problemas |

---

## 11. Preguntas abiertas

**Para el cliente (conviene hacerlas antes de la fase 1):**
1. ¿Cuántos productos manejan? ¿Cuántos tienen código de barras? ¿Tienen lector?
2. ¿Cómo calculan hoy la ganancia? ¿Conocen el costo de cada producto?
3. ¿Cuántas personas venden y desde cuántos dispositivos (PC, tablet, celular)?
4. ¿Necesitan imprimir recibos? ¿Tienen impresora? ¿Necesitan facturar electrónicamente?
5. ¿Se puede vender con stock en cero (venta sin inventario cargado) o debe bloquearse?
6. ¿Aceptan varios medios de pago (efectivo, transferencia)? ¿Fiado/crédito a clientes?
7. ¿Hay productos que se venden por peso o por fracciones (por ejemplo, libras)?
8. ¿Qué PC tienen y qué sistema operativo? ¿Quién haría las copias a la USB?

**Para el autor (decisiones pendientes):**
- Nombre del producto, logo y paleta (ofrecer 3 opciones).
- Modelo de mantenimiento: qué incluye la visita bimestral (revisar copias, actualizar, corregir fallos pequeños), precio y forma de contacto.
- Licencia del repositorio (código abierto o privado) y qué se publica en la demo.

---

## 12. Riesgos y cómo prevenirlos

| Riesgo | Prevención |
| --- | --- |
| Querer hacerlo “configurable para todo” y no terminar | Una instalación por cliente; la personalización se limita a la configuración definida |
| Pérdida de datos por falla del PC | Copias automáticas + prueba de restauración + copia en USB/nube |
| El cliente no adopta el sistema | Pantalla de venta muy rápida, capacitación corta y acompañamiento la primera semana |
| Cargar el catálogo es tedioso | Importación desde Excel/CSV y registro rápido |
| Dinero con errores de redondeo | Pesos enteros y pruebas automáticas |
| Expectativas legales (facturación) | Dejar claro por escrito que es control interno |

---

## 13. Cómo empezar el chat nuevo

1. Abre la carpeta `control-tienda` (aquí están `CLAUDE.md`, este documento y `DISENO_Y_PANTALLAS.md`).
2. Pega el mensaje de `PRIMER_MENSAJE.md`.
3. Se construye primero el **prototipo de diseño** (Fase 0). Con la aprobación del autor se desarrolla el sistema, fase por fase,
   con visto bueno en cada una. La funcionalidad se evalúa después, módulo por módulo.
