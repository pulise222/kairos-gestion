import { copyFile, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { Prisma } from '../db.js'
import { conflicto, noEncontrado, reglaDeNegocio } from '../errors.js'

/*
  Copias de seguridad hechas en Node (sin pg_dump, que no viene en un PC normal).
  Una copia es un .zip con:
    · datos.json → TODAS las tablas de la base de datos (cada fila como JSON) + la versión del esquema.
    · fotos/…    → las fotos de los productos.
  Restaurar reemplaza todo en UNA transacción: o queda como la copia, o no cambia nada.
  Reglas de seguridad:
    · una copia solo se restaura si es de la MISMA versión del esquema (si no, las columnas no coinciden);
    · antes de restaurar se guarda una copia «previa» del estado actual (por si fue un error);
    · después de crear una copia se vuelve a leer y se comprueba (una copia sin verificar no es una copia).
*/

export type TipoCopia = 'auto' | 'manual' | 'previa'
export interface InfoCopia { nombre: string; tipo: TipoCopia; tamano: number; creadaEn: string }
export interface ResultadoCopia extends InfoCopia { filas: number; fotos: number; copiaExtra: 'ok' | 'sin_configurar' | 'error'; errorExtra?: string }

const NOMBRE = /^nivel-copia-(\d{8})-(\d{6})-(auto|manual|previa)\.zip$/
/** Cuántas copias se conservan por tipo (las más recientes). */
const CONSERVAR: Record<TipoCopia, number> = { auto: 30, manual: 50, previa: 5 }
const FOTO = /^[0-9a-f]{24}\.(png|jpg|webp)$/

const q = (t: string) => `"${t.replace(/"/g, '""')}"`

/** Fecha y hora en la zona del negocio con formato AAAAMMDD-HHMMSS (para el nombre del archivo). */
function sello(ahora: Date, zona: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(ahora).map((x) => [x.type, x.value]))
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`
}

/** Convierte "20261001-134500" (hora del negocio, UTC−5 sin horario de verano) en el instante real. */
function instanteDe(nombre: string, zona: string): Date {
  const m = NOMBRE.exec(nombre)!
  const [a, mes, d] = [m[1]!.slice(0, 4), m[1]!.slice(4, 6), m[1]!.slice(6, 8)]
  const [h, mi, s] = [m[2]!.slice(0, 2), m[2]!.slice(2, 4), m[2]!.slice(4, 6)]
  // Se prueba con la zona real: se parte de la hora como si fuera UTC y se corrige con el desfase de esa zona.
  const supuesto = new Date(`${a}-${mes}-${d}T${h}:${mi}:${s}Z`)
  const enZona = new Date(supuesto.toLocaleString('en-US', { timeZone: zona }))
  const enUtc = new Date(supuesto.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(supuesto.getTime() + (enUtc.getTime() - enZona.getTime()))
}

async function tablasEnOrden(prisma: Prisma): Promise<string[]> {
  const tablas = (await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name`,
  )).map((x) => x.t)
  const fks = await prisma.$queryRawUnsafe<{ hija: string; padre: string }[]>(
    `SELECT c.conrelid::regclass::text AS hija, c.confrelid::regclass::text AS padre FROM pg_constraint c WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`,
  )
  // Orden topológico: una tabla va después de aquellas a las que apunta (las "padre").
  const deps = new Map(tablas.map((t) => [t, new Set<string>()]))
  for (const f of fks) {
    const h = f.hija.replace(/"/g, '')
    const p = f.padre.replace(/"/g, '')
    if (h !== p && deps.has(h) && deps.has(p)) deps.get(h)!.add(p)
  }
  const orden: string[] = []
  const hechas = new Set<string>()
  while (orden.length < tablas.length) {
    const lista = tablas.filter((t) => !hechas.has(t) && [...deps.get(t)!].every((d) => hechas.has(d)))
    if (lista.length === 0) throw new Error('Las tablas tienen una dependencia circular: no se puede ordenar la copia')
    for (const t of lista) { orden.push(t); hechas.add(t) }
  }
  return orden
}

const versionEsquema = async (prisma: Prisma) =>
  (await prisma.$queryRawUnsafe<{ n: string }[]>(`SELECT migration_name AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1`))[0]?.n ?? 'desconocida'

async function leerFotos(carpeta: string): Promise<Record<string, Uint8Array>> {
  const r: Record<string, Uint8Array> = {}
  for (const f of await readdir(carpeta).catch(() => [] as string[])) {
    if (FOTO.test(f)) r[`fotos/${f}`] = new Uint8Array(await readFile(join(carpeta, f)))
  }
  return r
}

export interface Opciones {
  prisma: Prisma
  /** Carpeta donde se guardan las copias. */
  carpeta: string
  /** Carpeta de las fotos de productos. */
  fotos: string
  /** Segunda carpeta (otro disco, USB, OneDrive…) donde se repite cada copia. Opcional. */
  carpetaExtra?: string
  zona?: string
}

let ocupado = false
/** Solo una copia o restauración a la vez: dos juntas se pisarían. */
async function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
  if (ocupado) throw conflicto('OCUPADO', 'Ya hay una copia o una restauración en curso. Espera a que termine.')
  ocupado = true
  try { return await fn() } finally { ocupado = false }
}

