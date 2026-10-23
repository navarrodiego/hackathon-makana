/** Minúsculas, sin diacríticos, espacios colapsados: misma clave para el mismo hecho con otra redacción. */
export function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
