import type { DevolucionVenta, LineaVentaListada, MotivoDevolucionProveedor, ResolucionProveedor } from '../data/contexto'

/*
  Reglas de las devoluciones como funciones PURAS (sin React). El servidor vuelve a validar todo; aquí solo sirven
  para mostrar cuánto se puede devolver y para calcular el total antes de confirmar.
*/

/** Unidades de una línea que ya fueron devueltas (sumando todas las devoluciones anteriores). */
export const yaDevueltas = (linea: Pick<LineaVentaListada, 'id'>, devoluciones: DevolucionVenta[] = []) =>
  devoluciones.flatMap((d) => d.items).filter((i) => i.ventaItemId === linea.id).reduce((s, i) => s + i.cantidad, 0)

/** Cuántas unidades de esa línea todavía se pueden devolver. */
export const disponibleParaDevolver = (linea: Pick<LineaVentaListada, 'id' | 'cantidad'>, devoluciones: DevolucionVenta[] = []) =>
  Math.max(linea.cantidad - yaDevueltas(linea, devoluciones), 0)

/** ¿Queda algo por devolver en toda la venta? */
export const quedaAlgoPorDevolver = (lineas: Pick<LineaVentaListada, 'id' | 'cantidad'>[], devoluciones: DevolucionVenta[] = []) =>
  lineas.some((l) => disponibleParaDevolver(l, devoluciones) > 0)

/** Dinero que se devuelve: cantidad × PRECIO DE LA VENTA (no el precio actual del producto). */
export const totalDevolucion = (elegidas: { cantidad: number; precioUnitario: number }[]) => elegidas.reduce((s, e) => s + e.cantidad * e.precioUnitario, 0)

export type EstadoDevolucion = 'ninguna' | 'parcial' | 'total'

/** Estado de una venta respecto a sus devoluciones: sin devoluciones, devuelta en parte o devuelta por completo. */
export function estadoDevolucion(lineas: Pick<LineaVentaListada, 'id' | 'cantidad'>[], devoluciones: DevolucionVenta[] = []): EstadoDevolucion {
  if (devoluciones.length === 0) return 'ninguna'
  return quedaAlgoPorDevolver(lineas, devoluciones) ? 'parcial' : 'total'
}

export const MOTIVOS_PROVEEDOR: { id: MotivoDevolucionProveedor; texto: string }[] = [
  { id: 'SOBRANTE', texto: 'Llegó de más' },
  { id: 'DANADO', texto: 'Llegó dañado' },
  { id: 'EQUIVOCADO', texto: 'No es lo que pedí' },
  { id: 'VENCIDO', texto: 'Vencido' },
  { id: 'OTRO', texto: 'Otro motivo' },
]

export const RESOLUCIONES: { id: ResolucionProveedor; texto: string; ayuda: string }[] = [
  { id: 'PENDIENTE', texto: 'Por definir', ayuda: 'Aún no acordaste cómo te lo compensan.' },
  { id: 'NOTA_CREDITO', texto: 'Nota crédito', ayuda: 'Te lo descuentan de la próxima compra.' },
  { id: 'REEMBOLSO', texto: 'Reembolso', ayuda: 'Te devuelven el dinero.' },
  { id: 'REPOSICION', texto: 'Reposición', ayuda: 'Te mandan producto en buen estado.' },
]

export const textoMotivoProveedor = (m: MotivoDevolucionProveedor) => MOTIVOS_PROVEEDOR.find((x) => x.id === m)?.texto ?? m
export const textoResolucion = (r: ResolucionProveedor) => RESOLUCIONES.find((x) => x.id === r)?.texto ?? r

/**
 * Cuánto de una compra todavía se puede devolver al proveedor, producto por producto
 * (lo comprado menos lo que ya se le devolvió de esa misma compra).
 */
export function disponibleDeCompra(
  compra: { id: number; items: { productoId: number; cantidad: number }[] },
  devoluciones: { compraId?: number; items: { productoId: number; cantidad: number }[] }[],
): Map<number, number> {
  const devuelto = new Map<number, number>()
  for (const d of devoluciones.filter((x) => x.compraId === compra.id)) {
    for (const i of d.items) devuelto.set(i.productoId, (devuelto.get(i.productoId) ?? 0) + i.cantidad)
  }
  return new Map(compra.items.map((i) => [i.productoId, Math.max(i.cantidad - (devuelto.get(i.productoId) ?? 0), 0)]))
}

/** Valor a costo de lo que se devuelve al proveedor. */
export const totalDevolucionProveedor = (items: { cantidad: number; costoUnitario: number }[]) => items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0)
