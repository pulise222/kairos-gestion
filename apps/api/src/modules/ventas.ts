import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import type { Prisma as PrismaNs } from '../generated/prisma/client.js'
import { conflicto, noEncontrado, reglaDeNegocio } from '../errors.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import type { UsuarioAuth } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { MAX_DINERO, cantidadPositiva, dinero, id, texto } from '../lib/esquemas.js'
import { leerConfig } from './configuracion.js'

type Tx = PrismaNs.TransactionClient

const esquemaVenta = z.object({
  items: z
    .array(z.object({ productoId: id, cantidad: cantidadPositiva }))
    .min(1, 'La venta debe tener al menos un producto')
    .max(200, 'Demasiados productos en una sola venta'),
  pagado: dinero,
  medioPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']).default('EFECTIVO'),
})

export type DatosVenta = z.infer<typeof esquemaVenta>

/**
 * Descuenta stock de forma ATÓMICA con una sola instrucción SQL:
 *   UPDATE ... SET stock = stock - N WHERE id = X AND (permite_negativo OR stock >= N)
 * Si dos ventas simultáneas compiten por la última unidad, PostgreSQL las procesa una tras otra:
 * la primera gana y la segunda no encuentra stock (0 filas). Nunca se vende dos veces la misma unidad.
 * Devuelve el stock resultante, o null si no alcanzaba.
 */
async function descontarStock(tx: Tx, productoId: number, cantidad: number, permitirNegativo: boolean): Promise<number | null> {
  const filas = await tx.$queryRaw<{ stock: number }[]>(
    PrismaRuntime.sql`UPDATE producto SET stock = stock - ${cantidad}, actualizado_en = now()
      WHERE id = ${productoId} AND (${permitirNegativo}::boolean OR stock >= ${cantidad}) RETURNING stock`,
  )
  return filas[0]?.stock ?? null
}

async function devolverStock(tx: Tx, productoId: number, cantidad: number): Promise<number> {
  const filas = await tx.$queryRaw<{ stock: number }[]>(
    PrismaRuntime.sql`UPDATE producto SET stock = stock + ${cantidad}, actualizado_en = now() WHERE id = ${productoId} RETURNING stock`,
  )
  return filas[0]!.stock
}

/**
 * REGISTRA UNA VENTA. Única fuente de verdad del cálculo: el front solo muestra.
 *  - Los precios y costos salen de la BASE DE DATOS, nunca de lo que mande el cliente.
 *  - Todo ocurre en UNA transacción: o se guarda la venta completa (con stock y movimientos) o no se guarda nada.
 */
export async function registrarVenta(prisma: Prisma, vendedor: UsuarioAuth, entrada: DatosVenta, claveIdempotencia?: string) {
  /** Si esta clave ya registró una venta, esa venta es la respuesta (la repetición no crea nada ni descuenta stock otra vez). */
  const yaRegistrada = async () => {
    if (!claveIdempotencia) return null
    const previa = await prisma.venta.findUnique({ where: { claveIdempotencia }, include: { items: true } })
    if (!previa) return null
    // Una clave pertenece al usuario que la usó: otro usuario no puede "cobrarla" por casualidad o a propósito.
    if (previa.usuarioId !== vendedor.id) throw conflicto('CLAVE_EN_USO', 'Esa clave de operación ya se usó')
    return previa
  }

  const repetida = await yaRegistrada()
  if (repetida) return { venta: repetida, repetida: true }

  try {
    return { venta: await crearVenta(prisma, vendedor, entrada, claveIdempotencia), repetida: false }
  } catch (e) {
    // Dos peticiones iguales a la vez: una gana; la otra falla (clave duplicada o, si era la última unidad, "sin stock").
    // En ambos casos la respuesta correcta para la perdedora es la venta que ganó, no el error.
    const ganadora = await yaRegistrada()
    if (ganadora) return { venta: ganadora, repetida: true }
    throw e
  }
}

