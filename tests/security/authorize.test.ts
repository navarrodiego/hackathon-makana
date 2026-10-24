import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RecipientGrant, RecipientScope } from '../../src/lib/contracts/auth';
import type { Instant } from '../../src/lib/contracts/core';
import type { Execution, ReportSession } from '../../src/lib/contracts/domain';
import type { AuthorizationInput } from '../../src/lib/contracts/auth';
import { createAuthorizationService, type AuthDeps } from '../../src/lib/server/auth/service';
import { generateOpaqueToken, hashCredential } from '../../src/lib/server/auth/credentials';
import { issueOperatorToken } from '../../src/lib/server/auth/operator-session';

const APP = 'https://relevo.example';
const T0 = '2026-10-23T15:00:00.000Z' as Instant;
const EXEC: Execution = {
  executionId: 'execution_now', version: 4, status: 'active', sceneId: 'scene_closing',
  anchor: { operationalAt: T0, narrativeAt: '2026-10-24T01:09:50.000Z' }, channelOpen: true, channelOpenedAt: null, lobbyEndsAt: null, qrEndsAt: null, admittedReports: 0,
  preparation: 'ready', createdAt: T0, supersededBy: null,
};
const basic = (u: string, s: string) => 'Basic ' + Buffer.from(`${u}:${s}`).toString('base64');
const RODRIGO = basic('rodrigo', 'secreto-operador'), CONTROL = basic('control', 'secreto-operador');

function world(over: Partial<AuthDeps> = {}) {
  const grants = new Map<string, RecipientGrant>(), sessions = new Map<string, ReportSession>();
  let now = T0, current: Execution | null = EXEC, n = 0;
  const deps: AuthDeps = {
    executions: { current: async () => current },
    credentials: { findGrant: async h => grants.get(h) ?? null, findSession: async h => sessions.get(h) ?? null },
    directory: {
      outgoingActorId: async e => (e === EXEC.executionId ? 'actor_outgoing' : null),
      actorExists: async (e, a) => e === EXEC.executionId && ['actor_outgoing', 'actor_incoming', 'actor_backup'].includes(a),
    },
    persistGrant: async () => ({ ok: true, value: null }),
    config: { operatorSecret: 'secreto-operador', appOrigin: APP },
    now: () => now, correlationId: () => `correlation_${++n}`, ...over,
  };
  const grant = (scope: RecipientScope, over: Partial<RecipientGrant> = {}) => {
    const token = generateOpaqueToken();
    grants.set(hashCredential(token), { executionId: EXEC.executionId, actorId: 'actor_incoming', scope, credentialHash: hashCredential(token), issuedAt: T0, expiresAt: '2026-10-23T15:30:00.000Z', ...over });
    return token;
  };
  const session = (over: Partial<ReportSession> = {}) => {
    const cookie = generateOpaqueToken();
    sessions.set(hashCredential(cookie), { id: 'session_a', credentialHash: hashCredential(cookie), expiresAt: '2026-10-24T03:00:00.000Z', ...over });
    return cookie;
  };
  return { service: createAuthorizationService(deps), grant, session, setNow: (i: Instant) => { now = i; }, setCurrent: (e: Execution | null) => { current = e; } };
}
const input = (over: Partial<AuthorizationInput>): AuthorizationInput => ({
  route: 'POST /api/handoff', executionId: EXEC.executionId, authorizationHeader: null, sessionCookie: null, originHeader: APP, ...over,
});
const HANDOFF_SCOPE: RecipientScope = { entity: 'handoff', entityId: 'handoff_1', attemptId: 'handoff_attempt_1', actions: ['read_handoff', 'accept_handoff', 'reject_handoff'] };
const INCIDENT_SCOPE: RecipientScope = { entity: 'incident', entityId: 'incident_1', attemptId: 'incident_attempt_1', actions: ['take_incident'] };
const code = async (w: ReturnType<typeof world>, i: AuthorizationInput) => { const r = await w.service.authorize(i); return r.ok ? 'ok' : r.code; };

