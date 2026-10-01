import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorApi } from '../api/cliente'
import { categorias as categoriasIniciales, productosIniciales, proveedoresIniciales } from '../mock/catalogo'
import type { Categoria, Producto, Proveedor } from '../mock/catalogo'
import { aTexto } from '../lib/periodos'
import { comprasIniciales, movimientosIniciales, ventasIniciales } from './semilla'
import { aplicarEntrada, totalEntrada } from '../lib/inventario'
import { siguienteCodigo } from '../lib/busqueda'
import { useSesion } from '../sesion/contexto'
import { CatalogoContext } from './contexto'
import type { Catalogo, Compra, DevolucionProveedorListada, Movimiento, VentaListada } from './contexto'

/*
  MODO DEMO (demo pública, sin servidor): Venta, Productos e Inventario ven los mismos datos en memoria
  (si vendes una gaseosa, el stock baja también en Productos). Cumple el mismo contrato que CatalogoApi,
  incluidas las reglas que en el producto real aplica el servidor (stock suficiente, pago suficiente).
  Los datos se reinician al recargar la página: es una demostración, no guarda nada.
*/
export function CatalogoDemo({ children }: { children: ReactNode }) {
  const { usuario, esDueno } = useSesion()
  const quien = usuario?.nombre ?? 'Juan Pulido'
  const [productos, setProductos] = useState<Producto[]>(productosIniciales)
  const [movimientos, setMovimientos] = useState<Movimiento[]>(movimientosIniciales)
  const [compras, setCompras] = useState<Compra[]>(comprasIniciales)
  const [proveedores, setProveedores] = useState<Proveedor[]>(proveedoresIniciales)
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciales)
  const [ventas, setVentas] = useState<VentaListada[]>(ventasIniciales)
  const [devolucionesProv, setDevolucionesProv] = useState<DevolucionProveedorListada[]>([])
  const siguienteId = useRef({ producto: productosIniciales.length + 1, movimiento: 1000, compra: 5, proveedor: proveedoresIniciales.length + 1, venta: 128 })

  const mov = useCallback((m: Omit<Movimiento, 'id' | 'fecha' | 'usuario'>): Movimiento => ({
    ...m, id: siguienteId.current.movimiento++, fecha: new Date(), usuario: quien.split(' ')[0]!,
  }), [])

  const crearProducto: Catalogo['crearProducto'] = useCallback(async (datos, stockInicial) => {
    // Código vacío = lo asigna el sistema (igual que el servidor real). Sin distinguir mayúsculas.
    const codigo = datos.codigo.trim() || siguienteCodigo(productos)
    if (productos.some((p) => p.codigo.toLowerCase() === codigo.toLowerCase())) throw new ErrorApi(409, 'CODIGO_EXISTE', 'Ya existe un producto con ese código')
    const nuevo: Producto = { ...datos, codigo, imagen: null, id: siguienteId.current.producto++, stock: stockInicial }
    setProductos((ps) => [...ps, nuevo])
    if (stockInicial > 0) {
      setMovimientos((ms) => [mov({ productoId: nuevo.id, tipo: 'AJUSTE', cantidad: stockInicial, stockResultante: stockInicial, motivo: 'Stock inicial' }), ...ms])
    }
    return nuevo
  }, [mov, productos])

  // El stock NO se edita desde la ficha del producto: solo cambia con ventas, entradas y ajustes (siempre con rastro).
  const editarProducto: Catalogo['editarProducto'] = useCallback(async (id, cambios) => {
    setProductos((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }, [])

  const registrarVenta: Catalogo['registrarVenta'] = useCallback(async (lineas, pago) => {
    // Las mismas reglas que aplica el servidor real.
    const detalle = lineas.map((l) => ({ l, p: productos.find((x) => x.id === l.productoId) }))
    if (detalle.some((d) => !d.p || !d.p.activo)) throw new ErrorApi(422, 'PRODUCTO_NO_DISPONIBLE', 'Hay productos que no existen o están desactivados')
    const total = detalle.reduce((s, d) => s + d.p!.precio * d.l.cantidad, 0)
    if (pago.pagado < total) throw new ErrorApi(422, 'PAGO_INSUFICIENTE', 'El pago no alcanza para cubrir el total')
    for (const d of detalle) {
      if (d.p!.stock < d.l.cantidad) throw new ErrorApi(409, 'STOCK_INSUFICIENTE', `No hay stock suficiente de "${d.p!.nombre}"`)
    }
    const numero = siguienteId.current.venta++
    // El cálculo se hace FUERA de los "setState": las funciones actualizadoras deben ser puras
    // (React las ejecuta dos veces en modo estricto y duplicarían los movimientos).
    const nuevos: Movimiento[] = []
    setProductos(productos.map((p) => {
      const l = lineas.find((x) => x.productoId === p.id)
      if (!l) return p
      const stock = p.stock - l.cantidad
      nuevos.push(mov({ productoId: p.id, tipo: 'VENTA', cantidad: -l.cantidad, stockResultante: stock, motivo: `Venta #${String(numero).padStart(4, '0')}` }))
      return { ...p, stock }
    }))
    setMovimientos((ms) => [...nuevos, ...ms])
    const items = detalle.map((d) => ({ id: d.p!.id, productoId: d.p!.id, nombre: d.p!.nombre, cantidad: d.l.cantidad, precioUnitario: d.p!.precio, costoUnitario: d.p!.costo }))
    setVentas((vs) => [{
      id: numero, numero, fecha: new Date(), vendedor: quien, total, pagado: pago.pagado, vueltas: pago.pagado - total, medioPago: pago.medioPago ?? 'EFECTIVO',
      estado: 'COMPLETADA', items, ganancia: items.reduce((s, l) => s + l.cantidad * (l.precioUnitario - (l.costoUnitario ?? 0)), 0),
    }, ...vs])
    return { numero, total, pagado: pago.pagado, vueltas: pago.pagado - total, items: lineas.reduce((s, l) => s + l.cantidad, 0) }
  }, [productos, mov])

  const listarVentas: Catalogo['listarVentas'] = useCallback(async (f) => {
    // Igual que el servidor real: el vendedor ve solo SUS ventas y sin costos ni ganancias.
    const visibles = esDueno ? ventas : ventas.filter((v) => v.vendedor === quien).map(({ ganancia: _g, ...v }) => ({ ...v, items: v.items.map(({ costoUnitario: _c, ...i }) => i) }))
    const dentro = visibles.filter((v) => {
      const dia = aTexto(v.fecha)
      return (!f.desde || dia >= f.desde) && (!f.hasta || dia <= f.hasta) && (!f.estado || v.estado === f.estado)
    })
    const pagina = f.pagina ?? 1
    return { total: dentro.length, items: dentro.slice((pagina - 1) * 25, pagina * 25) }
  }, [ventas, esDueno, quien])

  const anularVenta: Catalogo['anularVenta'] = useCallback(async (id, motivo) => {
    const v = ventas.find((x) => x.id === id)
    if (!v) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La venta no existe')
    if (v.estado === 'ANULADA') throw new ErrorApi(409, 'VENTA_YA_ANULADA', 'Esta venta ya fue anulada')
    if (v.devoluciones?.length) throw new ErrorApi(409, 'VENTA_CON_DEVOLUCIONES', 'Esta venta ya tiene devoluciones registradas, por eso no se puede anular.')
    // El stock vuelve y queda el rastro (las mismas reglas que aplica el servidor).
    const nuevos: Movimiento[] = []
    setProductos(productos.map((p) => {
      const l = v.items.find((x) => x.productoId === p.id)
      if (!l) return p
      const stock = p.stock + l.cantidad
      nuevos.push(mov({ productoId: p.id, tipo: 'ANULACION', cantidad: l.cantidad, stockResultante: stock, motivo }))
      return { ...p, stock }
    }))
    setMovimientos((ms) => [...nuevos, ...ms])
    setVentas((vs) => vs.map((x) => (x.id === id ? { ...x, estado: 'ANULADA', motivoAnulacion: motivo } : x)))
  }, [ventas, productos, mov])

  // Las mismas reglas que aplica el servidor real: no devolver más de lo vendido, ni sobre una venta anulada.
  const registrarDevolucionCliente: Catalogo['registrarDevolucionCliente'] = useCallback(async (ventaId, d) => {
    const v = ventas.find((x) => x.id === ventaId)
    if (!v) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La venta no existe')
    if (v.estado === 'ANULADA') throw new ErrorApi(422, 'VENTA_ANULADA', 'No se puede registrar una devolución sobre una venta anulada')
    const yaDevuelto = (productoId: number) => (v.devoluciones ?? []).flatMap((x) => x.items).filter((i) => i.productoId === productoId).reduce((s, i) => s + i.cantidad, 0)
    const items = d.items.map((it) => {
      const linea = v.items.find((l) => l.productoId === it.ventaItemId) // en la demo la "línea" se identifica por producto
      if (!linea) throw new ErrorApi(422, 'LINEA_NO_PERTENECE', 'Una de las líneas no pertenece a esta venta')
      const disponible = linea.cantidad - yaDevuelto(linea.productoId)
      if (it.cantidad > disponible) throw new ErrorApi(422, 'DEVOLUCION_EXCEDE', `De "${linea.nombre}" solo se pueden devolver ${disponible}`)
      return { it, linea }
    })
    const total = items.reduce((s, x) => s + x.it.cantidad * x.linea.precioUnitario, 0)
    const nuevos: Movimiento[] = []
    setProductos(productos.map((p) => {
      const x = items.find((y) => y.linea.productoId === p.id)
      if (!x || !x.it.reingresaStock) return p
      const stock = p.stock + x.it.cantidad
      nuevos.push(mov({ productoId: p.id, tipo: 'DEVOLUCION_CLIENTE', cantidad: x.it.cantidad, stockResultante: stock, motivo: d.motivo }))
      return { ...p, stock }
    }))
    setMovimientos((ms) => [...nuevos, ...ms])
    setVentas((vs) => vs.map((x) => (x.id === ventaId ? {
      ...x,
      ganancia: x.ganancia === undefined ? undefined : x.ganancia - items.reduce((s, y) => s + y.it.cantidad * (y.linea.precioUnitario - (y.linea.costoUnitario ?? 0)), 0),
      devoluciones: [...(x.devoluciones ?? []), {
        id: Date.now(), fecha: new Date(), total, motivo: d.motivo, medioReembolso: d.medioReembolso, usuario: 'Juan Pulido',
        items: items.map((y) => ({ ventaItemId: y.linea.productoId, productoId: y.linea.productoId, nombre: y.linea.nombre, cantidad: y.it.cantidad, precioUnitario: y.linea.precioUnitario, reingresaStock: y.it.reingresaStock })),
      }],
    } : x)))
  }, [ventas, productos, mov])

  const registrarDevolucionProveedor: Catalogo['registrarDevolucionProveedor'] = useCallback(async (proveedorId, d) => {
    const filas = d.items.map((it) => ({ it, p: productos.find((x) => x.id === it.productoId) }))
    if (filas.some((f) => !f.p)) throw new ErrorApi(422, 'PRODUCTO_NO_DISPONIBLE', 'Hay productos que no existen')
    for (const f of filas) {
      if (f.p!.stock < f.it.cantidad) throw new ErrorApi(409, 'STOCK_INSUFICIENTE', `No puedes devolver ${f.it.cantidad} de "${f.p!.nombre}": solo hay ${f.p!.stock} en el inventario`)
    }
    const nuevos: Movimiento[] = []
    setProductos(productos.map((p) => {
      const f = filas.find((x) => x.it.productoId === p.id)
      if (!f) return p
      const stock = p.stock - f.it.cantidad
      nuevos.push(mov({ productoId: p.id, tipo: 'DEVOLUCION_PROVEEDOR', cantidad: -f.it.cantidad, stockResultante: stock, motivo: d.motivo }))
      return { ...p, stock }
    }))
    setMovimientos((ms) => [...nuevos, ...ms])
    setDevolucionesProv((ds) => [{
      id: Date.now(), proveedorId, compraId: d.compraId, fecha: new Date(), motivo: d.motivo, nota: d.nota, resolucion: d.resolucion, usuario: 'Juan Pulido',
      total: filas.reduce((s, f) => s + f.it.cantidad * (f.it.costoUnitario ?? f.p!.costo), 0),
      items: filas.map((f) => ({ productoId: f.p!.id, nombre: f.p!.nombre, cantidad: f.it.cantidad, costoUnitario: f.it.costoUnitario ?? f.p!.costo })),
    }, ...ds])
  }, [productos, mov])

  const listarDevolucionesProveedor: Catalogo['listarDevolucionesProveedor'] = useCallback(async (proveedorId) => devolucionesProv.filter((d) => d.proveedorId === proveedorId), [devolucionesProv])

  const registrarEntrada: Catalogo['registrarEntrada'] = useCallback(async (proveedorId, lineas, notas) => {
    const { productos: nuevos, cambios } = aplicarEntrada(productos, lineas)
    const compra: Compra = { id: siguienteId.current.compra++, proveedorId, fecha: new Date(), total: totalEntrada(lineas), notas, items: lineas }
    setProductos(nuevos)
    setCompras((cs) => [compra, ...cs])
    setMovimientos((ms) => [...cambios.map((c) => mov({ ...c, tipo: 'ENTRADA', motivo: `Compra #${compra.id}` })), ...ms])
    return compra
  }, [productos, mov])

  const ajustarStock: Catalogo['ajustarStock'] = useCallback(async (productoId, delta, motivo) => {
    const p = productos.find((x) => x.id === productoId)
    if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El producto no existe')
    if (p.stock + delta < 0) throw new ErrorApi(422, 'STOCK_NEGATIVO', 'El ajuste dejaría el stock en negativo')
    const stock = p.stock + delta
    setProductos(productos.map((x) => (x.id === productoId ? { ...x, stock } : x)))
    setMovimientos((ms) => [mov({ productoId, tipo: 'AJUSTE', cantidad: delta, stockResultante: stock, motivo }), ...ms])
  }, [productos, mov])

  // En la demo la foto vive solo en memoria (una dirección temporal del navegador); al recargar se pierde, como todo lo demás.
  const subirImagenProducto: Catalogo['subirImagenProducto'] = useCallback(async (id, imagen) => {
    const url = URL.createObjectURL(imagen)
    setProductos((ps) => ps.map((p) => (p.id === id ? { ...p, imagen: url } : p)))
  }, [])
  const quitarImagenProducto: Catalogo['quitarImagenProducto'] = useCallback(async (id) => {
    setProductos((ps) => ps.map((p) => (p.id === id ? { ...p, imagen: null } : p)))
  }, [])

  const crearCategoria: Catalogo['crearCategoria'] = useCallback(async (nombre, color) => {
    const n = nombre.trim()
    if (categorias.some((c) => c.nombre.toLowerCase() === n.toLowerCase())) throw new ErrorApi(409, 'CATEGORIA_EXISTE', 'Ya existe una categoría con ese nombre')
    const nueva: Categoria = { id: n.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'), nombre: n, color }
    setCategorias((cs) => [...cs, nueva])
    return nueva
  }, [categorias])

  const editarCategoria: Catalogo['editarCategoria'] = useCallback(async (id, cambios) => {
    const n = cambios.nombre?.trim()
    if (n && categorias.some((c) => c.id !== id && c.nombre.toLowerCase() === n.toLowerCase())) throw new ErrorApi(409, 'CATEGORIA_EXISTE', 'Ya existe una categoría con ese nombre')
    setCategorias((cs) => cs.map((c) => (c.id === id ? { ...c, ...cambios, ...(n ? { nombre: n } : {}) } : c)))
  }, [categorias])

  // Mismas reglas que el servidor: todo o nada, y solo lo que difiere deja un movimiento.
  const registrarConteo: Catalogo['registrarConteo'] = useCallback(async (items, motivo) => {
    const filas = items.map((it) => ({ it, p: productos.find((x) => x.id === it.productoId) }))
    if (filas.some((f) => !f.p)) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Alguno de los productos no existe')
    const cambios = filas
      .filter((f) => f.it.contado !== f.p!.stock)
      .map((f) => ({ productoId: f.p!.id, nombre: f.p!.nombre, antes: f.p!.stock, contado: f.it.contado, diferencia: f.it.contado - f.p!.stock }))
    setProductos(productos.map((p) => { const c = cambios.find((x) => x.productoId === p.id); return c ? { ...p, stock: c.contado } : p }))
    setMovimientos((ms) => [...cambios.map((c) => mov({ productoId: c.productoId, tipo: 'AJUSTE', cantidad: c.diferencia, stockResultante: c.contado, motivo: motivo ?? 'Conteo físico del inventario' })), ...ms])
    return { cambios, sinCambio: filas.length - cambios.length }
  }, [productos, mov])

  const crearProveedor: Catalogo['crearProveedor'] = useCallback(async (datos) => {
    const nuevo: Proveedor = { ...datos, id: siguienteId.current.proveedor++, activo: true }
    setProveedores((ps) => [...ps, nuevo])
    return nuevo
  }, [])
  const editarProveedor: Catalogo['editarProveedor'] = useCallback(async (id, cambios) => {
    setProveedores((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)))
  }, [])

  const crearCategorias: Catalogo['crearCategorias'] = useCallback(async (nuevas) => {
    setCategorias((cs) => {
      const existentes = new Set(cs.map((c) => c.nombre.toLowerCase()))
      const agregar = nuevas
        .filter((n) => !existentes.has(n.nombre.trim().toLowerCase()))
        .map((n) => ({ id: n.nombre.trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-'), nombre: n.nombre.trim(), color: n.color }))
      return agregar.length ? [...cs, ...agregar] : cs
    })
  }, [])

  const codigoEnUso: Catalogo['codigoEnUso'] = useCallback(
    (codigo, ignorarId) => productos.some((p) => p.codigo.toLowerCase() === codigo.trim().toLowerCase() && p.id !== ignorarId),
    [productos],
  )
  const refrescar = useCallback(async () => {}, []) // en la demo no hay servidor al que preguntar

  const valor = useMemo<Catalogo>(
    () => ({ cargando: false, errorCarga: null, refrescar, productos, categorias, proveedores, movimientos, compras, crearProveedor, editarProveedor, crearCategorias, crearCategoria, editarCategoria, subirImagenProducto, quitarImagenProducto, crearProducto, editarProducto, registrarConteo, registrarVenta, listarVentas, anularVenta, registrarDevolucionCliente, registrarDevolucionProveedor, listarDevolucionesProveedor, registrarEntrada, ajustarStock, codigoEnUso }),
    [refrescar, productos, categorias, proveedores, movimientos, compras, crearProveedor, editarProveedor, crearCategorias, crearCategoria, editarCategoria, subirImagenProducto, quitarImagenProducto, crearProducto, editarProducto, registrarConteo, registrarVenta, listarVentas, anularVenta, registrarDevolucionCliente, registrarDevolucionProveedor, listarDevolucionesProveedor, registrarEntrada, ajustarStock, codigoEnUso],
  )
  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>
}
