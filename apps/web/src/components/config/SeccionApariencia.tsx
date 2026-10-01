import { Check, ImagePlus, Moon, RotateCcw, Sun } from 'lucide-react'
import { useAjustes } from '../../ajustes/contexto'
import { ACENTOS } from '../../design/acentos'
import { PATRONES } from '../../design/patrones'
import { VistaPatron } from '../../design/VistaPatron'
import { useTema } from '../../theme/ThemeProvider'
import { Button } from '../ui/Button'
import { useAviso } from '../ui/Avisos'
import { Bloque } from './Bloque'

export function SeccionApariencia() {
  const { ajustes, cambiar, restablecerApariencia } = useAjustes()
  const { tema, alternar } = useTema()
  const avisar = useAviso()

  const vistaIntensidad = ajustes.intensidad === 0 ? 'Sin patrón' : `${ajustes.intensidad} %`

  return (
    <div className="space-y-4">
      <Bloque titulo="Tema" descripcion="Se recuerda en este dispositivo. Cada persona puede elegir el suyo.">
        <div className="grid max-w-md grid-cols-2 gap-3" role="radiogroup" aria-label="Tema">
          {([['light', 'Claro · Porcelana', Sun], ['dark', 'Oscuro · Obsidiana y oro', Moon]] as const).map(([id, nombre, Icono]) => (
            <button key={id} role="radio" aria-checked={tema === id} onClick={() => tema !== id && alternar()}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${tema === id ? 'border-accent bg-accent/8 ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
              <Icono className="size-5 shrink-0 text-accent" />
              <span className="text-sm font-medium">{nombre}</span>
              {tema === id && <Check className="ml-auto size-4 text-accent" />}
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Color de acento" descripcion="Es el color de los botones, el elemento activo y las líneas del fondo. El texto sobre él se ajusta solo para que siempre se lea.">
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color de acento">
          {ACENTOS.map((a) => {
            const activo = ajustes.acento === a.id
            return (
              <button key={a.nombre} role="radio" aria-checked={activo} onClick={() => cambiar({ acento: a.id })} title={a.nombre} aria-label={a.nombre}
                className={`group flex w-[4.75rem] flex-col items-center gap-1.5 text-center text-xs leading-tight ${activo ? 'text-ink' : 'text-muted'}`}>
                <span className={`grid size-12 place-items-center rounded-full border-2 transition ${activo ? 'border-ink' : 'border-transparent group-hover:border-line'}`}>
                  <span className="grid size-9 place-items-center rounded-full" style={{ background: a.color ?? 'var(--accent)' }}>
                    {a.color === null ? <span className="text-[10px] font-bold text-on-accent">AUTO</span> : activo && <Check className="size-4 text-white mix-blend-difference" />}
                  </span>
                </span>
                {a.nombre}
              </button>
            )
          })}
        </div>
      </Bloque>

      <Bloque titulo="Fondo" descripcion="Se genera con código (sin imágenes): liviano y funciona sin internet. Mira cómo cambia detrás de esta pantalla.">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Patrón de fondo">
          {PATRONES.map((p) => (
            <button key={p.id} role="radio" aria-checked={ajustes.patron === p.id} onClick={() => cambiar({ patron: p.id })}
              className={`rounded-2xl border p-3 text-left transition ${ajustes.patron === p.id ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
              <VistaPatron patron={p.id} />
              <span className="mt-2 flex items-center justify-between text-sm font-medium">{p.nombre}{ajustes.patron === p.id && <Check className="size-4 text-accent" />}</span>
              <span className="block text-xs text-muted">{p.descripcion}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 max-w-md">
          <label htmlFor="intensidad" className="mb-2 flex items-center justify-between text-sm font-medium text-muted">
            Intensidad <span className="tabular text-ink">{vistaIntensidad}</span>
          </label>
          <input id="intensidad" type="range" min={0} max={100} step={5} value={ajustes.intensidad} onChange={(e) => cambiar({ intensidad: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
          <p className="mt-1 text-xs text-muted">En Venta el fondo siempre es casi plano, para que mande la velocidad y la lectura.</p>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          <ImagePlus className="mt-0.5 size-5 shrink-0" />
          <span><b className="text-ink">Foto o logo propio como fondo del acceso:</b> se activa con el sistema real, cuando haya dónde guardar el archivo.</span>
        </div>
      </Bloque>

      <div>
        <Button variante="secundario" onClick={() => { restablecerApariencia(); avisar('Apariencia restablecida.', 'info') }}><RotateCcw className="size-4" /> Restablecer apariencia</Button>
      </div>
    </div>
  )
}
