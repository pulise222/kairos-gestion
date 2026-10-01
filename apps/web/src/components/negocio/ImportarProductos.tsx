import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { PanelLateral } from '../ui/PanelLateral'
import { useAviso } from '../ui/Avisos'
import { ErrorApi, api, bajarArchivo, mensajeDe } from '../../api/cliente'
import { useCatalogo } from '../../data/contexto'
import { useEnvioUnico } from '../../lib/envio'

interface Vista {
  puedeAplicar: boolean
  crear: number
  actualizar: number
  filas: { fila: number; accion: 'crear' | 'actualizar'; nombre: string; codigo: string | null; categoria: string; precio: number; avisos: string[] }[]
  errores: { fila: number; campo: string; mensaje: string }[]
  categoriasNuevas: string[]
  proveedoresNuevos: string[]
}
interface Resumen { creados: number; actualizados: number; categoriasNuevas: string[]; proveedoresNuevos: string[] }

const MAX_ARCHIVO = 5 * 1024 * 1024

/*
  Importar productos desde Excel o CSV en 3 pasos: 1) elegir el archivo, 2) ver qué pasaría (errores marcados por fila y columna),
  3) aplicar. La vista previa no guarda nada; al aplicar, el servidor vuelve a validar todo y guarda todo o nada.
*/
export function ImportarProductos({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { refrescar } = useCatalogo()
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<Vista | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (abierto) { setArchivo(null); setVista(null); setError(null) } }, [abierto])

  async function elegir(f: File | undefined) {
    if (!f) return
    setError(null); setVista(null); setArchivo(f)
    if (f.size > MAX_ARCHIVO) { setError('El archivo pesa más de 5 MB. Divídelo en partes.'); return }
    setLeyendo(true)
    try {
      setVista(await api.subirImagen<Vista>('/productos/importar', f))
    } catch (e) {
      setError(mensajeDe(e))
    } finally {
      setLeyendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  const aplicar = () => ejecutar(async () => {
    if (!archivo) return
    try {
      const r = await api.subirImagen<Resumen>('/productos/importar?aplicar=true', archivo)
      await refrescar()
      const partes = [r.creados && `${r.creados} ${r.creados === 1 ? 'creado' : 'creados'}`, r.actualizados && `${r.actualizados} ${r.actualizados === 1 ? 'actualizado' : 'actualizados'}`].filter(Boolean)
      avisar(`Importación lista: ${partes.join(' y ')}.`, 'ok')
      onCerrar()
    } catch (e) {
      // Si entre la vista previa y aplicar algo cambió (otro usuario creó el código…), el servidor lo detecta y avisa.
      if (e instanceof ErrorApi && e.codigo === 'IMPORTACION_CON_ERRORES') { setError(e.message); setArchivo(null); setVista(null) }
      else avisar(mensajeDe(e), 'alerta')
    }
  })

  const hayErrores = !!vista && vista.errores.length > 0
  const total = vista ? vista.crear + vista.actualizar : 0

  return (
    <PanelLateral
      abierto={abierto}
      onCerrar={() => !enviando && onCerrar()}
      titulo="Importar productos"
      subtitulo="Desde Excel (.xlsx) o CSV. Primero ves qué pasaría; nada se guarda todavía."
      pie={
        <div className="flex gap-2">
          <Button variante="secundario" className="flex-1" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button className="flex-1" onClick={aplicar} disabled={!vista?.puedeAplicar || total === 0 || enviando}>
            {enviando ? <><Loader2 className="size-4 animate-spin" /> Importando…</> : total ? `Importar ${total} ${total === 1 ? 'producto' : 'productos'}` : 'Importar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-bg/50 p-4 text-sm">
          <p className="font-medium">1. Descarga la plantilla y llénala</p>
          <p className="mt-1 text-xs text-muted">Trae un ejemplo y las instrucciones. Si ya tienes un Excel, solo asegúrate de que tenga las columnas Nombre, Categoría, Costo y Precio.</p>
          <Button variante="secundario" className="mt-3" onClick={() => void bajarArchivo('/productos/importar/plantilla', 'plantilla-productos.xlsx').catch((e) => avisar(mensajeDe(e), 'alerta'))}>
            <Download className="size-4" /> Descargar plantilla
          </Button>
        </div>

        <div className="rounded-xl border border-line bg-bg/50 p-4 text-sm">
          <p className="font-medium">2. Sube tu archivo</p>
          <input ref={entrada} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Elegir archivo de productos" onChange={(e) => void elegir(e.target.files?.[0])} />
          <Button variante="secundario" className="mt-3" onClick={() => entrada.current?.click()} disabled={leyendo}>
            {leyendo ? <><Loader2 className="size-4 animate-spin" /> Revisando…</> : <><FileSpreadsheet className="size-4" /> {archivo ? 'Elegir otro archivo' : 'Elegir archivo'}</>}
          </Button>
          {archivo && <p className="mt-2 truncate text-xs text-muted">{archivo.name}</p>}
        </div>

        {error && <p className="flex gap-2 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}</p>}

        {vista && (
          <div className="space-y-3" aria-live="polite">
            <p className="font-medium">3. Revisa y confirma</p>
            {hayErrores ? (
              <div className="rounded-xl border border-bad/40 bg-bad/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-bad"><AlertTriangle className="size-4" /> {vista.errores.length} {vista.errores.length === 1 ? 'error' : 'errores'}: corrígelos en el archivo y súbelo de nuevo</p>
                <p className="mt-1 text-xs text-muted">Mientras haya errores no se guarda nada (así nunca queda un catálogo a medias).</p>
                <ul className="mt-3 max-h-64 divide-y divide-bad/20 overflow-y-auto text-sm">
                  {vista.errores.slice(0, 100).map((e, i) => (
                    <li key={i} className="py-1.5"><b className="tabular">Fila {e.fila}</b> · <span className="text-muted">{e.campo}:</span> {e.mensaje}</li>
                  ))}
                </ul>
                {vista.errores.length > 100 && <p className="mt-2 text-xs text-muted">…y {vista.errores.length - 100} más.</p>}
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok"><CheckCircle2 className="size-4" /> Todo en orden: se crearán <b>{vista.crear}</b> y se actualizarán <b>{vista.actualizar}</b>.</p>
            )}

            {(vista.categoriasNuevas.length > 0 || vista.proveedoresNuevos.length > 0) && !hayErrores && (
              <p className="rounded-xl bg-tile px-4 py-3 text-xs text-muted">
                {vista.categoriasNuevas.length > 0 && <>Categorías nuevas: <b className="text-ink">{vista.categoriasNuevas.join(', ')}</b>. </>}
                {vista.proveedoresNuevos.length > 0 && <>Proveedores nuevos: <b className="text-ink">{vista.proveedoresNuevos.join(', ')}</b>.</>}
              </p>
            )}

            {vista.filas.length > 0 && (
              <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line text-sm">
                {vista.filas.slice(0, 200).map((f) => (
                  <li key={f.fila} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${f.accion === 'crear' ? 'bg-ok/12 text-ok' : 'bg-accent/12 text-accent'}`}>{f.accion === 'crear' ? 'Nuevo' : 'Actualiza'}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{f.nombre}</span>
                      <span className="tabular shrink-0 text-xs text-muted">{f.codigo ?? 'código automático'}</span>
                    </div>
                    {f.avisos.map((a) => <p key={a} className="mt-1 text-xs text-warn">⚠ {a}</p>)}
                  </li>
                ))}
              </ul>
            )}
            {vista.filas.length > 200 && <p className="text-xs text-muted">Se muestran 200 de {vista.filas.length}.</p>}
          </div>
        )}
      </div>
    </PanelLateral>
  )
}
