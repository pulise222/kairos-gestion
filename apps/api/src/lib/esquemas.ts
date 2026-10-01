import { z } from 'zod'

// Límites pensados para pesos colombianos y para no desbordar el INT de 32 bits de PostgreSQL.
export const MAX_DINERO = 100_000_000
export const MAX_CANTIDAD = 100_000

export const dinero = z.number().int('Debe ser un número entero de pesos').min(0, 'No puede ser negativo').max(MAX_DINERO, 'Valor demasiado grande')
export const cantidadPositiva = z.number().int('Debe ser un número entero').min(1, 'Debe ser al menos 1').max(MAX_CANTIDAD, 'Cantidad demasiado grande')
export const id = z.coerce.number().int().positive()
export const texto = (max = 120) => z.string().trim().min(1, 'No puede estar vacío').max(max)
export const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Debe ser un color como #b8502a')
