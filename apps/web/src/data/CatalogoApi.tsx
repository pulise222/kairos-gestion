import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorApi, api, mensajeDe } from '../api/cliente'
import {
  aCategoria, aCompra, aDevolucionProveedor, aMovimiento, aProducto, aProveedor, aVentaListada, cuerpoProductoCambios, cuerpoProductoNuevo, cuerpoProveedor,
} from '../api/mapeo'
import type { CategoriaApi, CompraApi, DevolucionProveedorApi, MovimientoApi, Pagina, ProductoApi, ProveedorApi, VentaApi } from '../api/mapeo'
import { useSesion } from '../sesion/contexto'
import type { Categoria, Producto, Proveedor } from '../mock/catalogo'
import { CatalogoContext } from './contexto'
import type { Catalogo, Compra, Movimiento } from './contexto'

type ProductoConProveedor = ProductoApi & { proveedor?: { id: number; nombre: string } | null }

/** Pide TODAS las páginas de un listado (la API entrega máximo 200 por vez). */
async function todasLasPaginas<T>(ruta: string, consulta: Record<string, string | number | boolean | undefined>): Promise<T[]> {
  const todos: T[] = []
  for (let pagina = 1; ; pagina++) {
    const r = await api.get<Pagina<T>>(ruta, { ...consulta, pagina, porPagina: 200 })
    todos.push(...r.items)
    if (todos.length >= r.total || r.items.length === 0) return todos
  }
}

