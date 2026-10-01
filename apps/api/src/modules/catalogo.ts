import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import express, { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import { ErrorApp, conflicto, noEncontrado } from '../errors.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { colorHex, dinero, id, texto } from '../lib/esquemas.js'
import { normalizar } from '../lib/texto.js'
import type { Rol } from '../generated/prisma/enums.js'

/* ───────────────────────── Categorías (HU-05) ───────────────────────── */
export function rutasCategorias(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  r.get('/', async (req, res) => {
    const todas = req.query.todas === 'true' && usuarioActual(req).rol === 'DUENO'
    res.json(await prisma.categoria.findMany({ where: todas ? {} : { activa: true }, orderBy: { nombre: 'asc' } }))
  })

  r.post('/', requerirRol('DUENO'), async (req, res) => {
    const d = validar(z.object({ nombre: texto(60), color: colorHex.optional() }), req.body)
    // Sin distinguir mayúsculas: «Bebidas» y «bebidas» son la misma categoría.
    if (await prisma.categoria.findFirst({ where: { nombre: { equals: d.nombre, mode: 'insensitive' } } })) throw conflicto('CATEGORIA_EXISTE', 'Ya existe una categoría con ese nombre')
    res.status(201).json(await prisma.categoria.create({ data: d }))
  })

  r.patch('/:id', requerirRol('DUENO'), async (req, res) => {
    const cid = validar(id, req.params.id)
    const d = validar(z.object({ nombre: texto(60), color: colorHex, activa: z.boolean() }).partial().strict(), req.body)
    if (!(await prisma.categoria.findUnique({ where: { id: cid } }))) throw noEncontrado('La categoría')
    if (d.nombre) {
      const otra = await prisma.categoria.findFirst({ where: { nombre: { equals: d.nombre, mode: 'insensitive' }, id: { not: cid } } })
      if (otra) throw conflicto('CATEGORIA_EXISTE', 'Ya existe una categoría con ese nombre')
    }
    res.json(await prisma.categoria.update({ where: { id: cid }, data: d }))
  })

  return r
}

/* ───────────────────────── Proveedores (HU-06) ───────────────────────── */
const esquemaProveedor = z.object({
  nombre: texto(100),
  telefono: z.string().trim().max(30).nullish(),
  correo: z.string().trim().email('Correo inválido').max(120).nullish(),
  notas: z.string().trim().max(500).nullish(),
})

export function rutasProveedores(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto), requerirRol('DUENO')) // el vendedor no ve proveedores

  r.get('/', async (req, res) => {
    const todos = req.query.todos === 'true'
    res.json(await prisma.proveedor.findMany({ where: todos ? {} : { activo: true }, orderBy: { nombre: 'asc' } }))
  })

  r.get('/:id', async (req, res) => {
    const pid = validar(id, req.params.id)
    const p = await prisma.proveedor.findUnique({
      where: { id: pid },
      include: { _count: { select: { productos: true, compras: true } } },
    })
    if (!p) throw noEncontrado('El proveedor')
    res.json(p)
  })

  r.post('/', async (req, res) => {
    res.status(201).json(await prisma.proveedor.create({ data: validar(esquemaProveedor, req.body) }))
  })

  r.patch('/:id', async (req, res) => {
    const pid = validar(id, req.params.id)
    const d = validar(esquemaProveedor.partial().extend({ activo: z.boolean().optional() }).strict(), req.body)
    if (!(await prisma.proveedor.findUnique({ where: { id: pid } }))) throw noEncontrado('El proveedor')
    res.json(await prisma.proveedor.update({ where: { id: pid }, data: d }))
  })

  return r
}

