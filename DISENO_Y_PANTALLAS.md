# Control de Tienda · Diseño, flujo de pantallas y módulos

> Complementa a `ARRANQUE_PROYECTO.md` (visión, historias, tecnología y datos). Aquí está **todo lo visual y de navegación**.
> **Primero se diseña y se aprueba (Fase 0); después se desarrolla el sistema.**

---

## 1. Dirección de diseño

**Sensación buscada:** limpio, premium, ligeramente futurista, intuitivo. Pocos colores, mucho aire, buena tipografía y detalles finos
(el lujo está en la contención, no en los efectos).

### 1.1 Modo claro → **H · Porcelana** (elegido)
| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#F6F2EC` | Fondo de la app (blanco cálido) |
| `--panel` | `#FFFFFF` | Tarjetas y paneles |
| `--line` | `#E6DFD3` | Bordes finos (0,5 a 1 px) |
| `--text` | `#1C1814` | Texto principal |
| `--muted` | `#7C7366` | Texto secundario |
| `--accent` | `#B8502A` | Terracota: botón principal, foco, elemento activo |
| `--on-accent` | `#FFFFFF` | Texto sobre el acento |
| `--tile` | `#F1EBE1` | Fondo de tarjetas de producto |

### 1.2 Modo oscuro → **E · Obsidiana y oro** (propuesto, pendiente de aprobar en la Fase 0)
| Token | Valor |
| --- | --- |
| `--bg` | `#0B0B0D` |
| `--panel` | `#141416` |
| `--line` | `#2A2A2E` |
| `--text` | `#F4F1EA` |
| `--muted` | `#9C978C` |
| `--accent` | `#D4B26A` (dorado champán) |
| `--on-accent` | `#1A1405` |
| `--tile` | `#1B1B1E` |

### 1.3 Colores de estado (iguales en toda la app)
Stock/estado: **bien** `#2E9E6B` · **bajo** `#D99A1E` · **crítico** `#D64545` (en oscuro, versiones un poco más claras).
Dinero que entra en verde, anulaciones en rojo, advertencias en ámbar.

### 1.4 Tipografía
- **Cifras y títulos:** una serifa elegante con buena legibilidad numérica (propuesta: *Fraunces* o *Newsreader*).
- **Interfaz:** una sans moderna (propuesta: *Inter* o *Geist*).
- **IMPORTANTE:** el sistema funciona **sin internet**, así que las fuentes se **instalan dentro del proyecto** (no se cargan de Google Fonts).
- Cifras tabulares (que no “bailan” al cambiar) en totales y tablas.

### 1.5 Forma y movimiento
- Radio base 10 px (tarjetas 12 px). Líneas finas en vez de sombras pesadas. Sombras solo en elementos flotantes.
- Movimiento sutil y rápido (150 a 250 ms): números que cuentan al cambiar el total, destello al agregar al carrito, transición suave de tema.
- Respeta `prefers-reduced-motion` (si el usuario lo pide, sin animaciones).

### 1.4b Firmas de identidad (lo que lo hace único, no genérico)
1. **Anillos de stock** en cada producto (se llenan según el stock, verde/ámbar/rojo).
2. **Total de la venta** como cifra grande en serifa, con animación al sumar.
3. **Buscador global** `Ctrl + K` para ir a cualquier pantalla o producto.
4. **Mini gráficas (sparklines)** dentro de las cifras del panel.
5. **Fondo generado con patrón** (siguiente sección).
6. Logo y marca propios del producto (por definir en la Fase 0).

---

## 2. Fondo creativo y dinámico (generado con código)

Se prefiere **generar un patrón** antes que usar fotografías: sin derechos de autor, muy liviano, funciona sin internet, y toma los
colores del tema o del cliente.

**Propuesta para Porcelana / Obsidiana:** **curvas de nivel** (líneas topográficas muy finas) que se mueven despacio, más un **grano** sutil.
- Claro: líneas terracota al 6 a 10 % de opacidad sobre el fondo cálido.
- Oscuro: líneas doradas al 8 a 12 % sobre negro.
- Capas: color base → patrón SVG → grano (`feTurbulence`) → viñeta suave. Deriva lenta (60 s) y se desactiva con *reduced motion*.

**Dónde se usa (y dónde no):**
| Pantalla | Fondo |
| --- | --- |
| Login y primer arranque | Patrón visible y protagonista |
| Panel (cabecera) y estados vacíos | Patrón suave |
| Navegación lateral | Muy sutil |
| **Pantalla de venta** | **Casi plano** (la velocidad y la legibilidad mandan) |

**Personalización por cliente (Configuración → Apariencia):** elegir entre 3 patrones (curvas de nivel, malla de puntos, ondas), intensidad,
o subir una **foto/logo propio** como fondo del login.

*(Alternativas a evaluar en la Fase 0: malla de degradado animada tipo “aurora”, o cuadrícula geométrica fina.)*

---

## 3. Módulos (6) y activación

