import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

/* Avisos propios (toasts): reemplazan a alert() del navegador. Se leen con lector de pantalla (aria-live). */
type Tipo = 'info' | 'ok' | 'alerta'
interface Aviso { id: number; texto: string; tipo: Tipo }

const Ctx = createContext<((texto: string, tipo?: Tipo) => void) | null>(null)
let contador = 0

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const avisar = useCallback((texto: string, tipo: Tipo = 'info') => {
    const id = ++contador
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]) // máximo 3 a la vez
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3500)
  }, [])
  const valor = useMemo(() => avisar, [avisar])

  const Icono = { info: Info, ok: CheckCircle2, alerta: AlertTriangle }
  const color = { info: 'text-accent', ok: 'text-ok', alerta: 'text-warn' }

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {avisos.map(({ id, texto, tipo }) => {
          const I = Icono[tipo]
          return (
            <div key={id} className="aviso glass flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm text-ink">
              <I className={`size-5 shrink-0 ${color[tipo]}`} /> {texto}
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useAviso() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAviso debe usarse dentro de AvisosProvider')
  return c
}
