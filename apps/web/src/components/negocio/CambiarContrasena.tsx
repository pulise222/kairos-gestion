import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Campo } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { useAviso } from '../ui/Avisos'
import { ErrorApi, api, mensajeDe } from '../../api/cliente'
import { MODO_DEMO } from '../../config'
import { fuerzaClave } from '../../lib/clave'
import { useEnvioUnico } from '../../lib/envio'

const COLORES = ['bg-bad', 'bg-bad', 'bg-warn', 'bg-ok', 'bg-ok'] as const

/* «Mi cuenta»: cada persona cambia su PROPIA contraseña (pide la actual, por si dejaron la sesión abierta). */
export function CambiarContrasena({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const avisar = useAviso()
  const { enviando, ejecutar } = useEnvioUnico()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [errores, setErrores] = useState<{ actual?: string; nueva?: string; repetir?: string }>({})

  useEffect(() => { if (abierto) { setActual(''); setNueva(''); setRepetir(''); setErrores({}) } }, [abierto])

  const fuerza = fuerzaClave(nueva)

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    const err: typeof errores = {}
    if (!actual) err.actual = 'Escribe tu contraseña actual'
    if (nueva.length < 8) err.nueva = 'Debe tener al menos 8 caracteres'
    else if (nueva === actual) err.nueva = 'La nueva debe ser distinta de la actual'
    if (repetir !== nueva) err.repetir = 'No coincide con la nueva'
    setErrores(err)
    if (Object.keys(err).length) return
    if (MODO_DEMO) { avisar('En la demo no se guarda nada: aquí solo ves cómo funciona.', 'info'); onCerrar(); return }
    void ejecutar(async () => {
      try {
        await api.patch('/auth/contrasena', { actual, nueva })
        avisar('Contraseña cambiada. Úsala la próxima vez que entres.', 'ok')
        onCerrar()
      } catch (e2) {
        if (e2 instanceof ErrorApi && e2.codigo === 'CONTRASENA_ACTUAL_INCORRECTA') setErrores({ actual: e2.message })
        else avisar(mensajeDe(e2), 'alerta')
      }
    })
  }

  return (
    <Dialogo abierto={abierto} onCerrar={() => !enviando && onCerrar()} descartable={!enviando}>
      <form onSubmit={guardar} noValidate className="space-y-4">
        <div>
          <h2 className="display text-3xl">Cambiar mi contraseña</h2>
          <p className="mt-1 text-sm text-muted">Elige una frase larga que recuerdes: es mejor que una clave corta con símbolos.</p>
        </div>
        <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" autoFocus value={actual} onChange={(e) => setActual(e.target.value)} error={errores.actual} />
        <div>
          <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} error={errores.nueva} />
          {nueva && (
            <div className="mt-2" aria-live="polite">
              <div className="flex gap-1">{[1, 2, 3, 4].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${fuerza.nivel >= n ? COLORES[fuerza.nivel] : 'bg-line'}`} />)}</div>
              <p className="mt-1 text-xs text-muted">{fuerza.texto}</p>
            </div>
          )}
        </div>
        <Campo etiqueta="Repite la contraseña nueva" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} error={errores.repetir} />
        <div className="flex gap-2 pt-2">
          <Button type="button" variante="secundario" className="flex-1" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</Button>
        </div>
      </form>
    </Dialogo>
  )
}
