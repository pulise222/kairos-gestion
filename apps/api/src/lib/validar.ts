import type { ZodType } from 'zod'
import { ErrorApp } from '../errors.js'

/** Valida con Zod y, si falla, lanza un error 400 legible. SIEMPRE se valida en el backend, no solo en el formulario. */
export function validar<T>(esquema: ZodType<T>, datos: unknown): T {
  const r = esquema.safeParse(datos)
  if (!r.success) {
    const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }))
    throw new ErrorApp(400, 'DATOS_INVALIDOS', detalles.map((d) => (d.campo ? `${d.campo}: ${d.mensaje}` : d.mensaje)).join('; '), detalles)
  }
  return r.data
}
