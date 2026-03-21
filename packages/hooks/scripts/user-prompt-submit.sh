#!/usr/bin/env bash
# packages/hooks/scripts/user-prompt-submit.sh
# Claude Code UserPromptSubmit hook
# Injects project context before every prompt

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"

# Use tsx directly from node_modules to avoid npx cold start
TSX="$HOOKS_DIR/node_modules/.bin/tsx"
if [ ! -x "$TSX" ]; then
  # Fallback to npx
  TSX="npx --prefix $HOOKS_DIR tsx"
fi

exec $TSX "$HOOKS_DIR/src/user-prompt-submit.ts" 2>/dev/null
