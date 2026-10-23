import "server-only";
import { SECURITY } from "@/lib/contracts/auth";
import type { ChannelViewDTO } from "@/lib/contracts/public";
import { runtime } from "./runtime";

/**
 * Lectura de `/canal` (C08): solo los reportes de la sesión de la cookie. Sin cookie válida no se muestra nada
 * ajeno ni se crea una sesión aquí: la entrada es el proxy.
 */
export async function loadChannelView(cookieHeader: string | null): Promise<ChannelViewDTO | null> {
  try {
    const { store, authorization, read } = runtime();
    const execution = await store.current();
    if (!execution) return null;
    const matches = (cookieHeader ?? "").split(";").map(c => c.trim()).filter(c => c.startsWith(`${SECURITY.sessionCookieName}=`));
    const authorized = await authorization.authorize({
      route: "read_own_reports", executionId: execution.executionId, authorizationHeader: null, originHeader: null,
      sessionCookie: matches.length === 1 ? matches[0].slice(SECURITY.sessionCookieName.length + 1) : null,
    });
    if (!authorized.ok) return null;
    const view = await read.ownReports(authorized.value);
    return view.ok ? view.value : null;
  } catch { return null; }
}
