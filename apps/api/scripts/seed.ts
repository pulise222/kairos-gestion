/*
  Datos de PRUEBA para desarrollo. Crea un negocio de ejemplo con catálogo, proveedores, dos usuarios y
  45 días de historial de ventas realista, para poder ver la app funcionando.

    npm run seed          → vacía la base de DESARROLLO y la llena con datos de ejemplo
    npm run db:vaciar     → solo la vacía (para probar el asistente de primer arranque)

  El historial es COHERENTE como el del sistema real: el stock de cada producto es la suma de sus
  movimientos, las compras reponen lo que se agota y algunas ventas se anulan.
  Es determinista (misma semilla = mismos datos) y se niega a correr si no es la base "nivel" de desarrollo.
*/
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { crearPrisma } from '../src/db.js'
import { CONFIG_POR_DEFECTO } from '../src/modules/configuracion.js'
import { normalizar } from '../src/lib/texto.js'

const args = process.argv.slice(2)
const soloVaciar = args.includes('--vacio')

// ── Seguridad: esto BORRA TODO. Solo en la base de desarrollo y a propósito. ──
const url = process.env.DATABASE_URL
if (!url) throw new Error('Falta DATABASE_URL')
if (process.env.NODE_ENV === 'production') throw new Error('Negado: no se cargan datos de prueba en producción')
if (new URL(url).pathname !== '/nivel') throw new Error('Negado: este script solo corre contra la base de desarrollo "nivel"')
if (!args.includes('--si')) throw new Error('Esto BORRA todos los datos de la base de desarrollo. Ejecútalo con "npm run seed".')

const prisma = crearPrisma(url)

await prisma.$executeRawUnsafe(
  'TRUNCATE TABLE cierre_caja, comentario, movimiento_stock, historial_precio, devolucion_item, devolucion, devolucion_proveedor_item, devolucion_proveedor, venta_item, venta, compra_item, compra, producto, categoria, proveedor, configuracion, usuario RESTART IDENTITY CASCADE',
)
if (soloVaciar) {
  console.log('Base de desarrollo vaciada. Al abrir la app verás el asistente de primer arranque.')
  await prisma.$disconnect()
  process.exit(0)
}

