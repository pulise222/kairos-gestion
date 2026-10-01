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

type Tx = PrismaNs.TransactionClient

/*
  DEVOLUCIONES. Dos casos distintos que no hay que confundir:

  1) Devolución de un CLIENTE sobre una venta (total o parcial):
       - se le devuelve el dinero al PRECIO al que se vendió (no al precio de hoy);
       - si el producto vuelve en buen estado, reingresa al stock; si vuelve dañado, se devuelve el dinero pero NO entra al inventario;
       - no se puede devolver más de lo vendido (contando devoluciones anteriores) ni sobre una venta anulada.

  2) Devolución de mercancía a un PROVEEDOR (llegó de más, dañada, equivocada o vencida):
       - sale del stock (no se puede devolver lo que ya no se tiene);
       - queda registrado el valor a costo y cómo se resuelve (nota crédito, reembolso o reposición).

  Ambas dejan movimientos de stock (la regla de oro: el stock siempre es la suma de sus movimientos) y son idempotentes:
  el mismo intento enviado dos veces no se registra dos veces.
*/

const esquemaDevolucionCliente = z.object({
  items: z
    .array(z.object({ ventaItemId: id, cantidad: cantidadPositiva, reingresaStock: z.boolean().default(true) }))
    .min(1, 'Elige al menos un producto a devolver')
    .max(100)
    .refine((items) => new Set(items.map((i) => i.ventaItemId)).size === items.length, 'Una línea de la venta no puede repetirse'),
  motivo: texto(200),
  medioReembolso: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']).default('EFECTIVO'),
})
export type DatosDevolucionCliente = z.infer<typeof esquemaDevolucionCliente>

const esquemaDevolucionProveedor = z.object({
  compraId: id.optional(),
  items: z
    .array(z.object({ productoId: id, cantidad: cantidadPositiva, costoUnitario: dinero.optional() }))
    .min(1, 'Elige al menos un producto a devolver')
    .max(200)
    .refine((items) => new Set(items.map((i) => i.productoId)).size === items.length, 'Un producto no puede repetirse'),
  motivo: z.enum(['SOBRANTE', 'DANADO', 'EQUIVOCADO', 'VENCIDO', 'OTRO']),
  nota: z.string().trim().max(300).optional(),
  resolucion: z.enum(['PENDIENTE', 'NOTA_CREDITO', 'REEMBOLSO', 'REPOSICION']).default('PENDIENTE'),
})
export type DatosDevolucionProveedor = z.infer<typeof esquemaDevolucionProveedor>

const claveIdempotencia = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Clave de operación inválida').optional()

const TEXTO_MOTIVO_PROVEEDOR = { SOBRANTE: 'Llegó de más', DANADO: 'Llegó dañado', EQUIVOCADO: 'No es lo que se pidió', VENCIDO: 'Vencido', OTRO: 'Otro motivo' } as const

/* ───────────────────────── 1) Devolución de un cliente ───────────────────────── */

