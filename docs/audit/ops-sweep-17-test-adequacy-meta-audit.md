# Ops Sweep 17 - Test Adequacy Map Meta-Audit

Status: read-only meta-audit. No remediation was written in this sweep. No
test guard, schema marker, workflow gate, live-proof gate, or source file was
changed by this report.

Remediation follow-up: current `origin/master` after PR4 adds
`scripts/check/check-finding-test-coverage.mjs`, `tests/finding-test-coverage.test.ts`,
Evaluation Smoke wiring, structured `Locking test:` markers for closed P0/P1
rows, and future `Test contract:` paths for P0 live/ops blockers. The report's
original OPS-136/139 gaps are therefore repo-side closed when that guard is
green; live/ops proof blockers remain live-proof-only.

This sweep maps every current P0/P1 finding-index row to its locking test
evidence or to an explicit open test-contract gap.

## 0. Recent Fixes Chain-Effect Check

One merge landed on `origin/master` after Sweep 16 was drafted:

- PR #523 / commit `89b03594` - "Add Sweep 16 demo safety audit"
- merge head `5ebab103648967db48652949eacff4dd794ec2ce`

Files changed by PR #523 were docs-only:

- `docs/audit/ops-sweep-16-demo-safety-redaction-deep-audit.md`
- `docs/audit/control-map.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/finding-index.md`
- `docs/audit/report-index.md`

Chain-effect verdict: PR #523 does not touch `tests/**`,
`scripts/check/check-audit-finding-evidence.mjs`,
`scripts/verify/validate-pr-contract.mjs`, or any source file. No regression, config
drift, defense-in-depth weakening, or closed-finding reopening was found in
Sweep 17 scope.

