import { describe, expect, it } from 'vitest'
import { ErrorApi, conConsulta, mensajeDe } from './cliente'
import { aCategoria, aCompra, aMovimiento, aProducto, aProveedor, cuerpoProductoCambios, cuerpoProductoNuevo, cuerpoProveedor } from './mapeo'

describe('traducción API → front', () => {
  it('producto: renombra stockMinimo y vuelve texto el id de categoría', () => {
    expect(aProducto({ id: 5, nombre: 'Gaseosa', codigo: '101', categoriaId: 3, proveedorId: 2, costo: 3200, precio: 4500, stock: 7, stockMinimo: 12, activo: true })).toEqual({
      id: 5, nombre: 'Gaseosa', codigo: '101', descripcion: '', imagen: null, categoriaId: '3', proveedorId: 2, costo: 3200, precio: 4500, stock: 7, minimo: 12, activo: true,
    })
  })

  it('producto de un VENDEDOR (la API no manda el costo): queda en 0, nunca undefined', () => {
    expect(aProducto({ id: 1, nombre: 'X', codigo: 'c', categoriaId: 1, proveedorId: null, precio: 100, stock: 1, stockMinimo: 0, activo: true }).costo).toBe(0)
  })

  it('categoría y proveedor: null pasa a texto vacío', () => {
    expect(aCategoria({ id: 9, nombre: 'Aseo', color: '#2e9e8f', activa: true })).toEqual({ id: '9', nombre: 'Aseo', color: '#2e9e8f', activa: true })
    expect(aProveedor({ id: 1, nombre: 'Andina', telefono: null, correo: null, notas: null, activo: false })).toEqual({ id: 1, nombre: 'Andina', telefono: '', correo: '', notas: '', activo: false })
  })

  it('compra y movimiento: las fechas pasan a Date y el usuario a su nombre', () => {
    const c = aCompra({ id: 3, proveedorId: 2, total: 100, notas: null, fecha: '2026-09-30T14:00:00.000Z', items: [{ productoId: 1, cantidad: 2, costoUnitario: 50 }] })
    expect(c.fecha).toEqual(new Date('2026-09-30T14:00:00.000Z'))
    expect(c.notas).toBeUndefined()
    const m = aMovimiento({ id: 1, productoId: 2, tipo: 'VENTA', cantidad: -2, stockResultante: 8, motivo: null, creadoEn: '2026-09-30T14:00:00.000Z', usuario: { nombre: 'María' } })
    expect(m).toMatchObject({ usuario: 'María', cantidad: -2, motivo: undefined })
  })
})

describe('traducción front → API', () => {
  const datos = { nombre: 'Gaseosa', codigo: '101', categoriaId: '3', proveedorId: 2, costo: 3200, precio: 4500, minimo: 12, activo: true }

  it('crear: manda stockMinimo y stockInicial, y el id de categoría como número', () => {
    expect(cuerpoProductoNuevo(datos, 24)).toEqual({ nombre: 'Gaseosa', codigo: '101', descripcion: null, categoriaId: 3, proveedorId: 2, costo: 3200, precio: 4500, stockMinimo: 12, stockInicial: 24 })
  })

  it('crear sin código: no se manda y lo asigna el servidor; la descripción vacía va como null', () => {
    const b = cuerpoProductoNuevo({ ...datos, codigo: '   ', descripcion: '  ' }, 0)
    expect(b).not.toHaveProperty('codigo')
    expect(b.descripcion).toBeNull()
  })

  it('la foto y la descripción llegan del servidor; sin ellas quedan vacías', () => {
    const p = aProducto({ id: 1, nombre: 'Agua', codigo: 'APEQ1', descripcion: 'Botella de 600 ml', imagen: '/uploads/ab12.jpg', categoriaId: 1, proveedorId: null, precio: 1500, stock: 1, stockMinimo: 0, activo: true })
    expect(p.imagen).toBe('/uploads/ab12.jpg')
    expect(p.descripcion).toBe('Botella de 600 ml')
  })

  it('editar: la descripción en blanco se manda como null (borrarla) y el código nunca viaja si no cambió', () => {
    expect(cuerpoProductoCambios({ descripcion: '   ' })).toEqual({ descripcion: null })
    expect(cuerpoProductoCambios({ descripcion: ' Sin gas ' })).toEqual({ descripcion: 'Sin gas' })
    expect(cuerpoProductoCambios({ precio: 1 })).not.toHaveProperty('codigo')
  })

  it('editar: solo viaja lo que cambió y NUNCA el stock', () => {
    expect(cuerpoProductoCambios({ precio: 5000 })).toEqual({ precio: 5000 })
    expect(cuerpoProductoCambios({ minimo: 3, activo: false })).toEqual({ stockMinimo: 3, activo: false })
    expect(cuerpoProductoCambios({ categoriaId: '7' })).toEqual({ categoriaId: 7 })
    expect(cuerpoProductoCambios({})).toEqual({})
    expect(Object.keys(cuerpoProductoCambios(datos as never))).not.toContain('stock')
  })

  it('proveedor: texto vacío o con solo espacios pasa a null', () => {
    expect(cuerpoProveedor({ nombre: 'Andina', telefono: '  ', correo: '', notas: 'Pasa los martes' })).toEqual({ nombre: 'Andina', telefono: null, correo: null, notas: 'Pasa los martes' })
  })
})

describe('cliente HTTP', () => {
  it('arma la consulta y omite lo vacío', () => {
    expect(conConsulta('/productos', { q: 'jabón', pagina: 2, estado: undefined, vacio: '', nulo: null })).toBe('/productos?q=jab%C3%B3n&pagina=2')
    expect(conConsulta('/salud')).toBe('/salud')
    expect(conConsulta('/x', {})).toBe('/x')
  })

  it('muestra el mensaje del servidor y uno genérico para errores desconocidos', () => {
    expect(mensajeDe(new ErrorApi(409, 'STOCK_INSUFICIENTE', 'No hay stock suficiente de "Gaseosa"'))).toBe('No hay stock suficiente de "Gaseosa"')
    expect(mensajeDe(new Error('algo interno raro'))).not.toContain('interno') // no se filtran detalles técnicos
    expect(mensajeDe('texto')).toMatch(/inesperado/)
  })
})
