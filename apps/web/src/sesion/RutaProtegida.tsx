import { Navigate, Outlet } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useSesion } from './contexto'

/** Pantalla breve mientras se averigua si hay sesión. */
export function Cargando() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="text-center">
        <Logo className="mx-auto size-14 animate-pulse text-accent" />
        <p className="mt-3 text-sm text-muted">Cargando…</p>
      </div>
    </div>
  )
}

/**
 * Protege un grupo de rutas.
 *  - Sin sesión → al acceso.
 *  - soloDueno: un vendedor que escriba la dirección a mano rebota a Venta. (Es comodidad: la seguridad real la
 *    aplica el servidor, que responde 403 a un vendedor aunque se salte esta pantalla.)
 */
export function RutaProtegida({ soloDueno }: { soloDueno?: boolean }) {
  const { estado, usuario } = useSesion()
  if (estado === 'cargando') return <Cargando />
  if (estado === 'anonima') return <Navigate to="/" replace />
  if (soloDueno && usuario?.rol !== 'DUENO') return <Navigate to="/venta" replace />
  return <Outlet />
}
