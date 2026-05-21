# Ops Sweep 10 - Pipeline Execution + Async Routes Deep Audit

Status: audit report plus narrow OPS-86 repo-side remediation. No live proof
captured. No production-readiness claim.

## 0. Recent Fixes Chain-Effect Check

Source of truth before this branch: `origin/master @ a7e0073d8ed6bf72ab6ea797859d8243b9388130`.

PR #516 / merge `a7e0073d8ed6bf72ab6ea797859d8243b9388130`
landed Sweep 09 account-route remediation before this Sweep 10 work:

- OPS-79 federated callback rate-limit is repo-side closed / live-proof-only.
- OPS-80 account mutation audit is repo-side closed / live-proof-only.
- The merge touched account routes, audit ledger, route builders, audit indexes,
  the live-proof gate, and account-route tests.
- It did not touch `src/service/http/routes/pipeline-execution-routes.ts`,
  `src/service/http/routes/pipeline-async-routes.ts`, pipeline usage, tenant
  middleware, or async pipeline execution code.

Chain-effect verdict: no direct pipeline-route regression from PR #516. Sweep 09
P1 findings are no longer blockers on `origin/master`; their remaining state is
live-proof-only.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source HEAD | `origin/master @ a7e0073d8ed6bf72ab6ea797859d8243b9388130` |
| Branch evidence | `codex/ops-sweep-10-pipeline-idempotency` |
| Phase | Phase 1 - Live Shadow Readiness |
| Protected principles | tenant isolation; customer authority; replay and idempotency safety; fail-closed boundary; operational boundedness; data minimization and redaction; no overclaim |
| Audit driver | Phase 1 required tests: tenant mismatch, bad token, replay, provider outage/degraded mode |
| External anchors | RFC 9110 HTTP idempotent method semantics; IETF HTTPAPI `Idempotency-Key` draft; Stripe idempotent request behavior; BullMQ job-id / retry documentation; OWASP API Top 10 API1/API4/API8; OWASP ASVS V4/V11/V13; NIST SP 800-218 PW.5/PW.8 |
| Scope | `/api/v1/pipeline/run`, `/api/v1/pipeline/run-async`, `/api/v1/pipeline/status/:jobId`, tenant middleware, quota/rate-limit path, async queue boundary, idempotency storage |

Source-backed research notes:

- RFC 9110 defines idempotent method semantics; POST is not inherently
  idempotent, so retry safety must be supplied by application contract:
  <https://www.rfc-editor.org/rfc/rfc9110>.
- The IETF HTTPAPI draft describes `Idempotency-Key` for making non-idempotent
  POST/PATCH requests fault-tolerant. The draft is not an RFC; it is used here
  as implementation-pattern evidence, not as a standard-conformance claim:
  <https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/>.
- Stripe's public API docs save the first status code/body for a given key and
  reject mismatched parameters; Sweep 10 mirrors that conflict/replay shape:
  <https://docs.stripe.com/api/idempotent_requests>.
- BullMQ documents unique job IDs and retries; Attestor does not rely on BullMQ
  duplicate suppression alone because sync `/run` and response replay also need
  tenant quota and signed-report safety:
  <https://docs.bullmq.io/guide/jobs/job-ids>,
  <https://docs.bullmq.io/guide/retrying-failing-jobs>.

## 2. Inspected Files

| File | Depth | Evidence purpose |
|---|---|---|
| `src/service/http/routes/pipeline-routes.ts` | full | route aggregation |
| `src/service/http/routes/pipeline-execution-routes.ts` | full | sync `/run` route, tenant binding, quota/rate-limit, idempotency |
| `src/service/http/routes/pipeline-async-routes.ts` | full | async submit + status routes, idempotency, tenant binding |
| `src/service/tenant-isolation.ts` | targeted | clear-then-set tenant context and production anonymous fail-closed |
| `src/service/application/pipeline-usage-service.ts` | full | quota consume and overage metering boundary |
| `src/service/async-pipeline.ts` | targeted | BullMQ job ID and retry context |
| `src/service/control-plane-store.ts` | targeted | shared PostgreSQL backing for idempotency |
| `src/service/pipeline-idempotency-store.ts` | full | new encrypted file-backed pipeline replay store |
| `src/service/application/pipeline-idempotency-service.ts` | full | new conflict/replay/finalize service |
| `tests/service-pipeline-routes-idempotency.test.ts` | full | regression tests for OPS-86 |
| `docs/audit/{finding-index,report-index,live-proof-register,control-map,current-posture-baseline}.md` | targeted | index and no-overclaim alignment |

## 3. Positive Observations

| ID | Observation | Evidence |
|---|---|---|
| OPS10-POS-01 | Tenant context is clear-then-set by shared middleware before route consumption. | `tenant-isolation.ts`; pipeline routes use `currentTenant(c)`. |
| OPS10-POS-02 | Anonymous tenant fallback remains fail-closed in production-like runtime. | `tenant-isolation.ts`. |
| OPS10-POS-03 | Pipeline routes do not read tenant identity from request body. | `pipeline-execution-routes.ts`; `pipeline-async-routes.ts`. |
| OPS10-POS-04 | Quota and tenant rate-limit checks run before connector execution. | pipeline execution and async routes. |
| OPS10-POS-05 | `/status/:jobId` returns 404 for wrong-tenant jobs, avoiding existence leaks. | `pipeline-async-routes.ts`. |
| OPS10-POS-06 | OPS-86 remediation now checks idempotency before quota, rate, connector, signing, or queue work. | `pipeline-execution-routes.ts`; `pipeline-async-routes.ts`. |
| OPS10-POS-07 | Pipeline idempotency records store a digest of the idempotency key, not the raw key. | `pipeline-idempotency-store.ts`. |
| OPS10-POS-08 | Replay responses are encrypted at rest; production-like runtimes require a dedicated pipeline idempotency encryption key when the header is used. | `pipeline-idempotency-store.ts`; deployment docs. |
| OPS10-POS-09 | Shared control-plane PostgreSQL has a dedicated `pipeline_idempotency` table and advisory-lock scoped lookup/record path. | `control-plane-store.ts`. |
| OPS10-POS-10 | Matching retries replay the previous response; same key with different payload returns 409. | `tests/service-pipeline-routes-idempotency.test.ts`. |