export async function crearCopia(o: Opciones, tipo: TipoCopia, ahora = new Date()): Promise<ResultadoCopia> {
  return exclusivo(() => crearCopiaInterna(o, tipo, ahora))
}

async function crearCopiaInterna(o: Opciones, tipo: TipoCopia, ahora: Date): Promise<ResultadoCopia> {
  const zona = o.zona ?? 'America/Bogota'
  const tablas = await tablasEnOrden(o.prisma)
  // Se lee todo dentro de UNA transacción de solo lectura con aislamiento "repeatable read":
  // aunque se esté vendiendo mientras tanto, la copia es una foto coherente de un solo instante.
  const datos: Record<string, unknown[]> = {}
  await o.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    for (const t of tablas) datos[t] = (await tx.$queryRawUnsafe<{ fila: unknown }[]>(`SELECT row_to_json(x) AS fila FROM ${q(t)} x`)).map((r) => r.fila)
  }, { timeout: 120_000 })

  const fotos = await leerFotos(o.fotos)
  const contenido = { version: 1, creadaEn: ahora.toISOString(), esquema: await versionEsquema(o.prisma), tablas: datos }
  const zip = zipSync({ 'datos.json': strToU8(JSON.stringify(contenido)), ...fotos }, { level: 6 })

  const nombre = `nivel-copia-${sello(ahora, zona)}-${tipo}.zip`
  await mkdir(o.carpeta, { recursive: true })
  const destino = join(o.carpeta, nombre)
  // Se escribe con nombre temporal y se renombra al final: nunca queda una copia a medias con nombre válido.
  await writeFile(`${destino}.tmp`, zip)
  try {
    verificar(await readFile(`${destino}.tmp`), datos, Object.keys(fotos).length)
  } catch (e) {
    await unlink(`${destino}.tmp`).catch(() => {})
    throw e
  }
  await rename(`${destino}.tmp`, destino)

  let copiaExtra: ResultadoCopia['copiaExtra'] = 'sin_configurar'
  let errorExtra: string | undefined
  if (o.carpetaExtra) {
    try {
      await mkdir(o.carpetaExtra, { recursive: true })
      await copyFile(destino, join(o.carpetaExtra, nombre))
      copiaExtra = 'ok'
    } catch (e) {
      copiaExtra = 'error'
      errorExtra = e instanceof Error ? e.message : String(e)
    }
  }
  await rotar(o.carpeta)
  return {
    nombre, tipo, tamano: zip.length, creadaEn: ahora.toISOString(),
    filas: Object.values(datos).reduce((s, f) => s + f.length, 0), fotos: Object.keys(fotos).length, copiaExtra, errorExtra,
  }
}

/** Abre el zip recién escrito y comprueba que trae lo mismo que se leyó de la base. */
function verificar(bytes: Uint8Array, esperado: Record<string, unknown[]>, fotos: number) {
  const z = unzipSync(bytes)
  const datos = JSON.parse(strFromU8(z['datos.json']!)) as { tablas: Record<string, unknown[]> }
  for (const [t, filas] of Object.entries(esperado)) {
    if (datos.tablas[t]?.length !== filas.length) throw new Error(`La copia no pasó la verificación: la tabla ${t} no coincide`)
  }
  if (Object.keys(z).filter((k) => k.startsWith('fotos/')).length !== fotos) throw new Error('La copia no pasó la verificación: faltan fotos')
}

export async function listarCopias(carpeta: string, zona = 'America/Bogota'): Promise<InfoCopia[]> {
  const nombres = (await readdir(carpeta).catch(() => [] as string[])).filter((n) => NOMBRE.test(n))
  const lista = await Promise.all(nombres.map(async (nombre) => ({
    nombre, tipo: NOMBRE.exec(nombre)![3] as TipoCopia, tamano: (await stat(join(carpeta, nombre))).size, creadaEn: instanteDe(nombre, zona).toISOString(),
  })))
  return lista.sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
}

