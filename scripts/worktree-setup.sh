#!/bin/sh
# Deja un worktree listo para probar contra PostgreSQL local: dependencias, cliente Prisma y bases propias.
# Idempotente y rápido si ya está preparado. Uso: pnpm worktree:setup (o sh scripts/worktree-setup.sh).
# Pensado para llamarse al crear un worktree (hook SessionStart/WorktreeCreate que el usuario habilite) o a mano.
set -e
cd "$(git rev-parse --show-toplevel)"
[ -f .env.t03 ] && [ -f .env ] && exit 0
# Solo worktrees enlazados: en el checkout principal `.git` es un directorio y la preparación es manual (docs/SETUP.md).
[ -f .git ] || exit 0
[ -d node_modules ] || pnpm install --frozen-lockfile --prefer-offline >&2
[ -d src/generated/prisma ] || pnpm db:generate >&2
pnpm -s db:worktree --quiet >&2 || echo "Aviso: no se pudieron preparar las bases del worktree; ejecuta pnpm db:worktree para ver el motivo." >&2
