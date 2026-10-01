import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { PERIODOS, aTexto, etiquetaRango, validarPersonalizado } from '../../lib/periodos'
import type { PeriodoId, Rango } from '../../lib/periodos'

interface Props {
  periodo: PeriodoId
  /** Rango efectivo que se está mostrando (para escribir las fechas en claro). */
  rango: Rango
  /** Último rango personalizado válido (para rellenar los campos). */
  personalizado?: Rango
  hoy: Date
  onCambiar: (periodo: PeriodoId, personalizado?: Rango) => void
  /** Mensaje cuando la dirección traía un rango inválido. */
  errorExterno?: string
}

/* Selector de período del Panel: atajos (hoy, 7 días, mes…) y un rango libre con dos fechas. */
export function FiltroPeriodo({ periodo, rango, personalizado, hoy, onCambiar, errorExterno }: Props) {
  const hoyTexto = aTexto(hoy)
  const [desde, setDesde] = useState(personalizado?.desde ?? rango.desde)
  const [hasta, setHasta] = useState(personalizado?.hasta ?? rango.hasta)
  const [error, setError] = useState<string | null>(null)

  const aplicar = (d: string, h: string) => {
    const e = validarPersonalizado({ desde: d, hasta: h }, hoy)
    setError(e)
    if (!e) onCambiar('personalizado', { desde: d, hasta: h })
  }

  const elegir = (id: PeriodoId) => {
    if (id === 'personalizado') {
      // Al abrir el rango libre se parte de lo que se estaba viendo.
      setDesde(rango.desde)
      setHasta(rango.hasta)
      setError(null)
      onCambiar('personalizado', rango)
    } else {
      setError(null)
      onCambiar(id)
    }
  }

  const mensaje = error ?? errorExterno

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => elegir(p.id)}
              aria-pressed={periodo === p.id}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                periodo === p.id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'
              }`}
            >
              {p.id === 'personalizado' && <CalendarRange className="size-4" />}
              {p.nombre}
            </button>
          ))}
        </div>
        <span className="tabular text-sm text-muted" aria-live="polite">{etiquetaRango(rango)}</span>
      </div>

      {periodo === 'personalizado' && (
        <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Desde</span>
            <input type="date" value={desde} max={hoyTexto} onChange={(e) => { setDesde(e.target.value); aplicar(e.target.value, hasta) }}
              className="h-11 rounded-xl border border-line bg-bg/70 px-3 outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Hasta</span>
            <input type="date" value={hasta} max={hoyTexto} onChange={(e) => { setHasta(e.target.value); aplicar(desde, e.target.value) }}
              className="h-11 rounded-xl border border-line bg-bg/70 px-3 outline-none focus:border-accent" />
          </label>
          {mensaje && <p role="alert" className="pb-2.5 text-sm text-bad">{mensaje}</p>}
        </div>
      )}
      {periodo !== 'personalizado' && errorExterno && <p role="alert" className="text-sm text-bad">{errorExterno}</p>}
    </div>
  )
}
