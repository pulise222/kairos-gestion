import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { ErrorApp, conflicto } from '../errors.js'
import { validar } from '../lib/validar.js'
import { texto } from '../lib/esquemas.js'
import { autenticar, firmarToken, usuarioActual } from '../middleware/auth.js'

const COSTO_BCRYPT = 12
// Hash de relleno: si el usuario no existe igual hacemos una comparación, para que el tiempo de
// respuesta no delate qué usuarios existen.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-es-una-contrasena', COSTO_BCRYPT)

export const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100)
export const nombreUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, 'Usuario de 3 a 30 caracteres: letras, números, punto, guion o guion bajo')

export const hashear = (clave: string) => bcrypt.hash(clave, COSTO_BCRYPT)

interface Opciones {
  prisma: Prisma
  secreto: string
  /** En las pruebas automáticas se desactiva el límite de intentos. */
  limitarIntentos?: boolean
}

export function rutasAuth({ prisma, secreto, limitarIntentos = true }: Opciones) {
  const r = Router()
  const exigeSesion = autenticar(prisma, secreto)

  // Máximo 10 intentos de login fallidos cada 15 minutos por IP (frena la fuerza bruta).
  const limite = limitarIntentos
    ? rateLimit({
        windowMs: 15 * 60_000,
        limit: 10,
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos. Espera unos minutos' } },
      })
    : (_q: unknown, _s: unknown, n: () => void) => n()

  // ── Primer arranque: crea el dueño. Solo funciona mientras NO exista ningún usuario. ──
  r.get('/setup/estado', async (_req, res) => {
    res.json({ necesitaSetup: (await prisma.usuario.count()) === 0 })
  })

  r.post('/setup', async (req, res) => {
    const d = validar(z.object({ nombre: texto(80), usuario: nombreUsuario, contrasena, nombreNegocio: texto(80).optional() }), req.body)
    const hash = await hashear(d.contrasena)
    const u = await prisma.$transaction(async (tx) => {
      // Candado de la transacción: si dos peticiones llegan a la vez, la segunda espera y luego ve que ya hay dueño.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7001)`
      if ((await tx.usuario.count()) > 0) throw conflicto('SETUP_YA_HECHO', 'El sistema ya fue configurado')
      const creado = await tx.usuario.create({ data: { nombre: d.nombre, usuario: d.usuario, contrasenaHash: hash, rol: 'DUENO' } })
      if (d.nombreNegocio) {
        await tx.configuracion.upsert({
          where: { clave: 'nombreNegocio' },
          create: { clave: 'nombreNegocio', valor: d.nombreNegocio },
          update: { valor: d.nombreNegocio },
        })
      }
      return creado
    })
    const auth = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol }
    res.status(201).json({ token: firmarToken(secreto, auth), usuario: auth })
  })

  r.post('/auth/login', limite, async (req, res) => {
    const d = validar(z.object({ usuario: z.string().trim().toLowerCase().min(1), contrasena: z.string().min(1) }), req.body)
    const u = await prisma.usuario.findUnique({ where: { usuario: d.usuario } })
    const ok = await bcrypt.compare(d.contrasena, u?.contrasenaHash ?? HASH_RELLENO)
    // Mismo mensaje para "no existe", "clave mala" y "desactivado": no regalamos pistas.
    if (!u || !ok || !u.activo) throw new ErrorApp(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos')
    const auth = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol }
    res.json({ token: firmarToken(secreto, auth), usuario: auth })
  })

  r.get('/auth/yo', exigeSesion, (req, res) => {
    res.json({ usuario: usuarioActual(req) })
  })

  r.patch('/auth/contrasena', exigeSesion, async (req, res) => {
    const yo = usuarioActual(req)
    const d = validar(z.object({ actual: z.string().min(1), nueva: contrasena }), req.body)
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: yo.id } })
    if (!(await bcrypt.compare(d.actual, u.contrasenaHash))) {
      throw new ErrorApp(422, 'CONTRASENA_ACTUAL_INCORRECTA', 'La contraseña actual no es correcta')
    }
    await prisma.usuario.update({ where: { id: yo.id }, data: { contrasenaHash: await hashear(d.nueva) } })
    res.status(204).end()
  })

  return r
}
