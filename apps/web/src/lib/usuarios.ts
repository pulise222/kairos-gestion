import { z } from 'zod'

/* Mismas reglas que el backend (que vuelve a validar todo). Aquí solo sirven para corregir rápido en el formulario. */
export const nombreUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, 'De 3 a 30 caracteres: letras, números, punto, guion o guion bajo')

export const contrasena = z.string().min(8, 'Mínimo 8 caracteres').max(100)

export interface UsuarioBasico {
  id: number
  rol: 'DUENO' | 'VENDEDOR'
  activo: boolean
}

/**
 * ¿Se puede desactivar o quitarle el rol de dueño a este usuario?
 *  - Nunca puede quedar el sistema sin ningún dueño activo (nadie podría administrarlo).
 *  - Nadie puede desactivar su propia cuenta.
 * Devuelve el motivo si NO se puede, o null si sí.
 */
export function motivoParaNoDesactivar(usuarios: UsuarioBasico[], id: number, yoId: number): string | null {
  const u = usuarios.find((x) => x.id === id)
  if (!u) return 'El usuario no existe'
  if (id === yoId) return 'No puedes desactivar tu propia cuenta'
  const otrosDuenos = usuarios.filter((x) => x.rol === 'DUENO' && x.activo && x.id !== id).length
  if (u.rol === 'DUENO' && u.activo && otrosDuenos === 0) return 'Debe quedar al menos un dueño activo'
  return null
}

/** Iniciales para el avatar: "Juan Pulido" → "JP". */
export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
