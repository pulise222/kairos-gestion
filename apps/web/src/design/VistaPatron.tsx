import { useEffect, useRef } from 'react'
import { dibujarPatron } from './patrones'
import type { Patron } from './patrones'

/* Miniatura de un patrón (un solo fotograma, sin animar: así 3 vistas previas no gastan batería). */
export function VistaPatron({ patron }: { patron: Patron }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const dibujar = () => {
      const c = ref.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.globalAlpha = 0.45
      dibujarPatron(patron, ctx, w, h, 3)
    }
    dibujar()
    // Se redibuja si cambia el tema o el color de acento.
    const obs = new MutationObserver(dibujar)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    return () => obs.disconnect()
  }, [patron])

  return <canvas ref={ref} className="h-24 w-full rounded-xl bg-bg" aria-hidden="true" />
}
