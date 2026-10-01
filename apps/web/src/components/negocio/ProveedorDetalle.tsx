import { useEffect, useState } from 'react'
import { ClipboardCopy, Mail, MessageCircle, PackagePlus, Pencil, Phone, Power, Undo2 } from 'lucide-react'
import { PanelLateral } from '../ui/PanelLateral'
import { Button } from '../ui/Button'
import { useAviso } from '../ui/Avisos'
import { AnilloStock } from './Graficas'
import { useAjustes } from '../../ajustes/contexto'
import { useCatalogo } from '../../data/contexto'
import type { DevolucionProveedorListada } from '../../data/contexto'
import { textoMotivoProveedor, textoResolucion } from '../../lib/devoluciones'
import { pesos } from '../../lib/dinero'
import { fecha } from '../../lib/fechas'
import { sugerirCantidad } from '../../lib/inventario'
import { enlaceWhatsApp, resumenProveedor, soloDigitos, textoPedido } from '../../lib/proveedores'
import type { Proveedor } from '../../mock/catalogo'

interface Props {
  proveedor: Proveedor | null
  onCerrar: () => void
  onEditar: (p: Proveedor) => void
  onEntrada: (p: Proveedor) => void
  onCambiarEstado: (p: Proveedor) => void
  onDevolver: (p: Proveedor) => void
  /** Cambia cada vez que se registra una devolución, para volver a leer el historial. */
  version: number
}

