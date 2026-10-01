import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { guardarExcelDiario } from '../src/lib/reporte.js'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

/* Pruebas de lo que es propio de Servicios Kairos: productos sin control de inventario, venta por monto por sección,
   cierre del día, comentarios y el Excel de respaldo. */

const crearSeccion = async (token: string, nombre: string) => (await api().post('/api/categorias').set(auth(token)).send({ nombre }).expect(201)).body.id as number
const nuevoProducto = (token: string, datos: Record<string, unknown>) => api().post('/api/productos').set(auth(token)).send({ nombre: 'Pegante Fénix 1 L', costo: 9000, precio: 12000, ...datos })
const vender = (token: string, items: object[], pagado = 1_000_000, medioPago = 'EFECTIVO') =>
  api().post('/api/ventas').set(auth(token)).send({ items, pagado, medioPago })
const stockDe = async (id: number) => (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock
const movimientos = (id: number) => prisma.movimientoStock.count({ where: { productoId: id } })

describe('ajustes por defecto de este cliente', () => {
  it('los productos nacen sin control de inventario y nunca se frena una venta por falta de stock', async () => {
    const { token } = await crearDueno({ kairos: true })
    const c = (await api().get('/api/configuracion').set(auth(token)).expect(200)).body
    expect(c).toMatchObject({ controlarStockPorDefecto: false, permitirVentaSinStock: true, patron: 'costura' })
  })
})

describe('productos SIN control de inventario', () => {
  it('por defecto nace sin control: el stock inicial se ignora y no deja movimientos', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const p = (await nuevoProducto(token, { categoriaId: cat, stockInicial: 50 }).expect(201)).body
    expect(p).toMatchObject({ controlaStock: false, stock: 0 })
    expect(await movimientos(p.id)).toBe(0)
  })

  it('se vende sin tocar el stock ni dejar movimientos; anular y devolver tampoco los tocan', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const p = (await nuevoProducto(token, { categoriaId: cat }).expect(201)).body
    const v1 = (await vender(token, [{ productoId: p.id, cantidad: 3 }]).expect(201)).body
    expect(v1.total).toBe(36000)
    expect(await stockDe(p.id)).toBe(0)
    expect(await movimientos(p.id)).toBe(0)

    // devolución con producto en buen estado: devuelve el dinero pero no hay stock que reingresar
    await api().post(`/api/ventas/${v1.id}/devoluciones`).set(auth(token)).send({ items: [{ ventaItemId: v1.items[0].id, cantidad: 1, reingresaStock: true }], motivo: 'x', medioReembolso: 'EFECTIVO' }).expect(201)
    expect(await stockDe(p.id)).toBe(0)
    expect(await movimientos(p.id)).toBe(0)

    const v2 = (await vender(token, [{ productoId: p.id, cantidad: 1 }]).expect(201)).body
    await api().post(`/api/ventas/${v2.id}/anular`).set(auth(token)).send({ motivo: 'Error' }).expect(200)
    expect(await stockDe(p.id)).toBe(0)
    expect(await movimientos(p.id)).toBe(0)
  })

  it('no entra a las alertas de stock bajo, ni al resumen de inventario, ni a los filtros de agotados', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    await nuevoProducto(token, { categoriaId: cat, nombre: 'Sin control' }).expect(201)
    await nuevoProducto(token, { categoriaId: cat, nombre: 'Con control', controlaStock: true, stockInicial: 0, stockMinimo: 5 }).expect(201)
    const panel = (await api().get('/api/panel/resumen').set(auth(token)).expect(200)).body
    expect(panel.stockBajo.map((s: { nombre: string }) => s.nombre)).toEqual(['Con control'])
    const res = (await api().get('/api/inventario/resumen').set(auth(token)).expect(200)).body
    expect(res).toMatchObject({ total: 1, agotado: 1 })
    const agotados = (await api().get('/api/productos').query({ estado: 'agotado' }).set(auth(token)).expect(200)).body.items
    expect(agotados.map((p: { nombre: string }) => p.nombre)).toEqual(['Con control'])
  })

  it('entradas, ajustes y conteos se rechazan con un mensaje claro; al activar el control ya funcionan', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const prov = (await api().post('/api/proveedores').set(auth(token)).send({ nombre: 'Fénix' }).expect(201)).body.id
    const p = (await nuevoProducto(token, { categoriaId: cat }).expect(201)).body

    const entrada = await api().post('/api/compras').set(auth(token)).send({ proveedorId: prov, items: [{ productoId: p.id, cantidad: 5, costoUnitario: 9000 }] })
    expect(entrada.status).toBe(422)
    expect(entrada.body.error.codigo).toBe('PRODUCTO_SIN_CONTROL')
    const ajuste = await api().post('/api/inventario/ajustes').set(auth(token)).send({ productoId: p.id, nuevoStock: 3, motivo: 'Conteo' })
    expect(ajuste.body.error.codigo).toBe('PRODUCTO_SIN_CONTROL')
    const conteo = await api().post('/api/inventario/conteo').set(auth(token)).send({ items: [{ productoId: p.id, contado: 4 }] })
    expect(conteo.body.error.codigo).toBe('PRODUCTO_SIN_CONTROL')
    expect(await prisma.compra.count()).toBe(0)

    await api().patch(`/api/productos/${p.id}`).set(auth(token)).send({ controlaStock: true }).expect(200)
    await api().post('/api/compras').set(auth(token)).send({ proveedorId: prov, items: [{ productoId: p.id, cantidad: 5, costoUnitario: 9000 }] }).expect(201)
    expect(await stockDe(p.id)).toBe(5)
  })

  it('un producto CON control sigue descontando stock como siempre', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const p = (await nuevoProducto(token, { categoriaId: cat, controlaStock: true, stockInicial: 10 }).expect(201)).body
    await vender(token, [{ productoId: p.id, cantidad: 4 }]).expect(201)
    expect(await stockDe(p.id)).toBe(6)
    expect(await movimientos(p.id)).toBe(2) // stock inicial + venta
  })

  it('cambiar el ajuste general hace que los productos nuevos nazcan con control', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    await api().put('/api/configuracion').set(auth(token)).send({ controlarStockPorDefecto: true }).expect(200)
    const p = (await nuevoProducto(token, { categoriaId: cat, stockInicial: 7 }).expect(201)).body
    expect(p).toMatchObject({ controlaStock: true, stock: 7 })
  })
})

