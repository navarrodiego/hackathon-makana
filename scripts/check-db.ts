import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Configura DATABASE_URL antes de comprobar la conexión.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 1, connectionTimeoutMillis: 5_000 }),
});
try {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1`;
  });
  console.info("Conexión y transacción PostgreSQL comprobadas. Sin cambios de datos.");
} finally {
  await db.$disconnect();
}
