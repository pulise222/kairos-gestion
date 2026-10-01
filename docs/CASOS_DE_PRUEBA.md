# Casos de prueba de Nivel · para probar el sistema como lo usaría el negocio

Cada caso dice **qué hacer**, **qué debes ver en pantalla** y **cómo comprobar en la base de datos** que quedó bien guardado.
Marca ☐ → ✔ a medida que pruebas. Si algo no sale como dice, anótalo: eso es un hallazgo para corregir.

---

## 0. Antes de empezar

### Arrancar el sistema
En la carpeta del proyecto ejecuta (clic derecho → *Ejecutar con PowerShell*, o en una terminal):

```powershell
.\iniciar-desarrollo.ps1
```

Abre tres ventanas (base de datos, API y pantalla) y el navegador en **http://localhost:5183**. Para detener todo, cierra las tres ventanas.

### Usuarios de prueba
Las claves están en el archivo `apps/api/.env`, en las variables `SEED_*` (nunca se suben a ningún repositorio):

| Quién | Usuario (variable) | Clave (variable) | Rol |
| --- | --- | --- | --- |
| Dueño | `SEED_DUENO_USUARIO` (juan) | `SEED_DUENO_CLAVE` | Ve y hace todo |
| Vendedora | `SEED_VENDEDOR_USUARIO` (maria) | `SEED_VENDEDOR_CLAVE` | Vende y consulta; no ve costos ni ganancias |

### Empezar de cero cuando quieras
Desde `apps/api`:

| Comando | Qué hace |
| --- | --- |
| `npm run seed` | Borra todo y carga un negocio de ejemplo: 17 productos, 6 proveedores, 2 usuarios y 45 días de ventas |
| `npm run db:vaciar` | Deja la base vacía, para probar el asistente de **primer arranque** |

### Ver lo que pasa en la base de datos
Desde `apps/api` (solo **lee**, no cambia nada):

| Comando | Muestra |
| --- | --- |
| `npm run ver` | Resumen general y las ventas de hoy |
| `npm run ver -- ventas 5` | Las últimas 5 ventas, con sus productos |
| `npm run ver -- stock` | Cada producto con su stock y estado (lo más urgente primero) |
| `npm run ver -- movimientos 10` | Los últimos 10 movimientos de stock (+ sube, − baja) |
| `npm run ver -- devoluciones 5` | Las últimas devoluciones de clientes y a proveedores |
| `npm run ver -- usuarios` | Usuarios y si están activos |
| `npm run ver -- coherencia` | **Revisa que todo cuadre** (ver abajo) |

**Interfaz gráfica sin instalar nada:** desde `apps/api` ejecuta `npm run studio` y abre **http://localhost:5555** (Prisma Studio). Úsala para **mirar** las tablas; no edites datos a mano ahí (te saltas las reglas del sistema y el stock dejaría de cuadrar con sus movimientos).

Si prefieres otra herramienta gráfica (DBeaver, pgAdmin…), conéctate a PostgreSQL con: host `localhost`, puerto `54329`, base `nivel`, usuario `postgres` y la clave que está en `DATABASE_URL` dentro de `apps/api/.env`.

### Las tres reglas de oro (si alguna falla, es un error grave)
1. **El stock de cada producto es la suma de sus movimientos.** Todo cambio de stock deja un movimiento.
2. **El total de una venta es la suma de sus líneas, y las vueltas son exactamente lo pagado menos el total.**
3. **Una venta ya hecha nunca cambia**, aunque luego cambie el precio o el nombre del producto.

Después de cualquier prueba, corre `npm run ver -- coherencia`: debe terminar con **«Todo cuadra.»**

---

## A. Acceso y permisos

### A1 · Entrar como dueño ☐
- **Haz:** abre la página, escribe usuario y clave del dueño y pulsa *Entrar*.
- **Ves:** el **Panel**, saludo «Hola, Juan», y el menú con Panel, Venta, Ventas, Productos, Inventario, Proveedores y Configuración.

### A2 · Clave incorrecta ☐
- **Haz:** usuario correcto, clave equivocada.
- **Ves:** «Usuario o contraseña incorrectos» y la clave se borra. **No dice** cuál de los dos estaba mal (a propósito).
- **Prueba también:** un usuario que no existe → el mismo mensaje exacto.

