import { useMemo } from 'react'
import { api } from '../api/cliente'
import { MODO_DEMO } from '../config'
import { useCatalogo } from '../data/contexto'
import { aTexto } from './periodos'

/* Tipos del cierre del día (los comparte la pantalla y las dos fuentes de datos). */
export interface Cierre { fecha: string; fondoInicial: number; efectivoEsperado: number; efectivoContado: number; diferencia: number; totalVentas: number; tickets: number; nota: string | null; actualizadoEn: string }
export interface Resumen {
  fecha: string
  hoy: string
  ventasNetas: number
  tickets: number
  porMedio: { EFECTIVO: number; TRANSFERENCIA: number; TARJETA: number }
  devuelto: { total: number; EFECTIVO: number; TRANSFERENCIA: number; TARJETA: number }
  efectivoNeto: number
  porSeccion: { id: number | string; nombre: string; color: string; ventas: number }[]
  cierre: Cierre | null
}
export interface DatosCierre { fecha: string; fondoInicial: number; efectivoContado: number; nota?: string }

export interface FuenteCierre {
  resumen: (fecha: string | null) => Promise<Resumen>
  historial: () => Promise<Cierre[]>
  guardar: (d: DatosCierre) => Promise<Resumen>
}

/* Cierres guardados en la demo: viven en memoria (se pierden al recargar la página, como el resto de la demo). */
const cierresDemo = new Map<string, Cierre>()

/*
  De dónde salen los datos del cierre:
    · sistema real → la API (el servidor calcula todo);
    · demo pública → se calcula aquí con las ventas de ejemplo en memoria (no hay servidor).
*/
export function useFuenteCierre(): FuenteCierre {
  const { listarVentas, productos, categorias } = useCatalogo()
  return useMemo<FuenteCierre>(() => {
    if (!MODO_DEMO) {
      return {
        resumen: (fecha) => api.get<Resumen>('/cierres/resumen', fecha ? { fecha } : {}),
        historial: () => api.get<Cierre[]>('/cierres', { limite: 14 }),
        guardar: (d) => api.post<Resumen>('/cierres', d),
      }
    }
    const resumenDemo = async (fecha: string | null): Promise<Resumen> => {
      const hoy = aTexto(new Date())
      const dia = fecha ?? hoy
      const { items } = await listarVentas({ desde: dia, hasta: dia, estado: 'COMPLETADA' })
      const porMedio = { EFECTIVO: 0, TRANSFERENCIA: 0, TARJETA: 0 }
      const devuelto = { total: 0, EFECTIVO: 0, TRANSFERENCIA: 0, TARJETA: 0 }
      const porSeccion = new Map<string, number>()
      for (const v of items) {
        porMedio[v.medioPago] += v.total
        for (const d of v.devoluciones ?? []) { devuelto.total += d.total; devuelto[d.medioReembolso] += d.total }
        for (const l of v.items) {
          const cat = productos.find((p) => p.id === l.productoId)?.categoriaId
          if (cat) porSeccion.set(cat, (porSeccion.get(cat) ?? 0) + l.cantidad * l.precioUnitario)
        }
      }
      return {
        fecha: dia, hoy,
        ventasNetas: items.reduce((s, v) => s + v.total, 0) - devuelto.total,
        tickets: items.length, porMedio, devuelto,
        efectivoNeto: porMedio.EFECTIVO - devuelto.EFECTIVO,
        porSeccion: categorias.filter((c) => porSeccion.has(c.id)).map((c) => ({ id: c.id, nombre: c.nombre, color: c.color, ventas: porSeccion.get(c.id) ?? 0 })).sort((a, b) => b.ventas - a.ventas),
        cierre: cierresDemo.get(dia) ?? null,
      }
    }
    return {
      resumen: resumenDemo,
      historial: async () => [...cierresDemo.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 14),
      guardar: async (d) => {
        const r = await resumenDemo(d.fecha)
        const esperado = d.fondoInicial + r.efectivoNeto
        cierresDemo.set(d.fecha, {
          fecha: d.fecha, fondoInicial: d.fondoInicial, efectivoEsperado: esperado, efectivoContado: d.efectivoContado,
          diferencia: d.efectivoContado - esperado, totalVentas: r.ventasNetas, tickets: r.tickets, nota: d.nota ?? null, actualizadoEn: new Date().toISOString(),
        })
        return resumenDemo(d.fecha)
      },
    }
  }, [listarVentas, productos, categorias])
}

