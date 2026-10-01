import { useEffect, useMemo, useState } from 'react'
import { PackagePlus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useAviso } from '../ui/Avisos'
import { PanelLateral } from '../ui/PanelLateral'
import { Selector } from '../ui/Selector'
import { SelectorProducto } from './SelectorProducto'
import { mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'
import { useCatalogo } from '../../data/contexto'
import { pesos } from '../../lib/dinero'
import { sugerirCantidad, totalEntrada } from '../../lib/inventario'
import type { LineaEntrada } from '../../lib/inventario'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Al abrir desde una alerta de stock bajo: viene el proveedor y/o el producto ya elegidos. */
  inicial?: { proveedorId?: number; productoId?: number; /** Agrega de entrada todo lo que está bajo el mínimo de ese proveedor. */ agregarBajos?: boolean }
}

const formato = new Intl.NumberFormat('es-CO')
const soloDigitos = (t: string) => Number(t.replace(/\D/g, '')) || 0

/* HU-17: entrada de mercancía. Sube el stock de cada producto y ACTUALIZA su costo con el de esta compra. */
export function EntradaMercancia({ abierto, onCerrar, inicial }: Props) {
  const { productos, proveedores, registrarEntrada } = useCatalogo()
  const avisar = useAviso()
  const [proveedorId, setProveedorId] = useState('')
  const [lineas, setLineas] = useState<LineaEntrada[]>([])
  const [notas, setNotas] = useState('')
  const [intento, setIntento] = useState(false) // para mostrar errores solo después de intentar guardar
  const { enviando, ejecutar } = useEnvioUnico()

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const porId = (id: number) => productos.find((p) => p.id === id)

  // Al abrir: partimos de cero, o de lo que traiga la alerta de stock bajo.
  useEffect(() => {
    if (!abierto) return
    setIntento(false)
    setNotas('')
    setProveedorId(inicial?.proveedorId ? String(inicial.proveedorId) : '')
    const p = inicial?.productoId ? productos.find((x) => x.id === inicial.productoId) : undefined
    const bajos = inicial?.agregarBajos && inicial.proveedorId
      ? productos.filter((x) => x.activo && x.proveedorId === inicial.proveedorId && x.stock <= x.minimo)
      : []
    setLineas((p ? [p] : bajos).map((x) => ({ productoId: x.id, cantidad: sugerirCantidad(x), costoUnitario: x.costo })))
  }, [abierto, inicial])

  const agregar = (id: number) => {
    const p = porId(id)
    if (!p || lineas.some((l) => l.productoId === id)) return
    setLineas((ls) => [...ls, { productoId: id, cantidad: sugerirCantidad(p), costoUnitario: p.costo }])
  }
  const cambiar = (id: number, campo: 'cantidad' | 'costoUnitario', v: number) =>
    setLineas((ls) => ls.map((l) => (l.productoId === id ? { ...l, [campo]: v } : l)))

  const bajosDelProveedor = proveedorId ? activos.filter((p) => String(p.proveedorId) === proveedorId && p.stock <= p.minimo && !lineas.some((l) => l.productoId === p.id)) : []

  const total = totalEntrada(lineas)
  const errorProveedor = intento && !proveedorId ? 'Elige el proveedor' : undefined
  const errorLineas = intento && lineas.length === 0 ? 'Agrega al menos un producto' : undefined
  const lineaInvalida = (l: LineaEntrada) => l.cantidad < 1

  const confirmar = async () => {
    setIntento(true)
    if (!proveedorId || lineas.length === 0 || lineas.some(lineaInvalida)) return
    await ejecutar(async () => {
      try {
        await registrarEntrada(Number(proveedorId), lineas, notas.trim() || undefined)
        avisar(`Entrada registrada: ${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'} · ${pesos(total)}. El stock ya subió.`, 'ok')
        onCerrar()
      } catch (e) {
        avisar(mensajeDe(e), 'alerta')
      }
    })
  }

  return (
    <PanelLateral
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Entrada de mercancía"
      subtitulo="Lo que llegó de un proveedor. Sube el stock y actualiza el costo."
      pie={
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted">Total de la compra</span>
            <span className="display tabular text-3xl">{pesos(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
            <Button className="flex-1 whitespace-nowrap" onClick={confirmar} disabled={enviando}><PackagePlus className="size-4" /> {enviando ? 'Registrando…' : 'Registrar entrada'}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Selector etiqueta="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} error={errorProveedor}>
          <option value="">Elige el proveedor…</option>
          {proveedores.filter((p) => p.activo || String(p.id) === proveedorId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Productos que llegaron</span>
          <SelectorProducto productos={activos.filter((p) => !lineas.some((l) => l.productoId === p.id))} onElegir={(p) => agregar(p.id)} />
          {errorLineas && <p className="mt-1.5 text-sm text-bad">{errorLineas}</p>}
          {bajosDelProveedor.length > 0 && (
            <button
              type="button"
              onClick={() => bajosDelProveedor.forEach((p) => agregar(p.id))}
              className="mt-2 text-sm font-medium text-accent hover:underline"
            >
              + Agregar los {bajosDelProveedor.length} con stock bajo de este proveedor
            </button>
          )}
        </div>

        {lineas.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {lineas.map((l) => {
              const p = porId(l.productoId)!
              const cambiaCosto = l.costoUnitario !== p.costo
              return (
                <li key={l.productoId} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.nombre}</p>
                      <p className="tabular text-xs text-muted">N.º {p.codigo} · stock {p.stock} → <b className="text-ink">{p.stock + (l.cantidad || 0)}</b></p>
                    </div>
                    <button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.productoId !== l.productoId))} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:text-bad" aria-label={`Quitar ${p.nombre}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-end gap-3">
                    <label className="block w-24">
                      <span className="mb-1 block text-xs text-muted">Cantidad</span>
                      <input
                        inputMode="numeric" value={l.cantidad ? formato.format(l.cantidad) : ''} placeholder="0"
                        onChange={(e) => cambiar(l.productoId, 'cantidad', soloDigitos(e.target.value))}
                        aria-invalid={intento && lineaInvalida(l)}
                        className={`tabular h-10 w-full rounded-lg border bg-bg/70 px-3 outline-none focus:border-accent ${intento && lineaInvalida(l) ? 'border-bad' : 'border-line'}`}
                      />
                    </label>
                    <label className="block min-w-0 flex-1">
                      <span className="mb-1 block text-xs text-muted">Costo por unidad</span>
                      <input
                        inputMode="numeric" value={l.costoUnitario ? formato.format(l.costoUnitario) : ''} placeholder="0"
                        onChange={(e) => cambiar(l.productoId, 'costoUnitario', soloDigitos(e.target.value))}
                        className="tabular h-10 w-full rounded-lg border border-line bg-bg/70 px-3 outline-none focus:border-accent"
                      />
                    </label>
                    <span className="tabular w-24 pb-2 text-right text-sm font-semibold">{pesos(l.cantidad * l.costoUnitario)}</span>
                  </div>
                  {cambiaCosto && <p className="tabular text-xs text-warn">El costo cambia de {pesos(p.costo)} a {pesos(l.costoUnitario)}; se actualiza el margen del producto.</p>}
                </li>
              )
            })}
          </ul>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Notas (opcional)</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={300} placeholder="Ej. Factura 4521, pagó de contado" className="w-full rounded-xl border border-line bg-bg/70 px-4 py-3 outline-none focus:border-accent" />
        </label>
      </div>
    </PanelLateral>
  )
}
