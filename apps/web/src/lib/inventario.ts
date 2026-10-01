import type { Producto } from '../mock/catalogo'

/*
  Reglas del inventario como funciones PURAS (fáciles de probar). El backend real vuelve a aplicarlas
  dentro de una transacción; aquí solo sirven para el prototipo y para mostrar vistas previas.
*/
export interface LineaEntrada {
  productoId: number
  cantidad: number
  costoUnitario: number
}

export interface CambioStock {
  productoId: number
  /** Con signo: + sube el stock, − lo baja. */
  cantidad: number
  stockResultante: number
}

/** Total de una compra a proveedor. */
export const totalEntrada = (lineas: LineaEntrada[]) => lineas.reduce((s, l) => s + l.cantidad * l.costoUnitario, 0)

/** HU-17: la entrada sube el stock y ACTUALIZA el costo del producto al de esta compra. */
export function aplicarEntrada(productos: Producto[], lineas: LineaEntrada[]): { productos: Producto[]; cambios: CambioStock[] } {
  const cambios: CambioStock[] = []
  const nuevos = productos.map((p) => {
    const l = lineas.find((x) => x.productoId === p.id)
    if (!l) return p
    const stock = p.stock + l.cantidad
    cambios.push({ productoId: p.id, cantidad: l.cantidad, stockResultante: stock })
    return { ...p, stock, costo: l.costoUnitario }
  })
  return { productos: nuevos, cambios }
}

export type ModoAjuste = 'conteo' | 'diferencia'

/**
 * HU-18: ajuste de stock.
 *  - conteo:     "conté 7" → el stock pasa a 7 (la diferencia se calcula sola)
 *  - diferencia: "se dañaron 2" → valor −2 (o +3 si sobró)
 * Nunca deja el stock en negativo ni acepta ajustes que no cambian nada.
 */
export function calcularAjuste(stockActual: number, modo: ModoAjuste, valor: number): { delta: number; nuevo: number } | { error: string } {
  const delta = modo === 'conteo' ? valor - stockActual : valor
  const nuevo = stockActual + delta
  if (!Number.isInteger(valor)) return { error: 'Escribe un número entero' }
  if (modo === 'conteo' && valor < 0) return { error: 'El conteo no puede ser negativo' }
  if (nuevo < 0) return { error: `No puedes quitar más de lo que hay (${stockActual})` }
  if (delta === 0) return { error: 'Ese valor deja el stock igual' }
  return { delta, nuevo }
}

/** Cantidad sugerida a pedir: llegar al doble del mínimo (al menos 1). */
export const sugerirCantidad = (p: Pick<Producto, 'stock' | 'minimo'>) => Math.max(p.minimo * 2 - p.stock, 1)

/** Orden de urgencia: agotados primero, luego los más cerca de agotarse (relación stock / mínimo). */
export function porUrgencia(a: Producto, b: Producto) {
  const r = (p: Producto) => (p.stock <= 0 ? -1 : p.minimo > 0 ? p.stock / p.minimo : Infinity)
  return r(a) - r(b) || a.nombre.localeCompare(b.nombre, 'es')
}

export interface LineaConteo {
  producto: Producto
  contado: number
  /** contado − stock del sistema (negativo = faltan, positivo = sobran). */
  diferencia: number
}

/**
 * Conteo físico masivo. `escritos` guarda lo que la persona tecleó en cada fila (texto, porque puede estar a medias).
 *  - fila vacía → no se contó: NO se toca ese producto;
 *  - número entero ≥ 0 → se compara con el sistema; si es igual, no hay cambio;
 *  - cualquier otra cosa («abc», «-3», «2.5») → queda como inválida y bloquea aplicar el conteo.
 */
export function revisarConteo(productos: Producto[], escritos: Record<number, string>) {
  const cambios: LineaConteo[] = []
  const invalidos: number[] = []
  let iguales = 0
  for (const p of productos) {
    const t = (escritos[p.id] ?? '').trim()
    if (t === '') continue
    if (!/^\d{1,7}$/.test(t)) { invalidos.push(p.id); continue }
    const contado = Number(t)
    if (contado === p.stock) iguales++
    else cambios.push({ producto: p, contado, diferencia: contado - p.stock })
  }
  return { cambios, invalidos, iguales }
}
