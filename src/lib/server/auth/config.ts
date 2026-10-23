import "server-only";
import { SECURITY } from "@/lib/contracts/auth";
import type { AuthConfig } from "./service";

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

/**
 * Falla cerrada: sin OPERATOR_SECRET, o con menos caracteres que el mínimo, nadie entra a /rodrigo ni /control.
 * Se recorta para tolerar un salto de línea pegado al configurar la variable en el proveedor.
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const secret = env[SECURITY.operatorSecretVariable]?.trim();
  return {
    operatorSecret: secret && secret.length >= SECURITY.operatorSecretMinLength ? secret : undefined,
    appOrigin: validOrigin(env[SECURITY.allowedOriginVariable]),
  };
}
