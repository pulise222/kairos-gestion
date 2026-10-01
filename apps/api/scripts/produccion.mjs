// Arranque de PRODUCCIÓN en un PC con Windows, sin Docker: un solo comando que
//   1) levanta PostgreSQL (el mismo de desarrollo, con sus datos en DB_DIR),
//   2) aplica las migraciones que falten (así una actualización del sistema actualiza la base sola),
//   3) arranca la API, que también entrega la pantalla (apps/web/dist).
// Uso:  node --env-file=.env scripts/produccion.mjs        (lo llama «iniciar-nivel.ps1»)
import EmbeddedPostgres from 'embedded-postgres'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const url = new URL(process.env.DATABASE_URL ?? '')
const nombreBase = url.pathname.replace(/^\//, '')
const databaseDir = resolve(process.env.DB_DIR ?? 'datos/pg')

const pg = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port),
  persistent: true,
  // UTF-8 y orden alfabético en español (tildes y ñ bien guardadas): no se puede cambiar después de crear el clúster.
  initdbFlags: ['--encoding=UTF8', '--locale=C', '--locale-provider=icu', '--icu-locale=es-CO'],
})

if (!existsSync(join(databaseDir, 'PG_VERSION'))) {
  console.log('Primera vez: creando la base de datos…')
  await pg.initialise()
}
await pg.start()
try { await pg.createDatabase(nombreBase) } catch { /* ya existía */ }
console.log(`Base de datos lista (puerto ${url.port}).`)

const migrar = spawnSync(process.execPath, ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit' })
if (migrar.status !== 0) {
  console.error('No se pudieron aplicar las migraciones. El sistema NO arrancó para no dañar los datos.')
  await pg.stop()
  process.exit(1)
}

const api = spawn(process.execPath, ['./node_modules/tsx/dist/cli.mjs', 'src/server.ts'], { stdio: 'inherit' })

let cerrando = false
const cerrar = async (codigo = 0) => {
  if (cerrando) return
  cerrando = true
  api.kill()
  await pg.stop() // cierre ordenado: así la base nunca queda a medias aunque apaguen el programa
  process.exit(codigo)
}
api.on('exit', (c) => void cerrar(c ?? 1))
process.on('SIGINT', () => void cerrar())
process.on('SIGTERM', () => void cerrar())
