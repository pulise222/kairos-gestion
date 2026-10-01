import { describe, expect, it } from 'vitest'
import { disponibleDeCompra, disponibleParaDevolver, estadoDevolucion, quedaAlgoPorDevolver, totalDevolucion, totalDevolucionProveedor, yaDevueltas } from './devoluciones'
import type { DevolucionVenta } from '../data/contexto'

const linea = (id: number, cantidad: number) => ({ id, cantidad })
const dev = (ventaItemId: number, cantidad: number): DevolucionVenta => ({
  id: 1, fecha: new Date(), total: 0, motivo: 'x', medioReembolso: 'EFECTIVO', usuario: 'Juan',
  items: [{ ventaItemId, productoId: ventaItemId, nombre: 'P', cantidad, precioUnitario: 1000, reingresaStock: true }],
})

describe('devoluciones de clientes', () => {
  it('cuenta lo ya devuelto de cada línea sumando todas las devoluciones', () => {
    expect(yaDevueltas(linea(1, 5), [dev(1, 2), dev(1, 1), dev(2, 9)])).toBe(3)
    expect(yaDevueltas(linea(1, 5), [])).toBe(0)
    expect(yaDevueltas(linea(1, 5))).toBe(0)
  })

  it('calcula cuánto se puede seguir devolviendo y nunca da negativo', () => {
    expect(disponibleParaDevolver(linea(1, 5), [dev(1, 2)])).toBe(3)
    expect(disponibleParaDevolver(linea(1, 5), [dev(1, 5)])).toBe(0)
    expect(disponibleParaDevolver(linea(1, 3), [dev(1, 9)])).toBe(0) // dato incoherente: no se rompe
  })

  it('sabe si queda algo por devolver en la venta', () => {
    const lineas = [linea(1, 2), linea(2, 1)]
    expect(quedaAlgoPorDevolver(lineas, [])).toBe(true)
    expect(quedaAlgoPorDevolver(lineas, [dev(1, 2)])).toBe(true) // falta la línea 2
    expect(quedaAlgoPorDevolver(lineas, [dev(1, 2), dev(2, 1)])).toBe(false)
  })

  it('estado de la venta: sin devoluciones, parcial o total', () => {
    const lineas = [linea(1, 2), linea(2, 1)]
    expect(estadoDevolucion(lineas, [])).toBe('ninguna')
    expect(estadoDevolucion(lineas, [dev(1, 1)])).toBe('parcial')
    expect(estadoDevolucion(lineas, [dev(1, 2), dev(2, 1)])).toBe('total')
  })

  it('el total es cantidad × precio de la VENTA', () => {
    expect(totalDevolucion([{ cantidad: 2, precioUnitario: 4500 }, { cantidad: 1, precioUnitario: 12500 }])).toBe(21500)
    expect(totalDevolucion([])).toBe(0)
  })
})

describe('devoluciones a proveedores', () => {
  const compra = { id: 7, items: [{ productoId: 1, cantidad: 20 }, { productoId: 2, cantidad: 5 }] }

  it('lo disponible es lo comprado menos lo ya devuelto DE ESA compra', () => {
    const previas = [
      { compraId: 7, items: [{ productoId: 1, cantidad: 6 }] },
      { compraId: 7, items: [{ productoId: 1, cantidad: 4 }, { productoId: 2, cantidad: 5 }] },
      { compraId: 99, items: [{ productoId: 1, cantidad: 100 }] }, // de otra compra: no cuenta
    ]
    const d = disponibleDeCompra(compra, previas)
    expect(d.get(1)).toBe(10)
    expect(d.get(2)).toBe(0)
  })

  it('sin devoluciones previas, todo lo comprado está disponible', () => {
    expect([...disponibleDeCompra(compra, []).entries()]).toEqual([[1, 20], [2, 5]])
  })

  it('el valor a costo de lo devuelto', () => {
    expect(totalDevolucionProveedor([{ cantidad: 5, costoUnitario: 3500 }, { cantidad: 2, costoUnitario: 1100 }])).toBe(19700)
  })
})