test('Rodrigo: Basic correcto produce principal saliente con actor de la ejecución y reloj narrativo 1:1', async () => {
  const w = world(); w.setNow('2026-10-23T15:00:10.500Z');
  const r = await w.service.authorize(input({ authorizationHeader: RODRIGO }));
  assert.ok(r.ok);
  assert.deepEqual(r.value.principal, { kind: 'outgoing', actorId: 'actor_outgoing' });
  assert.equal(r.value.actorId, 'actor_outgoing'); assert.equal(r.value.origin, 'web');
  assert.equal(r.value.executionVersion, 4);
  assert.equal(r.value.operationalNow, '2026-10-23T15:00:10.500Z');
  assert.equal(r.value.narrativeNow, '2026-10-24T01:10:00.500Z');
  assert.match(r.value.correlationId, /^correlation_/);
});

test('credenciales Basic: ausente, malformada, incorrecta o sin configurar', async () => {
  const w = world();
  assert.equal(await code(w, input({ authorizationHeader: null })), 'AUTH_REQUIRED');
  assert.equal(await code(w, input({ authorizationHeader: 'Basic ???' })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ authorizationHeader: basic('rodrigo', 'otro') })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ authorizationHeader: basic('intruso', 'secreto-operador') })), 'AUTH_INVALID');
  const closed = world({ config: { operatorSecret: undefined, appOrigin: APP } });
  assert.equal(await code(closed, input({ authorizationHeader: RODRIGO })), 'AUTH_INVALID');
  assert.equal(await code(closed, input({ route: 'POST /api/reset', authorizationHeader: CONTROL })), 'AUTH_INVALID');
});

test('roles: Rodrigo no opera control; control no usa la sesión de otra persona ni Rodrigo opera por otro', async () => {
  const w = world();
  assert.equal(await code(w, input({ route: 'POST /api/reset', authorizationHeader: RODRIGO })), 'FORBIDDEN');
  assert.equal(await code(w, input({ route: 'POST /api/scene', authorizationHeader: RODRIGO })), 'FORBIDDEN');
  assert.equal(await code(w, input({ route: 'POST /api/reset', authorizationHeader: CONTROL })), 'ok');
  assert.equal(await code(w, input({ authorizationHeader: RODRIGO, representedActorId: 'actor_incoming' })), 'FORBIDDEN');
  assert.equal(await code(w, input({ route: 'GET /api/state', authorizationHeader: CONTROL })), 'FORBIDDEN');
});

test('control: origen escenario, principal propio y actor representado verificado', async () => {
  const w = world();
  const reset = await w.service.authorize(input({ route: 'POST /api/reset', authorizationHeader: CONTROL }));
  assert.ok(reset.ok); assert.deepEqual(reset.value.principal, { kind: 'control', operatorId: 'demo_control' });
  assert.equal(reset.value.origin, 'scenario'); assert.equal(reset.value.actorId, null);
  const send = await w.service.authorize(input({ authorizationHeader: CONTROL }));
  assert.ok(send.ok); assert.equal(send.value.actorId, 'actor_outgoing');
  assert.equal(await code(w, input({ authorizationHeader: CONTROL, representedActorId: 'actor_incoming' })), 'FORBIDDEN');
  const accept = await w.service.authorize(input({ route: 'POST /api/handoff/[id]/accept', authorizationHeader: CONTROL, representedActorId: 'actor_incoming', entityId: 'handoff_1', attemptId: 'handoff_attempt_1' }));
  assert.ok(accept.ok); assert.equal(accept.value.actorId, 'actor_incoming'); assert.equal(accept.value.origin, 'scenario');
  assert.equal(await code(w, input({ route: 'POST /api/ack/[id]', authorizationHeader: CONTROL, entityId: 'incident_1' })), 'INVALID_INPUT');
  assert.equal(await code(w, input({ route: 'POST /api/ack/[id]', authorizationHeader: CONTROL, representedActorId: 'actor_ajeno', entityId: 'incident_1' })), 'FORBIDDEN');
});

test('origen: POST con Origin ajeno, ausente o sin APP_ORIGIN se rechaza antes de mirar credenciales', async () => {
  const w = world();
  for (const originHeader of ['https://evil.example', 'null', null]) {
    assert.equal(await code(w, input({ authorizationHeader: RODRIGO, originHeader })), 'ORIGIN_REJECTED', String(originHeader));
  }
  assert.equal(await code(w, input({ authorizationHeader: null, originHeader: 'https://evil.example' })), 'ORIGIN_REJECTED');
  const open = world({ config: { operatorSecret: 'secreto-operador', appOrigin: undefined } });
  assert.equal(await code(open, input({ authorizationHeader: RODRIGO })), 'ORIGIN_REJECTED');
});