const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta ${k} en .env (mira .env.example)`)
  return v
}

// ── Generador pseudoaleatorio con semilla (mulberry32) ──
let semilla = 2026
const rnd = () => {
  semilla = (semilla + 0x6d2b79f5) >>> 0
  let t = semilla
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const elegirPonderado = <T>(items: T[], pesos: number[]): T => {
  let r = rnd() * pesos.reduce((s, p) => s + p, 0)
  for (let i = 0; i < items.length; i++) {
    r -= pesos[i]!
    if (r <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

// ── Usuarios y configuración ──
const dueno = await prisma.usuario.create({
  data: { nombre: 'Juan Pulido', usuario: env('SEED_DUENO_USUARIO').toLowerCase(), contrasenaHash: await bcrypt.hash(env('SEED_DUENO_CLAVE'), 12), rol: 'DUENO' },
})
const vendedor = await prisma.usuario.create({
  data: { nombre: 'María Gómez', usuario: env('SEED_VENDEDOR_USUARIO').toLowerCase(), contrasenaHash: await bcrypt.hash(env('SEED_VENDEDOR_CLAVE'), 12), rol: 'VENDEDOR' },
})

const config = { ...CONFIG_POR_DEFECTO, nombreNegocio: 'Tienda Don Pepe', nit: '900.123.456-7', direccion: 'Cra 10 # 20-30, Bogotá', telefono: '300 123 4567', metaDiaria: 1_800_000 }
for (const [clave, valor] of Object.entries(config)) await prisma.configuracion.create({ data: { clave, valor: valor as never } })

// ── Catálogo ──
const categorias = new Map<string, number>()
for (const [nombre, color] of [['Bebidas', '#2f7fb8'], ['Aseo', '#2e9e8f'], ['Abarrotes', '#b8892a'], ['Lácteos', '#7a6bb8'], ['Snacks', '#c2543f']] as const) {
  categorias.set(nombre, (await prisma.categoria.create({ data: { nombre, color } })).id)
}

const provDatos = [
  ['Distribuciones Andina', '300 123 4567', 'pedidos@andina.co', 'Pasa los martes. Pedido mínimo $150.000.', true],
  ['Aseo Total', '310 987 6543', null, 'Entrega a domicilio sin costo.', true],
  ['Alimentos del Valle', '315 222 3344', 'ventas@alimentosvalle.co', null, true],
  ['Lácteos La Sabana', '320 555 6677', null, 'Producto refrigerado: recibir antes de las 10 a. m.', true],
  ['Panadería Central', '301 111 2233', null, null, true],
  ['Dulces Tropical', '312 444 5566', null, 'Ya no trabajamos con ellos.', false],
] as const
const proveedores: number[] = []
for (const [nombre, telefono, correo, notas, activo] of provDatos) proveedores.push((await prisma.proveedor.create({ data: { nombre, telefono, correo, notas, activo } })).id)

// [código, nombre, categoría, proveedor (1 a 5), precio, costo, stock objetivo hoy, mínimo]
const catalogo: [string, string, string, number, number, number, number, number][] = [
  ['101', 'Gaseosa 1.5 L', 'Bebidas', 1, 4500, 3200, 3, 12],
  ['102', 'Agua 600 ml', 'Bebidas', 1, 1800, 1100, 48, 24],
  ['103', 'Jugo de naranja 1 L', 'Bebidas', 1, 5200, 3800, 20, 8],
  ['104', 'Cerveza 330 ml', 'Bebidas', 1, 3000, 2100, 36, 24],
  ['201', 'Detergente 1 kg', 'Aseo', 2, 12500, 9000, 2, 6],
  ['202', 'Jabón de baño', 'Aseo', 2, 2800, 1900, 0, 10],
  ['203', 'Papel higiénico x4', 'Aseo', 2, 7800, 5600, 15, 8],
  ['7701001000008', 'Arroz 1 kg', 'Abarrotes', 3, 4200, 3300, 40, 15],
  ['7701001000009', 'Aceite 1 L', 'Abarrotes', 3, 11500, 9200, 14, 6],
  ['7701001000010', 'Azúcar 1 kg', 'Abarrotes', 3, 4800, 3900, 22, 10],
  ['7701001000011', 'Pan tajado', 'Abarrotes', 5, 5600, 4100, 9, 8],
  ['7701001000012', 'Leche 1 L', 'Lácteos', 4, 4300, 3500, 30, 12],
  ['7701001000013', 'Huevos x12', 'Lácteos', 4, 9500, 7600, 18, 10],
  ['7701001000014', 'Queso campesino', 'Lácteos', 4, 8500, 6400, 7, 4],
  ['7701001000015', 'Galletas de sal', 'Snacks', 3, 2800, 1900, 8, 10],
  ['7701001000016', 'Papas fritas', 'Snacks', 3, 2500, 1700, 26, 12],
  ['7701001000017', 'Chocolatina', 'Snacks', 3, 1800, 1200, 60, 20],
]

// Fotos de ejemplo: se toman de las de la demo (apps/web/public/productos) y se copian a la carpeta de fotos del sistema
// con nombres generados, igual que cuando el dueño sube una foto. Se limpian antes las fotos viejas de otras cargas.
const carpetaFotos = process.env.UPLOADS_DIR ?? './uploads'
const carpetaOrigen = join(import.meta.dirname, '..', '..', 'web', 'public', 'productos')
mkdirSync(carpetaFotos, { recursive: true })
for (const f of readdirSync(carpetaFotos)) if (/^[0-9a-f]{24}\.(png|jpg|webp)$/.test(f)) unlinkSync(join(carpetaFotos, f))
const nombreArchivo = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function fotoDe(nombre: string): string | null {
  const origen = join(carpetaOrigen, nombreArchivo(nombre) + '.webp')
  if (!existsSync(origen)) return null
  const archivo = `${randomBytes(12).toString('hex')}.webp`
  copyFileSync(origen, join(carpetaFotos, archivo))
  return `/uploads/${archivo}`
}

interface P { id: number; nombre: string; precio: number; costo: number; minimo: number; proveedorId: number; objetivo: number; peso: number }
const productos: P[] = []
for (const [codigo, nombre, cat, prov, precio, costo, objetivo, minimo] of catalogo) {
  const p = await prisma.producto.create({
    data: { codigo, nombre, busqueda: normalizar(nombre), categoriaId: categorias.get(cat)!, proveedorId: proveedores[prov - 1]!, precio, costo, stock: 0, stockMinimo: minimo, imagen: fotoDe(nombre) },
  })
  productos.push({ id: p.id, nombre, precio, costo, minimo, proveedorId: proveedores[prov - 1]!, objetivo, peso: ((p.id * 37) % 11) + 3 })
}

// ── Simulación de 45 días (cronológica, para que el stock y los movimientos cuadren) ──
const DIAS = 45
const stock = new Map<number, number>()
const ahora = new Date()
const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // AAAA-MM-DD en hora de Colombia
const sumarDias = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const instante = (fecha: string, hora: number, minuto = 0) => new Date(`${fecha}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-05:00`)
const FACTOR_SEMANA = [0.9, 0.75, 0.8, 0.85, 0.95, 1.2, 1.45] // domingo a sábado

// Stock inicial: hace 45 días hay de sobra.
const inicio = sumarDias(hoy, -DIAS)
for (const p of productos) {
  const s0 = p.minimo * 3 + entre(15, 40)
  stock.set(p.id, s0)
  await prisma.movimientoStock.create({ data: { productoId: p.id, tipo: 'AJUSTE', cantidad: s0, stockResultante: s0, motivo: 'Stock inicial', usuarioId: dueno.id, creadoEn: instante(inicio, 7) } })
}

let ventasCreadas = 0
let comprasCreadas = 0
let anuladas = 0

for (let d = -DIAS + 1; d <= 0; d++) {
  const fecha = sumarDias(hoy, d)
  const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay()

  // Reposición de la mañana: lo que quedó bajo el mínimo se pide al proveedor (no en los últimos 2 días: así quedan alertas).
  if (d < -1) {
    const porProveedor = new Map<number, P[]>()
    for (const p of productos) {
      if (stock.get(p.id)! <= p.minimo && rnd() < 0.7) porProveedor.set(p.proveedorId, [...(porProveedor.get(p.proveedorId) ?? []), p])
    }
    for (const [proveedorId, lista] of porProveedor) {
      const lineas = lista.map((p) => ({ productoId: p.id, cantidad: Math.max(p.minimo * 3 - stock.get(p.id)!, 1), costoUnitario: p.costo }))
      const fechaCompra = instante(fecha, 8, entre(0, 30))
      const compra = await prisma.compra.create({
        data: { proveedorId, usuarioId: dueno.id, total: lineas.reduce((s, l) => s + l.cantidad * l.costoUnitario, 0), fecha: fechaCompra, items: { create: lineas } },
      })
      comprasCreadas++
      for (const l of lineas) {
        const nuevo = stock.get(l.productoId)! + l.cantidad
        stock.set(l.productoId, nuevo)
        await prisma.movimientoStock.create({ data: { productoId: l.productoId, tipo: 'ENTRADA', cantidad: l.cantidad, stockResultante: nuevo, motivo: 'Entrada de mercancía', compraId: compra.id, usuarioId: dueno.id, creadoEn: fechaCompra } })
      }
    }
  }

  // Ventas del día, en orden de hora (así el consecutivo es cronológico).
  let cantidad = Math.round(38 * FACTOR_SEMANA[dow]! * (0.85 + rnd() * 0.3))
  const limiteHora = d === 0 ? Math.min(20 * 60, Math.max(0, ahora.getUTCHours() * 60 + ahora.getUTCMinutes() - 5 * 60 - 3)) : 20 * 60 // hoy: hasta hace unos minutos (hora de Colombia = UTC−5)
  if (d === 0) cantidad = Math.round((cantidad * Math.max(limiteHora - 8 * 60, 0)) / (12 * 60))
  const minutos = Array.from({ length: cantidad }, () => 8 * 60 + Math.floor(rnd() * Math.max(limiteHora - 8 * 60, 1))).sort((a, b) => a - b)

  for (const m of minutos) {
    if (d === 0 && m >= limiteHora) continue
    const cuando = instante(fecha, Math.floor(m / 60), m % 60)
    const k = elegirPonderado([1, 2, 3, 4], [0.4, 0.3, 0.2, 0.1])
    const elegidos = new Map<number, number>()
    for (let i = 0; i < k; i++) {
      const p = elegirPonderado(productos, productos.map((x) => x.peso))
      const q = Math.min(elegirPonderado([1, 2, 3], [0.6, 0.3, 0.1]), stock.get(p.id)!)
      if (q > 0 && !elegidos.has(p.id)) elegidos.set(p.id, q)
    }
    if (elegidos.size === 0) continue

    const lineas = [...elegidos].map(([id, q]) => ({ p: productos.find((x) => x.id === id)!, q })).sort((a, b) => a.p.id - b.p.id)
    const total = lineas.reduce((s, l) => s + l.p.precio * l.q, 0)
    const efectivo = rnd() < 0.8
    const pagado = efectivo ? Math.max(total, elegirPonderado([Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000], [0.35, 0.3, 0.25, 0.1])) : total
    const vende = rnd() < 0.7 ? vendedor : dueno

    const venta = await prisma.venta.create({
      data: {
        usuarioId: vende.id, total, pagado, vueltas: pagado - total, medioPago: efectivo ? 'EFECTIVO' : 'TRANSFERENCIA', creadaEn: cuando,
        items: { create: lineas.map((l) => ({ productoId: l.p.id, nombreProducto: l.p.nombre, cantidad: l.q, precioUnitario: l.p.precio, costoUnitario: l.p.costo })) },
      },
      select: { id: true },
    })
    ventasCreadas++
    const movs = lineas.map((l) => {
      const nuevo = stock.get(l.p.id)! - l.q
      stock.set(l.p.id, nuevo)
      return { productoId: l.p.id, tipo: 'VENTA' as const, cantidad: -l.q, stockResultante: nuevo, ventaId: venta.id, usuarioId: vende.id, creadoEn: cuando }
    })
    await prisma.movimientoStock.createMany({ data: movs })

    // ~1,5 % de las ventas se anulan a los pocos minutos (error de digitación).
    if (d < 0 && rnd() < 0.015) {
      const despues = new Date(cuando.getTime() + 10 * 60_000)
      await prisma.venta.update({ where: { id: venta.id }, data: { estado: 'ANULADA', motivoAnulacion: 'Error de digitación', anuladaEn: despues, anuladaPorId: dueno.id } })
      anuladas++
      for (const l of lineas) {
        const nuevo = stock.get(l.p.id)! + l.q
        stock.set(l.p.id, nuevo)
        await prisma.movimientoStock.create({ data: { productoId: l.p.id, tipo: 'ANULACION', cantidad: l.q, stockResultante: nuevo, motivo: 'Error de digitación', ventaId: venta.id, usuarioId: dueno.id, creadoEn: despues } })
      }
    }
  }
}

// Conteo físico de hoy: deja algunos productos bajos o agotados para que el Panel muestre alertas.
const hace1Min = new Date(ahora.getTime() - 60_000)
for (const p of productos) {
  const actual = stock.get(p.id)!
  if (actual === p.objetivo) continue
  const delta = p.objetivo - actual
  // Solo se fuerza el objetivo en los productos pensados para estar bajos; el resto conserva lo simulado.
  if (p.objetivo > p.minimo) continue
  stock.set(p.id, p.objetivo)
  await prisma.movimientoStock.create({ data: { productoId: p.id, tipo: 'AJUSTE', cantidad: delta, stockResultante: p.objetivo, motivo: 'Conteo del inventario', usuarioId: dueno.id, creadoEn: hace1Min } })
}

for (const [id, s] of stock) await prisma.producto.update({ where: { id }, data: { stock: s } })

console.log(`Datos de prueba listos: ${productos.length} productos, ${proveedores.length} proveedores, ${comprasCreadas} compras, ${ventasCreadas} ventas (${anuladas} anuladas), 2 usuarios.`)
console.log('Las claves de prueba están en apps/api/.env (variables SEED_*).')
await prisma.$disconnect()