export async function registrarDevolucionCliente(prisma: Prisma, usuario: UsuarioAuth, ventaId: number, datos: DatosDevolucionCliente, clave?: string) {
  const yaRegistrada = async () => {
    if (!clave) return null
    const previa = await prisma.devolucion.findUnique({ where: { claveIdempotencia: clave }, include: { items: true } })
    if (previa && previa.usuarioId !== usuario.id) throw conflicto('CLAVE_EN_USO', 'Esa clave de operación ya se usó')
    return previa
  }

  const repetida = await yaRegistrada()
  if (repetida) return { devolucion: repetida, repetida: true }

  try {
    const devolucion = await prisma.$transaction(async (tx) => {
      // Se bloquea la venta mientras se procesa: dos devoluciones simultáneas sobre la misma venta se atienden una tras otra.
      const filas = await tx.$queryRaw<{ estado: string }[]>(PrismaRuntime.sql`SELECT estado FROM venta WHERE id = ${ventaId} FOR UPDATE`)
      if (!filas[0]) throw noEncontrado('La venta')
      if (filas[0].estado !== 'COMPLETADA') throw reglaDeNegocio('VENTA_ANULADA', 'No se puede registrar una devolución sobre una venta anulada')

      const lineas = await tx.ventaItem.findMany({ where: { ventaId }, include: { devolucionItems: { select: { cantidad: true } } } })
      const porId = new Map(lineas.map((l) => [l.id, l]))

      const detalle = [...datos.items]
        .sort((a, b) => a.ventaItemId - b.ventaItemId)
        .map((it) => {
          const l = porId.get(it.ventaItemId)
          if (!l) throw reglaDeNegocio('LINEA_NO_PERTENECE', 'Una de las líneas no pertenece a esta venta', { ventaItemId: it.ventaItemId })
          const yaDevueltas = l.devolucionItems.reduce((s, d) => s + d.cantidad, 0)
          const disponible = l.cantidad - yaDevueltas
          if (it.cantidad > disponible) {
            throw reglaDeNegocio('DEVOLUCION_EXCEDE', `De "${l.nombreProducto}" solo se pueden devolver ${disponible}`, { ventaItemId: l.id, vendidas: l.cantidad, yaDevueltas, disponible })
          }
          return { it, l }
        })

      // El dinero que se devuelve es el PRECIO DE LA VENTA (copiado en la línea), no el precio actual del producto.
      const total = detalle.reduce((s, d) => s + d.it.cantidad * d.l.precioUnitario, 0)
      if (total > MAX_DINERO) throw reglaDeNegocio('TOTAL_EXCESIVO', 'El total de la devolución es demasiado grande')

      const dev = await tx.devolucion.create({
        data: {
          ventaId, usuarioId: usuario.id, total, motivo: datos.motivo, medioReembolso: datos.medioReembolso, claveIdempotencia: clave,
          items: {
            create: detalle.map(({ it, l }) => ({
              ventaItemId: l.id, productoId: l.productoId, nombreProducto: l.nombreProducto, cantidad: it.cantidad,
              precioUnitario: l.precioUnitario, costoUnitario: l.costoUnitario, reingresaStock: it.reingresaStock,
            })),
          },
        },
        include: { items: true },
      })

      // Solo lo que vuelve en buen estado reingresa al inventario (y deja su movimiento).
      // Los productos sin control de inventario devuelven el dinero pero no tienen stock que reingresar.
      const controlan = new Set((await tx.producto.findMany({ where: { id: { in: detalle.map((d) => d.l.productoId) }, controlaStock: true }, select: { id: true } })).map((p) => p.id))
      for (const { it, l } of [...detalle].sort((a, b) => a.l.productoId - b.l.productoId)) {
        if (!it.reingresaStock || !controlan.has(l.productoId)) continue
        const filasStock = await tx.$queryRaw<{ stock: number }[]>(
          PrismaRuntime.sql`UPDATE producto SET stock = stock + ${it.cantidad}, actualizado_en = now() WHERE id = ${l.productoId} RETURNING stock`,
        )
        await tx.movimientoStock.create({
          data: { productoId: l.productoId, tipo: 'DEVOLUCION_CLIENTE', cantidad: it.cantidad, stockResultante: filasStock[0]!.stock, motivo: datos.motivo, ventaId, devolucionId: dev.id, usuarioId: usuario.id },
        })
      }
      return dev
    })
    return { devolucion, repetida: false }
  } catch (e) {
    // Reintento simultáneo con la misma clave: la respuesta correcta es la devolución que ganó.
    const ganadora = await yaRegistrada()
    if (ganadora) return { devolucion: ganadora, repetida: true }
    throw e
  }
}

/* ───────────────────────── 2) Devolución a un proveedor ───────────────────────── */

