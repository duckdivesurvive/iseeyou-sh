#!/usr/bin/env bash
# packages/hooks/scripts/pre-compact.sh
# Claude Code PreCompact hook
# Injects full project model snapshot before context compaction

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"

exec npx --prefix "$HOOKS_DIR" tsx "$HOOKS_DIR/src/pre-compact.ts" 2>/dev/null
