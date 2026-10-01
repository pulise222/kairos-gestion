import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

const crearProveedor = async (token: string) => (await api().post('/api/proveedores').set(auth(token)).send({ nombre: 'Distribuidora Andina' }).expect(201)).body

describe('entradas de mercancía (HU-17)', () => {
  it('sube el stock, actualiza el costo, calcula el total y deja el rastro', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const a = await crearProducto(dueno.token, { nombre: 'A', stockInicial: 2, costo: 1000 })
    const b = await crearProducto(dueno.token, { nombre: 'B', stockInicial: 0, costo: 500 })

    const r = await api()
      .post('/api/compras')
      .set(auth(dueno.token))
      .send({ proveedorId: prov.id, items: [{ productoId: a.id, cantidad: 10, costoUnitario: 1200 }, { productoId: b.id, cantidad: 20, costoUnitario: 500 }] })
    expect(r.status).toBe(201)
    expect(r.body.total).toBe(10 * 1200 + 20 * 500)

    const [pa, pb] = await Promise.all([a.id, b.id].map((id) => prisma.producto.findUniqueOrThrow({ where: { id } })))
    expect(pa).toMatchObject({ stock: 12, costo: 1200 })
    expect(pb).toMatchObject({ stock: 20, costo: 500 })

    // El costo de A cambió (1000 → 1200): queda en el historial. El de B no cambió: no se registra.
    expect(await prisma.historialPrecio.count()).toBe(1)
    const mov = await prisma.movimientoStock.findMany({ where: { compraId: r.body.id }, orderBy: { productoId: 'asc' } })
    expect(mov.map((m) => [m.tipo, m.cantidad, m.stockResultante])).toEqual([['ENTRADA', 10, 12], ['ENTRADA', 20, 20]])
  })

  it('una compra con un producto inexistente no cambia NADA (todo o nada)', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const a = await crearProducto(dueno.token, { stockInicial: 5 })
    const r = await api()
      .post('/api/compras')
      .set(auth(dueno.token))
      .send({ proveedorId: prov.id, items: [{ productoId: a.id, cantidad: 10, costoUnitario: 100 }, { productoId: 99999, cantidad: 1, costoUnitario: 100 }] })
    expect(r.status).toBe(422)
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(5)
    expect(await prisma.compra.count()).toBe(0)
  })

  it('valida: proveedor existente, cantidades positivas y sin productos repetidos', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const a = await crearProducto(dueno.token)
    const enviar = (body: object) => api().post('/api/compras').set(auth(dueno.token)).send(body)
    expect((await enviar({ proveedorId: 999, items: [{ productoId: a.id, cantidad: 1, costoUnitario: 1 }] })).status).toBe(404)
    expect((await enviar({ proveedorId: prov.id, items: [] })).status).toBe(400)
    expect((await enviar({ proveedorId: prov.id, items: [{ productoId: a.id, cantidad: 0, costoUnitario: 1 }] })).status).toBe(400)
    expect((await enviar({ proveedorId: prov.id, items: [{ productoId: a.id, cantidad: 1, costoUnitario: 1 }, { productoId: a.id, cantidad: 2, costoUnitario: 1 }] })).status).toBe(400)
  })
})

describe('ajustes de stock (HU-18)', () => {
  it('conteo físico: fija el stock al valor contado y registra la diferencia con motivo', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 10 })
    const r = await api().post('/api/inventario/ajustes').set(auth(dueno.token)).send({ productoId: p.id, nuevoStock: 7, motivo: 'Conteo del sábado' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ tipo: 'AJUSTE', cantidad: -3, stockResultante: 7, motivo: 'Conteo del sábado' })
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(7)
  })

  it('pérdida por diferencia; y no deja el stock en negativo', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 5 })
    await api().post('/api/inventario/ajustes').set(auth(dueno.token)).send({ productoId: p.id, diferencia: -2, motivo: 'Producto dañado' }).expect(201)
    const r = await api().post('/api/inventario/ajustes').set(auth(dueno.token)).send({ productoId: p.id, diferencia: -10, motivo: 'Exagerado' })
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('STOCK_NEGATIVO')
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3)
  })

  it('exige motivo, no acepta ambos modos a la vez y no acepta ajustes que no cambian nada', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 5 })
    const enviar = (body: object) => api().post('/api/inventario/ajustes').set(auth(dueno.token)).send(body)
    expect((await enviar({ productoId: p.id, nuevoStock: 4 })).status).toBe(400) // sin motivo
    expect((await enviar({ productoId: p.id, nuevoStock: 4, diferencia: -1, motivo: 'x' })).status).toBe(400)
    expect((await enviar({ productoId: p.id, nuevoStock: 5, motivo: 'Igual' })).body.error.codigo).toBe('AJUSTE_SIN_CAMBIO')
    expect((await enviar({ productoId: 9999, nuevoStock: 1, motivo: 'x' })).status).toBe(404)
  })
})

