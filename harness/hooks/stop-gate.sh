#!/bin/bash
# stop-gate.sh — Stop hook.
# Blocks a CHIP session from ending its turn after claiming CLOSED without an
# evidence pack on disk. Deterministic completion gate (HARNESS-CORE §9).
#
# Scope guard: only acts when
#   (a) cwd is a chip worktree (path matches HARNESS_WORKTREE_RE), AND
#   (b) the recent transcript tail contains a CLOSED chip-event claim.
# Otherwise allows the stop (hub sessions, non-chip repos, ordinary turns).
#
# Repo/tooling bindings come from $CLAUDE_PROJECT_DIR/.harness/config.sh; unset
# keys fall to generic defaults. Core carries NO repo names.
#
# Output on block: {"decision":"block","reason":"..."} with exit 0 (per hook spec).
# Loop safety: honors stop_hook_active (Claude Code caps consecutive blocks anyway).

INPUT="$(cat)"

# Avoid re-block loop.
case "$INPUT" in
  *'"stop_hook_active":true'*) exit 0 ;;
esac

# --- repo/tooling bindings --------------------------------------------------
CFG="${CLAUDE_PROJECT_DIR:-.}/.harness/config.sh"
[ -f "$CFG" ] && . "$CFG"
: "${HARNESS_ARTIFACT_DIR:=.mnfs}"
: "${HARNESS_EVIDENCE_GLOB:=EVIDENCE.md}"
: "${HARNESS_CHIP_DIR_GLOB:=*_chip*}"
: "${HARNESS_WORKTREE_RE:=/\.claude/worktrees/}"

# --- robust JSON field reads (jq if present; else sed) ----------------------
# G6: prefer jq; sed fallback normalizes BOTH single and doubled backslashes and
# both slash directions, so Windows worktree paths are matched correctly.
json_field() { # $1 = key
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$1" '.[$k] // empty' 2>/dev/null
  else
    printf '%s' "$INPUT" | sed -n 's/.*"'"$1"'":[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
  fi
}
norm_path() { printf '%s' "$1" | sed 's/\\\\/\//g; s/\\/\//g'; }

CWD="$(norm_path "$(json_field cwd)")"
case "$CWD" in
  $HARNESS_WORKTREE_RE*|*$HARNESS_WORKTREE_RE*) ;;
  *)
    # HARNESS_WORKTREE_RE may be a regex, not a glob; confirm with grep before allowing.
    printf '%s' "$CWD" | grep -qE "$HARNESS_WORKTREE_RE" || exit 0 ;;
esac

TRANSCRIPT="$(norm_path "$(json_field transcript_path)")"
[ -f "$TRANSCRIPT" ] || exit 0

# G5: require a CLOSED that looks like a chip event, not any stray "CLOSED" word.
TAIL="$(tail -c 30000 "$TRANSCRIPT" 2>/dev/null)"
printf '%s' "$TAIL" | grep -qE 'CLOSED[^A-Za-z]|CHIP[^\n]*CLOSED|"?event"?[[:space:]:]*"?CLOSED' || {
  case "$TAIL" in *CLOSED*) ;; *) exit 0 ;; esac
}

# CLOSED claimed from a chip worktree: require an evidence pack in this worktree.
# G4: select the NEWEST chip EVIDENCE.md PORTABLY (GNU find -printf is not on
# BSD/macOS; that silently fell back to traversal-first head-1 = the pre-marker
# pack). Emit "mtime<TAB>path" via stat, detecting GNU vs BSD stat.
list_by_mtime() {
  local files; files="$(find "$CWD/$HARNESS_ARTIFACT_DIR" -name "$HARNESS_EVIDENCE_GLOB" -path "*${HARNESS_CHIP_DIR_GLOB#\*}" 2>/dev/null)"
  [ -z "$files" ] && return 0
  if stat -c '%Y' . >/dev/null 2>&1; then      # GNU stat
    printf '%s\n' "$files" | while IFS= read -r p; do [ -n "$p" ] && printf '%s\t%s\n' "$(stat -c '%Y' "$p")" "$p"; done
  else                                          # BSD/macOS stat
    printf '%s\n' "$files" | while IFS= read -r p; do [ -n "$p" ] && printf '%s\t%s\n' "$(stat -f '%m' "$p")" "$p"; done
  fi
}
FOUND="$(list_by_mtime | sort -rn | head -1 | cut -f2-)"

if [ -z "$FOUND" ]; then
  printf '%s' '{"decision":"block","reason":"CLOSED claimed but no evidence pack exists in this worktree (chip EVIDENCE.md). Unwritten = did not happen. File the pack (deliverables, gate verdicts with P6-DUAL-GATE: AGREEMENT, live marker or operator waiver) before sending CLOSED."}'
  exit 0
fi

# Pack exists: require the dual-gate marker inside it.
if ! grep -q "P6-DUAL-GATE: AGREEMENT" "$FOUND" 2>/dev/null; then
  printf '%s' '{"decision":"block","reason":"Evidence pack exists but lacks the line P6-DUAL-GATE: AGREEMENT. Run the dual gate (cold reviewer + adversarial refuter, agreement required) and record the marker, then send CLOSED."}'
  exit 0
fi

exit 0
