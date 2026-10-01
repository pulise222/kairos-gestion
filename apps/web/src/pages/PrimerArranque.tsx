import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, ImagePlus, Moon, Plus, Sun, X } from 'lucide-react'
import { ErrorApi, api, mensajeDe } from '../api/cliente'
import { useAjustes } from '../ajustes/contexto'
import { haciaServidor } from '../ajustes/servidor'
import { MODO_DEMO } from '../config'
import { ACENTOS } from '../design/acentos'
import { Fondo } from '../design/Fondo'
import { PATRONES } from '../design/patrones'
import { VistaPatron } from '../design/VistaPatron'
import { Button } from '../components/ui/Button'
import { Campo } from '../components/ui/Campo'
import { Logo } from '../components/ui/Logo'
import { useCatalogo } from '../data/contexto'
import { fuerzaClave } from '../lib/clave'
import { contrasena, nombreUsuario } from '../lib/usuarios'
import { CATEGORIAS_SUGERIDAS, COLORES_PROPIOS, PREDETERMINADAS } from '../mock/sugerencias'
import { useSesion } from '../sesion/contexto'
import type { UsuarioSesion } from '../sesion/contexto'
import { useTema } from '../theme/ThemeProvider'
import { useAviso } from '../components/ui/Avisos'

const TITULOS = ['Crea tu cuenta de dueño', 'Cuéntanos de tu negocio', 'Tus categorías', 'Hazlo tuyo'] as const
const SUBTITULOS = [
  'Con esta cuenta administras todo. No hay contraseñas por defecto: la eliges tú.',
  'Estos datos aparecen en el acceso, el Panel y el recibo. Puedes cambiarlos después.',
  'Agrupan tus productos. Elige las que usas; luego puedes crear más.',
  'Elige cómo se ve. Mira cómo cambia el fondo detrás de esta tarjeta.',
]

const esquemaCuenta = z
  .object({ nombre: z.string().trim().min(2, 'Escribe tu nombre'), usuario: nombreUsuario, clave: contrasena, confirmar: z.string() })
  .refine((d) => d.clave === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] })
const esquemaNegocio = z.object({ nombre: z.string().trim().min(2, 'Escribe el nombre del negocio').max(80), nit: z.string().max(30), telefono: z.string().max(30) })

type Errores = Record<string, string | undefined>
const erroresDe = (e: z.ZodError): Errores => Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]))

const COLORES_FUERZA = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-ok', 'bg-ok'] as const

