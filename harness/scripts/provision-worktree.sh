#!/bin/bash
# provision-worktree.sh — hub-side chip worktree provisioner (HARNESS-CORE §9; RETRO A6).
# Guarantees a chip starts on the declared base SHA with a working branch and,
# for FE scope, a usable node_modules (Windows junction to the main checkout).
#
# Usage (run from the repo root, Git Bash):
#   bash provision-worktree.sh <worktree-path> <base-sha-40hex> <branch-name> [--node-modules <main-repo-path>]
#
# Behavior:
#   - Refuses a dirty worktree (never resets/stashes — doctrine).
#   - Forward-only: creates <branch-name> at <base-sha>; if HEAD already there, no-op.
#   - --node-modules: creates a Windows junction worktree/node_modules -> main/node_modules
#     (junction is expected to be gitignored; chip must still grep-check cleanliness pre-commit).
# Exit non-zero on any verification failure — dispatch must not proceed.

set -u

WT="${1:?worktree path required}"
BASE="${2:?base sha (40-hex) required}"
BRANCH="${3:?branch name required}"
NM_MAIN=""
if [ "${4:-}" = "--node-modules" ]; then
  NM_MAIN="${5:?main repo path required after --node-modules}"
fi

if ! printf '%s' "$BASE" | grep -qE '^[0-9a-f]{40}$'; then
  echo "FAIL: base sha must be full 40-hex (got '$BASE')" >&2
  exit 1
fi

if [ ! -d "$WT" ]; then
  echo "FAIL: worktree dir '$WT' does not exist (create via git worktree add first)" >&2
  exit 1
fi

DIRTY="$(git -C "$WT" status --porcelain 2>/dev/null)"
if [ -n "$DIRTY" ]; then
  echo "FAIL: worktree '$WT' is dirty — refusing to touch (doctrine: never reset/stash)." >&2
  printf '%s\n' "$DIRTY" >&2
  exit 1
fi

CUR="$(git -C "$WT" rev-parse HEAD 2>/dev/null)"
CURBR="$(git -C "$WT" rev-parse --abbrev-ref HEAD 2>/dev/null)"

if [ "$CUR" = "$BASE" ] && [ "$CURBR" = "$BRANCH" ]; then
  echo "OK: already on $BRANCH @ $BASE"
else
  if ! git -C "$WT" checkout -b "$BRANCH" "$BASE" 2>&1; then
    echo "FAIL: could not create '$BRANCH' at $BASE in '$WT'" >&2
    exit 1
  fi
fi

VERIFY="$(git -C "$WT" rev-parse HEAD)"
VERIFYBR="$(git -C "$WT" rev-parse --abbrev-ref HEAD)"
if [ "$VERIFY" != "$BASE" ] || [ "$VERIFYBR" != "$BRANCH" ]; then
  echo "FAIL: post-provision verification mismatch (HEAD=$VERIFY branch=$VERIFYBR; wanted $BASE / $BRANCH)" >&2
  exit 1
fi

if [ -n "$NM_MAIN" ]; then
  if [ ! -d "$NM_MAIN/node_modules" ]; then
    echo "FAIL: '$NM_MAIN/node_modules' not found — cannot junction" >&2
    exit 1
  fi
  if [ -e "$WT/node_modules" ]; then
    echo "OK: node_modules already present in worktree (skipping junction)"
  else
    WT_WIN="$(cd "$WT" && pwd -W 2>/dev/null | sed 's|/|\\\\|g')"
    NM_WIN="$(cd "$NM_MAIN/node_modules" && pwd -W 2>/dev/null | sed 's|/|\\\\|g')"
    if cmd //c "mklink /J \"$WT_WIN\\node_modules\" \"$NM_WIN\"" >/dev/null 2>&1; then
      echo "OK: junction created $WT/node_modules -> $NM_MAIN/node_modules"
    else
      echo "FAIL: mklink /J junction failed (run in Git Bash on Windows; check paths)" >&2
      exit 1
    fi
  fi
fi

echo "PROVISIONED: $WT on $BRANCH @ $BASE"
