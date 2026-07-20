#!/bin/bash
# harness-sync.sh — promote the SOURCE harness to the runtime targets.
#
# Topology (field: ledger D-105/D-111): the SOURCE tree is truth, but the
# RUNTIME reads the plugin CACHE, and a MIRROR exists too. A fix in source does
# not reach runtime until it is promoted — and there was no sanctioned path to do
# it (the auto-classifier blocks ad-hoc cache edits). This script is that path.
#
# Operator-run (or operator-permitted): promotion changes enforcement for EVERY
# session, so it is a human-gated step, not a hook side effect.
#
# Usage:  bash harness-sync.sh [--check] <plugin-version>
#   --check  diff-only; report drift, change nothing (default if no write intent).
#
# It copies harness/hooks/*.sh + config.example.sh from SOURCE to each target and
# verifies byte-equality by checksum. Never touches .env, never pushes, never
# deletes unknown files — only the known hook set.

set -u
SRC_ROOT="$(cd "$(dirname "$0")/.." && pwd)"          # …/mnfs-harness/harness
HOME_DIR="${HOME:-$USERPROFILE}"
VER="${2:-${1:-}}"
MODE="report"
case "${1:-}" in --check) MODE="report" ;; *) [ -n "${1:-}" ] && VER="$1" ;; esac
[ "${1:-}" = "--write" ] && MODE="write"

TARGETS="
$HOME_DIR/.claude/plugins/cache/mnfs-harness/harness/$VER/hooks
$HOME_DIR/.claude/plugins/marketplaces/mnfs-harness/harness/hooks
"
FILES="merge-gate.sh stop-gate.sh dispatch-lint.sh hooks.json"

sum() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

drift=0
for t in $TARGETS; do
  [ -d "$t" ] || { echo "SKIP (absent): $t"; continue; }
  for f in $FILES; do
    s="$SRC_ROOT/hooks/$f"; d="$t/$f"
    [ -f "$s" ] || continue
    if [ ! -f "$d" ] || [ "$(sum "$s")" != "$(sum "$d")" ]; then
      drift=1
      if [ "$MODE" = "write" ]; then cp "$s" "$d" && echo "SYNCED $d"; else echo "DRIFT  $d"; fi
    fi
  done
done

if [ "$MODE" = "report" ]; then
  [ "$drift" = 0 ] && echo "in sync." || echo "drift found — run: bash harness-sync.sh --write $VER (operator-gated)."
fi