### A3 · Demasiados intentos ☐
- **Haz:** falla la clave **10 veces** seguidas.
- **Ves:** «Demasiados intentos. Espera unos minutos». Un acceso correcto no cuenta como intento.

### A4 · Entrar como vendedora ☐
- **Haz:** cierra sesión (ícono de salida) y entra como María.
- **Ves:** cae directo en **Venta**. El menú solo trae **Venta, Ventas, Productos e Inventario**.
- **Comprueba:** en Productos **no hay** botones «Nuevo producto» ni «Importar», **no aparece** el costo ni el margen, y al tocar un producto no se abre la ficha. En Inventario solo está «Estado del stock» y no hay botones de Entrada ni Ajustar.

### A5 · La vendedora intenta entrar a lo del dueño ☐
- **Haz:** con la sesión de María, escribe en la barra de direcciones `…#/panel` o `…#/configuracion`.
- **Ves:** te devuelve a Venta.

### A6 · Desactivar a alguien con la sesión abierta ☐
- **Haz:** abre dos ventanas (una como dueño, otra —de incógnito— como María). Como dueño ve a *Configuración → Usuarios* y desactiva a María. En la ventana de María abre **Ventas** (o intenta confirmar una venta): son acciones que consultan al servidor.
- **Ves (en María):** «Tu sesión terminó. Inicia sesión de nuevo.» y vuelve al acceso. **No espera a que venza la sesión.**
- **Base de datos:** `npm run ver -- usuarios` → María figura con `activo = false`. Vuelve a activarla.

---

## B. Vender (lo más importante)

> Antes de empezar: anota el stock de los productos con `npm run ver -- stock`.

### B1 · Una venta normal en efectivo ☐
- **Haz:** en **Venta**, escribe `101` y pulsa Enter (agrega la Gaseosa). Escribe `jabon` y Enter (agrega el Jabón si hay stock). Abre el carrito, pulsa un billete (p. ej. 20.000) y **Confirmar venta**.
- **Ves:** el total en cifra grande, las **vueltas calculadas**, y al confirmar el diálogo «Venta registrada» con el **número de la venta**, el total, con cuánto pagó y las vueltas.
- **Base de datos:** `npm run ver -- ventas 1` → la venta con su total, pagado y vueltas correctos. `npm run ver -- movimientos 5` → un movimiento `VENTA` por cada producto, con cantidad negativa y «quedó en» igual al stock nuevo. `npm run ver -- stock` → el stock de cada producto bajó exactamente lo vendido.

### B2 · Buscar de varias formas ☐
- **Haz:** en el buscador de Venta prueba: `gas` (parte del nombre), `JABÓN` y `jabon` (con y sin tilde), `101` (número), `7701001000008` (código de barras completo), `0008` (el final de un código).
- **Ves:** cada búsqueda trae el producto correcto. Con `101`, el producto 101 sale **primero**. Con `10` salen 101, 102, 103 y 104 en orden.

### B3 · No dejar confirmar pagando de menos ☐
- **Haz:** arma una venta de $12.900 y escribe en «Paga con» una cifra menor.
- **Ves:** el campo «Vueltas» pasa a **«Falta $…» en rojo** y el botón *Confirmar venta* queda desactivado.

### B4 · Pedir más de lo que hay ☐
- **Haz:** agrega un producto con poco stock (la Gaseosa tiene 3) y sube la cantidad con **+** más allá del stock.
- **Ves:** aviso «Solo hay 3 unidades de "Gaseosa 1.5 L"» y no deja pasar de ahí.

### B5 · Producto agotado ☐
- **Haz:** busca el Jabón de baño (stock 0) y tócalo.
- **Ves:** la tarjeta sale en gris con la etiqueta **Agotado**, y el aviso «"Jabón de baño" está agotado».

### B6 · Doble clic no duplica la venta ☐
- **Haz:** arma una venta y pulsa *Confirmar venta* **dos o tres veces muy rápido**.
- **Ves:** una sola venta registrada.
- **Base de datos:** `npm run ver -- ventas 3` → hay **una** venta nueva, no dos. El stock bajó **una sola vez**.

### B7 · Dos cajas venden la última unidad ☐
- **Haz:** abre dos ventanas con sesión (dos «cajas»). En ambas agrega la **última** unidad de un producto. Confirma en la primera, luego en la segunda.
- **Ves (segunda):** «No hay stock suficiente de "…"», el carrito se **conserva** y el producto pasa a *Agotado*. Nunca se vende dos veces la misma unidad.
- **Base de datos:** ese producto con stock `0`, **no negativo**.

