import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { useAviso } from '../ui/Avisos'
import { Dialogo } from '../ui/Dialogo'
import { mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'
import { useCatalogo } from '../../data/contexto'
import { calcularAjuste } from '../../lib/inventario'
import type { Producto } from '../../mock/catalogo'

type Tipo = 'conteo' | 'perdida' | 'sobrante'

const tipos: { id: Tipo; nombre: string; ayuda: string; etiquetaValor: string; motivos: string[] }[] = [
  { id: 'conteo', nombre: 'Conteo físico', ayuda: 'Cuenta lo que hay en el estante y escribe el total.', etiquetaValor: 'Cantidad que contaste', motivos: ['Conteo del inventario'] },
  { id: 'perdida', nombre: 'Pérdida o daño', ayuda: 'Se dañó, venció o se perdió.', etiquetaValor: 'Cuántas unidades se restan', motivos: ['Producto dañado', 'Producto vencido', 'Pérdida o robo'] },
  { id: 'sobrante', nombre: 'Sobrante', ayuda: 'Hay más de lo que dice el sistema.', etiquetaValor: 'Cuántas unidades se suman', motivos: ['Error de registro', 'Devolución del cliente'] },
]

/* HU-18: ajuste de stock. El motivo es OBLIGATORIO: así cada cambio queda explicado en el historial. */
export function AjusteStock({ producto, onCerrar }: { producto: Producto | null; onCerrar: () => void }) {
  const { ajustarStock } = useCatalogo()
  const avisar = useAviso()
  const [tipo, setTipo] = useState<Tipo>('conteo')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const { enviando, ejecutar } = useEnvioUnico()

  // Cada vez que se abre para un producto, el formulario parte limpio.
  useEffect(() => {
    if (producto) { setTipo('conteo'); setValor(''); setMotivo('Conteo del inventario') }
  }, [producto])

  if (!producto) return <Dialogo abierto={false} onCerrar={onCerrar}>{null}</Dialogo>

  const t = tipos.find((x) => x.id === tipo)!
  const n = valor === '' ? NaN : Number(valor)
  const calculo = Number.isNaN(n) ? null : calcularAjuste(producto.stock, tipo === 'conteo' ? 'conteo' : 'diferencia', tipo === 'perdida' ? -n : n)
  const error = calculo && 'error' in calculo ? calculo.error : null
  const valido = calculo !== null && !error && motivo.trim().length >= 3

  const cambiarTipo = (nuevo: Tipo) => {
    setTipo(nuevo)
    setMotivo(tipos.find((x) => x.id === nuevo)!.motivos[0]!)
  }

  const confirmar = async () => {
    if (!valido || !calculo || 'error' in calculo) return
    await ejecutar(async () => {
      try {
        await ajustarStock(producto.id, calculo.delta, motivo.trim())
        avisar(`Stock de «${producto.nombre}» ajustado a ${calculo.nuevo}.`, 'ok')
        onCerrar()
      } catch (e) {
        avisar(mensajeDe(e), 'alerta') // p. ej. si otra venta bajó el stock mientras contabas
      }
    })
  }

  return (
    <Dialogo abierto onCerrar={onCerrar}>
      <h2 className="display text-3xl">Ajustar stock</h2>
      <p className="mt-1 text-sm text-muted">{producto.nombre} · N.º <span className="tabular">{producto.codigo}</span> · hoy hay <b className="tabular text-ink">{producto.stock}</b></p>

      <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-tile p-1" role="tablist" aria-label="Tipo de ajuste">
        {tipos.map((x) => (
          <button key={x.id} role="tab" aria-selected={tipo === x.id} onClick={() => cambiarTipo(x.id)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${tipo === x.id ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink'}`}>
            {x.nombre}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t.ayuda}</p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-muted">{t.etiquetaValor}</span>
        <input autoFocus inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))} placeholder="0"
          className={`tabular h-12 w-full rounded-xl border bg-bg/70 px-4 text-xl outline-none focus:border-accent ${error && valor ? 'border-bad' : 'border-line'}`} />
      </label>

      <div className="mt-3 min-h-12 rounded-xl bg-tile px-4 py-3 text-sm" aria-live="polite">
        {calculo === null ? <span className="text-muted">Escribe la cantidad para ver cómo queda el stock.</span>
          : error ? <span className="text-bad">{error}</span>
          : 'delta' in calculo && (
            <span>Stock: <b className="tabular">{producto.stock}</b> → <b className="tabular">{calculo.nuevo}</b>{' '}
              <span className={`tabular font-semibold ${calculo.delta < 0 ? 'text-bad' : 'text-ok'}`}>({calculo.delta > 0 ? '+' : ''}{calculo.delta})</span></span>
          )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Motivo (obligatorio)</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {t.motivos.map((m) => (
          <button key={m} type="button" onClick={() => setMotivo(m)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">{m}</button>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <Button variante="secundario" className="flex-1" onClick={onCerrar}>Cancelar</Button>
        <Button className="flex-1" disabled={!valido || enviando} onClick={confirmar}>{enviando ? 'Aplicando…' : 'Aplicar ajuste'}</Button>
      </div>
    </Dialogo>
  )
}
