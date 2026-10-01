/*
  Si el dueño elige un color de acento propio, hay que decidir si el texto sobre ese color
  (el de los botones) va en blanco o en oscuro para que se lea bien.
  Se usa la luminancia relativa de WCAG: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
*/
const canal = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminancia(hex: string): number {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}

/** Relación de contraste entre dos colores (de 1 a 21). WCAG AA pide 4,5 para texto normal. */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const BLANCO = '#ffffff'
const OSCURO = '#1a1405'

/** Elige blanco u oscuro, el que dé MÁS contraste sobre el color de fondo dado. */
export const textoSobre = (fondo: string) => (contraste(fondo, BLANCO) >= contraste(fondo, OSCURO) ? BLANCO : OSCURO)

export const esHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)
