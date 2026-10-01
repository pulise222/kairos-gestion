import { aTexto, deTexto } from '../lib/periodos'
import { resumenHoy } from './datos'

/* Historial de ventas por día para el prototipo. Es DETERMINISTA: el mismo día siempre da las mismas cifras
   (no cambia al recargar), así los filtros del Panel se pueden comparar y probar. En el sistema real sale de la API. */
export interface DiaVentas {
  fecha: string // AAAA-MM-DD
  ventas: number
  ganancia: number
  tickets: number
}

// Generador pseudoaleatorio con semilla (mulberry32): mismos números para la misma semilla.
function aleatorio(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Viernes y sábado se vende más; lunes menos (así se ve en una tienda de barrio).
const FACTOR_SEMANA = [0.9, 0.75, 0.8, 0.85, 0.95, 1.2, 1.45] // domingo a sábado

export function generarDias(hoy: Date, cantidad = 400): DiaVentas[] {
  const dias: DiaVentas[] = []
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = deTexto(aTexto(hoy))
    d.setDate(d.getDate() - i)
    const fecha = aTexto(d)
    const rnd = aleatorio(Number(fecha.replaceAll('-', '')))
    const tendencia = 1 + (cantidad - i) * 0.0004 // el negocio crece despacio
    const ventas = Math.round((1_000_000 * FACTOR_SEMANA[d.getDay()]! * tendencia * (0.88 + rnd() * 0.24)) / 100) * 100
    const ganancia = Math.round((ventas * (0.3 + rnd() * 0.04)) / 100) * 100
    const tickets = Math.max(1, Math.round(ventas / (23_000 + rnd() * 5_000)))
    dias.push({ fecha, ventas, ganancia, tickets })
  }
  // Hoy y ayer coinciden con las cifras que ya mostraba el Panel antes de tener filtros.
  const n = dias.length
  dias[n - 1] = { fecha: dias[n - 1]!.fecha, ventas: resumenHoy.ventas, ganancia: resumenHoy.ganancia, tickets: resumenHoy.tickets }
  dias[n - 2] = { fecha: dias[n - 2]!.fecha, ventas: resumenHoy.ventasAyer, ganancia: resumenHoy.gananciaAyer, tickets: resumenHoy.ticketsAyer }
  return dias
}
