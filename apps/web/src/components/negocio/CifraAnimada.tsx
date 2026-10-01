import { useEffect, useRef, useState } from 'react'
import { pesos } from '../../lib/dinero'

/* Cuenta desde el valor anterior hasta el nuevo (firma de identidad: el total "se suma").
   Si el usuario pidió menos movimiento, muestra el valor final directamente. */
export function CifraAnimada({ valor, formato = pesos }: { valor: number; formato?: (n: number) => string }) {
  const [mostrado, setMostrado] = useState(valor)
  const desde = useRef(valor)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMostrado(valor)
      desde.current = valor
      return
    }
    const inicio = desde.current
    const t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min((t - t0) / 600, 1)
      const suave = 1 - Math.pow(1 - p, 3) // desaceleración suave al final
      const actual = Math.round(inicio + (valor - inicio) * suave)
      setMostrado(actual)
      desde.current = actual
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor])

  return <span className="tabular">{formato(mostrado)}</span>
}
