import 'dotenv/config';
import { Prisma } from '../../src/generated/prisma/client';
import { spawnSync } from 'node:child_process';
import { localClient } from './client';
import { localDestination, verifyLocalConnection } from './destination';

try {
  const app = localDestination(process.env.DATABASE_URL);
  const direct = localDestination(process.env.DIRECT_URL || process.env.DATABASE_URL);
  if (app.database !== direct.database) throw new Error('Las conexiones deben apuntar a la misma base local');
  for (const target of [app, direct]) {
    const db = localClient(target.url);
    try { await verifyLocalConnection(db, target.url); } finally { await db.$disconnect(); }
  }
  // El hijo conserva las URLs privadas; solo se publica el nombre de base permitido.
  const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: app.url, DIRECT_URL: direct.url } });
  if (result.status !== 0) throw new Error('No se pudo aplicar la migración local');
  const owner = localClient(direct.url);
  try {
    // La aplicación no puede modificar el historial que usa Prisma para migrar.
    await owner.$executeRaw(Prisma.sql`REVOKE ALL ON TABLE "_prisma_migrations" FROM ${Prisma.raw('"' + app.database + '_app"')}`);
  } finally { await owner.$disconnect(); }
  console.info(`Migraciones aplicadas: ${app.database}`);
} catch {
  console.error('Migración local rechazada o fallida. Comprueba destino, acceso y migraciones.');
  process.exitCode = 1;
}
