import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  error?: string
  /** Contenido a la derecha dentro del campo (por ejemplo, el botón de ver contraseña). */
  derecha?: ReactNode
}

// Etiqueta enlazada al input (accesibilidad) y mensaje de error asociado con aria-describedby.
export function Campo({ etiqueta, error, derecha, className = '', ...resto }: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...resto}
          className={`h-12 w-full rounded-xl border bg-bg/70 px-4 text-base text-ink outline-none transition placeholder:text-muted/60 focus:border-accent ${
            error ? 'border-bad' : 'border-line'
          } ${derecha ? 'pr-12' : ''} ${className}`}
        />
        {derecha && <div className="absolute inset-y-0 right-2 flex items-center">{derecha}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  )
}
