/*
  Medidor de fuerza de la contraseña, solo orientativo (el backend exige un mínimo de 8 caracteres).
  Premia la longitud antes que los símbolos: una frase larga es mejor que "P@ss1".
*/
export interface Fuerza {
  /** 0 (vacía o muy débil) a 4 (fuerte). */
  nivel: 0 | 1 | 2 | 3 | 4
  texto: string
}

const TEXTOS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'] as const
const COMUNES = ['12345678', '123456789', '1234567890', 'password', 'contrasena', 'contraseña', 'qwertyui', '11111111', 'abcd1234', 'admin123']

export function fuerzaClave(clave: string): Fuerza {
  if (!clave) return { nivel: 0, texto: '' }
  if (COMUNES.includes(clave.toLowerCase())) return { nivel: 0, texto: 'Muy común: elige otra' }
  let puntos = 0
  if (clave.length >= 8) puntos++
  if (clave.length >= 12) puntos++
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) puntos++
  if (/\d/.test(clave) && /[a-zA-Z]/.test(clave)) puntos++
  if (/[^a-zA-Z0-9]/.test(clave)) puntos++
  // Si no llega al mínimo de 8, nunca pasa de "débil", sin importar qué tenga.
  const nivel = Math.min(clave.length < 8 ? Math.min(puntos, 1) : puntos, 4) as Fuerza['nivel']
  return { nivel, texto: TEXTOS[nivel] }
}
