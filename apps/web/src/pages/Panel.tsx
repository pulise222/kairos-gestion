import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAjustes } from '../ajustes/contexto'
import { CifraAnimada } from '../components/negocio/CifraAnimada'
import { FiltroPeriodo } from '../components/negocio/FiltroPeriodo'
import { AnilloStock, Medidor, Sparkline } from '../components/negocio/Graficas'
import { Button } from '../components/ui/Button'
import { useSesion } from '../sesion/contexto'
import { usePanel } from '../panel/usePanel'
import { pesos, pesosCorto } from '../lib/dinero'
import { incluyeDia, mejoresDias, metaDelPeriodo, nombreDia, serie, textoComparacion, variacion } from '../lib/panel'
import { PERIODOS, aTexto, deTexto, diasEnRango, granularidadPara, rangoAnterior, rangoDe, validarPersonalizado } from '../lib/periodos'
import type { PeriodoId, Rango } from '../lib/periodos'

/** Flecha de variación contra el período anterior. Si no hay con qué comparar, lo dice en vez de inventar un 0 %. */
function Variacion({ valor, texto, claro }: { valor: number | null; texto: string; claro?: boolean }) {
  if (valor === null) return <span className={`text-xs ${claro ? 'opacity-80' : 'text-muted'}`}>Sin datos {texto}</span>
  const Icono = valor === 0 ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${claro ? 'opacity-90' : valor === 0 ? 'text-muted' : valor > 0 ? 'text-ok' : 'text-bad'}`}>
      <Icono className="size-3.5" /> {Math.abs(valor)} % {texto}
    </span>
  )
}

function Tarjeta({ titulo, nota, children, className = '' }: { titulo?: string; nota?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-[var(--radius-card)] border border-line bg-panel p-5 ${className}`}>
      {titulo && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {nota && <span className="text-xs text-muted">{nota}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

const periodoValido = (v: string | null): v is PeriodoId => PERIODOS.some((p) => p.id === v)
const formatoEje = (clave: string, g: 'dia' | 'semana' | 'mes') => {
  const d = deTexto(clave)
  return g === 'mes' ? new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(d) : `${d.getDate()}/${d.getMonth() + 1}`
}

export function Panel() {
  const navegar = useNavigate()
  const { ajustes } = useAjustes()
  const { usuario } = useSesion()
  const [params, setParams] = useSearchParams()
  const [hoy] = useState(() => new Date())
  const hoyTexto = aTexto(hoy)
  const [metrica, setMetrica] = useState<'ventas' | 'ganancia'>('ventas')

  // El período vive en la dirección (?periodo=7d): sobrevive a recargar y se puede compartir o guardar.
  const pedido = params.get('periodo')
  const periodo: PeriodoId = periodoValido(pedido) ? pedido : 'hoy'
  const personalizado: Rango | undefined = periodo === 'personalizado' ? { desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '' } : undefined
  const errorPersonalizado = personalizado ? validarPersonalizado(personalizado, hoy) : null
  // Si la dirección trae un rango inválido, se muestra el aviso y se usa "hoy" para no mostrar datos engañosos.
  const rango = periodo === 'personalizado' && !errorPersonalizado ? personalizado! : rangoDe(periodo === 'personalizado' ? 'hoy' : periodo, hoy)
  const anterior = rangoAnterior(periodo, rango)

  const cambiarPeriodo = (id: PeriodoId, p?: Rango) => {
    const sp = new URLSearchParams()
    if (id !== 'hoy') sp.set('periodo', id)
    if (id === 'personalizado' && p) { sp.set('desde', p.desde); sp.set('hasta', p.hasta) }
    setParams(sp, { replace: true })
  }

  // Los datos vienen del servidor (modo real) o se calculan con los de ejemplo (demo): el Panel no distingue.
  const d = usePanel(rango, anterior)
  const act = d.actual
  const ant = d.anterior
  const comp = textoComparacion(periodo)
  const g = granularidadPara(diasEnRango(rango))
  const puntos = useMemo(() => serie(d.dias, rango, g), [d.dias, rango, g])
  const topProductos = d.masVendidos
  const porCategoria = d.porCategoria
  const stockBajo = useMemo(() => d.stockBajo.slice(0, 4), [d.stockBajo])
  const mostrarUltimas = incluyeDia(rango, hoyTexto)
  const mejores = useMemo(() => mejoresDias(d.dias, rango, 4), [d.dias, rango])
  const meta = metaDelPeriodo(ajustes.metaDiaria, rango)
  const maxUnidades = topProductos[0]?.unidades || 1
  const totalCategorias = porCategoria.reduce((s, c) => s + c.ventas, 0) || 1
  const nombreTotal = periodo === 'hoy' ? 'Ventas de hoy' : periodo === 'ayer' ? 'Ventas de ayer' : 'Ventas del período'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="display text-4xl md:text-5xl">Hola, {usuario?.nombre.split(' ')[0] ?? ''}</h1>
        <p className="mt-1 text-sm text-muted">Así va {ajustes.nombreNegocio}</p>
      </div>

      <FiltroPeriodo periodo={periodo} rango={rango} personalizado={personalizado} hoy={hoy} onCambiar={cambiarPeriodo}
        errorExterno={periodo === 'personalizado' && !params.get('desde') ? undefined : errorPersonalizado ?? undefined} />

      {/* Fila de cifras. La de ganancia es la tarjeta de color destacada. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta>
          <p className="text-sm text-muted">{nombreTotal}</p>
          <p className="display mt-1 text-4xl"><CifraAnimada valor={act.ventas} /></p>
          <Variacion valor={variacion(act.ventas, ant.ventas)} texto={comp} />
          {!!act.devuelto && <p className="tabular mt-1 text-xs text-warn">Incluye −{pesos(act.devuelto)} en devoluciones</p>}
        </Tarjeta>

        <section className="min-w-0 rounded-[var(--radius-card)] bg-gradient-to-br from-accent to-[color-mix(in_srgb,var(--accent)_58%,#000)] p-5 text-on-accent">
          <p className="text-sm opacity-80">Ganancia</p>
          <p className="display mt-1 text-4xl"><CifraAnimada valor={act.ganancia} /></p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <Variacion valor={variacion(act.ganancia, ant.ganancia)} texto={comp} claro />
            {puntos.length > 1 && <Sparkline datos={puntos.map((p) => p.ganancia)} className="h-8 w-24 shrink-0" />}
          </div>
        </section>

        <Tarjeta>
          <p className="text-sm text-muted">Ventas registradas</p>
          <p className="display mt-1 text-4xl"><CifraAnimada valor={act.tickets} formato={(n) => String(n)} /></p>
          <Variacion valor={variacion(act.tickets, ant.tickets)} texto={comp} />
        </Tarjeta>

        <Tarjeta>
          <p className="text-sm text-muted">Ticket promedio</p>
          <p className="display mt-1 text-4xl"><CifraAnimada valor={act.ticketPromedio} /></p>
          <Variacion valor={variacion(act.ticketPromedio, ant.ticketPromedio)} texto={comp} />
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo={`${metrica === 'ventas' ? 'Ventas' : 'Ganancia'} por ${g === 'dia' ? 'día' : g === 'semana' ? 'semana' : 'mes'}`} className="lg:col-span-2">
          <div className="-mt-1 mb-2 flex gap-1 rounded-full bg-tile p-1 w-fit" role="group" aria-label="Qué mostrar en la gráfica">
            {(['ventas', 'ganancia'] as const).map((m) => (
              <button key={m} onClick={() => setMetrica(m)} aria-pressed={metrica === m} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${metrica === m ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink'}`}>{m}</button>
            ))}
          </div>
          <div className="h-56">
            {puntos.length < 2 ? (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                <div>
                  <p className="display tabular text-4xl text-ink">{pesos(metrica === 'ventas' ? act.ventas : act.ganancia)}</p>
                  <p className="mt-1">Elige un período más largo para ver la evolución.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={puntos} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="relleno" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="clave" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(c: string) => formatoEje(c, g)} minTickGap={24} />
                  <Tooltip
                    cursor={{ stroke: 'var(--line)' }}
                    formatter={(v) => [pesos(Number(v)), metrica === 'ventas' ? 'Ventas' : 'Ganancia']}
                    labelFormatter={(c) => (g === 'dia' ? nombreDia(String(c)) : g === 'semana' ? `Semana del ${formatoEje(String(c), g)}` : formatoEje(String(c), g))}
                    contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)' }}
                  />
                  <Area type="monotone" dataKey={metrica} stroke="var(--accent)" strokeWidth={2.5} fill="url(#relleno)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Meta" nota={diasEnRango(rango) > 1 ? `${diasEnRango(rango)} días` : undefined}>
          {meta > 0 ? (
            <>
              <Medidor porcentaje={Math.round((act.ventas / meta) * 100)} />
              <p className="mt-1 text-center text-sm text-muted"><span className="tabular">{pesosCorto(act.ventas)}</span> de <span className="tabular">{pesosCorto(meta)}</span></p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted">Define una meta diaria en Configuración → Negocio para ver tu avance.</p>
          )}
        </Tarjeta>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Más vendidos" nota="unidades">
          <ul className="space-y-3">
            {topProductos.map((p) => (
              <li key={p.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{p.nombre}</span><span className="tabular text-muted">{p.unidades}</span></div>
                <div className="h-1.5 rounded-full bg-tile"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(p.unidades / maxUnidades) * 100}%` }} /></div>
              </li>
            ))}
            {topProductos.length === 0 && <li className="text-sm text-muted">Sin ventas en este período.</li>}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Ventas por categoría">
          <ul className="space-y-3">
            {porCategoria.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span className="flex items-center gap-2 truncate"><span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />{c.nombre}</span><span className="tabular text-muted">{Math.round((c.ventas / totalCategorias) * 100)} %</span></div>
                <div className="h-1.5 rounded-full bg-tile"><div className="h-full rounded-full transition-all" style={{ width: `${(c.ventas / totalCategorias) * 100}%`, background: c.color }} /></div>
              </li>
            ))}
            {porCategoria.length === 0 && <li className="text-sm text-muted">Sin ventas en este período.</li>}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Stock bajo" nota="estado actual">
          <ul>
            {stockBajo.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <AnilloStock stock={p.stock} minimo={Math.max(p.minimo, 1)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="truncate text-xs text-muted">{p.proveedor ?? 'Sin proveedor'}</p>
                </div>
                <span className="tabular text-sm text-muted">{p.stock} und</span>
              </li>
            ))}
            {stockBajo.length === 0 && <li className="py-3 text-sm text-muted">Todo el stock está en orden.</li>}
          </ul>
          <Button variante="secundario" className="mt-3 w-full" onClick={() => navegar('/inventario?entrada=1')}>Registrar entrada</Button>
        </Tarjeta>

        {mostrarUltimas ? (
          <Tarjeta titulo="Últimas ventas">
            <ul>
              {d.ultimasVentas.map((v) => (
                <li key={v.numero} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Venta #{String(v.numero).padStart(4, '0')}</p>
                    <p className="truncate text-xs text-muted">{v.hora} · {v.items} productos · {v.vendedor}</p>
                  </div>
                  <span className="tabular text-sm font-semibold text-ok">{pesos(v.total)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ) : (
          <Tarjeta titulo="Mejores días" nota="del período">
            <ul>
              {mejores.map((d, i) => (
                <li key={d.fecha} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                    <p className="truncate text-sm capitalize">{nombreDia(d.fecha)}</p>
                  </div>
                  <span className="tabular text-sm font-semibold">{pesos(d.ventas)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
