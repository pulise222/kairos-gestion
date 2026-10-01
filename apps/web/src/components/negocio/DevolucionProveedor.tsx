import { useEffect, useMemo, useRef, useState } from 'react'
import { llevaInventario } from '../../lib/busqueda'
import { Trash2, Undo2 } from 'lucide-react'
import { ErrorApi, mensajeDe } from '../../api/cliente'
import { Button } from '../ui/Button'
import { PanelLateral } from '../ui/PanelLateral'
import { Selector } from '../ui/Selector'
import { useAviso } from '../ui/Avisos'
import { SelectorProducto } from './SelectorProducto'
import { useCatalogo } from '../../data/contexto'
import type { DevolucionProveedorListada, MotivoDevolucionProveedor, ResolucionProveedor } from '../../data/contexto'
import { MOTIVOS_PROVEEDOR, RESOLUCIONES, disponibleDeCompra, totalDevolucionProveedor } from '../../lib/devoluciones'
import { pesos } from '../../lib/dinero'
import { claveParaIntento, useEnvioUnico } from '../../lib/envio'
import type { IntentoVenta } from '../../lib/envio'
import { fecha } from '../../lib/fechas'
import type { Proveedor } from '../../mock/catalogo'

interface Linea { productoId: number; cantidad: number; costoUnitario: number }

interface Props {
  proveedor: Proveedor | null
  onCerrar: () => void
  onHecha: () => void
}

