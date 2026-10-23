import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import type { CommandContext, Principal } from '../../src/lib/contracts/auth';
import type { ClassificationOutput, ProviderResult, StructuredProvider } from '../../src/lib/contracts/classification';
import type { Instant } from '../../src/lib/contracts/core';
import { ACCEPTED_FIXTURE, type ExecutionFixture } from '../../src/lib/contracts/fixtures';
import type { SubmitReport } from '../../src/lib/contracts/http';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import { createHandoffService } from '../../src/lib/server/handoff';
import { createIncidentService } from '../../src/lib/server/incidents';
import { createClassificationService } from '../../src/lib/server/classification';
import { policyService } from '../../src/lib/server/policy';
import { createMessageService } from '../../src/lib/server/messages';
config({ path: '.env.t03', quiet: true });

export const OPEN_FIXTURE: ExecutionFixture = { ...ACCEPTED_FIXTURE, name: 'channel_open', channelOpen: true, narrativeAt: '2026-10-24T01:10:01.000Z' };
export const at = (base: Instant, ms: number): Instant => new Date(Date.parse(base) + ms).toISOString() as Instant;

export const outputOf = (patch: Partial<ClassificationOutput> = {}): ClassificationOutput => ({
  service: 'facturacion', condition: 'caida', scope: 'local_equipo', pc: 0.9, manipulation: false, blocksBilling: false,
  evidence: { location: 'local 7', resource: 'caja 2', problem: 'no emite boletas' }, sufficientInformation: true, ...patch,
});
export type Classify = (text: string, signal?: AbortSignal) => Promise<ProviderResult<ClassificationOutput>> | ProviderResult<ClassificationOutput>;
const provenance = { provider: 'openrouter', api: 'decisions', model: 'test-double', configurationId: 'test-only' } as const;

export async function world(fixture: ExecutionFixture = OPEN_FIXTURE, classify?: Classify) {
  const url = process.env.RELEVO_BACKEND_TEST_URL;
  if (!url) throw new Error('Falta RELEVO_BACKEND_TEST_URL: ejecuta pnpm db:worktree.');
  const db = localClient(url);
  const fixtures = fixturePreparer(db, url);
  const store = new PostgresPersistence(db);
  const prepared = await fixtures.prepare(fixture);
  try {
  const calls: string[] = [];
  const provider: StructuredProvider = {
    async classify(request, signal) {
      calls.push(request.input.text);
      const r = await (classify ?? (() => ({ ok: true, fence: request.fence, output: outputOf(), provenance }) as never))(request.input.text, signal);
      return { ...r, fence: request.fence } as never;
    },
    suggest: async () => { throw new Error('no usado'); },
  };
  const handoff = createHandoffService({ store });
  const incidents = createIncidentService({ store, handoff });
  const service = createMessageService({ store, classification: createClassificationService({ provider }), policy: policyService, incidents });
  const ok = (request: { fence: unknown }, output: ClassificationOutput) => ({ ok: true, fence: request.fence, output, provenance });
  let tick = 0;
  const ctx = (principal: Principal, origin: CommandContext['origin'] = 'web', nowMs = 0): CommandContext => ({
    executionId: prepared.executionId, executionVersion: 1, principal, actorId: null, origin,
    operationalNow: at(fixture.operationalAt, nowMs + tick++), narrativeNow: at(fixture.narrativeAt, nowMs), correlationId: `correlation_${randomUUID()}`,
  });
  const reporter = (nowMs = 0, sessionId = prepared.sessionId) => ctx({ kind: 'reporter', sessionId }, 'web', nowMs);
  const control = (nowMs = 0) => ctx({ kind: 'control', operatorId: 'demo_control' }, 'scenario', nowMs);
  const input = (text: string, key = `k-${randomUUID()}`, nickname = 'Visita'): SubmitReport =>
    ({ executionId: prepared.executionId, expectedVersion: undefined, idempotencyKey: key, nickname, text }) as unknown as SubmitReport;
  const snapshot = async () => {
    const r = await store.run(ctx({ kind: 'system' }, 'system'), async tx => ({ ok: true, value: {
      reports: [...(await tx.aggregates.reports.list())].sort((a, b) => a.admissionSequence - b.admissionSequence),
      incidents: await tx.aggregates.incidents.list(), notifications: await tx.aggregates.notifications.list(),
      events: await tx.events.list(), execution: (await tx.aggregates.executions.list())[0],
    } }));
    if (!r.ok) throw new Error(r.code); return r.value;
  };
  return { db, store, prepared, service, calls, ctx, reporter, control, input, snapshot, ok,
    dispose: () => fixtures.dispose(prepared.executionId),
    close: async () => { await fixtures.dispose(prepared.executionId); await db.$disconnect(); } };
  } catch (error) { await fixtures.dispose(prepared.executionId); await db.$disconnect(); throw error; }
}
