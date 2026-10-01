import { describe, expect, it } from 'vitest'
import { desdeServidor, haciaServidor } from './servidor'

describe('ajustes ↔ servidor', () => {
  it('el color de acento cambia de nombre en cada sentido', () => {
    expect(haciaServidor({ acento: '#2f6fb8', patron: 'puntos' })).toEqual({ colorAcento: '#2f6fb8', patron: 'puntos' })
    expect(desdeServidor({ colorAcento: '#2f6fb8', intensidad: 70 })).toEqual({ acento: '#2f6fb8', intensidad: 70 })
  })

  it('"sin color propio" (null) viaja y vuelve como null, no se pierde', () => {
    expect(haciaServidor({ acento: null })).toEqual({ colorAcento: null })
    expect(desdeServidor({ colorAcento: null })).toEqual({ acento: null })
  })

  it('no inventa campos: lo que no viene, no aparece', () => {
    expect(haciaServidor({ metaDiaria: 1000 })).toEqual({ metaDiaria: 1000 })
    expect(desdeServidor({ nombreNegocio: 'X' })).toEqual({ nombreNegocio: 'X' })
    expect('acento' in desdeServidor({ nombreNegocio: 'X' })).toBe(false)
  })
})
