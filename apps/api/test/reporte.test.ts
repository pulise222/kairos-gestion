import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import request from 'supertest'
import type { Transporter } from 'nodemailer'
import { beforeEach, describe, expect, it } from 'vitest'
import { crearApp } from '../src/app.js'
import { enviarReporte, generarExcel, haceFaltaReporte, leerConfigCorreo, marcarReporteEnviado, semanaPasada } from '../src/lib/reporte.js'
import type { ConfigCorreo } from '../src/lib/reporte.js'
import { SECRETO, api, auth, baseLimpia, carpetaCopias, carpetaFotos, crearDueno, crearProducto, prisma } from './ayudas.js'

baseLimpia()
beforeEach(() => {
  for (const carpeta of [carpetaFotos, carpetaCopias]) for (const f of readdirSync(carpeta)) rmSync(join(carpeta, f), { recursive: true, force: true })
})

const correo: ConfigCorreo = { host: 'smtp.prueba', port: 587, secure: false, user: 'tienda@prueba.co', pass: 'x', desde: 'tienda@prueba.co', para: ['dueno@prueba.co'], adjuntarCopia: true }
interface Enviado { to: string; subject: string; text: string; attachments: { filename: string; content: Buffer }[] }
const transporteFalso = (falla = false) => {
  const enviados: Enviado[] = []
  const t = { sendMail: async (m: Enviado) => { if (falla) throw new Error('535 usuario=tienda clave=SECRETA rechazada'); enviados.push(m); return {} } } as unknown as Transporter
  return { t, enviados }
}
const opcionesCopias = { prisma, carpeta: carpetaCopias, fotos: carpetaFotos }

/** Mueve una venta a "hace N días" (a mediodía de Colombia, para no caer en un borde de día). */
const hace = (ventaId: number, dias: number) =>
  prisma.$executeRawUnsafe(`UPDATE venta SET creada_en = (((now() AT TIME ZONE 'America/Bogota')::date - ${dias})::timestamp + interval '12 hours') AT TIME ZONE 'America/Bogota' WHERE id = ${ventaId}`)

async function escenario() {
  const { token } = await crearDueno()
  const agua = await crearProducto(token, { nombre: 'Agua', precio: 2000, costo: 1000, stockInicial: 100, stockMinimo: 5 })
  const vender = async (productoId: number, cantidad: number) =>
    (await api().post('/api/ventas').set(auth(token)).send({ items: [{ productoId, cantidad }], pagado: 1_000_000 }).expect(201)).body as { id: number; items: { id: number }[] }
  const v1 = await vender(agua.id, 3) // 6.000, ganancia 3.000
  const v2 = await vender(agua.id, 2) // 4.000, ganancia 2.000
  const v3 = await vender(agua.id, 10) // anulada
  const vVieja = await vender(agua.id, 50) // fuera de la semana
  await api().post(`/api/ventas/${v3.id}/anular`).set(auth(token)).send({ motivo: 'Error' }).expect(200)
  await api().post(`/api/ventas/${v1.id}/devoluciones`).set(auth(token)).send({ items: [{ ventaItemId: v1.items[0]!.id, cantidad: 1 }], motivo: 'x', medioReembolso: 'EFECTIVO' }).expect(201) // devuelve 2.000 hoy
  await hace(v1.id, 3); await hace(v2.id, 2); await hace(v3.id, 2); await hace(vVieja.id, 20)
  await prisma.$executeRawUnsafe(`UPDATE devolucion SET creada_en = (SELECT creada_en FROM venta WHERE id = ${v1.id})`) // la devolución cae también en la semana
  return { token, agua }
}

