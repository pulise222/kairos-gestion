import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { aEntero, parsearCsv } from '../src/lib/importacion.js'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

const CAB = 'Código;Nombre;Descripción;Categoría;Proveedor;Costo;Precio;Stock;Stock mínimo'
const csv = (...filas: string[]) => Buffer.from([CAB, ...filas].join('\r\n'), 'utf-8')
const vista = (token: string, archivo: Buffer) => api().post('/api/productos/importar').set(auth(token)).set('Content-Type', 'application/octet-stream').send(archivo)
const aplicar = (token: string, archivo: Buffer) => api().post('/api/productos/importar?aplicar=true').set(auth(token)).set('Content-Type', 'application/octet-stream').send(archivo)

describe('lectura de números y CSV', () => {
  it('aEntero acepta pesos con separador de miles y rechaza decimales y letras', () => {
    expect(aEntero('1500')).toBe(1500)
    expect(aEntero('1.500')).toBe(1500)
    expect(aEntero('$ 12,500,000')).toBe(12500000)
    expect(aEntero(' 800 ')).toBe(800)
    expect(aEntero('15.5')).toBeNull()
    expect(aEntero('1.5')).toBeNull()
    expect(aEntero('abc')).toBeNull()
    expect(aEntero('-3')).toBeNull()
    expect(aEntero('')).toBeNull()
  })
  it('parsearCsv entiende «;», comillas con separador adentro y comillas dobles', () => {
    expect(parsearCsv('a;b;c\r\n1;"x;y";"di ""hola"""\n')).toEqual([['a', 'b', 'c'], ['1', 'x;y', 'di "hola"']])
    expect(parsearCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]) // coma
    expect(parsearCsv('a;b\n\n;\n1;2')).toEqual([['a', 'b'], ['1', '2']]) // ignora filas vacías
  })
})

describe('vista previa (no guarda nada)', () => {
  it('distingue crear de actualizar, avisa categorías y proveedores nuevos y no toca la base', async () => {
    const { token } = await crearDueno()
    const existente = await crearProducto(token, { nombre: 'Gaseosa vieja', codigo: 'G1', precio: 4000, costo: 3000, stockInicial: 5 })
    const antes = await prisma.producto.count()
    const r = await vista(token, csv(
      'G1;Gaseosa 1.5 L;;Bebidas;;3.200;4.500;99;4', // actualiza (el stock se ignora)
      ';Agua 600 ml;Botella sin gas;Bebidas;Andina;800;1500;24;6', // crea sin código
      'APEQ1;Cuaderno;;Papelería;;2800;4500;10;',
    ))
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ puedeAplicar: true, crear: 2, actualizar: 1, errores: [] })
    expect(r.body.categoriasNuevas.sort()).toEqual(['Bebidas', 'Papelería'])
    expect(r.body.proveedoresNuevos).toEqual(['Andina'])
    const g1 = r.body.filas.find((f: { codigo: string }) => f.codigo === 'G1')
    expect(g1).toMatchObject({ accion: 'actualizar', productoId: existente.id, fila: 2 })
    expect(g1.avisos.join(' ')).toContain('Conteo físico')
    expect(await prisma.producto.count()).toBe(antes)
    expect(await prisma.categoria.count()).toBe(1) // solo la «General» de crearProducto
  })

  it('marca cada error con su fila y su columna', async () => {
    const { token } = await crearDueno()
    const r = await vista(token, csv(
      ';;;Bebidas;;1000;2000;;', // sin nombre
      ';Sin precio;;Bebidas;;1000;;;', // sin precio
      ';Decimal;;Bebidas;;10,5;2000;;', // costo decimal
      'AB CD;Código con espacio;;Bebidas;;1;2;;',
      ';Sin categoría;;;;1;2;;',
      'X1;Uno;;Bebidas;;1;2;;',
      'x1;Repetido;;Bebidas;;1;2;;', // mismo código (otra mayúscula)
    ))
    expect(r.body.puedeAplicar).toBe(false)
    const por = (fila: number) => r.body.errores.filter((e: { fila: number }) => e.fila === fila).map((e: { campo: string }) => e.campo)
    expect(por(2)).toEqual(['Nombre'])
    expect(por(3)).toEqual(['Precio'])
    expect(por(4)).toEqual(['Costo'])
    expect(por(5)).toEqual(['Código'])
    expect(por(6)).toEqual(['Categoría'])
    expect(por(8)).toEqual(['Código']) // el duplicado dentro del archivo
    expect(r.body.errores.find((e: { fila: number }) => e.fila === 8).mensaje).toContain('fila 7')
  })

  it('encabezados incompletos o archivo vacío dan un error claro', async () => {
    const { token } = await crearDueno()
    const r = await vista(token, Buffer.from('Nombre;Precio\r\nAgua;1000', 'utf-8'))
    expect(r.body.errores[0].mensaje).toContain('Faltan las columnas')
    expect(r.body.errores[0].mensaje).toContain('Categoría')
    expect((await vista(token, Buffer.from(CAB, 'utf-8'))).body.errores[0].mensaje).toContain('No hay productos')
    await api().post('/api/productos/importar').set(auth(token)).set('Content-Type', 'application/octet-stream').expect(400)
  })

  it('entiende los encabezados en cualquier orden, con tildes o sin ellas', async () => {
    const { token } = await crearDueno()
    const r = await vista(token, Buffer.from('PRECIO VENTA;costo;categoria;PRODUCTO\r\n1500;800;Bebidas;Agua', 'utf-8'))
    expect(r.body).toMatchObject({ puedeAplicar: true, crear: 1 })
    expect(r.body.filas[0]).toMatchObject({ nombre: 'Agua', precio: 1500, costo: 800, categoria: 'Bebidas' })
  })

  it('un CSV guardado en Windows-1252 (ANSI) conserva las tildes', async () => {
    const { token } = await crearDueno()
    const r = await vista(token, Buffer.from(`${CAB}\r\n;Jabón de baño;;Droguería;;1900;2800;0;`, 'latin1'))
    expect(r.body.filas[0]).toMatchObject({ nombre: 'Jabón de baño', categoria: 'Droguería' })
  })
})

