import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'

/* Comentarios y sugerencias de quien usa el sistema (botón «Enviar comentario»). Cualquiera escribe; solo el dueño los lee. */
export function rutasComentarios(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  r.post('/', async (req, res) => {
    const yo = usuarioActual(req)
    const d = validar(z.object({ texto: z.string().trim().min(3, 'Escribe tu comentario').max(1000), pantalla: z.string().trim().max(60).optional() }), req.body)
    const c = await prisma.comentario.create({ data: { texto: d.texto, pantalla: d.pantalla || null, usuarioId: yo.id } })
    res.status(201).json({ id: c.id })
  })

  r.get('/', requerirRol('DUENO'), async (_req, res) => {
    const lista = await prisma.comentario.findMany({ orderBy: { creadoEn: 'desc' }, take: 500, include: { usuario: { select: { nombre: true } } } })
    res.json(lista.map((c) => ({ id: c.id, texto: c.texto, pantalla: c.pantalla, creadoEn: c.creadoEn, usuario: c.usuario.nombre })))
  })

  // Todos los comentarios en un archivo de texto (para mandarlo o imprimirlo al terminar la semana de prueba).
  r.get('/descargar', requerirRol('DUENO'), async (_req, res) => {
    const lista = await prisma.comentario.findMany({ orderBy: { creadoEn: 'asc' }, include: { usuario: { select: { nombre: true } } } })
    const fmt = (d: Date) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }).format(d)
    const texto = [
      'COMENTARIOS Y SUGERENCIAS', '=========================', '',
      ...(lista.length ? lista.map((c, i) => `${i + 1}. [${fmt(c.creadoEn)}]${c.pantalla ? ` (${c.pantalla})` : ''}\n   ${c.texto}\n`) : ['(Todavía no hay comentarios)']),
    ].join('\n')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="comentarios.txt"')
    res.send('﻿' + texto)
  })

  return r
}
