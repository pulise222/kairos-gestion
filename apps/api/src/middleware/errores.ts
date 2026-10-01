import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ErrorApp } from '../errors.js'

export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
  next(new ErrorApp(404, 'RUTA_NO_ENCONTRADA', `No existe ${req.method} ${req.path}`))
}

/** Manejador global: todo error sale con el mismo formato JSON y SIN revelar detalles internos. */
export const manejarErrores: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ErrorApp) {
    res.status(err.estado).json({ error: { codigo: err.codigo, mensaje: err.message, detalles: err.detalles } })
    return
  }
  // JSON mal formado en el cuerpo de la petición
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido' } })
    return
  }
  // Cuerpo más grande que el límite (por ejemplo, una foto de más de 3 MB)
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { codigo: 'CUERPO_MUY_GRANDE', mensaje: 'El archivo es demasiado grande (máximo 3 MB)' } })
    return
  }
  // Cuerpo más grande que el límite (por ejemplo, una foto de más de 3 MB)
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { codigo: 'CUERPO_MUY_GRANDE', mensaje: 'El archivo es demasiado grande (máximo 3 MB)' } })
    return
  }
  // Violación de unicidad de Prisma que no se haya previsto
  const codigoPrisma = (err as { code?: string }).code
  if (codigoPrisma === 'P2002') {
    res.status(409).json({ error: { codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con ese valor' } })
    return
  }
  console.error(`[error] ${req.method} ${req.originalUrl}`, err) // el detalle va al log, nunca al cliente
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo' } })
}