/* ───────────────────────── Productos (HU-07, HU-09) ───────────────────────── */
const esquemaProductoBase = z.object({
  nombre: texto(120),
  // Sin espacios ni símbolos raros: así el lector de barras y la búsqueda por código siempre coinciden.
  codigo: z.string().trim().min(1, 'El código no puede estar vacío').max(40).regex(/^[\w.-]+$/, 'El código solo puede tener letras, números, punto, guion y guion bajo (sin espacios)'),
  descripcion: z.string().trim().max(500).nullish(),
  imagen: z.string().trim().max(300).nullish(),
  categoriaId: id,
  proveedorId: id.nullish(),
  costo: dinero,
  precio: dinero,
  stockMinimo: z.number().int().min(0).max(100_000),
})

// OJO: los valores por defecto SOLO van en el esquema de creación. Si estuvieran en el base, al editar
// un solo campo (.partial()) Zod rellenaría "stockMinimo" con 0 y borraría el valor guardado sin avisar.
// El stock inicial solo se acepta al crear. Después SOLO cambia con ventas, compras y ajustes (así siempre hay rastro).
const esquemaCrear = esquemaProductoBase.extend({
  // El código es opcional al crear: si no se escribe, el sistema asigna el siguiente número libre.
  codigo: esquemaProductoBase.shape.codigo.optional().or(z.literal('').transform(() => undefined)),
  stockMinimo: z.number().int().min(0).max(100_000).default(0),
  stockInicial: z.number().int().min(0).max(100_000).default(0),
})
const esquemaEditar = esquemaProductoBase.partial().extend({ activo: z.boolean().optional() }).strict()

/** El vendedor NO ve costos ni ganancias (regla de permisos). */
export function paraRol<T extends { costo: number }>(p: T, rol: Rol): Omit<T, 'costo'> | T {
  if (rol === 'DUENO') return p
  const { costo: _costo, ...resto } = p
  return resto
}

const incluir = { categoria: { select: { id: true, nombre: true, color: true } }, proveedor: { select: { id: true, nombre: true } } } as const

/** Tipo real de la imagen según sus primeros bytes ("magic bytes"). No se confía en lo que diga el navegador. */
export function tipoDeImagen(b: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return null
}

