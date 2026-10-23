#!/bin/bash
# Activa .githooks para este clon y todos sus worktrees (config compartida). Una vez.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "core.hooksPath = $(git config core.hooksPath)"
