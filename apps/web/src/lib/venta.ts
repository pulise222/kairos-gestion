import type { Producto } from '../mock/catalogo'

/*
  Reglas de la venta como funciones PURAS (sin React): fáciles de probar con pruebas automáticas.
  OJO: en el sistema real el backend vuelve a calcular y validar todo (única fuente de verdad);
  aquí solo se usan para mostrar el resultado en pantalla mientras se atiende al cliente.
*/
export interface LineaCarrito {
  producto: Producto
  cantidad: number
}

export const subtotal = (l: LineaCarrito) => l.producto.precio * l.cantidad

export const totalVenta = (lineas: LineaCarrito[]) => lineas.reduce((suma, l) => suma + subtotal(l), 0)

export const unidades = (lineas: LineaCarrito[]) => lineas.reduce((suma, l) => suma + l.cantidad, 0)

/** Vueltas = lo pagado menos el total (nunca negativo). */
export const vueltas = (total: number, pagado: number) => Math.max(pagado - total, 0)

/** Lo que falta por pagar (0 si ya alcanza). */
export const faltante = (total: number, pagado: number) => Math.max(total - pagado, 0)

/** HU-13: no se puede confirmar si el carrito está vacío o si paga menos del total. */
export const puedeConfirmar = (total: number, pagado: number, hayLineas: boolean) => hayLineas && pagado >= total
