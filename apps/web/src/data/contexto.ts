import { createContext, useContext } from 'react'
import type { LineaEntrada } from '../lib/inventario'
import type { Categoria, Producto, Proveedor } from '../mock/catalogo'

/** Cada cambio de stock deja un movimiento (igual que en el backend real): así el stock siempre se puede explicar. */
export interface Movimiento {
  id: number
  productoId: number
  tipo: 'ENTRADA' | 'VENTA' | 'AJUSTE' | 'ANULACION' | 'DEVOLUCION_CLIENTE' | 'DEVOLUCION_PROVEEDOR'
  /** Con signo: + sube el stock, − lo baja. */
  cantidad: number
  stockResultante: number
  motivo?: string
  fecha: Date
  usuario: string
}

/** Lo que se escribe en el formulario. La foto va aparte (subirImagenProducto) porque es un archivo, no un dato de texto. */
export type DatosProducto = Omit<Producto, 'id' | 'stock' | 'imagen'>

/** Compra a un proveedor (entrada de mercancía). */
export interface Compra {
  id: number
  proveedorId: number
  fecha: Date
  total: number
  notas?: string
  items: LineaEntrada[]
}

/** Una línea de una venta ya registrada: nombre y precios COPIADOS al momento de vender (no cambian si luego cambia el producto). */
export interface LineaVentaListada {
  /** Identifica la línea dentro de la venta (es lo que se manda para devolverla). */
  id: number
  productoId: number
  nombre: string
  cantidad: number
  precioUnitario: number
  /** Solo lo ve el dueño. */
  costoUnitario?: number
}

/** Devolución de un cliente sobre una venta. El dinero se devuelve al precio al que se VENDIÓ. */
export interface DevolucionVenta {
  id: number
  fecha: Date
  total: number
  motivo: string
  medioReembolso: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
  usuario: string
  items: { ventaItemId: number; productoId: number; nombre: string; cantidad: number; precioUnitario: number; reingresaStock: boolean }[]
}

export interface DatosDevolucionCliente {
  items: { ventaItemId: number; cantidad: number; reingresaStock: boolean }[]
  motivo: string
  medioReembolso: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
  /** Clave del intento (Idempotency-Key): la misma clave dos veces nunca devuelve el dinero dos veces. */
  clave?: string
}

export type MotivoDevolucionProveedor = 'SOBRANTE' | 'DANADO' | 'EQUIVOCADO' | 'VENCIDO' | 'OTRO'
export type ResolucionProveedor = 'PENDIENTE' | 'NOTA_CREDITO' | 'REEMBOLSO' | 'REPOSICION'

/** Devolución de mercancía a un proveedor (sale del inventario). */
export interface DevolucionProveedorListada {
  id: number
  proveedorId: number
  compraId?: number
  fecha: Date
  total: number
  motivo: MotivoDevolucionProveedor
  nota?: string
  resolucion: ResolucionProveedor
  usuario: string
  items: { productoId: number; nombre: string; cantidad: number; costoUnitario: number }[]
}

export interface DatosDevolucionProveedor {
  compraId?: number
  items: { productoId: number; cantidad: number; costoUnitario?: number }[]
  motivo: MotivoDevolucionProveedor
  nota?: string
  resolucion: ResolucionProveedor
  clave?: string
}

export interface VentaListada {
  id: number
  numero: number
  fecha: Date
  vendedor: string
  total: number
  pagado: number
  vueltas: number
  medioPago: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
  estado: 'COMPLETADA' | 'ANULADA'
  motivoAnulacion?: string
  items: LineaVentaListada[]
  devoluciones?: DevolucionVenta[]
  /** Solo lo ve el dueño. */
  ganancia?: number
}

export interface FiltroVentas {
  /** Días completos AAAA-MM-DD, ambos incluidos (en la zona horaria del negocio). */
  desde?: string
  hasta?: string
  estado?: 'COMPLETADA' | 'ANULADA'
  pagina?: number
}

/** Lo que el servidor (o la demo) responde al registrar una venta: es la VERDAD, el front solo la muestra. */
export interface ResultadoVenta {
  numero: number
  total: number
  pagado: number
  vueltas: number
  /** Unidades vendidas. */
  items: number
}

export interface PagoVenta {
  pagado: number
  medioPago?: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
  /** Clave de este intento de venta (Idempotency-Key): la misma clave dos veces nunca registra dos ventas. */
  clave?: string
}