### B8 · Cancelar una venta en curso ☐
- **Haz:** arma una venta y pulsa *Cancelar venta* → *Sí, cancelar*.
- **Ves:** el carrito se vacía. **Base de datos:** no se creó ninguna venta ni cambió el stock.

### B9 · Vender con el stock en cero (si el negocio lo permite) ☐
- **Haz:** *Configuración → Negocio → Reglas de venta*, activa «Permitir vender con el stock en cero». Vende el Jabón de baño (stock 0).
- **Ves:** la venta pasa. **Base de datos:** `npm run ver -- stock` → el Jabón queda en **−1**; `npm run ver -- coherencia` lo avisa aparte (es normal solo con esa regla activa). **Vuelve a desactivar la regla.**

### B10 · Quién vendió ☐
- **Haz:** haz una venta como María y otra como el dueño.
- **Base de datos:** `npm run ver -- ventas 2` → la columna *vendedor* muestra a cada quien.

---

## C. Historial de ventas y anulaciones

### C1 · Ver y consultar una venta ☐
- **Haz:** menú **Ventas** → elige *Hoy* (o *7 días*) → toca una venta.
- **Ves:** la lista con número, hora, vendedor, productos y total. En el detalle: cada línea con su precio, total, con cuánto pagó, vueltas y (solo el dueño) la **ganancia** de esa venta.
- **Prueba:** los filtros *Ayer*, *30 días* y *Personalizado*; y los botones *Completadas* / *Anuladas*.

### C2 · Anular una venta por error ☐
- **Haz:** abre una venta → **Anular esta venta**. Intenta anular **sin motivo**: el botón está desactivado. Escribe un motivo y confirma.
- **Ves:** «Venta #… anulada. El stock volvió.» y la venta queda marcada **Anulada** (tachada).
- **Base de datos:** `npm run ver -- ventas 5` → estado `ANULADA`. `npm run ver -- movimientos 5` → un movimiento `ANULACION` por producto, con cantidad positiva, y el stock volvió exactamente. El motivo y quién la anuló quedan guardados.

### C3 · No se puede anular dos veces ☐
- **Haz:** abre la venta que ya anulaste.
- **Ves:** ya no aparece el botón *Anular*, y se lee «Venta anulada. Motivo: …».

### C4 · La vendedora no anula ☐
- **Haz:** como María abre una venta propia.
- **Ves:** ve el detalle, **sin ganancia y sin botón de anular**. Y solo ve **sus** ventas (no las de otros).

### C5 · Las anuladas no cuentan en el Panel ☐
- **Haz:** anota las ventas de *Hoy* en el Panel, anula una venta de hoy y recarga el Panel.
- **Ves:** el total baja en lo que valía esa venta.

---

## D. Productos

### D1 · Crear un producto ☐
- **Haz:** *Productos → Nuevo producto*. Pulsa *Crear* con todo vacío (verás los errores en español). Luego escribe nombre, elige categoría y proveedor, costo `3800`, precio `5500`, stock inicial `24`, mínimo `6`. **Deja el código vacío.**
- **Ves:** mientras escribes, el **margen** en vivo («Ganas $1.700 por unidad · margen 31 %»). Al crear, el aviso y el producto en la lista **con un código automático** (0001, 0002… el siguiente libre).
- **Base de datos:** `npm run ver -- stock` → está con stock 24. `npm run ver -- movimientos 3` → un movimiento `AJUSTE` «Stock inicial» de +24.

### D2 · Código propio y código repetido ☐
- **Haz:** crea un producto «Agua 600 ml» con código `apeq1` (a ti te sirve para reconocerlo). Luego crea otro con código `APEQ1` (mayúsculas).
- **Ves:** el primero se crea con el código que escribiste. El segundo se rechaza: «Ya existe un producto con ese código» (para el sistema `apeq1` y `APEQ1` son el mismo).
- **Prueba también:** un código con espacios (`AGUA 600`) → «Solo letras, números, punto y guion (sin espacios)».

### D2b · Descripción y búsqueda ☐
- **Haz:** al producto anterior ponle la descripción «Botella plástica de 600 ml sin gas». Ve a **Venta** y busca `sin gas`, y luego `apeq1`.
- **Ves:** lo encuentra por la descripción y por el código (sin importar mayúsculas).

