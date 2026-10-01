import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

type Item = { id: number; productoId: number }
const vender = async (token: string, items: { productoId: number; cantidad: number }[], pagado: number) =>
  (await api().post('/api/ventas').set(auth(token)).send({ items, pagado }).expect(201)).body as { id: number; items: Item[]; total: number }

const devolver = (token: string, ventaId: number, items: { ventaItemId: number; cantidad: number; reingresaStock?: boolean }[], extra: object = {}, clave?: string) => {
  const r = api().post(`/api/ventas/${ventaId}/devoluciones`).set(auth(token)).send({ items, motivo: 'El cliente se arrepintió', ...extra })
  return clave ? r.set('Idempotency-Key', clave) : r
}
const stockDe = async (id: number) => (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock

/** El stock de cada producto debe ser SIEMPRE la suma de sus movimientos. */
async function stockCuadra() {
  for (const p of await prisma.producto.findMany()) {
    const suma = await prisma.movimientoStock.aggregate({ where: { productoId: p.id }, _sum: { cantidad: true } })
    expect(suma._sum.cantidad ?? 0).toBe(p.stock)
  }
}

describe('devolución de un cliente (parcial o total)', () => {
  it('devuelve parte de la venta: el dinero al precio de la venta, el stock vuelve y queda el movimiento', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 13500) // stock 7

    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }])
    expect(r.status).toBe(201)
    expect(r.body.total).toBe(4500)
    expect(await stockDe(p.id)).toBe(8)

    const mov = await prisma.movimientoStock.findFirstOrThrow({ where: { tipo: 'DEVOLUCION_CLIENTE' } })
    expect(mov).toMatchObject({ cantidad: 1, stockResultante: 8, ventaId: venta.id, motivo: 'El cliente se arrepintió' })
    await stockCuadra()
  })

  it('el detalle de la venta muestra sus devoluciones y la ganancia NETA', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 13500) // ganancia bruta 3 × 1.300 = 3.900
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }]).expect(201)

    const d = (await api().get(`/api/ventas/${venta.id}`).set(auth(dueno.token)).expect(200)).body
    expect(d.devoluciones).toHaveLength(1)
    expect(d.devoluciones[0]).toMatchObject({ total: 4500, items: [{ cantidad: 1, precioUnitario: 4500, nombreProducto: 'Gaseosa 1.5 L' }] })
    expect(d.ganancia).toBe(2 * 1300) // lo devuelto ya no se ganó
  })

  it('devoluciones sucesivas: pueden completar lo vendido, pero NUNCA devolver más', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 3000)
    const linea = venta.items[0]!.id

    await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 1 }]).expect(201)
    await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 2 }]).expect(201) // completa las 3
    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 1 }])
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('DEVOLUCION_EXCEDE')
    expect(r.body.error.detalles).toMatchObject({ vendidas: 3, yaDevueltas: 3, disponible: 0 })
    expect(await stockDe(p.id)).toBe(10) // todo volvió
    await stockCuadra()
  })

  it('no deja devolver más de lo vendido en una sola petición', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 3000)
    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 4 }])
    expect(r.status).toBe(422)
    expect(await stockDe(p.id)).toBe(7) // nada cambió
    expect(await prisma.devolucion.count()).toBe(0)
  })

  it('se devuelve el precio de la VENTA aunque el producto haya subido de precio después', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 9000)
    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ precio: 6000 }).expect(200)

    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 2 }])
    expect(r.body.total).toBe(9000) // no 12.000
  })

  it('producto que vuelve DAÑADO: se devuelve el dinero pero NO entra al inventario', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 2000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 4000) // stock 8

    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1, reingresaStock: false }], { motivo: 'Llegó roto' })
    expect(r.status).toBe(201)
    expect(r.body.total).toBe(2000)
    expect(await stockDe(p.id)).toBe(8) // sigue en 8: no reingresó
    expect(await prisma.movimientoStock.count({ where: { tipo: 'DEVOLUCION_CLIENTE' } })).toBe(0)
    expect((await prisma.devolucionItem.findFirstOrThrow()).reingresaStock).toBe(false)
    await stockCuadra()
  })

  it('devolución con dos productos: mezcla de reingreso y dañado', async () => {
    const dueno = await crearDueno()
    const a = await crearProducto(dueno.token, { nombre: 'A', precio: 1000, stockInicial: 10 })
    const b = await crearProducto(dueno.token, { nombre: 'B', precio: 3000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: a.id, cantidad: 2 }, { productoId: b.id, cantidad: 1 }], 5000)
    const lineaDe = (pid: number) => venta.items.find((i) => i.productoId === pid)!.id

    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: lineaDe(a.id), cantidad: 2 }, { ventaItemId: lineaDe(b.id), cantidad: 1, reingresaStock: false }])
    expect(r.body.total).toBe(2 * 1000 + 3000)
    expect(await stockDe(a.id)).toBe(10) // volvió
    expect(await stockDe(b.id)).toBe(9) // dañado: no volvió
    await stockCuadra()
  })

  it('no se puede devolver sobre una venta ANULADA', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    await api().post(`/api/ventas/${venta.id}/anular`).set(auth(dueno.token)).send({ motivo: 'Error' }).expect(200)
    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }])
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('VENTA_ANULADA')
  })

  it('una venta CON devoluciones ya no se puede anular (el stock se duplicaría)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }]).expect(201)

    const r = await api().post(`/api/ventas/${venta.id}/anular`).set(auth(dueno.token)).send({ motivo: 'Error' })
    expect(r.status).toBe(409)
    expect(r.body.error.codigo).toBe('VENTA_CON_DEVOLUCIONES')
    expect(await stockDe(p.id)).toBe(9)
  })

  it('rechaza una línea que no pertenece a esa venta', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const v1 = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)
    const v2 = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)
    const r = await devolver(dueno.token, v1.id, [{ ventaItemId: v2.items[0]!.id, cantidad: 1 }])
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('LINEA_NO_PERTENECE')
  })

  it('exige motivo, cantidades válidas y no repetir líneas; venta inexistente = 404', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    const linea = venta.items[0]!.id
    expect((await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 1 }], { motivo: '   ' })).status).toBe(400)
    expect((await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 0 }])).status).toBe(400)
    expect((await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 1.5 }])).status).toBe(400)
    expect((await devolver(dueno.token, venta.id, [])).status).toBe(400)
    expect((await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 1 }, { ventaItemId: linea, cantidad: 1 }])).status).toBe(400)
    expect((await devolver(dueno.token, 99999, [{ ventaItemId: linea, cantidad: 1 }])).status).toBe(404)
    expect(await prisma.devolucion.count()).toBe(0)
  })

  it('solo el DUEÑO registra devoluciones (es dinero que sale de la caja)', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(vendedor.token, [{ productoId: p.id, cantidad: 1 }], 1000)
    const r = await devolver(vendedor.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }])
    expect(r.status).toBe(403)
  })

  it('el vendedor ve las devoluciones de sus ventas, pero SIN costos', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const p = await crearProducto(dueno.token, { precio: 1000, costo: 600, stockInicial: 10 })
    const venta = await vender(vendedor.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }]).expect(201)

    const d = (await api().get(`/api/ventas/${venta.id}`).set(auth(vendedor.token)).expect(200)).body
    expect(d.devoluciones).toHaveLength(1)
    expect(JSON.stringify(d)).not.toContain('costoUnitario')
    expect(d).not.toHaveProperty('ganancia')
  })

  it('el reembolso puede ser por transferencia', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)
    const r = await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }], { medioReembolso: 'TRANSFERENCIA' })
    expect(r.body.medioReembolso).toBe('TRANSFERENCIA')
  })
})