| # | Módulo | Contenido |
| --- | --- | --- |
| 1 | **Venta** | Caja: buscar, carrito, cobro, vueltas |
| 2 | **Productos** | Catálogo, categorías, fotos, códigos, costos y precios, importación |
| 3 | **Inventario** | Estado del stock, entradas de mercancía, ajustes, movimientos |
| 4 | **Proveedores** | Directorio y compras a cada proveedor |
| 5 | **Panel** | Dashboard, historial de ventas, ganancias, reportes |
| 6 | **Configuración** | Negocio, usuarios, apariencia, módulos, recibo, copias de seguridad |

**Versión 2 (módulos opcionales):** Caja (cierre del día) · Clientes y fiado · Gastos. Cada módulo se **activa o desactiva** en
Configuración, para adaptar el sistema a cada negocio sin cambiar código.

---

## 4. Estructura de navegación

```
Escritorio                                   Celular / tablet vertical
┌───────────┬──────────────────────────┐     ┌──────────────────────────┐
│ Logo      │ Barra superior           │     │ Barra superior           │
│           │ [Ctrl+K buscar] ☾ ● 👤   │     ├──────────────────────────┤
│ Panel     ├──────────────────────────┤     │                          │
│ Venta     │                          │     │      Contenido           │
│ Productos │       Contenido          │     │                          │
│ Inventario│                          │     ├──────────────────────────┤
│ Proveed.  │                          │     │ Panel Venta Prod. Inv. ⋯ │
│ Config.   │                          │     └──────────────────────────┘
│ ───────   │                          │
│ Estado    │                          │
│ copia ✔   │                          │
└───────────┴──────────────────────────┘
```
- La barra superior muestra: buscador global, cambio de tema, **estado de las copias de seguridad** (punto verde/ámbar/rojo) y el menú de usuario.
- El **Vendedor** ve solo: Venta, Productos (sin costos), Inventario (solo consulta) y su perfil.
- En la pantalla de venta, el menú puede **colapsarse** para dar más espacio.

---

## 5. Mapa de pantallas

```
Primer arranque (una sola vez)  →  Login  →  [según rol]
                                              ├─ Dueño → Panel
                                              └─ Vendedor → Venta
Panel ─┬─ Historial de ventas ─ Detalle de venta (anular)
       └─ Reportes (ventas por día, por categoría, ganancia, más vendidos)
Venta ─┬─ Cobro (modal) ─ Venta registrada (éxito + nueva venta)
       └─ Venta en espera (v2)
Productos ─┬─ Lista (tarjetas/tabla) ─ Crear/Editar (panel lateral) ─ Detalle (movimientos)
           ├─ Categorías
           └─ Importar desde Excel (asistente)
Inventario ─┬─ Estado del stock (anillos y filtros)
            ├─ Entrada de mercancía
            ├─ Ajuste de stock
            └─ Movimientos
Proveedores ─ Lista ─ Detalle (productos y compras) ─ Crear/Editar
Configuración ─┬─ Negocio  ─┬─ Usuarios  ─┬─ Apariencia (tema y fondo)
               ├─ Módulos   ├─ Recibo    └─ Copias de seguridad (ahora / restaurar)
Perfil ─ Cambiar contraseña
Globales: 404 · sin permiso · error de servidor · sin conexión con la base de datos · carga (esqueletos) · estados vacíos
```

---

## 6. Detalle de las pantallas clave

### 6.1 Primer arranque (asistente)
Paso 1 Crear el usuario dueño (nombre, usuario, contraseña) · Paso 2 Datos del negocio (nombre, logo, moneda) · Paso 3 Categorías iniciales
(sugeridas, editables) · Paso 4 Elegir tema y fondo. Al terminar entra al Panel. Sin contraseñas por defecto.

### 6.2 Login
Fondo con el patrón, tarjeta limpia con logo del negocio, usuario y contraseña, mostrar/ocultar contraseña, mensaje de error claro,
selector de tema.

### 6.3 Venta (la más importante)
```
┌───────────────────────────────────────┬──────────────────────────┐
│ 🔍 Buscar por nombre o código…        │ Venta #0127        Caja 1│
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐           │ ──────────────────────── │
│ │foto│ │foto│ │foto│ │foto│  ◔ ◑ ●    │ Gaseosa 1.5 L  − 2 +  $9.000│
│ │Gas.│ │Gal.│ │Gel │ │…   │ (anillos) │ Galletas       − 1 +  $2.800│
│ └────┘ └────┘ └────┘ └────┘           │                          │
│ Resultados mientras escribes          │ Total          $11.800   │
│ Categorías rápidas: [Bebidas][Aseo]…  │ Paga con  [ 20.000 ]     │
│                                       │ Vueltas         $8.200   │
│                                       │ [ Confirmar venta ]      │
│                                       │ Cancelar                 │
└───────────────────────────────────────┴──────────────────────────┘
```
- Foco automático en el buscador; `Enter` agrega el primero (o el código exacto escaneado); flechas para moverse; `F2` cobrar; `Esc` limpiar.
- Producto sin stock: se muestra en gris con aviso; el comportamiento (bloquear o advertir) es configurable.
- Atajos de billetes (10.000, 20.000, 50.000, 100.000) y botón “Exacto”.
- Éxito: confirmación breve, opción de **imprimir recibo** y vuelta inmediata a una venta nueva.
- Celular: el carrito pasa a una hoja inferior deslizable con el total siempre visible.

