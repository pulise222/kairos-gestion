// Levanta un PostgreSQL 16 REAL como proceso local (sin Docker) para desarrollar y probar.
// En producción se usa el contenedor "db" de Docker Compose: el código y las migraciones son idénticos.
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Tomamos usuario, clave y puerto de DATABASE_URL (.env) para que todo quede en un solo lugar.
const url = new URL(process.env.DATABASE_URL ?? '')
const databaseDir = resolve('.data/pg')

const pg = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port),
  persistent: true,
  // IMPORTANTE: en Windows initdb usa por defecto la codificación WIN1252. Forzamos UTF8 (tildes, ñ, símbolos)
  // y orden alfabético en español (ICU es-CO), igual que se configurará el contenedor Docker de producción.
  initdbFlags: ['--encoding=UTF8', '--locale=C', '--locale-provider=icu', '--icu-locale=es-CO'],
})

if (!existsSync(join(databaseDir, 'PG_VERSION'))) await pg.initialise() // primera vez: crea el clúster
await pg.start()

// Bases separadas: "nivel" para desarrollo y "nivel_test" para las pruebas automáticas.
for (const nombre of ['nivel', 'nivel_test']) {
  try {
    await pg.createDatabase(nombre)
  } catch {
    /* ya existía */
  }
}
console.log(`PostgreSQL listo en el puerto ${url.port} (Ctrl+C para detener)`)

const detener = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', detener)
process.on('SIGTERM', detener)
setInterval(() => {}, 1 << 30) // mantiene el proceso vivo
