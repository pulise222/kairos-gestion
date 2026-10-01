import { useCallback, useEffect, useState } from 'react'
import { Ban, Banknote, CreditCard, Landmark, RefreshCw, Undo2 } from 'lucide-react'
import { mensajeDe } from '../api/cliente'
import { DevolucionCliente } from '../components/negocio/DevolucionCliente'
import { FiltroPeriodo } from '../components/negocio/FiltroPeriodo'
import { Button } from '../components/ui/Button'
import { Dialogo } from '../components/ui/Dialogo'
import { PanelLateral } from '../components/ui/PanelLateral'
import { useAviso } from '../components/ui/Avisos'
import { useCatalogo } from '../data/contexto'
import type { VentaListada } from '../data/contexto'
import { estadoDevolucion, quedaAlgoPorDevolver, yaDevueltas } from '../lib/devoluciones'
import { pesos } from '../lib/dinero'
import { useEnvioUnico } from '../lib/envio'
import { fechaHora } from '../lib/fechas'
import { rangoDe } from '../lib/periodos'
import type { PeriodoId, Rango } from '../lib/periodos'
import { useSesion } from '../sesion/contexto'

type Estado = 'todas' | 'COMPLETADA' | 'ANULADA'

const MEDIOS = {
  EFECTIVO: { texto: 'Efectivo', Icono: Banknote },
  TRANSFERENCIA: { texto: 'Transferencia', Icono: Landmark },
  TARJETA: { texto: 'Tarjeta', Icono: CreditCard },
} as const

