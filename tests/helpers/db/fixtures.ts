import type { PrismaClient } from '../../../src/generated/prisma/client';
import type { ExecutionId } from '../../../src/lib/contracts/core';
import type { FixturePreparer } from '../../../src/lib/contracts/fixtures';
import { materializeFixture } from '../../../src/lib/server/repositories/fixture-data';
import { executionLock } from '../../../src/lib/server/repositories/sql';
import { localDestination, verifyLocalConnection } from '../../../scripts/db/destination';

export function fixturePreparer(db: PrismaClient, url: string): FixturePreparer {
  localDestination(url, true);
  const owned = new Map<ExecutionId, string>();
  return {
    async prepare(fixture) {
      await verifyLocalConnection(db, url, true);
      const prepared = await db.$transaction(async tx => {
        await executionLock(tx);
        const rows = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM executions WHERE status='active'`;
        if (rows[0].n) throw new Error('La base de pruebas ya tiene ejecución activa');
        return materializeFixture(tx, fixture);
      }, { timeout: 15_000 });
      owned.set(prepared.executionId, prepared.sessionId); return prepared;
    },
    async dispose(executionId) {
      if (!owned.has(executionId)) throw new Error('El preparador no creó esta ejecución');
      await verifyLocalConnection(db, url, true);
      await db.$transaction(async tx => {
        await executionLock(tx);
        // Las sesiones son globales; quitar solo sesiones usadas por esta ejecución
        // y nunca una que siga referenciada desde otra.
        const sessions = await tx.$queryRaw<{ id: string }[]>`SELECT DISTINCT "sessionId" AS id FROM reports WHERE "executionId"=${executionId}`;
        sessions.push({ id: owned.get(executionId)! });
        await tx.$executeRaw`DELETE FROM executions WHERE "executionId"=${executionId}`;
        for (const s of sessions) await tx.$executeRaw`DELETE FROM report_sessions WHERE id=${s.id} AND NOT EXISTS(SELECT 1 FROM reports WHERE "sessionId"=${s.id})`;
      }, { timeout: 15_000 });
      owned.delete(executionId);
    },
  };
}