test('destinatario: bearer válido acepta solo su relevo, intento y acción', async () => {
  const w = world(); const token = w.grant(HANDOFF_SCOPE);
  const ok = await w.service.authorize(input({ route: 'POST /api/handoff/[id]/accept', authorizationHeader: `Bearer ${token}`, entityId: 'handoff_1', attemptId: 'handoff_attempt_1' }));
  assert.ok(ok.ok); assert.equal(ok.value.actorId, 'actor_incoming'); assert.equal(ok.value.principal.kind, 'recipient'); assert.equal(ok.value.origin, 'web');
  const base = { route: 'POST /api/handoff/[id]/accept', authorizationHeader: `Bearer ${token}`, entityId: 'handoff_1', attemptId: 'handoff_attempt_1' } as const;
  assert.equal(await code(w, input({ ...base, entityId: 'handoff_2' })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ ...base, attemptId: 'handoff_attempt_2' })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ ...base, route: 'POST /api/ack/[id]', entityId: 'incident_1', attemptId: 'incident_attempt_1' })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ ...base, route: 'POST /api/handoff' })), 'FORBIDDEN');
  assert.equal(await code(w, input({ ...base, representedActorId: 'actor_backup' })), 'FORBIDDEN');
  const readOnly = w.grant({ ...HANDOFF_SCOPE, actions: ['read_handoff'] });
  assert.equal(await code(w, input({ ...base, authorizationHeader: `Bearer ${readOnly}` })), 'FORBIDDEN');
});

test('token: ausente, desconocido, mal formado, vencido y de otra ejecución', async () => {
  const w = world(); const base = { route: 'POST /api/handoff/[id]/accept', entityId: 'handoff_1', attemptId: 'handoff_attempt_1' } as const;
  assert.equal(await code(w, input({ ...base })), 'AUTH_REQUIRED');
  assert.equal(await code(w, input({ ...base, authorizationHeader: `Bearer ${generateOpaqueToken()}` })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ ...base, authorizationHeader: 'Bearer corto' })), 'AUTH_INVALID');
  const t = w.grant(HANDOFF_SCOPE);
  w.setNow('2026-10-23T15:29:59.999Z'); assert.equal(await code(w, input({ ...base, authorizationHeader: `Bearer ${t}` })), 'ok');
  w.setNow('2026-10-23T15:30:00.000Z'); assert.equal(await code(w, input({ ...base, authorizationHeader: `Bearer ${t}` })), 'AUTH_EXPIRED');
  w.setNow(T0);
  const old = w.grant(HANDOFF_SCOPE, { executionId: 'execution_old' });
  assert.equal(await code(w, input({ ...base, authorizationHeader: `Bearer ${old}` })), 'AUTH_INVALID');
});

test('reinicio: la ejecución del cuerpo debe ser la vigente (token de la ejecución retirada no actúa)', async () => {
  const w = world(); const old = w.grant(HANDOFF_SCOPE, { executionId: 'execution_old' });
  const r = await w.service.authorize(input({ executionId: 'execution_old', route: 'POST /api/handoff/[id]/accept', authorizationHeader: `Bearer ${old}`, entityId: 'handoff_1', attemptId: 'handoff_attempt_1' }));
  assert.deepEqual(r, { ok: false, code: 'EXECUTION_STALE' });
  assert.equal(await code(w, input({ executionId: 'execution_old', authorizationHeader: RODRIGO })), 'EXECUTION_STALE');
  w.setCurrent(null); assert.equal(await code(w, input({ authorizationHeader: RODRIGO })), 'STORAGE_UNAVAILABLE');
});

