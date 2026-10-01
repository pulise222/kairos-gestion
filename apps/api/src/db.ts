import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

// Prisma 7 se conecta a PostgreSQL a través de un "adaptador" (el driver "pg").
export function crearPrisma(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

export type Prisma = ReturnType<typeof crearPrisma>
