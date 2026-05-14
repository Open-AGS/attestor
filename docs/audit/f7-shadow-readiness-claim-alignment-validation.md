# F7 Shadow Readiness Claim Alignment Validation

Status: repository slice for F7-S10.

Baseline: follows the F7 shadow bundle signing boundary slice on `origin/master`.
This validation is repository evidence only. It is not live production evidence,
not external audit evidence, and not a claim that customer shadow activation is
complete.

## Scope

F7-S10 said the `productionReady: false` flags were descriptive and that there
was no unified readiness or claim-alignment layer covering the shadow promotion
pipeline. The storage part was already partly handled by
`production-storage-path.ts`, but it did not give the shadow pipeline a single
machine-readable answer for:

- which shadow stages are covered,
- which repository controls back each stage,
- whether the selected runtime profile can truthfully claim shadow readiness,
- and whether the output avoids production-readiness overclaim.

## Repository Change

The new `shadow-readiness-claim-alignment` contract adds a single descriptor and
evaluator for the shadow path:

- `src/consequence-admission/shadow-readiness-claim-alignment.ts`
- `CONSEQUENCE_SHADOW_READINESS_CLAIM_ALIGNMENT_VERSION`
- `consequenceShadowReadinessClaimAlignmentDescriptor()`
- `evaluateConsequenceShadowReadinessClaimAlignment(...)`
- `npm run test:shadow-readiness-claim-alignment`

The descriptor covers the shadow pipeline stages:

1. `shadow-admission-events`
2. `shadow-policy-simulation`
3. `policy-discovery-candidates`
4. `shadow-policy-promotion-draft`
5. `shadow-policy-promotion-packet`
6. `shadow-policy-bundle-publication`
7. `shadow-downstream-verification-binding`
8. `shadow-downstream-integration-proof`
9. `shadow-activation-readiness-gate`
10. `shadow-customer-activation-handoff`
11. `shadow-customer-activation-receipt`
12. `shadow-production-storage-path`

The evaluator binds the already-remediated F7 slices into one claim-alignment
answer:

- origin and redaction witness binding,
- server-owned simulation floor,
- promotion approval trail binding,
- production signing boundary split,
- downstream verification binding,
- break-glass extra gate,
- high-risk two-person approval,
- customer activation receipt loop,
- selected-profile storage readiness.

`/api/v1/ready` now includes `shadowReadinessClaimAlignment` and a
`checks.shadowReadinessClaimAlignment` boolean. The check uses
`production-storage-path.ts` as the dynamic runtime input. In evaluation
profiles it can be accepted without a production claim; in `production-shared`
it blocks when selected-profile shadow storage is not ready.

## Status Transition

| Finding | Previous | Current | Evidence |
|---|---|---|---|
| F7-S10 production-ready descriptor enforcement | `partial` | `fixed` | Unified shadow readiness claim-alignment descriptor, `/api/v1/ready` check, package export, validation doc, and tests. |

## Claim Boundary

This fix does not say "shadow mode is production ready." It says the repo now
has a single machine-readable readiness answer that prevents the prior
descriptive-only flag problem from becoming a public claim problem.

The evaluator intentionally returns:

- `productionReady: false`
- `autoEnforce: false`
- `activatesEnforcement: false`
- `readinessOnly: true`
- `rawPayloadStored: false`

When `runtimeProfileId === 'production-shared'`, the evaluator depends on
`productionStoragePath.readyForSelectedProfile`. If production-shared shadow
storage is still file-backed or evaluation-only, the shadow readiness state is
`production-shared-shadow-blocked`.

## Remaining Queue

The active F7 queue shrinks from one planned repository unit to zero planned
repository units.

F7-S6 remains an accepted repository limitation: shared shadow persistence is
future deployment/storage work, not a current production-shared claim.

F7-S7 remains an accepted boundary: red-team replay is evidence and design
feedback, not runtime enforcement.

## Validation Commands

```bash
npm run test:shadow-readiness-claim-alignment
npm run test:f7-shadow-readiness-claim-alignment-validation
npm run test:f7-shadow-infrastructure-validation
npm run test:audit-remediation-tracker
npm run typecheck
npm run typecheck:hygiene
npm run build
npm run security:supply-chain-baseline
npm run security:audit-high
```