test('acuse nativo: el bearer de incidente puede omitir Origin y queda como ntfy_action; Basic no', async () => {
  const w = world(); const token = w.grant(INCIDENT_SCOPE);
  const base = { route: 'POST /api/ack/[id]', entityId: 'incident_1', attemptId: 'incident_attempt_1' } as const;
  const r = await w.service.authorize(input({ ...base, authorizationHeader: `Bearer ${token}`, originHeader: null }));
  assert.ok(r.ok); assert.equal(r.value.origin, 'ntfy_action');
  assert.equal(await code(w, input({ ...base, authorizationHeader: `Bearer ${token}`, originHeader: 'https://evil.example' })), 'ORIGIN_REJECTED');
  assert.equal(await code(w, input({ ...base, authorizationHeader: CONTROL, originHeader: null, representedActorId: 'actor_incoming' })), 'ORIGIN_REJECTED');
  const handoffToken = w.grant(HANDOFF_SCOPE);
  assert.equal(await code(w, input({ route: 'POST /api/handoff/[id]/accept', authorizationHeader: `Bearer ${handoffToken}`, originHeader: null, entityId: 'handoff_1', attemptId: 'handoff_attempt_1' })), 'ORIGIN_REJECTED');
});

test('una concesión de incidente no abre el paquete de relevo y viceversa', async () => {
  const w = world(); const inc = w.grant(INCIDENT_SCOPE);
  assert.equal(await code(w, input({ route: 'read_handoff', authorizationHeader: `Bearer ${inc}`, entityId: 'handoff_1', originHeader: null })), 'AUTH_INVALID');
  const ho = w.grant(HANDOFF_SCOPE);
  assert.equal(await code(w, input({ route: 'read_handoff', authorizationHeader: `Bearer ${ho}`, entityId: 'handoff_1', originHeader: null })), 'ok');
  assert.equal(await code(w, input({ route: 'read_handoff', authorizationHeader: `Bearer ${ho}`, entityId: 'handoff_9', originHeader: null })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ route: 'read_handoff', recipientLinkToken: ho, authorizationHeader: null, entityId: 'handoff_1', originHeader: null })), 'ok');
});

test('sesión pública: cookie ausente, desconocida o vencida; control puede reportar', async () => {
  const w = world(); const cookie = w.session();
  const base = { route: 'POST /api/messages' } as const;
  const ok = await w.service.authorize(input({ ...base, sessionCookie: cookie }));
  assert.ok(ok.ok); assert.deepEqual(ok.value.principal, { kind: 'reporter', sessionId: 'session_a' }); assert.equal(ok.value.actorId, null);
  assert.equal(await code(w, input({ ...base })), 'AUTH_REQUIRED');
  assert.equal(await code(w, input({ ...base, sessionCookie: generateOpaqueToken() })), 'AUTH_INVALID');
  assert.equal(await code(w, input({ ...base, sessionCookie: 'x' })), 'AUTH_INVALID');
  const expired = w.session({ id: 'session_b', expiresAt: '2026-10-23T14:59:59.999Z' });
  assert.equal(await code(w, input({ ...base, sessionCookie: expired })), 'AUTH_EXPIRED');
  assert.equal(await code(w, input({ ...base, authorizationHeader: CONTROL })), 'ok');
  assert.equal(await code(w, input({ ...base, originHeader: 'https://evil.example', sessionCookie: cookie })), 'ORIGIN_REJECTED');
  assert.equal(await code(w, input({ route: 'POST /api/handoff', sessionCookie: cookie })), 'AUTH_REQUIRED');
});

test('lecturas privadas: no exigen Origin pero sí credencial del rol', async () => {
  const w = world(); const cookie = w.session();
  assert.equal(await code(w, input({ route: 'read_outgoing', authorizationHeader: RODRIGO, originHeader: null })), 'ok');
  assert.equal(await code(w, input({ route: 'read_outgoing', authorizationHeader: null, originHeader: null })), 'AUTH_REQUIRED');
  assert.equal(await code(w, input({ route: 'read_control', authorizationHeader: RODRIGO, originHeader: null })), 'FORBIDDEN');
  assert.equal(await code(w, input({ route: 'read_control', authorizationHeader: CONTROL, originHeader: null })), 'ok');
  assert.equal(await code(w, input({ route: 'read_own_reports', sessionCookie: cookie, originHeader: null })), 'ok');
});

