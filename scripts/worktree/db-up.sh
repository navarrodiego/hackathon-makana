#!/bin/bash
# Crea las 3 bases locales (desarrollo, test, test_isolation) con sus 6 roles para este
# worktree y escribe su .env (0600). No sobrescribe un .env existente ni toca otras bases.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$here/lib.sh"

root=$(git rev-parse --show-toplevel)
cd "$root"
[ -f scripts/db/destination.ts ] || wt_die "esta rama no incluye la base t00; no se prepara base."
if [ -f .env ]; then echo "worktree-db: .env ya existe; no se cambia nada."; exit 0; fi

wt_init
base=$(wt_base_name "$root")
wt_valid_db "$base" || wt_die "nombre de base no válido."
mark="$WT_MARK$root"

for n in $(wt_names "$base"); do
  # No adoptar una base ajena con el mismo nombre.
  exists=$(wt_psql -c "SELECT 1 FROM pg_database WHERE datname='$n'")
  if [ -n "$exists" ] && [ "$(wt_db_comment "$n")" != "$mark" ]; then wt_die "la base $n existe y no pertenece a este worktree."; fi
done

declare -a app_url migrate_url
i=0
for n in $(wt_names "$base"); do
  pa=$(openssl rand -hex 32); pm=$(openssl rand -hex 32)
  # Identificadores validados por wt_valid_db; contraseñas hexadecimales generadas.
  wt_psql <<SQL
SELECT 'CREATE ROLE "${n}_migrate" LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${n}_migrate') \gexec
SELECT 'CREATE ROLE "${n}_app" LOGIN' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${n}_app') \gexec
ALTER ROLE "${n}_migrate" PASSWORD '$pm' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 2;
ALTER ROLE "${n}_app" PASSWORD '$pa' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 3;
SELECT 'CREATE DATABASE "${n}" OWNER "${n}_migrate"' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${n}') \gexec
COMMENT ON DATABASE "${n}" IS '$mark';
REVOKE ALL ON DATABASE "${n}" FROM PUBLIC;
GRANT CONNECT ON DATABASE "${n}" TO "${n}_app";
SQL
  wt_psql_db "$n" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO "${n}_app";
ALTER DEFAULT PRIVILEGES FOR ROLE "${n}_migrate" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${n}_app";
SQL
  host_part=${WT_ADMIN#*://}; host_part=${host_part#*@}; host_part=${host_part%/postgres}
  app_url[$i]="postgresql://${n}_app:${pa}@${host_part}/${n}"
  migrate_url[$i]="postgresql://${n}_migrate:${pm}@${host_part}/${n}"
  i=$((i + 1))
done

umask 077
tmp=$(mktemp ".env.XXXXXX")
trap 'rm -f "$tmp"' EXIT
{
  if [ -f .env.example ]; then
    DEV_APP=${app_url[0]} DEV_DIRECT=${migrate_url[0]} T_APP=${app_url[1]} I_APP=${app_url[2]} awk '
      /^DATABASE_URL=/ { print "DATABASE_URL=" ENVIRON["DEV_APP"]; next }
      /^DIRECT_URL=/ { print "DIRECT_URL=" ENVIRON["DEV_DIRECT"]; next }
      /^RELEVO_BACKEND_TEST_URL=/ { print "RELEVO_BACKEND_TEST_URL=" ENVIRON["T_APP"]; next }
      /^RELEVO_BACKEND_TEST_ISOLATION_URL=/ { print "RELEVO_BACKEND_TEST_ISOLATION_URL=" ENVIRON["I_APP"]; next }
      { print }' .env.example
  fi
  echo
  echo "# Generado por scripts/worktree/db-up.sh. Conexiones de migración de las bases de prueba."
  echo "RELEVO_BACKEND_TEST_DIRECT_URL=${migrate_url[1]}"
  echo "RELEVO_BACKEND_TEST_ISOLATION_DIRECT_URL=${migrate_url[2]}"
} > "$tmp"
mv "$tmp" .env
trap - EXIT
# Mismo archivo que escribe `pnpm db:worktree` (T06): así scripts/worktree-setup.sh lo ve
# completo y no rota estas credenciales.
if [ ! -f .env.t03 ]; then
  {
    echo "RELEVO_BACKEND_URL=${app_url[0]}"; echo "RELEVO_BACKEND_DIRECT_URL=${migrate_url[0]}"
    echo "RELEVO_BACKEND_TEST_URL=${app_url[1]}"; echo "RELEVO_BACKEND_TEST_DIRECT_URL=${migrate_url[1]}"
    echo "RELEVO_BACKEND_TEST_ISOLATION_URL=${app_url[2]}"; echo "RELEVO_BACKEND_TEST_ISOLATION_DIRECT_URL=${migrate_url[2]}"
  } > .env.t03
fi
echo "worktree-db: bases $base, ${base}_test y ${base}_test_isolation preparadas; .env creado (0600)."
echo "worktree-db: siguiente paso: pnpm install --frozen-lockfile && pnpm db:worktree:setup"
