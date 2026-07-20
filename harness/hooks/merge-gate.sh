#!/bin/bash
# merge-gate.sh — PreToolUse hook (matcher: Bash).
# Deterministically blocks `git merge` of a chip branch unless an evidence pack
# for that branch exists and carries the required gate markers.
#
# Doctrine (HARNESS-CORE §9): a chip merge requires an EVIDENCE.md that
#   (a) references the branch being merged,
#   (b) contains `P6-DUAL-GATE: AGREEMENT`,
#   (c) for PROVIDER-TOUCHING scope only, contains `LIVE-VERIFIED:` or an
#       explicit `LIVE-WAIVED-BY-OPERATOR:` line (waiver must be operator-
#       authorized and logged in the hub ledger).
# (a)+(b)+(c) must all hold in the SAME pack (no split-evidence).
#
# Repo bindings come from $CLAUDE_PROJECT_DIR/.harness/config.sh (versioned by
# the product repo, mirrors profile §5/§11); unset keys fall to generic defaults
# that match the reference repo shape. Core carries NO repo names (core header).
#
# Exit 0 = allow (not a chip merge, or all markers present).
# Exit 2 = hard block (stderr shown to the model as corrective feedback).
#
# No jq dependency: markers are grepped from raw stdin JSON. Fail-open only when
# the call is positively NOT a chip merge.

INPUT="$(cat)"

# Hooks run in the SESSION cwd, not the project root (docs: hooks.md). Anchor to
# the project so the artifact scan is deterministic regardless of prior `cd`.
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && cd "$CLAUDE_PROJECT_DIR" 2>/dev/null

# --- repo bindings (config wins; else generic defaults) ---------------------
CFG="${CLAUDE_PROJECT_DIR:-.}/.harness/config.sh"
[ -f "$CFG" ] && . "$CFG"
: "${HARNESS_ARTIFACT_DIR:=.mnfs}"
: "${HARNESS_EVIDENCE_GLOB:=EVIDENCE.md}"
: "${HARNESS_CHIP_BRANCH_RE:=chip[/-][A-Za-z0-9._-]+}"
: "${HARNESS_PROVIDER_SCOPE_RE:=}"   # empty ⇒ LIVE gated only by explicit pack signal

# Fast path: only gate calls that look like a git merge of a chip-shaped branch.
case "$INPUT" in
  *"git merge"*) ;;
  *) exit 0 ;;
esac
# Extract the chip branch (handles chip/… AND chip-… — G1). No match ⇒ not a
# chip merge ⇒ allow. A real chip branch always matches; there is no silent
# fail-open on a chip-shaped branch we merely fail to resolve.
BRANCH="$(printf '%s' "$INPUT" | grep -oE "$HARNESS_CHIP_BRANCH_RE" | head -1)"
[ -z "$BRANCH" ] && exit 0

# Locate evidence packs that reference this branch.
MATCHES="$(grep -rl -- "$BRANCH" "$HARNESS_ARTIFACT_DIR" --include="$HARNESS_EVIDENCE_GLOB" 2>/dev/null)"

if [ -z "$MATCHES" ]; then
  cat >&2 <<EOF
MERGE BLOCKED (harness merge-gate): no ${HARNESS_EVIDENCE_GLOB} under ${HARNESS_ARTIFACT_DIR} references branch '$BRANCH'.
Required before merging a chip branch:
  1. Chip files its evidence pack referencing '$BRANCH'.
  2. Pack contains 'P6-DUAL-GATE: AGREEMENT'.
  3. Provider-touching scope: same pack contains 'LIVE-VERIFIED: <what was driven live>'
     or 'LIVE-WAIVED-BY-OPERATOR: <reason + ledger row>'.
This block is deterministic. Satisfy the evidence requirement or obtain an operator waiver.
EOF
  exit 2
fi

# --- is this merge provider-touching? (G2 — LIVE required only if so) --------
LIVE_REQUIRED="no"
if [ -n "$HARNESS_PROVIDER_SCOPE_RE" ]; then
  CHANGED="$(git diff --name-only "HEAD...$BRANCH" 2>/dev/null)"
  printf '%s\n' "$CHANGED" | grep -qE "$HARNESS_PROVIDER_SCOPE_RE" && LIVE_REQUIRED="yes"
fi
# An explicit pack self-declaration also forces the live requirement.
for f in $MATCHES; do
  grep -qE "SCOPE-PROVIDER-TOUCHING:[[:space:]]*yes" "$f" 2>/dev/null && LIVE_REQUIRED="yes"
done

# --- same-pack marker check (G3) --------------------------------------------
PASS=""; SAW_P6=""
for f in $MATCHES; do
  grep -q "P6-DUAL-GATE: AGREEMENT" "$f" 2>/dev/null || continue
  SAW_P6="$f"
  if [ "$LIVE_REQUIRED" = "yes" ]; then
    grep -qE "LIVE-VERIFIED:|LIVE-WAIVED-BY-OPERATOR:" "$f" 2>/dev/null || continue
  fi
  PASS="$f"; break
done

[ -n "$PASS" ] && exit 0

if [ -z "$SAW_P6" ]; then
  cat >&2 <<EOF
MERGE BLOCKED (harness merge-gate): evidence pack(s) for '$BRANCH' found, but none contains the line
  P6-DUAL-GATE: AGREEMENT
Run the dual gate (cold reviewer + adversarial refuter, agreement required) and record the marker in the pack.
Packs checked:
$MATCHES
EOF
  exit 2
fi

cat >&2 <<EOF
MERGE BLOCKED (harness merge-gate): '$BRANCH' is provider-touching but its P6 pack lacks a live marker
in the SAME pack. Add ONE of the following to the pack that carries P6-DUAL-GATE: AGREEMENT:
  LIVE-VERIFIED: <path/flow driven against real data, with result>
  LIVE-WAIVED-BY-OPERATOR: <operator authorization + hub-ledger row id>
Rationale (RETRO-MIS-004): mock-only closes produced the two most expensive rework sagas of MIS-004.
Pack with P6: $SAW_P6
EOF
exit 2
