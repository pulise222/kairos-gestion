import { estadoDe } from '../../lib/busqueda'
import type { Producto } from '../../mock/catalogo'

const estilos = {
  agotado: 'bg-bad/12 text-bad',
  bajo: 'bg-warn/15 text-warn',
  ok: 'bg-ok/12 text-ok',
} as const
const textos = { agotado: 'Agotado', bajo: 'Stock bajo', ok: 'En stock' } as const

/** Etiqueta del estado del stock. El color nunca es el único aviso: siempre lleva texto. */
export function EtiquetaStock({ producto }: { producto: Pick<Producto, 'stock' | 'minimo' | 'controlaStock'> }) {
  if (producto.controlaStock === false) return <span className="inline-flex rounded-full bg-tile px-2.5 py-0.5 text-xs font-semibold text-muted">Sin control de inventario</span>
  const e = estadoDe(producto)
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilos[e]}`}>{textos[e]}</span>
}

export function EtiquetaInactivo() {
  return <span className="inline-flex rounded-full bg-tile px-2.5 py-0.5 text-xs font-semibold text-muted">Inactivo</span>
}
