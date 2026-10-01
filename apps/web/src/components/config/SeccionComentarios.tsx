import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useAviso } from '../ui/Avisos'
import { api, bajarArchivo, mensajeDe } from '../../api/cliente'
import { fechaHora } from '../../lib/fechas'
import { Bloque } from './Bloque'

interface Comentario { id: number; texto: string; pantalla: string | null; creadoEn: string; usuario: string }

/* Lo que escribieron las vendedoras con el botón «Comentario»: se lee aquí y se puede descargar para revisarlo con calma. */
export function SeccionComentarios() {
  const avisar = useAviso()
  const [lista, setLista] = useState<Comentario[] | null>(null)
  useEffect(() => { api.get<Comentario[]>('/comentarios').then(setLista).catch((e) => { avisar(mensajeDe(e), 'alerta'); setLista([]) }) }, [avisar])

  return (
    <Bloque titulo="Comentarios y sugerencias" descripcion="Lo que se escribe con el botón «Comentario» de arriba. Úsalo para reunir las ideas de la semana de prueba.">
      <Button variante="secundario" className="mb-4" onClick={() => void bajarArchivo('/comentarios/descargar', 'comentarios.txt').catch((e) => avisar(mensajeDe(e), 'alerta'))}>
        <Download className="size-4" /> Descargar todo en un archivo
      </Button>
      {lista === null ? <Loader2 className="size-6 animate-spin text-muted" aria-label="Cargando" /> : lista.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay comentarios.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lista.map((c) => (
            <li key={c.id} className="py-3">
              <p className="text-base">{c.texto}</p>
              <p className="mt-1 text-xs text-muted">{fechaHora(new Date(c.creadoEn))}{c.pantalla && <> · {c.pantalla}</>} · {c.usuario}</p>
            </li>
          ))}
        </ul>
      )}
    </Bloque>
  )
}
