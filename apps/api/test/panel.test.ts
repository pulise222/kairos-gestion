import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

const vender = async (token: string, items: { productoId: number; cantidad: number }[], pagado: number) =>
  (await api().post('/api/ventas').set(auth(token)).send({ items, pagado }).expect(201)).body as { id: number }

/** Mueve una venta a un instante concreto (hora de Colombia = UTC−5, sin horario de verano). */
const fijarFecha = (id: number, instante: string) => prisma.$executeRawUnsafe(`UPDATE venta SET creada_en = '${instante}'::timestamptz WHERE id = ${id}`)

const panel = (token: string, qs = '') => api().get(`/api/panel/resumen${qs}`).set(auth(token))

describe('panel: período por defecto (hoy contra ayer)', () => {
  it('suma ventas, ganancia y tickets de hoy; las anuladas NO cuentan', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200, stockInicial: 100 })

    await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 9000) // 9.000, ganancia 2.600
    await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 5000) // 4.500, ganancia 1.300
    const anulada = await vender(dueno.token, [{ productoId: p.id, cantidad: 10 }], 45000)
    await api().post(`/api/ventas/${anulada.id}/anular`).set(auth(dueno.token)).send({ motivo: 'Error' }).expect(200)

    const r = (await panel(dueno.token).expect(200)).body
    expect(r.periodo).toMatchObject({ dias: 1, ventas: 13500, ganancia: 3900, tickets: 2, ticketPromedio: 6750 })
    expect(r.periodo.desde).toBe(r.hoy)
    expect(r.comparacion).toMatchObject({ ventas: 0, ganancia: 0, tickets: 0 }) // ayer, sin ventas
    expect(r.serie).toHaveLength(1)
  })

  it('usa el precio y costo copiados: cambiar el costo después no altera la ganancia pasada', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 4500, costo: 3200, stockInicial: 10 })
    await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 9000)
    await api().patch(`/api/productos/${p.id}`).set(auth(dueno.token)).send({ costo: 4400 }).expect(200)
    expect((await panel(dueno.token)).body.periodo.ganancia).toBe(2600)
  })

  it('la meta diaria se configura y llega en el resumen', async () => {
    const dueno = await crearDueno()
    await api().put('/api/configuracion').set(auth(dueno.token)).send({ metaDiaria: 1800000 }).expect(200)
    expect((await panel(dueno.token)).body.metaDiaria).toBe(1800000)
  })
})

