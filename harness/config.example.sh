# .harness/config.sh — repo bindings for the harness enforcement hooks.
#
# WHERE: copy to the PRODUCT repo at `.harness/config.sh` (versioned). The hooks
# source it from $CLAUDE_PROJECT_DIR/.harness/config.sh. It is the MACHINE MIRROR
# of docs/HARNESS-PROFILE.md §5 (collision axes / FE surface) + §11 (enforcement).
#
# WHY: core hooks are METHOD (generic — no repo names). Every repo-specific
# binding a hook needs lives HERE, not in the shipped hook. Unset keys fall to
# generic defaults that match the reference repo shape, so a repo that matches
# the defaults may ship an empty file (or none at all).
#
# Set ONLY the keys that differ from the defaults shown.

# --- artifact layout (merge-gate, stop-gate) --------------------------------
# HARNESS_ARTIFACT_DIR=.mnfs           # evidence root scanned for packs
# HARNESS_EVIDENCE_GLOB=EVIDENCE.md    # evidence-pack filename glob
# HARNESS_CHIP_DIR_GLOB='*_chip*'      # chip evidence subdir marker

# --- branch / session conventions -------------------------------------------
# HARNESS_CHIP_BRANCH_RE='chip[/-][A-Za-z0-9._-]+'   # matches chip/… and chip-…
# HARNESS_SESSION_ID_RE='local_[0-9a-f-]{8,}'        # host session-id shape
# HARNESS_WORKTREE_RE='/\.claude/worktrees/'         # chip worktree path marker
# HARNESS_SHA_RE='[0-9a-f]{40}|[0-9a-f]{64}'         # SHA-1 or SHA-256 commit ids

# --- FE surface (dispatch-lint DESIGN-REF trigger) — profile §5 -------------
# Regex over the dispatch prompt; if it matches, DESIGN-REF becomes mandatory.
HARNESS_FE_SCOPE_RE='apps/web|packages/ui'

# --- provider-touching scope (merge-gate LIVE-VERIFIED trigger) — profile §5/§7
# Regex over the chip diff paths (git diff --name-only HEAD...<branch>). If any
# changed path matches, the merge requires LIVE-VERIFIED / LIVE-WAIVED in the
# SAME pack. Empty ⇒ LIVE required only when a pack self-declares
# `SCOPE-PROVIDER-TOUCHING: yes`.
HARNESS_PROVIDER_SCOPE_RE='internal/modules/.*/adapters/|/providers/'