/*
  Contrato de datos del catálogo. Las pantallas SOLO conocen esta interfaz; hay dos implementaciones:
    · CatalogoDemo: datos en memoria (demo pública).
    · CatalogoApi:  habla con la API y la base de datos (el producto real).
  Toda operación que cambia datos es ASÍNCRONA (hay red de por medio) y lanza ErrorApi si el servidor la rechaza
  (por ejemplo STOCK_INSUFICIENTE): la pantalla decide cómo mostrarlo.
*/
export interface Catalogo {
  /** true mientras se hace la primera carga de datos. */
  cargando: boolean
  /** Mensaje si la primera carga falló (p. ej. servidor apagado). */
  errorCarga: string | null
  /** Vuelve a pedir los datos al servidor. */
  refrescar: () => Promise<void>

  productos: Producto[]
  categorias: Categoria[]
  proveedores: Proveedor[]
  movimientos: Movimiento[]
  compras: Compra[]

  crearProducto: (datos: DatosProducto, stockInicial: number) => Promise<Producto>
  editarProducto: (id: number, cambios: Partial<DatosProducto>) => Promise<void>
  /** Sube o reemplaza la foto del producto (el archivo ya viene reducido). */
  subirImagenProducto: (id: number, imagen: Blob) => Promise<void>
  quitarImagenProducto: (id: number) => Promise<void>
  /** Crea una categoría y la devuelve (para elegirla enseguida en el formulario del producto). */
  crearCategoria: (nombre: string, color: string) => Promise<Categoria>
  /** Renombra, cambia el color o activa/desactiva una categoría (nunca se borran: el historial las necesita). */
  editarCategoria: (id: string, cambios: { nombre?: string; color?: string; activa?: boolean }) => Promise<void>
  crearProveedor: (datos: Omit<Proveedor, 'id' | 'activo'>) => Promise<Proveedor>
  editarProveedor: (id: number, cambios: Partial<Omit<Proveedor, 'id'>>) => Promise<void>
  /** Agrega categorías que no existan (por nombre). Lo usa el asistente de primer arranque. */
  crearCategorias: (nuevas: { nombre: string; color: string }[]) => Promise<void>
  /** Registra la venta. El servidor calcula total y vueltas con los precios de SU base de datos. */
  registrarVenta: (lineas: { productoId: number; cantidad: number }[], pago: PagoVenta) => Promise<ResultadoVenta>
  /** Historial de ventas (el dueño ve todas; el vendedor, solo las suyas). Pagina de 25 en 25. */
  listarVentas: (filtro: FiltroVentas) => Promise<{ total: number; items: VentaListada[] }>
  /** HU-16: anula una venta (solo el dueño): el stock vuelve y queda el motivo. */
  anularVenta: (id: number, motivo: string) => Promise<void>
  /** Devolución de un cliente (solo el dueño): el dinero vuelve al precio de la venta; el stock vuelve si el producto está bien. */
  registrarDevolucionCliente: (ventaId: number, datos: DatosDevolucionCliente) => Promise<void>
  /** Devolución de mercancía a un proveedor (solo el dueño): sale del stock. */
  registrarDevolucionProveedor: (proveedorId: number, datos: DatosDevolucionProveedor) => Promise<void>
  listarDevolucionesProveedor: (proveedorId: number) => Promise<DevolucionProveedorListada[]>
  /** HU-17: sube el stock, actualiza el costo y registra la compra y sus movimientos. */
  registrarEntrada: (proveedorId: number, lineas: LineaEntrada[], notas?: string) => Promise<Compra>
  /** Conteo físico masivo (solo el dueño): `contado` es lo que HAY. Todo o nada; solo lo que difiere deja movimiento. */
  registrarConteo: (items: { productoId: number; contado: number }[], motivo?: string) => Promise<{ cambios: { productoId: number; nombre: string; antes: number; contado: number; diferencia: number }[]; sinCambio: number }>
  /** HU-18: ajuste de stock con motivo obligatorio. `delta` lleva signo. */
  ajustarStock: (productoId: number, delta: number, motivo: string) => Promise<void>
  /** Comprobación rápida con lo que ya está cargado (el servidor igual valida que el código sea único). */
  codigoEnUso: (codigo: string, ignorarId?: number) => boolean
}

export const CatalogoContext = createContext<Catalogo | null>(null)

export function useCatalogo(): Catalogo {
  const c = useContext(CatalogoContext)
  if (!c) throw new Error('useCatalogo debe usarse dentro de CatalogoProvider')
  return c
}
