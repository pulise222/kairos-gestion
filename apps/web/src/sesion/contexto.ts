import { createContext, useContext } from 'react'

export interface UsuarioSesion {
  id: number
  nombre: string
  usuario: string
  rol: 'DUENO' | 'VENDEDOR'
}

export interface Sesion {
  /** cargando: aún no sabemos · activa: hay alguien dentro · anonima: hay que iniciar sesión */
  estado: 'cargando' | 'activa' | 'anonima'
  usuario: UsuarioSesion | null
  esDueno: boolean
  /** true si la base de datos no tiene ningún usuario: toca el asistente de primer arranque. */
  necesitaSetup: boolean
  /** Si el servidor no respondió al abrir la aplicación. */
  errorConexion: string | null
  entrar: (usuario: string, clave: string) => Promise<UsuarioSesion>
  /** Para el asistente de primer arranque: el servidor ya devolvió el token del dueño recién creado. */
  iniciarConToken: (token: string, usuario: UsuarioSesion) => void
  salir: () => void
}

export const SesionContext = createContext<Sesion | null>(null)

export function useSesion(): Sesion {
  const c = useContext(SesionContext)
  if (!c) throw new Error('useSesion debe usarse dentro de SesionProvider')
  return c
}
