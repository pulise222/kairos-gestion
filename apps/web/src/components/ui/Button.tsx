import type { ButtonHTMLAttributes } from 'react'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const estilos: Record<Variante, string> = {
  primario: 'bg-accent text-on-accent hover:brightness-110 shadow-sm',
  secundario: 'border border-line bg-panel text-ink hover:bg-tile',
  fantasma: 'text-muted hover:text-ink hover:bg-tile',
  peligro: 'bg-bad text-white hover:brightness-110',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  /** Área táctil grande para tablet/celular y uso rápido en mostrador. */
  grande?: boolean
}

export function Button({ variante = 'primario', grande, className = '', ...resto }: Props) {
  return (
    <button
      {...resto}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
        grande ? 'h-12 px-6 text-base' : 'h-10 px-5 text-sm'
      } ${estilos[variante]} ${className}`}
    />
  )
}
