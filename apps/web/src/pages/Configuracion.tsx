import { useState } from 'react'
import { DatabaseBackup, LayoutGrid, Palette, Receipt, Store, Tags, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SeccionApariencia } from '../components/config/SeccionApariencia'
import { SeccionCategorias } from '../components/config/SeccionCategorias'
import { MODO_DEMO } from '../config'
import { SeccionCopias } from '../components/config/SeccionCopias'
import { SeccionCopiasReal } from '../components/config/SeccionCopiasReal'
import { SeccionModulos } from '../components/config/SeccionModulos'
import { SeccionNegocio } from '../components/config/SeccionNegocio'
import { SeccionRecibo } from '../components/config/SeccionRecibo'
import { SeccionUsuarios } from '../components/config/SeccionUsuarios'

type Id = 'negocio' | 'categorias' | 'usuarios' | 'apariencia' | 'modulos' | 'recibo' | 'copias'

const secciones: { id: Id; nombre: string; Icono: LucideIcon }[] = [
  { id: 'negocio', nombre: 'Negocio', Icono: Store },
  { id: 'categorias', nombre: 'Categorías', Icono: Tags },
  { id: 'usuarios', nombre: 'Usuarios', Icono: Users },
  { id: 'apariencia', nombre: 'Apariencia', Icono: Palette },
  { id: 'modulos', nombre: 'Módulos', Icono: LayoutGrid },
  { id: 'recibo', nombre: 'Recibo', Icono: Receipt },
  { id: 'copias', nombre: 'Copias de seguridad', Icono: DatabaseBackup },
]

export function Configuracion() {
  const [activa, setActiva] = useState<Id>('negocio')
  const actual = secciones.find((s) => s.id === activa)!

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="display text-4xl md:text-5xl">Configuración</h1>
        <p className="mt-1 text-sm text-muted">Adapta el sistema a tu negocio. Solo el dueño ve esta sección.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Menú de secciones: lateral en escritorio, en fila deslizable en celular */}
        <nav aria-label="Secciones de configuración" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {secciones.map(({ id, nombre, Icono }) => (
            <button
              key={id}
              onClick={() => setActiva(id)}
              aria-current={activa === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition lg:rounded-xl ${activa === id ? 'bg-accent text-on-accent' : 'text-muted hover:bg-tile hover:text-ink'}`}
            >
              <Icono className="size-4" /> {nombre}
            </button>
          ))}
        </nav>

        <div className="min-w-0" role="region" aria-label={actual.nombre}>
          {activa === 'negocio' && <SeccionNegocio />}
          {activa === 'categorias' && <SeccionCategorias />}
          {activa === 'usuarios' && <SeccionUsuarios />}
          {activa === 'apariencia' && <SeccionApariencia />}
          {activa === 'modulos' && <SeccionModulos />}
          {activa === 'recibo' && <SeccionRecibo />}
          {activa === 'copias' && (MODO_DEMO ? <SeccionCopias /> : <SeccionCopiasReal />)}
        </div>
      </div>
    </div>
  )
}
