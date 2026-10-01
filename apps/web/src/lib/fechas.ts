// Abreviaturas propias: el texto es igual en cualquier navegador (Intl cambia según la versión).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** "30 sept 2026" */
export const fecha = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`

/** "30 sept, 4:52 p. m." */
export function fechaHora(d: Date): string {
  const h = d.getHours()
  const hora12 = h % 12 === 0 ? 12 : h % 12
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${hora12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}
