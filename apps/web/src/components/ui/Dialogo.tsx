import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/* Diálogo propio sobre el <dialog> nativo: da gratis el foco atrapado, Esc para cerrar y la capa oscura.
   Reemplaza a confirm() del navegador. */
interface Props {
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
  /** Si es false, Esc y clic fuera no cierran (por ejemplo, la confirmación de una venta). */
  descartable?: boolean
}

export function Dialogo({ abierto, onCerrar, children, descartable = true }: Props) {
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
      onCancel={(e) => {
        e.preventDefault()
        if (descartable) onCerrar()
      }}
      onClick={(e) => descartable && e.target === ref.current && onCerrar()}
      className="glass m-auto max-h-[92dvh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl p-0 text-ink"
    >
      <div className="p-7">{children}</div>
    </dialog>
  )
}
