import { createContext, useContext } from 'react'
import { z } from 'zod'
import type { Copia } from '../lib/copias'

/*
  AJUSTES del negocio. En el sistema real vienen de la API (tabla "configuracion") y se guardan allí;
  en el prototipo se guardan en el navegador (localStorage) para que sobrevivan al recargar.
  Cada campo tiene un valor por defecto: si algo se corrompe, se vuelve a ese valor en vez de romper la app.
*/
export const esquemaAjustes = z.object({
  nombreNegocio: z.string().trim().min(1).max(80).catch('Servicios Kairos'),
  nit: z.string().max(30).catch('900.123.456-7'),
  direccion: z.string().max(120).catch('Cra 10 # 20-30, Bogotá'),
  telefono: z.string().max(30).catch('300 123 4567'),
  // Reglas de venta
  permitirVentaSinStock: z.boolean().catch(true),
  controlarStockPorDefecto: z.boolean().catch(false),
  metaDiaria: z.number().int().min(0).max(100_000_000).catch(0), // la meta es opcional: sin definir = 0
  // Apariencia
  acento: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().catch(null), // null = el del tema
  patron: z.enum(['curvas', 'puntos', 'ondas', 'costura']).catch('costura'),
  intensidad: z.number().min(0).max(100).catch(50),
  // Módulos
  proveedoresActivo: z.boolean().catch(true),
  // Recibo
  recibo: z
    .object({
      encabezado: z.string().max(200).catch('¡Gracias por su compra!'),
      pie: z.string().max(200).catch('Vuelva pronto'),
      ancho: z.union([z.literal(58), z.literal(80)]).catch(80),
      mostrarVendedor: z.boolean().catch(true),
      mostrarNumero: z.boolean().catch(true),
      avisoSinValidez: z.boolean().catch(true),
    })
    .catch({ encabezado: '¡Gracias por su compra!', pie: 'Vuelva pronto', ancho: 80, mostrarVendedor: true, mostrarNumero: true, avisoSinValidez: true }),
  // Copias de seguridad
  copias: z
    .object({
      frecuencia: z.enum(['diaria', 'cierre']).catch('diaria'),
      conservar: z.number().int().min(1).max(60).catch(14),
      destino: z.string().max(200).catch('E:\\Respaldos Nivel'),
      nube: z.boolean().catch(false),
    })
    .catch({ frecuencia: 'diaria', conservar: 14, destino: 'E:\\Respaldos Nivel', nube: false }),
})

export type Ajustes = z.infer<typeof esquemaAjustes>

export const ajustesPorDefecto: Ajustes = esquemaAjustes.parse({})

export interface UsuarioSistema {
  id: number
  nombre: string
  usuario: string
  rol: 'DUENO' | 'VENDEDOR'
  activo: boolean
}

export interface AjustesCtx {
  ajustes: Ajustes
  cambiar: (parcial: Partial<Ajustes>) => void
  restablecerApariencia: () => void
  usuarios: UsuarioSistema[]
  crearUsuario: (d: Omit<UsuarioSistema, 'id' | 'activo'> & { contrasena: string }) => Promise<void>
  editarUsuario: (id: number, cambios: Partial<Pick<UsuarioSistema, 'nombre' | 'rol' | 'activo'>>) => Promise<void>
  restablecerContrasena: (id: number, nueva: string) => Promise<void>
  copias: Copia[]
  hacerCopia: () => Promise<void>
  restaurarCopia: (id: number) => Promise<void>
}

export const AjustesContext = createContext<AjustesCtx | null>(null)

export function useAjustes(): AjustesCtx {
  const c = useContext(AjustesContext)
  if (!c) throw new Error('useAjustes debe usarse dentro de AjustesProvider')
  return c
}
