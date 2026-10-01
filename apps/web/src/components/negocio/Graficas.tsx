/* Mini gráficas hechas con SVG puro (livianas, sin librerías). Usan variables del tema. */

/** Línea suave dentro de una tarjeta de cifra. */
export function Sparkline({ datos, className = '' }: { datos: number[]; className?: string }) {
  const w = 120
  const h = 32
  const max = Math.max(...datos)
  const min = Math.min(...datos)
  const rango = max - min || 1
  const pts = datos.map((d, i) => [(i / (datos.length - 1)) * w, h - 3 - ((d - min) / rango) * (h - 6)])
  const ruta = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ruta} />
    </svg>
  )
}

/** Medidor semicircular (por ejemplo, avance de la meta del día). */
export function Medidor({ porcentaje }: { porcentaje: number }) {
  const p = Math.max(0, Math.min(100, porcentaje))
  return (
    <svg viewBox="0 0 160 96" className="w-full" role="img" aria-label={`${p} por ciento de la meta`}>
      <path d="M16 86a64 64 0 0 1 128 0" fill="none" stroke="var(--line)" strokeWidth="14" strokeLinecap="round" />
      <path d="M16 86a64 64 0 0 1 128 0" fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round" pathLength={100} strokeDasharray={`${p} 100`} style={{ transition: 'stroke-dasharray .8s ease' }} />
      <text x="80" y="82" textAnchor="middle" fontSize="30" fill="var(--text)" className="display">
        {p}%
      </text>
    </svg>
  )
}

/** Color según el estado del stock: crítico, bajo o bien (relación stock / stock mínimo). */
export function estadoStock(stock: number, minimo: number): 'bad' | 'warn' | 'ok' {
  if (stock <= minimo * 0.5) return 'bad'
  if (stock <= minimo) return 'warn'
  return 'ok'
}

/** Anillo de stock: se llena según el stock y cambia de color con el estado. */
export function AnilloStock({ stock, minimo, tamano = 'size-9' }: { stock: number; minimo: number; tamano?: string }) {
  const estado = estadoStock(stock, minimo)
  const lleno = Math.min(100, Math.round((stock / (minimo * 3)) * 100)) // 3x el mínimo = anillo completo
  return (
    <svg viewBox="0 0 36 36" className={`${tamano} -rotate-90`} aria-hidden="true">
      <circle cx="18" cy="18" r="14" fill="none" stroke="var(--line)" strokeWidth="5" />
      <circle cx="18" cy="18" r="14" fill="none" stroke={`var(--${estado})`} strokeWidth="5" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(lleno, 4)} 100`} />
    </svg>
  )
}
