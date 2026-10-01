import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { Prisma } from '../db.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import { reglaDeNegocio } from '../errors.js'
import { leerConfig } from '../modules/configuracion.js'
import { crearCopia, rutaDeCopia } from './copias.js'
import type { Opciones } from './copias.js'

/*
  Reporte semanal por correo: un Excel con lo importante de la semana + (opcional) la copia de seguridad adjunta.
  El Excel es para LEER (ventas, ganancias, inventario). La copia .zip es la que sirve para RESTAURAR el sistema.
  Los datos de acceso al correo viven en el archivo .env del servidor (nunca en la base de datos ni en pantalla).
*/

export interface ConfigCorreo {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  desde: string
  para: string[]
  adjuntarCopia: boolean
}

/** Lee la configuración del correo del entorno. Devuelve null si falta algo (entonces el reporte está apagado). */
export function leerConfigCorreo(env: Record<string, string | undefined>): ConfigCorreo | null {
  const host = env.SMTP_HOST?.trim()
  const user = env.SMTP_USER?.trim()
  const pass = env.SMTP_PASS
  const para = (env.REPORTE_PARA ?? '').split(',').map((x) => x.trim()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
  if (!host || !user || !pass || para.length === 0) return null
  const port = Number(env.SMTP_PORT) || 587
  return {
    host, port, user, pass, para,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    desde: env.SMTP_DESDE?.trim() || user,
    adjuntarCopia: env.REPORTE_ADJUNTAR_COPIA !== 'false', // por defecto SÍ adjunta la copia
  }
}

const n = (v: unknown) => Number(v ?? 0)
const PESOS = '"$"#,##0'

const sumarDias = (dia: string, d: number) => {
  const f = new Date(`${dia}T00:00:00Z`)
  f.setUTCDate(f.getUTCDate() + d)
  return f.toISOString().slice(0, 10)
}
const hoyEn = (zona: string, ahora: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(ahora)

/** Los 7 días completos anteriores a hoy (terminan ayer). */
export function semanaPasada(zona: string, ahora = new Date()) {
  const hoy = hoyEn(zona, ahora)
  return { desde: sumarDias(hoy, -7), hasta: sumarDias(hoy, -1) }
}

function encabezado(hoja: ExcelJS.Worksheet, columnas: { header: string; key: string; width: number; fmt?: string }[]) {
  hoja.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }))
  const fila = hoja.getRow(1)
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0481F' } }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
}

