import type { Categoria, Producto } from '../../mock/catalogo'
import { pesos } from '../../lib/dinero'
import { AnilloStock } from './Graficas'
import { Miniatura } from './Miniatura'

interface Props {
  producto: Producto
  categoria?: Categoria
  seleccionado?: boolean
  /** Sin stock y la regla de negocio no permite vender así. */
  bloqueado?: boolean
  onAgregar: () => void
}

export function ProductoTarjeta({ producto: p, categoria, seleccionado, bloqueado, onAgregar }: Props) {
  return (
    <button
      onClick={onAgregar}
      aria-disabled={bloqueado}
      aria-label={`${p.nombre}, ${pesos(p.precio)}, ${p.stock} en stock${bloqueado ? ', agotado' : ''}`}
      className={`group relative flex flex-col gap-3 rounded-2xl border bg-panel p-3 text-left transition active:scale-[0.98] ${
        seleccionado ? 'border-accent ring-2 ring-accent/40' : 'border-line hover:border-accent/60'
      } ${bloqueado ? 'opacity-55 grayscale' : ''}`}
    >
      <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={categoria} className="aspect-[4/3] w-full rounded-xl transition group-hover:brightness-95" iconoClase="size-9" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{p.nombre}</p>
        <p className="tabular truncate text-[11px] text-muted">N.º {p.codigo}</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="tabular text-sm font-semibold">{pesos(p.precio)}</span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <AnilloStock stock={p.stock} minimo={p.minimo} tamano="size-4" />
            <span className="tabular">{p.stock}</span>
          </span>
        </div>
      </div>
      {bloqueado && <span className="absolute right-2 top-2 rounded-full bg-bad px-2 py-0.5 text-[11px] font-semibold text-white">Agotado</span>}
    </button>
  )
}
