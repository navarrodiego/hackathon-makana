import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SECURITY } from "@/lib/contracts/auth";

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const TOKEN_LENGTH = Math.ceil((SECURITY.tokenEntropyBytes * 4) / 3);

export function generateOpaqueToken(): string {
  return randomBytes(SECURITY.tokenEntropyBytes).toString("base64url");
}

/** El token crudo solo viaja al destinatario; se persiste únicamente este hash (C12). */
export function hashCredential(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedToken(token: string): boolean {
  return token.length === TOKEN_LENGTH && BASE64URL.test(token);
}

export function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  return match && isWellFormedToken(match[1]) ? match[1] : null;
}

export function parseBasic(header: string | null): { username: string; secret: string } | null {
  const match = header?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const split = decoded.indexOf(":");
  if (split < 1 || split === decoded.length - 1) return null;
  return { username: decoded.slice(0, split), secret: decoded.slice(split + 1) };
}

/** Comparación en tiempo constante; un valor vacío o ausente nunca coincide. */
export function secretsEqual(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
