/*
  Períodos del Panel. Todo se maneja por DÍAS completos (de 00:00 a 23:59), no por horas:
  un rango es [desde, hasta] con ambos días INCLUIDOS. Las fechas se escriben como "AAAA-MM-DD" para
  no depender de zonas horarias al viajar entre el front y la API (la API las interpreta en la hora del negocio).
*/
export type PeriodoId = 'hoy' | 'ayer' | '7d' | '30d' | 'mes' | 'mesPasado' | 'personalizado'

export interface Rango {
  desde: string // AAAA-MM-DD
  hasta: string // AAAA-MM-DD
}

export const PERIODOS: { id: PeriodoId; nombre: string }[] = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'ayer', nombre: 'Ayer' },
  { id: '7d', nombre: '7 días' },
  { id: '30d', nombre: '30 días' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mesPasado', nombre: 'Mes pasado' },
  { id: 'personalizado', nombre: 'Personalizado' },
]

export const MAX_DIAS_PERSONALIZADO = 366

const dosDigitos = (n: number) => String(n).padStart(2, '0')
export const aTexto = (d: Date) => `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
/** "2026-10-01" → Date a las 12:00 locales (mediodía: evita saltos de día por cambios de horario). */
export const deTexto = (t: string) => {
  const [a, m, d] = t.split('-').map(Number)
  return new Date(a!, m! - 1, d!, 12)
}
const sumarDias = (t: string, n: number) => {
  const d = deTexto(t)
  d.setDate(d.getDate() + n)
  return aTexto(d)
}
const primerDiaMes = (t: string) => t.slice(0, 7) + '-01'
const ultimoDiaDelMes = (anio: number, mes1a12: number) => new Date(anio, mes1a12, 0).getDate()

/** Cantidad de días del rango, contando ambos extremos. */
export const diasEnRango = (r: Rango) => Math.round((deTexto(r.hasta).getTime() - deTexto(r.desde).getTime()) / 86_400_000) + 1

/** Convierte el período elegido en un rango de fechas. `hoy` se recibe como parámetro para poder probarlo. */
export function rangoDe(id: PeriodoId, hoy: Date, personalizado?: Rango): Rango {
  const h = aTexto(hoy)
  switch (id) {
    case 'hoy': return { desde: h, hasta: h }
    case 'ayer': { const a = sumarDias(h, -1); return { desde: a, hasta: a } }
    case '7d': return { desde: sumarDias(h, -6), hasta: h } // hoy + los 6 días anteriores
    case '30d': return { desde: sumarDias(h, -29), hasta: h }
    case 'mes': return { desde: primerDiaMes(h), hasta: h } // del 1.º a hoy
    case 'mesPasado': {
      const finMesAnt = sumarDias(primerDiaMes(h), -1)
      return { desde: primerDiaMes(finMesAnt), hasta: finMesAnt }
    }
    case 'personalizado': return personalizado ?? { desde: h, hasta: h }
  }
}

/**
 * Período contra el que se compara ("vs período anterior"):
 *  - Este mes      → los mismos días del mes anterior (1 al 15 de oct vs 1 al 15 de sept).
 *  - Mes pasado    → el mes anterior a ese.
 *  - Los demás     → el tramo de igual duración inmediatamente anterior (7 días vs los 7 de antes).
 */
export function rangoAnterior(id: PeriodoId, r: Rango): Rango {
  if (id === 'mes') {
    const finMesAnt = sumarDias(primerDiaMes(r.desde), -1)
    const [a, m] = finMesAnt.split('-').map(Number)
    const dia = Math.min(deTexto(r.hasta).getDate(), ultimoDiaDelMes(a!, m!)) // 31 de marzo → 28 de febrero
    return { desde: primerDiaMes(finMesAnt), hasta: `${a}-${dosDigitos(m!)}-${dosDigitos(dia)}` }
  }
  if (id === 'mesPasado') {
    const finAnt = sumarDias(r.desde, -1)
    return { desde: primerDiaMes(finAnt), hasta: finAnt }
  }
  const n = diasEnRango(r)
  return { desde: sumarDias(r.desde, -n), hasta: sumarDias(r.desde, -1) }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** Texto para mostrar el rango: "1 oct 2026", "25 sept – 1 oct 2026". */
export function etiquetaRango(r: Rango): string {
  // Abreviaturas propias: así el texto es igual en cualquier navegador (Intl varía según la versión).
  const f = (t: string, anio: boolean) => {
    const d = deTexto(t)
    return `${d.getDate()} ${MESES[d.getMonth()]}${anio ? ' ' + d.getFullYear() : ''}`
  }
  if (r.desde === r.hasta) return f(r.desde, true)
  const mismoAnio = r.desde.slice(0, 4) === r.hasta.slice(0, 4)
  return `${f(r.desde, !mismoAnio)} – ${f(r.hasta, true)}`
}

/** Valida un rango personalizado. Devuelve el mensaje de error, o null si está bien. */
export function validarPersonalizado(r: Rango, hoy: Date): string | null {
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(r.desde) || !re.test(r.hasta)) return 'Elige las dos fechas'
  if (r.desde > r.hasta) return 'La fecha inicial debe ser anterior a la final'
  if (r.hasta > aTexto(hoy)) return 'No se puede consultar el futuro'
  if (diasEnRango(r) > MAX_DIAS_PERSONALIZADO) return `El rango máximo es de ${MAX_DIAS_PERSONALIZADO} días`
  return null
}

/** Todos los días del rango, de uno en uno. */
export function diasDelRango(r: Rango): string[] {
  const dias: string[] = []
  for (let d = r.desde; d <= r.hasta; d = sumarDias(d, 1)) dias.push(d)
  return dias
}

export type Granularidad = 'dia' | 'semana' | 'mes'

/** Para que la gráfica no se llene de puntos: hasta 62 días va por día; luego por semana; más de ~6 meses, por mes. */
export const granularidadPara = (dias: number): Granularidad => (dias <= 62 ? 'dia' : dias <= 190 ? 'semana' : 'mes')

/** Clave del grupo al que pertenece un día: el propio día, el lunes de su semana o el 1.º de su mes. */
export function claveGrupo(dia: string, g: Granularidad): string {
  if (g === 'dia') return dia
  if (g === 'mes') return primerDiaMes(dia)
  const d = deTexto(dia)
  const retroceso = (d.getDay() + 6) % 7 // lunes = 0
  return sumarDias(dia, -retroceso)
}
