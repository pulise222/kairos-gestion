import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ErrorApi, api, registrarVencimiento, token } from '../api/cliente'
import { useAviso } from '../components/ui/Avisos'
import { MODO_DEMO } from '../config'
import { SesionContext } from './contexto'
import type { Sesion, UsuarioSesion } from './contexto'

const DUENO_DEMO: UsuarioSesion = { id: 1, nombre: 'Juan Pulido', usuario: 'juan', rol: 'DUENO' }

export function SesionProvider({ children }: { children: ReactNode }) {
  const avisar = useAviso()
  const [estado, setEstado] = useState<Sesion['estado']>('cargando')
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null)
  const [necesitaSetup, setNecesitaSetup] = useState(false)
  const [errorConexion, setErrorConexion] = useState<string | null>(null)
  // Copia del estado que se lee SIN esperar al repintado (los avisos de vencimiento llegan en ráfaga).
  const estadoRef = useRef<Sesion['estado']>('cargando')
  useEffect(() => { estadoRef.current = estado }, [estado])

  // Al abrir la aplicación: ¿hay una sesión guardada que todavía sirva? ¿o el sistema es nuevo y necesita configurarse?
  useEffect(() => {
    if (MODO_DEMO) {
      setEstado('anonima')
      return
    }
    let vivo = true
    ;(async () => {
      try {
        if (token.leer()) {
          try {
            const r = await api.get<{ usuario: UsuarioSesion }>('/auth/yo')
            if (vivo) { setUsuario(r.usuario); setEstado('activa') }
            return
          } catch (e) {
            if (e instanceof ErrorApi && e.estado === 0) throw e // sin red: no se borra la sesión, solo se avisa
            token.borrar() // venció o la revocaron
          }
        }
        const s = await api.get<{ necesitaSetup: boolean }>('/setup/estado')
        if (vivo) setNecesitaSetup(s.necesitaSetup)
      } catch (e) {
        if (vivo) setErrorConexion(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el servidor.')
      } finally {
        if (vivo) setEstado((actual) => (actual === 'cargando' ? 'anonima' : actual))
      }
    })()
    return () => { vivo = false }
  }, [])

  // El servidor puede decir en cualquier momento "tu sesión ya no vale" (venció, o el dueño te desactivó).
  useEffect(() => {
    registrarVencimiento(() => {
      // Varias peticiones pueden fallar a la vez con el mismo 401: el aviso se da UNA sola vez.
      if (estadoRef.current === 'activa') avisar('Tu sesión terminó. Inicia sesión de nuevo.', 'alerta')
      estadoRef.current = 'anonima'
      setEstado('anonima')
      setUsuario(null)
    })
    return () => registrarVencimiento(null)
  }, [avisar])

  const entrar = useCallback(async (nombre: string, clave: string): Promise<UsuarioSesion> => {
    if (MODO_DEMO) {
      setUsuario(DUENO_DEMO)
      setEstado('activa')
      return DUENO_DEMO
    }
    const r = await api.post<{ token: string; usuario: UsuarioSesion }>('/auth/login', { usuario: nombre, contrasena: clave })
    token.guardar(r.token)
    setUsuario(r.usuario)
    setEstado('activa')
    setErrorConexion(null)
    return r.usuario
  }, [])

  const iniciarConToken = useCallback((t: string, u: UsuarioSesion) => {
    token.guardar(t)
    setUsuario(u)
    setNecesitaSetup(false)
    setEstado('activa')
  }, [])

  const salir = useCallback(() => {
    token.borrar()
    setUsuario(null)
    setEstado('anonima')
  }, [])

  const valor = useMemo<Sesion>(
    () => ({ estado, usuario, esDueno: usuario?.rol === 'DUENO', necesitaSetup, errorConexion, entrar, iniciarConToken, salir }),
    [estado, usuario, necesitaSetup, errorConexion, entrar, iniciarConToken, salir],
  )
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
