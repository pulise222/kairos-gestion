import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '../ui/Button'
import { CampoDinero } from '../ui/CampoDinero'
import { Campo } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { useAviso } from '../ui/Avisos'
import { mensajeDe } from '../../api/cliente'
import { useCatalogo } from '../../data/contexto'
import type { Producto } from '../../mock/catalogo'

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Lo que se escribió en el buscador (se usa como nombre inicial). */
  nombreInicial: string
  /** El producto ya quedó creado en el catálogo: la caja lo agrega a la venta. */
  onCreado: (p: Producto) => void
}

/*
  PRODUCTO AL VUELO: si el cliente pide algo que todavía no está en el sistema, se agrega ahí mismo (nombre, precio y sección)
  y entra directo a la venta. Así el catálogo se va armando solo, con el uso de todos los días.
*/
export function ProductoRapido({ abierto, onCerrar, nombreInicial, onCreado }: Props) {
  const { categorias, crearProducto } = useCatalogo()
  const avisar = useAviso()
  const secciones = categorias.filter((c) => c.activa !== false)
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState(0)
  const [costo, setCosto] = useState(0)
  const [seccionId, setSeccionId] = useState('')
  const [errores, setErrores] = useState<{ nombre?: string; precio?: string; seccion?: string }>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (abierto) { setNombre(nombreInicial.trim()); setPrecio(0); setCosto(0); setSeccionId(''); setErrores({}); setGuardando(false) }
  }, [abierto, nombreInicial])

  const guardar = async () => {
    const e: typeof errores = {}
    if (nombre.trim().length < 2) e.nombre = 'Escribe el nombre del producto'
    if (precio < 1) e.precio = 'Escribe cuánto cuesta para el cliente'
    if (!seccionId) e.seccion = 'Elige la sección'
    setErrores(e)
    if (Object.keys(e).length || guardando) return
    setGuardando(true)
    try {
      // El código se asigna solo y el inventario nace según el ajuste general (en Kairos: sin control).
      const p = await crearProducto({ nombre: nombre.trim(), codigo: '', categoriaId: seccionId, proveedorId: null, precio, costo, minimo: 0, activo: true }, 0)
      avisar(`«${p.nombre}» agregado al catálogo.`, 'ok')
      onCreado(p)
      onCerrar()
    } catch (err) {
      avisar(mensajeDe(err), 'alerta')
      setGuardando(false)
    }
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar}>
      <h2 className="display text-3xl">Agregar producto nuevo</h2>
      <p className="mt-1 text-sm text-muted">Queda guardado en el catálogo y entra a esta venta.</p>
      <div className="mt-5 space-y-4">
        <Campo etiqueta="Nombre del producto" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Pegante Fénix 1 L" error={errores.nombre} maxLength={120} />
        <CampoDinero etiqueta="Precio de venta" valor={precio} onCambiar={setPrecio} error={errores.precio} />
        <CampoDinero etiqueta="Lo que te costó (opcional)" valor={costo} onCambiar={setCosto} ayuda="Si lo sabes, el sistema calcula tu ganancia. Lo puedes completar después." />
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Sección</p>
          <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2" role="radiogroup" aria-label="Sección">
            {secciones.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={seccionId === c.id} onClick={() => setSeccionId(c.id)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${seccionId === c.id ? 'border-accent bg-accent/10 ring-2 ring-accent/40' : 'border-line bg-panel hover:border-accent/50'}`}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words leading-tight">{c.nombre}</span>
                {seccionId === c.id && <Check className="size-4 shrink-0 text-accent" />}
              </button>
            ))}
          </div>
          {errores.seccion && <p className="mt-1.5 text-sm text-bad">{errores.seccion}</p>}
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button variante="secundario" className="flex-1" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button className="flex-1" onClick={() => void guardar()} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar y agregar'}</Button>
      </div>
    </Dialogo>
  )
}
