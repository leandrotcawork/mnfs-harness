# Harness Findings — MIS-004 field pass: repo-agnostic enforcement

**Author:** Hub v2 (MIS-004), 2026-07-19
**Classification (core §0):** mostly **method-level** → core/plugin change (upstream). A few are
tooling-level constants. None are repo-level (that's the point — repo-level things are the ones
that leaked *into* core and must come back out).
**Trigger:** operator directive — "harness is supposed to fit any repo; if there needs to be
[something] specific we need to make a flow for that." The enforcement hooks currently hardcode
this repo's names, which **violates the core's own header**: *"METHOD (generic — no product,
repo, or mission names belong in this file)."*

The three hooks (`merge-gate.sh`, `stop-gate.sh`, `dispatch-lint.sh`) are the enforcement layer
of core §9. They are shipped generic, but they bake in `apps/web`, `.mnfs`, `EVIDENCE.md`,
`chip/`, `local_`, `.claude/worktrees/` — all repo/tooling bindings that doctrine says belong in
the **profile**, not core. Result: the hooks only work for a repo shaped exactly like
marketplace-central. Two more classes of defect (portability + soundness) bite *any* repo.

---

## Part A — Repo-specific leaks (repo names baked into generic core)

Doctrine violation: core is METHOD; these bindings belong in `docs/HARNESS-PROFILE.md` (§5 FE
surface, §5 artifacts) or a machine-readable sidecar the hooks source. Each must move out.

| # | File:line | Hardcoded | Should come from | Blast radius |
|---|---|---|---|---|
| L1 | `dispatch-lint.sh:39` | `*apps/web*` (FE-scope → DESIGN-REF trigger) | profile §5 FE-surface glob | **Any repo whose FE isn't `apps/web` gets DESIGN-REF gating wrong** — never fires, or fires never. The flagrant one. |
| L2 | `merge-gate.sh:38`, `stop-gate.sh:44-45` | `.mnfs` artifact dir | profile artifact root | Any repo using a different evidence root → gate finds nothing → merge-gate blocks everything / stop-gate no-ops. |
| L3 | `merge-gate.sh:38` (`--include=EVIDENCE.md`), `stop-gate.sh:44-45` | `EVIDENCE.md` filename | profile evidence glob | M-09 wrote markers in `validation-result.md` (0.3.x convention) → 0.4.0 gate ignored it (ledger D-109/@d55405a8 workaround). Convention drift = silent miss. |
| L4 | `merge-gate.sh:27,31` | `chip/` branch prefix | profile chip-branch pattern | See G1 — dash-form bypasses entirely. |
| L5 | `stop-gate.sh:44-45` | `_chip*` dir glob | profile | Same as L2/L3. |
| L6 | `dispatch-lint.sh:37` | `local_…` session-id pattern | tooling constant | Claude-Code-specific id shape; another host's session ids fail the HUB-SESSION marker check even when present. |
| L7 | `stop-gate.sh:22` | `/.claude/worktrees/` path | tooling constant | Claude-Code-specific worktree location; other worktree layouts never trip the scope guard → stop-gate silently never runs. |
| L8 | `dispatch-lint.sh` (marker names) | `CONTRATO:`, `EXEMPLO-IO:` (Portuguese) | fixed doctrine tokens (document as opaque) | Low — tokens are conventions, not repo names, but a "generic METHOD" file carrying one repo's working language is a smell. Document as opaque literals; flag for future. |

---

## Part B — Generic bugs (bite any repo, independent of bindings)

| # | File:line | Defect | Failure scenario | Fix |
|---|---|---|---|---|
| G1 | `merge-gate.sh:27` | Fast-path `*"git merge"*chip/*` matches **slash only** | Dash-form chip branches (`chip-m06-produto`, `chip-m09-dashboard`) **bypass the gate silently** — merged with zero enforcement (ledger D-110: M-06/M-09 self-enforced because the gate never fired). Silent no-op is worse than a block. | Match `chip[/-]`; extract branch with the same class; never fail-open on a chip-shaped branch. |
| G2 | `merge-gate.sh:60-68` | `LIVE-VERIFIED` required **unconditionally** | The file's own header says *"(c) **for provider-touching scope**"* — but the code requires the live marker for **every** chip merge. FE-only / docs-only chips (ANUN, SIM, VINC were pure `apps/web`) are forced to carry a live-drive marker they have no provider path for. Over-blocks; trains people to rubber-stamp the marker. | Gate the LIVE requirement on a scope signal: pack line `SCOPE-PROVIDER-TOUCHING: yes`, or profile-declared provider-path globs matched against the chip diff. No signal + no provider globs touched → LIVE not required. |
| G3 | `merge-gate.sh:52-58` | `OK_P6` and `OK_LIVE` can be satisfied by **different files** | The loop sets each flag independently across all `$MATCHES`. Pack X carries `P6-DUAL-GATE: AGREEMENT`, unrelated pack Y (another chip) carries `LIVE-VERIFIED:` → gate passes though **no single pack** attests both for this branch. Split-evidence loophole. | Require both markers in the **same** pack: iterate, pass only if one file has P6 AND (live-or-waived or scope-not-provider). |
| G4 | `stop-gate.sh:44` | `find -printf` is **GNU-only** | On macOS/BSD `find` (no `-printf`), the newest-mtime selection prints nothing → silent fallback to `head -1` (line 45) = the exact traversal-first bug the field-fix was meant to kill. The fix only works on GNU findutils. | Portable newest-file: `find … -print0 \| xargs -0 stat -f '%m %N'` (BSD) / `-c '%Y %n'` (GNU) with detection, or a `ls -t` over the glob, or a perl one-liner. |
| G5 | `stop-gate.sh:37` | `*CLOSED*` substring over 30 KB transcript tail | Any occurrence of the word "CLOSED" in the last 30 KB (discussing another chip, prose, a diff) trips the completion gate on a session that never claimed CLOSED. False block. | Match the event grammar (`CLOSED` adjacent to the chip-event frame), not a bare substring. |
| G6 | all hooks | JSON parsed via `grep`/`sed`, no `jq`; `stop-gate.sh:26,32` backslash handling `${CWD//\\\\/\/}` only collapses **doubled** backslashes | Single-backslash Windows paths in the JSON survive un-normalized → `case "$CWD"` scope guard misses → stop-gate silently never runs on Windows worktrees. Field-seen path mangling. | Prefer `jq` when present (probe once); robust sed fallback that handles single and doubled backslashes and both slash directions. |
| G7 | deploy topology | **No resync flow** for the 3 hook copies | Source (`Documents/mnfs-harness`) is truth; runtime reads the **cache** (`.claude/plugins/cache/.../0.4.0/`); a **mirror** exists too. Field: source `stop-gate.sh` patched, cache+mirror stale, and the auto-classifier **blocks** editing the cache (ledger D-105/D-111). A fix in source doesn't reach runtime, and there's no sanctioned path to promote it. | Ship `scripts/harness-sync.sh` (source → cache → mirror, checksum-verified) + document the operator-permitted promotion step. Runtime-authority (cache) must have a one-command refresh. |
| G8 | `dispatch-lint.sh:30` | BASE-SHA `[0-9a-f]{40}` assumes **SHA-1** | SHA-256-object repos use 64-hex commit ids → every dispatch blocked as "missing BASE-SHA" though it's present. | Accept `[0-9a-f]{40}` **or** `[0-9a-f]{64}`. |