describe('devolución de un cliente: doble clic y concurrencia', () => {
  it('la MISMA clave dos veces: una sola devolución y el stock sube UNA vez', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 3000) // stock 7
    const clave = randomUUID()
    const linea = venta.items[0]!.id

    const a = await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 2 }], {}, clave)
    const b = await devolver(dueno.token, venta.id, [{ ventaItemId: linea, cantidad: 2 }], {}, clave)
    expect([a.status, b.status]).toEqual([201, 200])
    expect(b.body.id).toBe(a.body.id)
    expect(await prisma.devolucion.count()).toBe(1)
    expect(await stockDe(p.id)).toBe(9) // 7 + 2, no 11
  })

  it('DOBLE CLIC: 5 peticiones simultáneas con la misma clave → 1 devolución', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 3000)
    const clave = randomUUID()
    const rs = await Promise.all(Array.from({ length: 5 }, () => devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 3 }], {}, clave)))
    expect(rs.every((r) => r.status === 200 || r.status === 201)).toBe(true)
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(await prisma.devolucion.count()).toBe(1)
    expect(await stockDe(p.id)).toBe(10)
  })

  it('dos devoluciones DISTINTAS que juntas excederían lo vendido: solo pasa la que cabe', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    const rs = await Promise.all([1, 2, 3, 4].map(() => devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 2 }], {}, randomUUID())))
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(rs.filter((r) => r.status === 422)).toHaveLength(3)
    expect(await stockDe(p.id)).toBe(10) // 8 + 2, una sola vez
    await stockCuadra()
  })
})

