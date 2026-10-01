import { useCallback, useEffect, useState } from 'react'
import { DatabaseBackup, Download, FolderOutput, History, Loader2, Mail, ShieldAlert, ShieldCheck } from 'lucide-react'
import { ErrorApi, api, bajarArchivo, mensajeDe } from '../../api/cliente'
import type { Copia } from '../../lib/copias'
import { estadoCopia } from '../../lib/copias'
import { fechaHora } from '../../lib/fechas'
import { Button } from '../ui/Button'
import { Dialogo } from '../ui/Dialogo'
import { useAviso } from '../ui/Avisos'
import { Bloque } from './Bloque'

const FRASE = 'RESTAURAR'

interface CopiaApi { nombre: string; tipo: 'auto' | 'manual' | 'previa'; tamano: number; creadaEn: string }
interface ResultadoCopia extends CopiaApi { filas: number; fotos: number; copiaExtra: 'ok' | 'sin_configurar' | 'error'; errorExtra?: string }

const ETIQUETA = { auto: 'Automática', manual: 'Manual', previa: 'Antes de restaurar' } as const
const mb = (bytes: number) => (bytes / 1_048_576).toFixed(bytes < 1_048_576 ? 2 : 1)

/** Copias de seguridad REALES (el servidor las crea, las verifica y las restaura). */
export function SeccionCopiasReal() {
  const avisar = useAviso()
  const [copias, setCopias] = useState<CopiaApi[] | null>(null)
  const [extra, setExtra] = useState(false)
  const [correoPara, setCorreoPara] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [haciendo, setHaciendo] = useState(false)
  const [restaurando, setRestaurando] = useState<CopiaApi | null>(null)
  const [frase, setFrase] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ copias: CopiaApi[]; copiaExtraConfigurada: boolean; correoPara: string[] }>('/copias')
      setCopias(r.copias)
      setExtra(r.copiaExtraConfigurada)
      setCorreoPara(r.correoPara)
      setError(null)
    } catch (e) {
      setError(mensajeDe(e))
    }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const copiarAhora = async () => {
    setHaciendo(true)
    try {
      const r = await api.post<ResultadoCopia>('/copias')
      if (r.copiaExtra === 'error') avisar(`Copia creada, pero NO se pudo repetir en la carpeta extra: ${r.errorExtra ?? 'error desconocido'}`, 'alerta')
      else avisar(`Copia creada y verificada (${r.filas} registros, ${r.fotos} ${r.fotos === 1 ? 'foto' : 'fotos'}).`, 'ok')
      await cargar()
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    } finally {
      setHaciendo(false)
    }
  }

  const enviarReporte = async () => {
    setEnviando(true)
    try {
      const r = await api.post<{ enviadoA: string[] }>('/copias/reporte')
      avisar(`Reporte enviado a ${r.enviadoA.join(', ')}.`, 'ok')
      await cargar()
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    } finally {
      setEnviando(false)
    }
  }

  const descargar = async (c: CopiaApi) => {
    try {
      await bajarArchivo(`/copias/${c.nombre}/descargar`, c.nombre)
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    }
  }

  const confirmarRestaurar = async () => {
    if (!restaurando || frase !== FRASE) return
    setProcesando(true)
    try {
      await api.post(`/copias/${restaurando.nombre}/restaurar`, { confirmacion: FRASE })
      avisar('Copia restaurada. Se recargará el sistema con los datos de esa copia.', 'ok')
      // Todo cambió en el servidor: se recarga la página para que ninguna pantalla muestre datos viejos.
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.message : mensajeDe(e), 'alerta')
      setProcesando(false)
    }
  }

  const lista: Copia[] = (copias ?? []).map((c, i) => ({ id: i, fecha: new Date(c.creadaEn), tamanoMB: c.tamano / 1_048_576, tipo: c.tipo === 'manual' ? 'manual' : 'automatica', destino: '' }))
  const estado = estadoCopia(lista, new Date())
  const colores = { ok: 'border-ok/40 bg-ok/8', warn: 'border-warn/40 bg-warn/10', bad: 'border-bad/40 bg-bad/10' }
  const Icono = estado.nivel === 'ok' ? ShieldCheck : ShieldAlert
  const ultima = copias?.[0]

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border p-5 ${copias ? colores[estado.nivel] : 'border-line'}`}>
        <Icono className={`size-9 shrink-0 ${estado.nivel === 'ok' ? 'text-ok' : estado.nivel === 'warn' ? 'text-warn' : 'text-bad'}`} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{copias ? estado.texto : 'Revisando copias…'}</p>
          <p className="text-sm text-muted">{ultima ? `Última copia: ${fechaHora(new Date(ultima.creadaEn))} · ${mb(ultima.tamano)} MB` : copias ? 'Aún no se ha hecho ninguna copia.' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secundario" onClick={() => void bajarArchivo('/copias/excel', 'respaldo-kairos.xlsx').catch((e) => avisar(mensajeDe(e), 'alerta'))}>
            <Download className="size-4" /> Descargar Excel
          </Button>
          <Button onClick={copiarAhora} disabled={haciendo}>
            {haciendo ? <><Loader2 className="size-4 animate-spin" /> Copiando…</> : <><DatabaseBackup className="size-4" /> Hacer copia ahora</>}
          </Button>
        </div>
      </div>
      {error && <p className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">{error}</p>}

      <Bloque titulo="Cómo se protege tu información" descripcion="Cada copia guarda todos los datos (productos, ventas, inventario, usuarios, ajustes) y las fotos en un solo archivo, y se comprueba al crearla.">
        <ul className="space-y-2 text-sm">
          <li className="flex gap-3"><History className="mt-0.5 size-4 shrink-0 text-accent" /> <span><b>Automática:</b> el sistema hace una copia cada 24 horas mientras el computador esté encendido, y guarda las últimas 30.</span></li>
          <li className="flex gap-3"><Download className="mt-0.5 size-4 shrink-0 text-accent" /> <span><b>Excel de respaldo:</b> cada día el sistema deja un Excel con ventas, cierres y productos en una carpeta visible del computador, para poder abrirlo aunque el sistema no funcione. También puedes bajarlo con «Descargar Excel».</span></li>
          <li className="flex gap-3"><FolderOutput className={`mt-0.5 size-4 shrink-0 ${extra ? 'text-ok' : 'text-warn'}`} />
            <span>{extra
              ? <><b>Segunda carpeta:</b> cada copia se repite también en la carpeta extra configurada (por ejemplo, una USB o un segundo disco).</>
              : <><b className="text-warn">Falta una segunda carpeta.</b> Si solo se guarda en este computador y se daña, las copias se pierden con él. Pide que configuren <code className="rounded bg-tile px-1">COPIAS_EXTRA_DIR</code> (una USB u otro disco), o descarga una copia de vez en cuando y guárdala fuera del PC.</>}
            </span>
          </li>
          <li className="flex items-start gap-3"><Mail className={`mt-0.5 size-4 shrink-0 ${correoPara.length ? 'text-ok' : 'text-muted'}`} />
            <span className="min-w-0 flex-1">{correoPara.length
              ? <><b>Reporte semanal por correo:</b> cada 7 días se envía a <b>{correoPara.join(', ')}</b> un Excel con las ventas y el inventario, con la copia de seguridad adjunta.</>
              : <><b>Reporte semanal por correo (opcional):</b> no está configurado. Pide que lo activen en el servidor (SMTP_HOST, SMTP_USER, SMTP_PASS y REPORTE_PARA) y recibirás cada semana un Excel y una copia fuera del PC.</>}
            </span>
            {correoPara.length > 0 && <Button variante="secundario" onClick={enviarReporte} disabled={enviando}>{enviando ? <><Loader2 className="size-4 animate-spin" /> Enviando…</> : 'Enviar ahora'}</Button>}
          </li>
        </ul>
      </Bloque>

      <Bloque titulo="Copias guardadas" descripcion={copias ? `${copias.length} ${copias.length === 1 ? 'copia' : 'copias'}.` : 'Cargando…'}>
        <ul className="divide-y divide-line">
          {(copias ?? []).map((c) => (
            <li key={c.nombre} className="flex flex-wrap items-center gap-3 py-3">
              <History className="size-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{fechaHora(new Date(c.creadaEn))}</p>
                <p className="truncate text-xs text-muted">{ETIQUETA[c.tipo]} · {mb(c.tamano)} MB</p>
              </div>
              <Button variante="secundario" onClick={() => void descargar(c)} aria-label={`Descargar copia del ${fechaHora(new Date(c.creadaEn))}`}><Download className="size-4" /> Descargar</Button>
              <Button variante="secundario" onClick={() => { setRestaurando(c); setFrase('') }}>Restaurar</Button>
            </li>
          ))}
        </ul>
        {copias?.length === 0 && <p className="text-sm text-muted">Todavía no hay copias. Pulsa «Hacer copia ahora» para crear la primera.</p>}
      </Bloque>

      <Dialogo abierto={!!restaurando} onCerrar={() => !procesando && setRestaurando(null)} descartable={!procesando}>
        {restaurando && (
          <>
            <h2 className="display text-3xl">¿Restaurar esta copia?</h2>
            <p className="mt-2 text-sm text-muted">Copia del <b className="text-ink">{fechaHora(new Date(restaurando.creadaEn))}</b>. Todo lo registrado <b className="text-bad">después</b> de ese momento (ventas, entradas, cambios) se perderá. Antes de restaurar, el sistema guarda una copia del estado actual por si te arrepientes.</p>
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