describe('movimientos y resumen (HU-19, HU-20)', () => {
  it('lista los movimientos de un producto y resume cuántos están bajos o agotados', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { codigo: 'a', stockInicial: 50, stockMinimo: 5 })
    await crearProducto(dueno.token, { codigo: 'b', stockInicial: 3, stockMinimo: 5 })
    await crearProducto(dueno.token, { codigo: 'c', stockInicial: 0, stockMinimo: 5 })

    expect((await api().get('/api/inventario/resumen').set(auth(dueno.token))).body).toEqual({ total: 3, bajo: 1, agotado: 1 })
    const m = (await api().get(`/api/inventario/movimientos?productoId=${a.id}`).set(auth(dueno.token)).expect(200)).body
    expect(m.total).toBe(1)
    expect(m.items[0].producto.nombre).toBeTruthy()
  })
})

describe('conteo físico masivo', () => {
  const contar = (token: string, items: { productoId: number; contado: number }[], extra: object = {}) =>
    api().post('/api/inventario/conteo').set(auth(token)).send({ items, ...extra })

  it('ajusta de una vez solo lo que difiere, con un movimiento por producto y el motivo', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { nombre: 'A', stockInicial: 10 })
    const b = await crearProducto(dueno.token, { nombre: 'B', stockInicial: 5 })
    const c = await crearProducto(dueno.token, { nombre: 'C', stockInicial: 0 })
    const r = await contar(dueno.token, [{ productoId: a.id, contado: 8 }, { productoId: b.id, contado: 5 }, { productoId: c.id, contado: 12 }], { motivo: 'Conteo de fin de mes' })
    expect(r.status).toBe(201)
    expect(r.body.sinCambio).toBe(1)
    expect(r.body.cambios).toEqual([
      { productoId: a.id, nombre: 'A', antes: 10, contado: 8, diferencia: -2 },
      { productoId: c.id, nombre: 'C', antes: 0, contado: 12, diferencia: 12 },
    ])
    const stock = async (id: number) => (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock
    expect([await stock(a.id), await stock(b.id), await stock(c.id)]).toEqual([8, 5, 12])
    const movs = await prisma.movimientoStock.findMany({ where: { motivo: 'Conteo de fin de mes' }, orderBy: { productoId: 'asc' } })
    expect(movs.map((m) => [m.tipo, m.cantidad, m.stockResultante])).toEqual([['AJUSTE', -2, 8], ['AJUSTE', 12, 12]])
  })

  it('es todo o nada: si un producto no existe, ninguno cambia', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { stockInicial: 10 })
    const r = await contar(dueno.token, [{ productoId: a.id, contado: 1 }, { productoId: 99999, contado: 3 }])
    expect(r.status).toBe(404)
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(10)
    expect(await prisma.movimientoStock.count({ where: { productoId: a.id } })).toBe(1) // solo el «stock inicial»
  })

  it('valida: sin productos, repetidos, negativos y solo el dueño', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const a = await crearProducto(dueno.token, { stockInicial: 10 })
    expect((await contar(dueno.token, [])).status).toBe(400)
    expect((await contar(dueno.token, [{ productoId: a.id, contado: 1 }, { productoId: a.id, contado: 2 }])).status).toBe(400)
    expect((await contar(dueno.token, [{ productoId: a.id, contado: -1 }])).status).toBe(400)
    expect((await contar(dueno.token, [{ productoId: a.id, contado: 1.5 }])).status).toBe(400)
    expect((await contar(vendedor.token, [{ productoId: a.id, contado: 1 }])).status).toBe(403)
  })

  it('un conteo y una venta a la vez no pierden unidades: el stock final es coherente con los movimientos', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { stockInicial: 20, precio: 1000 })
    await Promise.all([
      contar(dueno.token, [{ productoId: a.id, contado: 15 }]),
      api().post('/api/ventas').set(auth(dueno.token)).send({ items: [{ productoId: a.id, cantidad: 3 }], pagado: 3000 }),
    ])
    const p = await prisma.producto.findUniqueOrThrow({ where: { id: a.id } })
    const suma = await prisma.movimientoStock.aggregate({ where: { productoId: a.id }, _sum: { cantidad: true } })
    expect(p.stock).toBe(suma._sum.cantidad)
  })
})
