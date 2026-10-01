import { describe, expect, it } from 'vitest'
import { claveParaIntento, nuevaClave } from './envio'

describe('clave de cada intento de venta', () => {
  it('genera claves únicas, de 32 caracteres hexadecimales y aceptadas por el servidor', () => {
    const claves = new Set(Array.from({ length: 200 }, nuevaClave))
    expect(claves.size).toBe(200)
    for (const c of claves) expect(c).toMatch(/^[0-9a-f]{32}$/) // el servidor pide 8 a 64 letras, números, "-" o "_"
  })

  it('un intento nuevo siempre empieza con su propia clave', () => {
    const a = claveParaIntento(null, 'carrito-1')
    expect(a.ambiguo).toBe(false)
    expect(claveParaIntento(a, 'carrito-1').clave).not.toBe(a.clave) // el anterior NO quedó en duda: es otra venta
  })

  it('tras un corte de red con el MISMO carrito, se reutiliza la clave (el servidor decidirá si ya estaba registrada)', () => {
    const primero = { ...claveParaIntento(null, 'carrito-1'), ambiguo: true }
    expect(claveParaIntento(primero, 'carrito-1').clave).toBe(primero.clave)
  })

  it('tras un corte de red pero con el carrito CAMBIADO, es otra venta y lleva otra clave', () => {
    const primero = { ...claveParaIntento(null, 'carrito-1'), ambiguo: true }
    expect(claveParaIntento(primero, 'carrito-2').clave).not.toBe(primero.clave)
  })
})
