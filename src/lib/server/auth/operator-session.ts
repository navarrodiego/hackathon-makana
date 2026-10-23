import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { LIMITS } from "@/lib/contracts/core";
import type { OperatorRole } from "@/lib/contracts/auth";

const VERSION = "v1";
const ROLES: readonly OperatorRole[] = ["outgoing", "control"];
const NONCE = /^[A-Za-z0-9_-]{22}$/;

const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/**
 * Sesión de operador sin estado (C12): `v1.<rol>.<expiraMs>.<nonce>.<hmac>`, firmada con OPERATOR_SECRET.
 * El rol va dentro de la firma; cambiar la contraseña invalida todas las sesiones emitidas.
 */
export function issueOperatorToken(role: OperatorRole, secret: string, nowMs: number): string {
  const payload = [VERSION, role, String(nowMs + LIMITS.sessionMaxAgeMs), randomBytes(16).toString("base64url")].join(".");
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyOperatorToken(token: string | null | undefined, role: OperatorRole, secret: string | undefined, nowMs: number): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 5) return false;
  const [version, tokenRole, expires, nonce, mac] = parts;
  if (version !== VERSION || tokenRole !== role || !ROLES.includes(tokenRole) || !/^\d{1,15}$/.test(expires) || !NONCE.test(nonce)) return false;
  const expected = Buffer.from(sign(secret, parts.slice(0, 4).join(".")));
  const provided = Buffer.from(mac);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  return nowMs < Number(expires);
}
