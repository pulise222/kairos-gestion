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
  /** false = no se lleva inventario de este producto (se vende sin descontar stock). Si no viene, se asume que sí. */
  controlaStock?: boolean
}

export const categorias: Categoria[] = [
  { id: 'pegantes', nombre: 'Pegantes', color: '#b8892a' },
  { id: 'soluciones', nombre: 'Soluciones', color: '#2f7fb8' },
  { id: 'tintes', nombre: 'Tintes y marroquinera', color: '#7c3a5a' },
  { id: 'hilos', nombre: 'Hilos', color: '#4d9a45' },
  { id: 'agujas', nombre: 'Agujas', color: '#2e9e8f' },
  { id: 'sesgos', nombre: 'Sesgos y elásticos', color: '#c2543f' },
  { id: 'materiales', nombre: 'Materiales', color: '#7a6bb8' },
]

// Proveedores FICTICIOS (la demo es pública: no se usan los del cliente real).
export const proveedoresIniciales: Proveedor[] = [
  { id: 1, nombre: 'Químicos del Norte', telefono: '300 123 4567', correo: 'pedidos@quimicosnorte.example', notas: 'Pegantes y solventes. Pasa los martes.', activo: true },
  { id: 2, nombre: 'Tintes y Cueros Rivera', telefono: '310 987 6543', correo: '', notas: 'Entrega a domicilio sin costo.', activo: true },
  { id: 3, nombre: 'Hilos y Agujas Andina', telefono: '315 222 3344', correo: 'ventas@hilosandina.example', notas: '', activo: true },
  { id: 4, nombre: 'Sesgos y Elásticos del Valle', telefono: '320 555 6677', correo: '', notas: 'Pedido mínimo de 6 rollos.', activo: true },
  { id: 5, nombre: 'Materiales para Calzado Aguilar', telefono: '301 111 2233', correo: '', notas: '', activo: true },
  { id: 6, nombre: 'Distribuidora Esquina', telefono: '312 444 5566', correo: '', notas: 'Ya no trabajamos con ellos.', activo: false },
]

// Sin fotos: cada producto se muestra con el color de su sección (así es como lo usa el cliente real al empezar).
const p = (id: number, codigo: string, nombre: string, categoriaId: string, proveedorId: number, precio: number, costo: number, stock: number, minimo: number): Producto => ({
  id, codigo, nombre, categoriaId, proveedorId, precio, costo, stock, minimo, activo: true, imagen: null,
})

export const productosIniciales: Producto[] = [
  p(1, '0001', 'Pegante Fénix 1 L', 'pegantes', 1, 12000, 8500, 24, 8),
  p(2, '0002', 'Pegante One Way 1 L', 'pegantes', 1, 17500, 12800, 18, 6),
  p(3, '0003', 'Pegante Plus 750 ml', 'pegantes', 1, 9000, 6500, 4, 6),
  p(4, '0004', 'Thinner 1 L', 'soluciones', 1, 7000, 4800, 30, 10),
  p(5, '0005', 'Activador cleaner 500 ml', 'soluciones', 1, 14000, 10200, 11, 5),
  p(6, '0006', 'Varsol 1 L', 'soluciones', 1, 6500, 4500, 0, 6),
  p(7, '0007', 'Marroquinera negra 125 ml', 'tintes', 2, 5500, 3600, 40, 10),
  p(8, '0008', 'Pinta cuero marrón 125 ml', 'tintes', 2, 5000, 3300, 15, 8),
  p(9, '0009', 'Cono de hilo negro', 'hilos', 3, 9000, 6200, 60, 20),
  p(10, '0010', 'Hilo encerado café', 'hilos', 3, 3500, 2200, 35, 15),
  p(11, '0011', 'Agujas (paquete)', 'agujas', 3, 2800, 1700, 80, 30),
  p(12, '0012', 'Aguja industrial #14', 'agujas', 3, 4200, 2800, 7, 15),
  p(13, '0013', 'Sesgo (rollo)', 'sesgos', 4, 10000, 7100, 10, 4),
  p(14, '0014', 'Elástico 2 cm (rollo)', 'sesgos', 4, 8500, 6000, 22, 8),
  p(15, '0015', 'Plantilla de espuma (par)', 'materiales', 5, 6500, 4300, 26, 10),
  p(16, '0016', 'Lona cruda (metro)', 'materiales', 5, 7800, 5400, 15, 6),
  p(17, '0017', 'Contrafuerte (par)', 'materiales', 5, 4800, 3200, 2, 10),
]

/** Regla de negocio configurable (pregunta 5 del cliente): ¿vender con stock en cero? Kairos: sí, nunca se bloquea una venta. */
export const configVenta = { permitirSinStock: true, billetes: [10000, 20000, 50000, 100000] }
