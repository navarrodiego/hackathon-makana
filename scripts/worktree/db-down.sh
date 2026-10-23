#!/bin/bash
# Borra las bases y roles de un worktree (por defecto, el actual). Idempotente.
# Uso: db-down.sh [ruta-del-worktree]
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$here/lib.sh"

target="${1:-$(git rev-parse --show-toplevel)}"
target=$(cd "$target" 2>/dev/null && pwd -P || printf '%s' "$target")
wt_init
base=$(wt_base_name "$target")
wt_valid_db "$base" || wt_die "nombre de base no válido."
. "$here/drop.sh"
wt_drop_environment "$base" "$WT_MARK$target"
