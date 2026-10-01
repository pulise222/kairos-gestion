import type { ReactNode } from 'react'
import { MODO_DEMO } from '../config'
import { CatalogoApi } from './CatalogoApi'
import { CatalogoDemo } from './CatalogoDemo'

/** Elige la implementación del catálogo según el modo de la aplicación (demo en memoria o API real). */
export function CatalogoProvider({ children }: { children: ReactNode }) {
  return MODO_DEMO ? <CatalogoDemo>{children}</CatalogoDemo> : <CatalogoApi>{children}</CatalogoApi>
}
