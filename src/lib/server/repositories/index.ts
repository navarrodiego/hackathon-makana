import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import type { CommandContext, RecipientGrant } from '../../contracts/auth';
import { LIMITS, type ExecutionId, type ReportSessionId, type Version } from '../../contracts/core';
import type { Execution, Report, StoredNote, Event, ReportSession } from '../../contracts/domain';
import type { ServiceResult } from '../../contracts/http';
import type { AggregateMap, AggregateRepository, CredentialReader, ExecutionReader, IdempotencyRecord, IdempotencyScope, SavedResponse, TransactionRepositories, UnitOfWork } from '../../contracts/repositories';
import { canonical, decode, executionLock, identifier, insert, keyHash, parameter, select, update, type Row, type Tx } from './sql';

const tables = {
  executions: 'executions', tickets: 'tickets', handoffs: 'handoffs', handoffAttempts: 'handoff_attempts',
  coverages: 'coverages', reports: 'reports', incidents: 'incidents', incidentAttempts: 'incident_attempts', notifications: 'notification_intents',
} as const;
const ok = <T>(value: T): ServiceResult<T> => ({ ok: true, value });
class Rollback extends Error { constructor(readonly result: ServiceResult<never>) { super('Rollback'); } }
const scoped = (executionId: ExecutionId) => Prisma.sql`"executionId"=${executionId}`;
const idempotencyWhere = (scope: IdempotencyScope) => Prisma.sql`"executionId"=${scope.executionId} AND "principalKey"=${scope.principalKey} AND operation=${scope.operation} AND key=${scope.key}`;

export class PostgresPersistence implements UnitOfWork, ExecutionReader, CredentialReader {
  constructor(private readonly db: PrismaClient) { }
  async current(): Promise<Execution | null> {
    return (await select<Execution>(this.db, 'executions', Prisma.sql`status='active'`))[0] ?? null;
  }
  async findGrant(hash: string): Promise<RecipientGrant | null> {
    return (await select<RecipientGrant>(this.db, 'recipient_grants', Prisma.sql`"credentialHash"=${hash}`))[0] ?? null;
  }
  async findSession(hash: string): Promise<ReportSession | null> {
    return (await select<ReportSession>(this.db, 'report_sessions', Prisma.sql`"credentialHash"=${hash}`))[0] ?? null;
  }
  async run<T>(context: CommandContext, work: (repositories: TransactionRepositories) => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
    try {
      return await this.db.$transaction(async tx => {
        await executionLock(tx);
        const current = (await select<Execution>(tx, 'executions', Prisma.sql`status='active'`))[0];
        if (!current || current.executionId !== context.executionId) return { ok: false, code: 'EXECUTION_STALE' };
        const result = await work(repositories(tx, current.executionId));
        if (!result.ok) throw new Rollback(result);
        return result;
      }, { maxWait: 10_000, timeout: 15_000 });
    } catch (error) {
      if (error instanceof Rollback) return error.result;
      return { ok: false, code: 'STORAGE_UNAVAILABLE' };
    }
  }
  async replayReset(scope: IdempotencyScope, fingerprint: string): Promise<ServiceResult<SavedResponse | null>> {
    if (scope.operation !== 'POST /api/reset') return { ok: false, code: 'EXECUTION_STALE' };
    try {
      return await this.db.$transaction(async tx => {
        await executionLock(tx);
        const record = (await select<IdempotencyRecord>(tx, 'idempotency_records', idempotencyWhere(scope)))[0];
        const current = (await select<Execution>(tx, 'executions', Prisma.sql`status='active'`))[0];
        if (!record) return current?.executionId === scope.executionId ? ok(null) : { ok: false, code: 'EXECUTION_STALE' };
        if (record.status !== 'completed' || !record.successorExecutionId || record.successorExecutionId !== current?.executionId)
          return { ok: false, code: 'EXECUTION_STALE' };
        if (record.fingerprint !== fingerprint) return { ok: false, code: 'IDEMPOTENCY_CONFLICT' };
        return ok(record.response);
      });
    } catch { return { ok: false, code: 'STORAGE_UNAVAILABLE' }; }
  }
}

