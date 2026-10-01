import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import { reglaDeNegocio } from '../errors.js'
import { autenticar, requerirRol } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { leerConfig } from './configuracion.js'

/*
  PANEL (HU-21 a HU-24). Solo el dueño. Todas las cifras salen de ventas COMPLETADAS (las anuladas no cuentan)
  y son NETAS de devoluciones: lo que un cliente devolvió se resta el día en que se le devolvió el dinero.

  Se consulta por RANGO DE DÍAS completos [desde, hasta] (ambos incluidos), escritos "AAAA-MM-DD".
  Los días se interpretan en la zona horaria del NEGOCIO (América/Bogotá), no en UTC: una venta a las
  8 p. m. en Colombia es del mismo día aunque en UTC ya sea "mañana".

  Ganancia = Σ (precio_unitario − costo_unitario) × cantidad, con los valores COPIADOS al vender,
  menos la misma cuenta sobre lo devuelto.
*/

export const MAX_DIAS = 366

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').refine((s) => !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s), 'Fecha inexistente')

const consulta = z
  .object({ desde: fecha.optional(), hasta: fecha.optional(), compararDesde: fecha.optional(), compararHasta: fecha.optional() })
  .refine((q) => (q.desde === undefined) === (q.hasta === undefined), { message: 'Indica "desde" y "hasta" juntos', path: ['desde'] })
  .refine((q) => (q.compararDesde === undefined) === (q.compararHasta === undefined), { message: 'Indica "compararDesde" y "compararHasta" juntos', path: ['compararDesde'] })

// Los agregados de SQL llegan como bigint/decimal; los convertimos a número normal.
const n = (v: unknown) => Number(v ?? 0)