/* Detalle de un proveedor: contacto, qué pedirle ahora, sus productos y el historial de compras. */
export function ProveedorDetalle({ proveedor, onCerrar, onEditar, onEntrada, onCambiarEstado, onDevolver, version }: Props) {
  const { productos, compras, listarDevolucionesProveedor } = useCatalogo()
  const { ajustes } = useAjustes()
  const avisar = useAviso()
  const [pestana, setPestana] = useState<'productos' | 'compras' | 'devoluciones'>('productos')
  const [devoluciones, setDevoluciones] = useState<DevolucionProveedorListada[]>([])

  // Historial de lo que se le ha devuelto a este proveedor.
  useEffect(() => {
    if (!proveedor) return
    listarDevolucionesProveedor(proveedor.id).then(setDevoluciones).catch(() => setDevoluciones([]))
  }, [proveedor, listarDevolucionesProveedor, version])

  const r = proveedor ? resumenProveedor(proveedor, productos, compras, new Date()) : null
  const pedido = proveedor && r ? textoPedido(proveedor, r.bajos, ajustes.nombreNegocio) : ''
  const wa = proveedor ? enlaceWhatsApp(proveedor.telefono, pedido || undefined) : null
  const productoDe = (id: number) => productos.find((p) => p.id === id)?.nombre ?? 'Producto'

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pedido)
      avisar('Pedido copiado. Pégalo en WhatsApp o en un correo.', 'ok')
    } catch {
      avisar('No se pudo copiar automáticamente. Selecciona el texto y cópialo.', 'alerta')
    }
  }

  return (
    <PanelLateral
      abierto={!!proveedor}
      onCerrar={onCerrar}
      titulo={proveedor?.nombre ?? ''}
      subtitulo={proveedor ? (proveedor.activo ? 'Proveedor activo' : 'Proveedor inactivo') : undefined}
      pie={proveedor && (
        <div className="flex gap-2">
          <Button variante="secundario" onClick={() => onCambiarEstado(proveedor)}><Power className="size-4" /> {proveedor.activo ? 'Desactivar' : 'Reactivar'}</Button>
          <Button variante="secundario" className="flex-1" onClick={() => onEditar(proveedor)}><Pencil className="size-4" /> Editar</Button>
          {proveedor.activo && <Button className="flex-1" onClick={() => onEntrada(proveedor)}><PackagePlus className="size-4" /> Entrada</Button>}
        </div>
      )}
    >
      {proveedor && r && (
        <div className="space-y-5">
          {/* Contacto: enlaces directos, sin teclear números */}
          <div className="flex flex-wrap gap-2">
            {proveedor.telefono && soloDigitos(proveedor.telefono).length >= 7 && (
              <a href={`tel:${soloDigitos(proveedor.telefono)}`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent"><Phone className="size-4 text-accent" /> {proveedor.telefono}</a>
            )}
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent"><MessageCircle className="size-4 text-accent" /> WhatsApp</a>}
            {proveedor.correo && <a href={`mailto:${proveedor.correo}`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-accent"><Mail className="size-4 text-accent" /> {proveedor.correo}</a>}
            {!proveedor.telefono && !proveedor.correo && <p className="text-sm text-muted">Sin datos de contacto. Agrégalos con «Editar».</p>}
          </div>

          {proveedor.notas && <p className="rounded-xl bg-tile px-4 py-3 text-sm">{proveedor.notas}</p>}

          <div className="grid grid-cols-[1fr_1.7fr_1.2fr] gap-2 text-center">
            <div className="min-w-0 rounded-xl border border-line px-2 py-3"><p className="display tabular truncate text-xl">{r.productos.length}</p><p className="text-xs text-muted">productos</p></div>
            <div className="min-w-0 rounded-xl border border-line px-2 py-3"><p className="display tabular truncate text-xl">{pesos(r.comprado90d).replace(/\s/g, '')}</p><p className="text-xs text-muted">últimos 90 días</p></div>
            <div className="min-w-0 rounded-xl border border-line px-2 py-3"><p className="display truncate text-xl">{r.ultimaCompra ? fecha(r.ultimaCompra).replace(/ \d{4}$/, '') : '—'}</p><p className="text-xs text-muted">última compra</p></div>
          </div>

          {/* Qué pedirle ahora */}
          <Button variante="secundario" className="w-full" onClick={() => onDevolver(proveedor)}><Undo2 className="size-4" /> Devolver mercancía a este proveedor</Button>

          {proveedor.activo && (
            <section className="rounded-2xl border border-warn/40 bg-warn/8 p-4" aria-label="Para pedir ahora">
              <h3 className="text-sm font-semibold">Para pedirle ahora</h3>
              {r.bajos.length === 0 ? (
                <p className="mt-1 text-sm text-muted">Nada por ahora: todo su stock está en orden.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {r.bajos.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{p.nombre} <span className="text-xs text-muted">(hay {p.stock})</span></span>
                        <b className="tabular shrink-0">{sugerirCantidad(p)} und</b>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variante="secundario" onClick={copiar}><ClipboardCopy className="size-4" /> Copiar pedido</Button>
                  </div>
                </>
              )}
            </section>
          )}

          <div className="flex w-fit gap-1 rounded-full border border-line p-1" role="tablist" aria-label="Información del proveedor">
            {([['productos', `Productos (${r.productos.length})`], ['compras', `Compras (${r.compras.length})`], ['devoluciones', `Devoluciones (${devoluciones.length})`]] as const).map(([id, texto]) => (
              <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pestana === id ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}>{texto}</button>
            ))}
          </div>

          {pestana === 'devoluciones' ? (
            devoluciones.length === 0 ? <p className="text-sm text-muted">Aún no le has devuelto mercancía a este proveedor.</p> : (
              <ul className="space-y-3">
                {devoluciones.map((d) => (
                  <li key={d.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-semibold">{fecha(d.fecha)} · {textoMotivoProveedor(d.motivo)}</p><span className="tabular text-sm font-semibold">{pesos(d.total)}</span></div>
                    <p className="text-xs text-muted">{textoResolucion(d.resolucion)}{d.compraId ? ` · de la compra #${d.compraId}` : ''}{d.nota ? ` · ${d.nota}` : ''}</p>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
                      {d.items.map((i) => <li key={i.productoId} className="flex justify-between gap-2"><span className="truncate">{i.nombre}</span><span className="tabular shrink-0">{i.cantidad} × {pesos(i.costoUnitario)}</span></li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )
          ) : pestana === 'productos' ? (
            r.productos.length === 0 ? <p className="text-sm text-muted">Aún no tiene productos asignados. Asígnalo desde la ficha de cada producto.</p> : (
              <ul className="divide-y divide-line">
                {r.productos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <AnilloStock stock={p.stock} minimo={Math.max(p.minimo, 1)} tamano="size-8" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.nombre}</p><p className="tabular text-xs text-muted">N.º {p.codigo} · costo {pesos(p.costo)}</p></div>
                    <span className="tabular text-sm">{p.stock}</span>
                  </li>
                ))}
              </ul>
            )
          ) : r.compras.length === 0 ? <p className="text-sm text-muted">Todavía no hay compras registradas a este proveedor.</p> : (
            <ul className="space-y-3">
              {r.compras.map((c) => (
                <li key={c.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-semibold">Compra #{c.id} · {fecha(c.fecha)}</p><span className="tabular text-sm font-semibold">{pesos(c.total)}</span></div>
                  {c.notas && <p className="text-xs text-muted">{c.notas}</p>}
                  <ul className="mt-2 space-y-0.5 text-xs text-muted">
                    {c.items.map((i) => <li key={i.productoId} className="flex justify-between gap-2"><span className="truncate">{productoDe(i.productoId)}</span><span className="tabular shrink-0">{i.cantidad} × {pesos(i.costoUnitario)}</span></li>)}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PanelLateral>
  )
}
