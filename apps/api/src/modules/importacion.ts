import express, { Router } from 'express'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import { ErrorApp, reglaDeNegocio } from '../errors.js'
import { autenticar, requerirRol, usuarioActual } from '../middleware/auth.js'
import { interpretar, leerFilas, plantillaExcel } from '../lib/importacion.js'
import { normalizar } from '../lib/texto.js'

const COLORES = ['#2f7fb8', '#2e9e8f', '#b8892a', '#7a6bb8', '#c2543f', '#4d9a45', '#a8443c', '#7c3a5a', '#5b8a3a', '#a85a8a', '#3a6a9a', '#9a6a3a']

/*
  Importar productos desde Excel/CSV (solo el dueño).
    GET  /productos/importar/plantilla        → descarga la plantilla .xlsx
    POST /productos/importar                  → VISTA PREVIA: no guarda nada, devuelve filas válidas y errores
    POST /productos/importar?aplicar=true     → guarda TODO en una transacción (si hay un solo error, no guarda nada)
  El cuerpo es el archivo tal cual (sin multipart). El servidor vuelve a validar al aplicar: nunca confía en la vista previa.
*/
export function rutasImportacion(prisma: Prisma, secreto: string) {
  const r = Router()
  // OJO: el permiso va EN CADA RUTA, no con r.use(). Este router se monta en /productos antes que el de productos,
  // y un r.use() le exigiría ser dueño también a GET /productos/:id (el vendedor dejaría de ver productos).
  const soloDueno = [autenticar(prisma, secreto), requerirRol('DUENO')]

  r.get('/importar/plantilla', ...soloDueno, async (_req, res) => {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-productos.xlsx"')
    res.send(await plantillaExcel())
  })

  r.post('/importar', ...soloDueno, express.raw({ type: () => true, limit: '5mb' }), async (req, res) => {
    const yo = usuarioActual(req)
    const aplicar = req.query.aplicar === 'true'
    const cuerpo = req.body as unknown
    if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) throw new ErrorApp(400, 'ARCHIVO_INVALIDO', 'Envía el archivo de Excel (.xlsx) o CSV.')
    const tabla = await leerFilas(cuerpo).catch((e: unknown) => { throw new ErrorApp(400, 'ARCHIVO_INVALIDO', e instanceof Error ? e.message : 'No se pudo leer el archivo.') })

    const contexto = async (db: Pick<Prisma, 'producto' | 'categoria' | 'proveedor'>) => {
      const [productos, categorias, proveedores] = await Promise.all([
        db.producto.findMany({ select: { id: true, codigo: true, nombre: true } }),
        db.categoria.findMany({ select: { id: true, nombre: true, activa: true } }),
        db.proveedor.findMany({ select: { id: true, nombre: true, activo: true } }),
      ])
      return {
        productos, categorias, proveedores,
        ctx: {
          existentes: new Map(productos.map((p) => [p.codigo.toLowerCase(), { id: p.id, nombre: p.nombre }])),
          categorias: new Set(categorias.map((c) => normalizar(c.nombre))),
          proveedores: new Set(proveedores.map((p) => normalizar(p.nombre))),
        },
      }
    }

    if (!aplicar) {
      const { ctx } = await contexto(prisma)
      const v = interpretar(tabla, ctx)
      res.json({ ...v, puedeAplicar: v.errores.length === 0, crear: v.filas.filter((f) => f.accion === 'crear').length, actualizar: v.filas.filter((f) => f.accion === 'actualizar').length })
      return
    }

    const resumen = await prisma.$transaction(async (tx) => {
      // Mismo candado que al crear un producto a mano: dos creaciones a la vez no reciben el mismo código automático.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7002)`
      const { productos, categorias, proveedores, ctx } = await contexto(tx)
      const v = interpretar(tabla, ctx)
      if (v.errores.length) throw reglaDeNegocio('IMPORTACION_CON_ERRORES', `El archivo tiene ${v.errores.length} ${v.errores.length === 1 ? 'error' : 'errores'}: no se guardó nada.`, { errores: v.errores.slice(0, 50) })

      // Categorías y proveedores: se usan los que existen (reactivándolos si estaban apagados) y se crean los que faltan.
      const idCat = new Map(categorias.map((c) => [normalizar(c.nombre), c.id]))
      const idProv = new Map(proveedores.map((p) => [normalizar(p.nombre), p.id]))
      let i = categorias.length
      for (const nombre of v.categoriasNuevas) idCat.set(normalizar(nombre), (await tx.categoria.create({ data: { nombre, color: COLORES[i++ % COLORES.length]! } })).id)
      for (const nombre of v.proveedoresNuevos) idProv.set(normalizar(nombre), (await tx.proveedor.create({ data: { nombre } })).id)
      const reactivar = (await tx.categoria.updateMany({ where: { id: { in: v.filas.map((f) => idCat.get(normalizar(f.categoria))!) }, activa: false }, data: { activa: true } })).count

      // Siguiente código automático: el mayor número corto usado + 1, y se salta los que ya están en uso (en la base o en este archivo).
      const usados = new Set([...productos.map((p) => p.codigo.toLowerCase()), ...v.filas.map((f) => f.codigo?.toLowerCase()).filter((c): c is string => !!c)])
      const [{ sig }] = await tx.$queryRaw<{ sig: number }[]>(PrismaRuntime.sql`SELECT COALESCE(MAX(codigo::int), 0) + 1 AS sig FROM producto WHERE codigo ~ '^[0-9]{1,6}$'`) as [{ sig: number }]
      let siguiente = Number(sig)
      const nuevoCodigo = () => {
        for (;;) {
          const c = String(siguiente++).padStart(4, '0')
          if (!usados.has(c)) { usados.add(c); return c }
        }
      }

      let creados = 0
      let actualizados = 0
      for (const f of v.filas) {
        const categoriaId = idCat.get(normalizar(f.categoria))!
        const proveedorId = f.proveedor ? idProv.get(normalizar(f.proveedor))! : null
        if (f.accion === 'actualizar') {
          const actual = await tx.producto.findUniqueOrThrow({ where: { id: f.productoId! } })
          if (actual.costo !== f.costo || actual.precio !== f.precio) {
            await tx.historialPrecio.create({ data: { productoId: actual.id, costoAnterior: actual.costo, costoNuevo: f.costo, precioAnterior: actual.precio, precioNuevo: f.precio, usuarioId: yo.id } })
          }
          const descripcion = f.descripcion ?? actual.descripcion
          await tx.producto.update({
            where: { id: actual.id },
            data: {
              nombre: f.nombre, categoriaId, costo: f.costo, precio: f.precio, descripcion,
              ...(proveedorId !== null ? { proveedorId } : {}),
              ...(f.minimo !== null ? { stockMinimo: f.minimo } : {}),
              busqueda: normalizar(`${f.nombre} ${descripcion ?? ''}`),
            },
          })
          actualizados++
        } else {
          const p = await tx.producto.create({
            data: {
              codigo: f.codigo ?? nuevoCodigo(), nombre: f.nombre, descripcion: f.descripcion, categoriaId, proveedorId, costo: f.costo, precio: f.precio,
              stockMinimo: f.minimo ?? 0, stock: f.stock, busqueda: normalizar(`${f.nombre} ${f.descripcion ?? ''}`),
            },
          })
          if (f.stock > 0) {
            await tx.movimientoStock.create({ data: { productoId: p.id, tipo: 'AJUSTE', cantidad: f.stock, stockResultante: f.stock, motivo: 'Stock inicial (importación)', usuarioId: yo.id } })
          }
          creados++
        }
      }
      return { creados, actualizados, categoriasNuevas: v.categoriasNuevas, proveedoresNuevos: v.proveedoresNuevos, categoriasReactivadas: reactivar }
    }, { timeout: 120_000 })
    res.status(201).json(resumen)
  })

  return r
}