async function descontarStockProveedor(tx: Tx, productoId: number, cantidad: number, nombre: string): Promise<number> {
  const filas = await tx.$queryRaw<{ stock: number }[]>(
    PrismaRuntime.sql`UPDATE producto SET stock = stock - ${cantidad}, actualizado_en = now() WHERE id = ${productoId} AND stock >= ${cantidad} RETURNING stock`,
  )
  if (!filas[0]) {
    const actual = await tx.producto.findUnique({ where: { id: productoId }, select: { stock: true } })
    throw conflicto('STOCK_INSUFICIENTE', `No puedes devolver ${cantidad} de "${nombre}": solo hay ${Math.max(actual?.stock ?? 0, 0)} en el inventario`, { productoId, nombre, solicitado: cantidad, disponible: Math.max(actual?.stock ?? 0, 0) })
  }
  return filas[0].stock
}

export async function registrarDevolucionProveedor(prisma: Prisma, usuario: UsuarioAuth, proveedorId: number, datos: DatosDevolucionProveedor, clave?: string) {
  const yaRegistrada = async () => {
    if (!clave) return null
    const previa = await prisma.devolucionProveedor.findUnique({ where: { claveIdempotencia: clave }, include: { items: true } })
    if (previa && previa.usuarioId !== usuario.id) throw conflicto('CLAVE_EN_USO', 'Esa clave de operación ya se usó')
    return previa
  }

  const repetida = await yaRegistrada()
  if (repetida) return { devolucion: repetida, repetida: true }

  try {
    const devolucion = await prisma.$transaction(async (tx) => {
      // Un proveedor desactivado SÍ admite devoluciones: justo puede ser por el que se dejó de trabajar con él.
      if (!(await tx.proveedor.findUnique({ where: { id: proveedorId } }))) throw noEncontrado('El proveedor')

      const productos = await tx.producto.findMany({ where: { id: { in: datos.items.map((i) => i.productoId) } } })
      if (productos.length !== datos.items.length) throw reglaDeNegocio('PRODUCTO_NO_DISPONIBLE', 'Hay productos que no existen')
      const producto = new Map(productos.map((p) => [p.id, p]))

      // Si la devolución es sobre una compra concreta: debe ser de ESE proveedor y no se devuelve más de lo comprado.
      let costoDeCompra = new Map<number, number>()
      if (datos.compraId) {
        const compra = await tx.compra.findUnique({ where: { id: datos.compraId }, include: { items: true } })
        if (!compra) throw noEncontrado('La compra')
        if (compra.proveedorId !== proveedorId) throw reglaDeNegocio('COMPRA_DE_OTRO_PROVEEDOR', 'Esa compra no es de este proveedor')
        const yaDevuelto = await tx.devolucionProveedorItem.groupBy({ by: ['productoId'], where: { devolucion: { compraId: datos.compraId } }, _sum: { cantidad: true } })
        const devueltoPor = new Map(yaDevuelto.map((d) => [d.productoId, d._sum.cantidad ?? 0]))
        for (const it of datos.items) {
          const linea = compra.items.find((c) => c.productoId === it.productoId)
          if (!linea) throw reglaDeNegocio('PRODUCTO_NO_ESTA_EN_LA_COMPRA', `"${producto.get(it.productoId)!.nombre}" no venía en esa compra`, { productoId: it.productoId })
          const disponible = linea.cantidad - (devueltoPor.get(it.productoId) ?? 0)
          if (it.cantidad > disponible) {
            throw reglaDeNegocio('DEVOLUCION_EXCEDE', `De "${producto.get(it.productoId)!.nombre}" solo se pueden devolver ${disponible} de esa compra`, { productoId: it.productoId, comprados: linea.cantidad, yaDevueltos: linea.cantidad - disponible, disponible })
          }
        }
        costoDeCompra = new Map(compra.items.map((c) => [c.productoId, c.costoUnitario]))
      }

      // El valor de lo devuelto es a COSTO: el de la compra si se indicó, si no el que se indique o el costo actual.
      const detalle = [...datos.items]
        .sort((a, b) => a.productoId - b.productoId)
        .map((it) => ({ ...it, costoUnitario: costoDeCompra.get(it.productoId) ?? it.costoUnitario ?? producto.get(it.productoId)!.costo }))
      const total = detalle.reduce((s, d) => s + d.cantidad * d.costoUnitario, 0)
      if (total > MAX_DINERO) throw reglaDeNegocio('TOTAL_EXCESIVO', 'El total de la devolución es demasiado grande')

      const dev = await tx.devolucionProveedor.create({
        data: {
          proveedorId, compraId: datos.compraId, usuarioId: usuario.id, total, motivo: datos.motivo, nota: datos.nota, resolucion: datos.resolucion, claveIdempotencia: clave,
          items: { create: detalle.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad, costoUnitario: d.costoUnitario })) },
        },
        include: { items: true },
      })

      for (const d of detalle) {
        const nombre = producto.get(d.productoId)!.nombre
        if (!producto.get(d.productoId)!.controlaStock) throw reglaDeNegocio('PRODUCTO_SIN_CONTROL', `«${nombre}» no lleva control de inventario: actívalo en su ficha para devolverlo a un proveedor.`)
        const quedo = await descontarStockProveedor(tx, d.productoId, d.cantidad, nombre)
        await tx.movimientoStock.create({
          data: { productoId: d.productoId, tipo: 'DEVOLUCION_PROVEEDOR', cantidad: -d.cantidad, stockResultante: quedo, motivo: `${TEXTO_MOTIVO_PROVEEDOR[datos.motivo]}${datos.nota ? ` · ${datos.nota}` : ''}`, compraId: datos.compraId, devolucionProveedorId: dev.id, usuarioId: usuario.id },
        })
      }
      return dev
    })
    return { devolucion, repetida: false }
  } catch (e) {
    const ganadora = await yaRegistrada()
    if (ganadora) return { devolucion: ganadora, repetida: true }
    throw e
  }
}

