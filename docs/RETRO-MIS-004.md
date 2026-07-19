# RETRO MIS-004 (marketplace-central MVP demo) — evidence-based harness findings

Date: 2026-07-19 (T-1 of client demo). Conducted by hub v2 with operator mandate for
independent, fact-based analysis. Sources: HUB-LEDGER D-01..D-96 forensic classification,
planning-artifact audit (.mnfs), test-surface census (Go/vitest/fixtures), executor
testimony (CHIP-M05-FAIXA), Claude Code enforcement-mechanism research (official docs).

## Verdicts on operator hypotheses

### H1 "Validation contracts too weak" — PARTIAL (diverge on diagnosis, agree on symptom)
Contracts were strong on WHAT (8/9 milestones PRESENT; M-07 had a golden matrix of >=10
cases and literal drive steps). The real failure had 3 parts:
1. **Enforcement, not spec**: contracts *wrote* "live-driven mandatory; mock does not
   satisfy C01/C02" and execution violated it anyway (deferred to post-merge P7).
   Nothing blocked the violation. 13/14 chip evidence packs closed mock-only.
2. **Missing concrete I/O examples**: M-02/M-05/M-06/M-09 used placeholders
   (`<codprod-com-custo>`), zero real numbers. Executor testimony: one concrete case
   ("90008 -> min 179.9 / median 229.2, own=169.99") "would have changed EVERYTHING —
   golden test before P7".
3. **P6 evidence pack under-specified**: post-merge ladder RED with 5 classes P6 never
   looked at (governance, bad-input probes, full tsc) — ledger D-66/67.

### H2 "No design reference images" — AGREE symptom, REFINE solution
Zero raster images in the entire repo (glob png/jpg/svg = 0; design README admits it).
BUT the DESIGN-REFERENCE ships 9 functional `.dc.html` prototypes — better than photos
(measurable, clickable). The expensive failure (D-56/58 full M-05 reshape) was
**sequencing**: chip dispatched D-42/45, design landed D-50. And M-06's brief repeated
the embryo of the same error (never links the existing `Produto Detalhe.dc.html`).
Fix = design-before-dispatch gate + brief links exact reference file + screenshot-vs-
prototype at P7. Not literally photos.

### H3 "Too much mock, too little real data" — STRONG AGREE (champion hypothesis)
- 13/14 evidence packs mock-only; the only live one (M02-LIVE-3) exists *because* the
  mock-gated chip was reproved twice.
- Connectors module (where every demo-critical defect lived): 11/13 test files
  httptest-fake; **zero** live-captured fixtures anywhere; post-mortem regression tests
  re-hand-wrote synthetic JSON instead of freezing captured bytes.
- FE: 31 vitest files, 100% mocked, zero real fetch.
- 4 of 5 demo-critical defects were live-shape drift (site_id, sale_price context,
  parent-4xx, numeric seller_id) — hand-written mocks **structurally cannot catch**
  these: the mock author encodes the same wrong assumption as the production struct.
- 2 milestones closed FALSE on mocks (M-02 wave A, M-08 D-72) = the 2 most expensive
  rework sagas of the mission (4 and 3 correction rounds).

### H4 "ML API not studied deeply" — AGREE with nuance
Research existed and was genuinely empirical (IC-06: 22/22 probe, live payload
amendments). Two failures: (1) depth was demand-driven — deep study happened only
*after* defects (x-format-new header was documented and unread; R$79/150 freight
thresholds hardcoded while `listing_prices` / `shipping_options/free` endpoints existed);
(2) research never became executable artifacts (fixtures/contract tests) — referenced
"abstractly via ports". The tariff design-first replan proved the correct model works.

## Additional findings (beyond operator hypotheses)

### H5 Gate rationalization (hub self-finding)
D-72: hub P7 PASSED pedidos rationalizing blank shipment data as "honest degrade";
operator ground truth refuted next day. Operator was the actual final gate 3x
(D-73, D-82, D-95). A gate that rationalizes missing data as "honesty" without proving
the absence is legitimate is a broken gate.

### H6 Policy decisions shipped without ratification
5 SCOPE-DRIFT events; D-95 (REVIEW cap ruled "not-a-defect", refuted in practice),
D-62 (C2 "trivial" assumption refuted by data model). Threshold/policy decisions need
an explicit operator ratification point before ship.

### H7 Infra friction (executor-confirmed)
Executor pain #1: worktree base drift (BLOCKED before writing one line) + manual
node_modules junction / throwaway vitest config ritual.

## Rework totals (ledger classification)

| Category | Clusters | Weight |
|---|---|---|
| MOCK-NOT-LIVE | 4 | Largest total rework volume (both false-CLOSE sagas) |
| WEAK-CONTRACT (examples/enforcement) | 5 | Mid |
| SCOPE/PLAN-DRIFT | 5 | Mid |
| SHALLOW-API-RESEARCH | 3 | Includes 2 most expensive sagas (overlaps C) |
| PROCESS/INFRA | 4 | Cheap each, constant tax |
| NO-DESIGN-REF | 1 | Single but expensive (full reshape) |

## Amendment package -> 0.4.0

A1 Golden live-fixture corpus (providers). A2 Contracts require >=1 concrete I/O case
with real data. A3 No mock-only close of provider-touching surfaces. A4 Design-before-
dispatch for FE chips + exact reference link. A5 P6 evidence minimum (governance +
bad-input + full tsc). A6 Pre-provisioned chip worktrees. A7 Policy ratification gate.
A8 Anti-rationalization rule at P7 (empty field needs positive proof of legitimacy).

## Enforcement conclusion

Advisory layers (.md + skills) were repeatedly rationalized past — the model CAN ignore
them, and did (13x mock-only, 1x false P7). Claude Code provides deterministic layers the
harness did not use: settings deny rules, PreToolUse hooks (exit 2 blocks even in
bypassPermissions), Stop hooks (`decision:block`), restricted-tool agents, headless
`-p --allowedTools` cold reviewers, and plugin-shipped `hooks/hooks.json`. 0.4.0 moves
every gate that CAN be deterministic into those layers; doctrine text remains the WHY.
