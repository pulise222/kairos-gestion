/*
  Preparación de la foto de un producto ANTES de subirla. Una foto de celular pesa varios MB; para una
  miniatura de tienda basta con 800 px de lado. Reducirla en el navegador ahorra espacio, tiempo y deja
  el archivo dentro del límite del servidor (3 MB).
*/

export const LADO_MAXIMO = 800
export const TIPOS_ACEPTADOS = ['image/png', 'image/jpeg', 'image/webp']
/** Tope del archivo ORIGINAL que se acepta leer (más que eso casi seguro no es una foto de producto). */
export const MAX_ORIGINAL = 25 * 1024 * 1024

/** Tamaño final manteniendo la proporción: el lado mayor queda en `max` (nunca se agranda una imagen pequeña). */
export function tamanoReducido(ancho: number, alto: number, max = LADO_MAXIMO): { ancho: number; alto: number } {
  if (ancho <= 0 || alto <= 0) return { ancho: 0, alto: 0 }
  const mayor = Math.max(ancho, alto)
  if (mayor <= max) return { ancho, alto }
  const f = max / mayor
  return { ancho: Math.max(1, Math.round(ancho * f)), alto: Math.max(1, Math.round(alto * f)) }
}

/** Revisa el archivo elegido. Devuelve el texto del problema, o null si sirve. */
export function problemaDeImagen(archivo: { type: string; size: number }): string | null {
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) return 'Usa una foto PNG, JPG o WebP.'
  if (archivo.size > MAX_ORIGINAL) return 'La foto es demasiado grande (máximo 25 MB).'
  if (archivo.size === 0) return 'El archivo está vacío.'
  return null
}

/** Reduce la foto y la devuelve como JPG liviano (fondo blanco si el original era transparente). */
export async function reducirImagen(archivo: File): Promise<Blob> {
  const mapa = await createImageBitmap(archivo).catch(() => {
    throw new Error('No se pudo leer la imagen. Prueba con otra foto.')
  })
  const { ancho, alto } = tamanoReducido(mapa.width, mapa.height)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('Tu navegador no puede procesar la imagen.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ancho, alto)
  ctx.drawImage(mapa, 0, 0, ancho, alto)
  mapa.close()
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se pudo preparar la imagen.')
  return blob
}