/* ───────────────────────── Rutas ───────────────────────── */

/** POST /api/ventas/:id/devoluciones (solo el dueño: es dinero que sale de la caja). */
export function rutasDevolucionesVenta(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  r.post('/:id/devoluciones', requerirRol('DUENO'), async (req, res) => {
    const yo = usuarioActual(req)
    const clave = validar(claveIdempotencia, req.header('idempotency-key'))
    const { devolucion, repetida } = await registrarDevolucionCliente(prisma, yo, validar(id, req.params.id), validar(esquemaDevolucionCliente, req.body), clave)
    res.status(repetida ? 200 : 201).json(devolucion)
  })
  return r
}

/** GET y POST /api/proveedores/:id/devoluciones (solo el dueño). */
export function rutasDevolucionesProveedor(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO'))

  r.get('/:id/devoluciones', async (req, res) => {
    const pid = validar(id, req.params.id)
    if (!(await prisma.proveedor.findUnique({ where: { id: pid }, select: { id: true } }))) throw noEncontrado('El proveedor')
    res.json(
      await prisma.devolucionProveedor.findMany({
        where: { proveedorId: pid },
        orderBy: { fecha: 'desc' },
        take: 100,
        include: { items: { include: { producto: { select: { nombre: true, codigo: true } } } }, usuario: { select: { nombre: true } } },
      }),
    )
  })

  r.post('/:id/devoluciones', async (req, res) => {
    const yo = usuarioActual(req)
    const clave = validar(claveIdempotencia, req.header('idempotency-key'))
    const { devolucion, repetida } = await registrarDevolucionProveedor(prisma, yo, validar(id, req.params.id), validar(esquemaDevolucionProveedor, req.body), clave)
    res.status(repetida ? 200 : 201).json(devolucion)
  })
  return r
}
