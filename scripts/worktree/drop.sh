#!/bin/bash
# wt_drop_environment <base> <marca>: borra solo bases con esa marca y sus roles.
wt_drop_environment() {
  local base="$1" mark="$2" n found=0
  for n in $(wt_names "$base"); do
    wt_valid_db "$n" || wt_die "nombre no permitido: $n"
    if [ -n "$(wt_psql -c "SELECT 1 FROM pg_database WHERE datname='$n'")" ]; then
      [ "$(wt_db_comment "$n")" = "$mark" ] || wt_die "la base $n no pertenece a este worktree; no se borra."
      wt_psql -c "DROP DATABASE \"$n\" WITH (FORCE)"
      found=1
    fi
    wt_psql -c "DROP ROLE IF EXISTS \"${n}_app\"" -c "DROP ROLE IF EXISTS \"${n}_migrate\""
  done
  if [ "$found" = 1 ]; then echo "worktree-db: bases de $base eliminadas."; else echo "worktree-db: no había bases de $base."; fi
}
