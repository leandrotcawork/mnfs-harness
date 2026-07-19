#!/bin/bash
# dispatch-lint.sh — PreToolUse hook (matcher: mcp__ccd_session__spawn_task).
# Deterministically rejects a CHIP dispatch whose prompt lacks the mandatory
# context-pack markers (HARNESS-CORE §9; RETRO-MIS-004 A2/A4/A6).
#
# Applies only to chip dispatches (prompt contains 'CHIP-'). Other spawn_task
# uses (defect flags, ad-hoc tasks) pass untouched.
#
# Required markers in every chip prompt:
#   BASE-SHA:    full 40-hex base commit the worktree must sit on
#   CONTRATO:    path/ref of the validation contract the chip asserts against
#   EXEMPLO-IO:  at least one concrete input->output case with real data
# Conditionally required:
#   DESIGN-REF:  exact reference artifact path — required when the prompt
#                touches FE surfaces (apps/web).
#
# Exit 2 blocks the dispatch with the list of missing markers.

INPUT="$(cat)"

case "$INPUT" in
  *CHIP-*) ;;
  *) exit 0 ;;
esac

MISSING=""
printf '%s' "$INPUT" | grep -q "BASE-SHA:"   || MISSING="$MISSING BASE-SHA:"
printf '%s' "$INPUT" | grep -q "CONTRATO:"   || MISSING="$MISSING CONTRATO:"
printf '%s' "$INPUT" | grep -q "EXEMPLO-IO:" || MISSING="$MISSING EXEMPLO-IO:"

case "$INPUT" in
  *apps/web*|*apps\\\\web*)
    printf '%s' "$INPUT" | grep -q "DESIGN-REF:" || MISSING="$MISSING DESIGN-REF:"
    ;;
esac

if [ -n "$MISSING" ]; then
  cat >&2 <<EOF
CHIP DISPATCH BLOCKED (harness dispatch-lint): prompt is missing mandatory context-pack markers:
 $MISSING
Every chip prompt must carry:
  BASE-SHA: <40-hex base commit>            (kills worktree base drift — executor pain #1, RETRO H7)
  CONTRATO: <validation contract path/ref>  (chip asserts against contract, not vibes)
  EXEMPLO-IO: <one concrete real-data case> (chip writes a golden test on day 1 — RETRO H1/H3)
  DESIGN-REF: <exact reference artifact>    (FE scope only — RETRO H2, D-56/58 reshape)
Add the markers with real values and re-dispatch.
EOF
  exit 2
fi

exit 0
