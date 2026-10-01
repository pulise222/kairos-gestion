import { useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import { TAMANOS, aplicarTamano, leerTamano, siguienteTamano } from '../../lib/tamanoLetra'

/* Botón «Aa»: cambia el tamaño de la letra de todo el sistema (normal → grande → muy grande). */
export function BotonLetra({ className = '' }: { className?: string }) {
  const [t, setT] = useState(leerTamano)
  const nombre = TAMANOS.find((x) => x.id === t)!.nombre
  return (
    <button
      onClick={() => { const n = siguienteTamano(t); aplicarTamano(n); setT(n) }}
      className={`glass flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink ${className}`}
      aria-label={`Tamaño de la letra: ${nombre}. Toca para cambiarlo`}
      title="Tamaño de la letra"
    >
      <ALargeSmall className="size-5" aria-hidden="true" /> <span className="hidden sm:inline">{nombre}</span>
    </button>
  )
}
