import { createReadStream } from 'node:fs'
import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { autenticar, requerirRol } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { mkdir } from 'node:fs/promises'
import { reglaDeNegocio } from '../errors.js'
import { enviarReporte, libroDeRespaldo, marcarReporteEnviado } from '../lib/reporte.js'
import type { ConfigCorreo } from '../lib/reporte.js'
import type { Transporter } from 'nodemailer'
import { crearCopia, listarCopias, restaurarCopia, rutaDeCopia } from '../lib/copias.js'
import type { Opciones } from '../lib/copias.js'

/* Copias de seguridad (solo el dueño). El trabajo pesado vive en lib/copias.ts. */
export function rutasCopias(prisma: Prisma, secreto: string, base: Omit<Opciones, 'prisma'>, correo: ConfigCorreo | null = null, transporte?: Transporter) {
  const o: Opciones = { prisma, ...base }
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO'))

  r.get('/', async (_req, res) => {
    res.json({ copias: await listarCopias(o.carpeta, o.zona), copiaExtraConfigurada: !!o.carpetaExtra, correoConfigurado: !!correo, correoPara: correo?.para ?? [] })
  })

  r.post('/', async (_req, res) => {
    res.status(201).json(await crearCopia(o, 'manual'))
  })

  // Envía ahora el reporte semanal (Excel + copia) a los correos configurados en el servidor.
  r.post('/reporte', async (_req, res) => {
    if (!correo) throw reglaDeNegocio('CORREO_NO_CONFIGURADO', 'El envío por correo no está configurado en el servidor (SMTP_HOST, SMTP_USER, SMTP_PASS y REPORTE_PARA).')
    const r = await enviarReporte({ prisma, copias: o, correo, transporte })
    await mkdir(o.carpeta, { recursive: true })
    await marcarReporteEnviado(o.carpeta)
    res.json(r)
  })

  // Excel con los últimos 30 días (ventas, por sección, cierres, catálogo con precios): se descarga a demanda.
  r.get('/excel', async (_req, res) => {
    const { libro, hasta } = await libroDeRespaldo(prisma, 30)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="respaldo-${hasta}.xlsx"`)
    res.send(libro)
  })

  r.get('/:nombre/descargar', async (req, res) => {
    const ruta = rutaDeCopia(o.carpeta, String(req.params.nombre))
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${String(req.params.nombre)}"`)
    createReadStream(ruta).on('error', () => res.destroy()).pipe(res)
  })

  // Restaurar es destructivo: el cuerpo debe traer la palabra de confirmación (el front la pide escribir).
  r.post('/:nombre/restaurar', async (req, res) => {
    validar(z.object({ confirmacion: z.literal('RESTAURAR') }), req.body)
    res.json(await restaurarCopia(o, String(req.params.nombre)))
  })

  return r
}
