import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/*
  Personalización por cliente SIN tocar código: una carpeta (por defecto «personalizacion», junto al .env) con
    · marca.json → paleta de colores para el modo claro y/u oscuro, y un lema
    · logo.svg / logo.png / logo.webp / logo.jpg → el logo del negocio
  Todo es opcional. Los colores se validan como #RRGGBB estricto: así un archivo mal escrito (o malicioso) no puede
  colar CSS a la pantalla. Si marca.json tiene un error, se ignora y se avisa en la consola; el sistema sigue funcionando.
*/
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Usa colores #RRGGBB, por ejemplo #b0481f')
const paleta = z.object({ bg: hex, panel: hex, line: hex, text: hex, muted: hex, accent: hex, 'on-accent': hex, tile: hex, ok: hex, warn: hex, bad: hex }).partial().strict()
const esquema = z.object({ lema: z.string().trim().max(80).optional(), claro: paleta.optional(), oscuro: paleta.optional() }).strict()

export type Paleta = z.infer<typeof paleta>
export interface Personalizacion { lema?: string; claro?: Paleta; oscuro?: Paleta; logo?: string }

const LOGOS = ['logo.svg', 'logo.png', 'logo.webp', 'logo.jpg']
let avisado = ''

export function leerPersonalizacion(dir: string): Personalizacion {
  const r: Personalizacion = {}
  const archivo = join(dir, 'marca.json')
  if (existsSync(archivo)) {
    try {
      const d = esquema.parse(JSON.parse(readFileSync(archivo, 'utf-8')))
      Object.assign(r, d)
    } catch (e) {
      // Un solo aviso por tipo de error (esta función se llama en cada carga de la pantalla de acceso).
      const msg = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join('.') || 'marca.json'}: ${i.message}`).join('; ') : 'no es un JSON válido'
      if (avisado !== msg) { avisado = msg; console.warn(`[personalizacion] se ignora marca.json: ${msg}`) }
    }
  }
  const logo = LOGOS.find((n) => existsSync(join(dir, n)))
  if (logo) r.logo = `/personalizacion/${logo}?v=${Math.round(statSync(join(dir, logo)).mtimeMs)}` // ?v= para que el navegador recargue el logo si lo cambian
  return r
}