describe('panel: filtro por rango de fechas', () => {
  it('suma solo las ventas de los días pedidos (ambos extremos incluidos)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, costo: 600, stockInicial: 100 })
    const dias = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13']
    for (const d of dias) await fijarFecha((await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)).id, `${d} 12:00:00-05`)

    const r = (await panel(dueno.token, '?desde=2026-03-11&hasta=2026-03-12').expect(200)).body
    expect(r.periodo).toMatchObject({ desde: '2026-03-11', hasta: '2026-03-12', dias: 2, ventas: 2000, ganancia: 800, tickets: 2 })
  })

  it('la serie trae TODOS los días del rango, con 0 en los días sin ventas', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, costo: 600, stockInicial: 10 })
    await fijarFecha((await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)).id, '2026-03-12 09:00:00-05')

    const r = (await panel(dueno.token, '?desde=2026-03-10&hasta=2026-03-14').expect(200)).body
    expect(r.serie.map((d: { dia: string; ventas: number }) => [d.dia, d.ventas])).toEqual([
      ['2026-03-10', 0], ['2026-03-11', 0], ['2026-03-12', 1000], ['2026-03-13', 0], ['2026-03-14', 0],
    ])
  })

  it('BORDES DE DÍA en hora de Colombia: 11:59 p. m. es del día; medianoche es del siguiente', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, costo: 600, stockInicial: 10 })
    const tarde = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)
    const medianoche = await vender(dueno.token, [{ productoId: p.id, cantidad: 1 }], 1000)
    await fijarFecha(tarde.id, '2026-03-14 23:59:59-05') // en UTC ya sería el 15 (04:59)
    await fijarFecha(medianoche.id, '2026-03-15 00:00:00-05')

    const dia14 = (await panel(dueno.token, '?desde=2026-03-14&hasta=2026-03-14')).body.periodo
    const dia15 = (await panel(dueno.token, '?desde=2026-03-15&hasta=2026-03-15')).body.periodo
    const ambos = (await panel(dueno.token, '?desde=2026-03-14&hasta=2026-03-15')).body.periodo
    expect([dia14.tickets, dia15.tickets, ambos.tickets]).toEqual([1, 1, 2])
  })

  it('un rango largo funciona y el total del rango = suma de la serie', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 500, costo: 300, stockInicial: 100 })
    for (const d of ['2026-01-05', '2026-02-20', '2026-03-15']) await fijarFecha((await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 1000)).id, `${d} 10:00:00-05`)

    const r = (await panel(dueno.token, '?desde=2026-01-01&hasta=2026-03-31').expect(200)).body
    expect(r.periodo.dias).toBe(90)
    expect(r.serie).toHaveLength(90)
    expect(r.serie.reduce((s: number, d: { ventas: number }) => s + d.ventas, 0)).toBe(r.periodo.ventas)
    expect(r.periodo).toMatchObject({ ventas: 3000, tickets: 3 })
  })

  it('más vendidos, ventas por categoría y últimas ventas respetan el rango; el stock bajo no depende de él', async () => {
    const dueno = await crearDueno()
    const bebidas = (await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Bebidas' })).body
    const aseo = (await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Aseo' })).body
    const prov = (await api().post('/api/proveedores').set(auth(dueno.token)).send({ nombre: 'Andina' })).body
    const gaseosa = await crearProducto(dueno.token, { nombre: 'Gaseosa', codigo: 'g', categoriaId: bebidas.id, precio: 4500, stockInicial: 20, stockMinimo: 5 })
    const jabon = await crearProducto(dueno.token, { nombre: 'Jabón', codigo: 'j', categoriaId: aseo.id, precio: 2800, stockInicial: 4, stockMinimo: 5 })
    await api().patch(`/api/productos/${jabon.id}`).set(auth(dueno.token)).send({ proveedorId: prov.id }).expect(200)

    const v1 = await vender(dueno.token, [{ productoId: gaseosa.id, cantidad: 3 }], 20000) // 13.500 (dentro del rango)
    const v2 = await vender(dueno.token, [{ productoId: jabon.id, cantidad: 1 }], 2800) // 2.800 (FUERA del rango)
    await fijarFecha(v1.id, '2026-03-12 10:00:00-05')
    await fijarFecha(v2.id, '2026-02-01 10:00:00-05')

    const r = (await panel(dueno.token, '?desde=2026-03-10&hasta=2026-03-14').expect(200)).body
    expect(r.masVendidos).toEqual([expect.objectContaining({ nombre: 'Gaseosa', unidades: 3, ingresos: 13500 })])
    expect(r.porCategoria.map((c: { categoria: string; ventas: number }) => [c.categoria, c.ventas])).toEqual([['Bebidas', 13500]])
    expect(r.ultimasVentas).toHaveLength(1)
    expect(r.ultimasVentas[0]).toMatchObject({ total: 13500, vendedor: 'Juan Dueño' })
    // El jabón (stock 3 ≤ mínimo 5) aparece aunque su venta quedó fuera del rango.
    expect(r.stockBajo).toEqual([{ id: jabon.id, nombre: 'Jabón', stock: 3, stockMinimo: 5, proveedor: 'Andina' }])
  })
})

describe('panel: comparación con otro período', () => {
  it('por defecto compara con el tramo de igual duración inmediatamente anterior', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, costo: 600, stockInicial: 100 })
    // Rango pedido: 5 al 7 de marzo (3 días). Tramo anterior automático: 2 al 4 de marzo.
    const datos: [string, number][] = [['2026-03-02', 1], ['2026-03-04', 2], ['2026-03-05', 3], ['2026-03-07', 4], ['2026-03-01', 5]]
    for (const [d, c] of datos) await fijarFecha((await vender(dueno.token, [{ productoId: p.id, cantidad: c }], c * 1000)).id, `${d} 12:00:00-05`)

    const r = (await panel(dueno.token, '?desde=2026-03-05&hasta=2026-03-07').expect(200)).body
    expect(r.periodo).toMatchObject({ ventas: 7000 }) // 3 + 4 unidades
    expect(r.comparacion).toMatchObject({ desde: '2026-03-02', hasta: '2026-03-04', dias: 3, ventas: 3000 }) // 1 + 2 unidades (el día 1 queda fuera)
  })

  it('acepta un período de comparación explícito (por ejemplo, el mismo tramo del mes pasado)', async () => {
    const dueno = await crearDueno()
    const p = await crearProducto(dueno.token, { precio: 1000, costo: 600, stockInicial: 100 })
    await fijarFecha((await vender(dueno.token, [{ productoId: p.id, cantidad: 4 }], 4000)).id, '2026-03-10 12:00:00-05')
    await fijarFecha((await vender(dueno.token, [{ productoId: p.id, cantidad: 2 }], 2000)).id, '2026-02-10 12:00:00-05')

    const r = (await panel(dueno.token, '?desde=2026-03-01&hasta=2026-03-15&compararDesde=2026-02-01&compararHasta=2026-02-15').expect(200)).body
    expect(r.periodo.ventas).toBe(4000)
    expect(r.comparacion).toMatchObject({ desde: '2026-02-01', hasta: '2026-02-15', ventas: 2000 })
  })
})

