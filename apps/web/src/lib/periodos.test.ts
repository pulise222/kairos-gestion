import { describe, expect, it } from 'vitest'
import { claveGrupo, diasDelRango, diasEnRango, etiquetaRango, granularidadPara, rangoAnterior, rangoDe, validarPersonalizado } from './periodos'

// Jueves 1 de octubre de 2026 (mediodía, hora local)
const HOY = new Date(2026, 9, 1, 12)

describe('rangos de cada período', () => {
  it('hoy y ayer', () => {
    expect(rangoDe('hoy', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-01' })
    expect(rangoDe('ayer', HOY)).toEqual({ desde: '2026-09-30', hasta: '2026-09-30' })
  })

  it('7 y 30 días incluyen hoy y cuentan hacia atrás', () => {
    expect(rangoDe('7d', HOY)).toEqual({ desde: '2026-09-25', hasta: '2026-10-01' })
    expect(diasEnRango(rangoDe('7d', HOY))).toBe(7)
    expect(rangoDe('30d', HOY)).toEqual({ desde: '2026-09-02', hasta: '2026-10-01' })
    expect(diasEnRango(rangoDe('30d', HOY))).toBe(30)
  })

  it('este mes va del 1.º a hoy; el mes pasado es el mes anterior COMPLETO', () => {
    expect(rangoDe('mes', new Date(2026, 9, 15, 12))).toEqual({ desde: '2026-10-01', hasta: '2026-10-15' })
    expect(rangoDe('mesPasado', HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
  })

  it('el mes pasado respeta febrero, bisiestos y el cambio de año', () => {
    expect(rangoDe('mesPasado', new Date(2026, 2, 10, 12))).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(rangoDe('mesPasado', new Date(2028, 2, 10, 12))).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' }) // 2028 es bisiesto
    expect(rangoDe('mesPasado', new Date(2027, 0, 5, 12))).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' })
  })

  it('7 días cruza correctamente el fin de mes y de año', () => {
    expect(rangoDe('7d', new Date(2027, 0, 3, 12))).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' })
  })

  it('el personalizado se devuelve tal cual', () => {
    expect(rangoDe('personalizado', HOY, { desde: '2026-08-10', hasta: '2026-08-20' })).toEqual({ desde: '2026-08-10', hasta: '2026-08-20' })
  })
})

describe('período anterior (para comparar)', () => {
  it('hoy se compara con ayer; 7 días con los 7 anteriores', () => {
    expect(rangoAnterior('hoy', rangoDe('hoy', HOY))).toEqual({ desde: '2026-09-30', hasta: '2026-09-30' })
    expect(rangoAnterior('7d', rangoDe('7d', HOY))).toEqual({ desde: '2026-09-18', hasta: '2026-09-24' })
    expect(rangoAnterior('30d', rangoDe('30d', HOY))).toEqual({ desde: '2026-08-03', hasta: '2026-09-01' })
  })

  it('el anterior tiene SIEMPRE la misma duración (excepto mes calendario)', () => {
    const r = rangoDe('30d', HOY)
    expect(diasEnRango(rangoAnterior('30d', r))).toBe(diasEnRango(r))
  })

  it('este mes se compara con los mismos días del mes anterior', () => {
    expect(rangoAnterior('mes', rangoDe('mes', new Date(2026, 9, 15, 12)))).toEqual({ desde: '2026-09-01', hasta: '2026-09-15' })
  })

  it('este mes: el 31 de marzo se compara con el 28 de febrero (no existe el 31)', () => {
    expect(rangoAnterior('mes', rangoDe('mes', new Date(2026, 2, 31, 12)))).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(rangoAnterior('mes', rangoDe('mes', new Date(2027, 0, 20, 12)))).toEqual({ desde: '2026-12-01', hasta: '2026-12-20' })
  })

  it('el mes pasado se compara con el mes anterior a ese', () => {
    expect(rangoAnterior('mesPasado', rangoDe('mesPasado', HOY))).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' })
  })
})

describe('rango personalizado', () => {
  it('acepta rangos válidos, incluido un solo día y hasta hoy', () => {
    expect(validarPersonalizado({ desde: '2026-09-01', hasta: '2026-09-15' }, HOY)).toBeNull()
    expect(validarPersonalizado({ desde: '2026-10-01', hasta: '2026-10-01' }, HOY)).toBeNull()
  })

  it('rechaza fechas vacías, invertidas, futuras o demasiado largas', () => {
    expect(validarPersonalizado({ desde: '', hasta: '2026-09-15' }, HOY)).toBe('Elige las dos fechas')
    expect(validarPersonalizado({ desde: '2026-09-20', hasta: '2026-09-15' }, HOY)).toMatch(/anterior a la final/)
    expect(validarPersonalizado({ desde: '2026-09-20', hasta: '2026-10-02' }, HOY)).toMatch(/futuro/)
    expect(validarPersonalizado({ desde: '2025-01-01', hasta: '2026-09-15' }, HOY)).toMatch(/máximo/)
  })

  it('370 días es demasiado y 366 todavía se permite', () => {
    expect(validarPersonalizado({ desde: '2025-09-30', hasta: '2026-09-30' }, HOY)).toBeNull() // 366 días
    expect(validarPersonalizado({ desde: '2025-09-29', hasta: '2026-09-30' }, HOY)).toMatch(/máximo/)
  })
})

describe('etiquetas, días y agrupación', () => {
  it('etiqueta de un día y de un rango', () => {
    expect(etiquetaRango({ desde: '2026-10-01', hasta: '2026-10-01' })).toBe('1 oct 2026')
    expect(etiquetaRango({ desde: '2026-09-25', hasta: '2026-10-01' })).toBe('25 sept – 1 oct 2026')
    expect(etiquetaRango({ desde: '2026-12-28', hasta: '2027-01-03' })).toBe('28 dic 2026 – 3 ene 2027')
  })

  it('lista todos los días del rango', () => {
    expect(diasDelRango({ desde: '2026-09-29', hasta: '2026-10-02' })).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('elige la agrupación para que la gráfica no se llene de puntos', () => {
    expect(granularidadPara(7)).toBe('dia')
    expect(granularidadPara(62)).toBe('dia')
    expect(granularidadPara(63)).toBe('semana')
    expect(granularidadPara(190)).toBe('semana')
    expect(granularidadPara(191)).toBe('mes')
  })

  it('agrupa por lunes de la semana y por 1.º del mes', () => {
    expect(claveGrupo('2026-10-01', 'semana')).toBe('2026-09-28') // jueves → lunes anterior
    expect(claveGrupo('2026-09-28', 'semana')).toBe('2026-09-28') // el lunes es su propio inicio
    expect(claveGrupo('2026-10-04', 'semana')).toBe('2026-09-28') // domingo
    expect(claveGrupo('2026-10-17', 'mes')).toBe('2026-10-01')
    expect(claveGrupo('2026-10-17', 'dia')).toBe('2026-10-17')
  })
})
