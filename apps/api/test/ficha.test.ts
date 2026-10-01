import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { api, auth, baseLimpia, carpetaFotos, crearDueno, crearVendedor, prisma as prismaDirecto } from './ayudas.js'

baseLimpia()

// PNG mínimo (cabecera real de 8 bytes + relleno): suficiente para la validación por "magic bytes".
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)])

async function preparar() {
  const { token } = await crearDueno()
  const cat = (await api().post('/api/categorias').set(auth(token)).send({ nombre: 'Bebidas' }).expect(201)).body
  const nuevo = (datos: Record<string, unknown>) =>
    api().post('/api/productos').set(auth(token)).send({ nombre: 'Agua 600 ml', costo: 800, precio: 1500, categoriaId: cat.id, ...datos })
  return { token, cat, nuevo }
}

describe('código del producto: opcional o propio', () => {
  it('si no se escribe, se asigna el siguiente número libre', async () => {
    const { nuevo } = await preparar()
    const a = await nuevo({}).expect(201)
    const b = await nuevo({ nombre: 'Otro' }).expect(201)
    expect(a.body.codigo).toBe('0001')
    expect(b.body.codigo).toBe('0002')
  })

  it('un código vacío cuenta como "no escrito"', async () => {
    const { nuevo } = await preparar()
    expect((await nuevo({ codigo: '' }).expect(201)).body.codigo).toBe('0001')
  })

  it('acepta un código propio como APEQ1 y lo respeta', async () => {
    const { nuevo } = await preparar()
    expect((await nuevo({ codigo: 'APEQ1' }).expect(201)).body.codigo).toBe('APEQ1')
  })

  it('el código es único sin importar mayúsculas', async () => {
    const { nuevo } = await preparar()
    await nuevo({ codigo: 'APEQ1' }).expect(201)
    const r = await nuevo({ codigo: 'apeq1' }).expect(409)
    expect(r.body.error.codigo).toBe('CODIGO_EXISTE')
  })

  it('rechaza códigos con espacios o símbolos', async () => {
    const { nuevo } = await preparar()
    await nuevo({ codigo: 'AGUA 600' }).expect(400)
    await nuevo({ codigo: 'A/B' }).expect(400)
  })

  it('un código de barras largo no altera la numeración automática', async () => {
    const { nuevo } = await preparar()
    await nuevo({ codigo: '7701234567890' }).expect(201)
    expect((await nuevo({ nombre: 'Otro' }).expect(201)).body.codigo).toBe('0001')
  })

  it('varias creaciones a la vez no repiten el código automático', async () => {
    const { nuevo } = await preparar()
    const rs = await Promise.all([1, 2, 3, 4].map((i) => nuevo({ nombre: `P${i}` })))
    expect(rs.map((r) => r.status)).toEqual([201, 201, 201, 201])
    expect(new Set(rs.map((r) => r.body.codigo)).size).toBe(4)
  })

  it('al editar, no se puede tomar el código de otro (aunque cambien las mayúsculas)', async () => {
    const { token, nuevo } = await preparar()
    await nuevo({ codigo: 'APEQ1' }).expect(201)
    const b = (await nuevo({ nombre: 'Otro', codigo: 'B1' }).expect(201)).body
    await api().patch(`/api/productos/${b.id}`).set(auth(token)).send({ codigo: 'apeq1' }).expect(409)
    // Cambiar solo las mayúsculas de su propio código sí se puede.
    await api().patch(`/api/productos/${b.id}`).set(auth(token)).send({ codigo: 'b1' }).expect(200)
  })

  it('el lector de código encuentra sin importar mayúsculas', async () => {
    const { token, nuevo } = await preparar()
    await nuevo({ codigo: 'APEQ1' }).expect(201)
    const r = await api().get('/api/productos/codigo/apeq1').set(auth(token)).expect(200)
    expect(r.body.codigo).toBe('APEQ1')
  })
})

describe('descripción', () => {
  it('se guarda, se edita y se puede buscar por ella', async () => {
    const { token, nuevo } = await preparar()
    const p = (await nuevo({ descripcion: 'Botella plástica transparente' }).expect(201)).body
    expect(p.descripcion).toBe('Botella plástica transparente')

    const buscar = async (q: string) => (await api().get('/api/productos').query({ q }).set(auth(token)).expect(200)).body.items as { id: number }[]
    expect((await buscar('transparente')).map((x) => x.id)).toEqual([p.id])

    await api().patch(`/api/productos/${p.id}`).set(auth(token)).send({ descripcion: 'Botella retornable' }).expect(200)
    expect(await buscar('transparente')).toHaveLength(0)
    expect(await buscar('retornable')).toHaveLength(1)
    // Cambiar solo el nombre no hace perder la descripción en la búsqueda.
    await api().patch(`/api/productos/${p.id}`).set(auth(token)).send({ nombre: 'Agua grande' }).expect(200)
    expect(await buscar('retornable')).toHaveLength(1)
  })
})

