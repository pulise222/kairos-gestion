import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string
  error?: string
}

/* <select> nativo con estilo propio: en celular y tablet abre el selector del sistema (rápido y accesible). */
export function Selector({ etiqueta, error, className = '', children, ...resto }: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">{etiqueta}</label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error}
          {...resto}
          className={`h-12 w-full appearance-none rounded-xl border bg-bg/70 pl-4 pr-10 text-base text-ink outline-none transition focus:border-accent ${error ? 'border-bad' : 'border-line'} ${className}`}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
      </div>
      {error && <p className="mt-1.5 text-sm text-bad">{error}</p>}
    </div>
  )
}
