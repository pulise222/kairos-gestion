/*
  Mirar la base de datos sin saber SQL. Solo LEE: no modifica nada.

    npm run ver                      → resumen general
    npm run ver -- ventas [n]        → últimas n ventas con sus productos (por defecto 10)
    npm run ver -- stock             → cada producto con su stock y estado
    npm run ver -- movimientos [n]   → últimos n movimientos de stock (por defecto 15)
    npm run ver -- devoluciones [n]  → últimas devoluciones de clientes y a proveedores
    npm run ver -- usuarios          → usuarios y su estado
    npm run ver -- coherencia        → revisa que los datos cuadren (stock = suma de movimientos, etc.)

  Las horas se muestran en hora de Colombia.
*/
import { crearPrisma } from '../src/db.js'

const url = process.env.DATABASE_URL
if (!url) throw new Error('Falta DATABASE_URL')
const prisma = crearPrisma(url)

const [comando = 'resumen', argumento] = process.argv.slice(2)
const n = Math.min(Math.max(Number(argumento) || 0, 1), 200)

const tabla = (filas: object[]) => (filas.length ? console.table(filas) : console.log('(sin datos)'))
const pesos = (v: unknown) => `$${Number(v ?? 0).toLocaleString('es-CO')}`
const hora = (columna: string) => `to_char(${columna} AT TIME ZONE 'America/Bogota', 'DD-MM HH24:MI')`

async function resumen() {
  const [f] = await prisma.$queryRawUnsafe<Record<string, bigint | number>[]>(`
    SELECT
      (SELECT count(*) FROM venta WHERE estado = 'COMPLETADA') AS ventas,
      (SELECT count(*) FROM venta WHERE estado = 'ANULADA') AS anuladas,
      (SELECT count(*) FROM producto WHERE activo) AS productos,
      (SELECT count(*) FROM producto WHERE activo AND stock <= stock_minimo) AS stock_bajo,
      (SELECT count(*) FROM usuario WHERE activo) AS usuarios,
      (SELECT count(*) FROM movimiento_stock) AS movimientos`)
  console.log('\nRESUMEN GENERAL')
  console.table({ 'ventas completadas': Number(f!.ventas), 'ventas anuladas': Number(f!.anuladas), 'productos activos': Number(f!.productos), 'con stock bajo o agotados': Number(f!.stock_bajo), 'usuarios activos': Number(f!.usuarios), 'movimientos de stock': Number(f!.movimientos) })

  const hoy = await prisma.$queryRawUnsafe<{ ventas: bigint; total: bigint; ganancia: bigint }[]>(`
    SELECT count(*) AS ventas, COALESCE(sum(v.total), 0) AS total,
      COALESCE(sum((SELECT sum((i.precio_unitario - i.costo_unitario) * i.cantidad) FROM venta_item i WHERE i.venta_id = v.id)), 0) AS ganancia
    FROM venta v WHERE v.estado = 'COMPLETADA' AND (v.creada_en AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date`)
  console.log('HOY (hora de Colombia)')
  console.table({ 'ventas': Number(hoy[0]!.ventas), 'total vendido': pesos(hoy[0]!.total), 'ganancia': pesos(hoy[0]!.ganancia) })
}

async function ventas() {
  const lista = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT v.numero AS "n.º", ${hora('v.creada_en')} AS cuando, u.nombre AS vendedor, v.medio_pago AS medio,
      v.total, v.pagado, v.vueltas, v.estado,
      (SELECT string_agg(i.cantidad || ' × ' || i.nombre_producto, ', ' ORDER BY i.id) FROM venta_item i WHERE i.venta_id = v.id) AS productos
    FROM venta v JOIN usuario u ON u.id = v.usuario_id ORDER BY v.id DESC LIMIT ${n || 10}`)
  console.log(`\nÚLTIMAS ${lista.length} VENTAS`)
  tabla(lista.map((v) => ({ ...v, total: pesos(v.total), pagado: pesos(v.pagado), vueltas: pesos(v.vueltas) })))
}

async function stock() {
  const lista = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT p.codigo, p.nombre, c.nombre AS categoria, p.stock, p.stock_minimo AS "mínimo",
      CASE WHEN NOT p.activo THEN 'inactivo' WHEN p.stock <= 0 THEN 'AGOTADO' WHEN p.stock <= p.stock_minimo THEN 'bajo' ELSE 'ok' END AS estado,
      p.precio, p.costo
    FROM producto p JOIN categoria c ON c.id = p.categoria_id ORDER BY (p.stock::float / NULLIF(p.stock_minimo, 0)) NULLS FIRST, p.nombre`)
  console.log('\nSTOCK ACTUAL (lo más urgente primero)')
  tabla(lista.map((p) => ({ ...p, precio: pesos(p.precio), costo: pesos(p.costo) })))
}

