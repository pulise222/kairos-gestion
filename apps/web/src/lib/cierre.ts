/*
  Reglas del cierre del día como funciones PURAS. El servidor calcula lo esperado y guarda el cierre;
  esto solo sirve para mostrar el resultado EN VIVO mientras la persona escribe cuánto dinero contó.
*/
export type EstadoCuadre = 'cuadra' | 'falta' | 'sobra'

export interface Cuadre {
  estado: EstadoCuadre
  /** contado − esperado (0 = cuadra). */
  diferencia: number
  texto: string
}

/** Lo que DEBERÍA haber en la caja: el dinero con el que se abrió + las ventas en efectivo − lo devuelto en efectivo. */
export const efectivoEsperado = (fondoInicial: number, efectivoNeto: number) => fondoInicial + efectivoNeto

export function cuadre(esperado: number, contado: number, formato: (v: number) => string): Cuadre {
  const diferencia = contado - esperado
  if (diferencia === 0) return { estado: 'cuadra', diferencia, texto: '¡Cuadra! Todo está completo.' }
  if (diferencia < 0) return { estado: 'falta', diferencia, texto: `Faltan ${formato(-diferencia)}` }
  return { estado: 'sobra', diferencia, texto: `Sobran ${formato(diferencia)}` }
}

/** Mueve un día «AAAA-MM-DD» hacia atrás o adelante (sin problemas de zona horaria: se calcula en UTC). */
export function sumarDias(dia: string, dias: number): string {
  const f = new Date(`${dia}T00:00:00Z`)
  f.setUTCDate(f.getUTCDate() + dias)
  return f.toISOString().slice(0, 10)
}
