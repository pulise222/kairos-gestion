/*
  Suma de montos escrita como en el cuaderno: «12000 + 9000 + 5500» o «12.000+9.000».
  Función PURA: devuelve el total o el motivo por el que no se entiende lo escrito.
  Solo pesos enteros; acepta puntos o espacios como separador de miles ($, espacios y puntos se ignoran).
*/
export type SumaMontos = { ok: true; total: number; partes: number[] } | { ok: false; error: string }

export const MAX_MONTO = 100_000_000

export function sumarMontos(texto: string): SumaMontos {
  const limpio = texto.replace(/\$/g, '').trim()
  if (limpio === '') return { ok: false, error: '' } // todavía no escribió nada: no es un error que mostrar
  const trozos = limpio.split('+').map((t) => t.trim())
  if (trozos.every((t) => t === '')) return { ok: false, error: '' } // solo «+»: todavía no escribió ningún valor
  const partes: number[] = []
  for (const [i, t] of trozos.entries()) {
    if (t === '') {
      // «12000+» (un + al final mientras se sigue escribiendo) no es un error: se ignora ese trozo vacío
      if (i === trozos.length - 1) continue
      return { ok: false, error: 'Hay un «+» de más' }
    }
    const digitos = t.replace(/[.\s]/g, '')
    if (!/^\d+$/.test(digitos)) return { ok: false, error: `«${t}» no es un valor válido (solo números)` }
    const n = Number(digitos)
    if (n > MAX_MONTO) return { ok: false, error: 'Ese valor es demasiado grande' }
    partes.push(n)
  }
  if (partes.length === 0) return { ok: false, error: '' }
  const total = partes.reduce((s, n) => s + n, 0)
  if (total > MAX_MONTO) return { ok: false, error: 'La suma es demasiado grande' }
  if (total <= 0) return { ok: false, error: 'El valor debe ser mayor que 0' }
  return { ok: true, total, partes }
}