describe('configuración del correo', () => {
  it('sin datos completos el reporte queda apagado', () => {
    expect(leerConfigCorreo({})).toBeNull()
    expect(leerConfigCorreo({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' })).toBeNull() // falta REPORTE_PARA
    expect(leerConfigCorreo({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', REPORTE_PARA: 'esto-no-es-correo' })).toBeNull()
  })
  it('lee varios destinatarios, ignora los inválidos y entiende el puerto 465', () => {
    const c = leerConfigCorreo({ SMTP_HOST: 'h', SMTP_PORT: '465', SMTP_USER: 'tienda@x.co', SMTP_PASS: 'p', REPORTE_PARA: 'a@x.co, malo, b@y.co' })!
    expect(c.para).toEqual(['a@x.co', 'b@y.co'])
    expect(c).toMatchObject({ secure: true, port: 465, desde: 'tienda@x.co', adjuntarCopia: true })
    expect(leerConfigCorreo({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', REPORTE_PARA: 'a@x.co', REPORTE_ADJUNTAR_COPIA: 'false' })!.adjuntarCopia).toBe(false)
  })
})

describe('semana del reporte', () => {
  it('son los 7 días completos que terminan AYER (hora de Colombia)', () => {
    // 2026-10-01 02:00 UTC = 2026-09-30 21:00 en Colombia → «hoy» es el 30 de septiembre.
    expect(semanaPasada('America/Bogota', new Date('2026-10-01T02:00:00Z'))).toEqual({ desde: '2026-09-23', hasta: '2026-09-29' })
  })
})

describe('el Excel', () => {
  it('suma solo la semana, resta devoluciones, ignora anuladas y coincide con las ventas reales', async () => {
    await escenario()
    const { desde, hasta } = semanaPasada('America/Bogota')
    const { libro, resumen } = await generarExcel(prisma, desde, hasta)

    // v1 (6.000) + v2 (4.000) − devolución (2.000) = 8.000; ganancia 3.000 + 2.000 − 1.000 = 4.000
    expect(resumen).toMatchObject({ ventasNetas: 8000, devuelto: 2000, ganancia: 4000, tickets: 2, anuladas: 1 })

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(libro as unknown as ArrayBuffer)
    expect(wb.worksheets.map((h) => h.name)).toEqual(['Resumen', 'Ventas', 'Más vendidos', 'Inventario', 'Por sección', 'Cierres de caja'])
    const ventas = wb.getWorksheet('Ventas')!
    expect(ventas.rowCount - 1).toBe(3) // v1, v2 y la anulada; la de hace 20 días NO
    const estados = [2, 3, 4].map((i) => ventas.getRow(i).getCell(5).value)
    expect(estados.sort()).toEqual(['ANULADA', 'COMPLETADA', 'COMPLETADA'])
    const masVendidos = wb.getWorksheet('Más vendidos')!
    expect(masVendidos.getRow(2).getCell(3).value).toBe(4) // 3 + 2 − 1 devuelta
    const inv = wb.getWorksheet('Inventario')!
    expect(inv.getRow(2).getCell(2).value).toBe('Agua')
    expect(inv.getRow(2).getCell(9).value).toBe(inv.getRow(2).getCell(5).value as number * 1000)
  })
})

describe('el envío', () => {
  it('manda el Excel y la copia de seguridad adjuntos a los destinatarios', async () => {
    await escenario()
    const { t, enviados } = transporteFalso()
    const r = await enviarReporte({ prisma, copias: opcionesCopias, correo, transporte: t })
    expect(enviados).toHaveLength(1)
    expect(enviados[0]!.to).toBe('dueno@prueba.co')
    expect(enviados[0]!.subject).toContain('Reporte semanal')
    expect(enviados[0]!.attachments.map((a) => a.filename.split('.').pop())).toEqual(['xlsx', 'zip'])
    expect(enviados[0]!.attachments.every((a) => a.content.length > 100)).toBe(true)
    expect(enviados[0]!.text).toContain('Ventas netas')
    expect(r.adjuntos).toHaveLength(2)
  })

  it('con REPORTE_ADJUNTAR_COPIA=false solo va el Excel', async () => {
    await escenario()
    const { t, enviados } = transporteFalso()
    await enviarReporte({ prisma, copias: opcionesCopias, correo: { ...correo, adjuntarCopia: false }, transporte: t })
    expect(enviados[0]!.attachments).toHaveLength(1)
  })

  it('si el correo falla, avisa con un mensaje claro y NO filtra datos de la cuenta', async () => {
    await escenario()
    const { t } = transporteFalso(true)
    await expect(enviarReporte({ prisma, copias: opcionesCopias, correo, transporte: t })).rejects.toMatchObject({ codigo: 'CORREO_FALLO', message: expect.not.stringContaining('SECRETA') })
  })
})

describe('programación semanal y endpoint', () => {
  it('toca enviar si nunca se envió o pasaron 7 días', async () => {
    const t0 = new Date('2026-09-10T10:00:00Z')
    expect(await haceFaltaReporte(carpetaCopias, t0)).toBe(true)
    await marcarReporteEnviado(carpetaCopias, t0)
    expect(await haceFaltaReporte(carpetaCopias, new Date(t0.getTime() + 6 * 86_400_000))).toBe(false)
    expect(await haceFaltaReporte(carpetaCopias, new Date(t0.getTime() + 7 * 86_400_000))).toBe(true)
  })

  it('POST /api/copias/reporte: sin correo configurado responde 422; con correo lo envía; solo el dueño', async () => {
    const { token } = await escenario()
    await api().post('/api/copias/reporte').set(auth(token)).expect(422)
    expect((await api().get('/api/copias').set(auth(token))).body.correoConfigurado).toBe(false)

    const { t, enviados } = transporteFalso()
    const conCorreo = request(crearApp({ prisma, jwtSecret: SECRETO, limitarIntentos: false, uploadsDir: carpetaFotos, copiasDir: mkdtempSync(join(tmpdir(), 'nivel-rep-')), correo, transporteCorreo: t }))
    const r = await conCorreo.post('/api/copias/reporte').set(auth(token)).expect(200)
    expect(r.body.enviadoA).toEqual(['dueno@prueba.co'])
    expect(enviados).toHaveLength(1)
    expect((await conCorreo.get('/api/copias').set(auth(token))).body).toMatchObject({ correoConfigurado: true, correoPara: ['dueno@prueba.co'] })
    await conCorreo.post('/api/copias/reporte').expect(401)
  })
})