### D2c · Foto del producto ☐
- **Haz:** edita un producto → *Elegir foto* → escoge una foto de tu PC o celular (la más grande que tengas). Guarda.
- **Ves:** la foto aparece en tarjetas, tabla, Venta e Inventario. La reducimos sola: una foto de varios MB queda en unos pocos KB.
- **Prueba también:** *Quitar* la foto y guardar → vuelve el ícono de la categoría. Intenta subir un PDF o un archivo que no es imagen → «Usa una foto PNG, JPG o WebP».
- **Base de datos:** en la tabla `producto`, la columna `imagen` tiene una ruta `/uploads/…`; al cambiar o quitar la foto, el archivo viejo se borra de la carpeta `apps/api/uploads`.

### D2d · Modificar toda la información de un producto ☐
- **Haz:** edita un producto y cambia nombre, código, descripción, categoría, proveedor, costo, precio, stock mínimo y la foto, todo en un solo guardado.
- **Ves:** todo se actualiza en la lista. El **stock** no cambia (solo cambia con ventas, entradas, ajustes y conteos).
- **Base de datos:** `producto` con los datos nuevos; `historial_precio` con una fila nueva si cambiaron costo o precio (Prisma Studio → `historial_precio`).

### D2e · Categoría nueva sin salir del formulario ☐
- **Haz:** en *Nuevo producto*, bajo *Categoría* pulsa **+ Nueva categoría**, escribe «Papelería» y *Crear*.
- **Ves:** queda elegida de inmediato. Si escribes «papelería» (otra vez, en minúsculas) → «Ya existe una categoría con ese nombre».

### D3 · Vender a pérdida ☐
- **Haz:** en un producto pon un precio **menor** al costo.
- **Ves:** el aviso rojo «Vendes $… por debajo del costo en cada unidad». Te deja guardar (es solo una advertencia).

### D4 · Cambiar el precio no cambia las ventas viejas ☐
- **Haz:** vende un producto. Luego edítalo y sube su precio. Abre en **Ventas** la venta que hiciste antes.
- **Ves:** la venta vieja conserva **el precio de ese momento**.
- **Base de datos:** `npm run ver -- ventas 1` → el total sigue igual. (Y el cambio queda en el historial de precios.)

### D5 · Desactivar un producto ☐
- **Haz:** edita un producto y apaga *Producto activo*.
- **Ves:** deja de aparecer en **Venta**, pero sigue en *Productos → Inactivos*. Sus ventas viejas se conservan.

### D6 · El stock no se edita a mano ☐
- **Ves:** en la ficha de un producto el stock es de solo lectura, con el enlace *Cambiar en Inventario*. Cambia solo con ventas, entradas y ajustes (para que siempre quede el porqué).

---

## E. Inventario y proveedores

### E1 · Registrar mercancía que llegó ☐
- **Haz:** *Inventario*, en la tarjeta de un producto bajo (p. ej. Gaseosa) toca **Entrada**. Viene con el proveedor y una cantidad sugerida. Cambia el **costo** y registra.
- **Ves:** «Entrada registrada…» y el stock sube. Avisa «El costo cambia de $… a $…».
- **Base de datos:** `npm run ver -- movimientos 3` → un movimiento `ENTRADA` con el stock nuevo. El **costo** del producto quedó actualizado y se guardó el cambio en el historial.

### E2 · Ajustar el stock por conteo ☐
- **Haz:** *Inventario → Ajustar* en un producto → *Conteo físico* → escribe lo que contaste.
- **Ves:** la vista previa «Stock: 0 → 5 (+5)». Sin motivo no deja aplicar.
- **Base de datos:** un movimiento `AJUSTE` con el motivo.

### E3 · Ajuste imposible ☐
- **Haz:** *Pérdida o daño* con más unidades de las que hay.
- **Ves:** «No puedes quitar más de lo que hay» y el botón queda desactivado.

### E4 · Proveedor: qué toca pedirle ☐
- **Haz:** *Proveedores* → abre uno (p. ej. Aseo Total).
- **Ves:** «Para pedirle ahora» con los productos bajos y la cantidad sugerida (el doble del mínimo), el botón **Copiar pedido**, enlaces de **llamar** y **WhatsApp**, y el botón **Entrada**, que abre el registro ya con esos productos.

