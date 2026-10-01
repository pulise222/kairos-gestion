import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Target } from 'lucide-react'
import { Button } from '../ui/Button'
import { pesos } from '../../lib/dinero'

interface Props {
  /** Meta de ventas por día en pesos (0 = no hay meta). */
  metaDiaria: number
  onCambiar: (nueva: number) => void
  /** Lo que se muestra cuando HAY meta (el medidor de avance). */
  children?: ReactNode
}

/*
  La meta del día es OPCIONAL: sin meta, la tarjeta solo invita a definirla; con meta muestra el avance.
  Se cambia o se quita aquí mismo, sin ir a Configuración.
*/
export function EditorMeta({ metaDiaria, onCambiar, children }: Props) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(0)

  const abrir = () => { setValor(metaDiaria); setEditando(true) }
  const guardar = (v: number) => { onCambiar(v); setEditando(false) }

  if (editando) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); guardar(valor) }} className="space-y-3">
        <label htmlFor="meta-dia" className="block text-sm font-medium text-muted">¿Cuánto quieres vender por día?</label>
        <input
          id="meta-dia" autoFocus inputMode="numeric" autoComplete="off" placeholder="0"
          value={valor ? new Intl.NumberFormat('es-CO').format(valor) : ''}
          onChange={(e) => setValor(Math.min(100_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
          className="tabular h-12 w-full rounded-xl border border-line bg-bg/70 px-4 text-xl outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">{valor > 0 ? `Meta: ${pesos(valor)} por día.` : 'Con 0 no se usa meta.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="flex-1">Guardar</Button>
          {metaDiaria > 0 && <Button type="button" variante="secundario" onClick={() => guardar(0)}>Quitar meta</Button>}
          <Button type="button" variante="fantasma" onClick={() => setEditando(false)}>Cancelar</Button>
        </div>
      </form>
    )
  }

  if (metaDiaria > 0) {
    return (
      <>
        {children}
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted">
          <span>Meta: <b className="tabular text-ink">{pesos(metaDiaria)}</b> por día</span>
          <button onClick={abrir} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-accent hover:bg-accent/10"><Pencil className="size-4" /> Cambiar</button>
        </div>
      </>
    )
  }

  return (
    <div className="grid place-items-center py-6 text-center">
      <Target className="mb-2 size-8 text-muted opacity-60" aria-hidden="true" />
      <p className="max-w-[14rem] text-sm text-muted">Si quieres, fija cuánto deseas vender por día y aquí verás tu avance.</p>
      <Button variante="secundario" className="mt-4" onClick={abrir}>Definir una meta</Button>
    </div>
  )
}
