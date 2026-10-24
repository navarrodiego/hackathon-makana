import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
import { fixturePreparer } from '../helpers/db/fixtures';
import type { CommandContext, Principal } from '../../src/lib/contracts/auth';
import type { ActorId, Instant } from '../../src/lib/contracts/core';
import type { NoteOutput, ProviderResult, StructuredProvider } from '../../src/lib/contracts/classification';
import type { ExecutionFixture } from '../../src/lib/contracts/fixtures';
import type { ServiceResult } from '../../src/lib/contracts/http';
import type { TransactionRepositories } from '../../src/lib/contracts/repositories';
import type { NotificationService } from '../../src/lib/contracts/services';
import { PostgresPersistence } from '../../src/lib/server/repositories';
import { createHandoffService } from '../../src/lib/server/handoff';
import { createIncidentService } from '../../src/lib/server/incidents';
import { createHandoffNoteService } from '../../src/lib/server/handoff-note/service';
import { createExecutionService } from '../../src/lib/server/execution';
import { createReadService } from '../../src/lib/server/state';
config({ path: '.env.t03', quiet: true });

export const at = (base: Instant, ms: number): Instant => new Date(Date.parse(base) + ms).toISOString() as Instant;

type NoteRequest = Parameters<StructuredProvider['suggest']>[0];
/** Proveedor de nota controlado: devuelve una nota por cada pendiente recibido, como el real. */
export const echoNote = (req: NoteRequest): ProviderResult<NoteOutput> => ({
  ok: true, fence: req.fence,
  output: {
    suggestions: req.input.tickets.map((t, i) => ({ ticketId: t.id, disposition: i === 2 ? 'transferir' : 'puede_esperar', reason: 'Según la política del ejemplo.' })),
    note: 'Revisa el próximo intento del respaldo a las 02:00. Los demás pendientes pueden esperar.',
  },
  provenance: { provider: 'openrouter', api: 'structured_chat', model: 'test-double', configurationId: 'test-only' },
});

export interface WorldOptions {
  readonly provider?: (req: NoteRequest) => Promise<ProviderResult<NoteOutput>> | ProviderResult<NoteOutput>;
  readonly notifications?: NotificationService;
  readonly now?: () => Instant;
}

export async function world(fixture: ExecutionFixture, options: WorldOptions = {}) {
  const url = process.env.RELEVO_BACKEND_TEST_URL;
  if (!url) throw new Error('Falta RELEVO_BACKEND_TEST_URL: ejecuta pnpm db:worktree.');
  const db = localClient(url);
  const fixtures = fixturePreparer(db, url);
  const store = new PostgresPersistence(db);
  const prepared = await fixtures.prepare(fixture);
  let clock: Instant = fixture.operationalAt;
  const now = options.now ?? (() => clock);
  const handoff = createHandoffService({ store });
  const incidents = createIncidentService({ store, handoff });
  const notified: string[] = [];
  const notifications: NotificationService = options.notifications ?? {
    async dispatchPending(context) { notified.push(context.executionId); return { ok: true, value: 0 }; },
  };
  const providerCalls: NoteRequest[] = [];
  const provider: StructuredProvider = {
    classify: async () => { throw new Error('no usado'); },
    async suggest(req) { providerCalls.push(req); return (options.provider ?? echoNote)(req) as never; },
  };
  const note = createHandoffNoteService({ unitOfWork: store, provider });
  const read = createReadService({ store, now });
  const execution = createExecutionService({ store, handoff, incidents, notifications, note, read, now });

  const ctx = (principal: Principal, actorId: ActorId | null, operationalNow: Instant, narrativeNow: Instant = fixture.narrativeAt, executionId = prepared.executionId, origin: CommandContext['origin'] = 'web'): CommandContext =>
    ({ executionId, executionVersion: 1, principal, actorId, origin, operationalNow, narrativeNow, correlationId: `correlation_${randomUUID()}` });
  const control = (operationalNow: Instant = clock, executionId = prepared.executionId, represented: ActorId | null = null) =>
    ctx({ kind: 'control', operatorId: 'demo_control' }, represented, operationalNow, fixture.narrativeAt, executionId, 'scenario');
  const system = (operationalNow: Instant = clock) => ctx({ kind: 'system' }, null, operationalNow, fixture.narrativeAt, prepared.executionId, 'system');
  const readTx = async <T>(work: (tx: TransactionRepositories) => Promise<ServiceResult<T>>, executionId = prepared.executionId): Promise<T> => {
    const r: ServiceResult<T> = await store.run(ctx({ kind: 'system' }, null, clock, fixture.narrativeAt, executionId, 'system'), work);
    if (!r.ok) throw new Error(r.code);
    return r.value;
  };
  const actors = await readTx(async tx => ({ ok: true, value: await tx.reference.actors() }));
  const id = (name: string) => actors.find(a => a.displayName === name)!.id as ActorId;
  const ids = { Rodrigo: id('Rodrigo'), Paula: id('Paula'), Tomás: id('Tomás'), Carla: id('Carla') };
  return {
    db, store, prepared, ids, handoff, incidents, execution, read, note, ctx, control, system, readTx, notified, providerCalls,
    setNow: (value: Instant) => { clock = value; },
    /** Borra cualquier ejecución sucesora creada por reset; la base de pruebas es local y propia de este worktree. */
    close: async () => {
      await db.$executeRaw`DELETE FROM executions`;
      await db.$executeRaw`DELETE FROM report_sessions WHERE NOT EXISTS(SELECT 1 FROM reports WHERE reports."sessionId"=report_sessions.id)`;
      await db.$disconnect();
    },
  };
}
