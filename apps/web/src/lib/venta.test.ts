import { describe, expect, it } from 'vitest'
import { faltante, puedeConfirmar, totalVenta, unidades, vueltas } from './venta'
import type { LineaCarrito } from './venta'
import { buscar, estadoDe, margen, normalizar, siguienteCodigo } from './busqueda'
import { productosIniciales } from '../mock/catalogo'

const gaseosa = productosIniciales[0]! // Pegante Fénix 1 L, código "0001", $12.000
const arroz = productosIniciales[7]! // Pinta cuero marrón, código "0008", $5.000
const lineas: LineaCarrito[] = [
  { producto: gaseosa, cantidad: 1 },
  { producto: arroz, cantidad: 2 },
]

describe('reglas de la venta', () => {
  it('calcula el total en pesos enteros', () => {
    expect(totalVenta(lineas)).toBe(22000)
    expect(totalVenta([])).toBe(0)
  })

  it('cuenta las unidades', () => {
    expect(unidades(lineas)).toBe(3)
  })

  it('calcula las vueltas y nunca da negativo', () => {
    expect(vueltas(22000, 30000)).toBe(8000)
    expect(vueltas(22000, 10000)).toBe(0)
  })

  it('calcula lo que falta por pagar', () => {
    expect(faltante(22000, 10000)).toBe(12000)
    expect(faltante(22000, 30000)).toBe(0)
  })

  it('no deja confirmar con carrito vacío ni pagando de menos (HU-13)', () => {
    expect(puedeConfirmar(0, 5000, false)).toBe(false)
    expect(puedeConfirmar(22000, 21999, true)).toBe(false)
    expect(puedeConfirmar(22000, 22000, true)).toBe(true)
  })
})

describe('búsqueda por nombre o por número/código (HU-11)', () => {
  const nombres = (q: string) => buscar(productosIniciales, q).map((p) => p.nombre)

  it('ignora tildes y mayúsculas', () => {
    expect(normalizar('  ELÁSTICO ')).toBe('elastico')
    expect(nombres('elastico')).toEqual(['Elástico 2 cm (rollo)'])
  })

  it('el número EXACTO va primero: "0001" trae el Pegante Fénix antes que cualquier otro', () => {
    expect(nombres('0001')[0]).toBe('Pegante Fénix 1 L')
  })

  it('un número parcial trae los códigos que empiezan así, en orden', () => {
    // Los códigos que EMPIEZAN por 001 (0010 a 0017) van antes que cualquier otro que solo lo contenga.
    expect(nombres('001').slice(0, 3)).toEqual(['Hilo encerado café', 'Agujas (paquete)', 'Aguja industrial #14'])
    expect(nombres('001')).toHaveLength(8) // 0010 a 0017
  })

  it('encuentra por una parte del código', () => {
    expect(nombres('0008')).toEqual(['Pinta cuero marrón 125 ml'])
  })

  it('el nombre que EMPIEZA con lo escrito gana al que solo lo contiene', () => {
    expect(nombres('pe')[0]).toBe('Pegante Fénix 1 L') // empieza por «pe»; «Pegante One Way» y «Pegante Plus» también, orden alfabético
    expect(nombres('hilo').slice(0, 2)).toEqual(['Hilo encerado café', 'Cono de hilo negro']) // empieza por «hilo» gana al que solo lo contiene
  })

  it('sin texto devuelve todo y sin coincidencias devuelve vacío', () => {
    expect(buscar(productosIniciales, '')).toHaveLength(productosIniciales.length)
    expect(buscar(productosIniciales, 'zzzz')).toEqual([])
  })
})

describe('utilidades del catálogo', () => {
  it('genera el siguiente número corto libre', () => {
    expect(siguienteCodigo(productosIniciales)).toBe('0018') // el mayor número es 0017
    expect(siguienteCodigo([])).toBe('0001')
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
