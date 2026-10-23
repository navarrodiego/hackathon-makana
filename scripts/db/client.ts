import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

export function localClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 }) });
}
