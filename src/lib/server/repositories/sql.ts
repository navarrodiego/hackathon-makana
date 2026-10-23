import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client';
export type Tx = Prisma.TransactionClient;
export type Row = Record<string, unknown>;
export const identifier = (name: string): Prisma.Sql => Prisma.raw('"' + name.replaceAll('"', '""') + '"');
export const canonical = (value: unknown): string => JSON.stringify(sort(value));
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sort(v)]));
  return value;
}
export const keyHash = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
export const jsonFields = new Set(['anchor', 'savedSuggestion', 'scope', 'equivalence', 'entity', 'principal', 'details', 'subject', 'response', 'value']);
export function parameter(key: string, value: unknown): Prisma.Sql {
  if (value === null || value === undefined) return Prisma.sql`NULL`;
  if (jsonFields.has(key)) return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  if (Array.isArray(value)) return Prisma.sql`ARRAY[${Prisma.join(value.map(v => Prisma.sql`${v}`))}]::text[]`;
  if (typeof value === 'string' && /^(\d{4})-\d\d-\d\dT/.test(value) && (key.endsWith('At') || key === 'expiresAt')) return Prisma.sql`${new Date(value)}`;
  return Prisma.sql`${value}`;
}
export function decode<T>(value: unknown): T {
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map(v => decode(v)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)])) as T;
  return value as T;
}
export async function insert(tx: Tx, table: string, row: Row): Promise<void> {
  const entries = Object.entries(row);
  await tx.$executeRaw(Prisma.sql`INSERT INTO ${identifier(table)} (${Prisma.join(entries.map(([k]) => identifier(k)))}) VALUES (${Prisma.join(entries.map(([k, v]) => parameter(k, v)))})`);
}
export async function select<T>(tx: Tx, table: string, where: Prisma.Sql, order = Prisma.empty): Promise<T[]> {
  const rows = await tx.$queryRaw<Row[]>(Prisma.sql`SELECT * FROM ${identifier(table)} WHERE ${where} ${order}`);
  return rows.map(r => decode<T>(r));
}
export async function update(tx: Tx, table: string, row: Row, where: Prisma.Sql): Promise<number> {
  return tx.$executeRaw(Prisma.sql`UPDATE ${identifier(table)} SET ${Prisma.join(Object.entries(row).map(([k, v]) => Prisma.sql`${identifier(k)}=${parameter(k, v)}`))} WHERE ${where}`);
}
export const executionLock = (tx: Tx) => tx.$executeRaw`SELECT pg_advisory_xact_lock(209030, 1)`;