/** Genera el libro de Excel de un rango de días (AAAA-MM-DD, ambos incluidos, en la zona del negocio). */
export async function generarExcel(prisma: Prisma, desde: string, hasta: string): Promise<{ libro: Buffer; resumen: Record<string, number> }> {
  const cfg = await leerConfig(prisma)
  const tz = cfg.zonaHoraria
  const inicio = PrismaRuntime.sql`((${desde}::date)::timestamp AT TIME ZONE ${tz})`
  const fin = PrismaRuntime.sql`((((${hasta}::date) + 1))::timestamp AT TIME ZONE ${tz})`

  const ventas = await prisma.$queryRaw<{ numero: number; fecha: Date; vendedor: string; medio: string; total: number; estado: string; ganancia: number; devuelto: number }[]>(PrismaRuntime.sql`
    SELECT v.numero, v.creada_en AS fecha, u.nombre AS vendedor, v.medio_pago::text AS medio, v.total, v.estado::text AS estado,
           COALESCE((SELECT SUM((i.precio_unitario - i.costo_unitario) * i.cantidad) FROM venta_item i WHERE i.venta_id = v.id), 0) AS ganancia,
           COALESCE((SELECT SUM(d.total) FROM devolucion d WHERE d.venta_id = v.id), 0) AS devuelto
    FROM venta v JOIN usuario u ON u.id = v.usuario_id
    WHERE v.creada_en >= ${inicio} AND v.creada_en < ${fin} ORDER BY v.numero`)

  const vendidos = await prisma.$queryRaw<{ nombre: string; categoria: string; unidades: bigint; ingresos: bigint }[]>(PrismaRuntime.sql`
    WITH movs AS (
      SELECT i.producto_id, i.nombre_producto AS nombre, i.cantidad AS u, i.cantidad * i.precio_unitario AS ing
      FROM venta_item i JOIN venta v ON v.id = i.venta_id WHERE v.estado = 'COMPLETADA' AND v.creada_en >= ${inicio} AND v.creada_en < ${fin}
      UNION ALL
      SELECT di.producto_id, di.nombre_producto, -di.cantidad, -di.cantidad * di.precio_unitario
      FROM devolucion_item di JOIN devolucion dv ON dv.id = di.devolucion_id WHERE dv.creada_en >= ${inicio} AND dv.creada_en < ${fin}
    )
    SELECT m.nombre, c.nombre AS categoria, SUM(m.u) AS unidades, SUM(m.ing) AS ingresos
    FROM movs m JOIN producto p ON p.id = m.producto_id JOIN categoria c ON c.id = p.categoria_id
    GROUP BY m.producto_id, m.nombre, c.nombre HAVING SUM(m.u) > 0 ORDER BY unidades DESC, ingresos DESC`)

  const inventario = await prisma.$queryRaw<{ codigo: string; nombre: string; categoria: string; proveedor: string | null; stock: number; minimo: number; costo: number; precio: number; activo: boolean }[]>(PrismaRuntime.sql`
    SELECT p.codigo, p.nombre, c.nombre AS categoria, pr.nombre AS proveedor, p.stock, p.stock_minimo AS minimo, p.costo, p.precio, p.activo
    FROM producto p JOIN categoria c ON c.id = p.categoria_id LEFT JOIN proveedor pr ON pr.id = p.proveedor_id ORDER BY p.nombre`)

  const [dev] = await prisma.$queryRaw<{ total: bigint; ganancia: bigint }[]>(PrismaRuntime.sql`
    SELECT COALESCE(SUM(dv.total), 0) AS total,
           COALESCE(SUM((SELECT SUM((di.precio_unitario - di.costo_unitario) * di.cantidad) FROM devolucion_item di WHERE di.devolucion_id = dv.id)), 0) AS ganancia
    FROM devolucion dv WHERE dv.creada_en >= ${inicio} AND dv.creada_en < ${fin}`)

  const vigentes = ventas.filter((v) => v.estado === 'COMPLETADA')
  const bruto = vigentes.reduce((s, v) => s + n(v.total), 0)
  const devuelto = n(dev?.total)
  const resumen = {
    ventasNetas: bruto - devuelto,
    devuelto,
    ganancia: vigentes.reduce((s, v) => s + n(v.ganancia), 0) - n(dev?.ganancia),
    tickets: vigentes.length,
    anuladas: ventas.length - vigentes.length,
    valorInventario: inventario.filter((p) => p.activo).reduce((s, p) => s + p.stock * p.costo, 0),
    stockBajo: inventario.filter((p) => p.activo && p.stock <= p.minimo).length,
  }

  const libro = new ExcelJS.Workbook()
  libro.creator = cfg.nombreNegocio
  libro.created = new Date()

  const h1 = libro.addWorksheet('Resumen')
  encabezado(h1, [{ header: 'Concepto', key: 'c', width: 34 }, { header: 'Valor', key: 'v', width: 20, fmt: PESOS }])
  const filas: [string, number, boolean][] = [
    [`Período: ${desde} a ${hasta}`, NaN, false],
    ['Ventas netas (ya sin devoluciones)', resumen.ventasNetas, true],
    ['Devoluciones de clientes', resumen.devuelto, true],
    ['Ganancia neta', resumen.ganancia, true],
    ['Número de ventas', resumen.tickets, false],
    ['Ventas anuladas', resumen.anuladas, false],
    ['Valor del inventario a costo (hoy)', resumen.valorInventario, true],
    ['Productos con stock bajo (hoy)', resumen.stockBajo, false],
  ]
  for (const [c, v, dinero] of filas) {
    const f = h1.addRow({ c, v: Number.isNaN(v) ? null : v })
    if (!dinero) f.getCell('v').numFmt = '#,##0'
  }
  h1.getRow(2).font = { bold: true }

  const h2 = libro.addWorksheet('Ventas')
  encabezado(h2, [
    { header: 'N.º', key: 'numero', width: 8 }, { header: 'Fecha y hora', key: 'fecha', width: 20, fmt: 'dd/mm/yyyy hh:mm' }, { header: 'Vendedor', key: 'vendedor', width: 18 },
    { header: 'Medio de pago', key: 'medio', width: 15 }, { header: 'Estado', key: 'estado', width: 13 }, { header: 'Total', key: 'total', width: 14, fmt: PESOS },
    { header: 'Devuelto', key: 'devuelto', width: 14, fmt: PESOS }, { header: 'Ganancia', key: 'ganancia', width: 14, fmt: PESOS },
  ])
  for (const v of ventas) h2.addRow({ ...v, numero: n(v.numero), total: n(v.total), devuelto: n(v.devuelto), ganancia: n(v.ganancia) })

  const h3 = libro.addWorksheet('Más vendidos')
  encabezado(h3, [{ header: 'Producto', key: 'nombre', width: 32 }, { header: 'Categoría', key: 'categoria', width: 18 }, { header: 'Unidades', key: 'unidades', width: 11 }, { header: 'Ingresos', key: 'ingresos', width: 15, fmt: PESOS }])
  for (const p of vendidos) h3.addRow({ ...p, unidades: n(p.unidades), ingresos: n(p.ingresos) })

  const h4 = libro.addWorksheet('Inventario')
  encabezado(h4, [
    { header: 'Código', key: 'codigo', width: 16 }, { header: 'Producto', key: 'nombre', width: 32 }, { header: 'Categoría', key: 'categoria', width: 18 }, { header: 'Proveedor', key: 'proveedor', width: 22 },
    { header: 'Stock', key: 'stock', width: 9 }, { header: 'Mínimo', key: 'minimo', width: 9 }, { header: 'Costo', key: 'costo', width: 12, fmt: PESOS }, { header: 'Precio', key: 'precio', width: 12, fmt: PESOS },
    { header: 'Valor a costo', key: 'valor', width: 15, fmt: PESOS }, { header: 'Estado', key: 'estado', width: 12 },
  ])
  for (const p of inventario) h4.addRow({ ...p, proveedor: p.proveedor ?? '', valor: p.stock * p.costo, estado: !p.activo ? 'Inactivo' : p.stock <= 0 ? 'Agotado' : p.stock <= p.minimo ? 'Stock bajo' : 'En stock' })

  return { libro: Buffer.from(await libro.xlsx.writeBuffer()), resumen }
}