describe('aplicar la importación', () => {
  it('crea productos con código automático, stock inicial con movimiento, categorías y proveedores nuevos', async () => {
    const { token } = await crearDueno()
    const r = await aplicar(token, csv(
      ';Agua 600 ml;Botella sin gas;Bebidas;Andina;800;1500;24;6',
      'APEQ1;Cuaderno rayado;;Papelería;;2800;4500;10;',
      ';Lápiz;;Papelería;Andina;300;700;0;',
    ))
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ creados: 3, actualizados: 0, proveedoresNuevos: ['Andina'] })
    const ps = await prisma.producto.findMany({ orderBy: { id: 'asc' }, include: { categoria: true, proveedor: true } })
    expect(ps.map((p) => [p.codigo, p.nombre, p.stock, p.categoria.nombre, p.proveedor?.nombre ?? null])).toEqual([
      ['0001', 'Agua 600 ml', 24, 'Bebidas', 'Andina'],
      ['APEQ1', 'Cuaderno rayado', 10, 'Papelería', null],
      ['0002', 'Lápiz', 0, 'Papelería', 'Andina'],
    ])
    expect(ps[0]!.stockMinimo).toBe(6)
    expect(await prisma.proveedor.count()).toBe(1) // «Andina» una sola vez aunque aparezca dos veces
    // El stock inicial deja su rastro y el stock sigue siendo la suma de movimientos.
    const movs = await prisma.movimientoStock.findMany({ orderBy: { productoId: 'asc' } })
    expect(movs.map((m) => [m.productoId, m.cantidad, m.motivo])).toEqual([[ps[0]!.id, 24, 'Stock inicial (importación)'], [ps[1]!.id, 10, 'Stock inicial (importación)']])
    // Se puede buscar por la descripción importada.
    const b = (await api().get('/api/productos').query({ q: 'sin gas' }).set(auth(token))).body
    expect(b.items.map((p: { codigo: string }) => p.codigo)).toEqual(['0001'])
  })

  it('actualiza por código: cambia datos y precio con historial, pero NUNCA el stock', async () => {
    const { token } = await crearDueno()
    const p = await crearProducto(token, { nombre: 'Gaseosa vieja', codigo: 'G1', precio: 4000, costo: 3000, stockInicial: 5, stockMinimo: 2 })
    const r = await aplicar(token, csv('g1;Gaseosa 1.5 L;;General;;3200;4500;999;'))
    expect(r.body).toMatchObject({ creados: 0, actualizados: 1 })
    const ahora = await prisma.producto.findUniqueOrThrow({ where: { id: p.id } })
    expect(ahora).toMatchObject({ nombre: 'Gaseosa 1.5 L', costo: 3200, precio: 4500, stock: 5, stockMinimo: 2 }) // stock y mínimo intactos
    const h = await prisma.historialPrecio.findMany({ where: { productoId: p.id } })
    expect(h.map((x) => [x.precioAnterior, x.precioNuevo])).toEqual([[4000, 4500]])
    expect(await prisma.producto.count()).toBe(1) // no se duplicó
  })

  it('es todo o nada: un solo error y no se guarda NADA (ni categorías nuevas)', async () => {
    const { token } = await crearDueno()
    const r = await aplicar(token, csv(';Bueno;;Bebidas;;1000;2000;5;', ';Malo;;Bebidas;;mil;2000;5;'))
    expect(r.status).toBe(422)
    expect(r.body.error.codigo).toBe('IMPORTACION_CON_ERRORES')
    expect(r.body.error.detalles.errores[0]).toMatchObject({ fila: 3, campo: 'Costo' })
    expect(await prisma.producto.count()).toBe(0)
    expect(await prisma.categoria.count()).toBe(0)
  })

  it('el código automático no choca con códigos propios del mismo archivo ni con los existentes', async () => {
    const { token } = await crearDueno()
    await crearProducto(token, { codigo: '0001' })
    const r = await aplicar(token, csv(';A;;General;;1;2;;', '0002;B;;General;;1;2;;', ';C;;General;;1;2;;'))
    expect(r.status).toBe(201)
    const codigos = (await prisma.producto.findMany({ orderBy: { id: 'asc' } })).map((p) => p.codigo)
    expect(codigos).toEqual(['0001', '0003', '0002', '0004'])
    expect(new Set(codigos).size).toBe(4)
  })

  it('reactiva una categoría desactivada que el archivo usa', async () => {
    const { token } = await crearDueno()
    const cat = (await api().post('/api/categorias').set(auth(token)).send({ nombre: 'Bebidas' }).expect(201)).body
    await api().patch(`/api/categorias/${cat.id}`).set(auth(token)).send({ activa: false }).expect(200)
    const r = await aplicar(token, csv(';Agua;;bebidas;;1;2;;'))
    expect(r.body.categoriasReactivadas).toBe(1)
    expect((await prisma.categoria.findUniqueOrThrow({ where: { id: cat.id } })).activa).toBe(true)
    expect(await prisma.categoria.count()).toBe(1) // «bebidas» y «Bebidas» son la misma
  })

  it('lee un Excel (.xlsx) de verdad, con números y fórmulas', async () => {
    const { token } = await crearDueno()
    const libro = new ExcelJS.Workbook()
    const h = libro.addWorksheet('Productos')
    h.addRow(['Código', 'Nombre', 'Categoría', 'Costo', 'Precio', 'Stock'])
    h.addRow(['A1', 'Arroz 1 kg', 'Abarrotes', 3300, { formula: '3300+900', result: 4200 }, 40])
    h.addRow(['', 'Aceite 1 L', 'Abarrotes', 9200, 11500, 14])
    const buf = Buffer.from(await libro.xlsx.writeBuffer())
    const r = await aplicar(token, buf)
    expect(r.status).toBe(201)
    expect(r.body.creados).toBe(2)
    expect((await prisma.producto.findFirstOrThrow({ where: { codigo: 'A1' } })).precio).toBe(4200)
  })

  it('la plantilla se descarga y es un Excel que la propia importación entiende', async () => {
    const { token } = await crearDueno()
    const r = await api().get('/api/productos/importar/plantilla').set(auth(token)).buffer(true).parse((res, cb) => {
      const t: Buffer[] = []
      res.on('data', (x: Buffer) => t.push(x)); res.on('end', () => cb(null, Buffer.concat(t)))
    }).expect(200)
    const v = await vista(token, r.body as Buffer)
    expect(v.body).toMatchObject({ puedeAplicar: true, crear: 2, errores: [] }) // las 2 filas de ejemplo
  })

  it('solo el dueño; rechaza archivos que no son ni Excel ni CSV legible', async () => {
    const { token } = await crearDueno()
    const v = await crearVendedor(token)
    await vista(v.token, csv(';A;;G;;1;2;;')).expect(403)
    await aplicar(v.token, csv(';A;;G;;1;2;;')).expect(403)
    await api().get('/api/productos/importar/plantilla').set(auth(v.token)).expect(403)
    await vista(token, Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.from('esto no es un zip')])).expect(400)
  })

  it('REGRESIÓN: montar la importación no le quita al vendedor el acceso a ver productos', async () => {
    const { token } = await crearDueno()
    const v = await crearVendedor(token)
    const p = await crearProducto(token, { codigo: 'ZZ9' })
    await api().get('/api/productos').set(auth(v.token)).expect(200)
    await api().get(`/api/productos/${p.id}`).set(auth(v.token)).expect(200)
    await api().get('/api/productos/codigo/zz9').set(auth(v.token)).expect(200)
  })
})
