/**
 * prisma.ts — Singleton de Prisma Client con adaptador PostgreSQL.
 *
 * Flujo:
 * 1. Se crea un adaptador PrismaPg que conecta Prisma con PostgreSQL
 *    usando la URL de la variable de entorno DATABASE_URL.
 *
 * 2. Se intenta reutilizar una instancia existente de PrismaClient
 *    guardada en `global` (el objeto global de Node.js):
 *    - Si ya existe (globalForPrisma.prisma) → la reutiliza.
 *    - Si no existe → crea una nueva con el adaptador.
 *
 * 3. En desarrollo (NODE_ENV !== 'production'), se guarda la instancia
 *    en `global` para que persista entre hot reloads de Next.js.
 *    Sin esto, cada vez que Next.js recarga un módulo en desarrollo,
 *    se crearía una nueva conexión a la BD → se acumularían conexiones
 *    hasta agotar el pool de PostgreSQL.
 *
 * 4. En producción no se guarda en global porque no hay hot reload,
 *    y el módulo se carga una sola vez.
 *
 * Resultado: siempre hay una única instancia de PrismaClient por proceso,
 * sin importar cuántas veces se importe este módulo.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/** Hack de tipos para poder guardar prisma en el objeto global de Node */
const globalForPrisma = global as unknown as { prisma: PrismaClient }

/** Adaptador que conecta Prisma ORM con el driver nativo de PostgreSQL */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

/** Instancia única: reutiliza la existente o crea una nueva */
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

/** En desarrollo, persiste entre hot reloads para no acumular conexiones */
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
