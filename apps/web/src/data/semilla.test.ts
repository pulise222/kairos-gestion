import { describe, expect, it } from 'vitest'
import { productosIniciales } from '../mock/catalogo'
import { comprasIniciales, movimientosIniciales } from './semilla'

describe('datos de ejemplo coherentes (mismo principio que el backend)', () => {
  const movs = movimientosIniciales()

  it('el stock de cada producto es la SUMA de sus movimientos', () => {
    for (const p of productosIniciales) {
      const suma = movs.filter((m) => m.productoId === p.id).reduce((s, m) => s + m.cantidad, 0)
      expect({ producto: p.nombre, suma }).toEqual({ producto: p.nombre, suma: p.stock })
    }
  })

  it('el "stock resultante" sigue el orden cronológico y termina en el stock actual', () => {
    for (const p of productosIniciales) {
      const propios = movs.filter((m) => m.productoId === p.id).sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id - b.id)
      let acumulado = 0
      for (const m of propios) {
        acumulado += m.cantidad
        expect({ producto: p.nombre, id: m.id, quedo: m.stockResultante }).toEqual({ producto: p.nombre, id: m.id, quedo: acumulado })
      }
      expect(acumulado).toBe(p.stock)
    }
  })

  it('nunca hay un stock inicial negativo y cada compra cuadra con sus líneas', () => {
    expect(movs.filter((m) => m.motivo === 'Stock inicial').every((m) => m.cantidad >= 0)).toBe(true)
    for (const c of comprasIniciales()) expect(c.total).toBe(c.items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0))
  })
})
