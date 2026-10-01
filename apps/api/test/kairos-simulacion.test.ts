import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, prisma } from './ayudas.js'

baseLimpia()

/*
  Simulación de una jornada real de Kairos con pedidos al azar (semilla fija = repetible):
  ventas de productos con y sin control de inventario, ventas por monto, medios de pago mezclados, devoluciones,
  anulaciones y pedidos inválidos a propósito. Al final el CIERRE DEL DÍA y el PANEL deben coincidir con una suma
  independiente hecha directamente sobre las filas de la base de datos.
*/
function azar(semilla: number) {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function jornada(semilla: number, pasos: number) {
  const rnd = azar(semilla)
  const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const elegir = <T,>(l: T[]) => l[Math.floor(rnd() * l.length)]!
  const { token } = await crearDueno({ kairos: true })
  const post = (r: string, c: object) => api().post(`/api/${r}`).set(auth(token)).send(c)

  const secciones: number[] = []
  for (const n of ['Pegantes', 'Soluciones', 'Hilos', 'Agujas']) secciones.push((await post('categorias', { nombre: n })).body.id)
  // 6 productos sin control, 3 con control (con stock inicial), y el producto interno de cada sección
  const productos: { id: number; precio: number; controla: boolean }[] = []
  for (let i = 0; i < 9; i++) {
    const controla = i >= 6
    const precio = entre(2, 40) * 500
    const p = (await post('productos', { nombre: `Producto ${i}`, categoriaId: secciones[i % 4], costo: Math.round(precio * 0.6), precio, controlaStock: controla, stockInicial: controla ? 30 : 0 })).body
    productos.push({ id: p.id, precio, controla })
  }
  const internos = new Map<number, number>()
  for (const s of secciones) internos.set(s, (await api().get(`/api/productos/venta-rapida/${s}`).set(auth(token))).body.id)

  const ventas: { id: number; items: { id: number }[]; anulada: boolean; devuelta: boolean }[] = []
  const no5xx = (estado: number, que: string) => expect(estado, `${que} devolvió un error interno`).toBeLessThan(500)

  for (let paso = 0; paso < pasos; paso++) {
    const x = rnd()
    if (x < 0.6) {
      // venta mezclada: productos normales y/o líneas por monto, con efectivo o transferencia
      const items: { productoId: number; cantidad: number; precio?: number }[] = []
      let total = 0
      for (const _ of Array.from({ length: entre(1, 3) })) {
        if (rnd() < 0.4) {
          const s = elegir(secciones); const monto = entre(1, 60) * 500
          items.push({ productoId: internos.get(s)!, cantidad: 1, precio: monto }); total += monto
        } else {
          const p = elegir(productos); const q = entre(1, 3)
          items.push({ productoId: p.id, cantidad: q }); total += p.precio * q
        }
      }
      const transfer = rnd() < 0.3
      const r = await post('ventas', { items, pagado: transfer ? total : total + entre(0, 4) * 1000, medioPago: transfer ? 'TRANSFERENCIA' : 'EFECTIVO' })
      no5xx(r.status, 'venta')
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      expect(r.body.total).toBe(total)
      ventas.push({ id: r.body.id, items: r.body.items.map((i: { id: number }) => ({ id: i.id })), anulada: false, devuelta: false })
    } else if (x < 0.7 && ventas.length) {
      const v = elegir(ventas)
      const r = await post(`ventas/${v.id}/anular`, { motivo: 'Error' })
      no5xx(r.status, 'anular')
      if (!v.anulada && !v.devuelta) { expect(r.status).toBe(200); v.anulada = true } else expect(r.status).toBeGreaterThanOrEqual(400)
    } else if (x < 0.8 && ventas.length) {
      const v = elegir(ventas)
      const r = await post(`ventas/${v.id}/devoluciones`, { items: [{ ventaItemId: v.items[0]!.id, cantidad: 1, reingresaStock: rnd() < 0.5 }], motivo: 'Cambio', medioReembolso: elegir(['EFECTIVO', 'TRANSFERENCIA']) })
      no5xx(r.status, 'devolución')
      if (!v.anulada && r.status === 201) v.devuelta = true
    } else if (x < 0.9) {
      // pedidos inválidos a propósito: monto en un producto normal, venta por monto sin monto, producto inexistente
      no5xx((await post('ventas', { items: [{ productoId: elegir(secciones.map((s) => internos.get(s)!)), cantidad: 1 }], pagado: 100000 })).status, 'sin monto')
      no5xx((await post('ventas', { items: [{ productoId: 999999, cantidad: 1 }], pagado: 100000 })).status, 'inexistente')
    } else {
      const p = elegir(productos)
      no5xx((await api().patch(`/api/productos/${p.id}`).set(auth(token)).send({ precio: entre(2, 40) * 500 })).status, 'cambio de precio')
      const nuevo = (await api().get(`/api/productos/${p.id}`).set(auth(token))).body
      p.precio = nuevo.precio
    }
  }

  /* ───── comprobaciones: suma independiente sobre las filas de la base ───── */
  const ventasBd = await prisma.venta.findMany({ where: { estado: 'COMPLETADA' } })
  const devsBd = await prisma.devolucion.findMany()
  const efectivoVentas = ventasBd.filter((v) => v.medioPago === 'EFECTIVO').reduce((s, v) => s + v.total, 0)
  const efectivoDev = devsBd.filter((d) => d.medioReembolso === 'EFECTIVO').reduce((s, d) => s + d.total, 0)
  const bruto = ventasBd.reduce((s, v) => s + v.total, 0)
  const devuelto = devsBd.reduce((s, d) => s + d.total, 0)

  const res = (await api().get('/api/cierres/resumen').set(auth(token)).expect(200)).body
  expect(res.efectivoNeto, 'efectivo neto del cierre').toBe(efectivoVentas - efectivoDev)
  expect(res.ventasNetas, 'ventas netas del cierre').toBe(bruto - devuelto)
  expect(res.porSeccion.reduce((s: number, x: { ventas: number }) => s + x.ventas, 0), 'la suma por sección es el total').toBe(bruto - devuelto)
  const panel = (await api().get('/api/panel/resumen').set(auth(token)).expect(200)).body
  expect(panel.periodo.ventas, 'el panel coincide con el cierre').toBe(bruto - devuelto)

  // cerrar con el efectivo exacto debe cuadrar (diferencia 0)
  const cierre = (await post('cierres', { fondoInicial: 50000, efectivoContado: 50000 + efectivoVentas - efectivoDev })).body.cierre
  expect(cierre.diferencia).toBe(0)

  // el inventario: solo los productos CON control tienen movimientos, y su stock = suma de movimientos
  for (const p of productos) {
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })
    const suma = (await prisma.movimientoStock.aggregate({ where: { productoId: p.id }, _sum: { cantidad: true } }))._sum.cantidad ?? 0
    expect(fila.stock, `stock de ${fila.nombre}`).toBe(suma)
    if (!p.controla) expect(await prisma.movimientoStock.count({ where: { productoId: p.id } })).toBe(0)
  }
  // ninguna línea de venta por monto tiene ganancia
  const lineasMonto = await prisma.ventaItem.findMany({ where: { producto: { precioLibre: true } } })
  for (const l of lineasMonto) expect(l.costoUnitario).toBe(l.precioUnitario)
  return { ventas: ventas.length, montos: lineasMonto.length }
}

describe('jornada simulada de Servicios Kairos', () => {
  for (const semilla of [3, 11, 2026]) {
    it(`ventas por producto, sin inventario y por monto, con devoluciones y cierre (semilla ${semilla})`, async () => {
      const r = await jornada(semilla, 90)
      expect(r.ventas).toBeGreaterThan(20)
      expect(r.montos).toBeGreaterThan(5) // la jornada de verdad incluyó ventas por monto
    }, 180_000)
  }
})
