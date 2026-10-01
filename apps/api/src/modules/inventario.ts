import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import { noEncontrado, reglaDeNegocio } from '../errors.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { MAX_DINERO, cantidadPositiva, dinero, id, texto } from '../lib/esquemas.js'

const esquemaCompra = z.object({
  proveedorId: id,
  notas: z.string().trim().max(300).optional(),
  items: z
    .array(z.object({ productoId: id, cantidad: cantidadPositiva, costoUnitario: dinero }))
    .min(1, 'La compra debe tener al menos un producto')
    .max(300)
    .refine((items) => new Set(items.map((i) => i.productoId)).size === items.length, 'Un producto no puede repetirse en la misma compra'),
})

// Ajuste por conteo físico (nuevoStock) o por diferencia (pérdida/daño). Siempre con motivo (HU-18).
const esquemaAjuste = z
  .object({
    productoId: id,
    motivo: texto(200),
    nuevoStock: z.number().int().min(0).max(1_000_000).optional(),
    diferencia: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .refine((d) => (d.nuevoStock === undefined) !== (d.diferencia === undefined), 'Indica "nuevoStock" (conteo) o "diferencia", pero no ambos')

// Conteo físico masivo: muchos productos de una vez. «contado» es lo que HAY en el estante (no una diferencia).
const esquemaConteo = z.object({
  motivo: z.string().trim().min(1).max(200).default('Conteo físico del inventario'),
  items: z
    .array(z.object({ productoId: id, contado: z.number().int().min(0).max(1_000_000) }))
    .min(1, 'Indica al menos un producto contado')
    .max(2000)
    .refine((items) => new Set(items.map((i) => i.productoId)).size === items.length, 'Un producto no puede repetirse en el conteo'),
})

export function rutasCompras(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO'))

  // HU-17: entrada de mercancía. Sube el stock, actualiza el costo y deja el rastro, todo en una transacción.
  r.post('/', async (req, res) => {
    const yo = usuarioActual(req)
    const d = validar(esquemaCompra, req.body)
    const total = d.items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0)
    if (total > MAX_DINERO) throw reglaDeNegocio('TOTAL_EXCESIVO', 'El total de la compra es demasiado grande')

    const compra = await prisma.$transaction(async (tx) => {
      if (!(await tx.proveedor.findFirst({ where: { id: d.proveedorId, activo: true } }))) throw noEncontrado('El proveedor (o está desactivado)')
      const items = [...d.items].sort((a, b) => a.productoId - b.productoId) // orden fijo: evita deadlocks
      const productos = await tx.producto.findMany({ where: { id: { in: items.map((i) => i.productoId) } } })
      if (productos.length !== items.length) throw reglaDeNegocio('PRODUCTO_NO_DISPONIBLE', 'Hay productos que no existen')
      const porId = new Map(productos.map((p) => [p.id, p]))
      const sinControl = productos.filter((p) => !p.controlaStock)
      if (sinControl.length) throw reglaDeNegocio('PRODUCTO_SIN_CONTROL', `«${sinControl[0]!.nombre}» no lleva control de inventario: actívalo en su ficha para registrar entradas.`)

      const c = await tx.compra.create({
        data: { proveedorId: d.proveedorId, usuarioId: yo.id, total, notas: d.notas, items: { create: items } },
        include: { items: true },
      })
      for (const it of items) {
        const filas = await tx.$queryRaw<{ stock: number }[]>(
          PrismaRuntime.sql`UPDATE producto SET stock = stock + ${it.cantidad}, costo = ${it.costoUnitario}, actualizado_en = now() WHERE id = ${it.productoId} RETURNING stock`,
        )
        await tx.movimientoStock.create({
          data: { productoId: it.productoId, tipo: 'ENTRADA', cantidad: it.cantidad, stockResultante: filas[0]!.stock, compraId: c.id, usuarioId: yo.id, motivo: 'Entrada de mercancía' },
        })
        const antes = porId.get(it.productoId)!
        if (antes.costo !== it.costoUnitario) {
          await tx.historialPrecio.create({
            data: { productoId: it.productoId, costoAnterior: antes.costo, costoNuevo: it.costoUnitario, precioAnterior: antes.precio, precioNuevo: antes.precio, usuarioId: yo.id },
          })
        }
      }
      return c
    })
    res.status(201).json(compra)
  })

  r.get('/', async (req, res) => {
    const q = validar(
      z.object({ proveedorId: id.optional(), pagina: z.coerce.number().int().min(1).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(25) }),
      req.query,
    )
    const donde = q.proveedorId ? { proveedorId: q.proveedorId } : {}
    const [total, items] = await Promise.all([
      prisma.compra.count({ where: donde }),
      prisma.compra.findMany({
        where: donde,
        include: { proveedor: { select: { id: true, nombre: true } }, items: { select: { productoId: true, cantidad: true, costoUnitario: true } } },
        orderBy: { fecha: 'desc' },
        skip: (q.pagina - 1) * q.porPagina,
        take: q.porPagina,
      }),
    ])
    res.json({ total, pagina: q.pagina, porPagina: q.porPagina, items })
  })

  r.get('/:id', async (req, res) => {
    const c = await prisma.compra.findUnique({
      where: { id: validar(id, req.params.id) },
      include: { items: { include: { producto: { select: { nombre: true, codigo: true } } } }, proveedor: true },
    })
    if (!c) throw noEncontrado('La compra')
    res.json(c)
  })

  return r
}

export function rutasInventario(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  // Resumen para las tarjetas de estado (HU-19). El vendedor puede consultarlo.
  r.get('/resumen', async (_req, res) => {
    const [f] = await prisma.$queryRaw<{ total: number; bajo: number; agotado: number }[]>(
      PrismaRuntime.sql`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE stock > 0 AND stock <= stock_minimo)::int AS bajo,
        count(*) FILTER (WHERE stock <= 0)::int AS agotado
        FROM producto WHERE activo AND controla_stock AND NOT es_sistema`,
    )
    res.json(f)
  })

  // HU-18: ajustar el stock con motivo obligatorio.
  r.post('/ajustes', requerirRol('DUENO'), async (req, res) => {
    const yo = usuarioActual(req)
    const d = validar(esquemaAjuste, req.body)
    const resultado = await prisma.$transaction(async (tx) => {
      // Bloqueo de la fila para que un conteo no pise una venta que ocurre justo ahora.
      const filas = await tx.$queryRaw<{ stock: number; controla_stock: boolean }[]>(PrismaRuntime.sql`SELECT stock, controla_stock FROM producto WHERE id = ${d.productoId} FOR UPDATE`)
      if (!filas[0]) throw noEncontrado('El producto')
      if (!filas[0].controla_stock) throw reglaDeNegocio('PRODUCTO_SIN_CONTROL', 'Este producto no lleva control de inventario: actívalo en su ficha para ajustar su stock.')
      const delta = d.nuevoStock !== undefined ? d.nuevoStock - filas[0].stock : d.diferencia!
      if (delta === 0) throw reglaDeNegocio('AJUSTE_SIN_CAMBIO', 'El ajuste no cambia el stock')
      const quedo = filas[0].stock + delta
      if (quedo < 0) throw reglaDeNegocio('STOCK_NEGATIVO', 'El ajuste dejaría el stock en negativo', { stockActual: filas[0].stock, diferencia: delta })
      await tx.producto.update({ where: { id: d.productoId }, data: { stock: quedo } })
      return tx.movimientoStock.create({
        data: { productoId: d.productoId, tipo: 'AJUSTE', cantidad: delta, stockResultante: quedo, motivo: d.motivo, usuarioId: yo.id },
      })
    })
    res.status(201).json(resultado)
  })

  // Conteo masivo: TODO o nada (una sola transacción). Solo los productos cuyo conteo difiere del sistema dejan movimiento.
  r.post('/conteo', requerirRol('DUENO'), async (req, res) => {
    const yo = usuarioActual(req)
    const d = validar(esquemaConteo, req.body)
    const ids = d.items.map((i) => i.productoId).sort((a, b) => a - b) // siempre en el mismo orden: dos conteos a la vez no se bloquean entre sí
    const contado = new Map(d.items.map((i) => [i.productoId, i.contado]))
    const resultado = await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ id: number; nombre: string; stock: number; controla_stock: boolean }[]>(
        PrismaRuntime.sql`SELECT id, nombre, stock, controla_stock FROM producto WHERE id IN (${PrismaRuntime.join(ids)}) ORDER BY id FOR UPDATE`,
      )
      if (filas.length !== ids.length) throw noEncontrado('Alguno de los productos')
      const sinControl = filas.find((f) => !f.controla_stock)
      if (sinControl) throw reglaDeNegocio('PRODUCTO_SIN_CONTROL', `«${sinControl.nombre}» no lleva control de inventario: actívalo en su ficha para contarlo.`)
      const cambios: { productoId: number; nombre: string; antes: number; contado: number; diferencia: number }[] = []
      for (const f of filas) {
        const c = contado.get(f.id)!
        const diferencia = c - f.stock
        if (diferencia === 0) continue
        await tx.producto.update({ where: { id: f.id }, data: { stock: c } })
        await tx.movimientoStock.create({ data: { productoId: f.id, tipo: 'AJUSTE', cantidad: diferencia, stockResultante: c, motivo: d.motivo, usuarioId: yo.id } })
        cambios.push({ productoId: f.id, nombre: f.nombre, antes: f.stock, contado: c, diferencia })
      }
      return { cambios, sinCambio: filas.length - cambios.length }
    }, { timeout: 60_000 })
    res.status(201).json(resultado)
  })

  // HU-20: libro de movimientos.
  r.get('/movimientos', requerirRol('DUENO'), async (req, res) => {
    const q = validar(
      z.object({
        productoId: id.optional(),
        tipo: z.enum(['ENTRADA', 'VENTA', 'AJUSTE', 'ANULACION', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR']).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).max(200).default(50),
      }),
      req.query,
    )
    const donde = { ...(q.productoId ? { productoId: q.productoId } : {}), ...(q.tipo ? { tipo: q.tipo } : {}) }
    const [total, items] = await Promise.all([
      prisma.movimientoStock.count({ where: donde }),
      prisma.movimientoStock.findMany({
        where: donde,
        include: { producto: { select: { nombre: true, codigo: true } }, usuario: { select: { nombre: true } } },
        orderBy: { creadoEn: 'desc' },
        skip: (q.pagina - 1) * q.porPagina,
        take: q.porPagina,
      }),
    ])
    res.json({ total, pagina: q.pagina, porPagina: q.porPagina, items })
  })

  return r
}
