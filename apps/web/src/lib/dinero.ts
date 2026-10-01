/*
  Dinero SIEMPRE como entero en pesos (sin decimales flotantes): evita errores de redondeo.
  Estas funciones solo FORMATEAN para mostrar; el cálculo real vive en el backend.
*/
const formato = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export const pesos = (valor: number): string => formato.format(Math.round(valor))

/** Versión compacta para espacios pequeños: 1.284.500 → "$1,3 M". */
export const pesosCorto = (valor: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(valor)
