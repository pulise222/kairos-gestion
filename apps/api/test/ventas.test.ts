import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

const vender = (token: string, items: { productoId: number; cantidad: number }[], pagado: number, extra = {}) =>
  api().post('/api/ventas').set(auth(token)).send({ items, pagado, ...extra })

const stockDe = async (id: number) => (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock

describe('registrar una venta (HU-11 a HU-14)', () => {
  it('calcula total y vueltas, descuenta stock y deja los movimientos', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const gaseosa = await crearProducto(dueno.token, { nombre: 'Gaseosa', precio: 4500, costo: 3200, stockInicial: 10 })
    const arroz = await crearProducto(dueno.token, { nombre: 'Arroz', precio: 4200, costo: 3300, stockInicial: 40 })

    const r = await vender(vendedor.token, [{ productoId: gaseosa.id, cantidad: 1 }, { productoId: arroz.id, cantidad: 2 }], 20000)

    expect(r.status).toBe(201)
    expect(r.body.total).toBe(12900) // 4.500 + 2 × 4.200
    expect(r.body.vueltas).toBe(7100)
    expect(r.body.numero).toBe(1)
    expect(await stockDe(gaseosa.id)).toBe(9)
    expect(await stockDe(arroz.id)).toBe(38)

    const movimientos = await prisma.movimientoStock.findMany({ where: { ventaId: r.body.id }, orderBy: { productoId: 'asc' } })
    expect(movimientos.map((m) => [m.tipo, m.cantidad, m.stockResultante])).toEqual([['VENTA', -1, 9], ['VENTA', -2, 38]])
  })

  it('el vendedor NO ve costos ni ganancia en la respuesta; el dueño sí', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200 })

    const comoVendedor = await vender(vendedor.token, [{ productoId: p.id, cantidad: 2 }], 9000)
    expect(JSON.stringify(comoVendedor.body)).not.toContain('costoUnitario')
    expect(comoVendedor.body).not.toHaveProperty('ganancia')

    const comoDueno = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 9000)
    expect(comoDueno.body.ganancia).toBe((4500 - 3200) * 2)
  })

  it('usa los precios de la BASE DE DATOS: el cliente no puede fijar su propio precio', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500 })
    const r = await api()
      .post('/api/ventas')
      .set(auth(dueno.token))
      .send({ items: [{ productoId: p.id, cantidad: 1, precio: 1, precioUnitario: 1 }], pagado: 4500, total: 1 })
    expect(r.status).toBe(201)
    expect(r.body.total).toBe(4500)
    expect(r.body.items[0].precioUnitario).toBe(4500)
  })

  it('rechaza pagar de menos y no cambia nada (HU-13)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, stockInicial: 10 })
    const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 8999)
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('PAGO_INSUFICIENTE')
    expect(await stockDe(p.id)).toBe(10)
    expect(await prisma.venta.count()).toBe(0)
  })

  it('con transferencia el pago debe ser exacto', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500 })
    const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 5000, { medioPago: 'TRANSFERENCIA' })
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('PAGO_NO_EXACTO')
    await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 4500, { medioPago: 'TRANSFERENCIA' }).expect(201)
  })

  it('valida los datos: cantidades, decimales, venta vacía, productos inexistentes', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token)
    expect((await vender(dueno.token, [], 1000)).status).toBe(400)
    expect((await vender(dueno.token, [{ productoId: p.id, cantidad: 0 }], 1000)).status).toBe(400)
    expect((await vender(dueno.token, [{ productoId: p.id, cantidad: -3 }], 1000)).status).toBe(400)
    expect((await vender(dueno.token, [{ productoId: p.id, cantidad: 1.5 }], 10000)).status).toBe(400)
    expect((await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 4500.5)).status).toBe(400) // dinero siempre entero
    const noExiste = await vender(dueno.token, [{ productoId: 99999, cantidad: 1 }], 10000)
    expect(noExiste.status).toBe(422)
    expect(noExiste.body.error.codigo).toBe('PRODUCTO_NO_DISPONIBLE')
  })

  it('no vende productos desactivados', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token)
    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)
    const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 10000)
    expect(r.body.error.codigo).toBe('PRODUCTO_NO_DISPONIBLE')
  })

  it('suma las cantidades si el mismo producto viene repetido', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }, { productoId: p.id, cantidad: 3 }], 5000)
    expect(r.body.total).toBe(5000)
    expect(r.body.items).toHaveLength(1)
    expect(await stockDe(p.id)).toBe(5)
  })
})