/*
  MODO REAL: el catálogo vive en la base de datos y esta clase de proveedor lo mantiene al día en pantalla.
  Se carga una vez al iniciar sesión (una tienda tiene cientos o pocos miles de productos: así la búsqueda
  de la pantalla de Venta es instantánea, sin pedir nada al servidor mientras se escribe) y, después de cada
  operación, solo se vuelve a pedir lo que cambió.
*/
export function CatalogoApi({ children }: { children: ReactNode }) {
  const { estado, esDueno } = useSesion()
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [compras, setCompras] = useState<Compra[]>([])

  const cargarMovimientos = useCallback(async () => {
    if (!esDueno) return // el libro de movimientos es solo del dueño
    const r = await api.get<Pagina<MovimientoApi>>('/inventario/movimientos', { porPagina: 200 })
    setMovimientos(r.items.map(aMovimiento))
  }, [esDueno])

  const cargarCompras = useCallback(async () => {
    if (!esDueno) return
    const r = await api.get<Pagina<CompraApi>>('/compras', { porPagina: 100 })
    setCompras(r.items.map(aCompra))
  }, [esDueno])

  const cargarCategorias = useCallback(async () => {
    setCategorias((await api.get<CategoriaApi[]>('/categorias', esDueno ? { todas: true } : {})).map(aCategoria))
  }, [esDueno])

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const [cats, provs, prods] = await Promise.all([
        api.get<CategoriaApi[]>('/categorias', esDueno ? { todas: true } : {}),
        esDueno ? api.get<ProveedorApi[]>('/proveedores', { todos: true }) : Promise.resolve(null),
        todasLasPaginas<ProductoConProveedor>('/productos', esDueno ? { inactivos: true } : {}),
      ])
      setCategorias(cats.map(aCategoria))
      setProductos(prods.map(aProducto))
      // El vendedor no puede pedir la lista de proveedores, pero sí ve el nombre de cada producto: lo armamos de ahí.
      setProveedores(
        provs
          ? provs.map(aProveedor)
          : [...new Map(prods.filter((p) => p.proveedor).map((p) => [p.proveedor!.id, { id: p.proveedor!.id, nombre: p.proveedor!.nombre, telefono: '', correo: '', notas: '', activo: true }])).values()],
      )
      await Promise.all([cargarMovimientos(), cargarCompras()])
    } catch (e) {
      setErrorCarga(mensajeDe(e))
    } finally {
      setCargando(false)
    }
  }, [esDueno, cargarMovimientos, cargarCompras])

  // Se carga al iniciar sesión y se vacía al cerrarla (para que el siguiente usuario no vea datos del anterior).
  useEffect(() => {
    if (estado === 'activa') void cargarTodo()
    else {
      setProductos([]); setCategorias([]); setProveedores([]); setMovimientos([]); setCompras([])
      setCargando(true)
    }
  }, [estado, cargarTodo])

  /** Vuelve a pedir solo ciertos productos (los que cambiaron de stock) y los mezcla con lo que ya hay. */
  const refrescarProductos = useCallback(async (ids: number[]) => {
    const frescos = await Promise.all(ids.map((id) => api.get<ProductoApi>(`/productos/${id}`).then(aProducto)))
    setProductos((ps) => ps.map((p) => frescos.find((f) => f.id === p.id) ?? p))
  }, [])

  const crearProducto: Catalogo['crearProducto'] = useCallback(async (datos, stockInicial) => {
    const creado = aProducto(await api.post<ProductoApi>('/productos', cuerpoProductoNuevo(datos, stockInicial)))
    let final = creado
    if (!datos.activo) final = aProducto(await api.patch<ProductoApi>(`/productos/${creado.id}`, { activo: false })) // al crear siempre nace activo
    setProductos((ps) => [...ps, final])
    if (stockInicial > 0) await cargarMovimientos()
    return final
  }, [cargarMovimientos])

  const editarProducto: Catalogo['editarProducto'] = useCallback(async (id, cambios) => {
    const actualizado = aProducto(await api.patch<ProductoApi>(`/productos/${id}`, cuerpoProductoCambios(cambios)))
    setProductos((ps) => ps.map((p) => (p.id === id ? actualizado : p)))
  }, [])

  const subirImagenProducto: Catalogo['subirImagenProducto'] = useCallback(async (id, imagen) => {
    const p = aProducto(await api.subirImagen<ProductoApi>(`/productos/${id}/imagen`, imagen))
    setProductos((ps) => ps.map((x) => (x.id === id ? p : x)))
  }, [])

  const quitarImagenProducto: Catalogo['quitarImagenProducto'] = useCallback(async (id) => {
    const p = aProducto(await api.delete<ProductoApi>(`/productos/${id}/imagen`))
    setProductos((ps) => ps.map((x) => (x.id === id ? p : x)))
  }, [])

  const crearCategoria: Catalogo['crearCategoria'] = useCallback(async (nombre, color) => {
    const c = aCategoria(await api.post<CategoriaApi>('/categorias', { nombre: nombre.trim(), color }))
    setCategorias((cs) => [...cs, c])
    return c
  }, [])

  const editarCategoria: Catalogo['editarCategoria'] = useCallback(async (id, cambios) => {
    const c = aCategoria(await api.patch<CategoriaApi>(`/categorias/${id}`, cambios))
    setCategorias((cs) => cs.map((x) => (x.id === id ? c : x)))
  }, [])

  const crearProveedor: Catalogo['crearProveedor'] = useCallback(async (datos) => {
    const nuevo = aProveedor(await api.post<ProveedorApi>('/proveedores', cuerpoProveedor(datos)))
    setProveedores((ps) => [...ps, nuevo])
    return nuevo
  }, [])

  const editarProveedor: Catalogo['editarProveedor'] = useCallback(async (id, cambios) => {
    const actualizado = aProveedor(await api.patch<ProveedorApi>(`/proveedores/${id}`, cuerpoProveedor(cambios)))
    setProveedores((ps) => ps.map((p) => (p.id === id ? actualizado : p)))
  }, [])

  const crearCategorias: Catalogo['crearCategorias'] = useCallback(async (nuevas) => {
    // Si ya hay categorías (cualquier instalación existente), solo se crean las que falten por nombre.
    const existentes = new Set((await api.get<CategoriaApi[]>('/categorias', { todas: true })).map((c) => c.nombre.toLowerCase()))
    for (const n of nuevas) {
      if (!existentes.has(n.nombre.trim().toLowerCase())) await api.post('/categorias', { nombre: n.nombre.trim(), color: n.color })
    }
    await cargarCategorias()
  }, [cargarCategorias])

  const registrarVenta: Catalogo['registrarVenta'] = useCallback(async (lineas, pago) => {
    const ids = [...new Set(lineas.map((l) => l.productoId))]
    try {
      // El servidor calcula el total y las vueltas con SUS precios: lo que devuelve es la verdad.
      const v = await api.post<{ numero: number; total: number; pagado: number; vueltas: number }>(
        '/ventas',
        { items: lineas, pagado: pago.pagado, medioPago: pago.medioPago ?? 'EFECTIVO' },
        pago.clave ? { 'Idempotency-Key': pago.clave } : undefined,
      )
      await Promise.all([refrescarProductos(ids), cargarMovimientos()])
      return { numero: v.numero, total: v.total, pagado: v.pagado, vueltas: v.vueltas, items: lineas.reduce((s, l) => s + l.cantidad, 0) }
    } catch (e) {
      // Si falló por stock o por un producto que ya no está, lo que tenemos en pantalla estaba desactualizado: lo ponemos al día.
      if (e instanceof ErrorApi && (e.estado === 409 || e.codigo === 'PRODUCTO_NO_DISPONIBLE')) await refrescarProductos(ids).catch(() => undefined)
      throw e
    }
  }, [refrescarProductos, cargarMovimientos])

  const listarVentas: Catalogo['listarVentas'] = useCallback(async (f) => {
    const r = await api.get<Pagina<VentaApi>>('/ventas', { desde: f.desde, hasta: f.hasta, estado: f.estado, pagina: f.pagina ?? 1, porPagina: 25 })
    return { total: r.total, items: r.items.map(aVentaListada) }
  }, [])

  const anularVenta: Catalogo['anularVenta'] = useCallback(async (id, motivo) => {
    const v = await api.post<VentaApi>(`/ventas/${id}/anular`, { motivo })
    // El stock de esos productos volvió: se actualiza la pantalla.
    await Promise.all([refrescarProductos([...new Set(v.items.map((i) => i.productoId))]), cargarMovimientos()])
  }, [refrescarProductos, cargarMovimientos])

  const registrarDevolucionCliente: Catalogo['registrarDevolucionCliente'] = useCallback(async (ventaId, d) => {
    const r = await api.post<{ items: { productoId: number }[] }>(`/ventas/${ventaId}/devoluciones`, { items: d.items, motivo: d.motivo, medioReembolso: d.medioReembolso }, d.clave ? { 'Idempotency-Key': d.clave } : undefined)
    // Lo que volvió en buen estado sube el stock: se actualizan esos productos y el libro de movimientos.
    await Promise.all([refrescarProductos([...new Set(r.items.map((i) => i.productoId))]), cargarMovimientos()])
  }, [refrescarProductos, cargarMovimientos])

  const registrarDevolucionProveedor: Catalogo['registrarDevolucionProveedor'] = useCallback(async (proveedorId, d) => {
    await api.post(`/proveedores/${proveedorId}/devoluciones`, { compraId: d.compraId, items: d.items, motivo: d.motivo, nota: d.nota, resolucion: d.resolucion }, d.clave ? { 'Idempotency-Key': d.clave } : undefined)
    await Promise.all([refrescarProductos(d.items.map((i) => i.productoId)), cargarMovimientos()])
  }, [refrescarProductos, cargarMovimientos])

  const listarDevolucionesProveedor: Catalogo['listarDevolucionesProveedor'] = useCallback(async (proveedorId) => {
    return (await api.get<DevolucionProveedorApi[]>(`/proveedores/${proveedorId}/devoluciones`)).map(aDevolucionProveedor)
  }, [])

  const registrarEntrada: Catalogo['registrarEntrada'] = useCallback(async (proveedorId, lineas, notas) => {
    const c = await api.post<CompraApi>('/compras', { proveedorId, notas, items: lineas })
    await Promise.all([refrescarProductos(lineas.map((l) => l.productoId)), cargarCompras(), cargarMovimientos()])
    return aCompra(c)
  }, [refrescarProductos, cargarCompras, cargarMovimientos])

  const ajustarStock: Catalogo['ajustarStock'] = useCallback(async (productoId, delta, motivo) => {
    await api.post('/inventario/ajustes', { productoId, diferencia: delta, motivo })
    await Promise.all([refrescarProductos([productoId]), cargarMovimientos()])
  }, [refrescarProductos, cargarMovimientos])

  const registrarConteo: Catalogo['registrarConteo'] = useCallback(async (items, motivo) => {
    const r = await api.post<Awaited<ReturnType<Catalogo['registrarConteo']>>>('/inventario/conteo', { items, ...(motivo ? { motivo } : {}) })
    await Promise.all([refrescarProductos(r.cambios.map((c) => c.productoId)), cargarMovimientos()])
    return r
  }, [refrescarProductos, cargarMovimientos])

  const codigoEnUso: Catalogo['codigoEnUso'] = useCallback(
    (codigo, ignorarId) => productos.some((p) => p.codigo.toLowerCase() === codigo.trim().toLowerCase() && p.id !== ignorarId), // sin distinguir mayúsculas, igual que el servidor
    [productos],
  )

  const valor = useMemo<Catalogo>(
    () => ({
      cargando, errorCarga, refrescar: cargarTodo, productos, categorias, proveedores, movimientos, compras,
      crearProducto, editarProducto, subirImagenProducto, quitarImagenProducto, crearCategoria, editarCategoria, crearProveedor, editarProveedor, crearCategorias, registrarVenta, listarVentas, anularVenta, registrarDevolucionCliente, registrarDevolucionProveedor, listarDevolucionesProveedor, registrarEntrada, ajustarStock, registrarConteo, codigoEnUso,
    }),
    [cargando, errorCarga, cargarTodo, productos, categorias, proveedores, movimientos, compras, crearProducto, editarProducto, subirImagenProducto, quitarImagenProducto, crearCategoria, editarCategoria, crearProveedor, editarProveedor, crearCategorias, registrarVenta, listarVentas, anularVenta, registrarDevolucionCliente, registrarDevolucionProveedor, listarDevolucionesProveedor, registrarEntrada, ajustarStock, registrarConteo, codigoEnUso],
  )
  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>
}
