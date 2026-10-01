import { useState } from 'react'
import { DatabaseBackup, Loader2, ShieldCheck, ShieldAlert, History } from 'lucide-react'
import { useAjustes } from '../../ajustes/contexto'
import type { Copia } from '../../lib/copias'
import { estadoCopia } from '../../lib/copias'
import { fechaHora } from '../../lib/fechas'
import { Button } from '../ui/Button'
import { Dialogo } from '../ui/Dialogo'
import { Interruptor } from '../ui/Interruptor'
import { Selector } from '../ui/Selector'
import { useAviso } from '../ui/Avisos'
import { Bloque } from './Bloque'

const FRASE = 'RESTAURAR'

export function SeccionCopias() {
  const { ajustes, cambiar, copias, hacerCopia, restaurarCopia } = useAjustes()
  const avisar = useAviso()
  const [haciendo, setHaciendo] = useState(false)
  const [restaurando, setRestaurando] = useState<Copia | null>(null)
  const [frase, setFrase] = useState('')
  const [procesando, setProcesando] = useState(false)

  const estado = estadoCopia(copias, new Date())
  const ordenadas = [...copias].sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  const c = ajustes.copias
  const set = (parcial: Partial<typeof c>) => cambiar({ copias: { ...c, ...parcial } })

  const copiarAhora = async () => {
    setHaciendo(true)
    await hacerCopia()
    setHaciendo(false)
    avisar('Copia de seguridad creada.', 'ok')
  }

  const confirmarRestaurar = async () => {
    if (!restaurando || frase !== FRASE) return
    setProcesando(true)
    await restaurarCopia(restaurando.id)
    setProcesando(false)
    avisar('Prototipo: en el sistema real, los datos volverían al estado de esa copia.', 'info')
    setRestaurando(null)
    setFrase('')
  }

  const colores = { ok: 'border-ok/40 bg-ok/8', warn: 'border-warn/40 bg-warn/10', bad: 'border-bad/40 bg-bad/10' }
  const Icono = estado.nivel === 'ok' ? ShieldCheck : ShieldAlert

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border p-5 ${colores[estado.nivel]}`}>
        <Icono className={`size-9 shrink-0 ${estado.nivel === 'ok' ? 'text-ok' : estado.nivel === 'warn' ? 'text-warn' : 'text-bad'}`} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{estado.texto}</p>
          <p className="text-sm text-muted">{ordenadas[0] ? `Última copia: ${fechaHora(ordenadas[0].fecha)} · ${ordenadas[0].tamanoMB.toFixed(1)} MB` : 'Aún no se ha hecho ninguna copia.'}</p>
        </div>
        <Button onClick={copiarAhora} disabled={haciendo}>
          {haciendo ? <><Loader2 className="size-4 animate-spin" /> Copiando…</> : <><DatabaseBackup className="size-4" /> Hacer copia ahora</>}
        </Button>
      </div>

      <Bloque titulo="Cuándo y dónde" descripcion="La copia automática protege tu información si falla el PC. Para estar tranquilo, guárdala también fuera del computador (USB o nube).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="Frecuencia" value={c.frecuencia} onChange={(e) => set({ frecuencia: e.target.value as 'diaria' | 'cierre' })}>
            <option value="diaria">Todos los días (2:00 a. m.)</option>
            <option value="cierre">Al cerrar el día</option>
          </Selector>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Copias que se conservan</span>
            <input type="number" min={1} max={60} value={c.conservar} onChange={(e) => set({ conservar: Math.min(60, Math.max(1, Number(e.target.value) || 1)) })} className="tabular h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
            <span className="mt-1.5 block text-xs text-muted">Las más viejas se borran solas para no llenar el disco.</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-muted">Carpeta o USB de destino</span>
            <input value={c.destino} onChange={(e) => set({ destino: e.target.value })} maxLength={200} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
          </label>
          <div className="sm:col-span-2"><Interruptor activo={c.nube} onCambiar={(v) => set({ nube: v })} etiqueta="Subir también a la nube (si hay internet)" descripcion="Opcional. Si no hay conexión, la copia local se hace igual y la nube se completa después." /></div>
        </div>
      </Bloque>

      <Bloque titulo="Copias guardadas" descripcion={`${copias.length} ${copias.length === 1 ? 'copia' : 'copias'} (se conservan las últimas ${c.conservar}).`}>
        <ul className="divide-y divide-line">
          {ordenadas.map((cp) => (
            <li key={cp.id} className="flex flex-wrap items-center gap-3 py-3">
              <History className="size-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{fechaHora(cp.fecha)}</p>
                <p className="truncate text-xs text-muted">{cp.tipo === 'manual' ? 'Manual' : 'Automática'} · {cp.tamanoMB.toFixed(1)} MB · {cp.destino}</p>
              </div>
              <Button variante="secundario" onClick={() => { setRestaurando(cp); setFrase('') }}>Restaurar</Button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Prototipo: las copias son una simulación. Las reales (pg_dump automático y restauración probada) llegan en la Fase 6.</p>
      </Bloque>

      <Dialogo abierto={!!restaurando} onCerrar={() => !procesando && setRestaurando(null)} descartable={!procesando}>
        {restaurando && (
          <>
            <h2 className="display text-3xl">¿Restaurar esta copia?</h2>
            <p className="mt-2 text-sm text-muted">Copia del <b className="text-ink">{fechaHora(restaurando.fecha)}</b>. Todo lo registrado <b className="text-bad">después</b> de ese momento (ventas, entradas, cambios) se perderá. Antes de restaurar, el sistema guarda una copia del estado actual.</p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-medium text-muted">Para confirmar, escribe <b className="text-ink">{FRASE}</b></span>
              <input value={frase} onChange={(e) => setFrase(e.target.value)} autoFocus autoComplete="off" disabled={procesando} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-bad" />
            </label>
            <div className="mt-6 flex gap-2">
              <Button variante="secundario" className="flex-1" disabled={procesando} onClick={() => setRestaurando(null)}>Cancelar</Button>
              <Button variante="peligro" className="flex-1" disabled={frase !== FRASE || procesando} onClick={confirmarRestaurar}>{procesando ? <><Loader2 className="size-4 animate-spin" /> Restaurando…</> : 'Restaurar'}</Button>
            </div>
          </>
        )}
      </Dialogo>
    </div>
  )
}
