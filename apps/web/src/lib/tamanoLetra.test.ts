import { describe, expect, it } from 'vitest'
import { TAMANOS, esTamano, siguienteTamano } from './tamanoLetra'

describe('tamaño de letra', () => {
  it('rota normal → grande → muy grande → normal', () => {
    expect(siguienteTamano('normal')).toBe('grande')
    expect(siguienteTamano('grande')).toBe('muy-grande')
    expect(siguienteTamano('muy-grande')).toBe('normal')
  })
  it('reconoce solo valores válidos (un valor dañado en el almacenamiento se ignora)', () => {
    expect(esTamano('grande')).toBe(true)
    expect(esTamano('gigante')).toBe(false)
    expect(esTamano(null)).toBe(false)
    expect(esTamano(18)).toBe(false)
  })
  it('cada tamaño es mayor que el anterior y ninguno es ilegible', () => {
    const px = TAMANOS.map((t) => t.px)
    expect([...px].sort((a, b) => a - b)).toEqual(px)
    expect(Math.min(...px)).toBeGreaterThanOrEqual(16)
    expect(Math.max(...px)).toBeLessThanOrEqual(24)
  })
})
