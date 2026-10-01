/*
  Tamaño de la letra de TODO el sistema (para quien ve mejor con letra grande). Se guarda en este equipo.
  Como el diseño usa «rem», cambiar el tamaño base agranda por igual textos, botones y espacios.
*/
export type TamanoLetra = 'normal' | 'grande' | 'muy-grande'

export const TAMANOS: { id: TamanoLetra; nombre: string; px: number }[] = [
  { id: 'normal', nombre: 'Normal', px: 16 },
  { id: 'grande', nombre: 'Grande', px: 18.5 },
  { id: 'muy-grande', nombre: 'Muy grande', px: 21 },
]

const CLAVE = 'kairos-letra'
export const TAMANO_POR_DEFECTO: TamanoLetra = 'grande'

export const esTamano = (v: unknown): v is TamanoLetra => TAMANOS.some((t) => t.id === v)

export function leerTamano(): TamanoLetra {
  try {
    const v = localStorage.getItem(CLAVE)
    return esTamano(v) ? v : TAMANO_POR_DEFECTO
  } catch {
    return TAMANO_POR_DEFECTO
  }
}

export function aplicarTamano(t: TamanoLetra) {
  document.documentElement.style.fontSize = `${TAMANOS.find((x) => x.id === t)!.px}px`
  try { localStorage.setItem(CLAVE, t) } catch { /* sin almacenamiento: dura hasta recargar */ }
}

/** El siguiente tamaño (vuelve al primero después del último). */
export function siguienteTamano(t: TamanoLetra): TamanoLetra {
  const i = TAMANOS.findIndex((x) => x.id === t)
  return TAMANOS[(i + 1) % TAMANOS.length]!.id
}
