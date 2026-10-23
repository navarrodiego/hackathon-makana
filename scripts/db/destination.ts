import { Prisma } from '../../src/generated/prisma/client';
import type { PrismaClient } from '../../src/generated/prisma/client';

const bases = ['relevo_backend', 'relevo_backend_test', 'relevo_backend_test_isolation'];
// Bases propias de un worktree (scripts/db/worktree.ts): patrón cerrado, sin puntuación ni mayúsculas.
const worktreeBase = /^relevo_wt_[a-z0-9_]{1,45}$/;
const isTestName = (name: string) => name.endsWith('_test') || name.endsWith('_test_isolation');
function allowedName(database: string, testOnly: boolean): boolean {
  if (bases.slice(testOnly ? 1 : 0).includes(database)) return true;
  return worktreeBase.test(database) && (!testOnly || isTestName(database));
}
export function localDestination(value: string | undefined, testOnly = false): { database: string; url: string } {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      !allowedName(database, testOnly) || url.search || url.hash ||
      (url.port && url.port !== '5432')) throw new Error();
    return { database, url: value };
  } catch { throw new Error('Destino local no permitido'); }
}
export async function verifyLocalConnection(db: PrismaClient, url: string, testOnly = false): Promise<void> {
  const target = localDestination(url, testOnly);
  const rows = await db.$queryRaw<{ database: string; address: string | null; port: number | null }[]>(Prisma.sql`
    SELECT current_database() AS database, host(inet_server_addr()) AS address, inet_server_port() AS port`);
  const row = rows[0];
  if (!row || row.database !== target.database || !['127.0.0.1', '::1'].includes(row.address ?? '') || row.port !== 5432)
    throw new Error('Destino local no permitido');
}

export function localAdminDestination(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (url.pathname !== '/postgres') throw new Error();
    const validation = new URL(url);
    validation.pathname = '/relevo_backend';
    localDestination(validation.toString());
    return url.toString();
  } catch { throw new Error('Destino local no permitido'); }
}