test('un fallo de lectura de credenciales o ejecución se informa como almacenamiento no disponible', async () => {
  const boom = async () => { throw new Error('postgres://user:pass@host/db'); };
  const w = world({ executions: { current: boom } });
  const r = await w.service.authorize(input({ authorizationHeader: RODRIGO }));
  assert.deepEqual(r, { ok: false, code: 'STORAGE_UNAVAILABLE' });
  const w2 = world({ credentials: { findGrant: boom, findSession: boom } });
  assert.equal(await code(w2, input({ route: 'POST /api/ack/[id]', authorizationHeader: `Bearer ${generateOpaqueToken()}`, entityId: 'incident_1' })), 'STORAGE_UNAVAILABLE');
});

const op = (role: 'outgoing' | 'control', secret = 'secreto-operador', at = Date.parse(T0)) => issueOperatorToken(role, secret, at);
const cookies = (o: { outgoing?: string; control?: string }) => ({ operatorCookies: { outgoing: o.outgoing ?? null, control: o.control ?? null } });

test('sesión de operador: la cookie de Rodrigo autoriza como Rodrigo y gana sobre un Basic viejo y erróneo', async () => {
  const w = world();
  const r = await w.service.authorize(input({ ...cookies({ outgoing: op('outgoing') }), authorizationHeader: basic('rodrigo', 'vieja-y-mala') }));
  assert.ok(r.ok);
  assert.deepEqual(r.value.principal, { kind: 'outgoing', actorId: 'actor_outgoing' });
  assert.equal(r.value.origin, 'web');
});

test('sesión de operador: control opera control y lee /rodrigo; con ambas sesiones, /rodrigo actúa como Rodrigo', async () => {
  const w = world();
  assert.equal(await code(w, input({ route: 'POST /api/reset', ...cookies({ control: op('control') }) })), 'ok');
  assert.equal(await code(w, input({ route: 'read_outgoing', originHeader: null, ...cookies({ control: op('control') }) })), 'ok');
  const both = await w.service.authorize(input({ ...cookies({ outgoing: op('outgoing'), control: op('control') }) }));
  assert.ok(both.ok); assert.equal(both.value.principal.kind, 'outgoing');
});

test('sesión de operador: la de Rodrigo no abre control (FORBIDDEN, no pide credencial de nuevo)', async () => {
  const w = world();
  assert.equal(await code(w, input({ route: 'read_control', originHeader: null, ...cookies({ outgoing: op('outgoing') }) })), 'FORBIDDEN');
  assert.equal(await code(w, input({ route: 'POST /api/reset', ...cookies({ outgoing: op('outgoing') }) })), 'FORBIDDEN');
  assert.equal(await code(w, input({ route: 'read_control', originHeader: null, ...cookies({ control: op('outgoing') }) })), 'AUTH_REQUIRED', 'token de Rodrigo puesto en la cookie de control');
});

test('sesión de operador: vencida, firmada con otra contraseña o sin contraseña configurada no vale', async () => {
  const w = world();
  assert.equal(await code(w, input({ ...cookies({ outgoing: op('outgoing', 'otra-contrasena') }) })), 'AUTH_REQUIRED');
  assert.equal(await code(w, input({ ...cookies({ outgoing: op('outgoing', 'secreto-operador', Date.parse(T0) - 13 * 3600_000) }) })), 'AUTH_REQUIRED');
  const closed = world({ config: { operatorSecret: undefined, appOrigin: APP } });
  assert.equal(await code(closed, input({ ...cookies({ outgoing: op('outgoing') }) })), 'AUTH_REQUIRED');
});

test('sesión de operador: el POST sigue exigiendo Origin exacto', async () => {
  const w = world();
  assert.equal(await code(w, input({ originHeader: 'https://otro.example', ...cookies({ outgoing: op('outgoing') }) })), 'ORIGIN_REJECTED');
});

test('Basic de respaldo: solo usuarios rodrigo o control con la contraseña de operador', async () => {
  const w = world();
  assert.equal(await code(w, input({ authorizationHeader: basic('rodrigo', 'secreto-operador') })), 'ok');
  assert.equal(await code(w, input({ route: 'POST /api/reset', authorizationHeader: basic('control', 'secreto-operador') })), 'ok');
  assert.equal(await code(w, input({ authorizationHeader: basic('tomas', 'secreto-operador') })), 'AUTH_INVALID');
});
