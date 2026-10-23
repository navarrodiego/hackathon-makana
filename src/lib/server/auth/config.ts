import "server-only";
import { SECURITY } from "@/lib/contracts/auth";
import type { AuthConfig, BasicCredential } from "./service";

function pair(env: NodeJS.ProcessEnv, userKey: string, secretKey: string): BasicCredential | undefined {
  const username = env[userKey]?.trim(), secret = env[secretKey];
  return username && secret ? { username, secret } : undefined;
}

// HTTPS siempre; HTTP solo en loopback de desarrollo (C12). Debe ser un origen exacto, sin ruta ni credenciales.
function validOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.origin !== value || url.username || url.password) return undefined;
    return url.protocol === "https:" || (url.protocol === "http:" && loopback) ? value : undefined;
  } catch { return undefined; }
}

/** Falla cerrada: un rol sin par completo, o con credenciales repetidas entre roles, queda desactivado. */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  let outgoing = pair(env, SECURITY.outgoingUsernameVariable, SECURITY.outgoingSecretVariable);
  let control = pair(env, SECURITY.controlUsernameVariable, SECURITY.controlSecretVariable);
  if (outgoing && control && (outgoing.username === control.username || outgoing.secret === control.secret)) { outgoing = undefined; control = undefined; }
  return { outgoing, control, appOrigin: validOrigin(env[SECURITY.allowedOriginVariable]) };
}