/* Primer arranque (se ve una sola vez, al instalar). Sin contraseñas por defecto: el dueño crea la suya. */
export function PrimerArranque() {
  const navegar = useNavigate()
  const { tema, alternar } = useTema()
  const { ajustes, cambiar, usuarios, crearUsuario } = useAjustes()
  const { crearCategorias, refrescar } = useCatalogo()
  const { estado, necesitaSetup, iniciarConToken } = useSesion()
  const avisar = useAviso()
  const enCurso = useRef(false) // una vez que empieza a guardar, no se redirige aunque cambie la sesión
  const [enviando, setEnviando] = useState(false)

  const [paso, setPaso] = useState(0)
  const [terminado, setTerminado] = useState(false)
  const [errores, setErrores] = useState<Errores>({})

  const [cuenta, setCuenta] = useState({ nombre: '', usuario: '', clave: '', confirmar: '' })
  const [ver, setVer] = useState(false)
  const [negocio, setNegocio] = useState({ nombre: '', nit: '', telefono: '' })
  const [elegidas, setElegidas] = useState<string[]>(PREDETERMINADAS)
  const [propias, setPropias] = useState<string[]>([])
  const [nueva, setNueva] = useState('')

  const fuerza = fuerzaClave(cuenta.clave)
  const todas = [...elegidas, ...propias]

  const alternarCategoria = (n: string) => setElegidas((e) => (e.includes(n) ? e.filter((x) => x !== n) : [...e, n]))
  const agregarPropia = () => {
    const n = nueva.trim()
    if (!n) return
    const existe = [...CATEGORIAS_SUGERIDAS.map((c) => c.nombre), ...propias].some((x) => x.toLowerCase() === n.toLowerCase())
    if (existe) {
      // Si ya existe entre las sugeridas, simplemente se marca.
      const sug = CATEGORIAS_SUGERIDAS.find((c) => c.nombre.toLowerCase() === n.toLowerCase())
      if (sug && !elegidas.includes(sug.nombre)) setElegidas((e) => [...e, sug.nombre])
    } else {
      setPropias((p) => [...p, n])
    }
    setNueva('')
  }

  const validar = (): boolean => {
    let r: z.ZodSafeParseResult<unknown>
    if (paso === 0) r = esquemaCuenta.safeParse(cuenta)
    else if (paso === 1) r = esquemaNegocio.safeParse(negocio)
    else if (paso === 2) r = todas.length > 0 ? { success: true, data: null } : { success: false, error: new z.ZodError([{ code: 'custom', path: ['categorias'], message: 'Elige al menos una categoría' }]) }
    else return true
    setErrores(r.success ? {} : erroresDe(r.error))
    return r.success
  }

  const siguiente = (e?: FormEvent) => {
    e?.preventDefault()
    if (!validar()) return
    if (paso < 3) return setPaso(paso + 1)
    void terminar()
  }

  const terminar = async () => {
    if (enCurso.current) return
    enCurso.current = true
    setEnviando(true)
    const categoriasElegidas = [
      ...elegidas.map((n) => ({ nombre: n, color: CATEGORIAS_SUGERIDAS.find((c) => c.nombre === n)?.color ?? '#b8502a' })),
      ...propias.map((n, i) => ({ nombre: n, color: COLORES_PROPIOS[i % COLORES_PROPIOS.length]! })),
    ]
    const u = cuenta.usuario.trim().toLowerCase()
    try {
      if (MODO_DEMO) {
        // Demostración: se aplica sobre los datos de ejemplo en memoria.
        cambiar({ nombreNegocio: negocio.nombre.trim(), nit: negocio.nit.trim(), telefono: negocio.telefono.trim() })
        await crearCategorias(categoriasElegidas)
        if (!usuarios.some((x) => x.usuario === u)) await crearUsuario({ nombre: cuenta.nombre.trim(), usuario: u, rol: 'DUENO', contrasena: cuenta.clave })
      } else {
        // Sistema real: 1) el servidor crea al dueño (solo funciona mientras no exista ningún usuario) y devuelve su sesión.
        const r = await api.post<{ token: string; usuario: UsuarioSesion }>('/setup', { nombre: cuenta.nombre.trim(), usuario: u, contrasena: cuenta.clave, nombreNegocio: negocio.nombre.trim() })
        iniciarConToken(r.token, r.usuario)
        // 2) Con la sesión ya abierta se guardan el resto de ajustes y las categorías.
        await api.put('/configuracion', haciaServidor({ nit: negocio.nit.trim(), telefono: negocio.telefono.trim(), patron: ajustes.patron, acento: ajustes.acento }))
        for (const c of categoriasElegidas) await api.post('/categorias', c)
        await refrescar()
      }
      setTerminado(true)
    } catch (e) {
      enCurso.current = false
      if (e instanceof ErrorApi && e.codigo === 'SETUP_YA_HECHO') {
        avisar('Este sistema ya fue configurado. Inicia sesión.', 'alerta')
        navegar('/')
      } else {
        avisar(mensajeDe(e), 'alerta')
      }
    } finally {
      setEnviando(false)
    }
  }

  // En el sistema real el asistente es de UNA sola vez: si ya hay dueño, se va al acceso (o a la app si hay sesión).
  if (!MODO_DEMO && !enCurso.current && !terminado && (estado === 'activa' || (estado === 'anonima' && !necesitaSetup))) return <Navigate to={estado === 'activa' ? '/panel' : '/'} replace />

  return (
    <main className="grid min-h-dvh place-items-center px-4 pb-10 pt-20">
      <Fondo intensidad={0.24} />

      <button onClick={alternar} className="glass absolute right-4 top-4 grid size-11 place-items-center rounded-full text-ink" aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
        {tema === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>

      <div className="glass w-full max-w-lg rounded-3xl p-6 sm:p-8">
        {terminado ? (
          <div className="text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-ok/15 text-ok"><Check className="size-9" /></div>
            <h1 className="display mt-4 text-4xl">¡Todo listo, {cuenta.nombre.trim().split(' ')[0]}!</h1>
            <p className="mt-1 text-sm text-muted">{negocio.nombre.trim()} ya puede empezar a usar Nivel.</p>
            <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
              {[`Cuenta de dueño «${cuenta.usuario.trim().toLowerCase()}» creada`, `${todas.length} ${todas.length === 1 ? 'categoría' : 'categorías'} lista${todas.length === 1 ? '' : 's'}`, 'Apariencia guardada'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-ok" /> {t}</li>
              ))}
            </ul>
            <p className="mx-auto mt-5 max-w-xs text-xs text-muted">Siguiente: carga tus productos (uno a uno o desde Excel) y haz una venta de prueba.</p>
            <Button grande className="mt-6 w-full" autoFocus onClick={() => navegar('/panel')}>Entrar al Panel</Button>
          </div>
        ) : (
          <form onSubmit={siguiente} noValidate>
            <div className="flex items-center gap-3">
              <Logo className="size-9 text-accent" />
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Paso {paso + 1} de 4</p>
                <div className="mt-1.5 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={paso + 1} aria-label="Progreso">
                  {TITULOS.map((t, i) => <span key={t} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= paso ? 'bg-accent' : 'bg-line'}`} />)}
                </div>
              </div>
            </div>

            <h1 className="display mt-6 text-4xl">{TITULOS[paso]}</h1>
            <p className="mt-1 text-sm text-muted">{SUBTITULOS[paso]}</p>

            <div className="mt-6 space-y-4">
              {paso === 0 && (
                <>
                  <Campo etiqueta="Tu nombre" autoFocus autoComplete="name" value={cuenta.nombre} onChange={(e) => setCuenta({ ...cuenta, nombre: e.target.value })} error={errores.nombre} />
                  <Campo etiqueta="Usuario para entrar" autoComplete="username" placeholder="ej. juan" value={cuenta.usuario} onChange={(e) => setCuenta({ ...cuenta, usuario: e.target.value })} error={errores.usuario} />
                  <div>
                    <Campo
                      etiqueta="Contraseña" type={ver ? 'text' : 'password'} autoComplete="new-password"
                      value={cuenta.clave} onChange={(e) => setCuenta({ ...cuenta, clave: e.target.value })} error={errores.clave}
                      derecha={<button type="button" onClick={() => setVer((v) => !v)} className="grid size-9 place-items-center rounded-full text-muted hover:text-ink" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>}
                    />
                    {cuenta.clave && (
                      <div className="mt-2" aria-live="polite">
                        <div className="flex gap-1">{[1, 2, 3, 4].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${fuerza.nivel >= n ? COLORES_FUERZA[fuerza.nivel] : 'bg-line'}`} />)}</div>
                        <p className="mt-1 text-xs text-muted">Seguridad: <b className="text-ink">{fuerza.texto}</b>. Una frase larga es mejor que una clave corta con símbolos.</p>
                      </div>
                    )}
                  </div>
                  <Campo etiqueta="Repite la contraseña" type={ver ? 'text' : 'password'} autoComplete="new-password" value={cuenta.confirmar} onChange={(e) => setCuenta({ ...cuenta, confirmar: e.target.value })} error={errores.confirmar} />
                </>
              )}

              {paso === 1 && (
                <>
                  <Campo etiqueta="Nombre del negocio" autoFocus placeholder="Ej. Servicios Kairos" value={negocio.nombre} onChange={(e) => setNegocio({ ...negocio, nombre: e.target.value })} error={errores.nombre} maxLength={80} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="NIT o documento (opcional)" value={negocio.nit} onChange={(e) => setNegocio({ ...negocio, nit: e.target.value })} maxLength={30} />
                    <Campo etiqueta="Teléfono (opcional)" inputMode="tel" value={negocio.telefono} onChange={(e) => setNegocio({ ...negocio, telefono: e.target.value })} maxLength={30} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-tile px-4 py-3 text-sm"><span>Moneda: <b>Peso colombiano (COP)</b></span><span className="text-xs text-muted">sin decimales</span></div>
                  <div className="flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted"><ImagePlus className="mt-0.5 size-5 shrink-0" /><span><b className="text-ink">Logo del negocio (opcional):</b> se activa con el sistema real. Mientras tanto se usa el logo de Nivel.</span></div>
                </>
              )}

              {paso === 2 && (
                <>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías sugeridas">
                    {CATEGORIAS_SUGERIDAS.map((c) => {
                      const on = elegidas.includes(c.nombre)
                      return (
                        <button key={c.nombre} type="button" onClick={() => alternarCategoria(c.nombre)} aria-pressed={on}
                          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${on ? 'border-accent bg-accent/12 text-ink' : 'border-line text-muted hover:text-ink'}`}>
                          <span className="size-2.5 rounded-full" style={{ background: c.color }} /> {c.nombre} {on && <Check className="size-3.5 text-accent" />}
                        </button>
                      )
                    })}
                    {propias.map((n, i) => (
                      <span key={n} className="flex items-center gap-2 rounded-full border border-accent bg-accent/12 py-2 pl-4 pr-2 text-sm font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: COLORES_PROPIOS[i % COLORES_PROPIOS.length] }} /> {n}
                        <button type="button" onClick={() => setPropias((p) => p.filter((x) => x !== n))} className="grid size-5 place-items-center rounded-full hover:bg-line" aria-label={`Quitar ${n}`}><X className="size-3.5" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarPropia() } }} maxLength={40} placeholder="Otra categoría…" aria-label="Escribe otra categoría"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
                    <Button type="button" variante="secundario" onClick={agregarPropia} disabled={!nueva.trim()}><Plus className="size-4" /> Agregar</Button>
                  </div>
                  <p className={`text-sm ${errores.categorias && todas.length === 0 ? 'text-bad' : 'text-muted'}`} aria-live="polite">{errores.categorias && todas.length === 0 ? errores.categorias : `${todas.length} ${todas.length === 1 ? 'categoría elegida' : 'categorías elegidas'}`}</p>
                </>
              )}

              {paso === 3 && (
                <>
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tema">
                    {([['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]] as const).map(([id, nombre, Icono]) => (
                      <button key={id} type="button" role="radio" aria-checked={tema === id} onClick={() => tema !== id && alternar()}
                        className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-medium transition ${tema === id ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
                        <Icono className="size-5 text-accent" /> {nombre} {tema === id && <Check className="ml-auto size-4 text-accent" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de acento">
                    {ACENTOS.map((a) => (
                      <button key={a.nombre} type="button" role="radio" aria-checked={ajustes.acento === a.id} onClick={() => cambiar({ acento: a.id })} title={a.nombre} aria-label={a.nombre}
                        className={`grid size-11 place-items-center rounded-full border-2 transition ${ajustes.acento === a.id ? 'border-ink' : 'border-transparent hover:border-line'}`}>
                        <span className="grid size-8 place-items-center rounded-full" style={{ background: a.color ?? 'var(--accent)' }}>{a.color === null && <span className="text-[9px] font-bold text-on-accent">AUTO</span>}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Patrón de fondo">
                    {PATRONES.map((p) => (
                      <button key={p.id} type="button" role="radio" aria-checked={ajustes.patron === p.id} onClick={() => cambiar({ patron: p.id })}
                        className={`rounded-xl border p-2 text-center text-xs font-medium transition ${ajustes.patron === p.id ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-accent/50'}`}>
                        <VistaPatron patron={p.id} /><span className="mt-1.5 block">{p.nombre}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 flex gap-2">
              {paso > 0 && <Button type="button" variante="secundario" onClick={() => { setErrores({}); setPaso(paso - 1) }}><ArrowLeft className="size-4" /> Atrás</Button>}
              <Button type="submit" grande className="flex-1" disabled={enviando}>{paso < 3 ? <>Siguiente <ArrowRight className="size-5" /></> : enviando ? 'Guardando…' : <><Check className="size-5" /> Terminar</>}</Button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
