import { useEffect, useMemo, useState } from 'react'
import { api, mensajeDe } from '../api/cliente'
import { MODO_DEMO } from '../config'
import { useCatalogo } from '../data/contexto'
import { fechaHora } from '../lib/fechas'
import { porUrgencia } from '../lib/inventario'
import { repartirPorCategoria, repartirPorProducto, totalizar } from '../lib/panel'
import type { Totales } from '../lib/panel'
import type { Rango } from '../lib/periodos'
import { ultimasVentas as ultimasDemo } from '../mock/datos'
import { generarDias } from '../mock/ventasDiarias'
import type { DiaVentas } from '../mock/ventasDiarias'

/** Todo lo que necesita el Panel, en un formato único sin importar de dónde vengan los datos (servidor o demo). */
export interface DatosPanel {
  cargando: boolean
  error: string | null
  actual: Totales
  anterior: Totales
  /** Un registro por día del rango (con 0 en los días sin ventas). */
  dias: DiaVentas[]
  masVendidos: { id: number; nombre: string; unidades: number }[]
  porCategoria: { id: string; nombre: string; color: string; ventas: number }[]
  /** Estado ACTUAL del stock (no depende del período). */
  stockBajo: { id: number; nombre: string; stock: number; minimo: number; proveedor: string | null }[]
  ultimasVentas: { numero: number; hora: string; items: number; total: number; vendedor: string }[]
}

const vacio: Totales = { ventas: 0, ganancia: 0, tickets: 0, ticketPromedio: 0 }

/* ───────── Modo demo: se calcula con los datos de ejemplo ───────── */
function usePanelDemo(rango: Rango, anterior: Rango): DatosPanel {
  const { productos, categorias, proveedores } = useCatalogo()
  const [hoy] = useState(() => new Date())
  const dias = useMemo(() => generarDias(hoy), [hoy])
  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const actual = totalizar(dias, rango)
  return {
    cargando: false,
    error: null,
    actual,
    anterior: totalizar(dias, anterior),
    dias,
    masVendidos: repartirPorProducto(actual.ventas, activos).map((p) => ({ id: p.id, nombre: p.nombre, unidades: p.unidades })),
    porCategoria: repartirPorCategoria(actual.ventas, activos, categorias),
    stockBajo: activos
      .filter((p) => p.stock <= p.minimo)
      .sort(porUrgencia)
      .map((p) => ({ id: p.id, nombre: p.nombre, stock: p.stock, minimo: p.minimo, proveedor: proveedores.find((x) => x.id === p.proveedorId)?.nombre ?? null })),
    ultimasVentas: ultimasDemo,
  }
}

/* ───────── Modo real: lo calcula el servidor con SQL ───────── */
interface RespuestaPanel {
  periodo: Totales & { desde: string; hasta: string }
  comparacion: Totales
  serie: { dia: string; ventas: number; ganancia: number }[]
  masVendidos: { productoId: number; nombre: string; unidades: number }[]
  porCategoria: { categoria: string; color: string; ventas: number }[]
  stockBajo: { id: number; nombre: string; stock: number; stockMinimo: number; proveedor: string | null }[]
  ultimasVentas: { numero: number; total: number; creadaEn: string; vendedor: string; productos: number }[]
}

const totalesDe = (t: Totales): Totales => ({ ventas: t.ventas, ganancia: t.ganancia, tickets: t.tickets, ticketPromedio: t.ticketPromedio, devuelto: t.devuelto ?? 0 })

function usePanelApi(rango: Rango, anterior: Rango): DatosPanel {
  const [datos, setDatos] = useState<Omit<DatosPanel, 'cargando' | 'error'> | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true // si el usuario cambia de período antes de que llegue la respuesta, se descarta la vieja
    setCargando(true)
    api
      .get<RespuestaPanel>('/panel/resumen', { desde: rango.desde, hasta: rango.hasta, compararDesde: anterior.desde, compararHasta: anterior.hasta })
      .then((r) => {
        if (!vigente) return
        setDatos({
          actual: totalesDe(r.periodo),
          anterior: totalesDe(r.comparacion),
          dias: r.serie.map((d) => ({ fecha: d.dia, ventas: d.ventas, ganancia: d.ganancia, tickets: 0 })),
          masVendidos: r.masVendidos.map((m) => ({ id: m.productoId, nombre: m.nombre, unidades: m.unidades })),
          porCategoria: r.porCategoria.map((c) => ({ id: c.categoria, nombre: c.categoria, color: c.color, ventas: c.ventas })),
          stockBajo: r.stockBajo.map((s) => ({ id: s.id, nombre: s.nombre, stock: s.stock, minimo: s.stockMinimo, proveedor: s.proveedor })),
          ultimasVentas: r.ultimasVentas.map((v) => ({ numero: v.numero, hora: fechaHora(new Date(v.creadaEn)), items: v.productos, total: v.total, vendedor: v.vendedor })),
        })
        setError(null)
      })
      .catch((e) => vigente && setError(mensajeDe(e)))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }, [rango.desde, rango.hasta, anterior.desde, anterior.hasta])

  // Mientras llega la respuesta de un nuevo período se siguen mostrando los datos anteriores (sin parpadeos en blanco).
  return {
    cargando,
    error,
    actual: datos?.actual ?? vacio,
    anterior: datos?.anterior ?? vacio,
    dias: datos?.dias ?? [],
    masVendidos: datos?.masVendidos ?? [],
    porCategoria: datos?.porCategoria ?? [],
    stockBajo: datos?.stockBajo ?? [],
    ultimasVentas: datos?.ultimasVentas ?? [],
  }
}

// El modo se decide al compilar, no cambia mientras la app corre: es seguro elegir el hook aquí.
export const usePanel = MODO_DEMO ? usePanelDemo : usePanelApi
