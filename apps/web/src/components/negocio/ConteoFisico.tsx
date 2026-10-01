import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { PanelLateral } from '../ui/PanelLateral'
import { useAviso } from '../ui/Avisos'
import { mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'
import { useCatalogo } from '../../data/contexto'
import { buscar } from '../../lib/busqueda'
import { revisarConteo } from '../../lib/inventario'
import { Miniatura } from './Miniatura'

interface Props { abierto: boolean; onCerrar: () => void }

/*
  Conteo físico: recorres el negocio con la hoja o el celular, escribes lo que HAY en cada producto y, al terminar,
  se revisan las diferencias antes de aplicar nada. Las filas que no escribes no se tocan.
  Todo se aplica de una vez (o nada): si algo falla, el stock queda como estaba.
*/
export function ConteoFisico({ abierto, onCerrar }: Props) {
  const { productos, categorias, registrarConteo } = useCatalogo()
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()
  const [escritos, setEscritos] = useState<Record<number, string>>({})
  const [consulta, setConsulta] = useState('')
  const [categoria, setCategoria] = useState('todas')
  const [paso, setPaso] = useState<'contar' | 'revisar'>('contar')
  const [motivo, setMotivo] = useState('Conteo físico del inventario')

  useEffect(() => {
    if (abierto) { setEscritos({}); setConsulta(''); setCategoria('todas'); setPaso('contar'); setMotivo('Conteo físico del inventario') }
  }, [abierto])

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const visibles = useMemo(() => {
    const porCat = categoria === 'todas' ? activos : activos.filter((p) => p.categoriaId === categoria)
    return (consulta.trim() ? buscar(porCat, consulta) : [...porCat].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
  }, [activos, categoria, consulta])

  // Se revisa sobre TODOS los productos activos, no solo los visibles: un filtro no debe perder lo ya escrito.
  const r = useMemo(() => revisarConteo(activos, escritos), [activos, escritos])
  const escritas = r.cambios.length + r.iguales + r.invalidos.length

  const aplicar = () => ejecutar(async () => {
    try {
      const res = await registrarConteo(r.cambios.map((c) => ({ productoId: c.producto.id, contado: c.contado })), motivo.trim() || undefined)
      avisar(res.cambios.length ? `Conteo aplicado: ${res.cambios.length} ${res.cambios.length === 1 ? 'producto ajustado' : 'productos ajustados'}.` : 'Conteo registrado: todo coincidía con el sistema.', 'ok')
      onCerrar()
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    }
  })

  return (
    <PanelLateral
      abierto={abierto}
      onCerrar={() => !enviando && onCerrar()}
      titulo={paso === 'contar' ? 'Conteo físico' : 'Revisa las diferencias'}
      subtitulo={paso === 'contar' ? 'Escribe lo que hay en el estante. Lo que dejes vacío no se toca.' : 'Nada cambia hasta que confirmes.'}
      pie={
        paso === 'contar' ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted" aria-live="polite">
              {r.invalidos.length > 0 ? <span className="text-bad">Corrige {r.invalidos.length} {r.invalidos.length === 1 ? 'valor' : 'valores'} (solo números enteros).</span> : `${escritas} contados · ${r.cambios.length} con diferencia`}
            </p>
            <Button onClick={() => setPaso('revisar')} disabled={r.invalidos.length > 0 || escritas === 0}>Revisar <ArrowRight className="size-4" /></Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variante="secundario" className="flex-1" onClick={() => setPaso('contar')} disabled={enviando}>Volver</Button>
            <Button className="flex-1" onClick={aplicar} disabled={enviando || motivo.trim().length < 3}>{enviando ? 'Aplicando…' : r.cambios.length ? `Aplicar ${r.cambios.length} ${r.cambios.length === 1 ? 'cambio' : 'cambios'}` : 'Registrar conteo'}</Button>
          </div>
        )
      }
    >
      {paso === 'contar' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto para contar" className="h-11 w-full rounded-xl border border-line bg-bg/70 pl-9 pr-3 text-sm outline-none focus:border-accent" />
            </label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Filtrar por categoría" className="h-11 rounded-xl border border-line bg-bg/70 px-3 text-sm outline-none focus:border-accent">
              <option value="todas">Todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <p className="rounded-xl bg-tile px-3 py-2 text-xs text-muted">Si se vende mientras cuentas, el conteo manda: anota las ventas del momento o cuenta con la caja en pausa.</p>
          <ul className="divide-y divide-line">
            {visibles.map((p) => {
              const malo = r.invalidos.includes(p.id)
              const t = (escritos[p.id] ?? '').trim()
              const dif = t !== '' && !malo ? Number(t) - p.stock : null
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Miniatura imagen={p.imagen} categoriaId={p.categoriaId} categoria={categorias.find((c) => c.id === p.categoriaId)} className="size-10 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted">Sistema: <b className="tabular text-ink">{p.stock}</b> · {p.codigo}</p>
                  </div>
                  {dif !== null && dif !== 0 && <span className={`tabular text-sm font-semibold ${dif < 0 ? 'text-bad' : 'text-ok'}`}>{dif > 0 ? '+' : ''}{dif}</span>}
                  <input
                    inputMode="numeric" value={escritos[p.id] ?? ''} onChange={(e) => setEscritos((s) => ({ ...s, [p.id]: e.target.value }))}
                    placeholder="—" aria-label={`Cantidad contada de ${p.nombre}`} aria-invalid={malo}
                    className={`tabular h-10 w-20 rounded-lg border bg-bg/70 px-2 text-center text-base outline-none focus:border-accent ${malo ? 'border-bad' : 'border-line'}`}
                  />
                </li>
              )
            })}
          </ul>
          {visibles.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay productos con ese filtro.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {r.cambios.length === 0 ? (
            <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">Todo lo contado coincide con el sistema ({r.iguales} {r.iguales === 1 ? 'producto' : 'productos'}). No hay nada que ajustar.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...r.cambios].sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia)).map((c) => (
                <li key={c.producto.id} className="flex items-center gap-3 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.producto.nombre}</p>
                  <span className="tabular text-sm text-muted">{c.producto.stock} → <b className="text-ink">{c.contado}</b></span>
                  <span className={`tabular w-12 text-right text-sm font-semibold ${c.diferencia < 0 ? 'text-bad' : 'text-ok'}`}>{c.diferencia > 0 ? '+' : ''}{c.diferencia}</span>
                </li>
              ))}
            </ul>
          )}
          {r.cambios.length > 0 && r.iguales > 0 && <p className="text-xs text-muted">{r.iguales} {r.iguales === 1 ? 'producto coincide' : 'productos coinciden'} con el sistema y no se tocan.</p>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Motivo (queda en el historial)</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
          </label>
        </div>
      )}
    </PanelLateral>
  )
}
