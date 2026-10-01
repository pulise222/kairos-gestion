/*
  Error "esperado" de la aplicación (validación, permisos, regla de negocio...).
  El manejador global lo convierte en una respuesta JSON uniforme:
    { "error": { "codigo": "STOCK_INSUFICIENTE", "mensaje": "...", "detalles": ... } }
  El front puede decidir qué mostrar según "codigo" (estable) y no según el texto.
*/
export class ErrorApp extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje)
  }
}

export const noEncontrado = (que: string) => new ErrorApp(404, 'NO_ENCONTRADO', `${que} no existe`)
export const conflicto = (codigo: string, mensaje: string, detalles?: unknown) => new ErrorApp(409, codigo, mensaje, detalles)
export const reglaDeNegocio = (codigo: string, mensaje: string, detalles?: unknown) => new ErrorApp(422, codigo, mensaje, detalles)