async function rotar(carpeta: string) {
  const lista = await listarCopias(carpeta)
  for (const tipo of Object.keys(CONSERVAR) as TipoCopia[]) {
    for (const c of lista.filter((x) => x.tipo === tipo).slice(CONSERVAR[tipo])) await unlink(join(carpeta, c.nombre)).catch(() => {})
  }
}

/** Ruta segura de una copia por nombre (rechaza cualquier intento de salirse de la carpeta). */
export function rutaDeCopia(carpeta: string, nombre: string): string {
  if (!NOMBRE.test(nombre) || basename(nombre) !== nombre) throw noEncontrado('La copia')
  return join(carpeta, nombre)
}

export async function restaurarCopia(o: Opciones, nombre: string): Promise<{ filas: number; fotos: number; copiaPrevia: string }> {
  const ruta = rutaDeCopia(o.carpeta, nombre)
  const bytes = await readFile(ruta).catch(() => { throw noEncontrado('La copia') })
  let z: ReturnType<typeof unzipSync>
  let contenido: { esquema: string; tablas: Record<string, Record<string, unknown>[]> }
  try {
    z = unzipSync(bytes)
    contenido = JSON.parse(strFromU8(z['datos.json']!))
  } catch {
    throw reglaDeNegocio('COPIA_DANADA', 'El archivo de la copia está dañado o no es una copia de este sistema.')
  }
  const actual = await versionEsquema(o.prisma)
  if (contenido.esquema !== actual) {
    throw reglaDeNegocio('COPIA_OTRA_VERSION', `Esta copia es de otra versión del sistema (${contenido.esquema}) y no se puede restaurar en esta (${actual}).`)
  }
  const tablas = await tablasEnOrden(o.prisma)
  const desconocidas = Object.keys(contenido.tablas).filter((t) => !tablas.includes(t))
  if (desconocidas.length || tablas.some((t) => !(t in contenido.tablas))) throw reglaDeNegocio('COPIA_DANADA', 'La copia no tiene las mismas tablas que el sistema.')

  // Red de seguridad: se guarda cómo estaba todo ANTES de reemplazarlo.
  const previa = await crearCopia(o, 'previa')

  // Columnas con contador automático (no solo «id»: la venta también tiene «numero», su consecutivo visible).
  const contadores = await o.prisma.$queryRawUnsafe<{ t: string; c: string }[]>(
    `SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval%'`,
  )

  return exclusivo(async () => {
    await o.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE ${tablas.map(q).join(', ')} RESTART IDENTITY CASCADE`)
      for (const t of tablas) {
        const filas = contenido.tablas[t]!
        if (filas.length) await tx.$executeRawUnsafe(`INSERT INTO ${q(t)} SELECT * FROM json_populate_recordset(null::${q(t)}, $1::json)`, JSON.stringify(filas))
        // Los contadores de id continúan después del mayor id restaurado (si no, el siguiente registro chocaría).
        for (const { c } of contadores.filter((x) => x.t === t)) {
          await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('${q(t)}', '${c}'), (SELECT COALESCE(MAX(${q(c)}), 0) + 1 FROM ${q(t)}), false)`)
        }
      }
    }, { timeout: 180_000 })

    // Fotos: la carpeta queda igual que cuando se hizo la copia.
    await mkdir(o.fotos, { recursive: true })
    for (const f of await readdir(o.fotos)) if (FOTO.test(f)) await unlink(join(o.fotos, f)).catch(() => {})
    let fotos = 0
    for (const [k, v] of Object.entries(z)) {
      const f = k.replace(/^fotos\//, '')
      if (k.startsWith('fotos/') && FOTO.test(f)) { await writeFile(join(o.fotos, f), v); fotos++ }
    }
    return { filas: Object.values(contenido.tablas).reduce((s, f) => s + f.length, 0), fotos, copiaPrevia: previa.nombre }
  })
}

/** Para el programador: ¿hace falta una copia automática? (la última automática tiene más de `horas` horas). */
export async function haceFaltaCopiaAuto(carpeta: string, ahora = new Date(), horas = 24): Promise<boolean> {
  const ultima = (await listarCopias(carpeta)).find((c) => c.tipo === 'auto')
  return !ultima || ahora.getTime() - new Date(ultima.creadaEn).getTime() >= horas * 3_600_000
}
