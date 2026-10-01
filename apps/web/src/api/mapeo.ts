import type { Compra, DatosProducto, DevolucionProveedorListada, DevolucionVenta, Movimiento, VentaListada } from '../data/contexto'
import type { Categoria, Producto, Proveedor } from '../mock/catalogo'

/*
  Traductores entre lo que dice la API y los modelos que usa el front. Son funciones puras (fáciles de probar).
  Diferencias que absorben:
   · la API llama "stockMinimo" a lo que el front llama "minimo";
   · los id de categoría son números en la API y texto en el front;
   · la API no manda el costo a los vendedores (el front lo deja en 0 y oculta esas columnas);
   · la API devuelve las fechas como texto ISO.
*/

export interface CategoriaApi { id: number; nombre: string; color: string; activa: boolean }
export interface ProveedorApi { id: number; nombre: string; telefono: string | null; correo: string | null; notas: string | null; activo: boolean }
export interface ProductoApi {
  id: number
  nombre: string
  codigo: string
  descripcion?: string | null
  imagen?: string | null
  categoriaId: number
  proveedorId: number | null
  costo?: number
  precio: number
  stock: number
  stockMinimo: number
  activo: boolean
}
export interface CompraApi {
  id: number
  proveedorId: number
  total: number
  notas: string | null
  fecha: string
  items: { productoId: number; cantidad: number; costoUnitario: number }[]
}
export interface MovimientoApi {
  id: number
  productoId: number
  tipo: Movimiento['tipo']
  cantidad: number
  stockResultante: number
  motivo: string | null
  creadoEn: string
  usuario: { nombre: string }
}
export interface Pagina<T> { total: number; pagina: number; porPagina: number; items: T[] }

export interface VentaApi {
  id: number
  numero: number
  total: number
  pagado: number
  vueltas: number
  medioPago: VentaListada['medioPago']
  estado: VentaListada['estado']
  motivoAnulacion: string | null
  creadaEn: string
  usuario: { nombre: string }
  items: { id: number; productoId: number; nombreProducto: string; cantidad: number; precioUnitario: number; costoUnitario?: number }[]
  ganancia?: number
  devoluciones?: {
    id: number
    creadaEn: string
    total: number
    motivo: string
    medioReembolso: DevolucionVenta['medioReembolso']
    usuario: { nombre: string }
    items: { ventaItemId: number; productoId: number; nombreProducto: string; cantidad: number; precioUnitario: number; reingresaStock: boolean }[]
  }[]
}

export interface DevolucionProveedorApi {
  id: number
  proveedorId: number
  compraId: number | null
  fecha: string
  total: number
  motivo: DevolucionProveedorListada['motivo']
  nota: string | null
  resolucion: DevolucionProveedorListada['resolucion']
  usuario: { nombre: string }
  items: { productoId: number; cantidad: number; costoUnitario: number; producto: { nombre: string } }[]
}

export const aDevolucionProveedor = (d: DevolucionProveedorApi): DevolucionProveedorListada => ({
  id: d.id, proveedorId: d.proveedorId, compraId: d.compraId ?? undefined, fecha: new Date(d.fecha), total: d.total, motivo: d.motivo,
  nota: d.nota ?? undefined, resolucion: d.resolucion, usuario: d.usuario.nombre,
  items: d.items.map((i) => ({ productoId: i.productoId, nombre: i.producto.nombre, cantidad: i.cantidad, costoUnitario: i.costoUnitario })),
})

