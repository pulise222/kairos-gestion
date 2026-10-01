import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync, strFromU8, strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { crearCopia, haceFaltaCopiaAuto, listarCopias } from '../src/lib/copias.js'
import { api, auth, baseLimpia, carpetaCopias, carpetaFotos, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

// Cada prueba parte con las carpetas de fotos y de copias vacías (la base ya la limpia baseLimpia).
beforeEach(() => {
  for (const carpeta of [carpetaFotos, carpetaCopias]) for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { recursive: true, force: true })
})

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)])
const opciones = { prisma, carpeta: carpetaCopias, fotos: carpetaFotos }
const vender = (token: string, productoId: number, cantidad: number) =>
  api().post('/api/ventas').set(auth(token)).send({ items: [{ productoId, cantidad }], pagado: 1_000_000 })

/** Foto de verdad subida por la API (queda en la carpeta de fotos y referenciada por el producto). */
async function conFoto(token: string, id: number) {
  return (await api().post(`/api/productos/${id}/imagen`).set(auth(token)).set('Content-Type', 'image/png').send(PNG).expect(200)).body.imagen as string
}

describe('copias de seguridad', () => {
  it('crea un .zip verificado con todas las tablas y las fotos, y aparece en la lista', async () => {
    const { token } = await crearDueno()
    const p = await crearProducto(token, { stockInicial: 10 })
    await conFoto(token, p.id)
    await vender(token, p.id, 2).expect(201)

    const r = await api().post('/api/copias').set(auth(token)).expect(201)
    expect(r.body).toMatchObject({ tipo: 'manual', fotos: 1, copiaExtra: 'sin_configurar' })
    expect(r.body.filas).toBeGreaterThan(5)
    expect(existsSync(join(carpetaCopias, r.body.nombre))).toBe(true)
    expect(readdirSync(carpetaCopias).filter((f) => f.endsWith('.tmp'))).toEqual([]) // no quedan temporales

    const lista = (await api().get('/api/copias').set(auth(token)).expect(200)).body
    expect(lista.copias.map((c: { nombre: string }) => c.nombre)).toContain(r.body.nombre)
  })

  it('RESTAURAR: deja todo exactamente como estaba (stock, ventas, fotos) y los ids siguen sin chocar', async () => {
    const { token } = await crearDueno()
    const p = await crearProducto(token, { nombre: 'Agua', stockInicial: 10, precio: 1000 })
    const foto = await conFoto(token, p.id)
    await vender(token, p.id, 3).expect(201) // stock 7, 1 venta
    const copia = (await api().post('/api/copias').set(auth(token)).expect(201)).body.nombre as string

    // Después de la copia pasan cosas: más ventas, otro producto, se cambia el precio y se quita la foto.
    await vender(token, p.id, 4).expect(201)
    await crearProducto(token, { nombre: 'Intruso' })
    await api().patch(`/api/productos/${p.id}`).set(auth(token)).send({ precio: 9999 }).expect(200)
    await api().delete(`/api/productos/${p.id}/imagen`).set(auth(token)).expect(200)
    expect(existsSync(join(carpetaFotos, foto.replace('/uploads/', '')))).toBe(false)

    const r = await api().post(`/api/copias/${copia}/restaurar`).set(auth(token)).send({ confirmacion: 'RESTAURAR' }).expect(200)
    expect(r.body.fotos).toBe(1)
    expect(r.body.copiaPrevia).toMatch(/-previa\.zip$/)

    const prod = await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })
    expect(prod).toMatchObject({ stock: 7, precio: 1000, imagen: foto })
    expect(await prisma.producto.count()).toBe(1) // «Intruso» ya no existe
    expect(await prisma.venta.count()).toBe(1)
    expect(existsSync(join(carpetaFotos, foto.replace('/uploads/', '')))).toBe(true) // la foto volvió

    // El stock sigue siendo la suma de sus movimientos.
    const suma = await prisma.movimientoStock.aggregate({ where: { productoId: p.id }, _sum: { cantidad: true } })
    expect(suma._sum.cantidad).toBe(7)

    // Los contadores continúan: una venta y un producto nuevos no chocan con los ids restaurados.
    const v = await vender(token, p.id, 1).expect(201)
    expect(v.body.numero).toBe(2)
    const nuevo = await crearProducto(token, { nombre: 'Nuevo' })
    expect(nuevo.id).toBeGreaterThan(p.id)
    // La sesión sigue funcionando (el usuario volvió con la copia).
    await api().get('/api/auth/yo').set(auth(token)).expect(200)
  })

  it('la restauración deja antes una copia «previa» del estado que se va a reemplazar', async () => {
    const { token } = await crearDueno()
    const p = await crearProducto(token, { stockInicial: 5 })
    const copia = (await api().post('/api/copias').set(auth(token)).expect(201)).body.nombre as string
    await vender(token, p.id, 1).expect(201)
    const r = (await api().post(`/api/copias/${copia}/restaurar`).set(auth(token)).send({ confirmacion: 'RESTAURAR' }).expect(200)).body
    // La previa guarda el estado de ANTES de restaurar (con la venta): se puede volver atrás.
    const previa = unzipSync(new Uint8Array(await (await import('node:fs/promises')).readFile(join(carpetaCopias, r.copiaPrevia))))
    const datos = JSON.parse(strFromU8(previa['datos.json']!))
    expect(datos.tablas.venta).toHaveLength(1)
  })

  it('exige la palabra de confirmación y solo el dueño puede usar las copias', async () => {
    const { token } = await crearDueno()
    const v = await crearVendedor(token)
    const copia = (await api().post('/api/copias').set(auth(token)).expect(201)).body.nombre as string
    await api().post(`/api/copias/${copia}/restaurar`).set(auth(token)).send({}).expect(400)
    await api().post(`/api/copias/${copia}/restaurar`).set(auth(token)).send({ confirmacion: 'si' }).expect(400)
    await api().get('/api/copias').set(auth(v.token)).expect(403)
    await api().post('/api/copias').set(auth(v.token)).expect(403)
    await api().post(`/api/copias/${copia}/restaurar`).set(auth(v.token)).send({ confirmacion: 'RESTAURAR' }).expect(403)
    await api().get('/api/copias').expect(401)
  })

  it('nombres con rutas raras no sirven para leer archivos fuera de la carpeta', async () => {
    const { token } = await crearDueno()
    for (const n of ['..%2F..%2F.env', 'datos.json', 'nivel-copia-x-auto.zip', '..%5C..%5Cwindows']) {
      const r = await api().get(`/api/copias/${n}/descargar`).set(auth(token))
      expect(r.status).toBe(404)
    }
  })

  it('una copia dañada o de otra versión se rechaza SIN tocar los datos', async () => {
    const { token } = await crearDueno()
    const p = await crearProducto(token, { stockInicial: 5 })
    const buena = (await api().post('/api/copias').set(auth(token)).expect(201)).body.nombre as string

    writeFileSync(join(carpetaCopias, 'nivel-copia-20200101-000000-manual.zip'), Buffer.from('esto no es un zip'))
    const mala = await api().post('/api/copias/nivel-copia-20200101-000000-manual.zip/restaurar').set(auth(token)).send({ confirmacion: 'RESTAURAR' })
    expect(mala.status).toBe(422)
    expect(mala.body.error.codigo).toBe('COPIA_DANADA')

    // Misma copia pero marcada con otra versión del esquema.
    const z = unzipSync(new Uint8Array(await (await import('node:fs/promises')).readFile(join(carpetaCopias, buena))))
    const datos = JSON.parse(strFromU8(z['datos.json']!))
    datos.esquema = '19990101000000_antigua'
    writeFileSync(join(carpetaCopias, 'nivel-copia-20200102-000000-manual.zip'), zipSync({ 'datos.json': strToU8(JSON.stringify(datos)) }))
    const vieja = await api().post('/api/copias/nivel-copia-20200102-000000-manual.zip/restaurar').set(auth(token)).send({ confirmacion: 'RESTAURAR' })
    expect(vieja.status).toBe(422)
    expect(vieja.body.error.codigo).toBe('COPIA_OTRA_VERSION')

    expect((await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(5) // nada cambió
  })

  it('si una restauración falla a la mitad, la base queda como estaba (transacción)', async () => {
    const { token } = await crearDueno()
    const p = await crearProducto(token, { stockInicial: 5 })
    const buena = (await api().post('/api/copias').set(auth(token)).expect(201)).body.nombre as string
    await vender(token, p.id, 2).expect(201) // stock 3 y 1 venta

    // Se daña una fila de la copia (un producto con una categoría que no existe: viola la llave foránea).
    const z = unzipSync(new Uint8Array(await (await import('node:fs/promises')).readFile(join(carpetaCopias, buena))))
    const datos = JSON.parse(strFromU8(z['datos.json']!))
    datos.tablas.producto[0].categoria_id = 99999
    writeFileSync(join(carpetaCopias, 'nivel-copia-20200103-000000-manual.zip'), zipSync({ 'datos.json': strToU8(JSON.stringify(datos)) }))

    const r = await api().post('/api/copias/nivel-copia-20200103-000000-manual.zip/restaurar').set(auth(token)).send({ confirmacion: 'RESTAURAR' })
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3) // intacto
    expect(await prisma.venta.count()).toBe(1)
  })

  it('descargar entrega el .zip', async () => {
    const { token } = await crearDueno()
    const copia = (await api().post('/api/copias').set(auth(token)).expect(201)).body.nombre as string
    const r = await api().get(`/api/copias/${copia}/descargar`).set(auth(token)).buffer(true).parse((res, cb) => {
      const trozos: Buffer[] = []
      res.on('data', (t: Buffer) => trozos.push(t))
      res.on('end', () => cb(null, Buffer.concat(trozos)))
    }).expect(200)
    expect(r.headers['content-type']).toContain('application/zip')
    expect(Object.keys(unzipSync(new Uint8Array(r.body as Buffer)))).toContain('datos.json')
  })
})

