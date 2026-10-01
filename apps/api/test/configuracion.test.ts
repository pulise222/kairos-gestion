import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

describe('configuración ampliada (vive en el servidor)', () => {
  it('guarda los ajustes de negocio, apariencia, módulos, recibo y copias, y los devuelve completos', async () => {
    const dueno = await crearDueno()
    const nuevos = {
      nit: '900.123.456-7',
      direccion: 'Cra 10 # 20-30',
      telefono: '300 123 4567',
      patron: 'puntos',
      intensidad: 70,
      colorAcento: '#2f6fb8',
      proveedoresActivo: false,
      recibo: { encabezado: 'Gracias', pie: 'Vuelva pronto', ancho: 58, mostrarVendedor: false, mostrarNumero: true, avisoSinValidez: true },
      copias: { frecuencia: 'cierre', conservar: 7, destino: 'E:\\Respaldos', nube: true },
    }
    const r = (await api().put('/api/configuracion').set(auth(dueno.token)).send(nuevos).expect(200)).body
    expect(r).toMatchObject(nuevos)
    expect(r.nombreNegocio).toBe('Tienda de prueba') // lo que no se tocó se conserva
    // Persiste: otra lectura devuelve lo mismo
    expect((await api().get('/api/configuracion').set(auth(dueno.token))).body).toMatchObject(nuevos)
  })

  it('rechaza valores inválidos en los ajustes anidados', async () => {
    const dueno = await crearDueno()
    const put = (body: object) => api().put('/api/configuracion').set(auth(dueno.token)).send(body)
    expect((await put({ patron: 'rombos' })).status).toBe(400)
    expect((await put({ intensidad: 150 })).status).toBe(400)
    expect((await put({ recibo: { encabezado: 'x', pie: 'y', ancho: 72, mostrarVendedor: true, mostrarNumero: true, avisoSinValidez: true } })).status).toBe(400)
    expect((await put({ copias: { frecuencia: 'diaria', conservar: 0, destino: '', nube: false } })).status).toBe(400)
  })

  it('un valor dañado en la base solo reinicia ESA clave, no toda la configuración', async () => {
    const dueno = await crearDueno()
    await api().put('/api/configuracion').set(auth(dueno.token)).send({ metaDiaria: 1800000, patron: 'ondas' }).expect(200)
    // Alguien dejó basura en una clave directamente en la base de datos.
    await prisma.configuracion.update({ where: { clave: 'patron' }, data: { valor: 'esto-no-es-un-patron' } })

    const c = (await api().get('/api/configuracion').set(auth(dueno.token)).expect(200)).body
    expect(c.patron).toBe('curvas') // volvió a su valor por defecto
    expect(c.metaDiaria).toBe(1800000) // el resto sigue intacto
    expect(c.nombreNegocio).toBe('Tienda de prueba')
  })

  it('solo el dueño puede cambiarla, pero el vendedor la puede leer', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    expect((await api().put('/api/configuracion').set(auth(vendedor.token)).send({ patron: 'ondas' })).status).toBe(403)
    expect((await api().get('/api/configuracion').set(auth(vendedor.token))).status).toBe(200)
  })
})

describe('marca pública (pantalla de acceso)', () => {
  it('se puede leer SIN iniciar sesión y trae solo nombre, apariencia y personalización', async () => {
    const dueno = await crearDueno()
    await api().put('/api/configuracion').set(auth(dueno.token)).send({ nit: '123', telefono: '300', metaDiaria: 5000000, patron: 'puntos', colorAcento: '#8e2f4a' }).expect(200)

    const r = await api().get('/api/marca').expect(200)
    expect(r.body).toMatchObject({ nombreNegocio: 'Tienda de prueba', colorAcento: '#8e2f4a', patron: 'puntos', intensidad: 50 })
    // Solo estas claves (la personalización del cliente —logo y paleta— también es pública por diseño); nada más.
    expect(Object.keys(r.body).sort()).toEqual(['colorAcento', 'intensidad', 'nombreNegocio', 'patron', 'personalizacion'])
  })

  it('NO filtra datos sensibles (NIT, teléfono, metas, copias, recibo)', async () => {
    const dueno = await crearDueno()
    await api().put('/api/configuracion').set(auth(dueno.token)).send({ nit: '900.123', metaDiaria: 5000000, copias: { frecuencia: 'diaria', conservar: 5, destino: 'E:\\secreto', nube: false } }).expect(200)
    const texto = JSON.stringify((await api().get('/api/marca')).body)
    for (const prohibido of ['900.123', '5000000', 'secreto', 'metaDiaria', 'nit', 'copias', 'recibo', 'billetes']) expect(texto).not.toContain(prohibido)
  })

  it('antes de configurar el sistema devuelve los valores por defecto', async () => {
    const r = await api().get('/api/marca').expect(200)
    expect(r.body).toMatchObject({ nombreNegocio: 'Mi negocio', patron: 'curvas' })
  })
})

describe('lista de compras', () => {
  it('trae las líneas de cada compra (producto, cantidad y costo) para las pantallas', async () => {
    const dueno = await crearDueno()
    const prov = (await api().post('/api/proveedores').set(auth(dueno.token)).send({ nombre: 'Andina' })).body
    const p = await crearProducto(dueno.token, { stockInicial: 0 })
    await api().post('/api/compras').set(auth(dueno.token)).send({ proveedorId: prov.id, items: [{ productoId: p.id, cantidad: 12, costoUnitario: 3500 }] }).expect(201)

    const lista = (await api().get('/api/compras').set(auth(dueno.token)).expect(200)).body
    expect(lista.items[0]).toMatchObject({ total: 42000, proveedor: { nombre: 'Andina' }, items: [{ productoId: p.id, cantidad: 12, costoUnitario: 3500 }] })
  })
})
