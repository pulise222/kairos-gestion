import { useSyncExternalStore } from 'react'

/*
  Personalización por cliente: el servidor entrega (en /api/marca) la paleta, el lema y el logo que el cliente dejó en su
  carpeta «personalizacion». Aquí se convierten en CSS y se aplican sin recompilar nada.
  Los colores ya vienen validados como #RRGGBB por el servidor; aquí se revalida por si acaso (nunca se inserta texto sin validar).
*/
export type Paleta = Partial<Record<'bg' | 'panel' | 'line' | 'text' | 'muted' | 'accent' | 'on-accent' | 'tile' | 'ok' | 'warn' | 'bad', string>>
export interface Personalizacion { lema?: string; claro?: Paleta; oscuro?: Paleta; logo?: string }

const HEX = /^#[0-9a-fA-F]{6}$/
const CLAVES = ['bg', 'panel', 'line', 'text', 'muted', 'accent', 'on-accent', 'tile', 'ok', 'warn', 'bad']

/** Reglas CSS para una paleta: solo claves conocidas con colores válidos. */
function reglas(p: Paleta | undefined): string {
  if (!p) return ''
  return CLAVES.filter((k) => HEX.test(p[k as keyof Paleta] ?? '')).map((k) => `--${k}:${p[k as keyof Paleta]}`).join(';')
}

/** El CSS completo: el modo claro va en :root y el oscuro en el selector del tema oscuro (que gana por especificidad). */
export function cssDePersonalizacion(p: Personalizacion): string {
  const claro = reglas(p.claro)
  const oscuro = reglas(p.oscuro)
  return [claro && `:root{${claro}}`, oscuro && `:root[data-theme='dark']{${oscuro}}`].filter(Boolean).join('\n')
}

/** Solo se acepta un logo que venga de la carpeta de personalización del propio servidor. */
export const logoValido = (url: unknown): url is string => typeof url === 'string' && /^\/personalizacion\/logo\.(svg|png|webp|jpg)(\?v=\d+)?$/.test(url)

/* ───── Pequeño almacén para que <Logo> y la pantalla de acceso se enteren del logo y el lema ───── */
let estado: { logo?: string; lema?: string } = {}
const oyentes = new Set<() => void>()
const suscribir = (fn: () => void) => { oyentes.add(fn); return () => { oyentes.delete(fn) } }

export function aplicarPersonalizacion(p: Personalizacion | undefined) {
  if (!p) return
  let tag = document.getElementById('personalizacion-cliente') as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement('style')
    tag.id = 'personalizacion-cliente'
    document.head.appendChild(tag)
  }
  tag.textContent = cssDePersonalizacion(p)
  const siguiente = { logo: logoValido(p.logo) ? p.logo : undefined, lema: typeof p.lema === 'string' && p.lema.length <= 80 ? p.lema : undefined }
  if (siguiente.logo !== estado.logo || siguiente.lema !== estado.lema) {
    estado = siguiente
    oyentes.forEach((f) => f())
  }
}

export const useMarcaCliente = () => useSyncExternalStore(suscribir, () => estado)
