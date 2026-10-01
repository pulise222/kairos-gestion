import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, beforeEach } from 'vitest'
import { crearApp } from '../src/app.js'
import { crearPrisma } from '../src/db.js'
import { urlPruebas } from './global-setup.js'

export const SECRETO = 'secreto-solo-para-pruebas-automaticas-0123456789'
export const prisma = crearPrisma(urlPruebas())
// Las fotos de las pruebas van a una carpeta temporal, nunca a la real.
export const carpetaFotos = mkdtempSync(join(tmpdir(), 'nivel-fotos-'))
export const carpetaCopias = mkdtempSync(join(tmpdir(), 'nivel-copias-'))
export const app = crearApp({ prisma, jwtSecret: SECRETO, limitarIntentos: false, uploadsDir: carpetaFotos, copiasDir: carpetaCopias })
export const api = () => request(app)

/** Antes de CADA prueba la base queda vacía y los contadores en 1: las pruebas no dependen unas de otras. */
export function baseLimpia() {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE cierre_caja, comentario, movimiento_stock, historial_precio, devolucion_item, devolucion, devolucion_proveedor_item, devolucion_proveedor, venta_item, venta, compra_item, compra, producto, categoria, proveedor, configuracion, usuario RESTART IDENTITY CASCADE',
    )
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })
}

export const CLAVE = 'clave-de-prueba-123'

/** Crea el dueño por el flujo real de primer arranque y devuelve su token. */
export async function crearDueno(opciones: { kairos?: boolean } = {}) {
  const r = await api().post('/api/setup').send({ nombre: 'Juan Dueño', usuario: 'juan', contrasena: CLAVE, nombreNegocio: 'Tienda de prueba' })
  const token = r.body.token as string
  // Las pruebas heredadas del sistema base dan por hecho que los productos llevan inventario y que no se vende sin stock.
  // Los valores por defecto de ESTE cliente (kairos.test.ts) son otros: allí se pide { kairos: true }.
  if (!opciones.kairos) await api().put('/api/configuracion').set(auth(token)).send({ controlarStockPorDefecto: true, permitirVentaSinStock: false, patron: 'curvas', intensidad: 50 })
  return { token, id: r.body.usuario.id as number }
}

export async function crearVendedor(tokenDueno: string, usuario = 'maria') {
  await api().post('/api/usuarios').set(auth(tokenDueno)).send({ nombre: 'María', usuario, contrasena: CLAVE, rol: 'VENDEDOR' }).expect(201)
  const r = await api().post('/api/auth/login').send({ usuario, contrasena: CLAVE }).expect(200)
  return { token: r.body.token as string, id: r.body.usuario.id as number }
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

/** Crea una categoría y un producto listos para usar. */
export async function crearProducto(token: string, datos: Partial<{ nombre: string; codigo: string; costo: number; precio: number; stockInicial: number; stockMinimo: number; categoriaId: number }> = {}) {
  let categoriaId = datos.categoriaId
  if (!categoriaId) {
    const existente = await prisma.categoria.findFirst()
    categoriaId = existente?.id ?? (await api().post('/api/categorias').set(auth(token)).send({ nombre: 'General' }).expect(201)).body.id
  }
  const r = await api()
    .post('/api/productos')
    .set(auth(token))
    .send({ nombre: 'Gaseosa 1.5 L', codigo: `COD${Math.random().toString(36).slice(2, 8)}`, costo: 3200, precio: 4500, stockInicial: 10, stockMinimo: 3, ...datos, categoriaId })
    .expect(201)
  return r.body as { id: number; nombre: string; codigo: string; precio: number; costo: number; stock: number }
}
