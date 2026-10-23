import 'dotenv/config';
import { localClient } from './client';
import { localDestination, verifyLocalConnection } from './destination';
import { BASE_FIXTURE } from '../../src/lib/contracts/fixtures';
import { materializeFixture, fixtureNow } from '../../src/lib/server/repositories/fixture-data';
import { executionLock } from '../../src/lib/server/repositories/sql';

try {
  const target = localDestination(process.env.DATABASE_URL);
  if (process.env.DIRECT_URL && localDestination(process.env.DIRECT_URL).database !== target.database) throw new Error('Destino distinto');
  const db = localClient(target.url);
  try {
    await verifyLocalConnection(db, target.url);
    const outcome = await db.$transaction(async tx => {
      await executionLock(tx);
      const existing = await tx.$queryRaw<{ executionId: string }[]>`SELECT "executionId" FROM executions WHERE status='active'`;
      if (existing[0]) return { executionId: existing[0].executionId, created: false };
      const prepared = await materializeFixture(tx, { ...BASE_FIXTURE, operationalAt: fixtureNow() });
      return { executionId: prepared.executionId, created: true };
    }, { timeout: 15_000 });
    console.info(`${outcome.created ? 'Seed ficticio creado' : 'Ejecución existente conservada'}: ${target.database}, ${outcome.executionId}. Nota sin preparar; sin IA ni push.`);
  } finally { await db.$disconnect(); }
} catch {
  console.error('Seed local rechazado o fallido. Comprueba destino, permisos y migraciones.'); process.exitCode = 1;
}
