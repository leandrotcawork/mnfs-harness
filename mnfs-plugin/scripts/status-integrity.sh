#!/usr/bin/env bash
# MNFS status-integrity verifier.
#
# Enforces the gate-integrity invariant (design:
#   docs/superpowers/specs/2026-06-21-gate-integrity-and-golden-fixture-design.md):
#
#   A milestone may hold `status: passed` only if its milestone directory holds a
#   validation-result.md whose `Verdict: Pass`, folded from an on-disk
#   milestone-review.md, with must_meet_pass 7/7 and no `★` recorded Fail.
#
# This makes a skipped or faked gate a non-zero exit code instead of a silent
# omission. Read-only: it never edits artifacts. Twin of sync-shared-references.sh.
#
# Usage: bash status-integrity.sh <mission-root-or-any-ancestor>
# Scans every milestone.md found under the given path.
#
# Slices implemented here:
#   1 — gate-integrity invariant (status: passed ⇒ backing validation-result.md).
#   2 — dangling-milestone (all features finished but the gate never produced a result).
#   3A — evidence re-derivation: a feature `ran` claim must point at an out-of-prose
#        capture artifact that exists on disk (cited file present + non-empty; or, if a
#        feature claims `ran` with no filed capture at all, ran-without-artifact).
#   --manifest — sha256 evidence manifest (tamper-evidence down-payment).
#   5 — passed-without-live-ui (a user-facing milestone — contract has a `Drive (UI)` block —
#        is passed without _gate-evidence/round-*/ui/flows.json all-validated).
# NOT yet done: semantic re-derivation (re-run the capture / assert its content equals
# the claim) and a stored append-only tamper-compare loop — both later slices.
set -u

# Mode: default `check` runs the integrity gate; `--manifest` emits a sha256
# evidence manifest (tamper-evidence down-payment — operator pipes to a file and
# diffs across runs; a changed hash with no logged correction is post-hoc edit).
MODE=check
if [ "${1:-}" = "--manifest" ]; then MODE=manifest; shift; fi

MISSION_ROOT="${1:-.}"
violations=0
checked=0

