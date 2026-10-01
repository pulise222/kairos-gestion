import { mkdir } from 'node:fs/promises'
import { crearApp } from './app.js'
import { crearCopia, haceFaltaCopiaAuto } from './lib/copias.js'
import { guardarExcelDiario, enviarReporte, haceFaltaReporte, leerConfigCorreo, marcarReporteEnviado } from './lib/reporte.js'
import { leerEnv } from './config/env.js'
import { crearPrisma } from './db.js'

const env = leerEnv()
const prisma = crearPrisma(env.DATABASE_URL)
const correo = leerConfigCorreo(process.env)
const app = crearApp({ correo, prisma, jwtSecret: env.JWT_SECRET, corsOrigin: env.CORS_ORIGIN, uploadsDir: env.UPLOADS_DIR, copiasDir: env.COPIAS_DIR, webDir: env.WEB_DIR, personalizacionDir: env.PERSONALIZACION_DIR, copiasExtraDir: env.COPIAS_EXTRA_DIR })

const servidor = app.listen(env.PORT, () => console.log(`API de Nivel escuchando en http://localhost:${env.PORT}/api`))

// Copia automática: cada 30 minutos se mira si la última copia automática tiene 24 horas o más y, si es así, se hace otra.
// (Así no importa a qué hora se encienda el PC del negocio: en cuanto lleva un rato prendido, se respalda.)
const opcionesCopia = { prisma, carpeta: env.COPIAS_DIR, fotos: env.UPLOADS_DIR, carpetaExtra: env.COPIAS_EXTRA_DIR }
const revisarCopia = async () => {
  try {
    if (!(await haceFaltaCopiaAuto(env.COPIAS_DIR))) return
    const r = await crearCopia(opcionesCopia, 'auto')
    console.log(`[copias] copia automática ${r.nombre} (${r.filas} filas, ${r.fotos} fotos${r.copiaExtra === 'error' ? `; NO se pudo repetir en la carpeta extra: ${r.errorExtra}` : ''})`)
  } catch (e) {
    console.error('[copias] la copia automática falló:', e) // se reintenta en 30 minutos
  }
}
// Excel de respaldo: una vez al día se deja un libro con los últimos 30 días en una carpeta visible (EXCEL_DIR), por si hay que abrirlo sin el sistema.
const carpetaExcel = process.env.EXCEL_DIR ?? './datos/excel'
const revisarExcel = async () => {
  try {
    const ruta = await guardarExcelDiario(prisma, carpetaExcel)
    if (ruta) console.log(`[excel] respaldo guardado: ${ruta}`)
  } catch (e) {
    console.error('[excel] no se pudo guardar el respaldo en Excel:', e)
  }
}
setTimeout(revisarCopia, 60_000)
setTimeout(revisarExcel, 90_000)
// Reporte semanal por correo (solo si el correo está configurado): una vez cada 7 días.
const revisarReporte = async () => {
  if (!correo) return
  try {
    if (!(await haceFaltaReporte(env.COPIAS_DIR))) return
    const r = await enviarReporte({ prisma, copias: opcionesCopia, correo })
    await mkdir(env.COPIAS_DIR, { recursive: true })
    await marcarReporteEnviado(env.COPIAS_DIR)
    console.log(`[reporte] enviado a ${r.enviadoA.join(', ')} (${r.desde} a ${r.hasta})`)
  } catch (e) {
    console.error('[reporte] falló el envío semanal:', e) // se reintenta en 30 minutos
  }
}
setTimeout(revisarReporte, 120_000)
const reloj = setInterval(() => { void revisarCopia(); void revisarReporte(); void revisarExcel() }, 30 * 60_000)

// Cierre ordenado: termina las peticiones en curso y cierra la conexión a la base de datos.
const cerrar = async () => {
  clearInterval(reloj)
  servidor.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