describe('venta por monto, por sección', () => {
  it('crea el producto interno de la sección una sola vez y mantiene su nombre al día', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const a = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token)).expect(200)).body
    const b = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token)).expect(200)).body
    expect(b.id).toBe(a.id)
    expect(a.nombre).toBe('Venta por monto · Pegantes')
    await api().patch(`/api/categorias/${cat}`).set(auth(token)).send({ nombre: 'Pegantes y soluciones' }).expect(200)
    expect((await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token))).body.nombre).toBe('Venta por monto · Pegantes y soluciones')
    expect(await prisma.producto.count({ where: { esSistema: true } })).toBe(1)
  })

  it('el monto lo escribe quien vende; dos montos de la misma sección quedan como líneas separadas', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Hilos')
    const vr = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token))).body.id as number
    const r = await vender(token, [{ productoId: vr, cantidad: 1, precio: 9000 }, { productoId: vr, cantidad: 1, precio: 5500 }]).expect(201)
    expect(r.body.total).toBe(14500)
    expect(r.body.items.map((i: { precioUnitario: number }) => i.precioUnitario).sort((a: number, b: number) => a - b)).toEqual([5500, 9000])
    // sin costo conocido: no infla la ganancia
    expect(r.body.ganancia).toBe(0)
  })

  it('exige el monto, y en los productos normales ese campo se ignora (manda el precio de la base)', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Hilos')
    const vr = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token))).body.id as number
    const sinMonto = await vender(token, [{ productoId: vr, cantidad: 1 }])
    expect(sinMonto.status).toBe(422)
    expect(sinMonto.body.error.codigo).toBe('MONTO_REQUERIDO')
    expect((await vender(token, [{ productoId: vr, cantidad: 1, precio: 0 }])).status).toBe(422)

    const normal = (await nuevoProducto(token, { categoriaId: cat }).expect(201)).body
    const r = await vender(token, [{ productoId: normal.id, cantidad: 1, precio: 1 }]).expect(201)
    expect(r.body.total).toBe(12000) // el «1» que mandó el cliente no cuenta
  })

  it('no aparece en el catálogo ni en el lector de códigos, y no cuenta como «más vendido» pero sí por sección', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Hilos')
    const vr = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token))).body
    const normal = (await nuevoProducto(token, { categoriaId: cat, nombre: 'Cono de hilo', precio: 9000 }).expect(201)).body
    await vender(token, [{ productoId: vr.id, cantidad: 1, precio: 20000 }, { productoId: normal.id, cantidad: 2 }]).expect(201)

    const lista = (await api().get('/api/productos').set(auth(token))).body.items.map((p: { nombre: string }) => p.nombre)
    expect(lista).toEqual(['Cono de hilo'])
    expect((await api().get(`/api/productos/codigo/VR-${cat}`).set(auth(token))).status).toBe(404)

    const panel = (await api().get('/api/panel/resumen').set(auth(token))).body
    expect(panel.periodo.ventas).toBe(38000)
    expect(panel.masVendidos.map((m: { nombre: string }) => m.nombre)).toEqual(['Cono de hilo'])
    expect(panel.porCategoria).toEqual([expect.objectContaining({ categoria: 'Hilos', ventas: 38000 })])
  })

  it('una sección desactivada o inexistente no sirve para vender por monto', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Hilos')
    await api().patch(`/api/categorias/${cat}`).set(auth(token)).send({ activa: false }).expect(200)
    await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token)).expect(404)
    await api().get('/api/productos/venta-rapida/9999').set(auth(token)).expect(404)
  })

  it('la vendedora también puede vender por monto', async () => {
    const dueno = await crearDueno({ kairos: true })
    const cat = await crearSeccion(dueno.token, 'Agujas')
    const v = await crearVendedor(dueno.token)
    const vr = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(v.token)).expect(200)).body.id as number
    const r = await vender(v.token, [{ productoId: vr, cantidad: 1, precio: 2800 }]).expect(201)
    expect(r.body.total).toBe(2800)
    expect(r.body).not.toHaveProperty('ganancia')
  })
})

