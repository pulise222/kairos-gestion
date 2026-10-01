import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, prisma } from './ayudas.js'

baseLimpia()

describe('categorías y proveedores (HU-05, HU-06)', () => {
  it('crea, edita, desactiva y no permite nombres repetidos', async () => {
    const dueno = await crearDueno()
    const c = (await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Bebidas', color: '#2f7fb8' }).expect(201)).body
    expect((await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Bebidas' })).body.error.codigo).toBe('CATEGORIA_EXISTE')
    expect((await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Aseo', color: 'rojo' })).status).toBe(400)

    await api().patch(`/api/categorias/${c.id}`).set(auth(dueno.token)).send({ activa: false }).expect(200)
    expect((await api().get('/api/categorias').set(auth(dueno.token))).body).toHaveLength(0)
    expect((await api().get('/api/categorias?todas=true').set(auth(dueno.token))).body).toHaveLength(1)
  })

  it('valida el correo del proveedor y permite desactivarlo', async () => {
    const dueno = await crearDueno()
    expect((await api().post('/api/proveedores').set(auth(dueno.token)).send({ nombre: 'Andina', correo: 'no-es-correo' })).status).toBe(400)
    const p = (await api().post('/api/proveedores').set(auth(dueno.token)).send({ nombre: 'Andina', telefono: '3001234567', correo: 'a@b.co' }).expect(201)).body
    await api().patch(`/api/proveedores/${p.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)
    expect((await api().get('/api/proveedores').set(auth(dueno.token))).body).toHaveLength(0)
  })
})

describe('productos (HU-07, HU-09)', () => {
  it('el stock inicial queda explicado en un movimiento', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 12 })
    expect(p.stock).toBe(12)
    const mov = await prisma.movimientoStock.findFirstOrThrow({ where: { productoId: p.id } })
    expect(mov).toMatchObject({ tipo: 'AJUSTE', cantidad: 12, stockResultante: 12, motivo: 'Stock inicial' })
  })

  it('el código es único y el stock NO se puede editar por la ficha del producto', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { codigo: '7701' })
    const dup = await api().post('/api/productos').set(auth(dueno.token)).send({ nombre: 'Otro', codigo: '7701', categoriaId: 1, costo: 1, precio: 2 })
    expect(dup.status).toBe(409)
    expect(dup.body.error.codigo).toBe('CODIGO_EXISTE')

    // "stock" no es un campo permitido al editar: .strict() lo rechaza (así el stock siempre tiene rastro).
    const r = await api().patch(`/api/productos/${a.id}`).set(auth(dueno.token)).send({ stock: 9999 })
    expect(r.status).toBe(400)
  })

  it('REGRESIÓN: editar UN campo no toca los demás (antes reiniciaba stockMinimo a 0)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { nombre: 'Original', precio: 4500, costo: 3200, stockMinimo: 7, stockInicial: 10 })
    const r = await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ precio: 5000 }).expect(200)
    expect(r.body).toMatchObject({ nombre: 'Original', precio: 5000, costo: 3200, stockMinimo: 7, stock: 10, activo: true })
    const r2 = await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)
    expect(r2.body).toMatchObject({ stockMinimo: 7, precio: 5000, activo: false })
  })

  it('valida categoría y proveedor, y precios enteros', async () => {
    const dueno = await crearDueno()
    await crearProducto(dueno.token) // crea la categoría 1
    const base = { nombre: 'X', codigo: 'X1', costo: 100, precio: 200 }
    expect((await api().post('/api/productos').set(auth(dueno.token)).send({ ...base, categoriaId: 999 })).status).toBe(404)
    expect((await api().post('/api/productos').set(auth(dueno.token)).send({ ...base, categoriaId: 1, proveedorId: 999 })).status).toBe(404)
    expect((await api().post('/api/productos').set(auth(dueno.token)).send({ ...base, categoriaId: 1, precio: 199.5 })).status).toBe(400)
    expect((await api().post('/api/productos').set(auth(dueno.token)).send({ ...base, categoriaId: 1, precio: -5 })).status).toBe(400)
  })

  it('guarda el historial al cambiar precio o costo, y solo entonces (HU-09)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200 })
    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ nombre: 'Solo cambio el nombre' }).expect(200)
    expect(await prisma.historialPrecio.count()).toBe(0)

    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ precio: 5000 }).expect(200)
    const h = (await api().get(`/api/productos/${p.id}/historial-precios`).set(auth(dueno.token)).expect(200)).body
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ precioAnterior: 4500, precioNuevo: 5000, costoAnterior: 3200, costoNuevo: 3200 })
  })

  it('busca por parte del nombre, SIN importar tildes ni mayúsculas, y por código (HU-11)', async () => {
    const dueno = await crearDueno()
    await crearProducto(dueno.token, { nombre: 'Jabón de baño', codigo: '111' })
    await crearProducto(dueno.token, { nombre: 'Jabón líquido', codigo: '222' })
    await crearProducto(dueno.token, { nombre: 'Arroz Diana', codigo: '333' })
    const buscar = async (q: string) => (await api().get('/api/productos').query({ q }).set(auth(dueno.token)).expect(200)).body.items.map((p: { nombre: string }) => p.nombre)

    expect(await buscar('jabon')).toEqual(['Jabón de baño', 'Jabón líquido'])
    expect(await buscar('JABÓN LIQ')).toEqual(['Jabón líquido'])
    expect(await buscar('diana')).toEqual(['Arroz Diana'])
    expect(await buscar('333')).toEqual(['Arroz Diana'])
    expect(await buscar('nada')).toEqual([])
  })

  it('el lector de código de barras encuentra el producto exacto', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { codigo: '7701234567890' })
    const r = await api().get('/api/productos/codigo/7701234567890').set(auth(dueno.token)).expect(200)
    expect(r.body.id).toBe(p.id)
    expect((await api().get('/api/productos/codigo/0000').set(auth(dueno.token))).status).toBe(404)
  })

  it('filtra por stock bajo y agotado, y pagina', async () => {
    const dueno = await crearDueno()
    await crearProducto(dueno.token, { nombre: 'Bien', stockInicial: 50, stockMinimo: 5, codigo: 'a' })
    await crearProducto(dueno.token, { nombre: 'Bajo', stockInicial: 3, stockMinimo: 5, codigo: 'b' })
    await crearProducto(dueno.token, { nombre: 'Agotado', stockInicial: 0, stockMinimo: 5, codigo: 'c' })
    const nombres = async (qs: string) => (await api().get(`/api/productos?${qs}`).set(auth(dueno.token)).expect(200)).body.items.map((p: { nombre: string }) => p.nombre)

    expect(await nombres('estado=bajo')).toEqual(['Agotado', 'Bajo']) // "bajo" incluye lo agotado
    expect(await nombres('estado=agotado')).toEqual(['Agotado'])
    const pag = (await api().get('/api/productos?porPagina=2&pagina=2').set(auth(dueno.token))).body
    expect(pag).toMatchObject({ total: 3, pagina: 2 })
    expect(pag.items).toHaveLength(1)
  })

  it('los productos desactivados no aparecen para el vendedor ni en el listado normal', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token)
    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)
    expect((await api().get('/api/productos').set(auth(dueno.token))).body.total).toBe(0)
    expect((await api().get('/api/productos?inactivos=true').set(auth(dueno.token))).body.total).toBe(1)
  })
})
