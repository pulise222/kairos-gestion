import { describe, expect, it } from 'vitest'
import { aplicarEntrada, calcularAjuste, porUrgencia, revisarConteo, sugerirCantidad, totalEntrada } from './inventario'
import { productosIniciales } from '../mock/catalogo'

const gaseosa = productosIniciales[0]! // Pegante Fénix 1 L: stock 24, mínimo 8, costo 8.500
const arroz = productosIniciales[7]! // Pinta cuero marrón: stock 15, mínimo 8, costo 3.300

describe('entrada de mercancía (HU-17)', () => {
  const lineas = [
    { productoId: gaseosa.id, cantidad: 24, costoUnitario: 3400 },
    { productoId: arroz.id, cantidad: 10, costoUnitario: 3300 },
  ]

  it('calcula el total de la compra', () => {
    expect(totalEntrada(lineas)).toBe(24 * 3400 + 10 * 3300)
    expect(totalEntrada([])).toBe(0)
  })

  it('sube el stock y actualiza el costo al de la compra', () => {
    const { productos, cambios } = aplicarEntrada(productosIniciales, lineas)
    expect(productos.find((p) => p.id === gaseosa.id)).toMatchObject({ stock: 48, costo: 3400 })
    expect(productos.find((p) => p.id === arroz.id)).toMatchObject({ stock: 25, costo: 3300 })
    expect(cambios).toEqual([
      { productoId: gaseosa.id, cantidad: 24, stockResultante: 48 },
      { productoId: arroz.id, cantidad: 10, stockResultante: 25 },
    ])
  })

  it('no toca los productos que no están en la compra ni modifica la lista original', () => {
    const copia = JSON.stringify(productosIniciales)
    const { productos } = aplicarEntrada(productosIniciales, lineas)
    expect(JSON.stringify(productosIniciales)).toBe(copia) // inmutable
    const otro = productosIniciales[1]!
    expect(productos.find((p) => p.id === otro.id)).toEqual(otro)
  })
})

describe('ajuste de stock (HU-18)', () => {
  it('conteo físico: calcula la diferencia contra el stock actual', () => {
    expect(calcularAjuste(10, 'conteo', 7)).toEqual({ delta: -3, nuevo: 7 })
    expect(calcularAjuste(3, 'conteo', 8)).toEqual({ delta: 5, nuevo: 8 })
  })

  it('por diferencia: pérdida (−) o sobrante (+)', () => {
    expect(calcularAjuste(10, 'diferencia', -2)).toEqual({ delta: -2, nuevo: 8 })
    expect(calcularAjuste(10, 'diferencia', 4)).toEqual({ delta: 4, nuevo: 14 })
  })

  it('rechaza dejar el stock en negativo, conteos negativos y ajustes sin cambio', () => {
    expect(calcularAjuste(3, 'diferencia', -5)).toMatchObject({ error: expect.stringContaining('más de lo que hay') })
    expect(calcularAjuste(3, 'conteo', -1)).toHaveProperty('error')
    expect(calcularAjuste(3, 'conteo', 3)).toMatchObject({ error: 'Ese valor deja el stock igual' })
    expect(calcularAjuste(3, 'diferencia', 0)).toHaveProperty('error')
    expect(calcularAjuste(3, 'diferencia', 1.5)).toHaveProperty('error')
  })

  it('permite contar cero (todo se acabó)', () => {
    expect(calcularAjuste(3, 'conteo', 0)).toEqual({ delta: -3, nuevo: 0 })
  })
})

describe('ayudas de reposición', () => {
  it('sugiere llegar al doble del mínimo', () => {
    expect(sugerirCantidad({ stock: 3, minimo: 12 })).toBe(21) // 24 − 3
    expect(sugerirCantidad({ stock: 0, minimo: 10 })).toBe(20)
    expect(sugerirCantidad({ stock: 50, minimo: 5 })).toBe(1) // ya sobra: mínimo 1
  })

  it('ordena por urgencia: agotados, luego los más cerca de agotarse', () => {
    const orden = [...productosIniciales].sort(porUrgencia).slice(0, 4).map((p) => p.nombre)
    expect(orden[0]).toBe('Varsol 1 L') // stock 0
    expect(orden[1]).toBe('Contrafuerte (par)') // 2 / 10 = 0,20
    expect(orden[2]).toBe('Aguja industrial #14') // 7 / 15 = 0,47
  })
})

describe('revisarConteo (conteo físico masivo)', () => {
  const prod = (id: number, stock: number) => ({ id, codigo: String(id), nombre: `P${id}`, categoriaId: '1', proveedorId: null, precio: 1, costo: 1, stock, minimo: 0, activo: true })
  const ps = [prod(1, 10), prod(2, 5), prod(3, 0), prod(4, 7)]

  it('solo cuenta las filas escritas: las vacías no se tocan', () => {
    const r = revisarConteo(ps, { 1: '8', 3: '' })
    expect(r.cambios.map((c) => [c.producto.id, c.contado, c.diferencia])).toEqual([[1, 8, -2]])
    expect(r.iguales).toBe(0)
    expect(r.invalidos).toEqual([])
  })
  it('un conteo igual al del sistema no es un cambio', () => {
    const r = revisarConteo(ps, { 2: '5', 3: '4' })
    expect(r.iguales).toBe(1)
    expect(r.cambios.map((c) => c.producto.id)).toEqual([3])
  })
  it('detecta lo inválido (negativo, decimal, letras) y no lo cuenta como cambio', () => {
    const r = revisarConteo(ps, { 1: '-3', 2: '2.5', 3: 'abc', 4: '7 ' })
    expect(r.invalidos).toEqual([1, 2, 3])
    expect(r.cambios).toEqual([])
    expect(r.iguales).toBe(1) // «7 » con espacio sobrante se acepta y coincide
  })
  it('permite contar cero', () => {
    expect(revisarConteo(ps, { 1: '0' }).cambios[0]).toMatchObject({ contado: 0, diferencia: -10 })
  })
})
