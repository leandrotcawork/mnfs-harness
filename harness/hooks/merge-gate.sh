#!/bin/bash
# merge-gate.sh — PreToolUse hook (matcher: Bash).
# Deterministically blocks `git merge` of a chip branch unless an evidence pack
# for that branch exists and carries the required gate markers.
#
# Doctrine (HARNESS-CORE §9): a chip merge requires an EVIDENCE.md that
#   (a) references the branch being merged,
#   (b) contains `P6-DUAL-GATE: AGREEMENT`,
#   (c) for provider-touching scope, contains `LIVE-VERIFIED:` or an explicit
#       `LIVE-WAIVED-BY-OPERATOR:` line (waiver must be operator-authorized and
#       logged in the hub ledger).
#
# Exit 0 = allow (not a chip merge, or all markers present).
# Exit 2 = hard block (stderr shown to the model as corrective feedback).
#
# No jq dependency: markers are grepped from raw stdin JSON. Fail-open only when
# the call is positively NOT a chip merge.

INPUT="$(cat)"

# Fast path: only gate calls that look like a chip-branch merge.
case "$INPUT" in
  *"git merge"*chip/*) ;;
  *) exit 0 ;;
esac

BRANCH="$(printf '%s' "$INPUT" | grep -oE 'chip/[A-Za-z0-9._-]+' | head -1)"
[ -z "$BRANCH" ] && exit 0

# Locate evidence packs that reference this branch.
MATCHES="$(grep -rl -- "$BRANCH" .mnfs --include=EVIDENCE.md 2>/dev/null)"

if [ -z "$MATCHES" ]; then
  cat >&2 <<EOF
MERGE BLOCKED (harness merge-gate): no EVIDENCE.md under .mnfs references branch '$BRANCH'.
Required before merging a chip branch:
  1. Chip files its evidence pack (.mnfs/<mission>/<milestone>/_chip-*/EVIDENCE.md) referencing '$BRANCH'.
  2. Pack contains 'P6-DUAL-GATE: AGREEMENT'.
  3. Provider-touching scope: pack contains 'LIVE-VERIFIED: <what was driven live>'
     or 'LIVE-WAIVED-BY-OPERATOR: <reason + ledger row>'.
This block is deterministic. Do not work around it; satisfy the evidence requirement or obtain an operator waiver.
EOF
  exit 2
fi

OK_P6=""
OK_LIVE=""
for f in $MATCHES; do
  if grep -q "P6-DUAL-GATE: AGREEMENT" "$f" 2>/dev/null; then OK_P6="$f"; fi
  if grep -qE "LIVE-VERIFIED:|LIVE-WAIVED-BY-OPERATOR:" "$f" 2>/dev/null; then OK_LIVE="$f"; fi
done

if [ -z "$OK_P6" ]; then
  cat >&2 <<EOF
MERGE BLOCKED (harness merge-gate): evidence pack(s) for '$BRANCH' found, but none contains the line
  P6-DUAL-GATE: AGREEMENT
Run the dual gate (cold reviewer + adversarial refuter, agreement required) and record the marker in the pack.
Packs checked:
$MATCHES
EOF
  exit 2
fi

if [ -z "$OK_LIVE" ]; then
  cat >&2 <<EOF
MERGE BLOCKED (harness merge-gate): evidence pack for '$BRANCH' lacks a live-verification marker.
Add ONE of:
  LIVE-VERIFIED: <path/flow driven against real data, with result>
  LIVE-WAIVED-BY-OPERATOR: <operator authorization + hub-ledger row id>
Rationale (RETRO-MIS-004): mock-only closes produced the two most expensive rework sagas of MIS-004.
Packs checked:
$MATCHES
EOF
  exit 2
fi

exit 0
