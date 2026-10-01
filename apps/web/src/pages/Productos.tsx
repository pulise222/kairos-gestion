import { useMemo, useState } from 'react'
import { LayoutGrid, Pencil, Plus, Rows3, Search, Upload, X } from 'lucide-react'
import { AnilloStock } from '../components/negocio/Graficas'
import { EtiquetaInactivo, EtiquetaStock } from '../components/negocio/Etiquetas'
import { Miniatura } from '../components/negocio/Miniatura'
import { ImportarProductos } from '../components/negocio/ImportarProductos'
import { MODO_DEMO } from '../config'
import { ProductoFormulario } from '../components/negocio/ProductoFormulario'
import { Button } from '../components/ui/Button'
import { useAviso } from '../components/ui/Avisos'
import { useSesion } from '../sesion/contexto'
import { useCatalogo } from '../data/contexto'
import { buscar, estadoDe, margen } from '../lib/busqueda'
import { pesos } from '../lib/dinero'
import type { Producto } from '../mock/catalogo'

type Vista = 'tarjetas' | 'tabla'
type Estado = 'todos' | 'bajo' | 'agotado' | 'inactivos'

const guardada = (): Vista => {
  try { return localStorage.getItem('nivel-vista-productos') === 'tabla' ? 'tabla' : 'tarjetas' } catch { return 'tarjetas' }
}

