#!/bin/bash
# dispatch-lint.sh — PreToolUse hook (matcher: mcp__ccd_session__spawn_task).
# Deterministically rejects a CHIP dispatch whose prompt lacks the mandatory
# context-pack markers (HARNESS-CORE §9; RETRO-MIS-004 A2/A4/A6).
#
# Applies only to chip dispatches (prompt contains 'CHIP-'). Other spawn_task
# uses (defect flags, ad-hoc tasks) pass untouched.
#
# Required markers in every chip prompt:
#   BASE-SHA:    full base commit the worktree must sit on (SHA-1 40 or SHA-256 64 hex)
#   CONTRATO:    path/ref of the validation contract the chip asserts against
#   EXEMPLO-IO:  at least one concrete input->output case with real data
#   HUB-SESSION: the hub's session id (pattern per tooling binding)
# Conditionally required:
#   DESIGN-REF:  exact reference artifact path — required when the prompt
#                touches an FE surface (per HARNESS_FE_SCOPE_RE, repo binding).
#
# Repo/tooling bindings come from $CLAUDE_PROJECT_DIR/.harness/config.sh; unset
# keys fall to generic defaults. Core carries NO repo names.
#
# Exit 2 blocks the dispatch with the list of missing markers.

INPUT="$(cat)"

case "$INPUT" in
  *CHIP-*) ;;
  *) exit 0 ;;
esac

# --- repo/tooling bindings --------------------------------------------------
CFG="${CLAUDE_PROJECT_DIR:-.}/.harness/config.sh"
[ -f "$CFG" ] && . "$CFG"
: "${HARNESS_FE_SCOPE_RE:=apps/web}"                 # L1: was hardcoded here
# NB: brace-quantifier defaults can't go in ${VAR:=…} — bash stops at the first
# '}' inside {8,}/{40} and truncates the regex. Assign guarded instead.
[ -n "${HARNESS_SESSION_ID_RE:-}" ] || HARNESS_SESSION_ID_RE='local_[0-9a-f-]{8,}'   # L6: tooling id shape
[ -n "${HARNESS_SHA_RE:-}" ]        || HARNESS_SHA_RE='[0-9a-f]{40}|[0-9a-f]{64}'    # G8: SHA-1 or SHA-256

MISSING=""
# BASE-SHA must carry a REAL hex value (placeholder 'TBD' = drift waiting to happen).
printf '%s' "$INPUT" | grep -qE "BASE-SHA:[[:space:]]*\\\\?\"?($HARNESS_SHA_RE)" || MISSING="$MISSING BASE-SHA:(40/64-hex-value)"
printf '%s' "$INPUT" | grep -q "CONTRATO:"   || MISSING="$MISSING CONTRATO:"
printf '%s' "$INPUT" | grep -q "EXEMPLO-IO:" || MISSING="$MISSING EXEMPLO-IO:"
# HUB-SESSION must carry the hub's real session id — stale/absent hub address made
# chip events land at a stood-down session (field evidence 2026-07-19).
printf '%s' "$INPUT" | grep -qE "HUB-SESSION:[[:space:]]*\\\\?\"?($HARNESS_SESSION_ID_RE)" || MISSING="$MISSING HUB-SESSION:(session-id)"

# FE-scope DESIGN-REF requirement — driven by the repo's FE-surface binding, not
# a baked path. Match the prompt against HARNESS_FE_SCOPE_RE (regex).
if printf '%s' "$INPUT" | grep -qE "$HARNESS_FE_SCOPE_RE"; then
  printf '%s' "$INPUT" | grep -q "DESIGN-REF:" || MISSING="$MISSING DESIGN-REF:"
fi

if [ -n "$MISSING" ]; then
  cat >&2 <<EOF
CHIP DISPATCH BLOCKED (harness dispatch-lint): prompt is missing mandatory context-pack markers:
 $MISSING
Every chip prompt must carry:
  BASE-SHA: <40/64-hex base commit>         (kills worktree base drift — executor pain #1, RETRO H7)
  CONTRATO: <validation contract path/ref>  (chip asserts against contract, not vibes)
  EXEMPLO-IO: <one concrete real-data case> (chip writes a golden test on day 1 — RETRO H1/H3)
  HUB-SESSION: <hub session id>             (stale hub address = lost chip events, field 2026-07-19)
  DESIGN-REF: <exact reference artifact>    (FE scope only — RETRO H2, D-56/58 reshape)
Add the markers with real values and re-dispatch.
EOF
  exit 2
fi

exit 0
