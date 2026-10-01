/* Catálogo de ejemplo del prototipo. Dinero en pesos enteros. En el sistema real vendrá de la API. */
export interface Categoria {
  id: string
  nombre: string
  color: string // para teñir las tarjetas; no es el color del tema
  /** false = oculta al elegir categoría de un producto nuevo (los productos que ya la usan la conservan). */
  activa?: boolean
}

export interface Proveedor {
  id: number
  nombre: string
  telefono: string
  correo: string
  notas: string
  activo: boolean
}

export interface Producto {
  id: number
  /** Identificación del producto: código de barras (el lector lo "teclea") o un número corto propio (ej. 101). */
  codigo: string
  nombre: string
  /** Texto libre: «Botella plástica de 600 ml», sabor, presentación… También se usa al buscar. */
  descripcion?: string
  /** Dirección de la foto (en el sistema real, una ruta /uploads/…). Sin foto se usa el ícono de la categoría. */
  imagen?: string | null
  categoriaId: string
  proveedorId: number | null
  precio: number
  costo: number
  stock: number
  minimo: number
  activo: boolean
}

export const categorias: Categoria[] = [
  { id: 'bebidas', nombre: 'Bebidas', color: '#2f7fb8' },
  { id: 'aseo', nombre: 'Aseo', color: '#2e9e8f' },
  { id: 'abarrotes', nombre: 'Abarrotes', color: '#b8892a' },
  { id: 'lacteos', nombre: 'Lácteos', color: '#7a6bb8' },
  { id: 'snacks', nombre: 'Snacks', color: '#c2543f' },
]

export const proveedoresIniciales: Proveedor[] = [
  { id: 1, nombre: 'Distribuciones Andina', telefono: '300 123 4567', correo: 'pedidos@andina.co', notas: 'Pasa los martes. Pedido mínimo $150.000.', activo: true },
  { id: 2, nombre: 'Aseo Total', telefono: '310 987 6543', correo: '', notas: 'Entrega a domicilio sin costo.', activo: true },
  { id: 3, nombre: 'Alimentos del Valle', telefono: '315 222 3344', correo: 'ventas@alimentosvalle.co', notas: '', activo: true },
  { id: 4, nombre: 'Lácteos La Sabana', telefono: '320 555 6677', correo: '', notas: 'Producto refrigerado: recibir antes de las 10 a. m.', activo: true },
  { id: 5, nombre: 'Panadería Central', telefono: '301 111 2233', correo: '', notas: '', activo: true },
  { id: 6, nombre: 'Dulces Tropical', telefono: '312 444 5566', correo: '', notas: 'Ya no trabajamos con ellos.', activo: false },
]

// Los primeros llevan un número corto propio (101, 102…); el resto, código de barras de 13 dígitos.
const p = (id: number, codigo: string, nombre: string, categoriaId: string, proveedorId: number, precio: number, costo: number, stock: number, minimo: number): Producto => ({
  id, codigo, nombre, categoriaId, proveedorId, precio, costo, stock, minimo, activo: true,
})

export const productosIniciales: Producto[] = [
  p(1, '101', 'Gaseosa 1.5 L', 'bebidas', 1, 4500, 3200, 3, 12),
  p(2, '102', 'Agua 600 ml', 'bebidas', 1, 1800, 1100, 48, 24),
  p(3, '103', 'Jugo de naranja 1 L', 'bebidas', 1, 5200, 3800, 20, 8),
  p(4, '104', 'Cerveza 330 ml', 'bebidas', 1, 3000, 2100, 36, 24),
  p(5, '201', 'Detergente 1 kg', 'aseo', 2, 12500, 9000, 2, 6),
  p(6, '202', 'Jabón de baño', 'aseo', 2, 2800, 1900, 0, 10),
  p(7, '203', 'Papel higiénico x4', 'aseo', 2, 7800, 5600, 15, 8),
  p(8, '7701001000008', 'Arroz 1 kg', 'abarrotes', 3, 4200, 3300, 40, 15),
  p(9, '7701001000009', 'Aceite 1 L', 'abarrotes', 3, 11500, 9200, 14, 6),
  p(10, '7701001000010', 'Azúcar 1 kg', 'abarrotes', 3, 4800, 3900, 22, 10),
  p(11, '7701001000011', 'Pan tajado', 'abarrotes', 5, 5600, 4100, 9, 8),
  p(12, '7701001000012', 'Leche 1 L', 'lacteos', 4, 4300, 3500, 30, 12),
  p(13, '7701001000013', 'Huevos x12', 'lacteos', 4, 9500, 7600, 18, 10),
  p(14, '7701001000014', 'Queso campesino', 'lacteos', 4, 8500, 6400, 7, 4),
  p(15, '7701001000015', 'Galletas de sal', 'snacks', 3, 2800, 1900, 8, 10),
  p(16, '7701001000016', 'Papas fritas', 'snacks', 3, 2500, 1700, 26, 12),
  p(17, '7701001000017', 'Chocolatina', 'snacks', 3, 1800, 1200, 60, 20),
]

/** Regla de negocio configurable (pregunta 5 del cliente): ¿vender con stock en cero? Aquí: no. */
export const configVenta = { permitirSinStock: false, billetes: [10000, 20000, 50000, 100000] }
