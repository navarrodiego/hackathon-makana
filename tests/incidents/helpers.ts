import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import type { CommandContext, Principal } from '../../src/lib/contracts/auth';
import type { ActorId, Instant } from '../../src/lib/contracts/core';
import type { ExecutionFixture } from '../../src/lib/contracts/fixtures';
import type { ServiceResult } from '../../src/lib/contracts/http';
import type { TransactionRepositories } from '../../src/lib/contracts/repositories';
import type { Classification, EquivalenceKey, PolicyDecision } from '../../src/lib/contracts/classification';
import type { Report } from '../../src/lib/contracts/domain';
import type { PreparedExecution } from '../../src/lib/contracts/services';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import { createHandoffService } from '../../src/lib/server/handoff';
import { createIncidentService } from '../../src/lib/server/incidents';
config({ path: '.env.t03', quiet: true });

export const at = (base: Instant, ms: number): Instant => new Date(Date.parse(base) + ms).toISOString() as Instant;
export const NOTIFY: PolicyDecision = { route: 'notify', reason: 'Servicio crítico con alta probabilidad de caída.' };
export const factsKey = (problem: string, location: string | null = 'local 7'): EquivalenceKey =>
  ({ mode: 'facts', service: 'facturacion', condition: 'caida', scope: 'local_equipo', location, resource: 'caja 2', problem });
const classification = (reportId: Report['id']): Classification => ({ mode: 'degraded', reason: 'timeout', reportId, output: null });

export async function world(fixture: ExecutionFixture) {
  const url = process.env.RELEVO_BACKEND_TEST_URL;
  if (!url) throw new Error('Falta RELEVO_BACKEND_TEST_URL: ejecuta pnpm db:worktree.');
  const db = localClient(url);
  const fixtures = fixturePreparer(db, url);
  const store = new PostgresPersistence(db);
  const prepared: PreparedExecution = await fixtures.prepare(fixture);
  const handoff = createHandoffService({ store });
  const service = createIncidentService({ store, handoff });
  const ctx = (principal: Principal, actorId: ActorId | null, operationalNow: Instant, narrativeNow: Instant = fixture.narrativeAt, origin: CommandContext['origin'] = 'system'): CommandContext =>
    ({ executionId: prepared.executionId, executionVersion: 1, principal, actorId, origin, operationalNow, narrativeNow, correlationId: `correlation_${randomUUID()}` });
  const system = (now: Instant, narrative: Instant = fixture.narrativeAt) => ctx({ kind: 'system' }, null, now, narrative);
  const read = async <T>(work: (tx: TransactionRepositories) => Promise<ServiceResult<T>>) => {
    const r = await store.run(system(fixture.operationalAt), work); if (!r.ok) throw new Error(r.code); return r.value;
  };
  const actors = await read(async tx => ({ ok: true, value: await tx.reference.actors() }));
  const id = (name: string) => actors.find(a => a.displayName === name)!.id as ActorId;
  const ids = { Rodrigo: id('Rodrigo'), Paula: id('Paula'), Tomás: id('Tomás'), Carla: id('Carla') };

  /** Ingresa un reporte ya decidido, como lo hará T14: cuota + reporte + register en una sola TX. */
  async function ingest(key: EquivalenceKey, now: Instant, narrative: Instant, decision: PolicyDecision = NOTIFY) {
    return store.run(system(now, narrative), async tx => {
      const q = await tx.reserveReportQuota(prepared.sessionId); if (!q.ok) return q;
      const report: Report = { id: `report_${randomUUID()}`, executionId: prepared.executionId, version: 1, admissionSequence: q.value.admissionSequence, sessionId: prepared.sessionId,
        nickname: 'Prueba', text: 'Hecho sintético', origin: 'web', operationalAt: now, narrativeAt: narrative, correlationId: 'correlation_ingest',
        principalKey: `session:${prepared.sessionId}`, idempotencyKey: `r-${q.value.admissionSequence}`, status: 'processing', classification: null, decision: null, incidentId: null };
      await tx.aggregates.reports.insert(report);
      return service.register(tx, system(now, narrative), report, classification(report.id), decision, key);
    });
  }
  const snapshot = () => read(async tx => ({ ok: true, value: {
    incidents: await tx.aggregates.incidents.list(),
    attempts: [...(await tx.aggregates.incidentAttempts.list())].sort((a, b) => a.position - b.position),
    notifications: await tx.aggregates.notifications.list(), events: await tx.events.list(),
    reports: await tx.aggregates.reports.list(), coverage: (await tx.aggregates.coverages.list())[0], handoff: (await tx.aggregates.handoffs.list())[0],
  } }));
  const recipient = (actorId: ActorId, now: Instant, narrative?: Instant, origin: CommandContext['origin'] = 'ntfy_action') =>
    ctx({ kind: 'recipient', actorId, grant: {} as never }, actorId, now, narrative, origin);
  const control = (represented: ActorId | null, now: Instant, narrative?: Instant) => ctx({ kind: 'control', operatorId: 'demo_control' }, represented, now, narrative, 'scenario');
  return { db, store, prepared, ids, service, handoff, ingest, snapshot, ctx, system, recipient, control, read,
    close: async () => { await fixtures.dispose(prepared.executionId); await db.$disconnect(); } };
}
