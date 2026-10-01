# Guía de pruebas · Servicios Kairos

Para revisar el sistema como lo usaría una vendedora. Cada punto dice **qué hacer** y **qué debe pasar**.

## Estado de la calidad (automática)
| Prueba | Resultado |
| --- | --- |
| API (`npm test` en `apps/api`): reglas de venta, cierre, comentarios, Excel, simulaciones | 224 de 224 ✔ |
| Pantalla (`npx vitest run` en `apps/web`) | 146 de 146 ✔ |
| Recorrido en navegador (10 secciones, 39 comprobaciones) | 39 de 39 ✔ |
| Compilación (`tsc`) | sin errores ✔ |

## Recorrido manual sugerido (15 minutos)
1. **Entrar** → se ve el logo de Kairos, el título de la pestaña dice «Servicios Kairos» y cae en la pantalla *Venta*.
2. **Letra:** botón «Aa» (arriba) → Normal / Grande / Muy grande; recarga la página y debe recordar la elección.
3. **Venta normal:** tocar un producto 2 veces, otro 1 vez → el total se actualiza; «Paga con» 100.000 → vueltas correctas → *Confirmar venta* → «Venta registrada».
4. **Por monto:** *Por monto* → sección *Hilos* → escribir `12000 + 9000` → muestra 21.000 → agregar. Escribir letras → no se aceptan.
5. **Producto que no existe:** buscar «sandalia» → *Agregar uno nuevo* → sin precio no deja guardar; con precio y sección entra a la venta.
6. **Sin stock:** vender un producto con 0 → **no se bloquea** (regla del cliente).
7. **Anular:** *Ventas* → abrir una venta → *Anular* → pide motivo; el total del día baja.
8. **Cierre del día:** base 20.000 y efectivo contado menor → dice «Faltan $…» en rojo; exacto → «¡Cuadra!»; guardar; volver a abrir y corregir.
9. **Inventario:** los productos sin control (los de «por monto» y los creados al vuelo) **no** aparecen; una entrada de mercancía sube el número.
10. **Meta del Panel:** es opcional; *Definir una meta* → guardar → ver porcentaje → *Cambiar* → *Quitar meta*.
11. **Comentario:** botón *Comentario* → escribir → *Configuración → Comentarios* lo muestra y permite descargar.
12. **Copias:** *Configuración → Copias de seguridad* → «Hacer copia ahora» y «Descargar Excel» (abre en Excel con hojas de ventas, por sección, cierres y catálogo).
13. **Celular:** abrir la dirección del PC desde el celular (mismo WiFi): la barra de abajo muestra todos los módulos.
14. **Sin WiFi:** apagar el WiFi del PC → seguir vendiendo; todo funciona igual.

## Qué NO se puede comprobar aquí (se verifica al instalar en el PC del cliente)
- Que el portátil real no se duerma (script `configurar-portatil.ps1`).
- Que la copia llegue al Drive del cliente (`COPIAS_EXTRA_DIR`).
- La lectura de la pantalla por la persona mayor: pedirle que haga las pruebas 3, 4 y 8 sin ayuda y anotar dónde duda.

## Preguntas para la semana de piloto
- ¿Qué paso de la venta les cuesta más?
- ¿Usan «Por monto» o buscan siempre el producto?
- ¿El cierre del día cuadra con el cuaderno? ¿Qué diferencias hay?
- ¿Qué productos faltan o tienen el precio mal?
- ¿La letra es cómoda? ¿Qué tamaño eligieron?
