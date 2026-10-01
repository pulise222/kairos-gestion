import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Tema = 'light' | 'dark'

interface TemaCtx {
  tema: Tema
  alternar: () => void
}

const Ctx = createContext<TemaCtx | null>(null)

// El script de index.html ya puso data-theme antes de pintar; aquí solo lo leemos y lo mantenemos.
function temaInicial(): Tema {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    try {
      localStorage.setItem('nivel-tema', tema) // HU-04: recuerda la elección
    } catch {
      /* si el navegador bloquea el almacenamiento, el tema simplemente no se recuerda */
    }
  }, [tema])

  const alternar = useCallback(() => setTema((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useTema() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTema debe usarse dentro de ThemeProvider')
  return c
}
