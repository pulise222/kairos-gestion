import { describe, expect, it } from 'vitest'
import { CLAVE, api, auth, baseLimpia, crearDueno, crearProducto, crearVendedor, prisma } from './ayudas.js'

baseLimpia()

describe('primer arranque y login (HU-01)', () => {
  it('al inicio pide configurar y después ya no', async () => {
    expect((await api().get('/api/setup/estado')).body).toEqual({ necesitaSetup: true })
    await crearDueno()
    expect((await api().get('/api/setup/estado')).body).toEqual({ necesitaSetup: false })
  })

  it('el setup solo funciona una vez (no se puede crear un segundo dueño por esa vía)', async () => {
    await crearDueno()
    const r = await api().post('/api/setup').send({ nombre: 'Intruso', usuario: 'intruso', contrasena: CLAVE })
    expect(r.status).toBe(409)
    expect(r.body.error.codigo).toBe('SETUP_YA_HECHO')
  })

  it('dos setups simultáneos: solo uno gana', async () => {
    const intentos = await Promise.all(
      [1, 2, 3, 4].map((i) => api().post('/api/setup').send({ nombre: `D${i}`, usuario: `dueno${i}`, contrasena: CLAVE })),
    )
    expect(intentos.filter((r) => r.status === 201)).toHaveLength(1)
    expect(await prisma.usuario.count()).toBe(1)
  })

  it('rechaza contraseñas débiles y usuarios mal formados', async () => {
    const corta = await api().post('/api/setup').send({ nombre: 'J', usuario: 'juan', contrasena: '1234' })
    expect(corta.status).toBe(400)
    const mala = await api().post('/api/setup').send({ nombre: 'J', usuario: 'Ju an!', contrasena: CLAVE })
    expect(mala.status).toBe(400)
  })

  it('guarda la contraseña cifrada, nunca en claro', async () => {
    await crearDueno()
    const u = await prisma.usuario.findFirstOrThrow()
    expect(u.contrasenaHash).not.toContain(CLAVE)
    expect(u.contrasenaHash.startsWith('$2')).toBe(true) // formato bcrypt
  })

  it('inicia sesión sin importar mayúsculas en el usuario', async () => {
    await crearDueno()
    const r = await api().post('/api/auth/login').send({ usuario: ' JUAN ', contrasena: CLAVE })
    expect(r.status).toBe(200)
    expect(r.body.token).toBeTruthy()
    expect(r.body.usuario).toMatchObject({ usuario: 'juan', rol: 'DUENO' })
    expect(JSON.stringify(r.body)).not.toContain('contrasena')
  })

  it('da el MISMO error si la clave es mala o el usuario no existe (no delata usuarios)', async () => {
    await crearDueno()
    const claveMala = await api().post('/api/auth/login').send({ usuario: 'juan', contrasena: 'otra-clave-123' })
    const noExiste = await api().post('/api/auth/login').send({ usuario: 'fantasma', contrasena: 'otra-clave-123' })
    expect(claveMala.status).toBe(401)
    expect(noExiste.status).toBe(401)
    expect(claveMala.body).toEqual(noExiste.body)
  })

  it('un usuario desactivado no puede entrar ni usar su token anterior', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    await api().get('/api/auth/yo').set(auth(vendedor.token)).expect(200)

    await api().patch(`/api/usuarios/${vendedor.id}`).set(auth(dueno.token)).send({ activo: false }).expect(200)

    // El token todavía no vence, pero el sistema consulta la base: acceso cortado al instante.
    await api().get('/api/auth/yo').set(auth(vendedor.token)).expect(401)
    await api().post('/api/auth/login').send({ usuario: 'maria', contrasena: CLAVE }).expect(401)
  })
})

