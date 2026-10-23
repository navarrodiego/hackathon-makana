#!/bin/bash
# Funciones comunes de las bases por worktree. Solo bash y psql: un worktree recién
# creado todavía no tiene node_modules. Se carga con `source`, no se ejecuta.

PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@17/bin:/usr/local/bin:$PATH"

# Misma convención que scripts/db/destination.ts.
WT_DB_PATTERN='^relevo_wt_[a-z0-9_]+_[0-9a-f]{6}(_test|_test_isolation)?$'
WT_MARK='relevo-wt:'

wt_die() { echo "worktree-db: $*" >&2; exit 1; }

# relevo_wt_<slug de hasta 23>_<hash de la ruta>. Con los sufijos _test_isolation_migrate
# el rol más largo mide 63, el máximo de PostgreSQL.
wt_base_name() {
  local path="$1" slug hash
  slug=$(basename "$path" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//' | cut -c1-23 | sed -E 's/_+$//')
  [ -n "$slug" ] || slug=wt
  hash=$(printf '%s' "$path" | shasum -a 256 | cut -c1-6)
  echo "relevo_wt_${slug}_${hash}"
}

wt_valid_db() { [[ "$1" =~ $WT_DB_PATTERN ]]; }

# Solo PostgreSQL local en el puerto 5432, base postgres y sin parámetros.
wt_check_admin() {
  [[ "$1" =~ ^postgres(ql)?://([^@/?#]+@)?(127\.0\.0\.1|localhost|\[::1\])(:5432)?/postgres$ ]]
}

wt_admin_url() {
  local url="${RELEVO_PG_ADMIN_URL:-}" file="${XDG_CONFIG_HOME:-$HOME/.config}/relevo/admin.env"
  if [ -z "$url" ] && [ -f "$file" ]; then url=$(. "$file" >/dev/null 2>&1; printf '%s' "${RELEVO_PG_ADMIN_URL:-}"); fi
  [ -n "$url" ] || url="postgresql://$(id -un)@127.0.0.1:5432/postgres"
  wt_check_admin "$url" || wt_die "el destino administrativo debe ser PostgreSQL local (127.0.0.1:5432/postgres)."
  printf '%s' "$url"
}

# El script SQL llega por stdin para que las contraseñas no aparezcan en la lista de procesos.
wt_psql() { psql "$WT_ADMIN" -X -q -v ON_ERROR_STOP=1 -At "$@"; }
wt_psql_db() { psql "${WT_ADMIN%/postgres}/$1" -X -q -v ON_ERROR_STOP=1 -At; }

wt_init() {
  command -v psql >/dev/null || wt_die "no se encontró psql."
  WT_ADMIN=$(wt_admin_url) || exit 1
  wt_psql -c 'SELECT 1' >/dev/null 2>&1 || wt_die "no hay conexión con el PostgreSQL local (¿está encendido?)."
  # Verifica el servidor real, no solo el texto de la URL.
  local identity
  identity=$(wt_psql -c "SELECT current_database() || ' ' || coalesce(host(inet_server_addr()),'') || ' ' || inet_server_port()")
  case "$identity" in
    "postgres 127.0.0.1 5432"|"postgres ::1 5432") ;;
    *) wt_die "el servidor administrativo no es el PostgreSQL local esperado." ;;
  esac
}

wt_names() { local b="$1"; echo "$b" "${b}_test" "${b}_test_isolation"; }

wt_db_comment() {
  wt_psql -c "SELECT coalesce(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname='$1'"
}
