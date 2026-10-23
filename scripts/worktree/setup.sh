#!/bin/bash
# Migra las 3 bases del worktree, siembra la de desarrollo y comprueba la conexión.
set -euo pipefail
[ -f .env ] || { echo "Falta .env: ejecuta scripts/worktree/db-up.sh." >&2; exit 1; }
set -a; . ./.env; set +a
migrate() { DATABASE_URL="$1" DIRECT_URL="$2" pnpm db:migrate:local; }
migrate "$DATABASE_URL" "$DIRECT_URL"
migrate "$RELEVO_BACKEND_TEST_URL" "$RELEVO_BACKEND_TEST_DIRECT_URL"
migrate "$RELEVO_BACKEND_TEST_ISOLATION_URL" "$RELEVO_BACKEND_TEST_ISOLATION_DIRECT_URL"
pnpm db:seed:local
pnpm db:check