async function crearVenta(prisma: Prisma, vendedor: UsuarioAuth, entrada: DatosVenta, claveIdempotencia?: string) {
  return prisma.$transaction(async (tx) => {
    const config = await leerConfig(tx)

    // Si el mismo producto viene repetido, se suman las cantidades.
    const cantidades = new Map<number, number>()
    for (const it of entrada.items) cantidades.set(it.productoId, (cantidades.get(it.productoId) ?? 0) + it.cantidad)
    // Orden fijo por id: evita bloqueos cruzados (deadlocks) entre ventas simultáneas.
    const ids = [...cantidades.keys()].sort((a, b) => a - b)

    const productos = await tx.producto.findMany({ where: { id: { in: ids }, activo: true } })
    if (productos.length !== ids.length) {
      const faltan = ids.filter((i) => !productos.some((p) => p.id === i))
      throw reglaDeNegocio('PRODUCTO_NO_DISPONIBLE', 'Hay productos que no existen o están desactivados', { productoIds: faltan })
    }
    const porId = new Map(productos.map((p) => [p.id, p]))

    const total = ids.reduce((suma, i) => suma + porId.get(i)!.precio * cantidades.get(i)!, 0)
    if (total > MAX_DINERO) throw reglaDeNegocio('TOTAL_EXCESIVO', 'El total de la venta es demasiado grande')

    // HU-13: no se confirma pagando de menos. Transferencia/tarjeta pagan exacto (no hay "vueltas" que dar).
    if (entrada.pagado < total) throw reglaDeNegocio('PAGO_INSUFICIENTE', 'El pago no alcanza para cubrir el total', { total, pagado: entrada.pagado })
    if (entrada.medioPago !== 'EFECTIVO' && entrada.pagado !== total) {
      throw reglaDeNegocio('PAGO_NO_EXACTO', 'Con transferencia o tarjeta el valor pagado debe ser igual al total')
    }

    // Descuento de stock + registro del movimiento, producto por producto (en orden de id).
    const stockResultante = new Map<number, number>()
    for (const i of ids) {
      const p = porId.get(i)!
      const quedo = await descontarStock(tx, i, cantidades.get(i)!, config.permitirVentaSinStock)
      if (quedo === null) {
        throw conflicto('STOCK_INSUFICIENTE', `No hay stock suficiente de "${p.nombre}"`, { productoId: i, nombre: p.nombre, solicitado: cantidades.get(i), disponible: p.stock })
      }
      stockResultante.set(i, quedo)
    }

    const venta = await tx.venta.create({
      data: {
        usuarioId: vendedor.id,
        total,
        pagado: entrada.pagado,
        vueltas: entrada.pagado - total,
        medioPago: entrada.medioPago,
        claveIdempotencia,
        items: {
          // Copia de nombre, precio y costo al momento de vender (las ventas pasadas nunca cambian).
          create: ids.map((i) => {
            const p = porId.get(i)!
            return { productoId: i, nombreProducto: p.nombre, cantidad: cantidades.get(i)!, precioUnitario: p.precio, costoUnitario: p.costo }
          }),
        },
      },
      include: { items: true },
    })

    await tx.movimientoStock.createMany({
      data: ids.map((i) => ({
        productoId: i,
        tipo: 'VENTA' as const,
        cantidad: -cantidades.get(i)!,
        stockResultante: stockResultante.get(i)!,
        ventaId: venta.id,
        usuarioId: vendedor.id,
      })),
    })
    return venta
  })
}

/** ANULA una venta (HU-16): el stock vuelve y queda el motivo. Una venta solo se puede anular una vez. */
export async function anularVenta(prisma: Prisma, dueno: UsuarioAuth, ventaId: number, motivo: string) {
  return prisma.$transaction(async (tx) => {
    // Cambio de estado condicionado: si dos personas anulan a la vez, solo una lo logra (la otra ve 0 filas).
    // Una venta con devoluciones NO se puede anular: el stock y el dinero ya se movieron por la devolución y se duplicarían.
    if ((await tx.devolucion.count({ where: { ventaId } })) > 0) {
      throw conflicto('VENTA_CON_DEVOLUCIONES', 'Esta venta ya tiene devoluciones registradas, por eso no se puede anular. Registra la devolución de lo que falte.')
    }
    const { count } = await tx.venta.updateMany({
      where: { id: ventaId, estado: 'COMPLETADA' },
      data: { estado: 'ANULADA', motivoAnulacion: motivo, anuladaEn: new Date(), anuladaPorId: dueno.id },
    })
    if (count === 0) {
      const existe = await tx.venta.findUnique({ where: { id: ventaId }, select: { id: true } })
      if (!existe) throw noEncontrado('La venta')
      throw conflicto('VENTA_YA_ANULADA', 'Esta venta ya fue anulada')
    }
    const items = await tx.ventaItem.findMany({ where: { ventaId }, orderBy: { productoId: 'asc' } })
    for (const it of items) {
      const quedo = await devolverStock(tx, it.productoId, it.cantidad)
      await tx.movimientoStock.create({
        data: { productoId: it.productoId, tipo: 'ANULACION', cantidad: it.cantidad, stockResultante: quedo, motivo, ventaId, usuarioId: dueno.id },
      })
    }
    return tx.venta.findUniqueOrThrow({ where: { id: ventaId }, include: { items: true } })
  })
}

interface LineaConCosto { costoUnitario: number; precioUnitario: number; cantidad: number }
interface DevolucionDeVenta { items: LineaConCosto[] }

