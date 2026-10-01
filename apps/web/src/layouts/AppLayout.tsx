import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Boxes, CalendarCheck, KeyRound, LayoutDashboard, LogOut, Moon, Package, ReceiptText, RefreshCw, Search, Settings, ShoppingCart, Sun, Truck, WifiOff,
} from 'lucide-react'
import { useAjustes } from '../ajustes/contexto'
import { Button } from '../components/ui/Button'
import { BotonLetra } from '../components/ui/BotonLetra'
import { EnviarComentario } from '../components/negocio/EnviarComentario'
import { MenuCuenta } from '../components/negocio/MenuCuenta'
import { CambiarContrasena } from '../components/negocio/CambiarContrasena'
import { Logo } from '../components/ui/Logo'
import { useCatalogo } from '../data/contexto'
import { Fondo } from '../design/Fondo'
import { estadoCopia } from '../lib/copias'
import { Cargando } from '../sesion/RutaProtegida'
import { useSesion } from '../sesion/contexto'
import { useTema } from '../theme/ThemeProvider'

// soloDueno: el vendedor no ve estos módulos (y además el servidor le responde 403 si intenta entrar por su cuenta).
const todos = [
  // Venta va primero: es la pantalla de todo el día.
  { a: '/venta', nombre: 'Venta', Icono: ShoppingCart, soloDueno: false },
  { a: '/ventas', nombre: 'Ventas', Icono: ReceiptText, soloDueno: false },
  { a: '/cierre', nombre: 'Cierre del día', Icono: CalendarCheck, soloDueno: true },
  { a: '/productos', nombre: 'Productos', Icono: Package, soloDueno: false },
  { a: '/inventario', nombre: 'Inventario', Icono: Boxes, soloDueno: false },
  { a: '/proveedores', nombre: 'Proveedores', Icono: Truck, soloDueno: true },
  { a: '/panel', nombre: 'Panel', Icono: LayoutDashboard, soloDueno: true },
]

// Barra de celular: cada ícono ocupa el mismo ancho, así caben todos aunque la letra sea grande.
const enlaceMovil = ({ isActive }: { isActive: boolean }) =>
  `grid h-11 min-w-0 flex-1 place-items-center rounded-full transition ${
    isActive ? 'bg-accent text-on-accent shadow-sm' : 'text-[color:var(--rail-ink)] hover:bg-[color:var(--rail-hover)]'
  }`

const enlace = ({ isActive }: { isActive: boolean }) =>
  `grid size-11 place-items-center rounded-full transition ${
    isActive ? 'bg-accent text-on-accent shadow-sm' : 'text-[color:var(--rail-ink)] hover:bg-[color:var(--rail-hover)]'
  }`