describe('el Panel descuenta las devoluciones', () => {
  it('ventas, ganancia, más vendidos y categorías son NETOS de lo devuelto', async () => {
    const dueno = await crearDueno()
    const cat = (await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Bebidas' })).body
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200, stockInicial: 20, categoriaId: cat.id })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 4 }], 18000) // 18.000, ganancia 5.200
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }]).expect(201) // −4.500, −1.300

    const r = (await api().get('/api/panel/resumen').set(auth(dueno.token)).expect(200)).body
    expect(r.periodo).toMatchObject({ ventas: 13500, devuelto: 4500, ganancia: 3900, tickets: 1 })
    expect(r.periodo.ticketPromedio).toBe(13500)
    expect(r.serie[0]).toMatchObject({ ventas: 13500, ganancia: 3900 })
    expect(r.masVendidos[0]).toMatchObject({ nombre: 'Gaseosa 1.5 L', unidades: 3, ingresos: 13500 })
    expect(r.porCategoria).toEqual([expect.objectContaining({ categoria: 'Bebidas', ventas: 13500 })])
  })

  it('una devolución total deja el producto fuera de los más vendidos', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 2 }]).expect(201)
    const r = (await api().get('/api/panel/resumen').set(auth(dueno.token)).expect(200)).body
    expect(r.periodo.ventas).toBe(0)
    expect(r.masVendidos).toEqual([])
  })

  it('la devolución cuenta el día en que se devolvió el dinero, aunque la venta sea de otro día', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)
    await prisma.$executeRawUnsafe(`UPDATE venta SET creada_en = now() - interval '3 days' WHERE id = ${venta.id}`)
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1 }]).expect(201) // hoy

    const hoy = (await api().get('/api/panel/resumen').set(auth(dueno.token)).expect(200)).body
    expect(hoy.periodo).toMatchObject({ ventas: -1000, devuelto: 1000, tickets: 0 }) // hoy salió dinero y no hubo ventas
  })
})

/* ───────────────────────── Devolución a un proveedor ───────────────────────── */

const crearProveedor = async (token: string, nombre = 'Andina') => (await api().post('/api/proveedores').set(auth(token)).send({ nombre }).expect(201)).body as { id: number }
const comprar = async (token: string, proveedorId: number, items: { productoId: number; cantidad: number; costoUnitario: number }[]) =>
  (await api().post('/api/compras').set(auth(token)).send({ proveedorId, items }).expect(201)).body as { id: number }
const devolverAProveedor = (token: string, proveedorId: number, cuerpo: object, clave?: string) => {
  const r = api().post(`/api/proveedores/${proveedorId}/devoluciones`).set(auth(token)).send({ motivo: 'SOBRANTE', ...cuerpo })
  return clave ? r.set('Idempotency-Key', clave) : r
}

