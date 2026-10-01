import { describe, expect, it } from 'vitest'
import { fecha, fechaHora } from './fechas'

describe('formato de fechas', () => {
  it('fecha corta con mes abreviado', () => {
    expect(fecha(new Date(2026, 8, 30))).toBe('30 sept 2026')
    expect(fecha(new Date(2027, 0, 5))).toBe('5 ene 2027')
  })

  it('hora en formato de 12 horas con a. m. / p. m.', () => {
    expect(fechaHora(new Date(2026, 8, 30, 16, 52))).toBe('30 sept, 4:52 p. m.')
    expect(fechaHora(new Date(2026, 9, 1, 0, 5))).toBe('1 oct, 12:05 a. m.') // medianoche = 12 a. m.
    expect(fechaHora(new Date(2026, 9, 1, 12, 0))).toBe('1 oct, 12:00 p. m.') // mediodía = 12 p. m.
    expect(fechaHora(new Date(2026, 9, 1, 9, 7))).toBe('1 oct, 9:07 a. m.')
  })
})