export function rutasProductos(prisma: Prisma, secreto: string, uploadsDir = './uploads') {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  async function validarRelaciones(categoriaId?: number, proveedorId?: number | null) {
    if (categoriaId !== undefined && !(await prisma.categoria.findFirst({ where: { id: categoriaId, activa: true } }))) {
      throw noEncontrado('La categoría (o está desactivada)')
    }
    if (proveedorId && !(await prisma.proveedor.findFirst({ where: { id: proveedorId, activo: true } }))) {
      throw noEncontrado('El proveedor (o está desactivado)')
    }
  }

  // Listado con búsqueda y filtros. Pensado para ser rápido (la pantalla de venta lo usa mientras se escribe).
  r.get('/', async (req, res) => {
    const yo = usuarioActual(req)
    const q = validar(
      z.object({
        q: z.string().trim().max(60).optional(),
        categoriaId: id.optional(),
        proveedorId: id.optional(),
        estado: z.enum(['bajo', 'agotado']).optional(),
        inactivos: z.enum(['true', 'false']).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).max(200).default(50),
      }),
      req.query,
    )
    const verInactivos = q.inactivos === 'true' && yo.rol === 'DUENO'

    // "Stock bajo" compara dos columnas (stock <= stock_minimo): Prisma no lo permite directo, así que
    // obtenemos los ids con SQL y luego los filtramos con Prisma.
    let idsPorEstado: number[] | undefined
    if (q.estado) {
      const filas =
        q.estado === 'agotado'
          ? await prisma.$queryRaw<{ id: number }[]>(PrismaRuntime.sql`SELECT id FROM producto WHERE stock <= 0`)
          : await prisma.$queryRaw<{ id: number }[]>(PrismaRuntime.sql`SELECT id FROM producto WHERE stock <= stock_minimo`)
      idsPorEstado = filas.map((f) => f.id)
    }

    const donde = {
      ...(verInactivos ? {} : { activo: true }),
      ...(q.categoriaId ? { categoriaId: q.categoriaId } : {}),
      ...(q.proveedorId ? { proveedorId: q.proveedorId } : {}),
      ...(idsPorEstado ? { id: { in: idsPorEstado } } : {}),
      ...(q.q ? { OR: [{ busqueda: { contains: normalizar(q.q) } }, { codigo: { contains: q.q, mode: 'insensitive' as const } }] } : {}),
    }
    const [total, items] = await Promise.all([
      prisma.producto.count({ where: donde }),
      prisma.producto.findMany({ where: donde, include: incluir, orderBy: { nombre: 'asc' }, skip: (q.pagina - 1) * q.porPagina, take: q.porPagina }),
    ])
    res.json({ total, pagina: q.pagina, porPagina: q.porPagina, items: items.map((p) => paraRol(p, yo.rol)) })
  })

  // Lector de código de barras: coincidencia exacta.
  r.get('/codigo/:codigo', async (req, res) => {
    const yo = usuarioActual(req)
    const p = await prisma.producto.findFirst({ where: { codigo: { equals: String(req.params.codigo), mode: 'insensitive' }, activo: true }, include: incluir })
    if (!p) throw noEncontrado('El producto')
    res.json(paraRol(p, yo.rol))
  })

  r.get('/:id', async (req, res) => {
    const yo = usuarioActual(req)
    const p = await prisma.producto.findUnique({ where: { id: validar(id, req.params.id) }, include: incluir })
    if (!p || (!p.activo && yo.rol !== 'DUENO')) throw noEncontrado('El producto')
    res.json(paraRol(p, yo.rol))
  })

  r.post('/', requerirRol('DUENO'), async (req, res) => {
    const yo = usuarioActual(req)
    const { stockInicial, codigo: codigoPedido, ...d } = validar(esquemaCrear, req.body)
    await validarRelaciones(d.categoriaId, d.proveedorId)

    const creado = await prisma.$transaction(async (tx) => {
      // Candado: dos productos creados a la vez no pueden recibir el mismo código automático.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7002)`
      let codigo = codigoPedido
      if (codigo) {
        if (await tx.producto.findFirst({ where: { codigo: { equals: codigo, mode: 'insensitive' } } })) throw conflicto('CODIGO_EXISTE', 'Ya existe un producto con ese código')
      } else {
        // Códigos propios cortos (solo dígitos, hasta 6): los códigos de barras largos no cuentan.
        const sig = (await tx.$queryRaw<{ sig: number }[]>(PrismaRuntime.sql`SELECT COALESCE(MAX(codigo::int), 0) + 1 AS sig FROM producto WHERE codigo ~ '^[0-9]{1,6}$'`))[0]?.sig ?? 1
        codigo = String(sig).padStart(4, '0')
        while (await tx.producto.findFirst({ where: { codigo: { equals: codigo, mode: 'insensitive' } } })) codigo = String(Number(codigo) + 1).padStart(4, '0')
      }
      const p = await tx.producto.create({ data: { ...d, codigo, stock: stockInicial, busqueda: normalizar(`${d.nombre} ${d.descripcion ?? ''}`) }, include: incluir })
      if (stockInicial > 0) {
        await tx.movimientoStock.create({
          data: { productoId: p.id, tipo: 'AJUSTE', cantidad: stockInicial, stockResultante: stockInicial, motivo: 'Stock inicial', usuarioId: yo.id },
        })
      }
      return p
    })
    res.status(201).json(creado)
  })

  r.patch('/:id', requerirRol('DUENO'), async (req, res) => {
    const yo = usuarioActual(req)
    const pid = validar(id, req.params.id)
    const d = validar(esquemaEditar, req.body)
    const actual = await prisma.producto.findUnique({ where: { id: pid } })
    if (!actual) throw noEncontrado('El producto')
    await validarRelaciones(d.categoriaId, d.proveedorId)
    if (d.codigo && d.codigo.toLowerCase() !== actual.codigo.toLowerCase() && (await prisma.producto.findFirst({ where: { codigo: { equals: d.codigo, mode: 'insensitive' } } }))) {
      throw conflicto('CODIGO_EXISTE', 'Ya existe un producto con ese código')
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      // HU-09: si cambia el costo o el precio, queda el rastro en el historial.
      const nuevoCosto = d.costo ?? actual.costo
      const nuevoPrecio = d.precio ?? actual.precio
      if (nuevoCosto !== actual.costo || nuevoPrecio !== actual.precio) {
        await tx.historialPrecio.create({
          data: { productoId: pid, costoAnterior: actual.costo, costoNuevo: nuevoCosto, precioAnterior: actual.precio, precioNuevo: nuevoPrecio, usuarioId: yo.id },
        })
      }
      return tx.producto.update({
        where: { id: pid },
        // La búsqueda mezcla nombre y descripción; si solo cambia uno, se completa con el otro guardado.
        data: { ...d, ...(d.nombre !== undefined || d.descripcion !== undefined ? { busqueda: normalizar(`${d.nombre ?? actual.nombre} ${(d.descripcion === undefined ? actual.descripcion : d.descripcion) ?? ''}`) } : {}) },
        include: incluir,
      })
    })
    res.json(actualizado)
  })

  /** Borra el archivo viejo de una foto (si existe). Solo toca archivos dentro de la carpeta de fotos. */
  async function borrarFoto(url: string | null) {
    if (!url?.startsWith('/uploads/')) return
    await unlink(join(uploadsDir, basename(url))).catch(() => {})
  }

  // Foto del producto: el cuerpo es la imagen cruda (no multipart). El nombre lo genera el servidor, nunca el cliente.
  r.post(
    '/:id/imagen',
    requerirRol('DUENO'),
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '3mb' }),
    async (req, res) => {
      const pid = validar(id, req.params.id)
      const actual = await prisma.producto.findUnique({ where: { id: pid } })
      if (!actual) throw noEncontrado('El producto')
      const cuerpo = req.body as unknown
      if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) throw new ErrorApp(400, 'IMAGEN_INVALIDA', 'Envía una imagen PNG, JPG o WebP')
      const tipo = tipoDeImagen(cuerpo)
      if (!tipo) throw new ErrorApp(400, 'IMAGEN_INVALIDA', 'El archivo no es una imagen PNG, JPG o WebP válida')
      await mkdir(uploadsDir, { recursive: true })
      const nombre = `${randomBytes(12).toString('hex')}.${tipo}`
      await writeFile(join(uploadsDir, nombre), cuerpo)
      const p = await prisma.producto.update({ where: { id: pid }, data: { imagen: `/uploads/${nombre}` }, include: incluir })
      await borrarFoto(actual.imagen)
      res.json(p)
    },
  )

  r.delete('/:id/imagen', requerirRol('DUENO'), async (req, res) => {
    const pid = validar(id, req.params.id)
    const actual = await prisma.producto.findUnique({ where: { id: pid } })
    if (!actual) throw noEncontrado('El producto')
    const p = await prisma.producto.update({ where: { id: pid }, data: { imagen: null }, include: incluir })
    await borrarFoto(actual.imagen)
    res.json(p)
  })

  r.get('/:id/historial-precios', requerirRol('DUENO'), async (req, res) => {
    const pid = validar(id, req.params.id)
    res.json(await prisma.historialPrecio.findMany({ where: { productoId: pid }, orderBy: { creadoEn: 'desc' }, take: 100, include: { usuario: { select: { nombre: true } } } }))
  })

  r.get('/:id/movimientos', requerirRol('DUENO'), async (req, res) => {
    const pid = validar(id, req.params.id)
    res.json(await prisma.movimientoStock.findMany({ where: { productoId: pid }, orderBy: { creadoEn: 'desc' }, take: 200, include: { usuario: { select: { nombre: true } } } }))
  })

  return r
}
