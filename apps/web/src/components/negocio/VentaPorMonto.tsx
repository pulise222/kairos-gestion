import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { Dialogo } from '../ui/Dialogo'
import { useAviso } from '../ui/Avisos'
import { mensajeDe } from '../../api/cliente'
import { useCatalogo } from '../../data/contexto'
import { pesos } from '../../lib/dinero'
import { sumarMontos } from '../../lib/montos'
import type { Categoria } from '../../mock/catalogo'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Agrega la línea al carrito (la venta se confirma después, junto con lo demás). */
  onAgregar: (seccion: Categoria, monto: number) => Promise<void> | void
}

/*
  VENTA POR MONTO: como en el cuaderno. Se elige la sección y se escribe cuánto vale, incluso como suma
  («12000 + 9000»). Sirve para vender aunque el producto no esté cargado en el sistema.
*/
export function VentaPorMonto({ abierto, onCerrar, onAgregar }: Props) {
  const { categorias } = useCatalogo()
  const avisar = useAviso()
  const secciones = categorias.filter((c) => c.activa !== false)
  const [seccion, setSeccion] = useState<Categoria | null>(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (abierto) { setSeccion(null); setTexto(''); setGuardando(false) } }, [abierto])

  const suma = sumarMontos(texto)
  const listo = !!seccion && suma.ok

  const agregar = async () => {
    if (!seccion || !suma.ok || guardando) return
    setGuardando(true)
    try {
      await onAgregar(seccion, suma.total)
      onCerrar()
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
      setGuardando(false)
    }
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar}>
      <h2 className="display text-3xl">Vender por monto</h2>
      <p className="mt-1 text-sm text-muted">Elige la sección y escribe cuánto vale. Puedes sumar varios valores, como en el cuaderno.</p>

      <p className="mb-2 mt-5 text-sm font-medium text-muted">1. ¿De qué sección es?</p>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2" role="radiogroup" aria-label="Sección">
        {secciones.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={seccion?.id === c.id}
            onClick={() => setSeccion(c)}
            className={`flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-3 text-left text-base font-medium transition ${
              seccion?.id === c.id ? 'border-accent bg-accent/10 ring-2 ring-accent/40' : 'border-line bg-panel hover:border-accent/50'
            }`}
          >
            <span className="size-3.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words leading-tight">{c.nombre}</span>
            {seccion?.id === c.id && <Check className="size-4 shrink-0 text-accent" />}
          </button>
        ))}
      </div>
      {secciones.length === 0 && <p className="text-sm text-muted">Primero crea una sección en Configuración → Categorías.</p>}

      <label htmlFor="monto-venta" className="mb-1.5 mt-5 block text-sm font-medium text-muted">2. ¿Cuánto vale?</label>
      <input
        id="monto-venta"
        inputMode="text"
        autoComplete="off"
        value={texto}
        onChange={(e) => setTexto(e.target.value.replace(/[^\d+.\s$]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void agregar() } }}
        placeholder="Ej. 12000 + 9000"
        aria-describedby="monto-ayuda"
        aria-invalid={!suma.ok && suma.error !== ''}
        className={`tabular h-14 w-full rounded-xl border bg-bg/70 px-4 text-2xl outline-none focus:border-accent ${!suma.ok && suma.error ? 'border-bad' : 'border-line'}`}
      />
      <p id="monto-ayuda" className="mt-1.5 min-h-5 text-sm" aria-live="polite">
        {suma.ok
          ? <span className="text-muted">{suma.partes.length > 1 ? `${suma.partes.map((p) => pesos(p)).join(' + ')} = ` : ''}<b className="tabular text-lg text-ink">{pesos(suma.total)}</b></span>
          : <span className={suma.error ? 'text-bad' : 'text-muted'}>{suma.error || 'Escribe el valor; con «+» sumas varios.'}</span>}
      </p>

      <div className="mt-6 flex gap-2">
        <Button variante="secundario" className="flex-1" onClick={onCerrar}>Cancelar</Button>
        <Button className="flex-1" disabled={!listo || guardando} onClick={() => void agregar()}>
          {guardando ? 'Agregando…' : 'Agregar a la venta'}
        </Button>
      </div>
    </Dialogo>
  )
}
