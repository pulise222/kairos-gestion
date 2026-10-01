import { execFileSync } from 'node:child_process'

/** URL de la base de PRUEBAS (nunca la de desarrollo): "…/nivel" → "…/nivel_test". */
export function urlPruebas() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Falta DATABASE_URL: ejecuta las pruebas con "npm test"')
  const u = new URL(url)
  u.pathname = '/nivel_test'
  return u.toString()
}

// Antes de todas las pruebas: deja la base de pruebas con las migraciones al día.
export default function setup() {
  execFileSync(process.execPath, ['./node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: urlPruebas() },
    stdio: 'pipe',
  })
}