### E5 · Crear y desactivar un proveedor ☐
- **Haz:** crea uno (prueba un nombre repetido → «Ya tienes un proveedor con ese nombre»). Desactívalo.
- **Ves:** deja de salir al registrar compras; su historial se conserva.

---

## F. Panel y cifras

### F1 · Las cifras salen de las ventas reales ☐
- **Haz:** haz 2 o 3 ventas. Ve al **Panel** (período *Hoy*).
- **Ves:** ventas, ganancia y número de ventas **suben**. Los más vendidos y las ventas por categoría reflejan lo vendido.
- **Comprueba a mano:** ganancia = Σ (precio − costo) × cantidad. `npm run ver` te da el total y la ganancia de hoy: deben coincidir con el Panel.

### F2 · Filtros de período ☐
- **Haz:** prueba *Hoy, Ayer, 7 días, 30 días, Este mes, Mes pasado y Personalizado*.
- **Ves:** cada filtro cambia las cifras, la gráfica y el medidor de meta; cada cifra se compara con el período anterior («▲ 12 % vs ayer»). El período queda en la dirección, así que **recargar no lo pierde**.
- **Prueba:** en *Personalizado* pon fechas invertidas (te avisa), una fecha futura (te avisa) y un rango de más de un año (te avisa).

### F3 · Hora de Colombia ☐
- **Ves:** una venta hecha a las 11 p. m. cuenta como del **mismo día**, no del siguiente.

---

## G. Configuración

### G1 · El nombre y la apariencia se guardan en el servidor ☐
- **Haz:** *Configuración → Negocio*, cambia el nombre y guarda. En *Apariencia* cambia el color y el fondo.
- **Ves:** el cambio se aplica al instante en **todas** las pantallas. Cierra sesión: la pantalla de acceso ya muestra el nombre y el estilo nuevos. Abre otro navegador: igual.
- **Base de datos:** la tabla `configuracion` tiene las claves `nombreNegocio`, `colorAcento`, `patron`…

### G2 · Crear un usuario ☐
- **Haz:** *Usuarios → Nuevo usuario* (nombre, usuario, contraseña de al menos 8 caracteres, rol).
- **Ves:** aparece en la lista. Si el usuario ya existe: «Ese nombre de usuario ya está en uso». Entra con ese usuario y comprueba su rol.
- **Base de datos:** `npm run ver -- usuarios`. La contraseña **nunca** se guarda en claro (es un código cifrado que empieza con `$2…`).

### G3 · Restablecer una contraseña ☐
- **Haz:** *Usuarios → ícono de llave* en una persona → escribe la nueva.
- **Ves:** con ella entra; con la vieja, ya no.

### G4 · Nunca sin dueño ☐
- **Haz:** intenta desactivar **tu propia** cuenta, o la del único dueño.
- **Ves:** «No puedes desactivar tu propia cuenta» / «Debe quedar al menos un dueño activo».

---

## H. Primer arranque (sistema nuevo)

### H1 · Instalación desde cero ☐
- **Haz:** `npm run db:vaciar` (desde `apps/api`), recarga la página.
- **Ves:** te lleva solo al asistente de 4 pasos: cuenta de dueño (con medidor de seguridad de la clave) → negocio → categorías → apariencia → «¡Todo listo!». Entra al Panel con la sesión ya abierta.
- **Base de datos:** `npm run ver -- usuarios` → el dueño; el nombre del negocio y las categorías creadas.

### H2 · No se puede repetir ☐
- **Haz:** con el sistema ya configurado, escribe `…#/inicio`.
- **Ves:** te lleva al acceso o al Panel. No se puede crear un segundo dueño por esa vía.

---

## I. Cuando algo falla (resistencia)

### I1 · Servidor apagado ☐
- **Haz:** cierra la ventana «Nivel · API» y vuelve a intentar vender o recargar.
- **Ves:** un mensaje claro («No se pudo conectar con el servidor…»), **sin pantallas en blanco** y sin perder el carrito. Si recargas con el servidor apagado verás la pantalla de acceso con ese aviso; **tu sesión no se borra**: al encender de nuevo el servidor y recargar, entras sin escribir la clave otra vez.

### I2 · Sesión vencida ☐
- **Ves:** si la sesión vence (12 horas) o la revocan, «Tu sesión terminó» y vuelves al acceso.

---

## J. Devoluciones de clientes

