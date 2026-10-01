import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

/*
  QA de "tienda real": se simula una semana de trabajo con operaciones mezcladas y al azar
  (ventas, anulaciones, devoluciones de clientes y a proveedores, compras, ajustes, cambios de precio),
  incluyendo pedidos INVÁLIDOS a propósito (vender más de lo que hay, devolver de más...).
  Se lleva un modelo propio del stock y al final se compara con la base de datos y con el panel.
  Reglas que deben cumplirse siempre:
    1. Ninguna petición termina en error 5xx (un error interno es un bug, no una respuesta válida).
    2. El stock de cada producto = suma de sus movimientos = el modelo.
    3. Nunca hay stock negativo.
    4. El panel cuadra con las ventas menos las devoluciones, calculado por otro camino.
  La semilla es fija: si algo falla se puede repetir exactamente el mismo caso.
*/

/** Generador pseudoaleatorio con semilla (mulberry32): mismos números cada vez. */
function azar(semilla: number) {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Venta { id: number; items: { id: number; productoId: number; cantidad: number; devuelto: number }[]; anulada: boolean }

async function simular(semilla: number, pasos: number) {
  const rnd = azar(semilla)
  const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const elegir = <T,>(l: T[]) => l[Math.floor(rnd() * l.length)]!

  const dueno = await crearDueno()
  const vendedor = await crearVendedor(dueno.token)
  const proveedor = (await api().post('/api/proveedores').set(auth(dueno.token)).send({ nombre: 'Andina' }).expect(201)).body.id as number

  // Catálogo inicial: 8 productos con precios y stocks variados.
  const productos: { id: number; precio: number }[] = []
  const stock = new Map<number, number>()
  for (let i = 0; i < 8; i++) {
    const precio = entre(5, 80) * 100
    const p = await crearProducto(dueno.token, { nombre: `Producto ${i}`, codigo: `P${i}`, precio, costo: Math.round(precio * 0.7), stockInicial: entre(0, 30) })
    productos.push({ id: p.id, precio })
    stock.set(p.id, p.stock)
  }

  const ventas: Venta[] = []
  const compras: { id: number; items: Map<number, number>; devuelto: Map<number, number> }[] = []
  const no5xx = (estado: number, que: string) => expect(estado, `${que} devolvió error interno`).toBeLessThan(500)

  for (let paso = 0; paso < pasos; paso++) {
    const accion = rnd()
    const quien = rnd() < 0.7 ? vendedor.token : dueno.token

    if (accion < 0.5) {
      // VENTA de 1 a 3 productos distintos; a veces pide más de lo que hay (debe rechazarse sin cambiar nada).
      const elegidos = [...new Set(Array.from({ length: entre(1, 3) }, () => elegir(productos)))]
      const items = elegidos.map((p) => ({ productoId: p.id, cantidad: entre(1, 4) + (rnd() < 0.1 ? 40 : 0) }))
      const total = items.reduce((s, i) => s + i.cantidad * productos.find((p) => p.id === i.productoId)!.precio, 0)
      const r = await api().post('/api/ventas').set(auth(quien)).send({ items, pagado: total + entre(0, 5) * 1000 })
      no5xx(r.status, 'venta')
      const alcanza = items.every((i) => (stock.get(i.productoId) ?? 0) >= i.cantidad)
      if (alcanza) {
        expect(r.status, 'había stock y debía venderse').toBe(201)
        for (const i of items) stock.set(i.productoId, stock.get(i.productoId)! - i.cantidad)
        ventas.push({ id: r.body.id, anulada: false, items: r.body.items.map((x: { id: number; productoId: number; cantidad: number }) => ({ id: x.id, productoId: x.productoId, cantidad: x.cantidad, devuelto: 0 })) })
      } else {
        expect(r.status, 'no había stock y debía rechazarse').toBe(409)
      }
    } else if (accion < 0.62 && ventas.length) {
      // ANULAR una venta (si ya tiene devoluciones debe rechazarse).
      const v = elegir(ventas)
      const r = await api().post(`/api/ventas/${v.id}/anular`).set(auth(dueno.token)).send({ motivo: 'Error de digitación' })
      no5xx(r.status, 'anulación')
      const conDevoluciones = v.items.some((i) => i.devuelto > 0)
      if (v.anulada || conDevoluciones) expect(r.status).toBeGreaterThanOrEqual(400)
      else {
        expect(r.status).toBe(200)
        v.anulada = true
        for (const i of v.items) stock.set(i.productoId, stock.get(i.productoId)! + i.cantidad)
      }
    } else if (accion < 0.74 && ventas.length) {
      // DEVOLUCIÓN de un cliente: a veces de más (debe rechazarse), a veces con el producto dañado.
      const v = elegir(ventas)
      const linea = elegir(v.items)
      const cantidad = entre(1, linea.cantidad) + (rnd() < 0.15 ? linea.cantidad : 0)
      const danado = rnd() < 0.3
      const r = await api().post(`/api/ventas/${v.id}/devoluciones`).set(auth(dueno.token)).send({ items: [{ ventaItemId: linea.id, cantidad, reingresaStock: !danado }], motivo: 'Cambio de opinión', medioReembolso: 'EFECTIVO' })
      no5xx(r.status, 'devolución de cliente')
      const valida = !v.anulada && linea.devuelto + cantidad <= linea.cantidad
      if (valida) {
        expect(r.status, JSON.stringify(r.body)).toBe(201)
        linea.devuelto += cantidad
        if (!danado) stock.set(linea.productoId, stock.get(linea.productoId)! + cantidad)
      } else expect(r.status).toBeGreaterThanOrEqual(400)
    } else if (accion < 0.84) {
      // COMPRA a un proveedor (entra stock).
      const p = elegir(productos)
      const cantidad = entre(5, 40)
      const r = await api().post('/api/compras').set(auth(dueno.token)).send({ proveedorId: proveedor, items: [{ productoId: p.id, cantidad, costoUnitario: Math.round(p.precio * 0.65) }] })
      no5xx(r.status, 'compra')
      expect(r.status).toBe(201)
      stock.set(p.id, stock.get(p.id)! + cantidad)
      compras.push({ id: r.body.id, items: new Map([[p.id, cantidad]]), devuelto: new Map() })
    } else if (accion < 0.9 && compras.length) {
      // DEVOLUCIÓN A PROVEEDOR de lo que llegó de más: limitada por lo comprado Y por el stock actual.
      const c = elegir(compras)
      const [pid, comprado] = [...c.items.entries()][0]!
      const cantidad = entre(1, comprado) + (rnd() < 0.2 ? comprado : 0)
      const r = await api().post(`/api/proveedores/${proveedor}/devoluciones`).set(auth(dueno.token)).send({ compraId: c.id, items: [{ productoId: pid, cantidad }], motivo: 'SOBRANTE', resolucion: 'NOTA_CREDITO' })
      no5xx(r.status, 'devolución a proveedor')
      const valida = (c.devuelto.get(pid) ?? 0) + cantidad <= comprado && (stock.get(pid) ?? 0) >= cantidad
      if (valida) {
        expect(r.status, JSON.stringify(r.body)).toBe(201)
        c.devuelto.set(pid, (c.devuelto.get(pid) ?? 0) + cantidad)
        stock.set(pid, stock.get(pid)! - cantidad)
      } else expect(r.status).toBeGreaterThanOrEqual(400)
    } else if (accion < 0.95) {
      // AJUSTE por conteo físico (puede ser negativo, nunca debe dejar el stock bajo cero).
      const p = elegir(productos)
      const nuevo = entre(0, 40)
      const r = await api().post('/api/inventario/ajustes').set(auth(dueno.token)).send({ productoId: p.id, nuevoStock: nuevo, motivo: 'Conteo del sábado' })
      no5xx(r.status, 'ajuste')
      if (nuevo !== stock.get(p.id)) {
        expect(r.status).toBe(201)
        stock.set(p.id, nuevo)
      } else expect(r.status).toBe(422) // sin cambio
    } else {
      // CAMBIO DE PRECIO: las ventas ya hechas no deben alterarse (se comprueba al final contra el panel).
      const p = elegir(productos)
      const precio = entre(5, 80) * 100
      await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ precio, costo: Math.round(precio * 0.6) }).expect(200)
      p.precio = precio
    }
  }

  /* ───── Comprobaciones finales ───── */
  for (const p of productos) {
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })
    const suma = await prisma.movimientoStock.aggregate({ where: { productoId: p.id }, _sum: { cantidad: true } })
    expect(fila.stock, `stock del producto ${p.id} contra el modelo`).toBe(stock.get(p.id))
    expect(fila.stock, `stock del producto ${p.id} contra sus movimientos`).toBe(suma._sum.cantidad ?? 0)
    expect(fila.stock).toBeGreaterThanOrEqual(0)
  }

  // Panel contra una suma independiente hecha directamente sobre las filas.
  const vigentes = await prisma.ventaItem.findMany({ where: { venta: { estado: 'COMPLETADA' } } })
  const devueltos = await prisma.devolucionItem.findMany()
  const bruto = vigentes.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
  const gananciaBruta = vigentes.reduce((s, i) => s + i.cantidad * (i.precioUnitario - i.costoUnitario), 0)
  const resta = devueltos.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)
  const restaGanancia = devueltos.reduce((s, i) => s + i.cantidad * (i.precioUnitario - i.costoUnitario), 0)

  const hoy = (await api().get('/api/panel/resumen').set(auth(dueno.token)).expect(200)).body.hoy as string
  const panel = (await api().get('/api/panel/resumen').query({ desde: hoy, hasta: hoy }).set(auth(dueno.token)).expect(200)).body
  expect(panel.periodo.ventas, 'ventas netas del panel').toBe(bruto - resta)
  expect(panel.periodo.ganancia, 'ganancia neta del panel').toBe(gananciaBruta - restaGanancia)

  return { ventas: ventas.length, anuladas: ventas.filter((v) => v.anulada).length, devoluciones: devueltos.length }
}

