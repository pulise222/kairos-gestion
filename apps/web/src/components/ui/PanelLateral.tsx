import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/* Panel lateral (drawer) sobre <dialog>: foco atrapado, Esc para cerrar y capa oscura gratis.
   En celular ocupa toda la pantalla. */
interface Props {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  subtitulo?: string
  children: ReactNode
  pie?: ReactNode
}

export function PanelLateral({ abierto, onCerrar, titulo, subtitulo, children, pie }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onCerrar() }}
      onClick={(e) => e.target === ref.current && onCerrar()}
      className="panel-lateral glass m-0 ml-auto h-dvh max-h-none w-full max-w-none p-0 text-ink sm:w-[30rem] sm:rounded-l-3xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="display text-3xl leading-tight">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-muted">{subtitulo}</p>}
          </div>
          <button onClick={onCerrar} className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-tile hover:text-ink" aria-label="Cerrar panel">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {pie && <footer className="border-t border-line px-6 py-4">{pie}</footer>}
      </div>
    </dialog>
  )
}
