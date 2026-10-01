import { useCallback, useRef, useState } from 'react'

/**
 * Clave única para un intento de operación (se manda como "Idempotency-Key").
 * NO usa crypto.randomUUID(): ese método solo existe en páginas seguras (HTTPS o localhost), y el sistema se
 * abre por HTTP desde la tablet o el celular dentro de la red del local. getRandomValues sí funciona en ambos casos.
 */
export function nuevaClave(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Evita que una acción se ejecute dos veces a la vez (doble clic, Enter repetido).
 * El bloqueo es una REFERENCIA, no un estado de React: el estado se actualiza en el siguiente repintado y un
 * segundo clic en el mismo instante todavía vería "no estoy enviando". Una referencia cambia al instante.
 * `enviando` (estado) sirve solo para mostrar "Guardando…" y desactivar el botón.
 */
export function useEnvioUnico() {
  const ocupado = useRef(false)
  const [enviando, setEnviando] = useState(false)

  const ejecutar = useCallback(async <T,>(accion: () => Promise<T>): Promise<T | undefined> => {
    if (ocupado.current) return undefined
    ocupado.current = true
    setEnviando(true)
    try {
      return await accion()
    } finally {
      ocupado.current = false
      setEnviando(false)
    }
  }, [])

  return { enviando, ejecutar }
}

/**
 * Qué clave usar para enviar una venta. Regla:
 *  - Si el intento anterior terminó con un corte de red (no sabemos si el servidor llegó a registrarla) y el contenido
 *    es EXACTAMENTE el mismo, se reutiliza la clave: si la venta sí se registró, el servidor responde con ella.
 *  - En cualquier otro caso se usa una clave nueva (si el cajero cambió el carrito, es otra venta).
 */
export interface IntentoVenta {
  clave: string
  huella: string
  ambiguo: boolean
}

export function claveParaIntento(anterior: IntentoVenta | null, huella: string): IntentoVenta {
  if (anterior && anterior.ambiguo && anterior.huella === huella) return anterior
  return { clave: nuevaClave(), huella, ambiguo: false }
}
