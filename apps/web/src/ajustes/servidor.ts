import type { Ajustes } from './contexto'

/*
  Traducción entre los ajustes del front y la configuración del servidor (tabla "configuracion").
  Casi todo se llama igual; la diferencia es el color de acento: "acento" en el front, "colorAcento" en la API.
*/
export interface ConfigServidor {
  nombreNegocio?: string
  nit?: string
  direccion?: string
  telefono?: string
  permitirVentaSinStock?: boolean
  controlarStockPorDefecto?: boolean
  metaDiaria?: number
  colorAcento?: string | null
  patron?: Ajustes['patron']
  intensidad?: number
  proveedoresActivo?: boolean
  recibo?: Ajustes['recibo']
  copias?: Ajustes['copias']
}

/** Del servidor al front (acepta respuestas parciales, como la marca pública). */
export function desdeServidor(c: ConfigServidor): Partial<Ajustes> {
  const { colorAcento, ...resto } = c
  const r: Partial<Ajustes> = { ...resto }
  if (colorAcento !== undefined) r.acento = colorAcento
  return r
}

/** Del front al servidor: solo los campos que el servidor conoce (rechaza los desconocidos). */
export function haciaServidor(p: Partial<Ajustes>): ConfigServidor {
  const { acento, ...resto } = p
  const r: ConfigServidor = { ...resto }
  if (acento !== undefined) r.colorAcento = acento
  return r
}
