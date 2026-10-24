import type { PrismaClient } from '../../../src/generated/prisma/client';
import { executionLock } from '../../../src/lib/server/repositories/sql';

/** Otra transacción toma el candado global hasta que se llama a `release`. */
export function holdLock(db: PrismaClient) {
  let release!: () => void; let locked!: () => void;
  const gate = new Promise<void>(r => { release = r; }), acquired = new Promise<void>(r => { locked = r; });
  const done = db.$transaction(async tx => { await executionLock(tx); locked(); await gate; }, { timeout: 15_000 });
  return { acquired, release: async () => { release(); await done; } };
}
export const within = <T>(ms: number, work: Promise<T>) => Promise.race([work, new Promise<'timeout'>(r => setTimeout(() => r('timeout'), ms))]);
