import { describe, expect, it } from 'vitest'
import { problemaDeImagen, tamanoReducido } from './imagen'

describe('tamanoReducido', () => {
  it('reduce una foto grande dejando el lado mayor en 800 y conserva la proporción', () => {
    expect(tamanoReducido(4000, 3000)).toEqual({ ancho: 800, alto: 600 })
    expect(tamanoReducido(3000, 4000)).toEqual({ ancho: 600, alto: 800 })
  })
  it('no agranda una imagen pequeña', () => {
    expect(tamanoReducido(300, 200)).toEqual({ ancho: 300, alto: 200 })
    expect(tamanoReducido(800, 800)).toEqual({ ancho: 800, alto: 800 })
  })
  it('una imagen muy alargada nunca queda en 0 píxeles', () => {
    expect(tamanoReducido(10000, 1)).toEqual({ ancho: 800, alto: 1 })
  })
  it('medidas inválidas dan 0', () => {
    expect(tamanoReducido(0, 100)).toEqual({ ancho: 0, alto: 0 })
  })
})

describe('problemaDeImagen', () => {
  it('acepta PNG, JPG y WebP normales', () => {
    expect(problemaDeImagen({ type: 'image/jpeg', size: 2_000_000 })).toBeNull()
    expect(problemaDeImagen({ type: 'image/png', size: 100 })).toBeNull()
    expect(problemaDeImagen({ type: 'image/webp', size: 100 })).toBeNull()
  })
  it('rechaza otros tipos, archivos vacíos y gigantes', () => {
    expect(problemaDeImagen({ type: 'application/pdf', size: 100 })).toMatch(/PNG, JPG o WebP/)
    expect(problemaDeImagen({ type: 'image/gif', size: 100 })).not.toBeNull()
    expect(problemaDeImagen({ type: 'image/png', size: 0 })).toMatch(/vacío/)
    expect(problemaDeImagen({ type: 'image/png', size: 30 * 1024 * 1024 })).toMatch(/demasiado grande/)
  })
})
