import { useMarcaCliente } from '../design/personalizacion'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CircleHelp, Eye, EyeOff, Moon, Sun, WifiOff } from 'lucide-react'
import { ErrorApi } from '../api/cliente'
import { Fondo } from '../design/Fondo'
import { BotonLetra } from '../components/ui/BotonLetra'
import { Logo } from '../components/ui/Logo'
import { Campo } from '../components/ui/Campo'
import { Button } from '../components/ui/Button'
import { MODO_DEMO } from '../config'
import { useAjustes } from '../ajustes/contexto'
import { Cargando } from '../sesion/RutaProtegida'
import { useSesion } from '../sesion/contexto'
import { useTema } from '../theme/ThemeProvider'

export function Login() {
  const navegar = useNavigate()
  const { tema, alternar } = useTema()
  const { ajustes } = useAjustes()
  const { lema, logo } = useMarcaCliente()
  const { estado, usuario: sesion, necesitaSetup, errorConexion, entrar } = useSesion()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [errores, setErrores] = useState<{ usuario?: string; clave?: string }>({})
  const [errorGeneral, setErrorGeneral] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  // La ayuda se abre al pasar el mouse o al enfocarla (hover) y se puede dejar FIJA con un clic o toque (celular).
  const [hover, setHover] = useState(false)
  const [fijada, setFijada] = useState(false)
  const ayuda = hover || fijada
  const entrarComo = async (nombre: string) => {
    setEnviando(true)
    try { await entrar(nombre, 'demo'); navegar('/venta', { replace: true }) } finally { setEnviando(false) }
  }

  if (estado === 'cargando') return <Cargando />
  // Ya hay sesión: cada rol cae en su pantalla de trabajo (el dueño en el Panel; el vendedor, en la caja).
  if (estado === 'activa' && sesion) return <Navigate to="/venta" replace />
  // Sistema recién instalado, sin ningún usuario: toca el asistente de primer arranque.
  if (necesitaSetup) return <Navigate to="/inicio" replace />

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const nuevos = {
      usuario: usuario.trim() ? undefined : 'Escribe tu usuario',
      clave: clave ? undefined : 'Escribe tu contraseña',
    }
    setErrores(nuevos)
    setErrorGeneral(undefined)
    if (nuevos.usuario || nuevos.clave) return
    setEnviando(true)
    try {
      const u = await entrar(usuario.trim(), clave)
      void u
      navegar('/venta', { replace: true }) // todos empiezan en Venta: es la pantalla de todo el día
    } catch (err) {
      // Mismo mensaje para "no existe" y "clave mala": el servidor no da pistas y nosotros tampoco.
      setErrorGeneral(err instanceof ErrorApi ? err.message : 'No se pudo iniciar sesión. Intenta de nuevo.')
      setClave('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 pb-10 pt-20">
      {/* Aquí el patrón es protagonista: intensidad alta */}
      <Fondo intensidad={0.24} />

      <BotonLetra className="absolute right-[4.25rem] top-4" />
      <button onClick={alternar} className="glass absolute right-4 top-4 grid size-11 place-items-center rounded-full text-ink" aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
        {tema === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      {/* Solo en la demo pública: una ayuda que se abre al pasar el mouse, al enfocarla con el teclado o al tocarla (celular). */}
      {MODO_DEMO && (
        <div
          className="absolute left-4 top-4 z-10"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(false) }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setHover(false); setFijada(false) } }}
        >
          <button
            type="button"
            onClick={() => setFijada((v) => !v)}
            onFocus={() => setHover(true)}
            aria-expanded={ayuda}
            aria-controls="ayuda-demo"
            className="glass flex h-11 items-center gap-2 rounded-full pl-3 pr-4 text-sm font-medium text-ink"
          >
            <CircleHelp className="size-5 text-accent motion-safe:animate-pulse" /> ¿Cómo entro?
          </button>
          {ayuda && (
            <div id="ayuda-demo" role="region" aria-label="Cómo entrar a la demo" className="glass mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4 text-sm">
              <p className="font-semibold">Esto es una demostración</p>
              <p className="mt-1 text-muted">No necesitas una cuenta. Elige con qué perfil quieres recorrerla; los datos son de ejemplo y se reinician al recargar.</p>
              <div className="mt-3 space-y-2">
                <Button type="button" className="w-full" disabled={enviando} onClick={() => entrarComo('juan')}>Entrar como dueño</Button>
                <Button type="button" variante="secundario" className="w-full" disabled={enviando} onClick={() => entrarComo('maria')}>Entrar como vendedora</Button>
              </div>
              <p className="mt-3 text-xs text-muted"><b className="text-ink">Dueño:</b> ve todo (panel, costos, ganancias, proveedores, configuración). <b className="text-ink">Vendedora:</b> vende y consulta, sin costos ni ganancias. También puedes escribir el usuario <b className="text-ink">maria</b> (vendedora) o cualquier otro (dueño), con cualquier contraseña.</p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={enviar} noValidate className="glass w-full max-w-sm rounded-3xl p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          {logo ? (
            // Con el logo propio del cliente, el logo completo ES la marca: no se repite el nombre del sistema.
            <>
              <Logo variante="completo" className="h-36 w-64" />
              <h1 className="sr-only">{ajustes.nombreNegocio}</h1>
            </>
          ) : (
            <>
              <Logo className="size-14 text-accent" />
              <h1 className="display mt-4 text-5xl">Nivel</h1>
              <p className="mt-1 text-sm text-muted">{ajustes.nombreNegocio}</p>
            </>
          )}
          {lema && <p className="mt-0.5 text-xs italic text-muted">{lema}</p>}
        </div>

        {errorConexion && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">
            <WifiOff className="mt-0.5 size-4 shrink-0" /> {errorConexion}
          </p>
        )}

        <div className="space-y-4">
          <Campo etiqueta="Usuario" autoComplete="username" autoFocus autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value)} error={errores.usuario} />
          <Campo
            etiqueta="Contraseña"
            type={ver ? 'text' : 'password'}
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            error={errores.clave}
            derecha={
              <button type="button" onClick={() => setVer((v) => !v)} className="grid size-9 place-items-center rounded-full text-muted hover:text-ink" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {ver ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            }
          />
        </div>

        {errorGeneral && <p role="alert" className="mt-4 text-center text-sm text-bad">{errorGeneral}</p>}

        <Button type="submit" grande className="mt-6 w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>

        {/* Solo en la demo pública: cualquier dato entra y el asistente se puede ver. En el sistema real no existe nada de esto. */}
        {MODO_DEMO && (
          <>
            <p className="mt-5 text-center text-xs text-muted">Demostración: cualquier usuario entra como dueño; «maria» entra como vendedora.</p>
            <Link to="/inicio" className="mt-2 block text-center text-xs font-medium text-accent hover:underline">Ver el asistente de primer arranque</Link>
          </>
        )}
      </form>
    </main>
  )
}
