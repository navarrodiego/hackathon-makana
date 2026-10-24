import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ExecutionFixture } from '../../contracts/fixtures';
import type { Execution, Handoff, Incident, Report } from '../../contracts/domain';
import type { ActorId, ExecutionId, Instant, SceneId, TicketId } from '../../contracts/core';
import type { PreparedExecution } from '../../contracts/services';
import { insert, keyHash, type Row, type Tx } from './sql';
import { LIMITS } from '../../contracts/core';

/** Un fixture con canal abierto ya pasó la espera previa al envío. */
const lobbyDone = (at: Instant): Instant => new Date(Date.parse(at) - LIMITS.channelLobbyMs).toISOString() as Instant;

/** Construye datos sintéticos dentro de una TX del caller, sin IA ni avisos. */
export async function materializeFixture(tx: Tx, fixture: ExecutionFixture): Promise<PreparedExecution> {
  const executionId: ExecutionId = `execution_${randomUUID()}`;
  const actorIds = new Map(fixture.actors.map(a => [a.id, `actor_${randomUUID()}` as ActorId]));
  const sceneIds = new Map(fixture.scenes.map(s => [s.id, `scene_${randomUUID()}` as SceneId]));
  const ticketIds = new Map(fixture.tickets.map(t => [t.id, `ticket_${randomUUID()}` as TicketId]));
  const actor = (id: ActorId): ActorId => { const mapped = actorIds.get(id); if (!mapped) throw new Error('Unknown fixture actor'); return mapped; };
  const sceneId = sceneIds.get(fixture.initialSceneId); if (!sceneId) throw new Error('Unknown fixture scene');
  const execution: Execution = { executionId, version: 1, status: 'active', sceneId, anchor: { operationalAt: fixture.operationalAt, narrativeAt: fixture.narrativeAt }, channelOpen: fixture.channelOpen, channelOpenedAt: fixture.channelOpen ? lobbyDone(fixture.operationalAt) : null, admittedReports: fixture.incident ? 1 : 0, preparation: 'pending', createdAt: fixture.operationalAt, supersededBy: null };
  await insert(tx, 'executions', execution as unknown as Row);
  for (const a of fixture.actors) await insert(tx, 'actors', { ...a, id: actor(a.id), executionId });
  for (const s of fixture.scenes) await insert(tx, 'scenes', { ...s, id: sceneIds.get(s.id), executionId });
  const windowId = `window_${randomUUID()}` as const;
  await insert(tx, 'coverage_windows', { ...fixture.window, id: windowId, executionId, outgoingActorId: actor(fixture.window.outgoingActorId), incomingActorId: actor(fixture.window.incomingActorId), backupActorIds: fixture.window.backupActorIds.map(actor), coordinatorActorId: actor(fixture.window.coordinatorActorId) });
  for (const t of fixture.tickets) await insert(tx, 'tickets', { ...t, id: ticketIds.get(t.id), executionId, version: 1, suggestedDisposition: null, reason: 'Pendiente ficticio para revisión.', incidentId: null });
  const sessionId = `session_${randomUUID()}` as const;
  await insert(tx, 'report_sessions', { id: sessionId, credentialHash: createHash('sha256').update(randomBytes(32)).digest('hex'), expiresAt: new Date(new Date(fixture.operationalAt).getTime() + 43_200_000).toISOString() });
  const handoffId = `handoff_${randomUUID()}` as const;
  const hasAttempt = fixture.handoffState === 'awaiting_candidate' || fixture.handoffState === 'accepted';
  const attemptId = hasAttempt ? `handoff_attempt_${randomUUID()}` as const : null;
  const acceptedBy = fixture.acceptedBy ? actor(fixture.acceptedBy) : null;
  const handoff: Handoff = { id: handoffId, executionId, version: 1, windowId, outgoingActorId: actor(fixture.window.outgoingActorId), status: fixture.handoffState, currentAttemptId: attemptId, ticketIds: [...ticketIds.values()], note: '', savedSuggestion: null, sentAt: hasAttempt ? fixture.operationalAt : null, acceptedAt: acceptedBy ? fixture.operationalAt : null, acceptedBy, effectiveAt: fixture.window.startsAt };
  await insert(tx, 'handoffs', handoff as unknown as Row);
  if (attemptId) await insert(tx, 'handoff_attempts', { id: attemptId, executionId, version: 1, handoffId, candidateActorId: acceptedBy ?? actor(fixture.window.incomingActorId), position: 0, status: acceptedBy ? 'accepted' : 'pending', requestedAt: fixture.operationalAt, deadlineAt: new Date(new Date(fixture.operationalAt).getTime() + fixture.handoffDeadlineOffsetMs).toISOString(), respondedAt: acceptedBy ? fixture.operationalAt : null });
  const coverageStatus = !acceptedBy ? 'unconfirmed' : fixture.narrativeAt < fixture.window.startsAt ? 'scheduled' : fixture.narrativeAt >= fixture.window.endsAt ? 'ended' : 'active';
  await insert(tx, 'coverages', { id: `coverage_${randomUUID()}`, executionId, version: 1, windowId, status: coverageStatus, actorId: acceptedBy, acceptedAt: acceptedBy ? fixture.operationalAt : null });
  if (fixture.incident) {
    const incidentId = `incident_${randomUUID()}` as const, reportId = `report_${randomUUID()}` as const, incidentAttemptId = `incident_attempt_${randomUUID()}` as const;
    const report: Report = { id: reportId, executionId, version: 1, admissionSequence: 1, sessionId, nickname: 'Reporte de prueba', text: 'Facturación caída en local de prueba.', origin: 'scenario', operationalAt: fixture.operationalAt, narrativeAt: fixture.narrativeAt, correlationId: `correlation_${randomUUID()}`, principalKey: `scenario:${executionId}`, idempotencyKey: 'fixture-report', status: 'completed', classification: null, decision: { route: 'review', reason: 'Incidente sintético para pruebas de persistencia.' }, incidentId };
    const { classification: _, decision, ...reportRow } = report; void _;
    await insert(tx, 'reports', reportRow);
    await insert(tx, 'report_classifications', { reportId, executionId, value: { mode: 'degraded', reportId, reason: 'provider_unavailable', output: null } });
    await insert(tx, 'report_policy_decisions', { reportId, executionId, value: decision });
    const taken = fixture.incident.status === 'taken';
    const incident: Incident = { id: incidentId, executionId, version: 1, status: fixture.incident.status, firstReportId: reportId, equivalence: { mode: 'text', normalizedText: 'facturación caída en local de prueba' }, firstNarrativeAt: fixture.narrativeAt, currentAttemptId: incidentAttemptId, takenBy: taken ? actor(fixture.incident.candidateActorId) : null, takenAt: taken ? fixture.operationalAt : null };
    await insert(tx, 'incidents', { ...incident, equivalenceHash: keyHash(incident.equivalence) });
    await insert(tx, 'incident_attempts', { id: incidentAttemptId, executionId, version: 1, incidentId, candidateActorId: actor(fixture.incident.candidateActorId), position: 0, status: taken ? 'accepted' : fixture.incident.status === 'unacknowledged' ? 'expired' : 'pending', requestedAt: fixture.operationalAt, deadlineAt: new Date(new Date(fixture.operationalAt).getTime() + fixture.incident.deadlineOffsetMs).toISOString(), respondedAt: taken ? fixture.operationalAt : null });
  }
  return { executionId, version: 1, handoff, sessionId };
}
export const fixtureNow = (): Instant => new Date().toISOString() as Instant;