describe('devolución de mercancía a un proveedor', () => {
  it('llegó de más: sale del stock, queda el movimiento y el valor a costo de la compra', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 0 })
    const compra = await comprar(dueno.token, prov.id, [{ productoId: p.id, cantidad: 20, costoUnitario: 3500 }]) // stock 20

    const r = await devolverAProveedor(dueno.token, prov.id, { compraId: compra.id, items: [{ productoId: p.id, cantidad: 5 }], motivo: 'SOBRANTE', resolucion: 'NOTA_CREDITO', nota: 'Pedimos 15 y llegaron 20' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ total: 17500, motivo: 'SOBRANTE', resolucion: 'NOTA_CREDITO', compraId: compra.id })
    expect(await stockDe(p.id)).toBe(15)

    const mov = await prisma.movimientoStock.findFirstOrThrow({ where: { tipo: 'DEVOLUCION_PROVEEDOR' } })
    expect(mov).toMatchObject({ cantidad: -5, stockResultante: 15, compraId: compra.id })
    expect(mov.motivo).toContain('Llegó de más')
    await stockCuadra()
  })

  it('no se puede devolver más de lo comprado (contando devoluciones anteriores)', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 0 })
    const compra = await comprar(dueno.token, prov.id, [{ productoId: p.id, cantidad: 10, costoUnitario: 1000 }])

    await devolverAProveedor(dueno.token, prov.id, { compraId: compra.id, items: [{ productoId: p.id, cantidad: 6 }] }).expect(201)
    const r = await devolverAProveedor(dueno.token, prov.id, { compraId: compra.id, items: [{ productoId: p.id, cantidad: 5 }] })
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('DEVOLUCION_EXCEDE')
    expect(r.body.error.detalles).toMatchObject({ comprados: 10, yaDevueltos: 6, disponible: 4 })
    expect(await stockDe(p.id)).toBe(4)
  })

  it('no se puede devolver lo que YA NO SE TIENE (ya se vendió): el stock jamás queda negativo', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 0, precio: 1000 })
    const compra = await comprar(dueno.token, prov.id, [{ productoId: p.id, cantidad: 10, costoUnitario: 500 }])
    await vender(dueno.token, [{ productoId: p.id, cantidad: 8 }], 8000) // quedan 2

    const r = await devolverAProveedor(dueno.token, prov.id, { compraId: compra.id, items: [{ productoId: p.id, cantidad: 5 }], motivo: 'DANADO' })
    expect(r.status).toBe(409)
    expect(r.body.error.codigo).toBe('STOCK_INSUFICIENTE')
    expect(r.body.error.detalles).toMatchObject({ solicitado: 5, disponible: 2 })
    expect(await stockDe(p.id)).toBe(2)
    expect(await prisma.devolucionProveedor.count()).toBe(0)
  })

  it('ATOMICIDAD: si el segundo producto no alcanza, el primero NO se descuenta', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const a = await crearProducto(dueno.token, { nombre: 'A', stockInicial: 10 })
    const b = await crearProducto(dueno.token, { nombre: 'B', stockInicial: 1 })
    const r = await devolverAProveedor(dueno.token, prov.id, { items: [{ productoId: a.id, cantidad: 5 }, { productoId: b.id, cantidad: 3 }] })
    expect(r.status).toBe(409)
    expect(await stockDe(a.id)).toBe(10)
    expect(await prisma.movimientoStock.count({ where: { tipo: 'DEVOLUCION_PROVEEDOR' } })).toBe(0)
  })

  it('rechaza un producto que no venía en esa compra y una compra de otro proveedor', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const otro = await crearProveedor(dueno.token, 'Otro')
    const p = await crearProducto(dueno.token, { nombre: 'P', stockInicial: 0 })
    const q = await crearProducto(dueno.token, { nombre: 'Q', stockInicial: 10 })
    const compra = await comprar(dueno.token, prov.id, [{ productoId: p.id, cantidad: 5, costoUnitario: 100 }])

    const noVenia = await devolverAProveedor(dueno.token, prov.id, { compraId: compra.id, items: [{ productoId: q.id, cantidad: 1 }] })
    expect(noVenia.body.error.codigo).toBe('PRODUCTO_NO_ESTA_EN_LA_COMPRA')
    const ajena = await devolverAProveedor(dueno.token, otro.id, { compraId: compra.id, items: [{ productoId: p.id, cantidad: 1 }] })
    expect(ajena.body.error.codigo).toBe('COMPRA_DE_OTRO_PROVEEDOR')
  })

  it('sin indicar la compra: usa el costo actual del producto, o el que se indique', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 10, costo: 3200 })
    const a = await devolverAProveedor(dueno.token, prov.id, { items: [{ productoId: p.id, cantidad: 2 }] })
    expect(a.body.total).toBe(6400)
    const b = await devolverAProveedor(dueno.token, prov.id, { items: [{ productoId: p.id, cantidad: 2, costoUnitario: 3000 }] })
    expect(b.body.total).toBe(6000)
    expect(await stockDe(p.id)).toBe(6)
  })

  it('un proveedor DESACTIVADO también admite devoluciones', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 10 })
    await api().patch(`/api/proveedores/${prov.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)
    expect((await devolverAProveedor(dueno.token, prov.id, { items: [{ productoId: p.id, cantidad: 1 }] })).status).toBe(201)
  })

  it('valida los datos y que solo el dueño pueda', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 10 })
    const enviar = (token: string, cuerpo: object) => devolverAProveedor(token, prov.id, cuerpo)
    expect((await enviar(dueno.token, { items: [] })).status).toBe(400)
    expect((await enviar(dueno.token, { items: [{ productoId: p.id, cantidad: 0 }] })).status).toBe(400)
    expect((await enviar(dueno.token, { items: [{ productoId: p.id, cantidad: 1 }, { productoId: p.id, cantidad: 1 }] })).status).toBe(400)
    expect((await enviar(dueno.token, { items: [{ productoId: p.id, cantidad: 1 }], motivo: 'PORQUE_SI' })).status).toBe(400)
    expect((await enviar(dueno.token, { items: [{ productoId: 9999, cantidad: 1 }] })).status).toBe(422)
    expect((await devolverAProveedor(dueno.token, 9999, { items: [{ productoId: p.id, cantidad: 1 }] })).status).toBe(404)
    expect((await enviar(vendedor.token, { items: [{ productoId: p.id, cantidad: 1 }] })).status).toBe(403)
  })

  it('idempotente: la misma clave dos veces (o 5 a la vez) descuenta UNA sola vez', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 10 })
    const clave = randomUUID()
    const rs = await Promise.all(Array.from({ length: 5 }, () => devolverAProveedor(dueno.token, prov.id, { items: [{ productoId: p.id, cantidad: 3 }] }, clave)))
    expect(rs.every((r) => r.status === 200 || r.status === 201)).toBe(true)
    expect(await prisma.devolucionProveedor.count()).toBe(1)
    expect(await stockDe(p.id)).toBe(7)
    await stockCuadra()
  })

  it('el historial del proveedor lista sus devoluciones', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { nombre: 'Gaseosa', stockInicial: 10 })
    await devolverAProveedor(dueno.token, prov.id, { items: [{ productoId: p.id, cantidad: 2 }], motivo: 'VENCIDO', resolucion: 'REPOSICION' }).expect(201)
    const h = (await api().get(`/api/proveedores/${prov.id}/devoluciones`).set(auth(dueno.token)).expect(200)).body
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ motivo: 'VENCIDO', resolucion: 'REPOSICION', items: [{ cantidad: 2, producto: { nombre: 'Gaseosa' } }] })
  })
})

describe('regla de oro tras mezclar todo', () => {
  it('ventas, devoluciones de clientes, compras y devoluciones a proveedores: el stock sigue siendo la suma de sus movimientos', async () => {
    const dueno = await crearDueno()
    const prov = await crearProveedor(dueno.token)
    const p = await crearProducto(dueno.token, { stockInicial: 5, precio: 1000 })
    const compra = await comprar(dueno.token, prov.id, [{ productoId: p.id, cantidad: 20, costoUnitario: 500 }]) // 25
    const venta = await vender(dueno.token, [{ productoId: p.id, cantidad: 6 }], 6000) // 19
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 2 }]).expect(201) // 21
    await devolver(dueno.token, venta.id, [{ ventaItemId: venta.items[0]!.id, cantidad: 1, reingresaStock: false }]).expect(201) // 21 (dañado)
    await devolverAProveedor(dueno.token, prov.id, { compraId: compra.id, items: [{ productoId: p.id, cantidad: 4 }] }).expect(201) // 17
    await api().post('/api/inventario/ajustes').set(auth(dueno.token)).send({ productoId: p.id, nuevoStock: 15, motivo: 'Conteo' }).expect(201) // 15

    expect(await stockDe(p.id)).toBe(15)
    await stockCuadra()
  })
})
