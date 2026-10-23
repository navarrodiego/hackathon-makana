#!/bin/bash
# Borra las bases de worktrees que ya no existen (ni en git ni en disco).
# Sin --yes solo lista lo que borraría.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$here/lib.sh"
. "$here/drop.sh"

apply=0; [ "${1:-}" = "--yes" ] && apply=1
wt_init
listed=$(git worktree list --porcelain | sed -n 's/^worktree //p')
count=0
while IFS= read -r db; do
  [ -n "$db" ] || continue
  wt_valid_db "$db" || continue
  case "$db" in *_test|*_test_isolation) continue ;; esac
  mark=$(wt_db_comment "$db")
  case "$mark" in "$WT_MARK"/*) ;; *) continue ;; esac
  path=${mark#"$WT_MARK"}
  if [ -d "$path" ] || printf '%s\n' "$listed" | grep -Fxq -- "$path"; then continue; fi
  count=$((count + 1))
  if [ "$apply" = 1 ]; then wt_drop_environment "$db" "$mark"; else echo "worktree-db: huérfana $db ($path)"; fi
done < <(wt_psql -c "SELECT datname FROM pg_database WHERE datname LIKE 'relevo\_wt\_%' ORDER BY 1")
[ "$apply" = 1 ] || echo "worktree-db: $count por borrar. Usa --yes para aplicar."
