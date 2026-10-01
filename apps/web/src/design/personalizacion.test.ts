import { describe, expect, it } from 'vitest'
import { cssDePersonalizacion, logoValido } from './personalizacion'

describe('cssDePersonalizacion', () => {
  it('convierte la paleta en variables: claro en :root y oscuro en el tema oscuro', () => {
    const css = cssDePersonalizacion({ claro: { bg: '#f0e6d2', accent: '#2f6f4f' }, oscuro: { accent: '#7fd1a0' } })
    expect(css).toBe(":root{--bg:#f0e6d2;--accent:#2f6f4f}\n:root[data-theme='dark']{--accent:#7fd1a0}")
  })
  it('sin paleta no genera nada', () => {
    expect(cssDePersonalizacion({})).toBe('')
    expect(cssDePersonalizacion({ lema: 'hola' })).toBe('')
  })
  it('SEGURIDAD: ignora colores inválidos y claves que no son de la paleta', () => {
    const css = cssDePersonalizacion({ claro: { bg: '#fff;} body{display:none', accent: 'red', text: '#112233', ...({ 'background-image': '#ffffff' } as object) } })
    expect(css).toBe(':root{--text:#112233}')
    expect(css).not.toContain('display')
  })
})

describe('logoValido', () => {
  it('acepta solo el logo de la carpeta de personalización', () => {
    expect(logoValido('/personalizacion/logo.png?v=123')).toBe(true)
    expect(logoValido('/personalizacion/logo.svg')).toBe(true)
    expect(logoValido('https://malo.com/logo.png')).toBe(false)
    expect(logoValido('/personalizacion/../x.png')).toBe(false)
    expect(logoValido('javascript:alert(1)')).toBe(false)
    expect(logoValido(undefined)).toBe(false)
  })
})