/** Mueve una venta o devolución a un instante concreto (hora de Colombia = UTC−5). */
const fijar = (tabla: 'venta' | 'devolucion', id: number, instante: string) => prisma.$executeRawUnsafe(`UPDATE ${tabla} SET creada_en = '${instante}'::timestamptz WHERE id = ${id}`)
const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const sumarDias = (dia: string, d: number) => { const f = new Date(`${dia}T00:00:00Z`); f.setUTCDate(f.getUTCDate() + d); return f.toISOString().slice(0, 10) }

describe('cierre del día', () => {
  async function escenario() {
    const { token } = await crearDueno({ kairos: true })
    const pegantes = await crearSeccion(token, 'Pegantes')
    const hilos = await crearSeccion(token, 'Hilos')
    const peg = (await nuevoProducto(token, { categoriaId: pegantes, precio: 12000 }).expect(201)).body
    const hilo = (await nuevoProducto(token, { categoriaId: hilos, nombre: 'Cono', precio: 9000 }).expect(201)).body
    const e1 = (await vender(token, [{ productoId: peg.id, cantidad: 2 }]).expect(201)).body // 24.000 efectivo
    await vender(token, [{ productoId: hilo.id, cantidad: 1 }]).expect(201) // 9.000 efectivo
    await vender(token, [{ productoId: peg.id, cantidad: 1 }], 12000, 'TRANSFERENCIA').expect(201) // 12.000 transferencia
    const anulada = (await vender(token, [{ productoId: hilo.id, cantidad: 10 }]).expect(201)).body
    await api().post(`/api/ventas/${anulada.id}/anular`).set(auth(token)).send({ motivo: 'Error' }).expect(200)
    // devolución de 1 pegante pagada en efectivo
    await api().post(`/api/ventas/${e1.id}/devoluciones`).set(auth(token)).send({ items: [{ ventaItemId: e1.items[0].id, cantidad: 1, reingresaStock: false }], motivo: 'x', medioReembolso: 'EFECTIVO' }).expect(201)
    return { token, hoy: hoyBogota() }
  }

  it('el resumen suma por medio de pago y por sección, restando devoluciones y sin contar anuladas', async () => {
    const { token } = await escenario()
    const r = (await api().get('/api/cierres/resumen').set(auth(token)).expect(200)).body
    // ventas: 24.000 + 9.000 efectivo, 12.000 transferencia = 45.000; se devolvieron 12.000 en efectivo
    expect(r.porMedio).toEqual({ EFECTIVO: 33000, TRANSFERENCIA: 12000, TARJETA: 0 })
    expect(r.devuelto).toMatchObject({ total: 12000, EFECTIVO: 12000 })
    expect(r.ventasNetas).toBe(33000)
    expect(r.efectivoNeto).toBe(21000)
    expect(r.tickets).toBe(3)
    expect(r.porSeccion.map((s: { nombre: string; ventas: number }) => [s.nombre, s.ventas])).toEqual([['Pegantes', 24000], ['Hilos', 9000]])
    expect(r.cierre).toBeNull()
  })

  it('cuadra: fondo + efectivo neto = lo contado; el servidor calcula lo esperado, no el formulario', async () => {
    const { token } = await escenario()
    const r = await api().post('/api/cierres').set(auth(token)).send({ fondoInicial: 20000, efectivoContado: 41000, nota: 'Todo bien', efectivoEsperado: 1 }).expect(201)
    expect(r.body.cierre).toMatchObject({ efectivoEsperado: 41000, efectivoContado: 41000, diferencia: 0, totalVentas: 33000, tickets: 3, nota: 'Todo bien' })
  })

  it('si falta o sobra dinero, la diferencia lo dice con su signo', async () => {
    const { token } = await escenario()
    expect((await api().post('/api/cierres').set(auth(token)).send({ fondoInicial: 20000, efectivoContado: 39500 }).expect(201)).body.cierre.diferencia).toBe(-1500)
    expect((await api().post('/api/cierres').set(auth(token)).send({ fondoInicial: 20000, efectivoContado: 42000 }).expect(201)).body.cierre.diferencia).toBe(1000)
  })

  it('volver a guardar el mismo día actualiza el cierre (uno por día) y queda en el historial', async () => {
    const { token } = await escenario()
    await api().post('/api/cierres').set(auth(token)).send({ efectivoContado: 10 }).expect(201)
    await api().post('/api/cierres').set(auth(token)).send({ efectivoContado: 21000, nota: 'Corregido' }).expect(201)
    expect(await prisma.cierreCaja.count()).toBe(1)
    const h = (await api().get('/api/cierres').set(auth(token)).expect(200)).body
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ efectivoContado: 21000, diferencia: 0, nota: 'Corregido' })
    const r = (await api().get('/api/cierres/resumen').set(auth(token))).body
    expect(r.cierre.diferencia).toBe(0)
  })

  it('cuenta el día en hora de Colombia: una venta de las 11 p. m. es de ESE día, no del siguiente', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const p = (await nuevoProducto(token, { categoriaId: cat, precio: 5000 }).expect(201)).body
    const v = (await vender(token, [{ productoId: p.id, cantidad: 1 }]).expect(201)).body
    const dia = sumarDias(hoyBogota(), -2)
    await fijar('venta', v.id, `${dia}T23:30:00-05:00`) // 04:30 UTC del día siguiente
    expect((await api().get('/api/cierres/resumen').query({ fecha: dia }).set(auth(token))).body.ventasNetas).toBe(5000)
    expect((await api().get('/api/cierres/resumen').query({ fecha: sumarDias(dia, 1) }).set(auth(token))).body.ventasNetas).toBe(0)
  })

  it('rechaza fechas futuras o de hace más de 31 días, y valores inválidos', async () => {
    const { token } = await crearDueno({ kairos: true })
    const hoy = hoyBogota()
    expect((await api().post('/api/cierres').set(auth(token)).send({ fecha: sumarDias(hoy, 1), efectivoContado: 0 })).body.error.codigo).toBe('FECHA_FUTURA')
    expect((await api().post('/api/cierres').set(auth(token)).send({ fecha: sumarDias(hoy, -40), efectivoContado: 0 })).body.error.codigo).toBe('FECHA_MUY_ANTIGUA')
    await api().post('/api/cierres').set(auth(token)).send({ efectivoContado: -5 }).expect(400)
    await api().post('/api/cierres').set(auth(token)).send({}).expect(400)
    await api().post('/api/cierres').set(auth(token)).send({ fecha: 'ayer', efectivoContado: 0 }).expect(400)
  })

  it('un día sin ventas se puede cerrar (todo en cero) y solo el dueño usa el cierre', async () => {
    const { token } = await crearDueno({ kairos: true })
    const v = await crearVendedor(token)
    const r = await api().post('/api/cierres').set(auth(token)).send({ fondoInicial: 30000, efectivoContado: 30000 }).expect(201)
    expect(r.body.cierre).toMatchObject({ efectivoEsperado: 30000, diferencia: 0, tickets: 0 })
    await api().get('/api/cierres/resumen').set(auth(v.token)).expect(403)
    await api().post('/api/cierres').set(auth(v.token)).send({ efectivoContado: 0 }).expect(403)
    await api().get('/api/cierres').expect(401)
  })
})