describe('stock: nunca se descuadra', () => {
  it('no deja vender más de lo que hay y avisa cuánto queda (HU-14)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 2 })
    const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 100000)
    expect(r.status).toBe(409)
    expect(r.body.error.codigo).toBe('STOCK_INSUFICIENTE')
    expect(r.body.error.detalles).toMatchObject({ solicitado: 3, disponible: 2 })
    expect(await stockDe(p.id)).toBe(2)
  })

  it('ATOMICIDAD: si el segundo producto falla, el primero NO se descuenta ni se guarda venta', async () => {
    const dueno = await crearDueno()
    const hay = await crearProducto(dueno.token, { nombre: 'Hay', stockInicial: 10 })
    const noHay = await crearProducto(dueno.token, { nombre: 'No hay', stockInicial: 1 })
    const r = await vender(dueno.token, [{ productoId: hay.id, cantidad: 5 }, { productoId: noHay.id, cantidad: 2 }], 1000000)
    expect(r.status).toBe(409)
    expect(await stockDe(hay.id)).toBe(10) // revertido
    expect(await prisma.venta.count()).toBe(0)
    expect(await prisma.ventaItem.count()).toBe(0)
    // Solo existe el movimiento del stock inicial, ninguno de venta.
    expect(await prisma.movimientoStock.count({ where: { tipo: 'VENTA' } })).toBe(0)
  })

  it('CONCURRENCIA: con 1 unidad y 6 ventas simultáneas, solo UNA se concreta', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 1, precio: 1000 })
    const resultados = await Promise.all(Array.from({ length: 6 }, () => vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)))

    expect(resultados.filter((r) => r.status === 201)).toHaveLength(1)
    expect(resultados.filter((r) => r.status === 409)).toHaveLength(5)
    expect(await stockDe(p.id)).toBe(0) // jamás negativo
    expect(await prisma.venta.count()).toBe(1)
  })

  it('CONCURRENCIA: 10 ventas de 1 unidad con stock 7 → exactamente 7 pasan y el stock queda en 0', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 7, precio: 500 })
    const resultados = await Promise.all(Array.from({ length: 10 }, () => vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 500)))
    expect(resultados.filter((r) => r.status === 201)).toHaveLength(7)
    expect(await stockDe(p.id)).toBe(0)
  })

  it('si el dueño lo permite (configuración), se puede vender sin stock', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 1, precio: 1000 })
    await api().put('/api/configuracion').set(auth(dueno.token)).send({ permitirVentaSinStock: true }).expect(200)
    await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 3000).expect(201)
    expect(await stockDe(p.id)).toBe(-2) // queda en negativo, con rastro en los movimientos
  })

  it('INVARIANTE: el stock de cada producto siempre es la suma de sus movimientos', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { stockInicial: 20, precio: 1000 })
    const b = await crearProducto(dueno.token, { stockInicial: 5, precio: 2000 })
    const venta = await vender(dueno.token, [{ productoId: a.id, cantidad: 4 }, { productoId: b.id, cantidad: 2 }], 100000)
    await vender(dueno.token, [{ productoId: a.id, cantidad: 6 }], 6000).expect(201)
    await api().post(`/api/ventas/${venta.body.id}/anular`).set(auth(dueno.token)).send({ motivo: 'Error de digitación' }).expect(200)
    await api().post('/api/inventario/ajustes').set(auth(dueno.token)).send({ productoId: b.id, nuevoStock: 4, motivo: 'Conteo físico' }).expect(201)

    for (const p of await prisma.producto.findMany()) {
      const suma = await prisma.movimientoStock.aggregate({ where: { productoId: p.id }, _sum: { cantidad: true } })
      expect(suma._sum.cantidad).toBe(p.stock)
    }
  })
})

describe('las ventas pasadas no cambian (copia de precio y costo)', () => {
  it('al subir el precio después, la venta vieja conserva su precio y su ganancia', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200 })
    const venta = (await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 9000)).body

    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ precio: 6000, costo: 5000, nombre: 'Gaseosa renombrada' }).expect(200)

    const despues = (await api().get(`/api/ventas/${venta.id}`).set(auth(dueno.token)).expect(200)).body
    expect(despues.total).toBe(9000)
    expect(despues.items[0]).toMatchObject({ nombreProducto: 'Gaseosa 1.5 L', precioUnitario: 4500, costoUnitario: 3200 })
    expect(despues.ganancia).toBe((4500 - 3200) * 2)
  })
})

