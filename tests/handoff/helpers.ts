import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import type { CommandContext } from '../../src/lib/contracts/auth';
import type { ActorId, Instant } from '../../src/lib/contracts/core';
import type { ExecutionFixture } from '../../src/lib/contracts/fixtures';
import type { ServiceResult } from '../../src/lib/contracts/http';
import type { TransactionRepositories } from '../../src/lib/contracts/repositories';
import type { Principal } from '../../src/lib/contracts/auth';
import type { PreparedExecution } from '../../src/lib/contracts/services';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import { createHandoffService } from '../../src/lib/server/handoff';
config({ path: '.env.db', quiet: true });

export const at = (base: Instant, ms: number): Instant => new Date(Date.parse(base) + ms).toISOString() as Instant;

export async function world(fixture: ExecutionFixture) {
  const url = process.env.RELEVO_BACKEND_TEST_URL;
  if (!url) throw new Error('Falta RELEVO_BACKEND_TEST_URL: ejecuta pnpm db:worktree.');
  const db = localClient(url);
  const fixtures = fixturePreparer(db, url);
  const store = new PostgresPersistence(db);
  const prepared: PreparedExecution = await fixtures.prepare(fixture);
  const system = baseContext(prepared, { kind: 'system' }, null, fixture.operationalAt, fixture.narrativeAt);
  const read = async <T>(work: (tx: TransactionRepositories) => Promise<ServiceResult<T>>) => {
    const r = await store.run(system, work); if (!r.ok) throw new Error(r.code); return r.value;
  };
  const actors = await read(async tx => ({ ok: true, value: await tx.reference.actors() }));
  const id = (name: string) => actors.find(a => a.displayName === name)!.id as ActorId;
  const ids = { Rodrigo: id('Rodrigo'), Paula: id('Paula'), Tomás: id('Tomás'), Carla: id('Carla') };
  const service = createHandoffService({ store });
  const snapshot = () => read(async tx => ({ ok: true, value: {
    handoff: (await tx.aggregates.handoffs.list())[0], attempts: [...(await tx.aggregates.handoffAttempts.list())].sort((a, b) => a.position - b.position),
    coverage: (await tx.aggregates.coverages.list())[0], tickets: await tx.aggregates.tickets.list(),
    events: await tx.events.list(), notifications: await tx.aggregates.notifications.list(),
  } }));
  const ctx = (principal: Principal, actorId: ActorId | null, operationalNow: Instant, narrativeNow: Instant = fixture.narrativeAt, origin: CommandContext['origin'] = 'web') =>
    baseContext(prepared, principal, actorId, operationalNow, narrativeNow, origin);
  const outgoing = (now: Instant, narrative?: Instant) => ctx({ kind: 'outgoing', actorId: ids.Rodrigo }, ids.Rodrigo, now, narrative);
  const control = (represented: ActorId | null, now: Instant, narrative?: Instant) => ctx({ kind: 'control', operatorId: 'demo_control' }, represented, now, narrative, 'scenario');
  return { db, store, fixtures, prepared, ids, service, snapshot, ctx, outgoing, control, read,
    close: async () => { await fixtures.dispose(prepared.executionId); await db.$disconnect(); } };
}
function baseContext(p: PreparedExecution, principal: Principal, actorId: ActorId | null, operationalNow: Instant, narrativeNow: Instant, origin: CommandContext['origin'] = 'system'): CommandContext {
  return { executionId: p.executionId, executionVersion: 1, principal, actorId, origin, operationalNow, narrativeNow, correlationId: `correlation_${Math.random().toString(36).slice(2)}` };
}
