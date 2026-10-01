import { describe, expect, it } from 'vitest'
import { enlaceWhatsApp, resumenProveedor, soloDigitos, textoPedido } from './proveedores'
import { fuerzaClave } from './clave'
import { comprasIniciales } from '../data/semilla'
import { productosIniciales } from '../mock/catalogo'

const AHORA = new Date()
const compras = comprasIniciales()

describe('resumen de un proveedor', () => {
  it('cuenta sus productos activos y los que están bajos', () => {
    const r = resumenProveedor({ id: 1 }, productosIniciales, compras, AHORA) // Distribuciones Andina: bebidas 101 a 104
    expect(r.productos.map((p) => p.codigo)).toEqual(['101', '102', '103', '104'])
    expect(r.bajos.map((p) => p.codigo)).toEqual(['101']) // la gaseosa: 3 ≤ 12
  })

  it('no cuenta productos desactivados', () => {
    const desactivados = productosIniciales.map((p) => (p.id === 101 || p.codigo === '101' ? { ...p, activo: false } : p))
    expect(resumenProveedor({ id: 1 }, desactivados, compras, AHORA).productos).toHaveLength(3)
  })

  it('lista las compras de la más reciente a la más antigua y suma lo comprado en 90 días', () => {
    const r = resumenProveedor({ id: 3 }, productosIniciales, compras, AHORA) // Alimentos del Valle
    expect(r.compras.map((c) => c.id)).toEqual([2])
    expect(r.comprado90d).toBe(30 * 3300 + 12 * 3900)
    expect(r.ultimaCompra).toEqual(compras.find((c) => c.id === 2)!.fecha)
  })

  it('las compras de hace más de 90 días no entran en el total reciente', () => {
    const vieja = { ...compras[0]!, id: 99, proveedorId: 1, fecha: new Date(AHORA.getTime() - 100 * 86_400_000), total: 500_000 }
    const r = resumenProveedor({ id: 1 }, productosIniciales, [...compras, vieja], AHORA)
    expect(r.compras.some((c) => c.id === 99)).toBe(true) // está en el historial
    expect(r.comprado90d).toBe(24 * 1100) // pero no en el total de 90 días
  })

  it('un proveedor sin compras ni productos no rompe nada', () => {
    expect(resumenProveedor({ id: 99 }, productosIniciales, compras, AHORA)).toEqual({ productos: [], bajos: [], compras: [], comprado90d: 0, ultimaCompra: null })
  })
})

describe('mensaje de pedido y enlaces', () => {
  it('arma el pedido con la cantidad sugerida de cada producto', () => {
    const bajos = [{ nombre: 'Gaseosa 1.5 L', stock: 3, minimo: 12 }, { nombre: 'Agua 600 ml', stock: 10, minimo: 24 }]
    expect(textoPedido({ nombre: 'Distribuciones Andina' }, bajos, 'Tienda Don Pepe')).toBe(
      'Hola Distribuciones Andina, soy de Tienda Don Pepe. Necesito para esta semana:\n• 21 × Gaseosa 1.5 L\n• 38 × Agua 600 ml\n¡Gracias!',
    )
  })

  it('sin productos bajos no hay pedido', () => {
    expect(textoPedido({ nombre: 'X' }, [], 'Y')).toBe('')
  })

  it('arma el enlace de WhatsApp para celulares colombianos', () => {
    expect(soloDigitos('300 123-4567')).toBe('3001234567')
    expect(enlaceWhatsApp('300 123 4567')).toBe('https://wa.me/573001234567')
    expect(enlaceWhatsApp('+57 300 123 4567')).toBe('https://wa.me/573001234567')
    expect(enlaceWhatsApp('300 123 4567', 'Hola & gracias')).toBe('https://wa.me/573001234567?text=Hola%20%26%20gracias')
  })

  it('no inventa un enlace si el teléfono no sirve', () => {
    expect(enlaceWhatsApp('')).toBeNull()
    expect(enlaceWhatsApp('123')).toBeNull()
    expect(enlaceWhatsApp('601 234 5678 9')).toBeNull()
  })
})

describe('fuerza de la contraseña', () => {
  it('vacía no puntúa y las comunes se marcan', () => {
    expect(fuerzaClave('')).toEqual({ nivel: 0, texto: '' })
    expect(fuerzaClave('12345678').texto).toMatch(/común/)
    expect(fuerzaClave('Password')).toEqual({ nivel: 0, texto: 'Muy común: elige otra' }) // mayúsculas no la salvan
  })

  it('menos de 8 caracteres nunca pasa de débil, aunque tenga símbolos y mayúsculas', () => {
    expect(fuerzaClave('Ab1!').nivel).toBeLessThanOrEqual(1)
  })

  it('la longitud y la variedad suben el nivel', () => {
    expect(fuerzaClave('abcdefgh').nivel).toBe(1)
    expect(fuerzaClave('abcdefg1').nivel).toBe(2)
    expect(fuerzaClave('Abcdefg1').nivel).toBe(3)
    expect(fuerzaClave('Abcdefgh1234!').nivel).toBe(4)
  })

  it('una frase larga vale más que una clave corta con símbolos', () => {
    expect(fuerzaClave('mi tienda abre a las seis').nivel).toBeGreaterThanOrEqual(fuerzaClave('P@ss1').nivel)
  })
})
