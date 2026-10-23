#!/bin/bash
# Vía recomendada para borrar un worktree: primero su base, luego el checkout.
# Uso: remove.sh <ruta-del-worktree> [--force]
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[ -n "${1:-}" ] || { echo "Uso: remove.sh <ruta-del-worktree> [--force]" >&2; exit 2; }
path=$(cd "$1" && pwd -P)
[ "$path" != "$(git rev-parse --show-toplevel)" ] || { echo "No se puede borrar el worktree desde el que se ejecuta." >&2; exit 2; }
"$here/db-down.sh" "$path"
git worktree remove ${2:+"$2"} "$path"