/**
 * Presenta una venta. El vendedor NO ve costos ni ganancia.
 * La ganancia del dueño es NETA: se le restan las devoluciones (lo devuelto ya no se ganó).
 */
function presentar<V extends { items: LineaConCosto[]; devoluciones?: DevolucionDeVenta[] }>(v: V, esDueno: boolean) {
  if (esDueno) {
    const bruta = v.items.reduce((s, it) => s + (it.precioUnitario - it.costoUnitario) * it.cantidad, 0)
    const devuelta = (v.devoluciones ?? []).flatMap((d) => d.items).reduce((s, it) => s + (it.precioUnitario - it.costoUnitario) * it.cantidad, 0)
    return { ...v, ganancia: bruta - devuelta }
  }
  return {
    ...v,
    items: v.items.map(({ costoUnitario: _c, ...resto }) => resto),
    ...(v.devoluciones ? { devoluciones: v.devoluciones.map((d) => ({ ...d, items: d.items.map(({ costoUnitario: _c, ...resto }) => resto) })) } : {}),
  }
}

const incluirDetalle = {
  items: true,
  usuario: { select: { id: true, nombre: true } },
  devoluciones: { include: { items: true, usuario: { select: { nombre: true } } }, orderBy: { creadaEn: 'asc' } },
} as const

export function rutasVentas(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  r.post('/', async (req, res) => {
    const yo = usuarioActual(req)
    // Encabezado opcional "Idempotency-Key": identifica el INTENTO de venta. Si llega repetido, se devuelve la venta ya registrada.
    const clave = validar(z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Clave de operación inválida').optional(), req.header('idempotency-key'))
    const { venta, repetida } = await registrarVenta(prisma, yo, validar(esquemaVenta, req.body), clave)
    res.status(repetida ? 200 : 201).json(presentar(venta, yo.rol === 'DUENO'))
  })

  // Historial. El dueño ve todo (filtrable); el vendedor solo sus propias ventas.
  r.get('/', async (req, res) => {
    const yo = usuarioActual(req)
    const q = validar(
      z.object({
        // Días completos "AAAA-MM-DD", ambos incluidos, contados en la zona horaria del negocio.
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').optional(),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').optional(),
        estado: z.enum(['COMPLETADA', 'ANULADA']).optional(),
        usuarioId: id.optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).max(100).default(25),
      }),
      req.query,
    )
    // Un día "AAAA-MM-DD" → el instante exacto en que empieza ese día EN LA ZONA DEL NEGOCIO (y el del día siguiente para el fin).
    let creadaEn: { gte?: Date; lt?: Date } | undefined
    if (q.desde || q.hasta) {
      const tz = (await leerConfig(prisma)).zonaHoraria
      const [f] = await prisma.$queryRaw<{ inicio: Date | null; fin: Date | null }[]>(PrismaRuntime.sql`
        SELECT ${q.desde ?? null}::date::timestamp AT TIME ZONE ${tz} AS inicio,
               (${q.hasta ?? null}::date + 1)::timestamp AT TIME ZONE ${tz} AS fin`)
      creadaEn = { ...(f?.inicio ? { gte: f.inicio } : {}), ...(f?.fin ? { lt: f.fin } : {}) }
    }
    const donde = {
      ...(yo.rol === 'DUENO' ? (q.usuarioId ? { usuarioId: q.usuarioId } : {}) : { usuarioId: yo.id }),
      ...(q.estado ? { estado: q.estado } : {}),
      ...(creadaEn ? { creadaEn } : {}),
    }
    const [total, items] = await Promise.all([
      prisma.venta.count({ where: donde }),
      prisma.venta.findMany({ where: donde, include: incluirDetalle, orderBy: { creadaEn: 'desc' }, skip: (q.pagina - 1) * q.porPagina, take: q.porPagina }),
    ])
    res.json({ total, pagina: q.pagina, porPagina: q.porPagina, items: items.map((v) => presentar(v, yo.rol === 'DUENO')) })
  })

  r.get('/:id', async (req, res) => {
    const yo = usuarioActual(req)
    const v = await prisma.venta.findUnique({ where: { id: validar(id, req.params.id) }, include: incluirDetalle })
    // Un vendedor no puede ver ventas ajenas: respondemos "no existe" para no confirmar que existe.
    if (!v || (yo.rol !== 'DUENO' && v.usuarioId !== yo.id)) throw noEncontrado('La venta')
    res.json(presentar(v, yo.rol === 'DUENO'))
  })

  r.post('/:id/anular', requerirRol('DUENO'), async (req, res) => {
    const yo = usuarioActual(req)
    const d = validar(z.object({ motivo: texto(200) }), req.body)
    const v = await anularVenta(prisma, yo, validar(id, req.params.id), d.motivo)
    res.json(presentar(v, true))
  })

  return r
}