### 6.4 Panel
- Fila de **tarjetas con cifras y mini gráfica**: ventas de hoy, ganancia de hoy, tickets, ticket promedio (con comparación contra ayer).
- Gráfica de ventas (7 / 30 días) · Más vendidos · Ventas por categoría · **Alertas de stock bajo** (con botón para registrar entrada) · Últimas ventas.
- El Dueño ve costos y ganancia; el Vendedor no accede a esta pantalla.

### 6.5 Productos
- Alternar **tarjetas con foto** / **tabla**. Filtros: categoría, proveedor, estado de stock. Búsqueda por nombre o código.
- Crear/editar en **panel lateral**: nombre, código (con botón de generar), categoría, proveedor, costo, precio, margen calculado,
  stock inicial, stock mínimo, imagen (arrastrar y soltar; opcional) y activo/inactivo.
- **Importar desde Excel/CSV**: descarga de plantilla, vista previa con errores marcados, confirmación.

### 6.6 Inventario
- Vista de **estado del stock** con anillos/barras de color y filtros (todo / bajo / agotado).
- **Entrada de mercancía**: elegir proveedor, agregar productos con cantidad y costo, total de la compra; sube el stock y actualiza el costo.
- **Ajuste de stock**: conteo físico, pérdida o daño, con motivo obligatorio. **Movimientos**: historial por producto.

### 6.7 Configuración
Negocio · Usuarios (crear, desactivar, restablecer contraseña) · Apariencia (tema, patrón, intensidad, logo/fondo) · Módulos (activar/desactivar) ·
Recibo (encabezado, pie, ancho del papel) · **Copias de seguridad** (última copia, estado, “Hacer copia ahora”, lista, restaurar con confirmación).

---

## 7. Permisos por rol

| Acción | Dueño | Vendedor |
| --- | :-: | :-: |
| Registrar ventas | ✔ | ✔ |
| Ver productos y stock | ✔ | ✔ (sin costos) |
| Crear/editar productos y precios | ✔ | ✖ |
| Entradas y ajustes de inventario | ✔ | ✖ |
| Proveedores | ✔ | ✖ |
| Anular ventas | ✔ | ✖ |
| Panel, ganancias y reportes | ✔ | ✖ |
| Usuarios, configuración y copias | ✔ | ✖ |

---

## 8. Recorridos (flujos de usuario)

**Vendedor, día normal:** abre el sistema → Login → *Venta* → escribe “ga” → ve resultados con foto → agrega Gaseosa x2 y Galletas →
escribe con cuánto paga → ve las vueltas → *Confirmar* → recibo opcional → nueva venta.

**Dueño, al cierre:** Login → *Panel* → revisa ventas y ganancia del día → ve la alerta “3 productos con stock bajo” → *Inventario* →
registra la entrada de mercancía del proveedor → vuelve al Panel → verifica el estado de la copia de seguridad.

**Primera instalación:** primer arranque (asistente) → crea categorías → *Importar productos* desde Excel → revisa stock → crea el usuario del vendedor →
prueba una venta → copia de seguridad de prueba y restauración.

---

## 9. Componentes de la interfaz (para construir un sistema de diseño)

Botones (primario, secundario, fantasma, peligro) · campos de texto, número, moneda y búsqueda · selector y combo con búsqueda ·
tarjeta de producto con anillo de stock · fila de carrito con cantidad · tarjetas de cifra con mini gráfica · tabla con filtros y paginación ·
panel lateral (drawer) · diálogo de confirmación · avisos (toast) · etiquetas de estado · esqueletos de carga · estados vacíos con ilustración sencilla ·
pestañas · conmutador de tema · menú de usuario · buscador global (paleta de comandos).

---

## 10. Fase 0: aprobación del diseño (antes de desarrollar el sistema)

**Entregable:** un **prototipo navegable** (React + TypeScript, con datos de ejemplo y **sin backend**) que muestre, en **claro y oscuro** y en
**escritorio, tablet y celular**: Login, Primer arranque, Panel, **Venta (interactiva de punta a punta)**, Productos (lista y formulario),
Inventario (estado y entrada), Configuración (apariencia con el fondo generado).

**Proceso:**
1. Proponer 3 opciones de **nombre y logo** y 2 o 3 variantes del **fondo generado** (con vista real).
2. Construir el prototipo con el sistema de diseño (tokens de color, tipografía, componentes).
3. El autor lo evalúa y pide ajustes. Se repite hasta la **aprobación**.
4. Con la aprobación, el prototipo se convierte en la **base del front real** y también en la **demo pública** (GitHub Pages).
5. Recién entonces se desarrolla el resto (Fases 1 a 8 de `ARRANQUE_PROYECTO.md`); la funcionalidad se evalúa después, módulo por módulo.
