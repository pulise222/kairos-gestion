import { z } from 'zod'

/*
  Variables de entorno validadas al arrancar. Si falta algo o es inseguro, la API NO arranca
  y dice por qué (mejor fallar al inicio que descubrirlo en producción).
*/
const esquema = z.object({
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres')
    .refine((v) => !v.startsWith('CAMBIAME'), 'JWT_SECRET sigue con el valor de ejemplo: cámbialo'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().optional(),
  // Carpeta donde se guardan las fotos de los productos (en Docker será un volumen).
  // Copias de seguridad: carpeta principal y (opcional) una segunda donde se repite cada copia (USB, otro disco, OneDrive…).
  COPIAS_DIR: z.string().default('./copias'),
  COPIAS_EXTRA_DIR: z.string().optional(),
  // Reporte semanal por correo (todo opcional; ver .env.example). Se leen aparte en lib/reporte.ts.
  // Carpeta del front compilado (apps/web/dist). Si existe, la API también entrega la pantalla.
  WEB_DIR: z.string().default('../web/dist'),
  // Carpeta con el logo y la paleta del cliente (marca.json, logo.svg/png…). Opcional.
  PERSONALIZACION_DIR: z.string().default('./personalizacion'),
  UPLOADS_DIR: z.string().default('./uploads'),
})

export type Env = z.infer<typeof esquema>

export function leerEnv(fuente: Record<string, string | undefined> = process.env): Env {
  const r = esquema.safeParse(fuente)
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuración inválida:\n${detalle}`)
  }
  return r.data
}
