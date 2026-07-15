# Interface Contract Card

Use only when multiple workers could otherwise invent incompatible API, data, UI, route, event, or file-format semantics.

Target path: `<mission-root>research/<topic>-interface-contract.md`

## Spine

~~~markdown
# Interface Contract

```yaml
id: IC-<nn>
type: interface-contract
status: planned | superseded
owner: Mission Strategist
parent: MIS-<nn>
created: YYYY-MM-DD
updated: YYYY-MM-DD
validation_level: QA-0 | QA-1 | QA-2 | QA-3 | QA-4
lifecycle_scope: support
```

## Boundary

## Why This Contract Exists

## Resources Or Entities

## Operations

| Operation | Trigger | Input | Output | Notes |
| --- | --- | --- | --- | --- |

## Fields

### Required Inputs

### Required Outputs

## Enums And Statuses

## Error Cases

## Persistence Expectations

## Canonical Examples

- Name the minimum request/response examples needed to prevent drift.
- Include at least one success example and one rejection example for each load-bearing operation.
- Use exact field names, enum values, nullability, and timestamp/id formats.

## Error Matrix

| Case | Status | Code | Notes |
| --- | --- | --- | --- |

## Database Shape

- Table names:
- Key columns and constraints:
- Enum or check constraints:
- Timestamp storage format:

## Seed Data

- Fixed records that validation can rely on:
- Reset or reseed expectations:

## Timestamp And ID Semantics

- ID type and positivity rules:
- Timestamp unit and timezone convention:
- Update semantics for created/updated fields:

## Compatibility Rules

- Name any optional extensions that must remain backward-compatible.
- State what later features may extend without renaming or reshaping the base contract.

## Route Namespace

- Server route prefix(es) and who mounts them:
- Client route prefix(es) / page paths and who owns them:
- Rule: no two workers mount overlapping prefixes; list the reserved prefixes here.

## Transport And Integration

- Cookie name, `sameSite`, `secure`, `httpOnly` (when auth/session crosses an origin):
- CORS allowed origin(s) and whether credentials are included:
- Client credentials mode (e.g. `fetch` `credentials: "include"`):
- Dev-server proxy expectation (who proxies what to which port):
- Session/token store and reset policy:

## Must Preserve

## Must Not Decide In Feature Execution

## Validation Impact
```
~~~

## Rules

- Keep this minimal, not OpenAPI.
- Define only shared semantics required to prevent drift.
- Prefer stable names, enums, errors, ownership, and persistence expectations over implementation detail.
- Include canonical examples when workers could plausibly serialize different JSON, timestamps, nulls, or error details.
- Include database shape and seed data when validation depends on fixed records or constraints.
- Include Route Namespace and Transport And Integration whenever the boundary crosses a client/server origin or multiple workers mount routes, so cookie/CORS/proxy/route-prefix semantics cannot drift.
- The Error Matrix must enumerate every error case any operation can return — one row per (code, trigger). No downstream feature may return an error case absent from this matrix; if a feature needs a new case (e.g. duplicate-username → 400), add the row here first. Reusing an existing code for an unlisted trigger still requires its own row.
- Every list/collection operation declares its sort order (e.g. newest-first, chronological) in its Operations notes. Unspecified ordering is a drift seam, not an implementation detail.
- Feature briefs must point here and say what to preserve.
