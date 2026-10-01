import { defineConfig } from 'prisma/config'

// Prisma 7: la conexión se define aquí (no en schema.prisma). Las migraciones usan DATABASE_URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
})