/* Historial de ventas (HU-16). El dueño ve todas y puede anularlas; el vendedor ve solo las suyas. */
export function Ventas() {
  const { listarVentas, anularVenta } = useCatalogo()
  const { esDueno } = useSesion()
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()

  const [hoy] = useState(() => new Date())
  const [periodo, setPeriodo] = useState<PeriodoId>('hoy')
  const [personalizado, setPersonalizado] = useState<Rango | undefined>()
  const [estado, setEstado] = useState<Estado>('todas')
  const rango: Rango = periodo === 'personalizado' && personalizado ? personalizado : rangoDe(periodo === 'personalizado' ? 'hoy' : periodo, hoy)

  const [ventas, setVentas] = useState<VentaListada[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<VentaListada | null>(null)
  const [anulando, setAnulando] = useState<VentaListada | null>(null)
  const [devolviendo, setDevolviendo] = useState<VentaListada | null>(null)
  const [motivo, setMotivo] = useState('')

  const cargar = useCallback(async (nuevaPagina: number, reemplazar: boolean) => {
    setCargando(true)
    setError(null)
    try {
      const r = await listarVentas({ desde: rango.desde, hasta: rango.hasta, estado: estado === 'todas' ? undefined : estado, pagina: nuevaPagina })
      setVentas((v) => (reemplazar ? r.items : [...v, ...r.items]))
      setTotal(r.total)
      setPagina(nuevaPagina)
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setCargando(false)
    }
  }, [listarVentas, rango.desde, rango.hasta, estado])

  // Se recarga al cambiar el período o el estado.
  useEffect(() => { void cargar(1, true) }, [cargar])
  // Si el detalle está abierto y la lista se recarga (p. ej. tras una devolución), el detalle se pone al día.
  useEffect(() => { setDetalle((d) => (d ? ventas.find((v) => v.id === d.id) ?? d : d)) }, [ventas])

  const totalCompletadas = ventas.filter((v) => v.estado === 'COMPLETADA').reduce((s, v) => s + v.total, 0)

  const confirmarAnulacion = () =>
    ejecutar(async () => {
      if (!anulando) return
      try {
        await anularVenta(anulando.id, motivo.trim())
        avisar(`Venta #${String(anulando.numero).padStart(4, '0')} anulada. El stock volvió.`, 'ok')
        setAnulando(null)
        setDetalle(null)
        setMotivo('')
        await cargar(1, true)
      } catch (e) {
        avisar(mensajeDe(e), 'alerta')
      }
    })

  const chip = (id: Estado, texto: string) => (
    <button key={id} onClick={() => setEstado(id)} aria-pressed={estado === id}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${estado === id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'}`}>{texto}</button>
  )

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl md:text-5xl">Ventas</h1>
          <p className="mt-1 text-sm text-muted">{esDueno ? 'Todas las ventas del negocio. Aquí puedes anular una venta hecha por error.' : 'Tus ventas. Si hay un error, pídele al dueño que la anule.'}</p>
        </div>
        <Button variante="secundario" onClick={() => void cargar(1, true)} disabled={cargando}><RefreshCw className={`size-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar</Button>
      </div>

      <FiltroPeriodo periodo={periodo} rango={rango} personalizado={personalizado} hoy={hoy}
        onCambiar={(id, p) => { setPeriodo(id); setPersonalizado(p) }} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip('todas', 'Todas')}
        {chip('COMPLETADA', 'Completadas')}
        {chip('ANULADA', 'Anuladas')}
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {total} {total === 1 ? 'venta' : 'ventas'}
        {estado !== 'ANULADA' && ventas.length > 0 && <> · mostradas suman <b className="tabular text-ink">{pesos(totalCompletadas)}</b></>}
      </p>

      {error ? (
        <div role="alert" className="rounded-[var(--radius-card)] border border-bad/40 bg-bad/10 p-5 text-sm text-bad">{error} <button onClick={() => void cargar(1, true)} className="font-semibold underline">Reintentar</button></div>
      ) : ventas.length === 0 && !cargando ? (
        <div className="grid place-items-center rounded-[var(--radius-card)] border border-dashed border-line px-4 py-16 text-center">
          <p className="display text-3xl">Sin ventas</p>
          <p className="mt-1 text-sm text-muted">No hay ventas con ese período y filtro.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
          {ventas.map((v) => {
            const M = MEDIOS[v.medioPago]
            return (
              <li key={v.id}>
                <button onClick={() => setDetalle(v)} aria-label={`Ver venta ${v.numero}`} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-tile">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${v.estado === 'ANULADA' ? 'bg-bad/12 text-bad' : 'bg-accent/12 text-accent'}`}>
                    {v.estado === 'ANULADA' ? <Ban className="size-5" /> : <M.Icono className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <b className="tabular">#{String(v.numero).padStart(4, '0')}</b>
                      <span className="text-xs text-muted">{fechaHora(v.fecha)} · {v.vendedor}</span>
                      {v.estado === 'ANULADA' && <span className="rounded-full bg-bad/12 px-2 py-0.5 text-[11px] font-semibold text-bad">Anulada</span>}
                      {v.estado === 'COMPLETADA' && estadoDevolucion(v.items, v.devoluciones) !== 'ninguna' && (
                        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">{estadoDevolucion(v.items, v.devoluciones) === 'total' ? 'Devuelta' : 'Devolución parcial'}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">{v.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}</span>
                  </span>
                  <span className={`tabular text-sm font-semibold ${v.estado === 'ANULADA' ? 'text-muted line-through' : ''}`}>{pesos(v.total)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {ventas.length < total && (
        <Button variante="secundario" className="w-full" onClick={() => void cargar(pagina + 1, false)} disabled={cargando}>
          {cargando ? 'Cargando…' : `Ver más (${total - ventas.length} restantes)`}
        </Button>
      )}

      {/* Detalle de una venta */}
      <PanelLateral
        abierto={!!detalle}
        onCerrar={() => setDetalle(null)}
        titulo={detalle ? `Venta #${String(detalle.numero).padStart(4, '0')}` : ''}
        subtitulo={detalle ? `${fechaHora(detalle.fecha)} · ${detalle.vendedor}` : undefined}
        pie={detalle && esDueno && detalle.estado === 'COMPLETADA' ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {quedaAlgoPorDevolver(detalle.items, detalle.devoluciones) && (
              <Button variante="secundario" className="flex-1" onClick={() => setDevolviendo(detalle)}><Undo2 className="size-4" /> Registrar devolución</Button>
            )}
            {/* Una venta con devoluciones ya no se anula (se duplicaría el stock): el servidor también lo rechaza. */}
            {!detalle.devoluciones?.length && (
              <Button variante="peligro" className="flex-1" onClick={() => { setMotivo(''); setAnulando(detalle) }}><Ban className="size-4" /> Anular esta venta</Button>
            )}
          </div>
        ) : undefined}
      >
        {detalle && (
          <div className="space-y-5">
            {detalle.estado === 'ANULADA' && (
              <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad"><b>Venta anulada.</b> Motivo: {detalle.motivoAnulacion ?? '—'}. El stock ya volvió a los productos.</p>
            )}
            <ul className="divide-y divide-line rounded-xl border border-line">
              {detalle.items.map((i) => (
                <li key={`${i.productoId}-${i.nombre}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{i.nombre}</span><span className="tabular text-xs text-muted">{i.cantidad} × {pesos(i.precioUnitario)}{yaDevueltas(i, detalle.devoluciones) > 0 && <b className="text-warn"> · devueltas {yaDevueltas(i, detalle.devoluciones)}</b>}</span></span>
                  <span className="tabular font-semibold">{pesos(i.cantidad * i.precioUnitario)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 rounded-xl bg-tile p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="display tabular text-2xl">{pesos(detalle.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Pagó con ({MEDIOS[detalle.medioPago].texto.toLowerCase()})</dt><dd className="tabular">{pesos(detalle.pagado)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Vueltas</dt><dd className="tabular">{pesos(detalle.vueltas)}</dd></div>
              {esDueno && detalle.ganancia !== undefined && <div className="flex justify-between border-t border-line pt-2"><dt className="text-muted">Ganancia de esta venta</dt><dd className="tabular font-semibold text-ok">{pesos(detalle.ganancia)}</dd></div>}
            </dl>
            {!!detalle.devoluciones?.length && (
              <section aria-label="Devoluciones de esta venta">
                <h3 className="mb-2 text-sm font-semibold">Devoluciones</h3>
                <ul className="space-y-2">
                  {detalle.devoluciones.map((d) => (
                    <li key={d.id} className="rounded-xl border border-warn/40 bg-warn/8 p-3 text-sm">
                      <div className="flex items-baseline justify-between gap-2"><b>{fechaHora(d.fecha)} · {d.usuario}</b><span className="tabular font-semibold">−{pesos(d.total)}</span></div>
                      <p className="text-xs text-muted">{d.motivo} · {MEDIOS[d.medioReembolso].texto.toLowerCase()}</p>
                      <ul className="mt-1 text-xs text-muted">
                        {d.items.map((i) => <li key={i.ventaItemId} className="flex justify-between gap-2"><span className="truncate">{i.cantidad} × {i.nombre}</span><span>{i.reingresaStock ? 'volvió al inventario' : 'dañado: no reingresó'}</span></li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-xs text-muted">Los precios y el nombre de cada producto son los de ese momento: no cambian aunque luego cambie el precio.</p>
          </div>
        )}
      </PanelLateral>

      <DevolucionCliente venta={devolviendo} onCerrar={() => setDevolviendo(null)} onHecha={() => void cargar(1, true)} />

      {/* Anular: pide motivo obligatorio */}
      <Dialogo abierto={!!anulando} onCerrar={() => !enviando && setAnulando(null)} descartable={!enviando}>
        {anulando && (
          <>
            <h2 className="display text-3xl">¿Anular la venta #{String(anulando.numero).padStart(4, '0')}?</h2>
            <p className="mt-2 text-sm text-muted">Por <b className="tabular text-ink">{pesos(anulando.total)}</b>. El stock de sus productos vuelve y la venta queda marcada como anulada, con el motivo. <b className="text-ink">No se puede deshacer.</b></p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-muted">Motivo (obligatorio)</span>
              <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej. Error de digitación"
                className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-bad" />
            </label>
            <div className="mt-6 flex gap-2">
              <Button variante="secundario" className="flex-1" disabled={enviando} onClick={() => setAnulando(null)}>Cancelar</Button>
              <Button variante="peligro" className="flex-1" disabled={motivo.trim().length < 3 || enviando} onClick={() => void confirmarAnulacion()}>{enviando ? 'Anulando…' : 'Anular venta'}</Button>
            </div>
          </>
        )}
      </Dialogo>
    </div>
  )
}