export function AppLayout() {
  const { tema, alternar } = useTema()
  const [cuenta, setCuenta] = useState(false)
  const navegar = useNavigate()
  const ruta = useLocation().pathname
  const enVenta = ruta === '/venta'
  const { ajustes, copias } = useAjustes()
  const { usuario, esDueno, salir } = useSesion()
  const { cargando, errorCarga, refrescar } = useCatalogo()

  const items = todos.filter((i) => (esDueno || !i.soloDueno) && (i.a !== '/proveedores' || ajustes.proveedoresActivo)) // lo que el dueño apagó no se muestra
  const copia = estadoCopia(copias, new Date())
  const cerrarSesion = () => { salir(); navegar('/', { replace: true }) }

  return (
    <div className="min-h-dvh md:flex md:gap-4 md:p-4">
      {/* Fondo suave en el Panel; en Venta casi plano: ahí mandan la velocidad y la legibilidad. */}
      <Fondo intensidad={enVenta ? 0.035 : 0.11} orbes={!enVenta} />

      {/* Barra lateral flotante en píldora (escritorio/tablet) */}
      <nav aria-label="Principal" className="glass rail sticky top-4 z-20 hidden h-[calc(100dvh-2rem)] w-[68px] shrink-0 flex-col items-center gap-2 rounded-full py-4 md:flex">
        <Logo enRiel className="mb-3 h-9 w-12 text-accent" />
        {items.map(({ a, nombre, Icono }) => (
          <NavLink key={a} to={a} className={enlace} title={nombre} aria-label={nombre}>
            <Icono className="size-5" />
          </NavLink>
        ))}
        <div className="flex-1" />
        {esDueno && (
          <NavLink to="/configuracion" className={enlace} title="Configuración" aria-label="Configuración">
            <Settings className="size-5" />
          </NavLink>
        )}
        <button onClick={cerrarSesion} className="grid size-11 place-items-center rounded-full text-[color:var(--rail-ink)] transition hover:bg-[color:var(--rail-hover)]" title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut className="size-5" />
        </button>
      </nav>

      <div className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-0 md:pb-4 md:pt-0">
        {/* Barra superior: buscador global, tema, estado de las copias (solo el dueño) y quién está dentro */}
        <header className="mb-5 flex items-center justify-end gap-2.5">
          <button className="glass flex h-11 min-w-0 flex-1 items-center justify-between gap-6 rounded-full px-5 text-sm text-muted md:max-w-xs md:flex-none" aria-label="Buscar en el sistema (Ctrl + K)">
            <span className="flex items-center gap-2"><Search className="size-4" /> Buscar…</span>
            <kbd className="hidden rounded-md border border-line px-1.5 text-xs sm:block">Ctrl K</kbd>
          </button>
          {esDueno && (
            <span className="glass flex h-11 items-center gap-2 rounded-full px-4 text-sm text-muted" title={copia.texto}>
              <span className={`size-2.5 rounded-full ${copia.nivel === 'ok' ? 'bg-ok' : copia.nivel === 'warn' ? 'bg-warn' : 'bg-bad'}`} /> <span className="hidden sm:inline">{copia.texto}</span>
            </span>
          )}
          <BotonLetra />
          <EnviarComentario ruta={ruta} />
          <button onClick={alternar} className="glass grid size-11 place-items-center rounded-full text-ink" aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
            {tema === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          {usuario && (
            <MenuCuenta
              nombre={usuario.nombre} usuario={usuario.usuario} esDueno={esDueno}
              onCambiarClave={() => setCuenta(true)} onConfiguracion={() => navegar('/configuracion')} onSalir={cerrarSesion}
            />
          )}
          <button onClick={() => setCuenta(true)} className="glass grid size-11 place-items-center rounded-full text-ink md:hidden" aria-label="Cambiar mi contraseña">
            <KeyRound className="size-5" />
          </button>
          {/* En celular no hay barra lateral: el cierre de sesión va aquí */}
          <button onClick={cerrarSesion} className="glass grid size-11 place-items-center rounded-full text-ink md:hidden" aria-label="Cerrar sesión">
            <LogOut className="size-5" />
          </button>
        </header>

        {cargando ? (
          <Cargando />
        ) : errorCarga ? (
          <div className="grid place-items-center rounded-[var(--radius-card)] border border-line bg-panel px-6 py-16 text-center" role="alert">
            <WifiOff className="mb-3 size-10 text-bad" />
            <p className="display text-3xl">No se pudieron cargar los datos</p>
            <p className="mt-2 max-w-md text-sm text-muted">{errorCarga}</p>
            <Button className="mt-5" onClick={() => void refrescar()}><RefreshCw className="size-4" /> Reintentar</Button>
          </div>
        ) : (
          <Outlet />
        )}
      </div>

      <CambiarContrasena abierto={cuenta} onCerrar={() => setCuenta(false)} />

      {/* Barra inferior en celular */}
      <nav aria-label="Principal" className="glass rail fixed inset-x-3 bottom-3 z-20 flex gap-0.5 rounded-full p-1.5 md:hidden">
        {[...items, ...(esDueno ? [{ a: '/configuracion', nombre: 'Configuración', Icono: Settings }] : [])].map(({ a, nombre, Icono }) => (
          <NavLink key={a} to={a} className={enlaceMovil} aria-label={nombre}>
            <Icono className="size-5" />
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