export function Productos() {
  const { productos, categorias, proveedores } = useCatalogo()
  const { esDueno } = useSesion() // el vendedor consulta precios y stock, pero no ve costos ni edita
  const avisar = useAviso()
  const [vista, setVista] = useState<Vista>(guardada)
  const [consulta, setConsulta] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [proveedor, setProveedor] = useState('todos')
  const [estado, setEstado] = useState<Estado>('todos')
  const [importando, setImportando] = useState(false)
  const [panel, setPanel] = useState<{ abierto: boolean; producto?: Producto }>({ abierto: false })

  const cambiarVista = (v: Vista) => {
    setVista(v)
    try { localStorage.setItem('nivel-vista-productos', v) } catch { /* sin almacenamiento: no se recuerda */ }
  }

  const catDe = (id: string) => categorias.find((c) => c.id === id)
  const provDe = (id: number | null) => proveedores.find((p) => p.id === id)?.nombre ?? '—'

  const conteos = useMemo(() => {
    const activos = productos.filter((p) => p.activo)
    return {
      todos: activos.length,
      bajo: activos.filter((p) => p.stock <= p.minimo).length, // incluye agotados (igual que el backend)
      agotado: activos.filter((p) => p.stock <= 0).length,
      inactivos: productos.length - activos.length,
      valorCosto: activos.reduce((s, p) => s + Math.max(p.stock, 0) * p.costo, 0),
      valorVenta: activos.reduce((s, p) => s + Math.max(p.stock, 0) * p.precio, 0),
    }
  }, [productos])

  const lista = useMemo(() => {
    const base = productos.filter((p) => {
      if (estado === 'inactivos') return !p.activo
      if (!p.activo) return false
      if (estado === 'bajo' && p.stock > p.minimo) return false
      if (estado === 'agotado' && p.stock > 0) return false
      if (categoria !== 'todas' && p.categoriaId !== categoria) return false
      if (proveedor !== 'todos' && String(p.proveedorId) !== proveedor) return false
      return true
    })
    // Con texto escrito manda la relevancia (número exacto primero); sin texto, orden alfabético.
    return consulta.trim() ? buscar(base, consulta) : [...base].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [productos, estado, categoria, proveedor, consulta])

  // Para los filtros de categoría/proveedor con el estado "inactivos" se respeta el mismo criterio.
  const hayFiltros = estado !== 'todos' || categoria !== 'todas' || proveedor !== 'todos' || !!consulta
  const limpiar = () => { setEstado('todos'); setCategoria('todas'); setProveedor('todos'); setConsulta('') }
  const abrir = (producto?: Producto) => { if (esDueno) setPanel({ abierto: true, producto }) } // el vendedor no edita fichas

  const chipEstado = (id: Estado, texto: string, n: number) => (
    <button
      key={id}
      onClick={() => setEstado(id)}
      aria-pressed={estado === id}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${estado === id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'}`}
    >
      {texto} <span className="tabular opacity-70">{n}</span>
    </button>
  )

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl md:text-5xl">Productos</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="tabular">{conteos.todos}</span> activos{esDueno && <> · inventario a costo <b className="tabular text-ink">{pesos(conteos.valorCosto)}</b>, a precio de venta <b className="tabular text-ink">{pesos(conteos.valorVenta)}</b></>}
          </p>
        </div>
        {esDueno && (
          <div className="flex gap-2">
            <Button variante="secundario" onClick={() => (MODO_DEMO ? avisar('En la demo no se pueden importar archivos. En el sistema real subes tu Excel o CSV, ves una vista previa con los errores marcados y recién ahí se guarda.', 'info') : setImportando(true))}>
              <Upload className="size-4" /> <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button onClick={() => abrir()}><Plus className="size-4" /> Nuevo producto</Button>
          </div>
        )}
      </div>

      {/* Búsqueda y vista */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="glass flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full px-5 focus-within:ring-2 focus-within:ring-accent/60 sm:min-w-72">
          <Search className="size-5 shrink-0 text-muted" />
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar por nombre, código o número…"
            aria-label="Buscar productos por nombre, código o número"
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70 focus-visible:outline-none"
          />
          {consulta && (
            <button onClick={() => setConsulta('')} className="grid size-8 place-items-center rounded-full text-muted hover:text-ink" aria-label="Limpiar búsqueda"><X className="size-4" /></button>
          )}
        </div>
        <div className="flex rounded-full border border-line bg-panel p-1" role="group" aria-label="Tipo de vista">
          {([['tarjetas', LayoutGrid, 'Ver en tarjetas'], ['tabla', Rows3, 'Ver en tabla']] as const).map(([v, Icono, nombre]) => (
            <button key={v} onClick={() => cambiarVista(v)} aria-pressed={vista === v} aria-label={nombre} title={nombre}
              className={`grid size-10 place-items-center rounded-full transition ${vista === v ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>
              <Icono className="size-5" />
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chipEstado('todos', 'Todos', conteos.todos)}
          {chipEstado('bajo', 'Stock bajo', conteos.bajo)}
          {chipEstado('agotado', 'Agotados', conteos.agotado)}
          {chipEstado('inactivos', 'Inactivos', conteos.inactivos)}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por categoría" className="h-10 rounded-full border border-line bg-panel px-4 text-sm outline-none focus:border-accent">
            <option value="todas">Todas las categorías</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={proveedor} onChange={(e) => setProveedor(e.target.value)} aria-label="Filtrar por proveedor" className="h-10 rounded-full border border-line bg-panel px-4 text-sm outline-none focus:border-accent">
            <option value="todos">Todos los proveedores</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {lista.length} {lista.length === 1 ? 'producto' : 'productos'}
        {hayFiltros && <button onClick={limpiar} className="ml-3 font-medium text-accent hover:underline">Quitar filtros</button>}
      </p>

      {lista.length === 0 ? (
        <div className="grid place-items-center rounded-[var(--radius-card)] border border-dashed border-line px-4 py-20 text-center">
          <p className="display text-3xl">{productos.length === 0 ? 'Aún no hay productos' : 'Nada coincide'}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {productos.length === 0 ? 'Crea el primero o impórtalos desde Excel.' : 'Prueba con otra parte del nombre, otro número o quita los filtros.'}
          </p>
          {(hayFiltros || esDueno) && <Button className="mt-5" onClick={() => (hayFiltros ? limpiar() : abrir())}>{hayFiltros ? 'Quitar filtros' : 'Nuevo producto'}</Button>}
        </div>
      ) : vista === 'tarjetas' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {lista.map((p) => {
            const m = margen(p.precio, p.costo)
            return (
              <button key={p.id} onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`}
                className={`group flex gap-4 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent/60 ${p.activo ? '' : 'opacity-60'}`}>
                <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={catDe(p.categoriaId)} className="size-16 rounded-xl" iconoClase="size-7" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{p.nombre}</p>
                    <Pencil className="size-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <p className="tabular text-xs text-muted">Cód. {p.codigo} · {catDe(p.categoriaId)?.nombre}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="tabular text-lg font-semibold leading-none">{pesos(p.precio)}</p>
                      {esDueno && <p className="tabular mt-1 text-xs text-muted">costo {pesos(p.costo)} · <span className={m.pesos < 0 ? 'text-bad' : 'text-ok'}>{m.porcentaje} %</span></p>}
                    </div>
                    <span className="flex items-center gap-1.5 text-sm">
                      <AnilloStock stock={p.stock} minimo={Math.max(p.minimo, 1)} tamano="size-7" />
                      <b className="tabular">{p.stock}</b>
                    </span>
                  </div>
                  <div className="mt-2">{p.activo ? <EtiquetaStock producto={p} /> : <EtiquetaInactivo />}</div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <>
          {/* Tabla (pantallas medianas en adelante) */}
          <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-panel md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-3 py-3 font-medium">Código</th>
                  {esDueno && <th className="hidden px-3 py-3 font-medium xl:table-cell">Proveedor</th>}
                  {esDueno && <th className="px-3 py-3 text-right font-medium">Costo</th>}
                  <th className="px-3 py-3 text-right font-medium">Precio</th>
                  {esDueno && <th className="px-3 py-3 text-right font-medium">Margen</th>}
                  <th className="px-3 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const m = margen(p.precio, p.costo)
                  return (
                    <tr key={p.id} onClick={() => abrir(p)} className={`cursor-pointer border-b border-line transition last:border-0 hover:bg-tile ${p.activo ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-2.5">
                        <button onClick={(e) => { e.stopPropagation(); abrir(p) }} className="flex items-center gap-3 text-left font-medium">
                          <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={catDe(p.categoriaId)} />
                          <span>{p.nombre}<span className="block text-xs font-normal text-muted">{catDe(p.categoriaId)?.nombre}</span></span>
                        </button>
                      </td>
                      <td className="tabular px-3 py-2.5 text-muted">{p.codigo}</td>
                      {esDueno && <td className="hidden px-3 py-2.5 text-muted xl:table-cell">{provDe(p.proveedorId)}</td>}
                      {esDueno && <td className="tabular px-3 py-2.5 text-right text-muted">{pesos(p.costo)}</td>}
                      <td className="tabular px-3 py-2.5 text-right font-semibold">{pesos(p.precio)}</td>
                      {esDueno && <td className={`tabular px-3 py-2.5 text-right ${m.pesos < 0 ? 'text-bad' : 'text-ok'}`}>{m.porcentaje} %</td>}
                      <td className="px-3 py-2.5">
                        <span className="flex items-center justify-end gap-2"><AnilloStock stock={p.stock} minimo={Math.max(p.minimo, 1)} tamano="size-6" /><b className="tabular w-8 text-right">{p.stock}</b></span>
                      </td>
                      <td className="px-4 py-2.5">{p.activo ? <EtiquetaStock producto={p} /> : <EtiquetaInactivo />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* En celular la tabla se convierte en filas compactas (una tabla ancha obligaría a desplazarse de lado) */}
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel md:hidden">
            {lista.map((p) => (
              <li key={p.id}>
                <button onClick={() => abrir(p)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${p.activo ? '' : 'opacity-60'}`} aria-label={`Editar ${p.nombre}`}>
                  <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={catDe(p.categoriaId)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.nombre}</span>
                    <span className="tabular block text-xs text-muted">Cód. {p.codigo} · {pesos(p.precio)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1"><b className="tabular">{p.stock}</b>{estadoDe(p) !== 'ok' && p.activo && <EtiquetaStock producto={p} />}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ImportarProductos abierto={importando} onCerrar={() => setImportando(false)} />
      <ProductoFormulario abierto={panel.abierto} producto={panel.producto} onCerrar={() => setPanel((s) => ({ ...s, abierto: false }))} />
    </div>
  )
}
