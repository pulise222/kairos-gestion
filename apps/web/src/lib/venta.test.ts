import { describe, expect, it } from 'vitest'
import { faltante, puedeConfirmar, totalVenta, unidades, vueltas } from './venta'
import type { LineaCarrito } from './venta'
import { buscar, estadoDe, margen, normalizar, siguienteCodigo } from './busqueda'
import { productosIniciales } from '../mock/catalogo'

const gaseosa = productosIniciales[0]! // código "101", $4.500
const arroz = productosIniciales[7]! // código de barras, $4.200
const lineas: LineaCarrito[] = [
  { producto: gaseosa, cantidad: 1 },
  { producto: arroz, cantidad: 2 },
]

describe('reglas de la venta', () => {
  it('calcula el total en pesos enteros', () => {
    expect(totalVenta(lineas)).toBe(12900)
    expect(totalVenta([])).toBe(0)
  })

  it('cuenta las unidades', () => {
    expect(unidades(lineas)).toBe(3)
  })

  it('calcula las vueltas y nunca da negativo', () => {
    expect(vueltas(12900, 20000)).toBe(7100)
    expect(vueltas(12900, 10000)).toBe(0)
  })

  it('calcula lo que falta por pagar', () => {
    expect(faltante(12900, 10000)).toBe(2900)
    expect(faltante(12900, 20000)).toBe(0)
  })

  it('no deja confirmar con carrito vacío ni pagando de menos (HU-13)', () => {
    expect(puedeConfirmar(0, 5000, false)).toBe(false)
    expect(puedeConfirmar(12900, 12899, true)).toBe(false)
    expect(puedeConfirmar(12900, 12900, true)).toBe(true)
  })
})

describe('búsqueda por nombre o por número/código (HU-11)', () => {
  const nombres = (q: string) => buscar(productosIniciales, q).map((p) => p.nombre)

  it('ignora tildes y mayúsculas', () => {
    expect(normalizar('  JABÓN ')).toBe('jabon')
    expect(nombres('jabon')).toEqual(['Jabón de baño'])
  })

  it('el número EXACTO va primero: "101" trae la gaseosa antes que cualquier otro', () => {
    expect(nombres('101')[0]).toBe('Gaseosa 1.5 L')
  })

  it('un número parcial trae los códigos que empiezan así, en orden', () => {
    // Primero los números que EMPIEZAN por 10 (101 a 104); los códigos de barras que solo lo contienen van después.
    expect(nombres('10').slice(0, 4)).toEqual(['Gaseosa 1.5 L', 'Agua 600 ml', 'Jugo de naranja 1 L', 'Cerveza 330 ml']) // 101, 102, 103, 104
    expect(nombres('10')).toHaveLength(4) // sin ruido de códigos de barras largos que contienen "10"
    expect(nombres('20').slice(0, 3)).toEqual(['Detergente 1 kg', 'Jabón de baño', 'Papel higiénico x4'])
  })

  it('encuentra por código de barras completo o por una parte', () => {
    expect(nombres('7701001000008')).toEqual(['Arroz 1 kg'])
    expect(nombres('0008')).toEqual(['Arroz 1 kg'])
  })

  it('el nombre que EMPIEZA con lo escrito gana al que solo lo contiene', () => {
    expect(nombres('pa')[0]).toBe('Pan tajado') // empieza por "pa"; "Papel…" y "Papas…" también, orden alfabético
    expect(nombres('ga').slice(0, 2)).toEqual(['Galletas de sal', 'Gaseosa 1.5 L'])
  })

  it('sin texto devuelve todo y sin coincidencias devuelve vacío', () => {
    expect(buscar(productosIniciales, '')).toHaveLength(productosIniciales.length)
    expect(buscar(productosIniciales, 'zzzz')).toEqual([])
  })
})

describe('utilidades del catálogo', () => {
  it('genera el siguiente número corto libre', () => {
    expect(siguienteCodigo(productosIniciales)).toBe('204') // el mayor número corto es 203
    expect(siguienteCodigo([])).toBe('101')
  })

  it('calcula el margen sobre el precio', () => {
    expect(margen(4500, 3200)).toEqual({ pesos: 1300, porcentaje: 29 })
    expect(margen(1000, 1200)).toEqual({ pesos: -200, porcentaje: -20 }) // vender a pérdida se nota
    expect(margen(0, 0)).toEqual({ pesos: 0, porcentaje: 0 })
  })

  it('clasifica el estado del stock', () => {
    expect(estadoDe({ stock: 0, minimo: 5 })).toBe('agotado')
    expect(estadoDe({ stock: 5, minimo: 5 })).toBe('bajo')
    expect(estadoDe({ stock: 6, minimo: 5 })).toBe('ok')
  })
})
