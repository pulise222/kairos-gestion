import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { conflicto, noEncontrado, reglaDeNegocio } from '../errors.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { id, texto } from '../lib/esquemas.js'
import { contrasena, hashear, nombreUsuario } from './auth.js'

// Nunca se devuelve el hash de la contraseña.
const publico = { id: true, nombre: true, usuario: true, rol: true, activo: true, creadoEn: true } as const

export function rutasUsuarios(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO')) // HU-02: solo el dueño administra usuarios

  r.get('/', async (_req, res) => {
    res.json(await prisma.usuario.findMany({ select: publico, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }))
  })

  r.post('/', async (req, res) => {
    const d = validar(z.object({ nombre: texto(80), usuario: nombreUsuario, contrasena, rol: z.enum(['DUENO', 'VENDEDOR']).default('VENDEDOR') }), req.body)
    if (await prisma.usuario.findUnique({ where: { usuario: d.usuario } })) throw conflicto('USUARIO_EXISTE', 'Ese nombre de usuario ya está en uso')
    const u = await prisma.usuario.create({
      data: { nombre: d.nombre, usuario: d.usuario, contrasenaHash: await hashear(d.contrasena), rol: d.rol },
      select: publico,
    })
    res.status(201).json(u)
  })

  r.patch('/:id', async (req, res) => {
    const uid = validar(id, req.params.id)
    const d = validar(z.object({ nombre: texto(80), rol: z.enum(['DUENO', 'VENDEDOR']), activo: z.boolean() }).partial().strict(), req.body)
    const objetivo = await prisma.usuario.findUnique({ where: { id: uid } })
    if (!objetivo) throw noEncontrado('El usuario')

    const dejaDeSerDuenoActivo = objetivo.rol === 'DUENO' && objetivo.activo && (d.activo === false || d.rol === 'VENDEDOR')
    if (dejaDeSerDuenoActivo) {
      // Nunca puede quedar el sistema sin ningún dueño activo (nadie podría administrarlo).
      const otros = await prisma.usuario.count({ where: { rol: 'DUENO', activo: true, id: { not: uid } } })
      if (otros === 0) throw reglaDeNegocio('ULTIMO_DUENO', 'Debe quedar al menos un dueño activo')
    }
    if (uid === usuarioActual(req).id && d.activo === false) throw reglaDeNegocio('AUTO_DESACTIVACION', 'No puedes desactivar tu propia cuenta')

    res.json(await prisma.usuario.update({ where: { id: uid }, data: d, select: publico }))
  })

  // El dueño restablece la contraseña de un vendedor que la olvidó.
  r.post('/:id/restablecer-contrasena', async (req, res) => {
    const uid = validar(id, req.params.id)
    const d = validar(z.object({ nueva: contrasena }), req.body)
    if (!(await prisma.usuario.findUnique({ where: { id: uid } }))) throw noEncontrado('El usuario')
    await prisma.usuario.update({ where: { id: uid }, data: { contrasenaHash: await hashear(d.nueva) } })
    res.status(204).end()
  })

  return r
}