PR #523 does affect this meta-audit by adding the Sweep 16 rows OPS-129
through OPS-135 to `finding-index.md`; those rows are included in the matrix.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ 5ebab103648967db48652949eacff4dd794ec2ce` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline blocker in scope | `finding-index.md` row `Test adequacy map`, P1 |
| Protected principles | auditability; no overclaim; release provenance |
| Audit driver | `current-posture-baseline.md` Phase 1 task "Create P0/P1 finding-to-test adequacy map" |
| External anchors | NIST SP 800-218 PW.7 / PW.8; NIST SP 800-53 CA-7; OWASP ASVS verification vocabulary; CWE-1294 and CWE-693 taxonomy |
| Scope | every P0/P1/P0-P1 row in `docs/audit/finding-index.md`; locking test files under `tests/`; `scripts/check/check-audit-finding-evidence.mjs`; absence of a finding-index to test-path guard |
| Method | extract current P0/P1 rows; map each to locking test evidence; classify `repo-locked`, `live-proof-only`, `open`, or `needs-test-contract`; name missing automation |

External anchors are used as control vocabulary only. This report does not claim
NIST, OWASP, or CWE certification or full verification.

## 2. Inspected Files

| File / path | Depth | Why selected |
|---|---|---|
| `docs/audit/finding-index.md` | full | Source of truth for current P0/P1 finding rows |
| `docs/audit/finding-lifecycle-and-evidence-ledger.md` | targeted | Existing per-finding closure contract |
| `scripts/check/check-audit-finding-evidence.mjs` | targeted | Current ledger guard; enforces required closed-finding fields |
| `tests/` | inventory | Locking-test candidate set; repo evidence count is 543 files |
| Route-surface HTTP tests | inventory + targeted grep | Confirm Sweep 06-12 remediation locks |
| Ops-sweep remediation tests | inventory + targeted grep | Confirm OPS-25 through OPS-56 and live-shadow gate coverage |
| `tests/production-readiness-secret-safe-output.test.ts` | targeted | Current OPS-129 baseline coverage |

## 3. Skipped Files

| File / path | Why skipped | Risk |
|---|---|---|
| Full contents of every individual test file | Sweep 17 maps finding-to-test existence and naming, not per-test semantic correctness | low |
| `docs/audit/REM-*.md` and `docs/audit/AUD-*.md` | Per-finding ledgers are already checked by `check-audit-finding-evidence.mjs` | low |
| P2/P3 findings outside the P0/P1 chain | Out of the stated meta-audit scope | low |
| Low/Medium B-series findings except their P1 superseding OPS rows | B-025 and B-028 are now tracked through OPS-133 and OPS-129/132 | low |

No critical Sweep 17 artifact was skipped.

## 4. Positive Observations

| ID | Observation | Why it matters |
|---|---|---|
| OPS17-POS-01 | `scripts/check/check-audit-finding-evidence.mjs` enforces per-finding ledger fields including `Negative/adversarial tests:` and `Positive/regression tests:`. | The closure contract exists; the missing piece is the inverse finding-index matrix. |
| OPS17-POS-02 | Closed P1 route findings from Sweeps 06-12 name concrete HTTP-layer tests such as `tests/service-admin-routes-http.test.ts`, `tests/service-account-routes-authorization.test.ts`, `tests/service-shadow-routes-http.test.ts`, and release admin-route tests. | Route remediation was regression-locked, not only patched. |
| OPS17-POS-03 | Dedicated HTTP-layer tests cover admin, account, shadow, release-review, release-policy-control, pipeline idempotency, webhook signature, and webhook rate-limit surfaces. | The `/api/v1/**` route audit chain has concrete route-level test evidence. |
| OPS17-POS-04 | `tests/ops-sweep-03-observability-remediation.test.ts` and `tests/ops-sweep-04-storage-collector-remediation.test.ts` contain explicit OPS-NN regression assertions. | Earlier ops remediation is searchable by finding ID. |
| OPS17-POS-05 | `tests/ops-live-shadow-readiness.test.ts` and `scripts/check/check-ops-live-shadow-readiness.mjs` jointly lock the live-proof gate contract. | Live-proof claims are separated from repository claims. |
| OPS17-POS-06 | The current `tests/` inventory has 543 files. | The surface is broad enough to justify a machine-readable coverage guard. |
| OPS17-POS-07 | `finding-index.md` already carries `Test adequacy map` as a P1 item with the exact requested action. | Sweep 17 closes a documented baseline task, not a new side quest. |
| OPS17-POS-08 | Newer remediation tests often include OPS IDs in assertion text. | A grep-based guard and future `Locking test:` convention are feasible without a heavy metadata system. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Recommended next action |
|---|---:|---|---|---|---|
| OPS-136 | P1 | `open` | No automated guard asserts that each closed P0/P1 finding-index row references a locking test file that exists under `tests/`. | `scripts/check/check-audit-finding-evidence.mjs` validates per-finding ledger fields but does not cross-check `finding-index.md` against `tests/`; no `scripts/check/check-finding-test-coverage.mjs` exists. | Add `scripts/check/check-finding-test-coverage.mjs` and wire it to reviewer-facing checks. |
| OPS-137 | P2 | `open / partial-repo` | OPS-25 has no renderer-output regression test for non-empty rendered Alertmanager receivers. | Existing remediation tests verify input YAML patterns; no test invokes the renderer and asserts non-empty rendered `receivers:` output. | Add a renderer-output test with synthetic env. |
| OPS-138 | P2 | `open / partial-repo` | Several `needs live test` / `needs ops proof` P0 rows do not name the future test contract path. | `Customer PEP no-bypass`, `External KMS runtime signing`, and `Shared replay / introspection store` rows name live-proof needs but not target test files. | Add `Test contract:` fields naming future `tests/live-*.test.ts` targets before capture. |
| OPS-139 | P2 | `open / partial-repo` | `finding-index.md` lacks a structured `Locking test:` marker. | Test references live inside free-text evidence cells, which makes reliable automation fragile. | Introduce `Locking test:` convention and have OPS-136 consume it. |
| OPS-140 | P3 | `open / partial-repo` | OPS-26 and OPS-30 row text describes YAML evidence more clearly than the specific locking test file. | The relevant tests exist, but the row text does not make them explicit in a structured form. | Add explicit `Locking test:` lines when OPS-139 lands. |

## 6. P0/P1 Finding To Locking Test Matrix

Every current P0/P1/P0-P1 row in `finding-index.md` on
`origin/master @ 5ebab103648967db48652949eacff4dd794ec2ce` was mapped. The
matrix covers 37 rows.

### P0 rows

| Finding | State | Locking test status |
|---|---|---|
| Customer PEP no-bypass | `needs live test` | none; needs `Test contract:` path |
| External KMS runtime signing | `needs ops proof` | none; needs `Test contract:` path |
| OPS-25 Alertmanager receivers empty | `live-proof-only` | `tests/ops-sweep-03-observability-remediation.test.ts` covers input; renderer-output test missing |
| OPS-26 Prometheus metrics token literal | `closed` | `tests/observability-bundle.test.ts`, `tests/observability-credentials-render.test.ts`, and ops-sweep remediation tests |
| OPS-38 OTel collector mutable image tag | `stale/closed` | `tests/kubernetes-observability-bundle.test.ts`, `tests/ops-sweep-04-storage-collector-remediation.test.ts` |

### P0/P1 mixed rows

| Finding | State | Locking test status |
|---|---|---|
| Shared replay / introspection store | `needs live test` | none; needs `Test contract:` path |
| `ops/**` audit gap | `partial / live-proof-only` | umbrella tests across ops-sweep remediation, HA, DR, observability, and live-shadow readiness |
| `src/service` admin routes gap | `partial / live-proof-only` | `tests/service-admin-routes-http.test.ts` plus release admin-route tests |
| Required commit signatures / OPS-121 | `open` | needs future branch-governance test contract |
| Required PR reviews / OPS-122 | `open` | needs future branch-governance test contract |

### Closed or live-proof-only P1 rows from ops and route sweeps

| Finding group | State | Locking test evidence |
|---|---|---|
| OPS-27, OPS-30, OPS-39, OPS-40, OPS-41 | closed or live-proof-only | `tests/observability-bundle.test.ts`, `tests/ops-sweep-03-observability-remediation.test.ts`, `tests/ops-sweep-04-storage-collector-remediation.test.ts`, `tests/dr-bundle.test.ts`, `tests/kubernetes-observability-bundle.test.ts` |
| OPS-57, OPS-58, OPS-59 | closed or live-proof-only | `tests/service-admin-routes-http.test.ts` |
| OPS-65, OPS-66, OPS-69 | closed or live-proof-only | `tests/ops-live-shadow-readiness.test.ts`, `tests/kubernetes-observability-bundle.test.ts`, `tests/kubernetes-ha-bundle.test.ts` |
| OPS-73, OPS-74 | closed or live-proof-only | `tests/service-email-webhook-service.test.ts`, `tests/service-email-webhook-signature-verifiers.test.ts` |
| OPS-79, OPS-80 | closed or live-proof-only | `tests/service-account-routes-authorization.test.ts` |
| OPS-86 | closed / live-proof-only | `tests/service-pipeline-routes-idempotency.test.ts` |
| OPS-93, OPS-94 | closed or live-proof-only | `tests/service-shadow-routes-http.test.ts` |
| OPS-100 | closed / live-proof-only | `tests/release-policy-control-plane-admin-routes.test.ts`, `tests/release-review-admin-routes.test.ts` |

### Current open P1 rows

| Finding | State | Proposed test contract |
|---|---|---|
| OPS-112 health/ready diagnostic disclosure | `open` | `tests/service-core-routes-diagnostics.test.ts` |
| OPS-113 verify route rate-limit gap | `open` | `tests/service-verify-route-rate-limit.test.ts` |
| OPS-121 signed-commit branch protection | `open` | branch-governance test for GitHub protection probe shape |
| OPS-122 required-review branch protection | `open` | same branch-governance test family |
| OPS-129 redaction provider-pattern gap | `open` | extend `tests/production-readiness-secret-safe-output.test.ts` provider matrix |
| Admin API key blast radius | `partial / live-proof-only` | structural route tests exist; runbook/rotation proof remains operator-side |
| Test adequacy map | `partial-repo` after this report | closes only when OPS-136 and OPS-139 land |

Matrix totals:

- repo-locked rows with concrete tests: 19
- live-proof-only rows with repo test evidence: 13
- open rows that still need committed test contracts or remediation tests: 5

The totals classify repository evidence, not production readiness.

## 7. Test Coverage Verification

| Question | Verdict |
|---|---|
| Does every closed P0/P1 route finding name concrete route tests? | repo-proven for Sweeps 06-12 |
| Do ops-sweep remediation tests cover OPS-25 through OPS-56 family findings? | repo-proven for existing bundle and sweep-specific tests, with OPS-25 renderer-output gap |
| Does a guard cross-check `finding-index.md` against `tests/` paths? | gap - OPS-136 |
| Does `finding-index.md` have a structured marker for locking tests? | gap - OPS-139 |
| Do live-proof-only P0 rows name future test-contract paths? | partial - OPS-138 |

Verdict: regression-lock infrastructure is solid for repo-side closures, but
the missing automation is meta-tooling: an inverse guard, a structured marker,
and explicit future test contracts for live-proof findings.

## 8. Draft Index Updates

This PR integrates the report and index state only. It intentionally does not
add `LP-FINDING-TEST-COVERAGE`; that live-proof row should land with OPS-136
when the guard exists and is wired into CI.

Index updates in this PR:

- add OPS-136 through OPS-140 to `finding-index.md`;
- promote `Test adequacy map` from `open` to `partial-repo`;
- add the OPS-SWEEP-17 row to `report-index.md`;
- update the `Finding lifecycle closure` control-map row;
- refresh `current-posture-baseline.md` for the new HEAD and test adequacy
  state.

## 9. Verdict

- Sweep 17 report completeness: complete for a read-only meta-audit.
- Repo-proven P0 surfaced: no.
- Repo-proven P1 surfaced: yes, OPS-136.
- Remediation required: yes, OPS-136 plus OPS-139 are needed to close the
  `Test adequacy map` baseline P1 fully.
- Next locked target: a small remediation PR adding the coverage guard and
  `Locking test:` convention; optional same-PR cleanup can include OPS-137,
  OPS-138, and OPS-140.

No security proof claim: this report proves the matrix exists and names gaps.
It does not prove every referenced test semantically asserts the entire closure
claim; that remains a separate per-test review lens.
