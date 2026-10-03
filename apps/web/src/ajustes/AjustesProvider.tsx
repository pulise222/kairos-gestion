import { aplicarPersonalizacion } from '../design/personalizacion'
import type { Personalizacion } from '../design/personalizacion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, mensajeDe } from '../api/cliente'
import { useAviso } from '../components/ui/Avisos'
import { MODO_DEMO } from '../config'
import { rotar } from '../lib/copias'
import type { Copia } from '../lib/copias'
import { textoSobre } from '../lib/contraste'
import { useSesion } from '../sesion/contexto'
import { AjustesContext, ajustesPorDefecto, esquemaAjustes } from './contexto'
import type { Ajustes, AjustesCtx, UsuarioSistema } from './contexto'
import { desdeServidor, haciaServidor } from './servidor'
import type { ConfigServidor } from './servidor'

// La demo usa su propia clave: así quien ya la visitó con otros ajustes ve también los valores iniciales actuales.
const CLAVE = MODO_DEMO ? 'kairos-demo-ajustes' : 'nivel-ajustes'

/** Copia local de los ajustes: sirve para dibujar bien la pantalla de acceso antes de hablar con el servidor. */
function leer(): Ajustes {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return esquemaAjustes.parse(crudo ? JSON.parse(crudo) : {})
  } catch {
    return ajustesPorDefecto // almacenamiento bloqueado o JSON dañado: valores por defecto
  }
}

const mezclar = (actual: Ajustes, nuevo: Partial<Ajustes>): Ajustes => esquemaAjustes.parse({ ...actual, ...nuevo })

const HORA = 3_600_000
const copiasIniciales = (): Copia[] =>
  [4, 28, 52, 76, 100, 124].map((h, i) => ({ id: 6 - i, fecha: new Date(Date.now() - h * HORA), tamanoMB: 1.18 + i * 0.04, tipo: 'automatica' as const, destino: 'E:\\Respaldos Nivel' }))

const usuariosDemo: UsuarioSistema[] = [
  { id: 1, nombre: 'Juan Pulido', usuario: 'juan', rol: 'DUENO', activo: true },
  { id: 2, nombre: 'María Gómez', usuario: 'maria', rol: 'VENDEDOR', activo: true },
  { id: 3, nombre: 'Pedro Ramírez', usuario: 'pedro', rol: 'VENDEDOR', activo: false },
]

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