describe('simulación de una semana en una tienda', () => {
  for (const semilla of [1, 7, 2026]) {
    it(`operaciones mezcladas con pedidos inválidos (semilla ${semilla})`, async () => {
      const r = await simular(semilla, 120)
      // Si la simulación no hizo nada interesante, la prueba no valdría: se exige que haya habido de todo un poco.
      expect(r.ventas).toBeGreaterThan(20)
    }, 180_000)
  }
})

describe('casos de concurrencia en el mostrador', () => {
  it('5 cajas venden a la vez la misma última unidad: solo una venta pasa, el stock queda en 0', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 1, precio: 3000 })
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => api().post('/api/ventas').set(auth(dueno.token)).send({ items: [{ productoId: p.id, cantidad: 1 }], pagado: 3000 })),
    )
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(rs.filter((r) => r.status >= 500)).toHaveLength(0)
    expect((await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0)
  })

  it('un producto desactivado conserva sus ventas históricas y ya no se puede vender', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 5, precio: 2000 })
    const v = (await api().post('/api/ventas').set(auth(dueno.token)).send({ items: [{ productoId: p.id, cantidad: 1 }], pagado: 2000 }).expect(201)).body
    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)
    const r = await api().post('/api/ventas').set(auth(dueno.token)).send({ items: [{ productoId: p.id, cantidad: 1 }], pagado: 2000 })
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(r.status).toBeLessThan(500)
    const detalle = (await api().get(`/api/ventas/${v.id}`).set(auth(dueno.token)).expect(200)).body
    expect(detalle.items[0].nombreProducto).toBe('Gaseosa 1.5 L')
  })

  it('subir el precio mientras otra caja vende no deja ventas con precios mezclados dentro de un mismo recibo', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { stockInicial: 50, precio: 2000, costo: 1000 })
    const [venta] = await Promise.all([
      api().post('/api/ventas').set(auth(dueno.token)).send({ items: [{ productoId: p.id, cantidad: 3 }], pagado: 100000 }),
      api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ precio: 2500 }),
    ])
    expect(venta.status).toBe(201)
    // El total siempre es cantidad × (el precio viejo o el nuevo), nunca una mezcla.
    expect([6000, 7500]).toContain(venta.body.total)
    expect(venta.body.total).toBe(venta.body.items[0].cantidad * venta.body.items[0].precioUnitario)
  })
})
