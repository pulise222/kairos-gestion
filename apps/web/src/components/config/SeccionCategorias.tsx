import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { useCatalogo } from '../../data/contexto'
import { mensajeDe } from '../../api/cliente'
import { COLORES_PROPIOS } from '../../mock/sugerencias'
import type { Categoria } from '../../mock/catalogo'
import { Button } from '../ui/Button'
import { Interruptor } from '../ui/Interruptor'
import { useAviso } from '../ui/Avisos'
import { Bloque } from './Bloque'

// Paleta para elegir el color de una categoría (las propias del sistema más las de las sugeridas).
const PALETA = ['#2f7fb8', '#2e9e8f', '#b8892a', '#7a6bb8', '#c2543f', '#4d9a45', '#a8443c', '#7c3a5a', ...COLORES_PROPIOS]

/** Una fila: nombre, color y si está activa. Se edita ahí mismo, sin pantallas aparte. */
function Fila({ cat, productos }: { cat: Categoria; productos: number }) {
  const { editarCategoria } = useCatalogo()
  const avisar = useAviso()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(cat.nombre)
  const [error, setError] = useState<string | null>(null)

  async function guardar(cambios: { nombre?: string; color?: string; activa?: boolean }) {
    try {
      await editarCategoria(cat.id, cambios)
      setError(null)
      return true
    } catch (e) {
      setError(mensajeDe(e))
      avisar(mensajeDe(e), 'alerta')
      return false
    }
  }

  const activa = cat.activa !== false
  return (
    <li className={`rounded-xl border border-line bg-bg/50 px-4 py-3 ${activa ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-3">
        <span className="size-4 shrink-0 rounded-full" style={{ background: cat.color }} aria-hidden="true" />
        {editando ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              const n = nombre.trim()
              if (!n) { setError('Escribe un nombre'); return }
              if (n === cat.nombre || (await guardar({ nombre: n }))) setEditando(false)
            }}
          >
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} aria-label={`Nombre de la categoría ${cat.nombre}`}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg/70 px-3 text-sm outline-none focus:border-accent" />
            <button type="submit" aria-label="Guardar nombre" className="grid size-9 place-items-center rounded-lg bg-accent text-on-accent"><Check className="size-4" /></button>
            <button type="button" aria-label="Cancelar" onClick={() => { setEditando(false); setNombre(cat.nombre); setError(null) }} className="grid size-9 place-items-center rounded-lg border border-line"><X className="size-4" /></button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{cat.nombre}{!activa && <span className="ml-2 rounded-full bg-tile px-2 py-0.5 text-xs text-muted">Desactivada</span>}</p>
              <p className="text-xs text-muted">{productos} {productos === 1 ? 'producto' : 'productos'}</p>
            </div>
            <button type="button" onClick={() => setEditando(true)} aria-label={`Renombrar ${cat.nombre}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-tile hover:text-ink"><Pencil className="size-4" /></button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-bad" role="alert">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Color de ${cat.nombre}`}>
        {PALETA.map((c) => (
          <button key={c} type="button" onClick={() => void guardar({ color: c })} aria-label={`Color ${c}`} aria-pressed={cat.color.toLowerCase() === c}
            className={`size-6 rounded-full border-2 transition ${cat.color.toLowerCase() === c ? 'border-ink' : 'border-transparent hover:scale-110'}`} style={{ background: c }} />
        ))}
      </div>

      <div className="mt-3">
        <Interruptor activo={activa} onCambiar={(v) => void guardar({ activa: v })} etiqueta="Categoría activa"
          descripcion={activa ? 'Si la desactivas, no se ofrece para productos nuevos (los que ya la usan la conservan).' : 'Está oculta al crear productos. Actívala para usarla otra vez.'} />
      </div>
    </li>
  )
}

export function SeccionCategorias() {
  const { categorias, productos, crearCategoria } = useCatalogo()
  const avisar = useAviso()
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    const n = nueva.trim()
    if (!n) { setError('Escribe el nombre de la categoría'); return }
    setCreando(true)
    try {
      await crearCategoria(n, PALETA[categorias.length % PALETA.length]!)
      setNueva(''); setError(null)
      avisar(`Categoría «${n}» creada.`, 'ok')
    } catch (err) {
      setError(mensajeDe(err))
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Bloque titulo="Categorías de productos" descripcion="Agrupan tus productos en Venta, Inventario y el Panel. Puedes renombrarlas, cambiarles el color o desactivarlas; nunca se borran, así el historial siempre se entiende.">
        <form onSubmit={crear} className="mb-4 flex gap-2">
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={60} placeholder="Nueva categoría (ej. Papelería)" aria-label="Nombre de la nueva categoría"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg/70 px-4 text-base outline-none focus:border-accent" />
          <Button type="submit" disabled={creando}><Plus className="size-4" /> Agregar</Button>
        </form>
        {error && <p className="-mt-2 mb-3 text-sm text-bad" role="alert">{error}</p>}
        <ul className="space-y-3">
          {categorias.map((c) => <Fila key={c.id} cat={c} productos={productos.filter((p) => p.categoriaId === c.id).length} />)}
        </ul>
        {categorias.length === 0 && <p className="text-sm text-muted">Aún no hay categorías. Crea la primera arriba.</p>}
      </Bloque>
    </div>
  )
}