describe('protección de rutas y roles', () => {
  it('sin token o con token falso: 401', async () => {
    expect((await api().get('/api/productos')).status).toBe(401)
    expect((await api().get('/api/productos').set(auth('token.falso.xyz'))).status).toBe(401)
  })

  it('un token firmado con otro secreto no sirve', async () => {
    const jwt = (await import('jsonwebtoken')).default
    const falso = jwt.sign({ rol: 'DUENO' }, 'otro-secreto-distinto-de-32-caracteres-xx', { subject: '1' })
    expect((await api().get('/api/productos').set(auth(falso))).status).toBe(401)
  })

  it('el vendedor NO puede crear productos, ver el panel ni administrar usuarios', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const cat = (await api().post('/api/categorias').set(auth(dueno.token)).send({ nombre: 'Bebidas' })).body

    const intentos = [
      api().post('/api/productos').set(auth(vendedor.token)).send({ nombre: 'X', codigo: 'X1', categoriaId: cat.id, costo: 1, precio: 2 }),
      api().get('/api/panel/resumen').set(auth(vendedor.token)),
      api().get('/api/usuarios').set(auth(vendedor.token)),
      api().get('/api/proveedores').set(auth(vendedor.token)),
      api().post('/api/compras').set(auth(vendedor.token)).send({}),
      api().put('/api/configuracion').set(auth(vendedor.token)).send({ nombreNegocio: 'Hackeado' }),
    ]
    for (const r of await Promise.all(intentos)) {
      expect(r.status).toBe(403)
      expect(r.body.error.codigo).toBe('SIN_PERMISO')
    }
  })

  it('el vendedor ve los productos pero SIN costo; el dueño sí lo ve', async () => {
    const dueno = await crearDueno()
    const vendedor = await crearVendedor(dueno.token)
    const p = await crearProducto(dueno.token, { costo: 3200, precio: 4500 })

    const comoVendedor = await api().get(`/api/productos/${p.id}`).set(auth(vendedor.token)).expect(200)
    expect(comoVendedor.body.precio).toBe(4500)
    expect(comoVendedor.body).not.toHaveProperty('costo')

    const lista = await api().get('/api/productos').set(auth(vendedor.token)).expect(200)
    expect(lista.body.items[0]).not.toHaveProperty('costo')

    const comoDueno = await api().get(`/api/productos/${p.id}`).set(auth(dueno.token)).expect(200)
    expect(comoDueno.body.costo).toBe(3200)
  })

  it('nunca queda el sistema sin un dueño activo', async () => {
    const dueno = await crearDueno()
    const r1 = await api().patch(`/api/usuarios/${dueno.id}`).set(auth(dueno.token)).send({ rol: 'VENDEDOR' })
    expect(r1.status).toBe(422)
    expect(r1.body.error.codigo).toBe('ULTIMO_DUENO')
    const r2 = await api().patch(`/api/usuarios/${dueno.id}`).set(auth(dueno.token)).send({ activo: false })
    expect(r2.status).toBe(422)
  })

  it('cambiar contraseña exige la actual', async () => {
    const dueno = await crearDueno()
    await api().patch('/api/auth/contrasena').set(auth(dueno.token)).send({ actual: 'equivocada', nueva: 'nueva-clave-456' }).expect(422)
    await api().patch('/api/auth/contrasena').set(auth(dueno.token)).send({ actual: CLAVE, nueva: 'nueva-clave-456' }).expect(204)
    await api().post('/api/auth/login').send({ usuario: 'juan', contrasena: CLAVE }).expect(401)
    await api().post('/api/auth/login').send({ usuario: 'juan', contrasena: 'nueva-clave-456' }).expect(200)
  })

  it('las rutas inexistentes y los JSON rotos responden con el formato de error uniforme', async () => {
    const dueno = await crearDueno()
    const r = await api().get('/api/no-existe').set(auth(dueno.token))
    expect(r.status).toBe(404)
    expect(r.body.error.codigo).toBe('RUTA_NO_ENCONTRADA')
    const rota = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"usuario": ')
    expect(rota.status).toBe(400)
    expect(rota.body.error.codigo).toBe('JSON_INVALIDO')
  })
})
