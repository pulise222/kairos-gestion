import { useEffect, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Dialogo } from '../ui/Dialogo'
import { useAviso } from '../ui/Avisos'
import { api, mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'

const NOMBRES: Record<string, string> = { venta: 'Venta', ventas: 'Ventas', cierre: 'Cierre del día', productos: 'Productos', inventario: 'Inventario', proveedores: 'Proveedores', panel: 'Panel', configuracion: 'Configuración' }

/* «Enviar comentario»: para que quien usa el sistema deje una sugerencia o un problema en el momento, sin acordarse después. */
export function EnviarComentario({ ruta, className = '' }: { ruta: string; className?: string }) {
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const pantalla = NOMBRES[ruta.replace('/', '')] ?? ''

  useEffect(() => { if (abierto) setTexto('') }, [abierto])

  const enviar = () => ejecutar(async () => {
    if (texto.trim().length < 3) return avisar('Escribe tu comentario.', 'alerta')
    try {
      await api.post('/comentarios', { texto: texto.trim(), ...(pantalla ? { pantalla } : {}) })
      avisar('¡Gracias! Tu comentario quedó guardado.', 'ok')
      setAbierto(false)
    } catch (e) {
      avisar(mensajeDe(e), 'alerta')
    }
  })

  return (
    <>
      <button onClick={() => setAbierto(true)} className={`glass flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink ${className}`} aria-label="Enviar un comentario o sugerencia" title="Enviar comentario">
        <MessageSquarePlus className="size-5 text-accent" aria-hidden="true" /> <span className="hidden lg:inline">Comentario</span>
      </button>
      <Dialogo abierto={abierto} onCerrar={() => !enviando && setAbierto(false)} descartable={!enviando}>
        <h2 className="display text-3xl">Tu comentario</h2>
        <p className="mt-1 text-sm text-muted">¿Algo no se entiende, no funciona o lo harías de otra forma? Cuéntanos.{pantalla && <> Estás en <b className="text-ink">{pantalla}</b>.</>}</p>
        <textarea
          autoFocus rows={5} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Comentario"
          placeholder="Escribe aquí…" className="mt-4 w-full resize-y rounded-xl border border-line bg-bg/70 px-4 py-3 text-base outline-none focus:border-accent"
        />
        <div className="mt-5 flex gap-2">
          <Button variante="secundario" className="flex-1" onClick={() => setAbierto(false)} disabled={enviando}>Cancelar</Button>
          <Button className="flex-1" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</Button>
        </div>
      </Dialogo>
    </>
  )
}
