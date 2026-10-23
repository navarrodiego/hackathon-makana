import "server-only";
import type { HandoffNoteService } from "@/lib/contracts/services";
import type { AuthorizationService } from "@/lib/contracts/auth";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { getDb } from "@/lib/server/db";
import { createOpenRouterProvider } from "@/lib/server/providers/openrouter";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createHandoffNoteService } from "./service";

let cached: { readonly note: HandoffNoteService; readonly auth: AuthorizationService } | undefined;

/** Ensamblado perezoso: no abre conexiones ni lee secretos al importar (build). */
export function handoffNoteRuntime() {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    cached = { note: createHandoffNoteService({ unitOfWork: store, provider: createOpenRouterProvider() }), auth: createPersistedAuthorization(store) };
  }
  return cached;
}