export const aVentaListada = (v: VentaApi): VentaListada => ({
  id: v.id, numero: v.numero, fecha: new Date(v.creadaEn), vendedor: v.usuario.nombre, total: v.total, pagado: v.pagado, vueltas: v.vueltas,
  medioPago: v.medioPago, estado: v.estado, motivoAnulacion: v.motivoAnulacion ?? undefined, ganancia: v.ganancia,
  items: v.items.map((i) => ({ id: i.id, productoId: i.productoId, nombre: i.nombreProducto, cantidad: i.cantidad, precioUnitario: i.precioUnitario, costoUnitario: i.costoUnitario })),
  devoluciones: v.devoluciones?.map((d) => ({
    id: d.id, fecha: new Date(d.creadaEn), total: d.total, motivo: d.motivo, medioReembolso: d.medioReembolso, usuario: d.usuario.nombre,
    items: d.items.map((i) => ({ ventaItemId: i.ventaItemId, productoId: i.productoId, nombre: i.nombreProducto, cantidad: i.cantidad, precioUnitario: i.precioUnitario, reingresaStock: i.reingresaStock })),
  })),
})

export const aCategoria = (c: CategoriaApi): Categoria => ({ id: String(c.id), nombre: c.nombre, color: c.color, activa: c.activa })

export const aProveedor = (p: ProveedorApi): Proveedor => ({
  id: p.id, nombre: p.nombre, telefono: p.telefono ?? '', correo: p.correo ?? '', notas: p.notas ?? '', activo: p.activo,
})

export const aProducto = (p: ProductoApi): Producto => ({
  id: p.id, codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion ?? '', imagen: p.imagen ?? null, categoriaId: String(p.categoriaId), proveedorId: p.proveedorId,
  precio: p.precio, costo: p.costo ?? 0, stock: p.stock, minimo: p.stockMinimo, activo: p.activo,
})

export const aCompra = (c: CompraApi): Compra => ({
  id: c.id, proveedorId: c.proveedorId, fecha: new Date(c.fecha), total: c.total, notas: c.notas ?? undefined,
  items: c.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, costoUnitario: i.costoUnitario })),
})

export const aMovimiento = (m: MovimientoApi): Movimiento => ({
  id: m.id, productoId: m.productoId, tipo: m.tipo, cantidad: m.cantidad, stockResultante: m.stockResultante,
  motivo: m.motivo ?? undefined, fecha: new Date(m.creadoEn), usuario: m.usuario.nombre,
})

/** Cuerpo para CREAR un producto. El stock inicial solo se acepta al crear. */
export const cuerpoProductoNuevo = (d: DatosProducto, stockInicial: number) => ({
  nombre: d.nombre, ...(d.codigo.trim() ? { codigo: d.codigo.trim() } : {}), // sin código: lo asigna el servidor
  descripcion: d.descripcion?.trim() || null, categoriaId: Number(d.categoriaId), proveedorId: d.proveedorId,
  costo: d.costo, precio: d.precio, stockMinimo: d.minimo, stockInicial,
})

/** Cuerpo para EDITAR: solo viaja lo que cambió (el servidor rechaza campos que no conoce, p. ej. "stock"). */
export function cuerpoProductoCambios(c: Partial<DatosProducto>) {
  const b: Record<string, unknown> = {}
  if (c.nombre !== undefined) b.nombre = c.nombre
  if (c.codigo !== undefined) b.codigo = c.codigo
  if (c.descripcion !== undefined) b.descripcion = c.descripcion.trim() || null
  if (c.categoriaId !== undefined) b.categoriaId = Number(c.categoriaId)
  if (c.proveedorId !== undefined) b.proveedorId = c.proveedorId
  if (c.costo !== undefined) b.costo = c.costo
  if (c.precio !== undefined) b.precio = c.precio
  if (c.minimo !== undefined) b.stockMinimo = c.minimo
  if (c.activo !== undefined) b.activo = c.activo
  return b
}

/** Cuerpo de un proveedor: la API usa null para "sin dato" y el front, texto vacío. */
export const cuerpoProveedor = (p: Partial<Omit<Proveedor, 'id'>>) => {
  const b: Record<string, unknown> = {}
  if (p.nombre !== undefined) b.nombre = p.nombre
  if (p.telefono !== undefined) b.telefono = p.telefono.trim() || null
  if (p.correo !== undefined) b.correo = p.correo.trim() || null
  if (p.notas !== undefined) b.notas = p.notas.trim() || null
  if (p.activo !== undefined) b.activo = p.activo
  return b
}
