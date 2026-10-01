/*
  Patrones de fondo generados con código (sin imágenes: livianos, sin derechos de autor y sin internet).
  Cada uno es una función que dibuja un fotograma sobre un <canvas>; al variar "t" (tiempo) se mueve despacio.
*/
export type Patron = 'curvas' | 'puntos' | 'ondas'

export const PATRONES: { id: Patron; nombre: string; descripcion: string }[] = [
  { id: 'curvas', nombre: 'Curvas de nivel', descripcion: 'Líneas topográficas que se deforman despacio.' },
  { id: 'puntos', nombre: 'Malla de puntos', descripcion: 'Una cuadrícula que respira como una ola.' },
  { id: 'ondas', nombre: 'Ondas', descripcion: 'Líneas que ondulan, como un pulso.' },
]

type Ctx = CanvasRenderingContext2D

// Campo suave de valores: suma de senos (barato y continuo). Es la "altura del terreno".
const campo = (x: number, y: number, t: number) =>
  Math.sin(x * 1.3 + t * 0.6) + Math.sin(y * 1.7 - t * 0.5) + Math.sin((x + y) * 0.9 + t * 0.4) + 0.6 * Math.sin(x * 2.1 - y * 1.4 + t * 0.3)

// Aristas de cada celda: 0 arriba, 1 derecha, 2 abajo, 3 izquierda. Índice = esquinas "dentro" (4 bits).
const SEGMENTOS: number[][][] = [
  [], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[0, 3], [2, 1]], [[0, 2]], [[0, 3]],
  [[0, 3]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], [],
]

/** Curvas de nivel con "marching squares": dibuja las líneas donde el campo cruza cada nivel. */
function curvas(ctx: Ctx, w: number, h: number, t: number) {
  const s = 14
  const cols = Math.ceil(w / s) + 1
  const filas = Math.ceil(h / s) + 1
  const v = new Float32Array(cols * filas)
  for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = campo(i * s * 0.045, j * s * 0.045, t)

  ctx.beginPath()
  for (let nivel = -3; nivel <= 3; nivel += 0.5) {
    for (let j = 0; j < filas - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i]!
        const b = v[j * cols + i + 1]!
        const c = v[(j + 1) * cols + i + 1]!
        const d = v[(j + 1) * cols + i]!
        const k = (a > nivel ? 8 : 0) | (b > nivel ? 4 : 0) | (c > nivel ? 2 : 0) | (d > nivel ? 1 : 0)
        if (k === 0 || k === 15) continue
        const x0 = i * s
        const y0 = j * s
        // Punto exacto del cruce sobre cada arista (interpolación lineal)
        const punto = (e: number): [number, number] =>
          e === 0 ? [x0 + (s * (nivel - a)) / (b - a), y0]
          : e === 1 ? [x0 + s, y0 + (s * (nivel - b)) / (c - b)]
          : e === 2 ? [x0 + (s * (nivel - d)) / (c - d), y0 + s]
          : [x0, y0 + (s * (nivel - a)) / (d - a)]
        for (const [e1, e2] of SEGMENTOS[k]!) {
          const p = punto(e1!)
          const q = punto(e2!)
          ctx.moveTo(p[0], p[1])
          ctx.lineTo(q[0], q[1])
        }
      }
    }
  }
  ctx.stroke()
}

/** Malla de puntos: el tamaño y la posición de cada punto siguen una ola suave. */
function puntos(ctx: Ctx, w: number, h: number, t: number) {
  const s = 22
  for (let y = s / 2; y < h + s; y += s) {
    for (let x = s / 2; x < w + s; x += s) {
      const f = campo(x * 0.012, y * 0.012, t)
      const r = 1.1 + ((f + 3) / 6) * 2.4
      ctx.beginPath()
      ctx.arc(x + Math.sin(y * 0.02 + t) * 3, y + Math.cos(x * 0.02 + t * 0.8) * 3, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Ondas: líneas horizontales que ondulan. */
function ondas(ctx: Ctx, w: number, h: number, t: number) {
  for (let y = -20; y < h + 40; y += 15) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x * 0.012 + y * 0.02 + t * 0.8) * 13 + Math.sin(x * 0.027 - t * 0.5) * 6
      if (x) ctx.lineTo(x, yy)
      else ctx.moveTo(x, yy)
    }
    ctx.stroke()
  }
}

const dibujos: Record<Patron, (ctx: Ctx, w: number, h: number, t: number) => void> = { curvas, puntos, ondas }

export const dibujarPatron = (patron: Patron, ctx: Ctx, w: number, h: number, t: number) => dibujos[patron](ctx, w, h, t)