# Extract the value after the first ':' on the first line matching a key regex.
# Strips surrounding whitespace and backticks.
field() { # $1=file  $2=key-regex
  grep -m1 -iE "$2" "$1" 2>/dev/null \
    | sed -E 's/^[^:]*:[[:space:]]*//; s/`//g; s/[[:space:]]+$//'
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# --manifest: print `sha256  relpath` for every evidence-bearing file. No stored
# state, so it never false-positives; the operator owns the diff. This is the
# tamper-evidence down-payment (R1); the stored append-only compare is a later slice.
if [ "$MODE" = manifest ]; then
  echo "# MNFS evidence manifest (sha256) — root: $MISSION_ROOT"
  have_sha=1; command -v sha256sum >/dev/null 2>&1 || have_sha=0
  find "$MISSION_ROOT" -type f \
       \( -name 'validation-result.md' -o -name 'milestone-review.md' \
          -o -name 'validation.md' -o -name '*.txt' -o -name '*.log' -o -name '*.out' \) \
       2>/dev/null | sort | while IFS= read -r f; do
    [ -n "$f" ] || continue
    if [ "$have_sha" = 1 ]; then h=$(sha256sum "$f" | cut -d' ' -f1); else h="NO-SHA256SUM"; fi
    rel=${f#"$MISSION_ROOT"/}
    printf '%s  %s\n' "$h" "$rel"
  done
  exit 0
fi

while IFS= read -r mfile; do
  [ -n "$mfile" ] || continue
  mdir=$(dirname "$mfile")
  mid=$(basename "$mdir")
  checked=$((checked + 1))

  status=$(lower "$(field "$mfile" '^[[:space:]]*status:')")
  if [ "$status" != "passed" ]; then
    case "$status" in
      skipped|blocked)
        echo "OK: $mid (status: $status; terminal non-pass, no proof required)"; continue ;;
    esac
    # Dangling check: every feature finished but the milestone gate never produced a
    # result. This is the real M-01 failure shape — work accepted, gate skipped, the
    # milestone left without a terminal claim. Authoritative feature status lives in
    # the feature handoff (validation.md / feature.md).
    nfeat=0; nfinished=0
    while IFS= read -r fdir; do
      [ -n "$fdir" ] || continue
      nfeat=$((nfeat + 1))
      # Finished signal: the machine token `quick_validation_passed` (written bare as a
      # verdict line or `status:`-prefixed) or an `accepted` status field. `accepted`
      # stays field-anchored — it is common prose; the verdict token is not.
      if grep -qiE 'quick_validation_passed|(^|[[:space:]])status:[[:space:]]*accepted|current status:[[:space:]]*accepted' \
           "$fdir/validation.md" "$fdir/feature.md" 2>/dev/null; then
        nfinished=$((nfinished + 1))
      fi
    done < <(find "$mdir" -maxdepth 1 -type d -name 'F-*' | sort)

    if [ "$nfeat" -gt 0 ] && [ "$nfinished" -eq "$nfeat" ] && [ ! -f "$mdir/validation-result.md" ]; then
      echo "VIOLATION: $mid all $nfeat feature(s) finished but no validation-result.md — gate never ran (dangling-milestone)"
      violations=$((violations + 1)); continue
    fi
    echo "OK: $mid (status: ${status:-none}; $nfinished/$nfeat feature(s) finished, no terminal claim required)"
    continue
  fi

  result="$mdir/validation-result.md"
  if [ ! -f "$result" ]; then
    echo "VIOLATION: $mid status=passed but no validation-result.md (passed-no-result)"
    violations=$((violations + 1)); continue
  fi

  verdict=$(lower "$(field "$result" '^[[:space:]]*-?[[:space:]]*Verdict:')")
  if [ "$verdict" != "pass" ]; then
    echo "VIOLATION: $mid status=passed but validation-result Verdict='${verdict:-none}' (verdict-not-pass)"
    violations=$((violations + 1)); continue
  fi

  review=$(field "$result" '^[[:space:]]*-?[[:space:]]*Review artifact:')
  if [ -z "$review" ]; then
    echo "VIOLATION: $mid Verdict=Pass but no Review artifact referenced (verdict-folds-from-nothing)"
    violations=$((violations + 1)); continue
  fi
  if [ ! -f "$mdir/$review" ]; then
    echo "VIOLATION: $mid Verdict=Pass but referenced review '$review' missing on disk (verdict-folds-from-nothing)"
    violations=$((violations + 1)); continue
  fi

  mmp_num=$(field "$result" 'must_meet_pass' | grep -oE '[0-9]+' | head -1)
  if [ -n "$mmp_num" ] && [ "$mmp_num" -ne 7 ]; then
    echo "VIOLATION: $mid Verdict=Pass but must_meet_pass=$mmp_num/7 (verdict-contradicts-fold)"
    violations=$((violations + 1)); continue
  fi

  if grep -qE '^[[:space:]]*-?[[:space:]]*★[0-9].*:[[:space:]]*[Ff]ail([[:space:]]|$)' "$result"; then
    echo "VIOLATION: $mid Verdict=Pass but a ★ recorded Fail (never-downgrade-breach)"
    violations=$((violations + 1)); continue
  fi

  # Slice 5 — live-UI backstop. A user-facing milestone (its validation-contract declares a
  # `Drive (UI ...)` block) may hold `status: passed` only if a gate live-drive produced
  # _gate-evidence/round-*/ui/flows.json with every flow outcome `validated` (no
  # could-not-drive, no defect). This turns a silent UI pass — a passed milestone whose UI was
  # never driven live, or driven with a could-not-drive/defect outcome — into a deterministic
  # violation, not merely an LLM-rubric judgement.
  contract="$mdir/validation-contract.md"
  if [ -f "$contract" ] && grep -qiE '^[[:space:]]*Drive[[:space:]]*\(UI' "$contract"; then
    has_flows=$(find "$mdir/_gate-evidence" -type f -path '*/ui/flows.json' 2>/dev/null | head -1)
    if [ -z "$has_flows" ]; then
      echo "VIOLATION: $mid status=passed and validation-contract declares a UI Drive block but no _gate-evidence/round-*/ui/flows.json exists — UI never driven live (passed-without-live-ui)"
      violations=$((violations + 1)); continue
    fi
    if find "$mdir/_gate-evidence" -type f -path '*/ui/flows.json' \
         -exec grep -liE '"outcome"[[:space:]]*:[[:space:]]*"(could-not-drive|defect)"' {} + 2>/dev/null | grep -q .; then
      echo "VIOLATION: $mid status=passed but a UI flow outcome is could-not-drive/defect in flows.json — fail-closed breach (passed-without-live-ui)"
      violations=$((violations + 1)); continue
    fi
  fi

  echo "OK: $mid (status=passed; backed by validation-result Verdict=Pass, review on disk, 7/7, no failing ★)"
done < <(find "$MISSION_ROOT" -type f -name 'milestone.md' 2>/dev/null | sort)

# Slice 3A — evidence re-derivation. A `ran` claim is only as good as the artifact
# behind it; prose the worker authored is not the proof. Two checks per feature:
#   Rule 1: every capture file named in validation.md (.txt/.log/.out) must exist on
#           disk and be non-empty (a cited-but-missing artifact is a fabricated cite).
#   Rule 2: a validation.md that claims `ran` but whose feature dir holds no filed
#           capture artifact at all has its proof only in worker prose (ran-without-artifact).
# This binds the [ran] CLAIM to an out-of-prose PROOF. It does NOT yet re-execute the
# capture or assert its content equals the claim — semantic re-derivation is a later slice.
while IFS= read -r vfile; do
  [ -n "$vfile" ] || continue
  fdir=$(dirname "$vfile")
  fid=$(basename "$fdir")

  # Rule 1: cited capture files must resolve on disk, non-empty.
  while IFS= read -r art; do
    [ -n "$art" ] || continue
    match=$(find "$MISSION_ROOT" -type f -name "$art" 2>/dev/null | head -1)
    if [ -z "$match" ]; then
      echo "VIOLATION: $fid validation.md cites capture '$art' but it is missing on disk (ran-cites-missing-artifact)"
      violations=$((violations + 1))
    elif [ ! -s "$match" ]; then
      echo "VIOLATION: $fid validation.md cites capture '$art' but it is empty (ran-cites-empty-artifact)"
      violations=$((violations + 1))
    fi
  done < <(grep -oiE '[A-Za-z0-9._-]+\.(txt|log|out)' "$vfile" | sort -u)

  # Rule 2: claims `ran` evidence but no filed capture artifact exists in the feature dir.
  if grep -qiE '(\[ran\]|evidence:[[:space:]]*ran|[[:space:]]ran[[:space:]).])' "$vfile"; then
    if ! find "$fdir" -maxdepth 1 -type f \( -name '*.txt' -o -name '*.log' -o -name '*.out' \) 2>/dev/null | grep -q .; then
      echo "VIOLATION: $fid claims ran-evidence but its dir holds no filed capture (.txt/.log/.out); proof lives only in prose (ran-without-artifact)"
      violations=$((violations + 1))
    fi
  fi
done < <(find "$MISSION_ROOT" -type f -path '*/F-*/validation.md' 2>/dev/null | sort)

echo "---"
if [ "$violations" -eq 0 ]; then
  echo "STATUS-INTEGRITY OK ($checked milestone(s) checked)"
  exit 0
fi
echo "STATUS-INTEGRITY FAILED ($violations violation(s), $checked milestone(s) checked)"
exit 1
