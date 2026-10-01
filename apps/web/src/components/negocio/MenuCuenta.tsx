import { useEffect, useRef, useState } from 'react'
import { ChevronDown, KeyRound, LogOut, Settings } from 'lucide-react'
import { iniciales } from '../../lib/usuarios'

interface Props {
  nombre: string
  usuario: string
  esDueno: boolean
  onCambiarClave: () => void
  onConfiguracion: () => void
  onSalir: () => void
}

/* Menú de la persona que está dentro: quién es, su rol y lo que puede hacer con su cuenta. Se cierra con Esc o al tocar fuera. */
export function MenuCuenta({ nombre, usuario, esDueno, onCambiarClave, onConfiguracion, onSalir }: Props) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])

  const elegir = (accion: () => void) => () => { setAbierto(false); accion() }
  const Item = ({ onClick, children, peligro }: { onClick: () => void; children: React.ReactNode; peligro?: boolean }) => (
    <button role="menuitem" onClick={elegir(onClick)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-tile ${peligro ? 'text-bad' : 'text-ink'}`}>{children}</button>
  )

  return (
    <div ref={raiz} className="relative hidden sm:block">
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={`${nombre} · ${esDueno ? 'Dueño' : 'Vendedor'}`}
        className="glass flex h-11 items-center gap-2 rounded-full pl-1.5 pr-3 text-sm transition hover:brightness-95"
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent" aria-hidden="true">{iniciales(nombre)}</span>
        <span className="max-w-28 truncate">{nombre.split(' ')[0]}</span>
        <ChevronDown className={`size-4 text-muted transition ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {abierto && (
        <div role="menu" aria-label="Mi cuenta" className="glass absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl p-2 shadow-lg">
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-semibold">{nombre}</p>
            <p className="truncate text-xs text-muted">{esDueno ? 'Dueño' : 'Vendedor'} · {usuario}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <Item onClick={onCambiarClave}><KeyRound className="size-4 text-muted" /> Cambiar mi contraseña</Item>
          {esDueno && <Item onClick={onConfiguracion}><Settings className="size-4 text-muted" /> Configuración</Item>}
          <div className="my-1 border-t border-line" />
          <Item onClick={onSalir} peligro><LogOut className="size-4" /> Cerrar sesión</Item>
        </div>
      )}
    </div>
  )
}
