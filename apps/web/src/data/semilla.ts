import { productosIniciales } from '../mock/catalogo'
import type { Compra, Movimiento, VentaListada } from './contexto'

/* Datos de ejemplo del prototipo (historial y compras). Separados del proveedor para poder probarlos. */
// Historial de ejemplo COHERENTE: el stock actual de cada producto es la suma de sus movimientos.
// Los primeros productos tuvieron más stock al inicio, se vendió una parte y hubo dos compras a proveedores.
const DIA = 86_400_000
export const vendidoAntes = (id: number) => (id <= 8 ? ((id * 3) % 7) + 2 : 0)

export const comprasIniciales = (): Compra[] => [
  { id: 1, proveedorId: 1, fecha: new Date(Date.now() - DIA * 9), total: 24 * 1100, notas: 'Pedido semanal', items: [{ productoId: 2, cantidad: 24, costoUnitario: 1100 }] },
  { id: 2, proveedorId: 3, fecha: new Date(Date.now() - DIA * 6), total: 30 * 3300 + 12 * 3900, items: [{ productoId: 8, cantidad: 30, costoUnitario: 3300 }, { productoId: 10, cantidad: 12, costoUnitario: 3900 }] },
  { id: 3, proveedorId: 2, fecha: new Date(Date.now() - DIA * 12), total: 10 * 5600, items: [{ productoId: 7, cantidad: 10, costoUnitario: 5600 }] },
  { id: 4, proveedorId: 4, fecha: new Date(Date.now() - DIA * 4), total: 24 * 3500 + 12 * 7600, notas: 'Entrega de la mañana', items: [{ productoId: 12, cantidad: 24, costoUnitario: 3500 }, { productoId: 13, cantidad: 12, costoUnitario: 7600 }] },
]

export const movimientosIniciales = (): Movimiento[] => {
  const ms: Movimiento[] = []
  let n = 1
  const comprado = (id: number) => comprasIniciales().flatMap((c) => c.items).filter((i) => i.productoId === id).reduce((s, i) => s + i.cantidad, 0)
  for (const p of productosIniciales) {
    const vendido = vendidoAntes(p.id)
    const entradas = comprado(p.id)
    // Stock inicial = lo que hay hoy + lo vendido − lo comprado después (así todo cuadra)
    const arranque = p.stock + vendido - entradas
    ms.push({ id: n++, productoId: p.id, tipo: 'AJUSTE', cantidad: arranque, stockResultante: arranque, motivo: 'Stock inicial', fecha: new Date(Date.now() - DIA * 14), usuario: 'Juan' })
    if (vendido > 0) {
      ms.push({ id: n++, productoId: p.id, tipo: 'VENTA', cantidad: -vendido, stockResultante: p.stock, motivo: `Venta #${String(100 + p.id).padStart(4, '0')}`, fecha: new Date(Date.now() - DIA * (p.id % 4 + 1)), usuario: 'María' })
    }
  }
  for (const c of comprasIniciales()) {
    for (const i of c.items) ms.push({ id: n++, productoId: i.productoId, tipo: 'ENTRADA', cantidad: i.cantidad, stockResultante: productosIniciales.find((p) => p.id === i.productoId)!.stock + vendidoAntes(i.productoId), motivo: `Compra #${c.id}`, fecha: c.fecha, usuario: 'Juan' })
  }
  return ms.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
}


/** Ventas de ejemplo de los últimos días (solo para la demo; en el sistema real salen de la base de datos). */
export const ventasIniciales = (): VentaListada[] => {
  const vendedores = ['María Gómez', 'Juan Pulido']
  const ventas: VentaListada[] = []
  for (let i = 0; i < 24; i++) {
    const items = [0, 1, 2].slice(0, 1 + (i % 3)).map((k) => {
      const p = productosIniciales[(i * 5 + k * 3) % productosIniciales.length]!
      return { id: p.id, productoId: p.id, nombre: p.nombre, cantidad: 1 + ((i + k) % 3), precioUnitario: p.precio, costoUnitario: p.costo }
    })
    const total = items.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
    const pagado = Math.ceil(total / 5000) * 5000
    ventas.push({
      id: 1000 + i, numero: 100 + i, fecha: new Date(Date.now() - (i * 95 + 20) * 60_000), vendedor: vendedores[i % 2]!, total, pagado, vueltas: pagado - total,
      medioPago: i % 5 === 4 ? 'TRANSFERENCIA' : 'EFECTIVO', estado: 'COMPLETADA', items,
      ganancia: items.reduce((s, l) => s + l.cantidad * (l.precioUnitario - (l.costoUnitario ?? 0)), 0),
    })
  }
  return ventas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
}
