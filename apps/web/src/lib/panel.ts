import { claveGrupo, deTexto, diasDelRango, diasEnRango } from './periodos'
import type { Granularidad, PeriodoId, Rango } from './periodos'
import type { DiaVentas } from '../mock/ventasDiarias'

/*
  Cálculos del Panel sobre una lista de días. Funciones PURAS (fáciles de probar).
  En el sistema real el backend hace estas sumas con SQL; aquí solo alimentan el prototipo y definen
  el comportamiento esperado (por ejemplo, que los días sin ventas cuenten como 0 en la gráfica).
*/
export interface Totales {
  ventas: number
  ganancia: number
  tickets: number
  ticketPromedio: number
  /** Dinero devuelto a clientes en el período (ya está restado de ventas y ganancia). */
  devuelto?: number
}

const enRango = (d: DiaVentas, r: Rango) => d.fecha >= r.desde && d.fecha <= r.hasta

export function totalizar(dias: DiaVentas[], r: Rango): Totales {
  const sel = dias.filter((d) => enRango(d, r))
  const ventas = sel.reduce((s, d) => s + d.ventas, 0)
  const tickets = sel.reduce((s, d) => s + d.tickets, 0)
  return { ventas, ganancia: sel.reduce((s, d) => s + d.ganancia, 0), tickets, ticketPromedio: tickets ? Math.round(ventas / tickets) : 0 }
}

/** Variación porcentual contra el período anterior. null si no hay con qué comparar (anterior = 0). */
export const variacion = (actual: number, anterior: number): number | null => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null)

/** La meta de un período es la meta diaria por la cantidad de días. */
export const metaDelPeriodo = (metaDiaria: number, r: Rango) => metaDiaria * diasEnRango(r)

export interface PuntoSerie {
  clave: string
  ventas: number
  ganancia: number
}

/**
 * Serie para la gráfica, agrupada por día, semana (lunes) o mes. Los días SIN datos se incluyen como 0:
 * si no, la gráfica "salta" los días sin ventas y engaña.
 */
export function serie(dias: DiaVentas[], r: Rango, g: Granularidad): PuntoSerie[] {
  const porDia = new Map(dias.map((d) => [d.fecha, d]))
  const grupos = new Map<string, PuntoSerie>()
  for (const dia of diasDelRango(r)) {
    const clave = claveGrupo(dia, g)
    const g0 = grupos.get(clave) ?? { clave, ventas: 0, ganancia: 0 }
    const d = porDia.get(dia)
    g0.ventas += d?.ventas ?? 0
    g0.ganancia += d?.ganancia ?? 0
    grupos.set(clave, g0)
  }
  return [...grupos.values()].sort((a, b) => a.clave.localeCompare(b.clave))
}

/** Los N mejores días del rango por ventas. */
export const mejoresDias = (dias: DiaVentas[], r: Rango, n = 3) => dias.filter((d) => enRango(d, r)).sort((a, b) => b.ventas - a.ventas).slice(0, n)

/** ¿El rango incluye el día de hoy? (para saber si tiene sentido mostrar «últimas ventas»). */
export const incluyeDia = (r: Rango, dia: string) => dia >= r.desde && dia <= r.hasta

const COMPARACION: Record<PeriodoId, string> = {
  hoy: 'vs ayer',
  ayer: 'vs el día anterior',
  '7d': 'vs los 7 días anteriores',
  '30d': 'vs los 30 días anteriores',
  mes: 'vs el mismo tramo del mes pasado',
  mesPasado: 'vs el mes anterior',
  personalizado: 'vs el período anterior',
}
export const textoComparacion = (id: PeriodoId) => COMPARACION[id]

export const nombreDia = (fecha: string) => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short' }).format(deTexto(fecha))

/*
  Reparto de ejemplo: con las ventas del período se inventa cuánto corresponde a cada producto/categoría,
  con pesos fijos (el mismo producto siempre pesa lo mismo). El backend real los calcula con SQL sobre las ventas.
*/
const peso = (id: number) => ((id * 37) % 11) + 3

export function repartirPorProducto<T extends { id: number; nombre: string; precio: number }>(ventas: number, productos: T[], n = 5) {
  const total = productos.reduce((s, p) => s + peso(p.id), 0)
  return productos
    .map((p) => {
      const ingresos = Math.round((ventas * peso(p.id)) / total)
      return { id: p.id, nombre: p.nombre, ingresos, unidades: Math.round(ingresos / p.precio) }
    })
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, n)
}

export function repartirPorCategoria<P extends { id: number; categoriaId: string }, C extends { id: string; nombre: string; color: string }>(ventas: number, productos: P[], categorias: C[]) {
  const total = productos.reduce((s, p) => s + peso(p.id), 0)
  return categorias
    .map((c) => ({ id: c.id, nombre: c.nombre, color: c.color, ventas: Math.round((ventas * productos.filter((p) => p.categoriaId === c.id).reduce((s, p) => s + peso(p.id), 0)) / total) }))
    .filter((c) => c.ventas > 0)
    .sort((a, b) => b.ventas - a.ventas)
}
