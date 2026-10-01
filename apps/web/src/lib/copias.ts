/* Reglas de las copias de seguridad como funciones puras (fáciles de probar). */
export interface Copia {
  id: number
  fecha: Date
  tamanoMB: number
  tipo: 'automatica' | 'manual'
  destino: string
}

/** Rotación: se conservan solo las últimas N copias (las más recientes) y se descartan las más viejas. */
export function rotar(copias: Copia[], conservar: number): Copia[] {
  return [...copias].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, Math.max(conservar, 1))
}

export interface EstadoCopia {
  nivel: 'ok' | 'warn' | 'bad'
  texto: string
}

const HORA = 3_600_000

/**
 * Semáforo de la barra superior:
 *  verde  → hay una copia de las últimas 30 horas (la diaria del PC encendido)
 *  ámbar  → la última tiene entre 30 y 72 horas (se olvidó un día o el PC estuvo apagado)
 *  rojo   → más de 72 horas o ninguna: el negocio está en riesgo de perder datos
 */
export function estadoCopia(copias: Copia[], ahora: Date): EstadoCopia {
  if (copias.length === 0) return { nivel: 'bad', texto: 'Sin copias de seguridad' }
  const ultima = Math.max(...copias.map((c) => c.fecha.getTime()))
  const horas = (ahora.getTime() - ultima) / HORA
  if (horas <= 30) return { nivel: 'ok', texto: 'Copia al día' }
  if (horas <= 72) return { nivel: 'warn', texto: 'Copia atrasada' }
  return { nivel: 'bad', texto: 'Sin copia reciente' }
}
