import 'dotenv/config';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { localAdminDestination, localDestination } from './destination';
import { worktreeDatabases } from './worktree-names';

// Prepara, de forma idempotente, las tres bases locales de ESTE worktree y deja `.env.db` y `.env`
// (ambos ignorados por Git, 0600). Solo toca nombres derivados de la ruta del worktree; nunca
// relevo_backend*, relevo_integracion ni destinos remotos. `--drop` retira solo esos recursos.
const KEYS = ['RELEVO_BACKEND_URL', 'RELEVO_BACKEND_DIRECT_URL', 'RELEVO_BACKEND_TEST_URL', 'RELEVO_BACKEND_TEST_DIRECT_URL', 'RELEVO_BACKEND_TEST_ISOLATION_URL', 'RELEVO_BACKEND_TEST_ISOLATION_DIRECT_URL'];
const quiet = process.argv.includes('--quiet');
const log = (m: string) => { if (!quiet) console.info(m); };

function sh(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(cmd, args, { encoding: 'utf8', env });
}
const root = sh('git', ['rev-parse', '--show-toplevel']).stdout.trim() || process.cwd();
const names = worktreeDatabases(root);
const list = [names.dev, names.test, names.isolation];
const roleOf = (db: string, kind: 'app' | 'migrate') => `${db}_${kind}`;

async function main() {
  const adminUrl = localAdminDestination(process.env.LOCAL_POSTGRES_ADMIN_URL ?? `postgresql://${encodeURIComponent(userInfo().username)}@127.0.0.1:5432/postgres`);
  for (const db of list) localDestination(`postgresql://x@127.0.0.1:5432/${db}`); // la guarda debe aceptar cada nombre
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const identity = (await admin.query<{ database: string; address: string; port: number }>('SELECT current_database() AS database, host(inet_server_addr()) AS address, inet_server_port() AS port')).rows[0];
    if (identity.database !== 'postgres' || !['127.0.0.1', '::1'].includes(identity.address) || identity.port !== 5432) throw new Error('Destino distinto');
    if (process.argv.includes('--drop')) {
      for (const db of list) {
        await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
        for (const k of ['app', 'migrate'] as const) await admin.query(`DROP ROLE IF EXISTS "${roleOf(db, k)}"`);
      }
      log(`Recursos de ${names.dev} retirados.`);
      return;
    }
    const complete = existsSync('.env.db') && KEYS.every(k => new RegExp(`^${k}=.+`, 'm').test(readFileSync('.env.db', 'utf8')));
    if (complete && !process.argv.includes('--force')) { log('Este worktree ya tiene .env.db; no se cambia nada (usa --force para rotar credenciales).'); return; }
    const records: string[] = [];
    for (const db of list) {
      const urls: Record<string, string> = {};
      for (const kind of ['migrate', 'app'] as const) {
        const role = roleOf(db, kind);
        const password = randomBytes(32).toString('hex'); // hexadecimal: seguro dentro del DDL
        const exists = (await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount;
        await admin.query(`${exists ? 'ALTER' : 'CREATE'} ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT ${kind === 'app' ? 3 : 2}`);
        const u = new URL(adminUrl); u.username = role; u.password = password; u.pathname = '/' + db;
        urls[kind] = u.toString();
      }
      if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [db])).rowCount) await admin.query(`CREATE DATABASE "${db}" OWNER "${roleOf(db, 'migrate')}"`);
      await admin.query(`REVOKE ALL ON DATABASE "${db}" FROM PUBLIC`);
      await admin.query(`GRANT CONNECT ON DATABASE "${db}" TO "${roleOf(db, 'app')}"`);
      const target = new URL(adminUrl); target.pathname = '/' + db;
      const inner = new Client({ connectionString: target.toString() });
      await inner.connect();
      try {
        await inner.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
        await inner.query(`GRANT USAGE ON SCHEMA public TO "${roleOf(db, 'app')}"`);
        await inner.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${roleOf(db, 'migrate')}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${roleOf(db, 'app')}"`);
      } finally { await inner.end(); }
      const migrated = sh('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { ...process.env, DATABASE_URL: urls.app, DIRECT_URL: urls.migrate });
      if (migrated.status !== 0) throw new Error(`No se pudo migrar ${db}`);
      const owner = new Client({ connectionString: urls.migrate });
      await owner.connect();
      try { await owner.query(`REVOKE ALL ON TABLE "_prisma_migrations" FROM "${roleOf(db, 'app')}"`); } finally { await owner.end(); }
      const prefix = db === names.dev ? 'RELEVO_BACKEND' : db === names.test ? 'RELEVO_BACKEND_TEST' : 'RELEVO_BACKEND_TEST_ISOLATION';
      records.push(`${prefix}_URL=${urls.app}`, `${prefix}_DIRECT_URL=${urls.migrate}`);
      if (db === names.dev) records.push(`DEV_DATABASE_URL=${urls.app}`, `DEV_DIRECT_URL=${urls.migrate}`);
    }
    const dev = { app: records.find(r => r.startsWith('DEV_DATABASE_URL='))!.slice(17), direct: records.find(r => r.startsWith('DEV_DIRECT_URL='))!.slice(15) };
    await writeFile('.env.db', records.filter(r => !r.startsWith('DEV_')).join('\n') + '\n', { mode: 0o600 });
    if (!existsSync('.env')) await writeFile('.env', `DATABASE_URL=${dev.app}\nDIRECT_URL=${dev.direct}\n`, { mode: 0o600, flag: 'wx' });
    else log('.env ya existe: no se modificó; usa RELEVO_BACKEND_URL de .env.db si necesitas la conexión de desarrollo.');
    log(`Worktree preparado: ${list.join(', ')} (migradas, sin seed). Credenciales en .env.db y .env.`);
  } finally { await admin.end(); }
}
main().catch(() => {
  console.error('Preparación de bases del worktree rechazada o fallida. Revisa PostgreSQL local (127.0.0.1:5432) y LOCAL_POSTGRES_ADMIN_URL.');
  process.exitCode = 1;
});
