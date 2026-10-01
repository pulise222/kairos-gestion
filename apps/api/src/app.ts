import { existsSync } from 'node:fs'
import { join } from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import type { Prisma } from './db.js'
import { manejarErrores, rutaNoEncontrada } from './middleware/errores.js'
import { rutasAuth } from './modules/auth.js'
import { rutasCategorias, rutasProductos, rutasProveedores } from './modules/catalogo.js'
import { rutaMarcaPublica, rutasConfiguracion } from './modules/configuracion.js'
import { rutasDevolucionesProveedor, rutasDevolucionesVenta } from './modules/devoluciones.js'
import type { Transporter } from 'nodemailer'
import type { ConfigCorreo } from './lib/reporte.js'
import { rutasImportacion } from './modules/importacion.js'
import { rutasCopias } from './modules/copias.js'
import { rutasCompras, rutasInventario } from './modules/inventario.js'
import { rutasPanel } from './modules/panel.js'
import { rutasUsuarios } from './modules/usuarios.js'
import { rutasVentas } from './modules/ventas.js'

interface Opciones {
  prisma: Prisma
  jwtSecret: string
  corsOrigin?: string
  /** Se apaga en las pruebas automáticas para no bloquearlas. */
  limitarIntentos?: boolean
  /** Carpeta de las fotos de productos. */
  uploadsDir?: string
  /** Carpeta de las copias de seguridad y (opcional) una segunda carpeta donde repetirlas. */
  copiasDir?: string
  copiasExtraDir?: string
  /** Datos del correo del reporte semanal (null = apagado) y, solo en pruebas, un transporte falso. */
  correo?: ConfigCorreo | null
  /** Carpeta del front ya compilado (apps/web/dist). Si se indica, la API también sirve la pantalla: un solo programa, un solo puerto. */
  webDir?: string
  /** Carpeta de personalización del cliente (logo y paleta). */
  personalizacionDir?: string
  transporteCorreo?: Transporter
}

/**
 * Construye la aplicación Express. Recibe la conexión a la base de datos como parámetro
 * (inyección de dependencias): así las pruebas usan la base de pruebas y el servidor real, la suya.
 */
export function crearApp({ prisma, jwtSecret, corsOrigin, limitarIntentos = true, uploadsDir = './uploads', copiasDir = './copias', copiasExtraDir, correo = null, transporteCorreo, webDir, personalizacionDir = './personalizacion' }: Opciones) {
  const app = express()
  app.disable('x-powered-by')
  // El sistema se usa por HTTP dentro de la red del local (sin certificado). Por defecto helmet fuerza
  // HTTPS (HSTS y "upgrade-insecure-requests") y eso rompería el acceso desde la tablet o el celular.
  app.use(helmet({ hsts: false, contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null, // la vista previa de una foto recién elegida es una dirección «blob:»
    'img-src': ["'self'", 'data:', 'blob:'] } } }))
  if (corsOrigin) app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  // Salud: lo usarán Docker y el monitoreo para saber si la API y la base de datos responden.
  api.get('/salud', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ estado: 'ok' })
  })
  api.use(rutasAuth({ prisma, secreto: jwtSecret, limitarIntentos }))
  // Marca pública (nombre y apariencia) para la pantalla de acceso, antes de iniciar sesión.
  api.use('/marca', rutaMarcaPublica(prisma, personalizacionDir))
  api.use('/usuarios', rutasUsuarios(prisma, jwtSecret))
  api.use('/configuracion', rutasConfiguracion(prisma, jwtSecret))
  api.use('/categorias', rutasCategorias(prisma, jwtSecret))
  api.use('/proveedores', rutasDevolucionesProveedor(prisma, jwtSecret))
  api.use('/proveedores', rutasProveedores(prisma, jwtSecret))
  api.use('/productos', rutasImportacion(prisma, jwtSecret)) // antes que /:id, para que «importar» no se lea como un id
  api.use('/productos', rutasProductos(prisma, jwtSecret, uploadsDir))
  api.use('/ventas', rutasDevolucionesVenta(prisma, jwtSecret))
  api.use('/ventas', rutasVentas(prisma, jwtSecret))
  api.use('/compras', rutasCompras(prisma, jwtSecret))
  api.use('/inventario', rutasInventario(prisma, jwtSecret))
  api.use('/panel', rutasPanel(prisma, jwtSecret))
  api.use('/copias', rutasCopias(prisma, jwtSecret, { carpeta: copiasDir, fotos: uploadsDir, carpetaExtra: copiasExtraDir }, correo, transporteCorreo))

  // Las fotos son públicas por diseño (no tienen datos sensibles); los nombres son aleatorios.
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true, index: false, dotfiles: 'deny' }))
  app.use('/personalizacion', express.static(personalizacionDir, { index: false, dotfiles: 'deny', maxAge: '1h' }))
  app.use('/api', api)
  // Producción en un solo programa: la API entrega también la pantalla (los archivos con nombre único se guardan en caché).
  if (webDir && existsSync(join(webDir, 'index.html'))) {
    app.use(express.static(webDir, { index: 'index.html', setHeaders: (res, ruta) => { if (/[\\/]assets[\\/]/.test(ruta)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable') } }))
  }
  app.use(rutaNoEncontrada)
  app.use(manejarErrores)
  return app
}
