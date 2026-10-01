interface Props {
  activo: boolean
  onCambiar: (v: boolean) => void
  etiqueta: string
  descripcion?: string
}

/* Interruptor accesible (role="switch"): se opera con ratón, toque y teclado (Espacio). */
export function Interruptor({ activo, onCambiar, etiqueta, descripcion }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onCambiar(!activo)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-bg/50 px-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-muted">{descripcion}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${activo ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${activo ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
