import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { relevoDb?: PrismaClient };

// Compartir el pool evita abrir conexiones nuevas durante hot reload.
export function getDb(): PrismaClient {
  if (globalForDb.relevoDb) return globalForDb.relevoDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el servidor.");
  // El adaptador lee y escribe timestamptz como UTC: sin fijar la sesión, un servidor en otra zona desplaza los instantes.
  const adapter = new PrismaPg({
    connectionString,
    options: "-c TimeZone=UTC",
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = new PrismaClient({ adapter });
  globalForDb.relevoDb = db;
  return db;
}