describe('comentarios', () => {
  it('cualquiera escribe; solo el dueño los lee y los descarga', async () => {
    const dueno = await crearDueno({ kairos: true })
    const caja = await crearVendedor(dueno.token)
    await api().post('/api/comentarios').set(auth(caja.token)).send({ texto: 'El botón de cobrar es muy pequeño', pantalla: 'Venta' }).expect(201)
    await api().post('/api/comentarios').set(auth(dueno.token)).send({ texto: 'Quiero ver la ganancia del mes' }).expect(201)
    await api().get('/api/comentarios').set(auth(caja.token)).expect(403)
    await api().get('/api/comentarios/descargar').set(auth(caja.token)).expect(403)
    const lista = (await api().get('/api/comentarios').set(auth(dueno.token)).expect(200)).body
    expect(lista.map((c: { texto: string }) => c.texto)).toEqual(['Quiero ver la ganancia del mes', 'El botón de cobrar es muy pequeño'])
    expect(lista[1]).toMatchObject({ pantalla: 'Venta', usuario: 'María' })
    const txt = (await api().get('/api/comentarios/descargar').set(auth(dueno.token)).expect(200)).text
    expect(txt).toContain('El botón de cobrar es muy pequeño')
    expect(txt).toContain('(Venta)')
  })

  it('valida el texto (mínimo y máximo) y exige sesión', async () => {
    const { token } = await crearDueno({ kairos: true })
    await api().post('/api/comentarios').set(auth(token)).send({ texto: 'a' }).expect(400)
    await api().post('/api/comentarios').set(auth(token)).send({ texto: 'x'.repeat(1001) }).expect(400)
    await api().post('/api/comentarios').send({ texto: 'hola hola' }).expect(401)
  })
})