/*
  Ajustes del negocio, usuarios y copias de seguridad.
   · Modo real: los ajustes viven en el SERVIDOR (los ven todos los dispositivos del local); los usuarios, también.
   · Modo demo: todo en memoria / navegador.
  Las copias de seguridad todavía son una simulación en ambos modos (las reales llegan en la Fase 6).
*/
export function AjustesProvider({ children }: { children: ReactNode }) {
  const { estado, esDueno } = useSesion()
  const avisar = useAviso()
  const [ajustes, setAjustes] = useState<Ajustes>(leer)
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(MODO_DEMO ? usuariosDemo : [])
  const [copias, setCopias] = useState<Copia[]>(copiasIniciales)
  const sigUsuario = useRef(4)
  const sigCopia = useRef(7)
  const pendientes = useRef<Partial<Ajustes>>({})
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Antes de iniciar sesión: la "marca" pública (nombre y apariencia) para que el acceso se vea como el negocio.
  useEffect(() => {
    if (MODO_DEMO) {
      // Demo estática (sin servidor): la marca sale de archivos que se publican junto a la pantalla.
      const base = import.meta.env.BASE_URL
      fetch(`${base}personalizacion/marca.json`).then((r) => r.json()).then((m: Personalizacion) => aplicarPersonalizacion({
        ...m, logo: `${base}personalizacion/logo.png`, logoOscuro: `${base}personalizacion/logo-oscuro.png`,
        logoIcono: `${base}personalizacion/logo-icono.png`, logoIconoOscuro: `${base}personalizacion/logo-icono-oscuro.png`,
      })).catch(() => undefined)
      return
    }
    api.get<ConfigServidor & { personalizacion?: Personalizacion }>('/marca').then((m) => { aplicarPersonalizacion(m.personalizacion); setAjustes((a) => mezclar(a, desdeServidor(m))) }).catch(() => undefined)
  }, [])

  // Al iniciar sesión: la configuración completa del negocio.
  useEffect(() => {
    if (MODO_DEMO || estado !== 'activa') return
    api.get<ConfigServidor>('/configuracion').then((c) => setAjustes((a) => mezclar(a, desdeServidor(c)))).catch(() => undefined)
  }, [estado])

  // Guarda cada cambio en el navegador y aplica el color de acento a toda la app (sobrescribe la variable del tema).
  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)) } catch { /* sin almacenamiento: no se recuerda */ }
    const raiz = document.documentElement.style
    if (ajustes.acento) {
      raiz.setProperty('--accent', ajustes.acento)
      raiz.setProperty('--on-accent', textoSobre(ajustes.acento)) // el texto de los botones siempre se lee
    } else {
      raiz.removeProperty('--accent')
      raiz.removeProperty('--on-accent')
    }
  }, [ajustes])

  const cambiar = useCallback((parcial: Partial<Ajustes>) => {
    setAjustes((a) => ({ ...a, ...parcial })) // se ve al instante
    if (MODO_DEMO || !esDueno) return // solo el dueño guarda en el servidor
    // Se agrupan los cambios y se envían medio segundo después del último (así escribir en un campo no hace una petición por tecla).
    pendientes.current = { ...pendientes.current, ...parcial }
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(async () => {
      const lote = pendientes.current
      pendientes.current = {}
      try {
        await api.put('/configuracion', haciaServidor(lote))
      } catch (e) {
        avisar(`No se pudo guardar el cambio en el servidor. ${mensajeDe(e)}`, 'alerta')
      }
    }, 600)
  }, [esDueno, avisar])

  const restablecerApariencia = useCallback(
    () => cambiar({ acento: ajustesPorDefecto.acento, patron: ajustesPorDefecto.patron, intensidad: ajustesPorDefecto.intensidad }),
    [cambiar],
  )

  // ── Usuarios ──
  const cargarUsuarios = useCallback(async () => {
    if (MODO_DEMO || estado !== 'activa' || !esDueno) return
    setUsuarios(await api.get<UsuarioSistema[]>('/usuarios'))
  }, [estado, esDueno])
  useEffect(() => { cargarUsuarios().catch(() => undefined) }, [cargarUsuarios])

  const crearUsuario: AjustesCtx['crearUsuario'] = useCallback(async ({ contrasena, ...d }) => {
    if (MODO_DEMO) {
      setUsuarios((us) => [...us, { ...d, id: sigUsuario.current++, activo: true }])
      return
    }
    await api.post('/usuarios', { ...d, contrasena })
    await cargarUsuarios()
  }, [cargarUsuarios])

  const editarUsuario: AjustesCtx['editarUsuario'] = useCallback(async (id, cambios) => {
    if (MODO_DEMO) {
      setUsuarios((us) => us.map((u) => (u.id === id ? { ...u, ...cambios } : u)))
      return
    }
    await api.patch(`/usuarios/${id}`, cambios)
    await cargarUsuarios()
  }, [cargarUsuarios])

  const restablecerContrasena: AjustesCtx['restablecerContrasena'] = useCallback(async (id, nueva) => {
    if (MODO_DEMO) return
    await api.post(`/usuarios/${id}/restablecer-contrasena`, { nueva })
  }, [])

  // ── Copias de seguridad (simulación; las reales llegan en la Fase 6) ──
  const conservar = ajustes.copias.conservar
  const destino = ajustes.copias.destino
  const hacerCopia = useCallback(async () => {
    await pausa(1600)
    const nueva: Copia = { id: sigCopia.current++, fecha: new Date(), tamanoMB: 1.3, tipo: 'manual', destino }
    setCopias((cs) => rotar([nueva, ...cs], conservar))
  }, [conservar, destino])
  const restaurarCopia = useCallback(async () => { await pausa(2200) }, [])

  const valor = useMemo<AjustesCtx>(
    () => ({ ajustes, cambiar, restablecerApariencia, usuarios, crearUsuario, editarUsuario, restablecerContrasena, copias, hacerCopia, restaurarCopia }),
    [ajustes, cambiar, restablecerApariencia, usuarios, crearUsuario, editarUsuario, restablecerContrasena, copias, hacerCopia, restaurarCopia],
  )
  return <AjustesContext.Provider value={valor}>{children}</AjustesContext.Provider>
}
