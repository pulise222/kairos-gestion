# Servicios Kairos · Sistema a la medida

> Repositorio **privado**. Es una copia del sistema base «Nivel» (repositorio `nivel-gestion-negocio`) adaptada a un cliente.
> El material del cliente (fotos del cuaderno, precios, logo original) vive en `material-cliente/` y **nunca se sube** (está en `.gitignore`).

## El negocio
- **Servicios Kairos** vende **insumos de calzado**: pegantes (Continental One Way y Plus, Fénix, Jumbo, Urano Platino, Afix, Maxón…), soluciones (activador, thinner, varsol, removedor, látex), tintes y marroquinera para cuero, hilos en conos de colores, elásticos y sesgos, y agujas.
- Venta **por unidad** en el mostrador (el cliente pide «una botella de pegante y una penta de solución»).
- **Una sola caja** compartida por 3 vendedoras → **un solo usuario**.
- Hay internet (WiFi) pero a veces se cae. Un portátil con WiFi, caja para el dinero e impresora de recibos que casi no usan (**no se imprime recibo**).
- No fían. No tienen catálogo cargado: **ellos mismos agregarán productos y proveedores**.

## Cómo trabajan hoy: el cuaderno
Cuatro columnas por sección, una suma por venta (`12000+21000+9000+`) y una línea por día con la fecha. Al cierre del día validan que **el dinero cuadre con lo anotado** (la palabra rayada).

| Columna del cuaderno | Sección propuesta | Proveedor |
| --- | --- | --- |
| Pegante / Solución | Pegantes y soluciones | Fénix |
| One Way / Hilos | One Way e hilos | (por definir) |
| Materiales / Sesgos | Materiales y sesgos | varios |
| Hilos / Agujas | Hilos y agujas | (por definir) |

Los números escritos en los estantes y frascos: algunos son **precios**.

## Personas
Uso diario por 3 vendedoras, una de ellas **mayor y sin experiencia con computador**. Primera vez que dejan el cuaderno.

## Lo que se va a construir (en este orden)
1. **Identidad:** logo y paleta propia de Kairos, diseño exclusivo y profesional (3 opciones para elegir).
2. **Modo simple y grande:** inicio en *Venta*, botones y letra grandes, tamaño de letra ajustable, mensajes claros.
3. **Venta rápida por sección** (monto) y **cierre del día** (cuadre del efectivo contra lo vendido).
4. **Producto sin control de stock** y **crear producto al vuelo** desde la caja.
5. **Respaldos:** copia diaria, **Excel de respaldo** en una carpeta visible y copia a Google Drive (Drive para escritorio).
6. **Botón «Enviar comentario»** para la semana de prueba.
7. Ensayo: instalar en su portátil, guía de una página y una semana de uso con feedback.

Se conservan **todas** las funciones del sistema base (devoluciones, proveedores, inventario, conteo, importación, panel, copias).

## Equipo
Portátil con WiFi conectado a la corriente todo el día: activar el **límite de carga al 80 %** si el equipo lo permite, **no suspender con corriente conectada** y que cerrar la tapa no haga nada. Celular opcional por el mismo WiFi (ícono en pantalla de inicio).
