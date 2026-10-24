import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from 'dotenv';
import { localClient } from '../../scripts/db/client';
config({ path: '.env.db', quiet: true });

// El adaptador de Prisma formatea y lee timestamptz como si la sesión estuviera en UTC. En un servidor con otra
// zona (el local usa America/Santiago) los instantes quedaban desplazados en la base, aunque la app los leyera bien.
const instant = new Date('2026-10-24T01:10:00.000Z');

test('los clientes de la app guardan y leen instantes reales con cualquier zona horaria del servidor', async () => {
  const url = process.env.RELEVO_BACKEND_TEST_URL!;
  process.env.DATABASE_URL = url;
  const { getDb } = await import('../../src/lib/server/db');
  for (const [name, db] of [['localClient', localClient(url)], ['getDb', getDb()]] as const) {
    try {
      const [zone] = await db.$queryRaw<{ TimeZone: string }[]>`SHOW TimeZone`;
      assert.equal(zone.TimeZone, 'UTC', `${name}: la sesión debe estar en UTC`);
      const [written] = await db.$queryRaw<{ epoch: number }[]>`SELECT extract(epoch FROM ${instant}::timestamptz)::float8 AS epoch`;
      assert.equal(written.epoch * 1000, instant.getTime(), `${name}: escritura desplazada`);
      const [read] = await db.$queryRaw<{ at: Date }[]>`SELECT to_timestamp(${instant.getTime() / 1000}) AS at`;
      assert.equal(read.at.toISOString(), instant.toISOString(), `${name}: lectura desplazada`);
    } finally { await db.$disconnect(); }
  }
});