function repositories(tx: Tx, executionId: ExecutionId): TransactionRepositories {
  let replaced = false;
  const active = () => { if (replaced) throw new Error('Retired transaction scope'); };
  const where = scoped(executionId);
  async function hydrate<K extends keyof AggregateMap>(key: K, row: Row): Promise<AggregateMap[K]> {
    if (key === 'reports') {
      const classification = (await select<{ value: Report['classification'] }>(tx, 'report_classifications', Prisma.sql`${where} AND "reportId"=${row.id}`))[0];
      const decision = (await select<{ value: Report['decision'] }>(tx, 'report_policy_decisions', Prisma.sql`${where} AND "reportId"=${row.id}`))[0];
      row = { ...row, classification: classification?.value ?? null, decision: decision?.value ?? null };
    }
    if (key === 'incidents') { const { equivalenceHash: _, ...rest } = row; void _; row = rest; }
    return decode<AggregateMap[K]>(row);
  }
  function stored<K extends keyof AggregateMap>(key: K, value: AggregateMap[K]): Row {
    if (value.executionId !== executionId) throw new Error('Execution mismatch');
    const row = { ...value } as Row;
    if (key === 'reports') { delete row.classification; delete row.decision; }
    if (key === 'incidents') row.equivalenceHash = keyHash(row.equivalence);
    return row;
  }
  async function reportChildren(value: AggregateMap[keyof AggregateMap]) {
    if (!('classification' in value)) return;
    for (const [table, child] of [['report_classifications', value.classification], ['report_policy_decisions', value.decision]] as const) {
      if (child === null) {
        await tx.$executeRaw(Prisma.sql`DELETE FROM ${identifier(table)} WHERE ${where} AND "reportId"=${value.id}`);
      } else {
        await tx.$executeRaw(Prisma.sql`INSERT INTO ${identifier(table)} ("reportId","executionId",value) VALUES (${value.id},${executionId},${parameter('value', child)}) ON CONFLICT ("reportId") DO UPDATE SET value=EXCLUDED.value WHERE ${identifier(table)}."executionId"=${executionId}`);
      }
    }
  }
  function aggregate<K extends keyof AggregateMap>(key: K): AggregateRepository<K> {
    const table = tables[key], idColumn = key === 'executions' ? 'executionId' : 'id';
    return {
      async get(id) { active(); const row = (await select<Row>(tx, table, Prisma.sql`${where} AND ${identifier(idColumn)}=${id}`))[0]; return row ? hydrate(key, row) : null; },
      async list() { active(); return Promise.all((await select<Row>(tx, table, where)).map(row => hydrate(key, row))); },
      async insert(value) { active(); await insert(tx, table, stored(key, value)); await reportChildren(value); },
      async compareAndSwap(value, guard) {
        active();
        if (guard.executionId !== executionId || value.version !== guard.version + 1) return false;
        // Predicate fields come exclusively from the typed guard, not caller-controlled SQL.
        const allowed = ['executionId', 'version', ...(key === 'handoffs' || key === 'incidents' ? ['status', 'currentAttemptId'] : key === 'handoffAttempts' || key === 'incidentAttempts' ? ['status', 'candidateActorId'] : key === 'reports' || key === 'notifications' ? ['status'] : [])];
        if (allowed.some(k => !Object.hasOwn(guard, k))) return false;
        const predicates = allowed.map(k => Prisma.sql`${identifier(k)} IS NOT DISTINCT FROM ${parameter(k, (guard as unknown as Row)[k])}`);
        const row = stored(key, value);
        const changed = await update(tx, table, row, Prisma.sql`${where} AND ${identifier(idColumn)}=${row[idColumn]} AND ${Prisma.join(predicates, ' AND ')}`);
        if (changed) await reportChildren(value);
        return changed === 1;
      },
    };
  }
  const aggregates = Object.fromEntries(Object.keys(tables).map(k => [k, aggregate(k as keyof AggregateMap)])) as TransactionRepositories['aggregates'];
  const result: TransactionRepositories = {
    aggregates,
    idempotency: {
      async reserve(record) {
        active(); if (record.executionId !== executionId) throw new Error('Execution mismatch');
        const inserted = await tx.$executeRaw(Prisma.sql`INSERT INTO idempotency_records ("executionId","principalKey",operation,key,fingerprint,"createdAt",status,response,"successorExecutionId") VALUES (${executionId},${record.principalKey},${record.operation},${record.key},${record.fingerprint},${new Date(record.createdAt)},'pending',NULL,NULL) ON CONFLICT DO NOTHING`);
        const found = (await select<IdempotencyRecord>(tx, 'idempotency_records', idempotencyWhere(record)))[0];
        return { inserted: inserted === 1, record: found };
      },
      async complete(scope, response, successorExecutionId) {
        // The old scope may complete reset after replaceExecution, in this same TX.
        if (scope.executionId !== executionId || (replaced && scope.operation !== 'POST /api/reset') || (successorExecutionId && scope.operation !== 'POST /api/reset')) throw new Error('Execution mismatch');
        const changed = await update(tx, 'idempotency_records', { status: 'completed', response, successorExecutionId: successorExecutionId ?? null }, Prisma.sql`${idempotencyWhere(scope)} AND status='pending'`);
        if (changed !== 1) throw new Error('Idempotency completion conflict');
      },
    },
    equivalence: {
      async lock(key) { active(); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${executionId + ':' + canonical(key)}, 0))`; },
      async findWithinWindow(key, narrativeAt) {
        active(); const at = new Date(narrativeAt), earliest = new Date(at.getTime() - 600_000);
        const rows = await select<Row>(tx, 'incidents', Prisma.sql`${where} AND "equivalenceHash"=${keyHash(key)} AND equivalence=${parameter('equivalence', key)} AND "firstNarrativeAt">${earliest} AND "firstNarrativeAt"<=${at}`, Prisma.sql`ORDER BY "firstNarrativeAt" DESC,id DESC LIMIT 1`);
        return rows[0] ? hydrate('incidents', rows[0]) : null;
      },
      async linkReport(reportId, incidentId) {
        active(); const report = await aggregates.reports.get(reportId); if (!report) throw new Error('Missing report');
        if (report.incidentId === incidentId) return;
        if (report.incidentId !== null) throw new Error('Report already linked');
        if (!await aggregates.reports.compareAndSwap({ ...report, incidentId, version: report.version + 1 }, { executionId, version: report.version, status: report.status })) throw new Error('Report link conflict');
      },
    },
    async reportsAwaitingDecision() { active(); const rows = await select<Row>(tx, 'reports', Prisma.sql`${where} AND status='processing'`, Prisma.sql`ORDER BY "admissionSequence" ASC`); return Promise.all(rows.map(r => hydrate('reports', r))); },
    events: {
      async append(event) {
        active(); if (event.executionId !== executionId) throw new Error('Execution mismatch');
        const rows = await tx.$queryRaw<{ next: number }[]>`SELECT coalesce(max(sequence),0)::int+1 AS next FROM events WHERE "executionId"=${executionId}`;
        const saved: Event = { ...event, id: `event_${randomUUID()}`, sequence: rows[0].next };
        await insert(tx, 'events', saved as unknown as Row); return saved;
      },
      async list() { active(); return select<Event>(tx, 'events', where, Prisma.sql`ORDER BY sequence ASC`); },
    },
    reference: {
      async actors() { active(); const rows = await select<Row>(tx, 'actors', where); return rows.map(({ executionId: _, ...row }) => { void _; return row as unknown as Awaited<ReturnType<TransactionRepositories['reference']['actors']>>[number]; }); },
      async windows() { active(); return select(tx, 'coverage_windows', where); },
      async insertWindow(window) { active(); if (window.executionId !== executionId) throw new Error('Execution mismatch'); await insert(tx, 'coverage_windows', window as unknown as Row); },
      async scenes() { active(); const rows = await select<Row>(tx, 'scenes', where, Prisma.sql`ORDER BY "order" ASC`); return rows.map(({ executionId: _, ...row }) => { void _; return row as unknown as Awaited<ReturnType<TransactionRepositories['reference']['scenes']>>[number]; }); },
    },
    notes: {
      async get() { active(); const handoffs = await aggregates.handoffs.list(); return handoffs[0]?.savedSuggestion ?? null; },
      async save(note: StoredNote, expectedHandoffVersion: Version) { active(); if (note.executionId !== executionId) return false; const handoff = (await aggregates.handoffs.list())[0]; if (!handoff || handoff.version !== expectedHandoffVersion || note.version !== expectedHandoffVersion + 1) return false; return aggregates.handoffs.compareAndSwap({ ...handoff, savedSuggestion: note, version: handoff.version + 1 }, { executionId, version: handoff.version, status: handoff.status, currentAttemptId: handoff.currentAttemptId }); },
    },
    credentials: {
      async saveGrant(grant) { active(); if (grant.executionId !== executionId) throw new Error('Execution mismatch'); await insert(tx, 'recipient_grants', grant as unknown as Row); },
      async findGrant(hash) { active(); return (await select<RecipientGrant>(tx, 'recipient_grants', Prisma.sql`${where} AND "credentialHash"=${hash}`))[0] ?? null; },
      async findSession(hash) { active(); return (await select<ReportSession>(tx, 'report_sessions', Prisma.sql`"credentialHash"=${hash}`))[0] ?? null; },
      async saveSession(session) { active(); await insert(tx, 'report_sessions', session as unknown as Row); },
    },
    async reserveReportQuota(sessionId: ReportSessionId) {
      active(); const session = (await select<ReportSession>(tx, 'report_sessions', Prisma.sql`id=${sessionId}`))[0];
      if (!session) throw new Error('Missing session');
      const execution = await aggregates.executions.get(executionId); if (!execution) throw new Error('Missing execution');
      const counts = await tx.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM reports WHERE "executionId"=${executionId} AND "sessionId"=${sessionId}`;
      if (counts[0].count >= LIMITS.reportsPerSession || execution.admittedReports >= LIMITS.reportsPerExecution) return { ok: false, code: 'QUOTA_EXCEEDED' };
      const next = execution.admittedReports + 1;
      if (!await aggregates.executions.compareAndSwap({ ...execution, admittedReports: next, version: execution.version + 1 }, { executionId, version: execution.version })) throw new Error('Quota conflict');
      return ok({ executionId, sessionId, remainingSessionReports: LIMITS.reportsPerSession - 1 - counts[0].count, remainingExecutionReports: LIMITS.reportsPerExecution - next, admissionSequence: next });
    },
    async replaceExecution(next: Execution, expectedVersion: Version) {
      active(); const current = await aggregates.executions.get(executionId);
      if (!current || current.version !== expectedVersion || next.executionId === executionId || next.status !== 'active' || next.supersededBy !== null) return null;
      if (!await aggregates.executions.compareAndSwap({ ...current, status: 'superseded', supersededBy: next.executionId, version: current.version + 1 }, { executionId, version: expectedVersion })) return null;
      await insert(tx, 'executions', next as unknown as Row);
      // Actor/scene IDs are reference identities carried across a scenic reset.
      // The composite DB key keeps their rows scoped to the successor.
      for (const table of ['actors', 'scenes']) {
        const rows = await select<Row>(tx, table, where);
        for (const row of rows) await insert(tx, table, { ...row, executionId: next.executionId });
      }
      replaced = true;
      return repositories(tx, next.executionId);
    },
  };
  return result;
}