describe('rotación, segunda carpeta y programación', () => {
  it('conserva solo las últimas 5 copias «previa» (y borra las más viejas)', async () => {
    await crearDueno()
    const base = new Date('2026-09-01T12:00:00Z').getTime()
    for (let i = 0; i < 7; i++) await crearCopia(opciones, 'previa', new Date(base + i * 3_600_000))
    const previas = (await listarCopias(carpetaCopias)).filter((c) => c.tipo === 'previa')
    expect(previas).toHaveLength(5)
    // Se quedaron las más recientes.
    expect(previas[0]!.creadaEn > previas[4]!.creadaEn).toBe(true)
    expect(previas.map((c) => c.creadaEn)).toContain(new Date(base + 6 * 3_600_000).toISOString())
  })

  it('repite la copia en la carpeta extra, y si esa carpeta falla avisa sin perder la copia principal', async () => {
    await crearDueno()
    const extra = join(carpetaCopias, 'extra-ok')
    const ok = await crearCopia({ ...opciones, carpetaExtra: extra }, 'manual', new Date('2026-09-02T12:00:00Z'))
    expect(ok.copiaExtra).toBe('ok')
    expect(existsSync(join(extra, ok.nombre))).toBe(true)

    // Una "carpeta" que en realidad es un archivo no se puede usar como destino.
    const archivo = join(carpetaCopias, 'soy-un-archivo')
    writeFileSync(archivo, 'x')
    const mal = await crearCopia({ ...opciones, carpetaExtra: join(archivo, 'dentro') }, 'manual', new Date('2026-09-03T12:00:00Z'))
    expect(mal.copiaExtra).toBe('error')
    expect(existsSync(join(carpetaCopias, mal.nombre))).toBe(true) // la copia principal sí quedó
  })

  it('la copia automática hace falta cuando la última tiene 24 h o más (y no cuenta las manuales)', async () => {
    await crearDueno()
    const t0 = new Date('2026-09-05T08:00:00Z')
    expect(await haceFaltaCopiaAuto(carpetaCopias, t0)).toBe(true) // no hay ninguna automática
    await crearCopia(opciones, 'manual', t0)
    expect(await haceFaltaCopiaAuto(carpetaCopias, t0)).toBe(true) // una manual no cuenta
    await crearCopia(opciones, 'auto', t0)
    expect(await haceFaltaCopiaAuto(carpetaCopias, new Date(t0.getTime() + 23 * 3_600_000))).toBe(false)
    expect(await haceFaltaCopiaAuto(carpetaCopias, new Date(t0.getTime() + 24 * 3_600_000))).toBe(true)
  })

  it('dos copias a la vez: la segunda recibe 409 en vez de pisarse', async () => {
    const { token } = await crearDueno()
    const rs = await Promise.all([1, 2, 3].map(() => api().post('/api/copias').set(auth(token))))
    expect(rs.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1)
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0)
    for (const r of rs.filter((x) => x.status !== 201)) expect(r.body.error.codigo).toBe('OCUPADO')
  })
})
