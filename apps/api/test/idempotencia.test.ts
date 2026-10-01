import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

const vender = (token: string, items: { productoId: number; cantidad: number }[], pagado: number, clave?: string) => {
  const r = api().post('/api/ventas').set(auth(token)).send({ items, pagado })
  return clave ? r.set('Idempotency-Key', clave) : r
}
const stockDe = async (id: number) => (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock

describe('ventas idempotentes (doble clic y reintentos de red)', () => {
  it('la MISMA clave dos veces registra UNA sola venta y devuelve la misma', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const clave = randomUUID()

    const primera = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000, clave)
    const segunda = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000, clave)

    expect(primera.status).toBe(201)
    expect(segunda.status).toBe(200) // repetición: no se creó nada nuevo
    expect(segunda.body.id).toBe(primera.body.id)
    expect(segunda.body.numero).toBe(primera.body.numero)
    expect(await prisma.venta.count()).toBe(1)
    expect(await stockDe(p.id)).toBe(8) // se descontó UNA vez, no dos
    expect(await prisma.movimientoStock.count({ where: { tipo: 'VENTA' } })).toBe(1)
  })

  it('DOBLE CLIC real: 5 peticiones simultáneas con la misma clave → 1 venta y todas reciben la misma', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const clave = randomUUID()

    const rs = await Promise.all(Array.from({ length: 5 }, () => vender(dueno.token, [{ productoId: p.id, cantidad: 3 }], 3000, clave)))

    expect(rs.every((r) => r.status === 200 || r.status === 201)).toBe(true)
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(new Set(rs.map((r) => r.body.numero)).size).toBe(1)
    expect(await prisma.venta.count()).toBe(1)
    expect(await stockDe(p.id)).toBe(7)
  })

  it('CASO DIFÍCIL: con la ÚLTIMA unidad, los reintentos con la misma clave reciben la venta, no "sin stock"', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 1 })
    const clave = randomUUID()

    const rs = await Promise.all(Array.from({ length: 4 }, () => vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000, clave)))

    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]) // ninguno 409
    expect(await stockDe(p.id)).toBe(0)
    expect(await prisma.venta.count()).toBe(1)
  })

  it('claves DISTINTAS son ventas distintas (y sin stock suficiente, solo gana una)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 1 })
    const rs = await Promise.all(Array.from({ length: 4 }, () => vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000, randomUUID())))
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(rs.filter((r) => r.status === 409)).toHaveLength(3)
    expect(await stockDe(p.id)).toBe(0)
  })

  it('sin clave todo sigue funcionando como antes (cada petición es una venta)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000).expect(201)
    await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000).expect(201)
    expect(await prisma.venta.count()).toBe(2)
  })

  it('una clave pertenece a quien la usó: otro usuario no puede cobrarla', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const clave = randomUUID()
    await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000, clave).expect(201)

    const r = await vender(vendedor.token, [{ productoId: p.id, cantidad: 1 }], 1000, clave)
    expect(r.status).toBe(409)
    expect(r.body.error.codigo).toBe('CLAVE_EN_USO')
    expect(await prisma.venta.count()).toBe(1)
  })

  it('rechaza claves con formato inválido', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    for (const mala of ['corta', 'tiene espacios y símbolos!!', 'x'.repeat(65)]) {
      const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000, mala)
      expect(r.status).toBe(400)
    }
    expect(await prisma.venta.count()).toBe(0)
  })

  it('un intento que FALLÓ (pago insuficiente) no "quema" la clave: se puede reintentar corregido con la misma clave', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 10 })
    const clave = randomUUID()
    expect((await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 500, clave)).status).toBe(422)
    const r = await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000, clave)
    expect(r.status).toBe(201)
    expect(await prisma.venta.count()).toBe(1)
  })
})

describe('historial de ventas por día (hora de Colombia)', () => {
  it('filtra por días completos: 11:59 p. m. es del día y la medianoche es del siguiente', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, stockInicial: 20 })
    const tarde = (await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)).body
    const medianoche = (await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)).body
    await prisma.$executeRawUnsafe(`UPDATE venta SET creada_en = '2026-03-14 23:59:59-05'::timestamptz WHERE id = ${tarde.id}`)
    await prisma.$executeRawUnsafe(`UPDATE venta SET creada_en = '2026-03-15 00:00:00-05'::timestamptz WHERE id = ${medianoche.id}`)

    const numeros = async (qs: string) => (await api().get(`/api/ventas?${qs}`).set(auth(dueno.token)).expect(200)).body.items.map((v: { id: number }) => v.id)
    expect(await numeros('desde=2026-03-14&hasta=2026-03-14')).toEqual([tarde.id])
    expect(await numeros('desde=2026-03-15&hasta=2026-03-15')).toEqual([medianoche.id])
    expect((await numeros('desde=2026-03-14&hasta=2026-03-15')).sort()).toEqual([tarde.id, medianoche.id].sort())
  })

  it('rechaza fechas mal escritas', async () => {
    const dueno = await crearDueno()
    expect((await api().get('/api/ventas?desde=14-03-2026').set(auth(dueno.token))).status).toBe(400)
  })
})
