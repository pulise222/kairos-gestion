import type { ReactNode } from 'react'

/** Tarjeta de una sección de Configuración: título, explicación y contenido. */
export function Bloque({ titulo, descripcion, children, acciones }: { titulo: string; descripcion?: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-panel p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          {descripcion && <p className="mt-0.5 max-w-prose text-sm text-muted">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  )
}
