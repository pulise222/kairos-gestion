import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ClipboardList, PackagePlus, Search, SlidersHorizontal, X } from 'lucide-react'
import { AnilloStock } from '../components/negocio/Graficas'
import { AjusteStock } from '../components/negocio/AjusteStock'
import { ConteoFisico } from '../components/negocio/ConteoFisico'
import { EntradaMercancia } from '../components/negocio/EntradaMercancia'
import { EtiquetaStock } from '../components/negocio/Etiquetas'
import { Miniatura } from '../components/negocio/Miniatura'
import { Button } from '../components/ui/Button'
import { useSesion } from '../sesion/contexto'
import { useCatalogo } from '../data/contexto'
import type { Movimiento } from '../data/contexto'
import { buscar, llevaInventario } from '../lib/busqueda'
import { pesos } from '../lib/dinero'
import { fechaHora } from '../lib/fechas'
import { porUrgencia } from '../lib/inventario'
import type { Producto } from '../mock/catalogo'

type Pestana = 'estado' | 'movimientos' | 'compras'
type Filtro = 'todos' | 'bajo' | 'agotado'
type TipoMov = 'todos' | Movimiento['tipo']

const etiquetaTipo: Record<Movimiento['tipo'], { texto: string; clase: string }> = {
  ENTRADA: { texto: 'Entrada', clase: 'bg-ok/12 text-ok' },
  VENTA: { texto: 'Venta', clase: 'bg-accent/12 text-accent' },
  AJUSTE: { texto: 'Ajuste', clase: 'bg-warn/15 text-warn' },
  ANULACION: { texto: 'Anulación', clase: 'bg-bad/12 text-bad' },
  DEVOLUCION_CLIENTE: { texto: 'Devolución', clase: 'bg-ok/12 text-ok' },
  DEVOLUCION_PROVEEDOR: { texto: 'A proveedor', clase: 'bg-warn/15 text-warn' },
}

