#!/bin/bash
# stop-gate.sh — Stop hook.
# Blocks a CHIP session from ending its turn after claiming CLOSED without an
# evidence pack on disk. Deterministic completion gate (HARNESS-CORE §9).
#
# Scope guard: only acts when
#   (a) cwd is a chip worktree (path contains /.claude/worktrees/), AND
#   (b) the recent transcript tail contains a CLOSED chip-event claim.
# Otherwise allows the stop (hub sessions, non-chip repos, ordinary turns).
#
# Output on block: {"decision":"block","reason":"..."} with exit 0 (per hook spec).
# Loop safety: honors stop_hook_active (Claude Code caps consecutive blocks anyway).

INPUT="$(cat)"

# Avoid re-block loop.
case "$INPUT" in
  *'"stop_hook_active":true'*) exit 0 ;;
esac

CWD="$(printf '%s' "$INPUT" | sed -n 's/.*"cwd":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
CWD="${CWD//\\\\/\/}"
case "$CWD" in
  */.claude/worktrees/*) ;;
  *) exit 0 ;;
esac

TRANSCRIPT="$(printf '%s' "$INPUT" | sed -n 's/.*"transcript_path":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
TRANSCRIPT="${TRANSCRIPT//\\\\/\/}"
[ -f "$TRANSCRIPT" ] || exit 0

TAIL="$(tail -c 30000 "$TRANSCRIPT" 2>/dev/null)"
case "$TAIL" in
  *CLOSED*) ;;
  *) exit 0 ;;
esac

# CLOSED claimed from a chip worktree: require an evidence pack in this worktree.
FOUND="$(find "$CWD/.mnfs" -name EVIDENCE.md -path '*_chip*' 2>/dev/null | head -1)"
if [ -z "$FOUND" ]; then
  printf '%s' '{"decision":"block","reason":"CLOSED claimed but no evidence pack exists in this worktree (.mnfs/**/_chip-*/EVIDENCE.md). Unwritten = did not happen. File the pack (deliverables, gate verdicts with P6-DUAL-GATE: AGREEMENT, live marker or operator waiver) before sending CLOSED."}'
  exit 0
fi

# Pack exists: require the dual-gate marker inside it.
if ! grep -q "P6-DUAL-GATE: AGREEMENT" "$FOUND" 2>/dev/null; then
  printf '%s' '{"decision":"block","reason":"Evidence pack exists but lacks the line P6-DUAL-GATE: AGREEMENT. Run the dual gate (cold reviewer + adversarial refuter, agreement required) and record the marker, then send CLOSED."}'
  exit 0
fi

exit 0