### J1 · El cliente devuelve parte de lo que compró ☐
- **Haz:** vende 3 unidades de un producto. En **Ventas** abre esa venta → **Devolución** → devuelve 1 unidad, motivo «No le gustó», reembolso en efectivo.
- **Ves:** la venta pasa a «Devolución parcial». El stock sube en 1. El botón **Anular** desaparece (una venta con devoluciones no se anula).
- **Base de datos:** `npm run ver -- devoluciones 3` → la devolución con su valor al **precio de esa venta** (aunque hoy el precio sea otro). `npm run ver -- movimientos 3` → un `DEVOLUCION_CLIENTE` de +1.

### J2 · El producto vuelve dañado ☐
- **Haz:** devuelve una unidad marcándola como **dañada**.
- **Ves:** se devuelve el dinero pero el stock **no** sube (no se puede volver a vender).

### J3 · No se puede devolver más de lo vendido ☐
- **Haz:** intenta devolver más unidades de las que se vendieron, o una segunda devolución que pase el total.
- **Ves:** «De … solo se pueden devolver N».

### J4 · El Panel descuenta la devolución ☐
- **Haz:** mira el Panel de hoy antes y después de una devolución.
- **Ves:** las ventas y la ganancia bajan; aparece la nota «Incluye −$… en devoluciones». La devolución cuenta el **día en que se devolvió el dinero**.

### J5 · Doble clic en «Registrar devolución» ☐
- **Ves:** se registra **una sola** devolución (el dinero nunca se devuelve dos veces).

## K. Devoluciones a proveedores

### K1 · El proveedor trajo de más ☐
- **Haz:** *Inventario → Entrada de mercancía* de 20 unidades. Luego en *Proveedores* abre ese proveedor → **Devolver mercancía** → elige esa compra, devuelve 5, motivo «Llegó de más», resolución «Nota crédito».
- **Ves:** el stock baja en 5 y en la pestaña *Devoluciones* del proveedor queda registrada con su valor **a costo**.
- **Base de datos:** `npm run ver -- devoluciones 3` y `npm run ver -- movimientos 3` (`DEVOLUCION_PROVEEDOR` de −5).

### K2 · Mercancía dañada o vencida que ya estaba en el estante ☐
- **Haz:** devuelve a un proveedor sin elegir compra de origen, motivo «Vencido».
- **Ves:** solo deja devolver hasta lo que **hay** en el inventario.

### K3 · No se puede devolver más de lo que se compró ☐
- **Haz:** con una compra de origen, intenta devolver más unidades de las que compraste.
- **Ves:** el sistema lo rechaza con un mensaje claro.

## L. Categorías

### L1 · Administrar categorías ☐
- **Haz:** *Configuración → Categorías*. Crea «Papelería»; renómbrala a «Papelería y útiles»; cámbiale el color; desactívala.
- **Ves:** cada cambio se guarda al instante. Una categoría desactivada **no aparece** al crear productos nuevos, pero los productos que ya la tenían la conservan. Nunca se borran.
- **Prueba también:** renombrar una a «bebidas» cuando ya existe «Bebidas» → «Ya existe una categoría con ese nombre».

## M. Importar productos desde Excel o CSV

### M1 · Importación correcta ☐
- **Haz:** *Productos → Importar → Descargar plantilla*. Llena 3 productos (deja un código vacío, uno nuevo con tu propio código y una categoría que no exista). Súbela.
- **Ves:** una **vista previa** con «Todo en orden: se crearán 3», las categorías nuevas y cada fila marcada «Nuevo». Al confirmar, aparecen en la lista con su stock inicial.
- **Base de datos:** `npm run ver -- movimientos 5` → un movimiento «Stock inicial (importación)» por producto con stock.

### M2 · Importación con errores ☐
- **Haz:** en el archivo deja un nombre vacío, un costo `10,5` (con decimal) y un código con espacios.
- **Ves:** una lista de errores con **fila y columna** («Fila 3 · Nombre: Falta el nombre…»). El botón *Importar* queda bloqueado: **no se guarda nada** hasta corregirlo.

### M3 · Actualizar productos que ya existen ☐
- **Haz:** sube un archivo con el **código de un producto existente** y otro precio.
- **Ves:** «Actualiza» (no crea un duplicado). El precio cambia y queda en el historial de precios. El **stock no cambia** (para eso está el conteo).

## N. Conteo físico masivo

