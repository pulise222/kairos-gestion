import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import { reglaDeNegocio } from '../errors.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { dinero } from '../lib/esquemas.js'
import { leerConfig } from './configuracion.js'

/*
  CIERRE DEL DÍA (cuadre de caja). Es el equivalente digital de la palabra que escribían al final del día en el cuaderno:
  «ya validé que el dinero cuadra con lo anotado».
    efectivo esperado = fondo inicial + ventas en efectivo − devoluciones pagadas en efectivo
    diferencia        = lo que se contó − lo esperado   (0 = cuadra; negativo = falta; positivo = sobra)
  El servidor calcula TODO desde las ventas reales: lo único que escribe la persona es el fondo inicial y el efectivo contado.
*/
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD')
const n = (v: unknown) => Number(v ?? 0)
const hoyEn = (zona: string, ahora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(ahora)
const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)

export interface ResumenDia {
  fecha: string
  hoy: string
  /** Ventas completadas menos devoluciones. */
  ventasNetas: number
  tickets: number
  porMedio: { EFECTIVO: number; TRANSFERENCIA: number; TARJETA: number }
  devuelto: { total: number; EFECTIVO: number; TRANSFERENCIA: number; TARJETA: number }
  /** Ventas en efectivo menos devoluciones pagadas en efectivo (sin el fondo inicial). */
  efectivoNeto: number
  porSeccion: { id: number; nombre: string; color: string; ventas: number }[]
}

export async function resumenDelDia(prisma: Prisma, fecha: string): Promise<ResumenDia> {
  const cfg = await leerConfig(prisma)
  const tz = cfg.zonaHoraria
  const inicio = PrismaRuntime.sql`((${fecha}::date)::timestamp AT TIME ZONE ${tz})`
  const fin = PrismaRuntime.sql`((((${fecha}::date) + 1))::timestamp AT TIME ZONE ${tz})`

  const [medios, devs, secciones] = await Promise.all([
    prisma.$queryRaw<{ medio: string; total: bigint; tickets: bigint }[]>(PrismaRuntime.sql`
      SELECT medio_pago::text AS medio, COALESCE(SUM(total), 0) AS total, COUNT(*) AS tickets
      FROM venta WHERE estado = 'COMPLETADA' AND creada_en >= ${inicio} AND creada_en < ${fin} GROUP BY medio_pago`),
    prisma.$queryRaw<{ medio: string; total: bigint }[]>(PrismaRuntime.sql`
      SELECT medio_reembolso::text AS medio, COALESCE(SUM(total), 0) AS total
      FROM devolucion WHERE creada_en >= ${inicio} AND creada_en < ${fin} GROUP BY medio_reembolso`),
    // Por sección y NETO de devoluciones (las que se devuelven restan en la sección del producto devuelto).
    prisma.$queryRaw<{ id: number; nombre: string; color: string; ventas: bigint }[]>(PrismaRuntime.sql`
      WITH movs AS (
        SELECT p.categoria_id, i.cantidad * i.precio_unitario AS monto
        FROM venta_item i JOIN venta v ON v.id = i.venta_id JOIN producto p ON p.id = i.producto_id
        WHERE v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio} AND v.creada_en < ${fin}
        UNION ALL
        SELECT p.categoria_id, -di.cantidad * di.precio_unitario
        FROM devolucion_item di JOIN devolucion dv ON dv.id = di.devolucion_id JOIN producto p ON p.id = di.producto_id
        WHERE dv.creada_en >= ${inicio} AND dv.creada_en < ${fin}
      )
      SELECT c.id, c.nombre, c.color, SUM(m.monto) AS ventas FROM movs m JOIN categoria c ON c.id = m.categoria_id
      GROUP BY c.id, c.nombre, c.color HAVING SUM(m.monto) <> 0 ORDER BY SUM(m.monto) DESC, c.nombre`),
  ])
  const porMedio = { EFECTIVO: 0, TRANSFERENCIA: 0, TARJETA: 0 }
  let tickets = 0
  for (const m of medios) { porMedio[m.medio as keyof typeof porMedio] = n(m.total); tickets += n(m.tickets) }
  const devuelto = { total: 0, EFECTIVO: 0, TRANSFERENCIA: 0, TARJETA: 0 }
  for (const d of devs) { devuelto[d.medio as 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'] = n(d.total); devuelto.total += n(d.total) }
  const bruto = porMedio.EFECTIVO + porMedio.TRANSFERENCIA + porMedio.TARJETA
  return {
    fecha, hoy: hoyEn(tz), ventasNetas: bruto - devuelto.total, tickets, porMedio, devuelto,
    efectivoNeto: porMedio.EFECTIVO - devuelto.EFECTIVO,
    porSeccion: secciones.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color, ventas: n(s.ventas) })),
  }
}

const formato = (c: { fecha: Date; [k: string]: unknown }) => ({ ...c, fecha: c.fecha.toISOString().slice(0, 10) })

export function rutasCierres(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO'))

  // Resumen del día (por defecto, hoy) y el cierre ya guardado de ese día, si hay.
  r.get('/resumen', async (req, res) => {
    const tz = (await leerConfig(prisma)).zonaHoraria
    const q = validar(z.object({ fecha: FECHA.optional() }), req.query)
    const fecha = q.fecha ?? hoyEn(tz)
    const resumen = await resumenDelDia(prisma, fecha)
    const cierre = await prisma.cierreCaja.findUnique({ where: { fecha: new Date(`${fecha}T00:00:00Z`) } })
    res.json({ ...resumen, cierre: cierre ? formato(cierre) : null })
  })

  // Guarda (o vuelve a guardar) el cierre de un día. Lo esperado lo calcula el servidor, nunca viene del formulario.
  r.post('/', async (req, res) => {
    const yo = usuarioActual(req)
    const tz = (await leerConfig(prisma)).zonaHoraria
    const hoy = hoyEn(tz)
    const d = validar(z.object({ fecha: FECHA.optional(), fondoInicial: dinero.default(0), efectivoContado: dinero, nota: z.string().trim().max(300).optional() }), req.body)
    const fecha = d.fecha ?? hoy
    if (fecha > hoy) throw reglaDeNegocio('FECHA_FUTURA', 'No se puede cerrar un día que todavía no llega')
    if (diasEntre(hoy, fecha) > 31) throw reglaDeNegocio('FECHA_MUY_ANTIGUA', 'Solo se pueden cerrar los últimos 31 días')

    const resumen = await resumenDelDia(prisma, fecha)
    const esperado = d.fondoInicial + resumen.efectivoNeto
    const datos = {
      fondoInicial: d.fondoInicial, efectivoEsperado: esperado, efectivoContado: d.efectivoContado, diferencia: d.efectivoContado - esperado,
      totalVentas: resumen.ventasNetas, tickets: resumen.tickets, nota: d.nota || null, usuarioId: yo.id,
    }
    const dia = new Date(`${fecha}T00:00:00Z`)
    const cierre = await prisma.cierreCaja.upsert({ where: { fecha: dia }, create: { fecha: dia, ...datos }, update: datos })
    res.status(201).json({ ...resumen, cierre: formato(cierre) })
  })

  // Historial de cierres (los más recientes primero).
  r.get('/', async (req, res) => {
    const q = validar(z.object({ limite: z.coerce.number().int().min(1).max(100).default(30) }), req.query)
    const lista = await prisma.cierreCaja.findMany({ orderBy: { fecha: 'desc' }, take: q.limite })
    res.json(lista.map(formato))
  })

  return r
}
