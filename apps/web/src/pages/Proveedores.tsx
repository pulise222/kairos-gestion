import { useMemo, useState } from 'react'
import { Plus, Search, Truck, X } from 'lucide-react'
import { DevolucionProveedor } from '../components/negocio/DevolucionProveedor'
import { EntradaMercancia } from '../components/negocio/EntradaMercancia'
import { ProveedorDetalle } from '../components/negocio/ProveedorDetalle'
import { ProveedorFormulario } from '../components/negocio/ProveedorFormulario'
import { Button } from '../components/ui/Button'
import { Dialogo } from '../components/ui/Dialogo'
import { useAviso } from '../components/ui/Avisos'
import { mensajeDe } from '../api/cliente'
import { useCatalogo } from '../data/contexto'
import { pesos } from '../lib/dinero'
import { fecha } from '../lib/fechas'
import { resumenProveedor } from '../lib/proveedores'
import { iniciales } from '../lib/usuarios'
import { normalizar } from '../lib/busqueda'
import type { Proveedor } from '../mock/catalogo'

type Filtro = 'activos' | 'pedir' | 'inactivos'

export function Proveedores() {
  const { proveedores, productos, compras, editarProveedor } = useCatalogo()
  const avisar = useAviso()
  const [consulta, setConsulta] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [detalle, setDetalle] = useState<number | null>(null)
  const [form, setForm] = useState<{ abierto: boolean; proveedor?: Proveedor }>({ abierto: false })
  const [entrada, setEntrada] = useState<{ abierto: boolean; proveedorId?: number }>({ abierto: false })
  const [aDesactivar, setADesactivar] = useState<Proveedor | null>(null)
  const [devolviendo, setDevolviendo] = useState<Proveedor | null>(null)
  const [versionDevoluciones, setVersionDevoluciones] = useState(0)
  const ahora = useMemo(() => new Date(), [])

  // Resumen de cada proveedor, calculado una vez por cambio de datos.
  const filas = useMemo(
    () => proveedores.map((p) => ({ p, r: resumenProveedor(p, productos, compras, ahora) })),
    [proveedores, productos, compras, ahora],
  )

  const cuenta = {
    activos: filas.filter((f) => f.p.activo).length,
    pedir: filas.filter((f) => f.p.activo && f.r.bajos.length > 0).length,
    inactivos: filas.filter((f) => !f.p.activo).length,
  }

  const lista = useMemo(() => {
    const q = normalizar(consulta)
    return filas
      .filter(({ p, r }) => {
        if (filtro === 'inactivos') return !p.activo
        if (!p.activo) return false
        if (filtro === 'pedir' && r.bajos.length === 0) return false
        return true
      })
      .filter(({ p }) => !q || normalizar(p.nombre).includes(q) || p.telefono.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000'))
      .sort((a, b) => b.r.bajos.length - a.r.bajos.length || a.p.nombre.localeCompare(b.p.nombre, 'es')) // los que hay que pedir, primero
  }, [filas, filtro, consulta])

  const seleccionado = proveedores.find((p) => p.id === detalle) ?? null

  const cambiarEstado = async (p: Proveedor) => {
    if (p.activo) return setADesactivar(p) // pide confirmación
    try {
      await editarProveedor(p.id, { activo: true })
      avisar(`«${p.nombre}» vuelve a estar activo.`, 'ok')
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    }
  }
  const desactivar = async (p: Proveedor) => {
    try {
      await editarProveedor(p.id, { activo: false })
      avisar(`«${p.nombre}» desactivado.`, 'ok')
      setADesactivar(null)
      setDetalle(null)
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    }
  }

  const chip = (id: Filtro, texto: string, n: number) => (
    <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${filtro === id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'}`}>
      {texto} <span className="tabular opacity-70">{n}</span>
    </button>
  )

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl md:text-5xl">Proveedores</h1>
          <p className="mt-1 text-sm text-muted">A quién le compras y qué toca pedirle.</p>
        </div>
        <Button onClick={() => setForm({ abierto: true })}><Plus className="size-4" /> Nuevo proveedor</Button>
      </div>

      <div className="glass flex h-12 items-center gap-3 rounded-full px-5 focus-within:ring-2 focus-within:ring-accent/60">
        <Search className="size-5 shrink-0 text-muted" />
        <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar por nombre o teléfono…" aria-label="Buscar proveedores"
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted/70 focus-visible:outline-none" />
        {consulta && <button onClick={() => setConsulta('')} className="grid size-8 place-items-center rounded-full text-muted hover:text-ink" aria-label="Limpiar búsqueda"><X className="size-4" /></button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip('activos', 'Activos', cuenta.activos)}
        {chip('pedir', 'Por pedirles', cuenta.pedir)}
        {chip('inactivos', 'Inactivos', cuenta.inactivos)}
      </div>

      {lista.length === 0 ? (
        <div className="grid place-items-center rounded-[var(--radius-card)] border border-dashed border-line px-4 py-16 text-center">
          <Truck className="mb-2 size-8 text-muted" />
          <p className="display text-3xl">{proveedores.length === 0 ? 'Aún no tienes proveedores' : filtro === 'pedir' ? '¡Nada por pedir!' : 'Sin resultados'}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{proveedores.length === 0 ? 'Agrega el primero para registrar tus compras.' : filtro === 'pedir' ? 'Todo el stock de tus proveedores está por encima del mínimo.' : 'Prueba con otro nombre o quita el filtro.'}</p>
          {proveedores.length === 0 && <Button className="mt-5" onClick={() => setForm({ abierto: true })}>Nuevo proveedor</Button>}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map(({ p, r }) => (
            <li key={p.id}>
              <button onClick={() => setDetalle(p.id)} aria-label={`Ver ${p.nombre}`}
                className={`flex h-full w-full flex-col gap-3 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent/60 ${p.activo ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent" aria-hidden="true">{iniciales(p.nombre)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nombre}</p>
                    <p className="tabular truncate text-xs text-muted">{p.telefono || 'Sin teléfono'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-tile px-2.5 py-0.5 text-xs font-medium text-muted">{r.productos.length} {r.productos.length === 1 ? 'producto' : 'productos'}</span>
                  {p.activo && r.bajos.length > 0 && <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-semibold text-warn">{r.bajos.length} por pedir</span>}
                  {!p.activo && <span className="rounded-full bg-tile px-2.5 py-0.5 text-xs font-semibold text-muted">Inactivo</span>}
                </div>
                <p className="tabular mt-auto text-xs text-muted">
                  {r.ultimaCompra ? <>Última compra {fecha(r.ultimaCompra)} · {pesos(r.comprado90d)} en 90 días</> : 'Sin compras registradas'}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ProveedorDetalle
        proveedor={seleccionado}
        onCerrar={() => setDetalle(null)}
        onEditar={(p) => { setDetalle(null); setForm({ abierto: true, proveedor: p }) }}
        onEntrada={(p) => { setDetalle(null); setEntrada({ abierto: true, proveedorId: p.id }) }}
        onCambiarEstado={cambiarEstado}
        onDevolver={(p) => setDevolviendo(p)}
        version={versionDevoluciones}
      />
      <DevolucionProveedor proveedor={devolviendo} onCerrar={() => setDevolviendo(null)} onHecha={() => setVersionDevoluciones((v) => v + 1)} />
      <ProveedorFormulario abierto={form.abierto} proveedor={form.proveedor} onCerrar={() => setForm((s) => ({ ...s, abierto: false }))} />
      <EntradaMercancia abierto={entrada.abierto} inicial={{ proveedorId: entrada.proveedorId, agregarBajos: true }} onCerrar={() => setEntrada((s) => ({ ...s, abierto: false }))} />

      <Dialogo abierto={!!aDesactivar} onCerrar={() => setADesactivar(null)}>
        {aDesactivar && (() => {
          const n = productos.filter((x) => x.activo && x.proveedorId === aDesactivar.id).length
          return (
            <>
              <h2 className="display text-3xl">¿Desactivar a {aDesactivar.nombre}?</h2>
              <p className="mt-2 text-sm text-muted">
                Ya no aparecerá al registrar compras. Su historial se conserva y puedes reactivarlo cuando quieras.
                {n > 0 && <> Tiene <b className="text-ink">{n} {n === 1 ? 'producto asignado' : 'productos asignados'}</b>; {n === 1 ? 'seguirá' : 'seguirán'} a su nombre.</>}
              </p>
              <div className="mt-6 flex gap-2">
                <Button variante="secundario" className="flex-1" onClick={() => setADesactivar(null)}>Cancelar</Button>
                <Button variante="peligro" className="flex-1" onClick={() => void desactivar(aDesactivar)}>Desactivar</Button>
              </div>
            </>
          )
        })()}
      </Dialogo>
    </div>
  )
}