### N1 · Contar todo el inventario ☐
- **Haz:** *Inventario → Conteo físico*. Escribe lo que contaste en 3 productos (uno igual al del sistema, uno menor y uno mayor); uno déjalo vacío. Pulsa *Revisar*.
- **Ves:** solo los que **difieren** aparecen con «antes → contado» y la diferencia. El vacío y el igual no se tocan. Si escribes una letra o un negativo, el botón se bloquea hasta corregirlo.
- **Base de datos:** `npm run ver -- movimientos 5` → un `AJUSTE` por cada producto con diferencia, con el motivo «Conteo físico del inventario». `npm run ver -- coherencia` → todo cuadra.

## O. Copias de seguridad

### O1 · Hacer una copia ☐
- **Haz:** *Configuración → Copias de seguridad → Hacer copia ahora*.
- **Ves:** «Copia creada y verificada (N registros, N fotos)» y la copia en la lista. En la carpeta `apps/api/copias` hay un archivo `nivel-copia-…-manual.zip`.
- **Además:** el sistema hace **una copia automática cada 24 horas** mientras el PC esté encendido (y guarda las últimas 30). Si configuras `COPIAS_EXTRA_DIR` en el `.env` (una USB u otro disco), cada copia se repite allí.

### O2 · Descargar una copia ☐
- **Haz:** en la lista, **Descargar**. Ábrela con cualquier programa de zip: trae `datos.json` y la carpeta `fotos`.

### O3 · Restaurar (¡con cuidado!) ☐
- **Haz:** haz una copia. Después vende algo y crea un producto de prueba. Pulsa **Restaurar** en la copia, escribe `RESTAURAR` y confirma.
- **Ves:** el sistema se recarga **como estaba en la copia** (la venta y el producto de prueba ya no están, y las fotos vuelven). Antes de restaurar guarda una copia «Antes de restaurar», por si te arrepientes: puedes restaurar esa para volver atrás.
- **Importante:** restaurar borra lo registrado **después** de la copia. Pruébalo con datos de ejemplo, no con los del negocio.

### O4 · Reporte semanal por correo (opcional) ☐
- **Requiere** configurar el correo en `apps/api/.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `REPORTE_PARA`; con Gmail, una «contraseña de aplicación»). Lo explica `.env.example`.
- **Haz:** *Copias de seguridad → Enviar ahora*.
- **Recibes:** un correo con un **Excel** (resumen, ventas, más vendidos, inventario) y la **copia de seguridad (.zip)** adjunta. Si el correo está configurado, se envía solo cada 7 días.
- **Nota:** el Excel sirve para **leer** el negocio; para **recuperar** el sistema se usa la copia `.zip`.

---

## P. Mi cuenta y personalización

### P1 · Cambiar mi contraseña ☐
- **Haz:** toca el ícono de la **llave** (barra lateral o, en celular, arriba). Prueba: todo vacío; una nueva de menos de 8 letras; «repetir» distinto; la contraseña actual equivocada.
- **Ves:** cada error en español, junto al campo. Con la actual correcta y una nueva válida: «Contraseña cambiada». Sal y entra con la nueva.

### P2 · Logo y colores del cliente ☐
- **Haz:** copia `apps/api/personalizacion.ejemplo` como `apps/api/personalizacion`, reinicia la API y recarga la página (lee `LEEME.md` de esa carpeta).
- **Ves:** el logo del cliente en la barra lateral y la pantalla de acceso, el lema bajo el nombre del negocio y los colores del archivo. Si pones un color mal escrito (`rojo`), el archivo se ignora y la ventana de la API explica por qué; el sistema sigue funcionando.

### P3 · Instalar en el celular ☐
- **Haz:** abre el sistema en el celular y usa «Agregar a la pantalla de inicio» (ver `docs/INSTALACION.md`).
- **Ves:** un ícono «Nivel» que abre a pantalla completa.

---

## ¿Qué NO puedes probar todavía? (está pendiente)
Para no perder tiempo buscando algo que aún no existe:

- **Imprimir el recibo** (el negocio no tiene impresora por ahora; solo se ve la vista previa del diseño).
- **El buscador global** `Ctrl + K` (solo está dibujado).
- **Instalación en otro PC** (el instalador para el negocio se prepara aparte).

---

## Al terminar, cuéntame
Por cada caso: ✔ funcionó, o ✖ no, con lo que pasó y una captura. Con eso corregimos y volvemos a probar.