## 4. Findings

| ID | Severity | State | Title | Current evidence | Required action |
|---|---:|---|---|---|---|
| OPS-86 | P1 | `closed / live-proof-only` | Pipeline routes lacked an `Idempotency-Key` boundary. | New `pipeline-idempotency-store.ts`, `pipeline-idempotency-service.ts`, control-plane table/functions, route wiring, package script, and route tests close the repo-side gap for sync and async retries. Missing store config returns 503 before side effects. | Capture `ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF` across live replicas/shared PostgreSQL. |
| OPS-87 | P2 | `open / partial-repo` | Sync `/run` handler is still monolithic. | Remediation intentionally did not refactor the route body. | Decompose by stage/release target in a later behavior-preserving PR. |
| OPS-88 | P2 | `open / partial-repo` | Pipeline JSON parsing is not strict. | Routes still call `c.req.json()` directly. | Reuse strict JSON helper from OPS-61. |
| OPS-89 | P2 | `open / partial-repo` | Async submit/consume atomicity window remains. | OPS-86 prevents duplicate retry after finalization, but queue-success/consume-failure before finalization remains possible. | Make submit + consume + finalize bounded by one claim/transaction or compensating record. |
| OPS-90 | P2 | `open / partial-repo` | Pipeline error messages need redaction hardening. | Generic connector/route errors can still propagate `error.message`. | Add redactor for connector/provider internal strings. |
| OPS-91 | P2 | `accepted limitation` | Pipeline run history is the decision log + signed report. | No flat per-run tenant history row was added; this matches the consequence-engine audit substrate. | Document the limitation in the closest pipeline/consequence runtime note. |
| OPS-92 | P3 | `open / partial-repo` | Run ID nonce hygiene. | Original draft overclaimed BullMQ public job ID risk; BullMQ public job IDs are UUID-backed. Sync `runId` and async BullMQ input `runId` still use timestamp strings. | Add random suffix or UUID when response IDs change next. |

## 5. Route Matrix

| Method | Path | Tenant binding | Quota/rate | Idempotency | Current state |
|---|---|---|---|---|---|
| POST | `/api/v1/pipeline/run` | `currentTenant(c)` | quota + tenant rate-limit before connector work | `Idempotency-Key` checked before side effects; replay returns prior response; conflict returns 409 | OPS-86 closed repo-side |
| POST | `/api/v1/pipeline/run-async` | `currentTenant(c)` | quota + tenant rate-limit + async queue cap | `Idempotency-Key` checked before side effects; replay returns prior job response; conflict returns 409 | OPS-86 closed repo-side; OPS-89 remains |
| GET | `/api/v1/pipeline/status/:jobId` | `currentTenant(c)` and job tenant equality | n/a | n/a | wrong tenant returns 404 |

Coverage: 3 / 3 pipeline execution and async routes mapped.

## 6. Remediation Summary

OPS-86 smallest safe fix:

- Added a pipeline-specific idempotency store that digests keys, hashes request
  payloads, encrypts response bodies, and prunes records by TTL.
- Added a pipeline idempotency service that returns `ready`, `replay`,
  `conflict`, or `unavailable`.
- Added shared PostgreSQL control-plane backing with advisory locks.
- Wired `/pipeline/run` and `/pipeline/run-async` to check idempotency before
  quota, rate-limit, connector, signing, or queue work.
- Added route tests for sync replay, payload conflict, missing-store
  fail-closed before side effects, and async replay.
- Added `ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF` to the live-shadow gate and
  `LP-PIPELINE-IDEMPOTENCY` to the live proof register.

## 7. No-Claims

- No live proof was captured.
- No multi-replica replay test was run.
- No production readiness, enterprise readiness, or compliance claim is made.
- OPS-89 remains open because queue submission and usage consume are still not
  one failure-atomic transaction.
- OPS-87/88/90/92 remain follow-up findings.

## 8. Draft Index State

The current PR updates:

- `docs/audit/finding-index.md` with OPS-86 through OPS-92.
- `docs/audit/report-index.md` with OPS-SWEEP-10.
- `docs/audit/control-map.md` with pipeline idempotency as repo evidence and
  live proof as remaining evidence.
- `docs/audit/live-proof-register.md` with `LP-PIPELINE-IDEMPOTENCY`.
- `docs/audit/current-posture-baseline.md` with pipeline execution / async
  route reconciliation.

## 9. Verdict

- Is the Sweep 10 report complete? Yes for the scoped repo-side audit and
  OPS-86 remediation.
- Is there a repo-proven P0? No.
- Is there a repo-proven P1 remaining in this scope? No. OPS-86 is repo-side
  closed and live-proof-only.
- Is remediation still required before stronger Phase 1 exit claims? Yes:
  capture live pipeline idempotency proof and address OPS-89 before claiming
  HA retry/consume atomicity.
- Next logical audit slice: release-review, release-policy-control, or shadow
  routes.