export interface OpcionesReporte {
  prisma: Prisma
  copias: Opciones
  correo: ConfigCorreo
  /** Solo para pruebas: un transporte falso en lugar del correo real. */
  transporte?: Transporter
  ahora?: Date
}

export async function enviarReporte(o: OpcionesReporte) {
  const ahora = o.ahora ?? new Date()
  const cfg = await leerConfig(o.prisma)
  const { desde, hasta } = semanaPasada(cfg.zonaHoraria, ahora)
  const { libro, resumen } = await generarExcel(o.prisma, desde, hasta)

  const adjuntos: { filename: string; content: Buffer }[] = [{ filename: `reporte-${desde}_a_${hasta}.xlsx`, content: libro }]
  if (o.correo.adjuntarCopia) {
    const copia = await crearCopia(o.copias, 'auto', ahora)
    adjuntos.push({ filename: copia.nombre, content: await readFile(rutaDeCopia(o.copias.carpeta, copia.nombre)) })
  }

  const transporte = o.transporte ?? nodemailer.createTransport({ host: o.correo.host, port: o.correo.port, secure: o.correo.secure, auth: { user: o.correo.user, pass: o.correo.pass } })
  const pesos = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`
  try {
    await transporte.sendMail({
      from: `"${cfg.nombreNegocio} · Nivel" <${o.correo.desde}>`,
      to: o.correo.para.join(', '),
      subject: `Reporte semanal de ${cfg.nombreNegocio} (${desde} a ${hasta})`,
      text: [
        `Resumen de la semana (${desde} a ${hasta}):`,
        `• Ventas netas: ${pesos(resumen.ventasNetas!)}`,
        `• Ganancia neta: ${pesos(resumen.ganancia!)}`,
        `• Ventas: ${resumen.tickets} (anuladas: ${resumen.anuladas})`,
        `• Productos con stock bajo: ${resumen.stockBajo}`,
        '',
        'Adjunto va el Excel con el detalle.',
        o.correo.adjuntarCopia ? 'También va la copia de seguridad (.zip). Guárdala: es la que sirve para restaurar el sistema si el computador se daña.' : '',
      ].filter(Boolean).join('\n'),
      attachments: adjuntos,
    })
  } catch (e) {
    // No se devuelve el mensaje crudo del servidor de correo (puede traer datos de la cuenta).
    console.error('[reporte] el correo no se pudo enviar:', e)
    throw reglaDeNegocio('CORREO_FALLO', 'No se pudo enviar el correo. Revisa los datos del correo en la configuración del servidor (SMTP) y la conexión a internet.')
  }
  return { enviadoA: o.correo.para, adjuntos: adjuntos.map((a) => a.filename), desde, hasta, resumen }
}

/* ───── Cuándo toca enviar: una vez cada 7 días. La fecha del último envío se guarda en un archivo junto a las copias. ───── */
const ARCHIVO = 'ultimo-reporte.json'
export async function haceFaltaReporte(carpeta: string, ahora = new Date(), dias = 7): Promise<boolean> {
  try {
    const { enviadoEn } = JSON.parse(await readFile(join(carpeta, ARCHIVO), 'utf-8')) as { enviadoEn: string }
    return ahora.getTime() - new Date(enviadoEn).getTime() >= dias * 86_400_000
  } catch {
    return true // nunca se ha enviado
  }
}
export const marcarReporteEnviado = (carpeta: string, ahora = new Date()) => writeFile(join(carpeta, ARCHIVO), JSON.stringify({ enviadoEn: ahora.toISOString() }))