---

## Part C — The flow: repo-specific declaration (`.harness/config.sh`)

**Principle:** core hooks stay generic by *sourcing* repo bindings from one versioned file, with
built-in defaults so a zero-config repo still runs. The **profile** (human doctrine, §5/§11)
documents the values; `config.sh` is the machine mirror the hooks read. `harness-init` generates
it from the operator interview. This is the "flow for repo-specific" the operator asked for.

### Location probe (each hook, top of file)
```sh
# Repo bindings: versioned config wins; else generic defaults (this repo == the reference shape).
CFG="${CLAUDE_PROJECT_DIR:-.}/.harness/config.sh"
[ -f "$CFG" ] && . "$CFG"
: "${HARNESS_ARTIFACT_DIR:=.mnfs}"
: "${HARNESS_EVIDENCE_GLOB:=EVIDENCE.md}"
: "${HARNESS_CHIP_BRANCH_RE:=chip[/-][A-Za-z0-9._-]+}"
: "${HARNESS_CHIP_DIR_GLOB:=*_chip*}"
: "${HARNESS_FE_SCOPE_RE:=apps/web}"
: "${HARNESS_SESSION_ID_RE:=local_[0-9a-f-]{8,}}"
: "${HARNESS_WORKTREE_RE:=/.claude/worktrees/}"
: "${HARNESS_SHA_RE:=[0-9a-f]\{40\}\|[0-9a-f]\{64\}}"
: "${HARNESS_PROVIDER_SCOPE_RE:=}"   # empty = LIVE gated only by explicit pack signal
```

### `.harness/config.sh` — the repo declares its shape (example: marketplace-central)
```sh
# docs/HARNESS-PROFILE.md §5/§11 is the human source; this is its machine mirror.
HARNESS_FE_SCOPE_RE='apps/web|packages/ui'
HARNESS_PROVIDER_SCOPE_RE='internal/modules/.*/adapters/|apps/server_core/.*/providers/'
# artifact dir, evidence glob, chip patterns: defaults already match this repo — omit.
```

### What each hook stops hardcoding
- **dispatch-lint**: `$HARNESS_FE_SCOPE_RE` (was `apps/web`), `$HARNESS_SESSION_ID_RE`, `$HARNESS_SHA_RE`.
- **merge-gate**: `$HARNESS_CHIP_BRANCH_RE`, `$HARNESS_ARTIFACT_DIR`, `$HARNESS_EVIDENCE_GLOB`; LIVE gated on `$HARNESS_PROVIDER_SCOPE_RE` ∪ pack `SCOPE-PROVIDER-TOUCHING:` signal.
- **stop-gate**: `$HARNESS_WORKTREE_RE`, `$HARNESS_ARTIFACT_DIR`, `$HARNESS_EVIDENCE_GLOB`, `$HARNESS_CHIP_DIR_GLOB`.

### Ties to existing doctrine
- `PROFILE-TEMPLATE.md §5` already declares FE surface + artifact paths in prose — this makes
  the hooks actually *read* what the profile already promises. Add a `§5.1 machine mirror`
  pointer to `.harness/config.sh`.
- `PROFILE-TEMPLATE.md §11` (enforcement bindings) gains: "the repo versions `.harness/config.sh`;
  values mirror §5. Hooks source it; unset keys fall to generic defaults."
- `harness-init` skill: generate `.harness/config.sh` from the §5 interview answers.

**Net:** core carries zero repo names (doctrine restored). A new repo either matches the defaults
(runs immediately) or writes one small `config.sh` (the flow). Repo-specific never again means
editing a shipped hook.

---

## Priority for the fix pass

1. **G1 + G3** (merge-gate soundness — the gate currently lets dash-branches and split-evidence
   through: enforcement theater). 2. **L1** (dispatch-lint `apps/web` — most-cited leak).
3. **G4 + G6** (portability — silent no-op on macOS/Windows). 4. **G2** (LIVE over-block —
   daily friction). 5. **Part C config flow** (makes 1–4 land generically, not as new hardcodes).
6. **G7** (sync flow — so any of this reaches runtime).
