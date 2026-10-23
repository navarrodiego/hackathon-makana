import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ActorId, CorrelationId, ExecutionId } from "@/lib/contracts/core";
import type { ServiceResult } from "@/lib/contracts/http";
import type { CredentialReader, ExecutionReader, TransactionRepositories, UnitOfWork } from "@/lib/contracts/repositories";
import { loadAuthConfig } from "./config";
import { createAuthorizationService, type AuthConfig, type AuthDeps, type AuthDirectory } from "./service";

type Persistence = UnitOfWork & ExecutionReader & CredentialReader;

/** Lecturas de referencia mediante los repositorios de T03, en una unidad de trabajo corta sin escrituras. */
export function persistenceDirectory(store: Persistence): AuthDirectory {
  async function read<T>(executionId: ExecutionId, work: (tx: TransactionRepositories) => Promise<T>): Promise<T | null> {
    const execution = await store.current();
    if (!execution || execution.executionId !== executionId) return null;
    const context: CommandContext = {
      executionId, executionVersion: execution.version, principal: { kind: "system" }, actorId: null, origin: "system",
      operationalNow: execution.createdAt, narrativeNow: execution.anchor.narrativeAt, correlationId: `correlation_${randomUUID()}` as CorrelationId,
    };
    const result: ServiceResult<T> = await store.run(context, async tx => ({ ok: true, value: await work(tx) }));
    if (result.ok) return result.value;
    if (result.code === "EXECUTION_STALE") return null;
    throw new Error(result.code);
  }
  return {
    outgoingActorId: async (executionId): Promise<ActorId | null> =>
      (await read(executionId, async tx => (await tx.aggregates.handoffs.list())[0]?.outgoingActorId ?? null)) ?? null,
    actorExists: async (executionId, actorId) =>
      (await read(executionId, async tx => (await tx.reference.actors()).some(a => a.id === actorId))) ?? false,
  };
}

export function createPersistedAuthorization(store: Persistence, config: AuthConfig = loadAuthConfig(), now: AuthDeps["now"] = () => new Date().toISOString() as ReturnType<AuthDeps["now"]>) {
  return createAuthorizationService({
    executions: store, credentials: store, directory: persistenceDirectory(store), config, now,
    correlationId: () => `correlation_${randomUUID()}` as CorrelationId,
    persistGrant: (context, grant) => store.run(context, async tx => { await tx.credentials.saveGrant(grant); return { ok: true, value: null }; }),
  });
}
