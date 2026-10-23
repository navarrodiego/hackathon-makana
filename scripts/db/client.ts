import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

export function localClient(url: string): PrismaClient {
  // Sesión en UTC: el adaptador formatea y lee timestamptz como UTC (ver src/lib/server/db.ts).
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: '-c TimeZone=UTC', max: 3, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 }) });
}
