import { useEffect, useRef } from 'react'
import { useAjustes } from '../ajustes/contexto'
import { dibujarPatron } from './patrones'

interface Props {
  /** Opacidad BASE de las líneas según la pantalla. Login: más visible; Panel: suave; Venta: casi plano. */
  intensidad?: number
  /** Manchas de color difusas detrás (le dan profundidad al glass). */
  orbes?: boolean
}

/*
  Fondo generado con código. El patrón (curvas, puntos u ondas) y la intensidad general los elige el
  dueño en Configuración → Apariencia; cada pantalla aporta su opacidad base y el ajuste la escala
  (50 % = tal cual, 0 % = sin patrón, 100 % = el doble). Toma el color de acento del tema o del cliente.
*/
export function Fondo({ intensidad = 0.14, orbes = true }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { ajustes } = useAjustes()
  const factor = ajustes.intensidad / 50
  const alfa = Math.min(intensidad * factor, 0.6)
  const patron = ajustes.patron

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let ultimo = 0

    const pintar = (ahora: number) => {
      // ~30 fps: suficiente para un movimiento lento y ahorra batería en tablet/celular.
      if (ahora - ultimo >= 33 || sinMovimiento) {
        ultimo = ahora
        const dpr = Math.min(devicePixelRatio || 1, 2)
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (canvas.width !== Math.round(w * dpr)) {
          canvas.width = Math.round(w * dpr)
          canvas.height = Math.round(h * dpr)
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        if (alfa > 0) {
          const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
          ctx.strokeStyle = color
          ctx.fillStyle = color
          // Sobre fondo claro las líneas del mismo color se pierden: se refuerzan para que el patrón se note.
          const claro = document.documentElement.dataset.theme !== 'dark'
          ctx.globalAlpha = Math.min(alfa * (claro ? 2.4 : 1), 0.6)
          ctx.lineWidth = 1
          dibujarPatron(patron, ctx, w, h, ahora / 2400)
        }
      }
      if (!sinMovimiento) raf = requestAnimationFrame(pintar)
    }

    raf = requestAnimationFrame(pintar)
    // Repinta al cambiar de tema o de color de acento cuando no hay animación.
    const obs = new MutationObserver(() => sinMovimiento && requestAnimationFrame(pintar))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] })
    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
    }
  }, [alfa, patron])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg" aria-hidden="true">
      <canvas ref={ref} className="absolute inset-0 size-full" />
      {orbes && (
        <>
          <div className="orbe absolute -bottom-24 -left-16 size-80 rounded-full bg-accent opacity-25 blur-[60px]" />
          <div className="orbe orbe-2 absolute -top-20 right-16 size-72 rounded-full bg-accent opacity-20 blur-[60px]" />
        </>
      )}
    </div>
  )
}