const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000) + 1
const sumarDias = (d: string, k: number) => new Date(Date.parse(`${d}T12:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10)

function validarRango(desde: string, hasta: string, hoy: string, etiqueta: string, permitirFuturo = false) {
  if (desde > hasta) throw reglaDeNegocio('RANGO_INVERTIDO', `${etiqueta}: la fecha inicial debe ser anterior o igual a la final`)
  if (!permitirFuturo && hasta > hoy) throw reglaDeNegocio('RANGO_FUTURO', `${etiqueta}: no se puede consultar el futuro`)
  if (diasEntre(desde, hasta) > MAX_DIAS) throw reglaDeNegocio('RANGO_MUY_LARGO', `${etiqueta}: el máximo es de ${MAX_DIAS} días`)
}

export function rutasPanel(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO'))

  r.get('/resumen', async (req, res) => {
    const q = validar(consulta, req.query)
    const config = await leerConfig(prisma)
    const tz = config.zonaHoraria

    const filas = await prisma.$queryRaw<{ hoy: string }[]>(PrismaRuntime.sql`SELECT to_char((now() AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS hoy`)
    const hoy = filas[0]!.hoy
    const desde = q.desde ?? hoy
    const hasta = q.hasta ?? hoy
    validarRango(desde, hasta, hoy, 'Rango')

    // Si no se pide un período de comparación, se usa el tramo de igual duración inmediatamente anterior
    // (hoy vs ayer, 7 días vs los 7 anteriores...).
    const dias = diasEntre(desde, hasta)
    const compDesde = q.compararDesde ?? sumarDias(desde, -dias)
    const compHasta = q.compararHasta ?? sumarDias(desde, -1)
    validarRango(compDesde, compHasta, hoy, 'Comparación')

    // Un día "AAAA-MM-DD" → instante exacto en que empieza (o termina, exclusivo) ese día EN LA ZONA DEL NEGOCIO.
    const inicio = (d: string) => PrismaRuntime.sql`((${d}::date)::timestamp AT TIME ZONE ${tz})`
    const finExclusivo = (d: string) => PrismaRuntime.sql`((((${d}::date) + 1))::timestamp AT TIME ZONE ${tz})`

    // Ventas, ganancia y número de ventas de un rango de días, NETOS de devoluciones.
    const totales = async (d: string, h: string) => {
      const [v] = await prisma.$queryRaw<{ ventas: bigint; ganancia: bigint; tickets: bigint }[]>(PrismaRuntime.sql`
        SELECT
          COALESCE(SUM(v.total), 0) AS ventas,
          COALESCE(SUM((SELECT SUM((i.precio_unitario - i.costo_unitario) * i.cantidad) FROM venta_item i WHERE i.venta_id = v.id)), 0) AS ganancia,
          COUNT(*) AS tickets
        FROM venta v
        WHERE v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio(d)} AND v.creada_en < ${finExclusivo(h)}`)
      // Las devoluciones cuentan el día en que se devolvió el dinero (aunque la venta sea de otro día).
      const [dv] = await prisma.$queryRaw<{ devuelto: bigint; ganancia: bigint }[]>(PrismaRuntime.sql`
        SELECT
          COALESCE(SUM(dv.total), 0) AS devuelto,
          COALESCE(SUM((SELECT SUM((di.precio_unitario - di.costo_unitario) * di.cantidad) FROM devolucion_item di WHERE di.devolucion_id = dv.id)), 0) AS ganancia
        FROM devolucion dv
        WHERE dv.creada_en >= ${inicio(d)} AND dv.creada_en < ${finExclusivo(h)}`)
      const devuelto = n(dv?.devuelto)
      const ventas = n(v?.ventas) - devuelto
      const tickets = n(v?.tickets)
      return { desde: d, hasta: h, dias: diasEntre(d, h), ventas, devuelto, ganancia: n(v?.ganancia) - n(dv?.ganancia), tickets, ticketPromedio: tickets ? Math.round(ventas / tickets) : 0 }
    }

    const [periodo, comparacion, serie, serieDevoluciones, masVendidos, porCategoria, stockBajo, ultimas] = await Promise.all([
      totales(desde, hasta),
      totales(compDesde, compHasta),

      // Ventas por día: generate_series asegura que los días SIN ventas aparezcan en 0 (la gráfica no tiene huecos).
      prisma.$queryRaw<{ dia: string; ventas: bigint; ganancia: bigint }[]>(PrismaRuntime.sql`
        WITH dias AS (SELECT generate_series(${desde}::date, ${hasta}::date, interval '1 day')::date AS dia)
        SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
               COALESCE(SUM(v.total), 0) AS ventas,
               COALESCE(SUM((SELECT SUM((i.precio_unitario - i.costo_unitario) * i.cantidad) FROM venta_item i WHERE i.venta_id = v.id)), 0) AS ganancia
        FROM dias d
        LEFT JOIN venta v ON v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio(desde)} AND v.creada_en < ${finExclusivo(hasta)}
                          AND (v.creada_en AT TIME ZONE ${tz})::date = d.dia
        GROUP BY d.dia ORDER BY d.dia`),

      // Lo devuelto por día (se resta de la serie).
      prisma.$queryRaw<{ dia: string; devuelto: bigint; ganancia: bigint }[]>(PrismaRuntime.sql`
        SELECT to_char((dv.creada_en AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS dia,
               SUM(dv.total) AS devuelto,
               SUM((SELECT SUM((di.precio_unitario - di.costo_unitario) * di.cantidad) FROM devolucion_item di WHERE di.devolucion_id = dv.id)) AS ganancia
        FROM devolucion dv
        WHERE dv.creada_en >= ${inicio(desde)} AND dv.creada_en < ${finExclusivo(hasta)}
        GROUP BY 1`),

      // Más vendidos del rango: unidades vendidas MENOS unidades devueltas (UNION de ambos movimientos).
      prisma.$queryRaw<{ producto_id: number; nombre: string; unidades: bigint; ingresos: bigint }[]>(PrismaRuntime.sql`
        WITH movs AS (
          SELECT i.producto_id, i.nombre_producto AS nombre, i.cantidad AS u, i.cantidad * i.precio_unitario AS ing
          FROM venta_item i JOIN venta v ON v.id = i.venta_id JOIN producto pp ON pp.id = i.producto_id AND NOT pp.es_sistema
          WHERE v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio(desde)} AND v.creada_en < ${finExclusivo(hasta)}
          UNION ALL
          SELECT di.producto_id, di.nombre_producto, -di.cantidad, -di.cantidad * di.precio_unitario
          FROM devolucion_item di JOIN devolucion dv ON dv.id = di.devolucion_id JOIN producto pd ON pd.id = di.producto_id AND NOT pd.es_sistema
          WHERE dv.creada_en >= ${inicio(desde)} AND dv.creada_en < ${finExclusivo(hasta)}
        )
        SELECT producto_id, nombre, SUM(u) AS unidades, SUM(ing) AS ingresos FROM movs
        GROUP BY producto_id, nombre HAVING SUM(u) > 0 ORDER BY unidades DESC, ingresos DESC LIMIT 5`),

      // Ventas por categoría (netas): venta_item → producto → categoria (el JOIN clásico del plan).
      prisma.$queryRaw<{ categoria: string; color: string; ventas: bigint }[]>(PrismaRuntime.sql`
        WITH movs AS (
          SELECT i.producto_id, i.cantidad * i.precio_unitario AS ing
          FROM venta_item i JOIN venta v ON v.id = i.venta_id
          WHERE v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio(desde)} AND v.creada_en < ${finExclusivo(hasta)}
          UNION ALL
          SELECT di.producto_id, -di.cantidad * di.precio_unitario
          FROM devolucion_item di JOIN devolucion dv ON dv.id = di.devolucion_id
          WHERE dv.creada_en >= ${inicio(desde)} AND dv.creada_en < ${finExclusivo(hasta)}
        )
        SELECT c.nombre AS categoria, c.color, SUM(m.ing) AS ventas
        FROM movs m JOIN producto p ON p.id = m.producto_id JOIN categoria c ON c.id = p.categoria_id
        GROUP BY c.nombre, c.color HAVING SUM(m.ing) > 0 ORDER BY ventas DESC`),

      // Alertas de stock bajo (estado ACTUAL, no depende del rango), con el proveedor para pedir rápido (HU-24).
      prisma.$queryRaw<{ id: number; nombre: string; stock: number; stock_minimo: number; proveedor: string | null }[]>(PrismaRuntime.sql`
        SELECT p.id, p.nombre, p.stock, p.stock_minimo, pr.nombre AS proveedor
        FROM producto p LEFT JOIN proveedor pr ON pr.id = p.proveedor_id
        WHERE p.activo AND p.controla_stock AND NOT p.es_sistema AND p.stock <= p.stock_minimo
        ORDER BY (p.stock::float / NULLIF(p.stock_minimo, 0)) ASC NULLS FIRST, p.nombre LIMIT 10`),

      // Las ventas más recientes DENTRO del rango.
      prisma.$queryRaw<{ id: number; numero: number; total: number; creada_en: Date; vendedor: string; productos: bigint }[]>(PrismaRuntime.sql`
        SELECT v.id, v.numero, v.total, v.creada_en, u.nombre AS vendedor, (SELECT COUNT(*) FROM venta_item i WHERE i.venta_id = v.id) AS productos
        FROM venta v JOIN usuario u ON u.id = v.usuario_id
        WHERE v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio(desde)} AND v.creada_en < ${finExclusivo(hasta)}
        ORDER BY v.creada_en DESC LIMIT 5`),
    ])

    const devueltoPorDia = new Map(serieDevoluciones.map((d) => [d.dia, d]))

    res.json({
      zonaHoraria: tz,
      hoy,
      metaDiaria: config.metaDiaria,
      periodo,
      comparacion,
      serie: serie.map((f) => {
        const dv = devueltoPorDia.get(f.dia)
        return { dia: f.dia, ventas: n(f.ventas) - n(dv?.devuelto), ganancia: n(f.ganancia) - n(dv?.ganancia) }
      }),
      masVendidos: masVendidos.map((f) => ({ productoId: f.producto_id, nombre: f.nombre, unidades: n(f.unidades), ingresos: n(f.ingresos) })),
      porCategoria: porCategoria.map((f) => ({ categoria: f.categoria, color: f.color, ventas: n(f.ventas) })),
      stockBajo: stockBajo.map((f) => ({ id: f.id, nombre: f.nombre, stock: f.stock, stockMinimo: f.stock_minimo, proveedor: f.proveedor })),
      ultimasVentas: ultimas.map((v) => ({ id: v.id, numero: v.numero, total: v.total, creadaEn: v.creada_en, vendedor: v.vendedor, productos: n(v.productos) })),
    })
  })

  return r
}
