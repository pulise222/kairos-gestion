import type { NextFunction, Request, RequestHandler, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ErrorApp } from '../errors.js'
import type { Prisma } from '../db.js'
import type { Rol } from '../generated/prisma/enums.js'

export interface UsuarioAuth {
  id: number
  nombre: string
  usuario: string
  rol: Rol
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAuth
    }
  }
}

export const DURACION_SESION = '12h'

export function firmarToken(secreto: string, u: UsuarioAuth) {
  return jwt.sign({ rol: u.rol }, secreto, { subject: String(u.id), expiresIn: DURACION_SESION })
}

/**
 * Exige un token válido. Además CONSULTA la base de datos en cada petición: así, si el dueño
 * desactiva a un vendedor o le cambia el rol, el cambio surte efecto de inmediato (no a las 12 h).
 */
export function autenticar(prisma: Prisma, secreto: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const cabecera = req.headers.authorization
    if (!cabecera?.startsWith('Bearer ')) throw new ErrorApp(401, 'NO_AUTENTICADO', 'Debes iniciar sesión')
    let id: number
    try {
      const payload = jwt.verify(cabecera.slice(7), secreto, { algorithms: ['HS256'] })
      id = Number(typeof payload === 'string' ? NaN : payload.sub)
    } catch {
      throw new ErrorApp(401, 'SESION_INVALIDA', 'Tu sesión expiró. Inicia sesión de nuevo')
    }
    const u = await prisma.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, usuario: true, rol: true, activo: true } })
    if (!u || !u.activo) throw new ErrorApp(401, 'SESION_INVALIDA', 'Tu sesión ya no es válida')
    req.usuario = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol }
    next()
  }
}

/** Restringe una ruta a ciertos roles. Se usa DESPUÉS de autenticar. */
export const requerirRol =
  (...roles: Rol[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.usuario) throw new ErrorApp(401, 'NO_AUTENTICADO', 'Debes iniciar sesión')
    if (!roles.includes(req.usuario.rol)) throw new ErrorApp(403, 'SIN_PERMISO', 'No tienes permiso para esta acción')
    next()
  }

/** Atajo para obtener el usuario autenticado dentro de un controlador. */
export function usuarioActual(req: Request): UsuarioAuth {
  if (!req.usuario) throw new ErrorApp(401, 'NO_AUTENTICADO', 'Debes iniciar sesión')
  return req.usuario
}