describe('anular una venta (HU-16)', () => {
  it('devuelve el stock, guarda el motivo y deja movimientos de anulación', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 10, precio: 1000 })
    const venta = (await vender(dueno.token, [{ productoId: p.id, cantidad: 4 }], 4000)).body
    expect(await stockDe(p.id)).toBe(6)

    const r = await api().post(`/api/ventas/${venta.id}/anular`).set(auth(dueno.token)).send({ motivo: 'El cliente se arrepintió' })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ estado: 'ANULADA', motivoAnulacion: 'El cliente se arrepintió' })
    expect(await stockDe(p.id)).toBe(10)
    const mov = await prisma.movimientoStock.findFirstOrThrow({ where: { tipo: 'ANULACION' } })
    expect(mov).toMatchObject({ cantidad: 4, stockResultante: 10, ventaId: venta.id })
  })

  it('no se puede anular dos veces (ni dos a la vez): el stock vuelve UNA sola vez', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 10, precio: 1000 })
    const venta = (await vender(dueno.token, [{ productoId: p.id, cantidad: 4 }], 4000)).body

    const [a, b, c] = await Promise.all(
      [1, 2, 3].map(() => api().post(`/api/ventas/${venta.id}/anular`).set(auth(dueno.token)).send({ motivo: 'Duplicada' })),
    )
    expect([a, b, c].filter((r) => r.status === 200)).toHaveLength(1)
    expect([a, b, c].filter((r) => r.body.error?.codigo === 'VENTA_YA_ANULADA')).toHaveLength(2)
    expect(await stockDe(p.id)).toBe(10) // no 14, no 18
  })

  it('exige motivo y solo el dueño puede anular', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const p = await crearProducto(dueno.token, { precio: 1000 })
    const venta = (await vender(vendedor.token, [{ productoId: p.id, cantidad: 1 }], 1000)).body

    expect((await api().post(`/api/ventas/${venta.id}/anular`).set(auth(vendedor.token)).send({ motivo: 'x' })).status).toBe(403)
    expect((await api().post(`/api/ventas/${venta.id}/anular`).set(auth(dueno.token)).send({})).status).toBe(400)
    expect((await api().post(`/api/ventas/${venta.id}/anular`).set(auth(dueno.token)).send({ motivo: '   ' })).status).toBe(400)
    expect((await api().post('/api/ventas/99999/anular').set(auth(dueno.token)).send({ motivo: 'x' })).status).toBe(404)
  })
})

describe('historial de ventas', () => {
  it('el vendedor solo ve sus propias ventas; el dueño ve todas', async () => {
    const dueno = await crearDueno()
    const maria = await crearVendedor(dueno.token, 'maria')
    const pedro = await crearVendedor(dueno.token, 'pedro')
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 50 })
    const deMaria = (await vender(maria.token, [{ productoId: p.id, cantidad: 1 }], 1000)).body
    await vender(pedro.token, [{ productoId: p.id, cantidad: 1 }], 1000)

    expect((await api().get('/api/ventas').set(auth(maria.token))).body.total).toBe(1)
    expect((await api().get('/api/ventas').set(auth(dueno.token))).body.total).toBe(2)
    // Pedro intenta ver la venta de María por su id: "no existe".
    expect((await api().get(`/api/ventas/${deMaria.id}`).set(auth(pedro.token))).status).toBe(404)
    expect((await api().get(`/api/ventas/${deMaria.id}`).set(auth(maria.token))).status).toBe(200)
  })
})

describe('la base de datos protege aunque falle el código (restricciones CHECK)', () => {
  it('rechaza precios negativos, ventas que no cuadran y cantidades en cero', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token)
    await expect(prisma.producto.update({ where: { id: p.id }, data: { precio: -1 } })).rejects.toThrow()
    await expect(
      prisma.venta.create({ data: { usuarioId: dueno.id, total: 1000, pagado: 500, vueltas: 0 } }), // pagó menos del total
    ).rejects.toThrow()
    await expect(
      prisma.venta.create({ data: { usuarioId: dueno.id, total: 1000, pagado: 2000, vueltas: 500 } }), // vueltas mal calculadas
    ).rejects.toThrow()
  })
})
