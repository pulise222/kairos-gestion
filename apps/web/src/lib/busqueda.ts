import type { Producto } from '../mock/catalogo'

/** Minúsculas y sin tildes, para que "jabon" encuentre "Jabón". */
export const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/*
  Puntaje de coincidencia (menor = mejor). Orden de importancia:
    0  el código es EXACTAMENTE lo escrito   (escribir "101" trae el 101 primero, no el "1015")
    1  el código empieza por lo escrito      ("10" → 101, 102, 103…)
    2  el nombre empieza por lo escrito
    3  alguna palabra del nombre empieza por lo escrito
    4  el nombre contiene lo escrito
    5  el código contiene lo escrito (en cualquier parte), solo si se escribieron 4 o más caracteres
  null = no coincide.
*/
function puntaje(p: Producto, q: string): number | null {
  const nombre = normalizar(p.nombre)
  const codigo = p.codigo.toLowerCase()
  if (codigo === q) return 0
  if (codigo.startsWith(q)) return 1
  if (nombre.startsWith(q)) return 2
  if (nombre.split(/\s+/).some((palabra) => palabra.startsWith(q))) return 3
  if (nombre.includes(q)) return 4
  // Una parte suelta del código solo cuenta desde 4 caracteres: con 1 a 3 dígitos serían puros falsos positivos
  // dentro de los códigos de barras largos. Con 4 o más sirve, p. ej., para teclear el final de un código.
  if (q.length >= 4 && codigo.includes(q)) return 5
  return null
}

/** HU-11: busca por nombre o por código/número, ordenando lo más relevante primero. */
export function buscar(productos: Producto[], consulta: string): Producto[] {
  const q = normalizar(consulta)
  if (!q) return productos
  return productos
    .map((p) => ({ p, puntos: puntaje(p, q) }))
    .filter((x): x is { p: Producto; puntos: number } => x.puntos !== null)
    .sort((a, b) => {
      if (a.puntos !== b.puntos) return a.puntos - b.puntos
      // Búsqueda por número: 101, 102, 103… en orden numérico. Por nombre: alfabético.
      if (a.puntos <= 1) return a.p.codigo.localeCompare(b.p.codigo, 'es', { numeric: true })
      return a.p.nombre.localeCompare(b.p.nombre, 'es')
    })
    .map((x) => x.p)
}

/** Siguiente número corto libre para "Generar código": el mayor número usado + 1 (mínimo 101). */
export function siguienteCodigo(productos: Producto[]): string {
  const numericos = productos.map((p) => p.codigo).filter((c) => /^\d{1,6}$/.test(c)).map(Number)
  return String(Math.max(100, ...numericos) + 1)
}

/** Margen sobre el precio de venta: lo que queda de cada peso vendido. */
export function margen(precio: number, costo: number) {
  const pesos = precio - costo
  return { pesos, porcentaje: precio > 0 ? Math.round((pesos / precio) * 100) : 0 }
}

export type EstadoStock = 'agotado' | 'bajo' | 'ok'

export function estadoDe(p: Pick<Producto, 'stock' | 'minimo'>): EstadoStock {
  if (p.stock <= 0) return 'agotado'
  if (p.stock <= p.minimo) return 'bajo'
  return 'ok'
}
