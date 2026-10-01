import { leerPersonalizacion } from '../lib/marca.js'
import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '../db.js'
import type { Prisma as PrismaNs } from '../generated/prisma/client.js'
import { autenticar, requerirRol } from '../middleware/auth.js'
import { validar } from '../lib/validar.js'
import { colorHex, dinero, texto } from '../lib/esquemas.js'

/*
  Ajustes del negocio guardados como pares clave → valor (tabla "configuracion").
  Cada ajuste tiene un valor por defecto, así el sistema funciona aunque nadie haya configurado nada.
  Viven en el SERVIDOR (no en cada navegador): si el dueño cambia el nombre o apaga un módulo,
  lo ven todos los dispositivos del local.
*/
const recibo = z.object({
  encabezado: z.string().trim().max(200),
  pie: z.string().trim().max(200),
  ancho: z.union([z.literal(58), z.literal(80)]),
  mostrarVendedor: z.boolean(),
  mostrarNumero: z.boolean(),
  avisoSinValidez: z.boolean(),
})

const copias = z.object({
  frecuencia: z.enum(['diaria', 'cierre']),
  conservar: z.number().int().min(1).max(60),
  destino: z.string().trim().max(200),
  nube: z.boolean(),
})

export const esquemaConfig = z.object({
  // Negocio
  nombreNegocio: texto(80),
  nit: z.string().trim().max(30),
  direccion: z.string().trim().max(120),
  telefono: z.string().trim().max(30),
  moneda: z.string().trim().length(3), // código ISO: COP
  zonaHoraria: z.string().min(3).max(60),
  // Reglas de venta
  /** Pregunta 5 del cliente: ¿se puede vender con stock en cero? Por defecto NO. */
  permitirVentaSinStock: z.boolean(),
  metaDiaria: dinero,
  billetes: z.array(z.number().int().positive().max(1_000_000)).max(8),
  // Apariencia (null = el color del tema)
  colorAcento: colorHex.nullable(),
  patron: z.enum(['curvas', 'puntos', 'ondas']),
  intensidad: z.number().int().min(0).max(100),
  // Módulos
  proveedoresActivo: z.boolean(),
  // Recibo y copias de seguridad
  recibo,
  copias,
})

export type Config = z.infer<typeof esquemaConfig>

export const CONFIG_POR_DEFECTO: Config = {
  nombreNegocio: 'Mi negocio',
  nit: '',
  direccion: '',
  telefono: '',
  moneda: 'COP',
  zonaHoraria: 'America/Bogota',
  permitirVentaSinStock: false,
  metaDiaria: 0,
  billetes: [10000, 20000, 50000, 100000],
  colorAcento: null,
  patron: 'curvas',
  intensidad: 50,
  proveedoresActivo: true,
  recibo: { encabezado: '¡Gracias por su compra!', pie: 'Vuelva pronto', ancho: 80, mostrarVendedor: true, mostrarNumero: true, avisoSinValidez: true },
  copias: { frecuencia: 'diaria', conservar: 14, destino: '', nube: false },
}

type Cliente = Prisma | PrismaNs.TransactionClient

/**
 * Lee la configuración completa: valores guardados + valor por defecto para lo que falte.
 * Cada clave se valida POR SEPARADO: si una quedó dañada en la base, solo esa vuelve a su valor
 * por defecto (antes, una sola mala reiniciaba todos los ajustes).
 */
export async function leerConfig(db: Cliente): Promise<Config> {
  const filas = await db.configuracion.findMany()
  const guardado = new Map(filas.map((f) => [f.clave, f.valor]))
  const resultado: Record<string, unknown> = { ...CONFIG_POR_DEFECTO }
  for (const [clave, esquema] of Object.entries(esquemaConfig.shape)) {
    if (!guardado.has(clave)) continue
    const r = esquema.safeParse(guardado.get(clave))
    if (r.success) resultado[clave] = r.data
  }
  return resultado as Config
}

/** Lo MÍNIMO que puede ver cualquiera antes de iniciar sesión, para dibujar la pantalla de acceso con la marca del negocio. */
export const camposPublicos = ['nombreNegocio', 'colorAcento', 'patron', 'intensidad'] as const

export function rutaMarcaPublica(prisma: Prisma, personalizacionDir = './personalizacion') {
  const r = Router()
  r.get('/', async (_req, res) => {
    const c = await leerConfig(prisma)
    res.json({ ...Object.fromEntries(camposPublicos.map((k) => [k, c[k]])), personalizacion: leerPersonalizacion(personalizacionDir) })
  })
  return r
}

export function rutasConfiguracion(prisma: Prisma, secreto: string) {
  const r = Router()
  r.use(autenticar(prisma, secreto))

  // Cualquier usuario la lee (el vendedor necesita los billetes rápidos y la regla de stock).
  r.get('/', async (_req, res) => {
    res.json(await leerConfig(prisma))
  })

  // Solo el dueño la cambia. Se aceptan cambios parciales.
  r.put('/', requerirRol('DUENO'), async (req, res) => {
    const cambios = validar(esquemaConfig.partial().strict(), req.body)
    await prisma.$transaction(
      Object.entries(cambios).map(([clave, valor]) =>
        prisma.configuracion.upsert({ where: { clave }, create: { clave, valor: valor as never }, update: { valor: valor as never } }),
      ),
    )
    res.json(await leerConfig(prisma))
  })

  return r
}
