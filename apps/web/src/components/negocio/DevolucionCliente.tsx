import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Undo2 } from 'lucide-react'
import { ErrorApi, mensajeDe } from '../../api/cliente'
import { Button } from '../ui/Button'
import { Dialogo } from '../ui/Dialogo'
import { useAviso } from '../ui/Avisos'
import { useCatalogo } from '../../data/contexto'
import type { VentaListada } from '../../data/contexto'
import { disponibleParaDevolver, totalDevolucion, yaDevueltas } from '../../lib/devoluciones'
import { pesos } from '../../lib/dinero'
import { claveParaIntento, useEnvioUnico } from '../../lib/envio'
import type { IntentoVenta } from '../../lib/envio'

const MOTIVOS = ['El cliente se arrepintió', 'Producto dañado', 'Producto equivocado', 'Producto vencido']
const MEDIOS = [['EFECTIVO', 'Efectivo'], ['TRANSFERENCIA', 'Transferencia'], ['TARJETA', 'Tarjeta']] as const

interface Props {
  venta: VentaListada | null
  onCerrar: () => void
  /** Se llama cuando la devolución quedó registrada (para que la pantalla se actualice). */
  onHecha: () => void
}

/* Devolución de un cliente sobre una venta: parcial o total. El dinero se devuelve al precio al que se vendió. */
export function DevolucionCliente({ venta, onCerrar, onHecha }: Props) {
  const { registrarDevolucionCliente } = useCatalogo()
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()
  const intento = useRef<IntentoVenta | null>(null)

  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [danadas, setDanadas] = useState<Record<number, boolean>>({}) // true = vuelve dañado: NO entra al inventario
  const [motivo, setMotivo] = useState('')
  const [medio, setMedio] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'>('EFECTIVO')

  // Cada vez que se abre para una venta, el formulario parte limpio.
  useEffect(() => {
    if (venta) { setCantidades({}); setDanadas({}); setMotivo(''); setMedio('EFECTIVO'); intento.current = null }
  }, [venta])

  if (!venta) return <Dialogo abierto={false} onCerrar={onCerrar}>{null}</Dialogo>

  const lineas = venta.items.map((l) => ({ l, disponible: disponibleParaDevolver(l, venta.devoluciones), ya: yaDevueltas(l, venta.devoluciones) }))
  const elegidas = lineas.filter((x) => (cantidades[x.l.id] ?? 0) > 0)
  const total = totalDevolucion(elegidas.map((x) => ({ cantidad: cantidades[x.l.id]!, precioUnitario: x.l.precioUnitario })))
  const valido = elegidas.length > 0 && motivo.trim().length >= 3

  const cambiar = (id: number, delta: number, max: number) =>
    setCantidades((c) => ({ ...c, [id]: Math.min(Math.max((c[id] ?? 0) + delta, 0), max) }))

  const confirmar = () =>
    ejecutar(async () => {
      if (!valido) return
      const items = elegidas.map((x) => ({ ventaItemId: x.l.id, cantidad: cantidades[x.l.id]!, reingresaStock: !danadas[x.l.id] }))
      // Una clave por intento: si la red se corta justo al enviar y se reintenta con lo mismo, no se devuelve el dinero dos veces.
      intento.current = claveParaIntento(intento.current, JSON.stringify([items, motivo.trim(), medio]))
      try {
        await registrarDevolucionCliente(venta.id, { items, motivo: motivo.trim(), medioReembolso: medio, clave: intento.current.clave })
        avisar(`Devolución registrada: ${pesos(total)} para el cliente.`, 'ok')
        intento.current = null
        onHecha()
        onCerrar()
      } catch (e) {
        if (intento.current) intento.current.ambiguo = e instanceof ErrorApi && e.estado === 0
        avisar(mensajeDe(e), 'alerta')
      }
    })

  return (
    <Dialogo abierto onCerrar={() => !enviando && onCerrar()} descartable={!enviando}>
      <h2 className="display text-3xl">Devolución</h2>
      <p className="mt-1 text-sm text-muted">Venta #{String(venta.numero).padStart(4, '0')} · se devuelve el precio al que se vendió, no el de hoy.</p>

      <ul className="mt-4 space-y-3">
        {lineas.map(({ l, disponible, ya }) => (
          <li key={l.id} className={`rounded-xl border border-line p-3 ${disponible === 0 ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.nombre}</p>
                <p className="tabular text-xs text-muted">{l.cantidad} × {pesos(l.precioUnitario)}{ya > 0 && <> · ya devueltas {ya}</>}</p>
              </div>
              {disponible > 0 ? (
                <div className="flex shrink-0 items-center rounded-full border border-line" role="group" aria-label={`Cantidad a devolver de ${l.nombre}`}>
                  <button onClick={() => cambiar(l.id, -1, disponible)} className="grid size-9 place-items-center rounded-full hover:bg-tile" aria-label={`Menos ${l.nombre}`}><Minus className="size-4" /></button>
                  <span className="tabular w-8 text-center text-sm font-semibold" aria-live="polite">{cantidades[l.id] ?? 0}</span>
                  <button onClick={() => cambiar(l.id, 1, disponible)} className="grid size-9 place-items-center rounded-full hover:bg-tile" aria-label={`Más ${l.nombre}`}><Plus className="size-4" /></button>
                </div>
              ) : <span className="text-xs font-medium text-muted">Ya devuelto</span>}
            </div>
            {(cantidades[l.id] ?? 0) > 0 && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={!!danadas[l.id]} onChange={(e) => setDanadas((d) => ({ ...d, [l.id]: e.target.checked }))} className="size-4 accent-[var(--accent)]" />
                <span className={danadas[l.id] ? 'font-medium text-warn' : 'text-muted'}>{danadas[l.id] ? 'Viene dañado: se devuelve el dinero pero NO entra al inventario' : 'Vuelve dañado (no reingresa al inventario)'}</span>
              </label>
            )}
          </li>
        ))}
      </ul>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Motivo (obligatorio)</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MOTIVOS.map((m) => <button key={m} type="button" onClick={() => setMotivo(m)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">{m}</button>)}
      </div>

      <div className="mt-4" role="radiogroup" aria-label="Cómo se le devuelve el dinero">
        <span className="mb-1.5 block text-sm font-medium text-muted">Cómo se le devuelve el dinero</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-tile p-1">
          {MEDIOS.map(([id, texto]) => (
            <button key={id} type="button" role="radio" aria-checked={medio === id} onClick={() => setMedio(id)} className={`rounded-lg py-2 text-xs font-semibold transition ${medio === id ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink'}`}>{texto}</button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between rounded-xl bg-tile px-4 py-3" aria-live="polite">
        <span className="text-sm text-muted">Devolver al cliente</span>
        <span className="display tabular text-4xl">{pesos(total)}</span>
      </div>

      <div className="mt-5 flex gap-2">
        <Button variante="secundario" className="flex-1" disabled={enviando} onClick={onCerrar}>Cancelar</Button>
        <Button className="flex-1" disabled={!valido || enviando} onClick={() => void confirmar()}><Undo2 className="size-4" /> {enviando ? 'Registrando…' : 'Registrar devolución'}</Button>
      </div>
    </Dialogo>
  )
}
