import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { CampoDinero } from '../components/ui/CampoDinero'
import { useAviso } from '../components/ui/Avisos'
import { mensajeDe } from '../api/cliente'
import { useFuenteCierre } from '../lib/fuenteCierre'
import type { Cierre, Resumen } from '../lib/fuenteCierre'
import { cuadre, efectivoEsperado, sumarDias } from '../lib/cierre'
import { pesos } from '../lib/dinero'
import { fechaHora } from '../lib/fechas'
import { nombreDia } from '../lib/panel'
import { useEnvioUnico } from '../lib/envio'

/*
  CIERRE DEL DÍA: lo que antes era la palabra al final del cuaderno («ya validé que la plata cuadra»).
  Se ve cuánto se vendió (por sección y por forma de pago), se cuenta el efectivo de la caja y el sistema dice si cuadra.
*/
export function CierrePagina() {
  const avisar = useAviso()
  const fuente = useFuenteCierre()
  const { enviando, ejecutar } = useEnvioUnico()
  const [fecha, setFecha] = useState<string | null>(null) // null = hoy (lo decide el servidor, en hora de Colombia)
  const [r, setR] = useState<Resumen | null>(null)
  const [historial, setHistorial] = useState<Cierre[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fondo, setFondo] = useState(0)
  const [contado, setContado] = useState(0)
  const [nota, setNota] = useState('')

  const cargarHistorial = useCallback(async () => {
    try { setHistorial(await fuente.historial()) } catch { /* el historial es un extra: si falla, no estorba */ }
  }, [fuente])

  // Al cambiar de día se vuelve a pedir el resumen y se preparan los campos con lo que ya estuviera guardado.
  useEffect(() => {
    let vigente = true
    setError(null)
    fuente.resumen(fecha)
      .then((x) => {
        if (!vigente) return
        setR(x)
        setFondo(x.cierre?.fondoInicial ?? 0)
        setContado(x.cierre?.efectivoContado ?? 0)
        setNota(x.cierre?.nota ?? '')
      })
      .catch((e) => vigente && setError(mensajeDe(e)))
    return () => { vigente = false }
  }, [fecha, fuente])
  useEffect(() => { void cargarHistorial() }, [cargarHistorial])
  // La base inicial del día suele ser la misma de ayer: si no hay cierre guardado, se sugiere la del último.
  useEffect(() => {
    if (r && !r.cierre && fondo === 0 && historial[0]) setFondo(historial[0].fondoInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.fecha, historial.length])

  const guardar = () => ejecutar(async () => {
    if (!r) return
    try {
      const x = await fuente.guardar({ fecha: r.fecha, fondoInicial: fondo, efectivoContado: contado, ...(nota.trim() ? { nota: nota.trim() } : {}) })
      setR(x)
      void cargarHistorial()
      avisar(x.cierre && x.cierre.diferencia === 0 ? 'Cierre guardado: ¡la caja cuadra!' : 'Cierre guardado.', 'ok')
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    }
  })

  if (error) return <p className="rounded-2xl border border-bad/40 bg-bad/10 p-5 text-bad" role="alert">{error}</p>
  if (!r) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="size-8 animate-spin" aria-label="Cargando" /></div>

  const esHoy = r.fecha === r.hoy
  const esperado = efectivoEsperado(fondo, r.efectivoNeto)
  const c = cuadre(esperado, contado, pesos)
  const tono = c.estado === 'cuadra' ? 'border-ok/50 bg-ok/10 text-ok' : c.estado === 'falta' ? 'border-bad/50 bg-bad/10 text-bad' : 'border-warn/50 bg-warn/10 text-warn'
  const mayor = Math.max(1, ...r.porSeccion.map((s) => s.ventas))

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="display text-4xl md:text-5xl">Cierre del día</h1>
        <p className="mt-1 text-sm text-muted">Cuenta el dinero de la caja y comprueba que cuadra con lo vendido.</p>
      </div>

      {/* Día */}
      <div className="glass flex items-center justify-between gap-3 rounded-full p-1.5">
        <button onClick={() => setFecha(sumarDias(r.fecha, -1))} className="grid size-11 place-items-center rounded-full hover:bg-tile" aria-label="Día anterior"><ChevronLeft className="size-5" /></button>
        <p className="text-center text-base font-semibold capitalize">{esHoy ? 'Hoy · ' : ''}{nombreDia(r.fecha)}</p>
        <button onClick={() => setFecha(sumarDias(r.fecha, 1))} disabled={esHoy} className="grid size-11 place-items-center rounded-full hover:bg-tile disabled:opacity-30" aria-label="Día siguiente"><ChevronRight className="size-5" /></button>
      </div>

      {r.cierre && (
        <p className="flex items-center gap-2 rounded-xl bg-tile px-4 py-3 text-sm" role="status">
          <CalendarCheck className="size-5 shrink-0 text-accent" /> Este día ya está cerrado ({fechaHora(new Date(r.cierre.actualizadoEn))}). Si te equivocaste, corrige y vuelve a guardar.
        </p>
      )}

      {/* Lo vendido */}
      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
          <p className="text-sm text-muted">Vendido {esHoy ? 'hoy' : 'este día'}</p>
          <p className="display tabular mt-1 text-5xl">{pesos(r.ventasNetas)}</p>
          <p className="mt-1 text-sm text-muted">{r.tickets} {r.tickets === 1 ? 'venta' : 'ventas'}{r.devuelto.total > 0 && <> · incluye −{pesos(r.devuelto.total)} en devoluciones</>}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {([['Efectivo', r.porMedio.EFECTIVO], ['Transferencia', r.porMedio.TRANSFERENCIA], ['Tarjeta', r.porMedio.TARJETA]] as const).map(([n, v]) => (
              <div key={n} className="rounded-xl bg-tile px-2 py-3"><dt className="text-xs text-muted">{n}</dt><dd className="tabular mt-0.5 text-lg font-semibold">{pesos(v)}</dd></div>
            ))}
          </dl>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Por sección</h2>
          {r.porSeccion.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay ventas este día.</p> : (
            <ul className="mt-3 space-y-3">
              {r.porSeccion.map((s) => (
                <li key={s.id}>
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} /><span className="truncate">{s.nombre}</span></span><span className="tabular font-semibold">{pesos(s.ventas)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-tile"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (s.ventas / mayor) * 100)}%`, background: s.color }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* El cuadre */}
      <section className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Cuadre de la caja</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CampoDinero etiqueta="1. ¿Con cuánto dinero abrieron la caja? (la base)" valor={fondo} onCambiar={setFondo} ayuda="El dinero para dar vueltas con el que empezó el día. Si no dejaron base, déjalo en 0." />
          <CampoDinero etiqueta="2. ¿Cuánto efectivo hay AHORA en la caja?" valor={contado} onCambiar={setContado} ayuda="Cuenta los billetes y monedas. No cuentes transferencias ni tarjeta." />
        </div>

        <dl className="mt-5 grid gap-2 rounded-2xl bg-tile p-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Base</dt><dd className="tabular text-lg font-semibold">{pesos(fondo)}</dd></div>
          <div><dt className="text-muted">+ Ventas en efectivo{r.devuelto.EFECTIVO > 0 ? ' (sin devoluciones)' : ''}</dt><dd className="tabular text-lg font-semibold">{pesos(r.efectivoNeto)}</dd></div>
          <div><dt className="text-muted">= Debería haber</dt><dd className="tabular text-lg font-semibold">{pesos(esperado)}</dd></div>
        </dl>

        <div className={`mt-4 flex items-center gap-3 rounded-2xl border px-5 py-4 ${tono}`} role="status" aria-live="polite">
          {c.estado === 'cuadra' ? <CheckCircle2 className="size-8 shrink-0" /> : <CircleAlert className="size-8 shrink-0" />}
          <div>
            <p className="display text-3xl leading-tight">{contado === 0 && esperado > 0 ? 'Escribe lo que contaste' : c.texto}</p>
            {c.estado !== 'cuadra' && contado > 0 && <p className="text-sm opacity-90">Revisa si falta anotar una venta, si hubo un gasto o si se dio mal una vuelta.</p>}
          </div>
        </div>

        <label htmlFor="nota-cierre" className="mb-1.5 mt-5 block text-sm font-medium text-muted">Nota (opcional)</label>
        <textarea id="nota-cierre" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Se pagó el almuerzo de la caja"
          className="w-full resize-y rounded-xl border border-line bg-bg/70 px-4 py-3 text-base outline-none focus:border-accent" />

        <Button grande className="mt-5 w-full sm:w-auto" onClick={guardar} disabled={enviando}>
          <CalendarCheck className="size-5" /> {enviando ? 'Guardando…' : r.cierre ? 'Guardar de nuevo el cierre' : 'Guardar cierre del día'}
        </Button>
      </section>

      {/* Historial */}
      {historial.length > 0 && (
        <section className="rounded-[var(--radius-card)] border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Últimos cierres</h2>
          <ul className="mt-2 divide-y divide-line">
            {historial.map((h) => (
              <li key={h.fecha}>
                <button onClick={() => setFecha(h.fecha)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-tile/60">
                  <span className="min-w-0 flex-1 text-sm capitalize">{nombreDia(h.fecha)}</span>
                  <span className="tabular text-sm text-muted">{pesos(h.totalVentas)}</span>
                  <span className={`w-28 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${h.diferencia === 0 ? 'bg-ok/12 text-ok' : h.diferencia < 0 ? 'bg-bad/12 text-bad' : 'bg-warn/15 text-warn'}`}>
                    {h.diferencia === 0 ? 'Cuadró' : h.diferencia < 0 ? `Faltó ${pesos(-h.diferencia)}` : `Sobró ${pesos(h.diferencia)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