/* Devolver mercancía a un proveedor: llegó de más, dañada, equivocada o vencida. Sale del inventario. */
export function DevolucionProveedor({ proveedor, onCerrar, onHecha }: Props) {
  const { productos: todosLosProductos, compras, registrarDevolucionProveedor, listarDevolucionesProveedor } = useCatalogo()
  // Solo se muestran los productos CON control de inventario (los demás no tienen stock que contar, pedir o devolver).
  const productos = useMemo(() => todosLosProductos.filter(llevaInventario), [todosLosProductos])
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()
  const intento = useRef<IntentoVenta | null>(null)

  const [previas, setPrevias] = useState<DevolucionProveedorListada[]>([])
  const [compraId, setCompraId] = useState('') // '' = sin compra de origen
  const [lineas, setLineas] = useState<Linea[]>([])
  const [motivo, setMotivo] = useState<MotivoDevolucionProveedor>('SOBRANTE')
  const [nota, setNota] = useState('')
  const [resolucion, setResolucion] = useState<ResolucionProveedor>('PENDIENTE')

  // Al abrir: formulario limpio y se leen las devoluciones anteriores (para saber cuánto queda por devolver de cada compra).
  useEffect(() => {
    if (!proveedor) return
    setCompraId(''); setLineas([]); setMotivo('SOBRANTE'); setNota(''); setResolucion('PENDIENTE'); intento.current = null
    listarDevolucionesProveedor(proveedor.id).then(setPrevias).catch(() => setPrevias([]))
  }, [proveedor, listarDevolucionesProveedor])

  const propias = useMemo(() => (proveedor ? compras.filter((c) => c.proveedorId === proveedor.id) : []), [compras, proveedor])
  const compra = compraId ? propias.find((c) => String(c.id) === compraId) : undefined
  const disponibles = useMemo(() => (compra ? disponibleDeCompra(compra, previas) : new Map<number, number>()), [compra, previas])
  const productoDe = (id: number) => productos.find((p) => p.id === id)

  // Al elegir una compra, se parte de sus líneas (con cantidad 0 para que el dueño ponga lo que devuelve).
  const elegirCompra = (id: string) => {
    setCompraId(id)
    const c = propias.find((x) => String(x.id) === id)
    setLineas(c ? c.items.map((i) => ({ productoId: i.productoId, cantidad: 0, costoUnitario: i.costoUnitario })) : [])
  }

  const maximo = (l: Linea) => {
    const stock = Math.max(productoDe(l.productoId)?.stock ?? 0, 0) // no se puede devolver lo que ya no se tiene
    return compra ? Math.min(disponibles.get(l.productoId) ?? 0, stock) : stock
  }
  const poner = (id: number, valor: string) => {
    const l = lineas.find((x) => x.productoId === id)!
    const n = Math.min(Math.max(Number(valor.replace(/\D/g, '')) || 0, 0), maximo(l))
    setLineas((ls) => ls.map((x) => (x.productoId === id ? { ...x, cantidad: n } : x)))
  }

  const elegidas = lineas.filter((l) => l.cantidad > 0)
  const total = totalDevolucionProveedor(elegidas)
  const valido = elegidas.length > 0

  const confirmar = () =>
    ejecutar(async () => {
      if (!proveedor || !valido) return
      const items = elegidas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, ...(compra ? {} : { costoUnitario: l.costoUnitario }) }))
      intento.current = claveParaIntento(intento.current, JSON.stringify([compraId, items, motivo, nota, resolucion]))
      try {
        await registrarDevolucionProveedor(proveedor.id, { compraId: compra?.id, items, motivo, nota: nota.trim() || undefined, resolucion, clave: intento.current.clave })
        avisar(`Devolución registrada: ${pesos(total)} a costo. El stock ya bajó.`, 'ok')
        intento.current = null
        onHecha()
        onCerrar()
      } catch (e) {
        if (intento.current) intento.current.ambiguo = e instanceof ErrorApi && e.estado === 0
        avisar(mensajeDe(e), 'alerta') // p. ej. "No puedes devolver 5: solo hay 2 en el inventario"
      }
    })

  return (
    <PanelLateral
      abierto={!!proveedor}
      onCerrar={() => !enviando && onCerrar()}
      titulo="Devolver mercancía"
      subtitulo={proveedor ? `A ${proveedor.nombre}. Lo devuelto sale del inventario.` : undefined}
      pie={
        <div className="space-y-3">
          <div className="flex items-end justify-between"><span className="text-sm text-muted">Valor a costo</span><span className="display tabular text-3xl">{pesos(total)}</span></div>
          <div className="flex gap-2">
            <Button variante="secundario" disabled={enviando} onClick={onCerrar}>Cancelar</Button>
            <Button className="flex-1 whitespace-nowrap" disabled={!valido || enviando} onClick={() => void confirmar()}><Undo2 className="size-4" /> {enviando ? 'Registrando…' : 'Registrar devolución'}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Selector etiqueta="¿De qué compra viene? (opcional)" value={compraId} onChange={(e) => elegirCompra(e.target.value)}>
          <option value="">Sin compra: elijo los productos a mano</option>
          {propias.map((c) => <option key={c.id} value={c.id}>Compra #{c.id} · {fecha(c.fecha)} · {pesos(c.total)}</option>)}
        </Selector>

        {!compra && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Productos que devuelves</span>
            <SelectorProducto
              productos={productos.filter((p) => p.activo && !lineas.some((l) => l.productoId === p.id) && (p.proveedorId === proveedor?.id || p.stock > 0))}
              onElegir={(p) => setLineas((ls) => [...ls, { productoId: p.id, cantidad: Math.min(1, Math.max(p.stock, 0)), costoUnitario: p.costo }])}
            />
          </div>
        )}

        {lineas.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Productos a devolver">
            {lineas.map((l) => {
              const p = productoDe(l.productoId)
              const max = maximo(l)
              return (
                <li key={l.productoId} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p?.nombre}</p>
                    <p className="tabular text-xs text-muted">
                      {compra ? <>comprados {compra.items.find((i) => i.productoId === l.productoId)?.cantidad} · se pueden devolver {disponibles.get(l.productoId) ?? 0} · </> : null}
                      hay en inventario {Math.max(p?.stock ?? 0, 0)} · costo {pesos(l.costoUnitario)}
                    </p>
                  </div>
                  <label className="block w-20">
                    <span className="sr-only">Cantidad a devolver de {p?.nombre}</span>
                    <input inputMode="numeric" value={l.cantidad || ''} placeholder="0" disabled={max === 0} onChange={(e) => poner(l.productoId, e.target.value)}
                      className="tabular h-10 w-full rounded-lg border border-line bg-bg/70 px-3 text-right outline-none focus:border-accent disabled:opacity-40" />
                  </label>
                  {!compra && (
                    <button onClick={() => setLineas((ls) => ls.filter((x) => x.productoId !== l.productoId))} className="grid size-8 place-items-center rounded-full text-muted hover:text-bad" aria-label={`Quitar ${p?.nombre}`}><Trash2 className="size-4" /></button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <Selector etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDevolucionProveedor)}>
          {MOTIVOS_PROVEEDOR.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
        </Selector>

        <div role="radiogroup" aria-label="Cómo se resuelve con el proveedor">
          <span className="mb-1.5 block text-sm font-medium text-muted">¿Cómo te lo compensa?</span>
          <div className="grid grid-cols-2 gap-2">
            {RESOLUCIONES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={resolucion === r.id} onClick={() => setResolucion(r.id)}
                className={`rounded-xl border p-3 text-left transition ${resolucion === r.id ? 'border-accent bg-accent/8 ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
                <span className="block text-sm font-medium">{r.texto}</span>
                <span className="block text-xs text-muted">{r.ayuda}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Nota (opcional)</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={300} placeholder="Ej. Pedimos 15 y llegaron 20. Remisión 4521"
            className="w-full rounded-xl border border-line bg-bg/70 px-4 py-3 outline-none focus:border-accent" />
        </label>
      </div>
    </PanelLateral>
  )
}
