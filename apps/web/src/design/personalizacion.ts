import { useSyncExternalStore } from 'react'

/*
  Personalización por cliente: el servidor entrega (en /api/marca) la paleta, el lema y el logo que el cliente dejó en su
  carpeta «personalizacion». Aquí se convierten en CSS y se aplican sin recompilar nada.
  Los colores ya vienen validados como #RRGGBB por el servidor; aquí se revalida por si acaso (nunca se inserta texto sin validar).
*/
export type Paleta = Partial<Record<'bg' | 'panel' | 'line' | 'text' | 'muted' | 'accent' | 'on-accent' | 'tile' | 'ok' | 'warn' | 'bad' | 'rail' | 'rail-ink', string>>
export interface Personalizacion { lema?: string; claro?: Paleta; oscuro?: Paleta; logo?: string; logoOscuro?: string; logoIcono?: string; logoIconoOscuro?: string }

const HEX = /^#[0-9a-fA-F]{6}$/
const CLAVES = ['bg', 'panel', 'line', 'text', 'muted', 'accent', 'on-accent', 'tile', 'ok', 'warn', 'bad']
// «rail» es el color de la barra lateral y «rail-ink» el de sus íconos: se traducen a las variables del cristal.

/** Reglas CSS para una paleta: solo claves conocidas con colores válidos. */
function reglas(p: Paleta | undefined): string {
  if (!p) return ''
  const v = (k: keyof Paleta) => (HEX.test(p[k] ?? '') ? p[k]! : null)
  const base = CLAVES.filter((k) => v(k as keyof Paleta)).map((k) => `--${k}:${p[k as keyof Paleta]}`)
  if (v('rail')) base.push(`--rail-fill:color-mix(in srgb,${p.rail} 90%,transparent)`)
  if (v('rail-ink')) base.push(`--rail-ink:${p['rail-ink']}`, '--rail-hover:color-mix(in srgb,var(--rail-ink) 16%,transparent)')
  return base.join(';')
}

/** El CSS completo: el modo claro va en :root y el oscuro en el selector del tema oscuro (que gana por especificidad). */
export function cssDePersonalizacion(p: Personalizacion): string {
  const claro = reglas(p.claro)
  const oscuro = reglas(p.oscuro)
  return [claro && `:root{${claro}}`, oscuro && `:root[data-theme='dark']{${oscuro}}`].filter(Boolean).join('\n')
}

/** Solo se acepta un logo que venga de la carpeta de personalización del propio servidor (en la demo estática, con ruta relativa «./»). */
export const logoValido = (url: unknown): url is string => typeof url === 'string' && /^(\.\/|\/)personalizacion\/logo(-oscuro|-icono|-icono-oscuro)?\.(svg|png|webp|jpg)(\?v=\d+)?$/.test(url)

/* ───── Pequeño almacén para que <Logo> y la pantalla de acceso se enteren del logo y el lema ───── */
type Marca = { logo?: string; logoOscuro?: string; logoIcono?: string; logoIconoOscuro?: string; lema?: string }
let estado: Marca = {}
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
  const siguiente: Marca = {
    logo: logoValido(p.logo) ? p.logo : undefined, logoOscuro: logoValido(p.logoOscuro) ? p.logoOscuro : undefined,
    logoIcono: logoValido(p.logoIcono) ? p.logoIcono : undefined, logoIconoOscuro: logoValido(p.logoIconoOscuro) ? p.logoIconoOscuro : undefined,
    lema: typeof p.lema === 'string' && p.lema.length <= 80 ? p.lema : undefined,
  }
  if (JSON.stringify(siguiente) !== JSON.stringify(estado)) {
    estado = siguiente
    oyentes.forEach((f) => f())
  }
}

export const useMarcaCliente = () => useSyncExternalStore(suscribir, () => estado)
