import { describe, expect, it } from 'vitest'
import { incluyeDia, mejoresDias, metaDelPeriodo, repartirPorCategoria, repartirPorProducto, serie, totalizar, variacion } from './panel'
import { rangoAnterior, rangoDe } from './periodos'
import { generarDias } from '../mock/ventasDiarias'
import { categorias, productosIniciales } from '../mock/catalogo'

const HOY = new Date(2026, 9, 1, 12)
const dias = generarDias(HOY)
const dia = (fecha: string, ventas: number, ganancia = 0, tickets = 1) => ({ fecha, ventas, ganancia, tickets })

describe('totales por período', () => {
  it('suma solo los días del rango (ambos extremos incluidos)', () => {
    const d = [dia('2026-09-29', 100), dia('2026-09-30', 200), dia('2026-10-01', 400), dia('2026-10-02', 800)]
    expect(totalizar(d, { desde: '2026-09-30', hasta: '2026-10-01' }).ventas).toBe(600)
  })

  it('calcula el ticket promedio y no divide por cero', () => {
    expect(totalizar([dia('2026-10-01', 1000, 300, 4)], { desde: '2026-10-01', hasta: '2026-10-01' }).ticketPromedio).toBe(250)
    expect(totalizar([], { desde: '2026-10-01', hasta: '2026-10-01' })).toEqual({ ventas: 0, ganancia: 0, tickets: 0, ticketPromedio: 0 })
  })

  it('hoy y ayer coinciden con las cifras históricas del Panel', () => {
    expect(totalizar(dias, rangoDe('hoy', HOY))).toMatchObject({ ventas: 1_284_500, ganancia: 412_300, tickets: 48 })
    expect(totalizar(dias, rangoDe('ayer', HOY))).toMatchObject({ ventas: 1_148_000, ganancia: 381_000, tickets: 43 })
  })

  it('INVARIANTE: 30 días = suma de los 30 días uno por uno', () => {
    const r = rangoDe('30d', HOY)
    const unoPorUno = serie(dias, r, 'dia').reduce((s, p) => s + p.ventas, 0)
    expect(totalizar(dias, r).ventas).toBe(unoPorUno)
  })

  it('INVARIANTE: el mes pasado + este mes (hasta hoy) = suma del tramo completo', () => {
    const mesPasado = totalizar(dias, rangoDe('mesPasado', HOY)).ventas
    const estaMes = totalizar(dias, rangoDe('mes', HOY)).ventas
    expect(totalizar(dias, { desde: '2026-09-01', hasta: '2026-10-01' }).ventas).toBe(mesPasado + estaMes)
  })

  it('el historial es determinista: dos generaciones dan lo mismo', () => {
    expect(generarDias(HOY)).toEqual(generarDias(HOY))
  })

  it('los períodos de distinto tamaño dan cifras distintas (el filtro hace algo)', () => {
    const [h, s, m] = (['hoy', '7d', '30d'] as const).map((id) => totalizar(dias, rangoDe(id, HOY)).ventas) as [number, number, number]
    expect(h).toBeLessThan(s)
    expect(s).toBeLessThan(m)
  })
})

describe('comparación con el período anterior', () => {
  it('la variación es porcentual y null cuando no hay con qué comparar', () => {
    expect(variacion(1120, 1000)).toBe(12)
    expect(variacion(900, 1000)).toBe(-10)
    expect(variacion(500, 0)).toBeNull()
  })

  it('compara 7 días contra los 7 anteriores con datos reales', () => {
    const r = rangoDe('7d', HOY)
    const actual = totalizar(dias, r).ventas
    const anterior = totalizar(dias, rangoAnterior('7d', r)).ventas
    expect(anterior).toBeGreaterThan(0)
    expect(variacion(actual, anterior)).not.toBeNull()
  })
})

describe('serie para la gráfica', () => {
  it('incluye los días SIN ventas como 0 (no los salta)', () => {
    const s = serie([dia('2026-10-01', 500)], { desde: '2026-09-29', hasta: '2026-10-01' }, 'dia')
    expect(s.map((p) => p.ventas)).toEqual([0, 0, 500])
  })

  it('agrupa por semana (lunes a domingo) sumando los días', () => {
    const d = [dia('2026-09-28', 10), dia('2026-10-01', 20), dia('2026-10-04', 30), dia('2026-10-05', 40)]
    const s = serie(d, { desde: '2026-09-28', hasta: '2026-10-05' }, 'semana')
    expect(s).toEqual([{ clave: '2026-09-28', ventas: 60, ganancia: 0 }, { clave: '2026-10-05', ventas: 40, ganancia: 0 }])
  })

  it('agrupa por mes y la suma total no cambia al agrupar', () => {
    const r = { desde: '2026-07-15', hasta: '2026-10-01' }
    const porMes = serie(dias, r, 'mes')
    expect(porMes.map((p) => p.clave)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'])
    expect(porMes.reduce((s, p) => s + p.ventas, 0)).toBe(totalizar(dias, r).ventas)
  })
})

describe('otras ayudas del Panel', () => {
  it('meta del período = meta diaria × días', () => {
    expect(metaDelPeriodo(1_800_000, rangoDe('7d', HOY))).toBe(12_600_000)
    expect(metaDelPeriodo(0, rangoDe('30d', HOY))).toBe(0)
  })

  it('mejores días ordena de mayor a menor', () => {
    const d = [dia('2026-10-01', 300), dia('2026-10-02', 900), dia('2026-10-03', 100)]
    expect(mejoresDias(d, { desde: '2026-10-01', hasta: '2026-10-03' }, 2).map((x) => x.fecha)).toEqual(['2026-10-02', '2026-10-01'])
  })

  it('sabe si el rango incluye un día', () => {
    expect(incluyeDia({ desde: '2026-09-25', hasta: '2026-10-01' }, '2026-10-01')).toBe(true)
    expect(incluyeDia({ desde: '2026-09-01', hasta: '2026-09-30' }, '2026-10-01')).toBe(false)
  })

  it('el reparto por categoría suma (casi) las ventas y por producto devuelve los 5 mayores', () => {
    const porCat = repartirPorCategoria(1_000_000, productosIniciales.map((p, i) => ({ id: i + 1, categoriaId: p.categoriaId })), categorias)
    expect(Math.abs(porCat.reduce((s, c) => s + c.ventas, 0) - 1_000_000)).toBeLessThan(10) // redondeo de pesos
    const top = repartirPorProducto(1_000_000, productosIniciales)
    expect(top).toHaveLength(5)
    expect(top[0]!.unidades).toBeGreaterThanOrEqual(top[4]!.unidades)
  })
})