async function movimientos() {
  const lista = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT m.id, ${hora('m.creado_en')} AS cuando, m.tipo, p.nombre AS producto, m.cantidad, m.stock_resultante AS "quedó en",
      COALESCE(m.motivo, '') AS motivo, u.nombre AS usuario
    FROM movimiento_stock m JOIN producto p ON p.id = m.producto_id JOIN usuario u ON u.id = m.usuario_id
    ORDER BY m.id DESC LIMIT ${n || 15}`)
  console.log(`\nÚLTIMOS ${lista.length} MOVIMIENTOS DE STOCK (+ sube, − baja)`)
  tabla(lista)
}

async function devoluciones() {
  const clientes = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT d.id, ${hora('d.creada_en')} AS cuando, v.numero AS "venta n.º", u.nombre AS quien, d.medio_reembolso AS medio, d.total, d.motivo,
      (SELECT string_agg(i.cantidad || ' × ' || i.nombre_producto || CASE WHEN i.reingresa_stock THEN '' ELSE ' (dañado)' END, ', ' ORDER BY i.id) FROM devolucion_item i WHERE i.devolucion_id = d.id) AS productos
    FROM devolucion d JOIN venta v ON v.id = d.venta_id JOIN usuario u ON u.id = d.usuario_id ORDER BY d.id DESC LIMIT ${n || 10}`)
  console.log('\nDEVOLUCIONES DE CLIENTES')
  tabla(clientes.map((d) => ({ ...d, total: pesos(d.total) })))

  const proveedores = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    SELECT d.id, ${hora('d.fecha')} AS cuando, p.nombre AS proveedor, d.compra_id AS "compra n.º", d.motivo, d.resolucion, d.total,
      (SELECT string_agg(i.cantidad || ' × ' || pr.nombre, ', ' ORDER BY i.id) FROM devolucion_proveedor_item i JOIN producto pr ON pr.id = i.producto_id WHERE i.devolucion_proveedor_id = d.id) AS productos
    FROM devolucion_proveedor d JOIN proveedor p ON p.id = d.proveedor_id ORDER BY d.id DESC LIMIT ${n || 10}`)
  console.log('DEVOLUCIONES A PROVEEDORES')
  tabla(proveedores.map((d) => ({ ...d, total: pesos(d.total) })))
}

async function usuarios() {
  console.log('\nUSUARIOS')
  tabla(await prisma.$queryRawUnsafe(`SELECT id, nombre, usuario, rol, activo, ${hora('creado_en')} AS creado FROM usuario ORDER BY id`))
}

/** Las reglas que el sistema garantiza. Si alguna falla, hay un error grave que investigar. */
async function coherencia() {
  const revisiones: [string, string][] = [
    ['El stock de cada producto es la SUMA de sus movimientos', `SELECT p.nombre AS producto, p.stock, (SELECT COALESCE(sum(cantidad), 0) FROM movimiento_stock m WHERE m.producto_id = p.id) AS suma FROM producto p WHERE p.stock <> (SELECT COALESCE(sum(cantidad), 0) FROM movimiento_stock m WHERE m.producto_id = p.id)`],
    ['El total de cada venta es la suma de sus líneas', `SELECT v.numero, v.total FROM venta v WHERE v.total <> (SELECT COALESCE(sum(cantidad * precio_unitario), 0) FROM venta_item i WHERE i.venta_id = v.id)`],
    ['Las vueltas de cada venta son exactamente pagado − total', `SELECT numero, total, pagado, vueltas FROM venta WHERE vueltas <> pagado - total`],
    ['Ninguna venta se pagó de menos', `SELECT numero, total, pagado FROM venta WHERE pagado < total`],
    ['El "quedó en" del último movimiento es el stock actual', `SELECT p.nombre, p.stock FROM producto p WHERE EXISTS (SELECT 1 FROM movimiento_stock m WHERE m.producto_id = p.id) AND p.stock <> (SELECT stock_resultante FROM movimiento_stock m WHERE m.producto_id = p.id ORDER BY creado_en DESC, id DESC LIMIT 1)`],
    ['Toda venta anulada tiene motivo', `SELECT numero FROM venta WHERE estado = 'ANULADA' AND (motivo_anulacion IS NULL OR motivo_anulacion = '')`],
    ['Los números de venta no se repiten', `SELECT numero, count(*) FROM venta GROUP BY numero HAVING count(*) > 1`],
    ['Nunca se devolvió más de lo vendido en una línea', `SELECT vi.id AS linea, vi.nombre_producto AS producto, vi.cantidad AS vendidas, sum(di.cantidad) AS devueltas FROM venta_item vi JOIN devolucion_item di ON di.venta_item_id = vi.id GROUP BY vi.id, vi.nombre_producto, vi.cantidad HAVING sum(di.cantidad) > vi.cantidad`],
    ['Ninguna venta anulada tiene devoluciones (se duplicaría el stock)', `SELECT v.numero FROM venta v WHERE v.estado = 'ANULADA' AND EXISTS (SELECT 1 FROM devolucion d WHERE d.venta_id = v.id)`],
    ['El total de cada devolución es la suma de sus líneas', `SELECT d.id, d.total FROM devolucion d WHERE d.total <> (SELECT COALESCE(sum(cantidad * precio_unitario), 0) FROM devolucion_item i WHERE i.devolucion_id = d.id)`],
    ['Cada producto devuelto en buen estado dejó su movimiento de stock', `SELECT di.id AS linea_devuelta FROM devolucion_item di WHERE di.reingresa_stock AND NOT EXISTS (SELECT 1 FROM movimiento_stock m WHERE m.devolucion_id = di.devolucion_id AND m.producto_id = di.producto_id AND m.tipo = 'DEVOLUCION_CLIENTE' AND m.cantidad = di.cantidad)`],
    ['Lo devuelto a proveedores nunca superó lo comprado en esa compra', `SELECT dp.compra_id, dpi.producto_id, sum(dpi.cantidad) AS devueltos, (SELECT ci.cantidad FROM compra_item ci WHERE ci.compra_id = dp.compra_id AND ci.producto_id = dpi.producto_id) AS comprados FROM devolucion_proveedor dp JOIN devolucion_proveedor_item dpi ON dpi.devolucion_proveedor_id = dp.id WHERE dp.compra_id IS NOT NULL GROUP BY dp.compra_id, dpi.producto_id HAVING sum(dpi.cantidad) > COALESCE((SELECT ci.cantidad FROM compra_item ci WHERE ci.compra_id = dp.compra_id AND ci.producto_id = dpi.producto_id), 0)`],
    ['Hay al menos un dueño activo', `SELECT 'sin dueño activo' AS problema WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE rol = 'DUENO' AND activo)`],
  ]
  console.log('\nREVISIÓN DE COHERENCIA')
  let problemas = 0
  for (const [nombre, sql] of revisiones) {
    const filas = await prisma.$queryRawUnsafe<object[]>(sql)
    if (filas.length === 0) console.log(`  ✔ ${nombre}`)
    else {
      problemas++
      console.log(`  ✖ ${nombre}  → ${filas.length} problema(s):`)
      console.table(filas.slice(0, 10))
    }
  }
  // El stock negativo no es un error si el dueño permite vender sin stock: se informa aparte.
  const neg = await prisma.$queryRawUnsafe<object[]>(`SELECT nombre, stock FROM producto WHERE stock < 0`)
  if (neg.length) { console.log('  ℹ Hay productos con stock negativo (solo es normal si activaste «vender con stock en cero»):'); console.table(neg) }
  console.log(problemas === 0 ? '\nTodo cuadra.\n' : `\n${problemas} revisión(es) con problemas.\n`)
  process.exitCode = problemas === 0 ? 0 : 1
}

const comandos: Record<string, () => Promise<void>> = { resumen, ventas, stock, movimientos, devoluciones, usuarios, coherencia }
const accion = comandos[comando]
if (!accion) {
  console.error(`Comando desconocido: "${comando}". Usa: ${Object.keys(comandos).join(', ')}`)
  process.exitCode = 1
} else {
  await accion()
}
await prisma.$disconnect()