export function Inventario() {
  const { productos: todosLosProductos, categorias, proveedores, movimientos, compras } = useCatalogo()
  // Solo se muestran los productos CON control de inventario (los demás no tienen stock que contar, pedir o devolver).
  const productos = useMemo(() => todosLosProductos.filter(llevaInventario), [todosLosProductos])
  const { esDueno } = useSesion() // el vendedor solo consulta el estado del stock
  const [params, setParams] = useSearchParams()
  const [pestana, setPestana] = useState<Pestana>('estado')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [categoria, setCategoria] = useState('todas')
  const [consulta, setConsulta] = useState('')
  const [tipoMov, setTipoMov] = useState<TipoMov>('todos')
  const [contando, setContando] = useState(false)
  const [consultaMov, setConsultaMov] = useState('')
  const [verMas, setVerMas] = useState(40)
  const [entrada, setEntrada] = useState<{ abierto: boolean; proveedorId?: number; productoId?: number }>({ abierto: false })
  const [ajuste, setAjuste] = useState<Producto | null>(null)

  // Desde el Panel se llega con ?entrada=1 para abrir directamente el registro de mercancía.
  useEffect(() => {
    if (params.get('entrada')) {
      setEntrada({ abierto: true })
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const conteo = useMemo(() => ({
    total: activos.length,
    bajo: activos.filter((p) => p.stock > 0 && p.stock <= p.minimo).length,
    agotado: activos.filter((p) => p.stock <= 0).length,
  }), [activos])

  const catDe = (id: string) => categorias.find((c) => c.id === id)
  const provDe = (id: number | null) => proveedores.find((p) => p.id === id)?.nombre
  const productoDe = (id: number) => productos.find((p) => p.id === id)

  const lista = useMemo(() => {
    const base = activos.filter((p) => {
      if (filtro === 'bajo' && !(p.stock > 0 && p.stock <= p.minimo)) return false
      if (filtro === 'agotado' && p.stock > 0) return false
      if (categoria !== 'todas' && p.categoriaId !== categoria) return false
      return true
    })
    return consulta.trim() ? buscar(base, consulta) : [...base].sort(porUrgencia) // lo más urgente primero
  }, [activos, filtro, categoria, consulta])

  const movs = useMemo(() => {
    const ids = consultaMov.trim() ? new Set(buscar(productos, consultaMov).map((p) => p.id)) : null
    return movimientos
      .filter((m) => (tipoMov === 'todos' || m.tipo === tipoMov) && (!ids || ids.has(m.productoId)))
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id)
  }, [movimientos, productos, tipoMov, consultaMov])

  const tarjeta = (f: Filtro, titulo: string, n: number, color: string) => (
    <button
      onClick={() => { setFiltro(f); setPestana('estado') }}
      aria-pressed={pestana === 'estado' && filtro === f}
      className={`rounded-[var(--radius-card)] border bg-panel p-4 text-left transition hover:border-accent/60 ${pestana === 'estado' && filtro === f ? 'border-accent ring-1 ring-accent/40' : 'border-line'}`}
    >
      <span className="text-sm text-muted">{titulo}</span>
      <span className={`display tabular mt-1 block text-4xl ${color}`}>{n}</span>
    </button>
  )

  const pestanaBoton = (id: Pestana, texto: string) => (
    <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
      className={`rounded-full px-5 py-2 text-sm font-medium transition ${pestana === id ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>
      {texto}
    </button>
  )

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl md:text-5xl">Inventario</h1>
          <p className="mt-1 text-sm text-muted">Cuánto hay, qué falta y por qué cambió cada cifra.</p>
        </div>
        {esDueno && (
          <div className="flex flex-wrap gap-2">
            <Button variante="secundario" onClick={() => setContando(true)}><ClipboardList className="size-4" /> Conteo físico</Button>
            <Button onClick={() => setEntrada({ abierto: true })}><PackagePlus className="size-4" /> Entrada de mercancía</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {tarjeta('todos', 'Productos', conteo.total, '')}
        {tarjeta('bajo', 'Stock bajo', conteo.bajo, conteo.bajo ? 'text-warn' : '')}
        {tarjeta('agotado', 'Agotados', conteo.agotado, conteo.agotado ? 'text-bad' : '')}
      </div>

      <div className="flex w-fit gap-1 rounded-full border border-line bg-panel p-1" role="tablist" aria-label="Secciones del inventario">
        {pestanaBoton('estado', 'Estado del stock')}
        {esDueno && pestanaBoton('movimientos', 'Movimientos')}
        {esDueno && pestanaBoton('compras', 'Compras')}
      </div>

      {/* ───────── Estado del stock ───────── */}
      {pestana === 'estado' && (
        <section className="space-y-4" aria-label="Estado del stock">
          <div className="flex flex-wrap items-center gap-3">
            <div className="glass flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-5 focus-within:ring-2 focus-within:ring-accent/60 sm:min-w-64">
              <Search className="size-5 shrink-0 text-muted" />
              <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar por nombre o número…" aria-label="Buscar en el inventario"
                className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70 focus-visible:outline-none" />
              {consulta && <button onClick={() => setConsulta('')} className="grid size-8 place-items-center rounded-full text-muted hover:text-ink" aria-label="Limpiar búsqueda"><X className="size-4" /></button>}
            </div>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por categoría" className="h-12 rounded-full border border-line bg-panel px-4 text-sm outline-none focus:border-accent">
              <option value="todas">Todas las categorías</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {([['todos', 'Todo'], ['bajo', 'Stock bajo'], ['agotado', 'Agotados']] as const).map(([id, texto]) => (
              <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${filtro === id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'}`}>{texto}</button>
            ))}
          </div>

          {lista.length === 0 ? (
            <div className="grid place-items-center rounded-[var(--radius-card)] border border-dashed border-line px-4 py-16 text-center">
              <p className="display text-3xl">{filtro === 'todos' && !consulta ? 'Sin productos' : '¡Todo en orden!'}</p>
              <p className="mt-1 text-sm text-muted">{filtro === 'todos' && !consulta ? 'Crea productos en la sección Productos.' : 'No hay productos con ese filtro.'}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {lista.map((p) => {
                const tope = Math.max(p.minimo * 3, p.stock, 1)
                return (
                  <li key={p.id} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4">
                    <div className="relative shrink-0">
                      <AnilloStock stock={p.stock} minimo={Math.max(p.minimo, 1)} tamano="size-14" />
                      <span className="tabular absolute inset-0 grid place-items-center text-sm font-bold">{p.stock}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={catDe(p.categoriaId)} className="size-6 rounded-md" iconoClase="size-3.5" />
                        <p className="truncate font-medium">{p.nombre}</p>
                      </div>
                      <p className="tabular truncate text-xs text-muted">N.º {p.codigo} · {provDe(p.proveedorId) ?? 'Sin proveedor'}</p>
                      {/* Barra: cuánto hay frente al mínimo (la marca indica el mínimo) */}
                      <div className="relative mt-2 h-1.5 rounded-full bg-tile" role="img" aria-label={`${p.stock} de mínimo ${p.minimo}`}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Math.max(p.stock, 0) / tope) * 100)}%`, background: `var(--${p.stock <= 0 ? 'bad' : p.stock <= p.minimo ? 'warn' : 'ok'})` }} />
                        <span className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink/50" style={{ left: `${(p.minimo / tope) * 100}%` }} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <EtiquetaStock producto={p} />
                        <span className="tabular text-xs text-muted">mínimo {p.minimo}</span>
                      </div>
                    </div>
                    {esDueno && <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => setEntrada({ abierto: true, proveedorId: p.proveedorId ?? undefined, productoId: p.id })} className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:brightness-110" aria-label={`Registrar entrada de ${p.nombre}`}>
                        <ArrowDownToLine className="size-3.5" /> Entrada
                      </button>
                      <button onClick={() => setAjuste(p)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-accent hover:text-ink" aria-label={`Ajustar stock de ${p.nombre}`}>
                        <SlidersHorizontal className="size-3.5" /> Ajustar
                      </button>
                    </div>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* ───────── Movimientos ───────── */}
      {pestana === 'movimientos' && (
        <section className="space-y-4" aria-label="Movimientos de stock">
          <div className="flex flex-wrap items-center gap-3">
            <div className="glass flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-5 focus-within:ring-2 focus-within:ring-accent/60 sm:min-w-64">
              <Search className="size-5 shrink-0 text-muted" />
              <input value={consultaMov} onChange={(e) => { setConsultaMov(e.target.value); setVerMas(40) }} placeholder="Filtrar por producto…" aria-label="Filtrar movimientos por producto"
                className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70 focus-visible:outline-none" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {([['todos', 'Todos'], ['ENTRADA', 'Entradas'], ['VENTA', 'Ventas'], ['AJUSTE', 'Ajustes'], ['ANULACION', 'Anulaciones'], ['DEVOLUCION_CLIENTE', 'Devol. de clientes'], ['DEVOLUCION_PROVEEDOR', 'Devol. a proveedores']] as const).map(([id, texto]) => (
                <button key={id} onClick={() => { setTipoMov(id); setVerMas(40) }} aria-pressed={tipoMov === id}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${tipoMov === id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'}`}>{texto}</button>
              ))}
            </div>
          </div>

          {movs.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-12 text-center text-sm text-muted">No hay movimientos con ese filtro.</p>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
              <ul className="divide-y divide-line">
                {movs.slice(0, verMas).map((m) => {
                  const p = productoDe(m.productoId)
                  const e = etiquetaTipo[m.tipo]
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-20 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${e.clase}`}>{e.texto}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p?.nombre ?? 'Producto eliminado'}</p>
                        <p className="truncate text-xs text-muted">{m.motivo ?? '—'} · {m.usuario} · {fechaHora(m.fecha)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`tabular text-sm font-semibold ${m.cantidad < 0 ? 'text-bad' : 'text-ok'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</p>
                        <p className="tabular text-xs text-muted">quedó en {m.stockResultante}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {movs.length > verMas && <button onClick={() => setVerMas((n) => n + 40)} className="w-full border-t border-line py-3 text-sm font-medium text-accent hover:bg-tile">Ver más ({movs.length - verMas} restantes)</button>}
            </div>
          )}
        </section>
      )}

      {/* ───────── Compras ───────── */}
      {pestana === 'compras' && (
        <section className="space-y-3" aria-label="Compras a proveedores">
          {compras.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-line px-4 py-12 text-center text-sm text-muted">Aún no hay compras registradas.</p>
          ) : compras.map((c) => (
            <article key={c.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Compra #{c.id} · {provDe(c.proveedorId)}</h2>
                  <p className="text-xs text-muted">{fechaHora(c.fecha)}{c.notas ? ` · ${c.notas}` : ''}</p>
                </div>
                <span className="display tabular text-2xl">{pesos(c.total)}</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {c.items.map((i) => (
                  <li key={i.productoId} className="flex justify-between gap-3 text-muted">
                    <span className="truncate">{productoDe(i.productoId)?.nombre}</span>
                    <span className="tabular shrink-0">{i.cantidad} × {pesos(i.costoUnitario)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      )}

      <EntradaMercancia abierto={entrada.abierto} inicial={{ proveedorId: entrada.proveedorId, productoId: entrada.productoId }} onCerrar={() => setEntrada((s) => ({ ...s, abierto: false }))} />
      <AjusteStock producto={ajuste} onCerrar={() => setAjuste(null)} />
      <ConteoFisico abierto={contando} onCerrar={() => setContando(false)} />
    </div>
  )
}
