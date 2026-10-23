import 'dotenv/config';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { localAdminDestination } from './destination';

const names = ['relevo_backend', 'relevo_backend_test', 'relevo_backend_test_isolation'];
const privateFile = '.env.t03';
try {
  const url = localAdminDestination(process.env.LOCAL_POSTGRES_ADMIN_URL);
  // No reemplazar conexiones privadas ni tocar bases/roles existentes.
  const exists = await access(privateFile).then(() => true, () => false);
  if (exists) throw new Error('Ya existe configuración privada');
  const admin = new Client({ connectionString: url });
  await admin.connect();
  const records: string[] = [];
  try {
    const identity = await admin.query<{ database: string; address: string; port: number }>('SELECT current_database() AS database, host(inet_server_addr()) AS address, inet_server_port() AS port');
    const row = identity.rows[0];
    if (row.database !== 'postgres' || !['127.0.0.1', '::1'].includes(row.address) || row.port !== 5432) throw new Error('Destino distinto');
    const roles = names.flatMap(n => [n + '_app', n + '_migrate']);
    const existing = await admin.query('SELECT datname FROM pg_database WHERE datname=ANY($1) UNION ALL SELECT rolname FROM pg_roles WHERE rolname=ANY($2)', [names, roles]);
    if (existing.rowCount) throw new Error('Hay recursos existentes');
    for (const database of names) {
      const urls: Record<string, string> = {};
      for (const kind of ['migrate', 'app']) {
        const role = database + '_' + kind;
        const password = randomBytes(32).toString('hex');
        // Identificadores de lista cerrada y contraseña hexadecimal generada;
        // PostgreSQL no admite placeholders en este DDL.
        await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT ${kind === 'app' ? 3 : 2}`);
        const connection = new URL(url);
        connection.username = role; connection.password = password; connection.pathname = '/' + database;
        urls[kind] = connection.toString();
      }
      await admin.query(`CREATE DATABASE "${database}" OWNER "${database}_migrate"`);
      await admin.query(`REVOKE ALL ON DATABASE "${database}" FROM PUBLIC`);
      await admin.query(`GRANT CONNECT ON DATABASE "${database}" TO "${database}_app"`);
      const target = new URL(url); target.pathname = '/' + database;
      const db = new Client({ connectionString: target.toString() });
      await db.connect();
      try {
        await db.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
        await db.query(`GRANT USAGE ON SCHEMA public TO "${database}_app"`);
        await db.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${database}_migrate" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${database}_app"`);
      } finally { await db.end(); }
      records.push(`${database.toUpperCase()}_URL=${urls.app}`, `${database.toUpperCase()}_DIRECT_URL=${urls.migrate}`);
    }
    await writeFile(privateFile, records.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
    console.info('Tres bases locales y seis roles preparados. Conexiones en .env.t03 (0600); sin migrar ni enviar avisos.');
  } finally { await admin.end(); }
} catch {
  console.error('Preparación local rechazada o fallida. No se reemplazan recursos existentes. Si hubo un fallo intermedio, revisa los recursos creados antes de repetir.');
  process.exitCode = 1;
}