describe('foto del producto', () => {
  const subir = (token: string, id: number, cuerpo: Buffer, tipo = 'image/png') =>
    api().post(`/api/productos/${id}/imagen`).set(auth(token)).set('Content-Type', tipo).send(cuerpo)
  const archivo = (url: string) => join(carpetaFotos, url.replace('/uploads/', ''))

  it('se sube, queda guardada y se puede ver por /uploads', async () => {
    const { token, nuevo } = await preparar()
    const p = (await nuevo({}).expect(201)).body
    const r = await subir(token, p.id, PNG).expect(200)
    expect(r.body.imagen).toMatch(/^\/uploads\/[0-9a-f]{24}\.png$/)
    expect(existsSync(archivo(r.body.imagen))).toBe(true)
    const f = await api().get(r.body.imagen).expect(200)
    expect(Buffer.from(f.body).equals(PNG)).toBe(true)
  })

  it('al cambiar la foto se borra la anterior; al quitarla también', async () => {
    const { token, nuevo } = await preparar()
    const p = (await nuevo({}).expect(201)).body
    const a = (await subir(token, p.id, PNG).expect(200)).body.imagen as string
    const b = (await subir(token, p.id, PNG).expect(200)).body.imagen as string
    expect(a).not.toBe(b)
    expect(existsSync(archivo(a))).toBe(false)
    const q = await api().delete(`/api/productos/${p.id}/imagen`).set(auth(token)).expect(200)
    expect(q.body.imagen).toBeNull()
    expect(existsSync(archivo(b))).toBe(false)
  })

  it('rechaza un archivo que dice ser imagen pero no lo es (por sus bytes)', async () => {
    const { token, nuevo } = await preparar()
    const p = (await nuevo({}).expect(201)).body
    const antes = readdirSync(carpetaFotos).length
    const r = await subir(token, p.id, Buffer.from('<script>alert(1)</script>')).expect(400)
    expect(r.body.error.codigo).toBe('IMAGEN_INVALIDA')
    expect(readdirSync(carpetaFotos).length).toBe(antes)
  })

  it('rechaza tipos que no son imagen y archivos de más de 3 MB', async () => {
    const { token, nuevo } = await preparar()
    const p = (await nuevo({}).expect(201)).body
    await subir(token, p.id, PNG, 'text/html').expect(400)
    const grande = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024 + 10)])
    const r = await subir(token, p.id, grande).expect(413)
    expect(r.body.error.codigo).toBe('CUERPO_MUY_GRANDE')
  })

  it('solo el dueño puede subir o quitar fotos', async () => {
    const { token, nuevo } = await preparar()
    const p = (await nuevo({}).expect(201)).body
    const v = await crearVendedor(token)
    await subir(v.token, p.id, PNG).expect(403)
    await api().delete(`/api/productos/${p.id}/imagen`).set(auth(v.token)).expect(403)
    await api().post(`/api/productos/${p.id}/imagen`).set('Content-Type', 'image/png').send(PNG).expect(401)
  })

  it('un producto inexistente da 404 y no deja archivos', async () => {
    const { token } = await preparar()
    const antes = readdirSync(carpetaFotos).length
    await subir(token, 9999, PNG).expect(404)
    expect(readdirSync(carpetaFotos).length).toBe(antes)
  })
})

describe('categorías: nombre único sin importar mayúsculas', () => {
  it('no deja crear «bebidas» si ya existe «Bebidas»', async () => {
    const { token } = await preparar() // ya crea "Bebidas"
    const r = await api().post('/api/categorias').set(auth(token)).send({ nombre: 'bebidas' }).expect(409)
    expect(r.body.error.codigo).toBe('CATEGORIA_EXISTE')
  })

  it('no deja renombrar otra categoría a un nombre existente (aunque cambien las mayúsculas)', async () => {
    const { token } = await preparar()
    const aseo = (await api().post('/api/categorias').set(auth(token)).send({ nombre: 'Aseo' }).expect(201)).body
    await api().patch(`/api/categorias/${aseo.id}`).set(auth(token)).send({ nombre: 'BEBIDAS' }).expect(409)
    // Cambiar solo las mayúsculas de su propio nombre sí se puede.
    await api().patch(`/api/categorias/${aseo.id}`).set(auth(token)).send({ nombre: 'ASEO' }).expect(200)
  })

  it('la base de datos también lo impide (por si algo se salta la API)', async () => {
    const { token } = await preparar()
    await expect(prismaDirecto.categoria.create({ data: { nombre: 'BEBIDAS' } })).rejects.toThrow()
    void token
  })

  it('se puede desactivar, renombrar y cambiar de color', async () => {
    const { token, cat } = await preparar()
    const r = await api().patch(`/api/categorias/${cat.id}`).set(auth(token)).send({ nombre: 'Bebidas frías', color: '#112233', activa: false }).expect(200)
    expect(r.body).toMatchObject({ nombre: 'Bebidas frías', color: '#112233', activa: false })
  })
})
