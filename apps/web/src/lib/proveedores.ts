import type { Compra } from '../data/contexto'
import { sugerirCantidad } from './inventario'
import type { Producto, Proveedor } from '../mock/catalogo'

const DIA = 86_400_000

export interface ResumenProveedor {
  /** Productos activos que le compras a este proveedor. */
  productos: Producto[]
  /** De esos, los que están en el mínimo o por debajo (conviene pedirle). */
  bajos: Producto[]
  /** Compras hechas, de la más reciente a la más antigua. */
  compras: Compra[]
  /** Lo comprado en los últimos 90 días. */
  comprado90d: number
  ultimaCompra: Date | null
}

/** Todo lo que la pantalla de Proveedores necesita saber de uno, calculado a partir del catálogo y las compras. */
export function resumenProveedor(proveedor: Pick<Proveedor, 'id'>, productos: Producto[], compras: Compra[], ahora: Date): ResumenProveedor {
  const suyos = productos.filter((p) => p.activo && p.proveedorId === proveedor.id)
  const propias = compras.filter((c) => c.proveedorId === proveedor.id).sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
  const limite = ahora.getTime() - 90 * DIA
  return {
    productos: suyos,
    bajos: suyos.filter((p) => p.stock <= p.minimo),
    compras: propias,
    comprado90d: propias.filter((c) => c.fecha.getTime() >= limite).reduce((s, c) => s + c.total, 0),
    ultimaCompra: propias[0]?.fecha ?? null,
  }
}

/**
 * Texto listo para pegar en WhatsApp o un correo, con lo que falta pedirle al proveedor:
 *   Hola, necesito para esta semana:
 *   • 21 × Gaseosa 1.5 L
 * Cada producto lleva la cantidad sugerida (llegar al doble del mínimo).
 */
export function textoPedido(proveedor: Pick<Proveedor, 'nombre'>, bajos: Pick<Producto, 'nombre' | 'stock' | 'minimo'>[], negocio: string): string {
  if (bajos.length === 0) return ''
  const lineas = bajos.map((p) => `• ${sugerirCantidad(p)} × ${p.nombre}`)
  return `Hola ${proveedor.nombre}, soy de ${negocio}. Necesito para esta semana:\n${lineas.join('\n')}\n¡Gracias!`
}

/** Deja solo los dígitos de un teléfono (para armar enlaces tel: y wa.me). "300 123 4567" → "3001234567". */
export const soloDigitos = (t: string) => t.replace(/\D/g, '')

/** Enlace de WhatsApp para un teléfono colombiano de 10 dígitos (antepone 57). Devuelve null si no parece un celular. */
export function enlaceWhatsApp(telefono: string, mensaje?: string): string | null {
  const d = soloDigitos(telefono)
  const numero = d.length === 10 ? `57${d}` : d.length === 12 && d.startsWith('57') ? d : null
  if (!numero) return null
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`
}