describe('panel: validación de los filtros', () => {
  const rechaza = async (qs: string, estado: number, codigo?: string) => {
    const dueno = await crearDueno()
    const r = await panel(dueno.token, qs)
    expect(r.status).toBe(estado)
    if (codigo) expect(r.body.error.codigo).toBe(codigo)
  }

  it('rango invertido', () => rechaza('?desde=2026-03-15&hasta=2026-03-10', 422, 'RANGO_INVERTIDO'))
  it('rango en el futuro', () => rechaza('?desde=2030-01-01&hasta=2030-01-05', 422, 'RANGO_FUTURO'))
  it('rango de más de 366 días', () => rechaza('?desde=2025-01-01&hasta=2026-03-10', 422, 'RANGO_MUY_LARGO'))
  it('fecha mal escrita', () => rechaza('?desde=15-03-2026&hasta=2026-03-20', 400, 'DATOS_INVALIDOS'))
  it('fecha que no existe (30 de febrero)', () => rechaza('?desde=2026-02-30&hasta=2026-03-20', 400, 'DATOS_INVALIDOS'))
  it('solo "desde" sin "hasta"', () => rechaza('?desde=2026-03-10', 400, 'DATOS_INVALIDOS'))
  it('comparación inválida', () => rechaza('?desde=2026-03-10&hasta=2026-03-12&compararDesde=2026-03-05&compararHasta=2026-03-01', 422, 'RANGO_INVERTIDO'))
  it('comparación incompleta', () => rechaza('?desde=2026-03-10&hasta=2026-03-12&compararDesde=2026-03-01', 400, 'DATOS_INVALIDOS'))

  it('367 días se rechaza y 366 se acepta (borde exacto)', async () => {
    const dueno = await crearDueno()
    expect((await panel(dueno.token, '?desde=2025-03-12&hasta=2026-03-12')).status).toBe(200) // 366 días
    expect((await panel(dueno.token, '?desde=2025-03-11&hasta=2026-03-12')).status).toBe(422) // 367 días
  })

  it('"hasta" = hoy sí se acepta', async () => {
    const dueno = await crearDueno()
    const hoy = (await panel(dueno.token)).body.hoy
    expect((await panel(dueno.token, `?desde=${hoy}&hasta=${hoy}`)).status).toBe(200)
  })

  it('solo el dueño puede ver el panel con filtros', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    expect((await panel(vendedor.token, '?desde=2026-03-10&hasta=2026-03-12')).status).toBe(403)
  })
})

describe('configuración', () => {
  it('trae valores por defecto, acepta cambios parciales y rechaza valores inválidos o campos desconocidos', async () => {
    const dueno = await crearDueno()
    const inicial = (await api().get('/api/configuracion').set(auth(dueno.token)).expect(200)).body
    expect(inicial).toMatchObject({ nombreNegocio: 'Tienda de prueba', moneda: 'COP', permitirVentaSinStock: false, zonaHoraria: 'America/Bogota' })

    const nuevo = (await api().put('/api/configuracion').set(auth(dueno.token)).send({ colorAcento: '#2e9e6b', billetes: [5000, 10000] }).expect(200)).body
    expect(nuevo).toMatchObject({ colorAcento: '#2e9e6b', billetes: [5000, 10000], nombreNegocio: 'Tienda de prueba' })

    expect((await api().put('/api/configuracion').set(auth(dueno.token)).send({ colorAcento: 'verde' })).status).toBe(400)
    expect((await api().put('/api/configuracion').set(auth(dueno.token)).send({ campoInventado: 1 })).status).toBe(400)
  })
})
