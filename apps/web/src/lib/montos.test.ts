import { describe, expect, it } from 'vitest'
import { sumarMontos } from './montos'

describe('sumarMontos (suma escrita como en el cuaderno)', () => {
  it('un solo valor', () => {
    expect(sumarMontos('12000')).toEqual({ ok: true, total: 12000, partes: [12000] })
  })
  it('suma varios valores, con o sin espacios', () => {
    expect(sumarMontos('12000+9000+5500')).toEqual({ ok: true, total: 26500, partes: [12000, 9000, 5500] })
    expect(sumarMontos(' 12000 + 9000 ')).toMatchObject({ ok: true, total: 21000 })
  })
  it('entiende puntos de miles y el signo $', () => {
    expect(sumarMontos('$12.000 + 9.000')).toMatchObject({ ok: true, total: 21000 })
    expect(sumarMontos('1.250.000')).toMatchObject({ ok: true, total: 1250000 })
  })
  it('un «+» al final mientras escribe no es un error', () => {
    expect(sumarMontos('12000+')).toMatchObject({ ok: true, total: 12000 })
  })
  it('vacío no es un error que mostrar', () => {
    expect(sumarMontos('')).toEqual({ ok: false, error: '' })
    expect(sumarMontos('   ')).toEqual({ ok: false, error: '' })
    expect(sumarMontos('+')).toEqual({ ok: false, error: '' })
  })
  it('rechaza letras, decimales, negativos y dobles «+»', () => {
    expect(sumarMontos('12abc')).toMatchObject({ ok: false })
    expect(sumarMontos('12,5')).toMatchObject({ ok: false })
    expect(sumarMontos('-500')).toMatchObject({ ok: false })
    expect(sumarMontos('1000++500')).toMatchObject({ ok: false })
  })
  it('rechaza el cero y los valores gigantes', () => {
    expect(sumarMontos('0')).toMatchObject({ ok: false })
    expect(sumarMontos('999999999999')).toMatchObject({ ok: false })
  })
})
