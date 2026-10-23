import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { relevoDb?: PrismaClient };

// Compartir el pool evita abrir conexiones nuevas durante hot reload.
export function getDb(): PrismaClient {
  if (globalForDb.relevoDb) return globalForDb.relevoDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el servidor.");
  const adapter = new PrismaPg({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = new PrismaClient({ adapter });
  globalForDb.relevoDb = db;
  return db;
}
