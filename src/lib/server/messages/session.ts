import "server-only";
import type { CommandContext, PublicSessionService } from "@/lib/contracts/auth";
import { LIMITS, type Instant, type ReportSessionId } from "@/lib/contracts/core";
import type { ReportSession } from "@/lib/contracts/domain";
import type { CredentialReader, ExecutionReader, SessionWriter, TransactionRepositories } from "@/lib/contracts/repositories";
import { generateOpaqueToken, hashCredential, isWellFormedToken } from "@/lib/server/auth/credentials";

const at = (instant: Instant) => Date.parse(instant);

/**
 * Sesión de escenario estable por ejecución (C13): control no elige una sesión nueva en cada reporte.
 * Su hash no deriva de ninguna credencial entregable, así que ninguna cookie puede coincidir con ella.
 */
export async function scenarioSessionId(tx: TransactionRepositories, context: CommandContext): Promise<ReportSessionId> {
  const credentialHash = hashCredential(`scenario:${context.executionId}`);
  const existing = await tx.credentials.findSession(credentialHash);
  if (existing) return existing.id;
  const session: ReportSession = {
    id: `session_scenario_${context.executionId}` as ReportSessionId, credentialHash,
    expiresAt: new Date(at(context.operationalNow) + LIMITS.sessionMaxAgeMs).toISOString() as Instant,
  };
  await tx.credentials.saveSession(session);
  return session.id;
}

export interface PublicSessionDeps {
  readonly store: ExecutionReader & CredentialReader & SessionWriter;
}

/** Entrada GET del canal (C12): reutiliza una sesión vigente o emite una nueva. Nunca envía reportes. */
export function createPublicSessionService(deps: PublicSessionDeps): PublicSessionService {
  return {
    async enter(existingCookie, operationalNow) {
      if (existingCookie && isWellFormedToken(existingCookie)) {
        const found = await deps.store.findSession(hashCredential(existingCookie));
        if (found && at(operationalNow) < at(found.expiresAt)) return { ok: true, value: { sessionId: found.id, expiresAt: found.expiresAt, newOpaqueCookie: null } };
      }
      const execution = await deps.store.current();
      if (!execution) return { ok: false, code: "STORAGE_UNAVAILABLE" };
      const token = generateOpaqueToken();
      const session: ReportSession = {
        id: `session_${crypto.randomUUID()}` as ReportSessionId, credentialHash: hashCredential(token),
        expiresAt: new Date(at(operationalNow) + LIMITS.sessionMaxAgeMs).toISOString() as Instant,
      };
      await deps.store.saveSession(session);
      return { ok: true, value: { sessionId: session.id, expiresAt: session.expiresAt, newOpaqueCookie: token } };
    },
  };
}
