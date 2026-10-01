/*
  Cliente HTTP único de la aplicación. TODA conversación con la API pasa por aquí, así hay un solo lugar
  que sabe del token, de cómo se ven los errores del servidor y de qué hacer cuando la sesión vence.
*/
const CLAVE_TOKEN = 'nivel-token'

export const token = {
  leer(): string | null {
    try { return localStorage.getItem(CLAVE_TOKEN) } catch { return null }
  },
  guardar(t: string) {
    try { localStorage.setItem(CLAVE_TOKEN, t) } catch { /* sin almacenamiento: la sesión dura hasta recargar */ }
  },
  borrar() {
    try { localStorage.removeItem(CLAVE_TOKEN) } catch { /* nada que borrar */ }
  },
}

/** Error del servidor ya interpretado. `codigo` es estable (el front decide qué mostrar según él, no según el texto). */
export class ErrorApi extends Error {
  readonly estado: number
  readonly codigo: string
  readonly detalles?: unknown
  constructor(estado: number, codigo: string, mensaje: string, detalles?: unknown) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.detalles = detalles
  }
}

let alVencerSesion: (() => void) | null = null
/** El proveedor de sesión se registra aquí para enterarse cuando el servidor dice "tu sesión ya no vale". */
export const registrarVencimiento = (fn: (() => void) | null) => { alVencerSesion = fn }

type Consulta = Record<string, string | number | boolean | undefined | null>

export function conConsulta(ruta: string, consulta?: Consulta): string {
  if (!consulta) return ruta
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(consulta)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `${ruta}?${s}` : ruta
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown, consulta?: Consulta, cabeceras?: Record<string, string>): Promise<T> {
  const t = token.leer()
  let r: Response
  try {
    r = await fetch(`/api${conConsulta(ruta, consulta)}`, {
      method: metodo,
      headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}), ...cabeceras },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    })
  } catch {
    // fetch solo falla por red (servidor apagado, sin WiFi…): no es un error de la aplicación
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Revisa que el sistema esté encendido y la red funcione.')
  }

  if (r.status === 204) return undefined as T
  const texto = await r.text()
  let datos: unknown = null
  try { datos = texto ? JSON.parse(texto) : null } catch { /* respuesta que no es JSON (p. ej. página de error de nginx) */ }

  if (!r.ok) {
    const e = (datos as { error?: { codigo?: string; mensaje?: string; detalles?: unknown } } | null)?.error
    const err = new ErrorApi(r.status, e?.codigo ?? 'ERROR', e?.mensaje ?? `El servidor respondió con un error (${r.status}).`, e?.detalles)
    // Con sesión abierta, un 401 significa que venció o fue revocada (p. ej. desactivaron al usuario).
    if (r.status === 401 && t && (err.codigo === 'SESION_INVALIDA' || err.codigo === 'NO_AUTENTICADO')) {
      token.borrar()
      alVencerSesion?.()
    }
    throw err
  }
  return datos as T
}

/** Sube una imagen como cuerpo crudo (no multipart): el servidor revisa los bytes y decide el nombre del archivo. */
async function subirImagen<T>(ruta: string, imagen: Blob): Promise<T> {
  const t = token.leer()
  let r: Response
  try {
    r = await fetch(`/api${ruta}`, { method: 'POST', headers: { 'Content-Type': imagen.type || 'application/octet-stream', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: imagen })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor. Revisa que el sistema esté encendido y la red funcione.')
  }
  const datos = (await r.json().catch(() => null)) as unknown
  if (!r.ok) {
    const e = (datos as { error?: { codigo?: string; mensaje?: string } } | null)?.error
    throw new ErrorApi(r.status, e?.codigo ?? 'ERROR', e?.mensaje ?? `El servidor respondió con un error (${r.status}).`)
  }
  return datos as T
}

/** Descarga un archivo protegido (lleva el token) y lo guarda con el nombre dado. */
export async function bajarArchivo(ruta: string, nombre: string): Promise<void> {
  const t = token.leer()
  let r: Response
  try {
    r = await fetch(`/api${ruta}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con el servidor.')
  }
  if (!r.ok) throw new ErrorApi(r.status, 'ERROR', `No se pudo descargar el archivo (${r.status}).`)
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const api = {
  subirImagen,
  delete: <T>(ruta: string) => pedir<T>('DELETE', ruta),
  get: <T>(ruta: string, consulta?: Consulta) => pedir<T>('GET', ruta, undefined, consulta),
  post: <T>(ruta: string, cuerpo?: unknown, cabeceras?: Record<string, string>) => pedir<T>('POST', ruta, cuerpo ?? {}, undefined, cabeceras),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PUT', ruta, cuerpo),
}

/** Texto amigable para mostrar al usuario a partir de cualquier error. */
export const mensajeDe = (e: unknown): string => (e instanceof ErrorApi ? e.message : 'Ocurrió un error inesperado. Intenta de nuevo.')
