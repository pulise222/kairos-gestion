import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { buscar } from '../../lib/busqueda'
import type { Producto } from '../../mock/catalogo'
import { Miniatura } from './Miniatura'
import { useCatalogo } from '../../data/contexto'

interface Props {
  productos: Producto[]
  onElegir: (p: Producto) => void
  placeholder?: string
}

/* Buscador de producto con lista desplegable (patrón "combobox"): por nombre o por número/código,
   flechas para moverse, Enter para elegir y Esc para cerrar. */
export function SelectorProducto({ productos, onElegir, placeholder = 'Buscar producto por nombre o número…' }: Props) {
  const { categorias } = useCatalogo()
  const id = useId()
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [indice, setIndice] = useState(0)

  const resultados = q.trim() ? buscar(productos, q).slice(0, 6) : []

  const elegir = (p: Producto) => {
    onElegir(p)
    setQ('')
    setAbierto(false)
    setIndice(0)
  }

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setIndice((i) => Math.min(i + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const p = resultados[indice]; if (p) elegir(p) }
    else if (e.key === 'Escape' && abierto) { e.stopPropagation(); e.preventDefault(); setAbierto(false) }
  }

  return (
    <div className="relative">
      <div className="flex h-12 items-center gap-3 rounded-xl border border-line bg-bg/70 px-4 focus-within:border-accent">
        <Search className="size-5 shrink-0 text-muted" />
        <input
          role="combobox"
          aria-expanded={abierto && resultados.length > 0}
          aria-controls={`${id}-lista`}
          aria-label={placeholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); setIndice(0) }}
          onKeyDown={alTeclear}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70"
        />
      </div>
      {abierto && q.trim() && (
        <ul id={`${id}-lista`} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-10 max-h-72 overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-xl">
          {resultados.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin resultados para «{q}»</li>}
          {resultados.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === indice}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(p)}
                onMouseEnter={() => setIndice(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === indice ? 'bg-tile' : ''}`}
              >
                <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={categorias.find((c) => c.id === p.categoriaId)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.nombre}</span>
                  <span className="tabular block text-xs text-muted">N.º {p.codigo}</span>
                </span>
                <span className="tabular text-xs text-muted">stock {p.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
