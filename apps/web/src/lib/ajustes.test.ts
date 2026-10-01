import { describe, expect, it } from 'vitest'
import { contraste, esHex, luminancia, textoSobre } from './contraste'
import { estadoCopia, rotar } from './copias'
import type { Copia } from './copias'

describe('contraste del color de acento', () => {
  it('blanco sobre negro es el máximo (21) y blanco sobre blanco el mínimo (1)', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(luminancia('#000000')).toBe(0)
  })

  it('elige texto blanco sobre colores oscuros y texto oscuro sobre colores claros', () => {
    expect(textoSobre('#8e2f4a')).toBe('#ffffff') // vino
    expect(textoSobre('#1c1814')).toBe('#ffffff')
    expect(textoSobre('#d4b26a')).toBe('#1a1405') // dorado
    expect(textoSobre('#f6f2ec')).toBe('#1a1405')
  })

  it('los colores de acento ofrecidos dan un texto legible (contraste ≥ 4,5, AA)', () => {
    for (const c of ['#b8502a', '#d4b26a', '#2e7d5b', '#2f6fb8', '#8e2f4a', '#5b4b8a']) {
      expect(contraste(c, textoSobre(c))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('valida el formato hexadecimal', () => {
    expect(esHex('#b8502a')).toBe(true)
    expect(esHex('b8502a')).toBe(false)
    expect(esHex('#fff')).toBe(false)
  })
})

const copia = (id: number, horasAtras: number): Copia => ({ id, fecha: new Date(Date.now() - horasAtras * 3_600_000), tamanoMB: 1.2, tipo: 'automatica', destino: 'USB' })

describe('copias de seguridad', () => {
  it('rotación: conserva solo las N más recientes', () => {
    const copias = [copia(1, 100), copia(2, 76), copia(3, 52), copia(4, 28), copia(5, 4)]
    expect(rotar(copias, 3).map((c) => c.id)).toEqual([5, 4, 3])
    expect(rotar(copias, 10)).toHaveLength(5)
  })

  it('rotación: nunca borra la última copia aunque se pida conservar 0', () => {
    expect(rotar([copia(1, 100), copia(2, 4)], 0).map((c) => c.id)).toEqual([2])
  })

  it('rotación: no modifica la lista original', () => {
    const copias = [copia(1, 10), copia(2, 5)]
    rotar(copias, 1)
    expect(copias).toHaveLength(2)
  })

  it('semáforo: verde, ámbar o rojo según la edad de la última copia', () => {
    const ahora = new Date()
    expect(estadoCopia([copia(1, 6)], ahora).nivel).toBe('ok')
    expect(estadoCopia([copia(1, 29.9)], ahora).nivel).toBe('ok')
    expect(estadoCopia([copia(1, 31)], ahora).nivel).toBe('warn')
    expect(estadoCopia([copia(1, 73)], ahora).nivel).toBe('bad')
  })

  it('semáforo: toma la copia MÁS RECIENTE y sin copias es rojo', () => {
    expect(estadoCopia([copia(1, 200), copia(2, 2)], new Date()).nivel).toBe('ok')
    expect(estadoCopia([], new Date())).toEqual({ nivel: 'bad', texto: 'Sin copias de seguridad' })
  })
})

import { contrasena, iniciales, motivoParaNoDesactivar, nombreUsuario } from './usuarios'

describe('usuarios (mismas reglas que el backend)', () => {
  const usuarios = [
    { id: 1, rol: 'DUENO' as const, activo: true },
    { id: 2, rol: 'VENDEDOR' as const, activo: true },
    { id: 3, rol: 'DUENO' as const, activo: false },
  ]

  it('un vendedor sí se puede desactivar', () => {
    expect(motivoParaNoDesactivar(usuarios, 2, 1)).toBeNull()
  })

  it('nadie desactiva su propia cuenta', () => {
    expect(motivoParaNoDesactivar(usuarios, 1, 1)).toMatch(/propia cuenta/)
  })

  it('no se puede desactivar al último dueño activo (aunque lo pida otro)', () => {
    expect(motivoParaNoDesactivar(usuarios, 1, 2)).toMatch(/al menos un dueño/)
  })

  it('con dos dueños activos sí se puede desactivar a uno', () => {
    const dos = [...usuarios, { id: 4, rol: 'DUENO' as const, activo: true }]
    expect(motivoParaNoDesactivar(dos, 4, 1)).toBeNull()
  })

  it('valida usuario y contraseña', () => {
    expect(nombreUsuario.safeParse('Maria.G').data).toBe('maria.g') // se guarda en minúsculas
    expect(nombreUsuario.safeParse('ab').success).toBe(false)
    expect(nombreUsuario.safeParse('con espacio').success).toBe(false)
    expect(contrasena.safeParse('1234567').success).toBe(false)
    expect(contrasena.safeParse('12345678').success).toBe(true)
  })

  it('arma las iniciales del avatar', () => {
    expect(iniciales('Juan Pulido')).toBe('JP')
    expect(iniciales('  ana  ')).toBe('A')
    expect(iniciales('Ana María López')).toBe('AM')
  })
})
