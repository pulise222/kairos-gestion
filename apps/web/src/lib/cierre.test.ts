import { describe, expect, it } from 'vitest'
import { cuadre, efectivoEsperado, sumarDias } from './cierre'

const f = (v: number) => `$${v}`

describe('cierre del día', () => {
  it('lo esperado es el fondo más el efectivo neto de las ventas', () => {
    expect(efectivoEsperado(20000, 21000)).toBe(41000)
    expect(efectivoEsperado(0, 0)).toBe(0)
    expect(efectivoEsperado(30000, -5000)).toBe(25000) // el día con más devoluciones en efectivo que ventas
  })
  it('cuadra cuando lo contado es igual a lo esperado', () => {
    expect(cuadre(41000, 41000, f)).toEqual({ estado: 'cuadra', diferencia: 0, texto: '¡Cuadra! Todo está completo.' })
  })
  it('falta o sobra dinero, con su signo y su texto', () => {
    expect(cuadre(41000, 39500, f)).toEqual({ estado: 'falta', diferencia: -1500, texto: 'Faltan $1500' })
    expect(cuadre(41000, 42000, f)).toEqual({ estado: 'sobra', diferencia: 1000, texto: 'Sobran $1000' })
  })
  it('sumarDias cruza meses y años sin errores', () => {
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01')
    expect(sumarDias('2026-10-01', 0)).toBe('2026-10-01')
  })
})
