import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { crearApp } from '../src/app.js'
import { leerPersonalizacion } from '../src/lib/marca.js'
import { SECRETO, prisma } from './ayudas.js'

const carpeta = () => mkdtempSync(join(tmpdir(), 'nivel-marca-'))
const app = (dir: string) => request(crearApp({ prisma, jwtSecret: SECRETO, limitarIntentos: false, personalizacionDir: dir }))

describe('personalización del cliente (carpeta con logo y paleta)', () => {
  it('sin carpeta ni archivos no hay personalización y nada falla', async () => {
    expect(leerPersonalizacion(join(carpeta(), 'no-existe'))).toEqual({})
    const r = await app(carpeta()).get('/api/marca').expect(200)
    expect(r.body.personalizacion).toEqual({})
  })

  it('lee la paleta (claro y oscuro) y el lema, y detecta el logo', async () => {
    const dir = carpeta()
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ lema: 'Tu tienda de barrio', claro: { bg: '#f0e6d2', accent: '#2f6f4f' }, oscuro: { accent: '#7fd1a0' } }))
    writeFileSync(join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const r = (await app(dir).get('/api/marca').expect(200)).body.personalizacion
    expect(r).toMatchObject({ lema: 'Tu tienda de barrio', claro: { bg: '#f0e6d2', accent: '#2f6f4f' }, oscuro: { accent: '#7fd1a0' } })
    expect(r.logo).toMatch(/^\/personalizacion\/logo\.png\?v=\d+$/)
    // El logo se sirve de verdad.
    await app(dir).get('/personalizacion/logo.png').expect(200)
  })

  it('un color mal escrito invalida el archivo (se ignora) pero el sistema sigue funcionando', async () => {
    const dir = carpeta()
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ claro: { bg: 'rojo' } }))
    const r = await app(dir).get('/api/marca').expect(200)
    expect(r.body.personalizacion.claro).toBeUndefined()
    expect(r.body.nombreNegocio).toBeDefined()
  })

  it('un JSON roto tampoco tumba el sistema', async () => {
    const dir = carpeta()
    writeFileSync(join(dir, 'marca.json'), '{ esto no es json')
    await app(dir).get('/api/marca').expect(200)
  })

  it('SEGURIDAD: no se puede colar CSS por un color ni usar claves desconocidas', () => {
    const dir = carpeta()
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ claro: { bg: '#fff;} body{display:none' } }))
    expect(leerPersonalizacion(dir).claro).toBeUndefined()
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ claro: { 'background-image': '#ffffff' } }))
    expect(leerPersonalizacion(dir).claro).toBeUndefined()
    writeFileSync(join(dir, 'marca.json'), JSON.stringify({ lema: 'x'.repeat(200) }))
    expect(leerPersonalizacion(dir).lema).toBeUndefined()
  })

  it('no sirve archivos fuera de la carpeta ni ocultos', async () => {
    const dir = carpeta()
    writeFileSync(join(dir, '.secreto'), 'x')
    await app(dir).get('/personalizacion/.secreto').expect(404)
    const r = await app(dir).get('/personalizacion/..%2F..%2Fpackage.json')
    expect([400, 403, 404]).toContain(r.status)
  })
})
