import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import type { CorrelationId, Instant } from "@/lib/contracts/core";
import type { Execution } from "@/lib/contracts/domain";
import { narrativeNow } from "@/lib/server/auth/service";

/** Contexto interno para evaluar y leer: nunca nace de una petición, no puede actuar por una persona. */
export function systemContext(execution: Execution, now: Instant): CommandContext {
  return {
    executionId: execution.executionId, executionVersion: execution.version, principal: { kind: "system" }, actorId: null,
    origin: "system", operationalNow: now, narrativeNow: narrativeNow(execution, now), correlationId: `correlation_${randomUUID()}` as CorrelationId,
  };
}