describe('Excel de respaldo', () => {
  it('se guarda uno por día en la carpeta, sin pisar el existente, y se borran los más viejos', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    const p = (await nuevoProducto(token, { categoriaId: cat, precio: 12000 }).expect(201)).body
    await vender(token, [{ productoId: p.id, cantidad: 2 }]).expect(201)
    const carpeta = mkdtempSync(join(tmpdir(), 'nivel-excel-'))
    const hoy = new Date()

    const ruta = await guardarExcelDiario(prisma, carpeta, hoy)
    expect(ruta).toMatch(/Tienda-de-prueba-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(existsSync(ruta!)).toBe(true)
    const tamano = readFileSync(ruta!).length
    expect(await guardarExcelDiario(prisma, carpeta, hoy)).toBeNull() // ya existe: no se vuelve a escribir
    expect(readFileSync(ruta!).length).toBe(tamano)
    expect(readdirSync(carpeta).filter((f) => f.endsWith('.tmp'))).toEqual([])

    // rotación: con 3 archivos viejos y «conservar = 2» solo quedan los 2 más recientes
    for (const d of ['2026-01-01', '2026-01-02', '2026-01-03']) writeFileSync(join(carpeta, `Tienda-de-prueba-${d}.xlsx`), 'x')
    await guardarExcelDiario(prisma, carpeta, hoy, 2)
    const quedan = readdirSync(carpeta).sort()
    expect(quedan).toHaveLength(2)
    expect(quedan.some((f) => f.includes('2026-01-01'))).toBe(false)
  })

  it('el libro trae las hojas de Kairos: por sección, cierres de caja y catálogo con «sin control de inventario»', async () => {
    const { token } = await crearDueno({ kairos: true })
    const cat = await crearSeccion(token, 'Pegantes')
    await nuevoProducto(token, { categoriaId: cat, nombre: 'Pegante sin control', precio: 12000 }).expect(201)
    await nuevoProducto(token, { categoriaId: cat, nombre: 'Pegante con control', controlaStock: true, stockInicial: 8, precio: 9000 }).expect(201)
    const vr = (await api().get(`/api/productos/venta-rapida/${cat}`).set(auth(token))).body.id as number
    await vender(token, [{ productoId: vr, cantidad: 1, precio: 30000 }]).expect(201)
    await api().post('/api/cierres').set(auth(token)).send({ efectivoContado: 30000, nota: 'ok' }).expect(201)

    const r = await api().get('/api/copias/excel').set(auth(token)).buffer(true).parse((res, cb) => {
      const t: Buffer[] = []
      res.on('data', (x: Buffer) => t.push(x)); res.on('end', () => cb(null, Buffer.concat(t)))
    }).expect(200)
    expect(r.headers['content-type']).toContain('spreadsheetml')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(r.body as unknown as ArrayBuffer)
    expect(wb.worksheets.map((h) => h.name)).toEqual(['Resumen', 'Ventas', 'Más vendidos', 'Inventario', 'Por sección', 'Cierres de caja'])
    const seccion = wb.getWorksheet('Por sección')!
    expect([seccion.getRow(2).getCell(1).value, seccion.getRow(2).getCell(2).value]).toEqual(['Pegantes', 30000])
    const cierre = wb.getWorksheet('Cierres de caja')!
    expect(cierre.getRow(2).getCell(5).value).toBe(30000)
    const inv = wb.getWorksheet('Inventario')!
    const estados = [2, 3].map((i) => inv.getRow(i).getCell(10).value)
    expect(estados.sort()).toEqual(['En stock', 'Sin control de inventario'])
    expect(inv.rowCount).toBe(3) // el producto interno de venta por monto NO está
    await api().get('/api/copias/excel').expect(401)
  })
})
