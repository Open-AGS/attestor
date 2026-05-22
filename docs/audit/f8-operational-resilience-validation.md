# F8 Operational Resilience Validation

Status: closure record for the project-owner supplied F8 operational
resilience / chaos audit.

Baseline: current `origin/master` at the time of this validation slice.

This document validates the F8 report against repository evidence. It is not a
production deployment proof, not a disaster-recovery certification, and not a
claim that customer-operated infrastructure has passed live failure drills.

## Scope

F8 covers the runtime resilience surface:

- API health, readiness, and startup probes.
- Production-shared startup blocking.
- Degraded-mode break-glass and cache-only grants.
- Worker readiness and shutdown posture.
- Async queue and dead-letter visibility.
- PKI bootstrap and production-shared storage gates.
- PostgreSQL / Redis dependency posture.
- Webhook signature verification.
- Rehearsal and chaos-drill evidence.

Primary repository evidence:

- `src/service/http/routes/core-routes.ts`
- `src/service/bootstrap/server.ts`
- `src/service/bootstrap/production-storage-path.ts`
- `src/service/hosted-production-runtime-health-contract.ts`
- `src/service/worker.ts`
- `src/service/control-plane-store.ts`
- `src/service/async-dead-letter-store.ts`
- `src/release-enforcement-plane/degraded-mode.ts`
- `src/service/application/stripe-webhook-service.ts`
- `src/service/application/email-webhook-service.ts`
- `docker-compose.ha.yml`
- `ops/kubernetes/ha/api-deployment.yaml`
- `tests/f8-operational-resilience-validation.test.ts`
- production rehearsal tests under `tests/production-rehearsal-*.test.ts`

## Standards Anchors

- Kubernetes probes: liveness, readiness, and startup probes have separate
  meanings and should not be collapsed.
- Google SRE guidance: health signals should be actionable, bounded, and
  separated from diagnostics.
- OWASP API Security Top 10 2023: diagnostics, webhook ingress, and repeated
  async work should avoid sensitive output and unbounded consumption.
- NIST SP 800-53 Rev. 5 and NIST SP 800-160 Vol. 2: resilience controls need
  testing evidence, known fail states, and recovery practice.

## Validation Summary

| F8 ID | Report claim | Repository status | Validation result |
|---|---|---|---|
| F8-R1 | `/api/v1/health` exposes CA fingerprint and signer/reviewer subjects before auth. | Health now reports only minimal public liveness identity and no longer exposes PKI or release-runtime diagnostics. The public CA route remains explicit trust-root distribution. | `fixed` |
| F8-R2 | Readiness doubles as startup probing. | `/api/v1/startup` exists and returns process bootstrap state without dependency readiness or PKI metadata. Kubernetes HA manifests use `startupProbe`, and HA compose has a longer bootstrap grace period. | `fixed` |
| F8-R3 | Health body includes dependency diagnostics that an operator could confuse with readiness. | Public health is now process liveness only, and `/api/v1/ready` is the traffic gate. Internal diagnostics remain in runtime/rehearsal evidence rather than public probe bodies. | `fixed` |
| F8-R4 | Degraded-mode grant TTL ceilings might be defaults rather than enforced ceilings. | `createDegradedModeGrant` rejects grants whose effective `expiresAt - startsAt` exceeds `maxTtlSeconds`; the F8 validation test asserts the 30-minute break-glass ceiling. | `fixed` |
| F8-R5 | Async dead-letter records are file-backed and split across pods. | File-backed DLQ remains the local fallback. Shared control-plane PostgreSQL persistence exists for async dead-letter records, and production-shared storage gates require shared control-plane posture. Live deployment proof remains external. | `partial` |
| F8-R6 | Worker shutdown drain behavior was not visible. | `worker.ts` exposes `/health` and `/ready`; readiness gates `shuttingDown`, Redis, and HA posture. The health contract names `worker_shutdown_not_ready`, and validation asserts the shutdown gate exists. | `fixed` |
| F8-R7 | PKI bootstrap idempotency relies on file locks. | This is the same root boundary as F-5.7. Production-shared now requires explicit shared PKI path attestation, but a distributed lock or KMS/HSM signer remains outside repository closure. | `partial` |
| F8-R8 | PostgreSQL pool retry / circuit-breaker policy is not explicit. | Current repository evidence has PostgreSQL shared stores and rehearsal tests, but no dedicated circuit-breaker contract over every pool. This remains backlog before making stronger production resilience claims. | `backlog` |
| F8-R9 | Degraded-mode grant status has no clock-skew window. | Current code enforces exact `startsAt` / `expiresAt`. That is intentionally conservative for break-glass authority because adding skew would extend emergency authority past its recorded expiry. | `accepted-limitation` |
| F8-R10 | No automated chaos drill suite was visible. | Production rehearsal tests now cover target profiles, substrate probes, consequence behavior, async recovery, backup/restore, observability, and promotion bundles. Full fault-injection chaos automation remains future work. | `partial` |
| F8-R11 | Production-shared storage blockers only appear in readiness, not startup refusal. | `startHttpServer` fails fast for `production-shared` storage blockers. F8 validation asserts the exact fail-fast blocker message. | `fixed` |
| F8-R12 | Webhook signature verification needed route-by-route proof. | Stripe, SendGrid, and Mailgun service tests assert missing or invalid signatures fail closed before mutation. The hosted runtime health contract also names signed webhook ingress as required evidence. | `fixed` |

## Corrected F8 Queue

The F8 report is closed for planned repository work in this slice.

Closed outright:

1. F8-R1 health PKI metadata redaction.
2. F8-R2 startup probe separation.
3. F8-R4 degraded-mode TTL ceiling enforcement.
4. F8-R6 worker readiness while shutting down.
5. F8-R11 production-shared startup fail-fast.
6. F8-R12 webhook signature spot checks.

Closed as bounded repository fixes, limitations, or backlog:

1. F8-R3 public health diagnostics are minimized; internal diagnostics remain in runtime/rehearsal evidence.
2. F8-R5 DLQ has a shared-store path, but live HA proof remains deployment work.
3. F8-R7 PKI bootstrap is narrowed by shared-path attestation, not solved by distributed locking.
4. F8-R8 PostgreSQL circuit-breaker policy remains backlog.
5. F8-R9 degraded grants use exact expiry by design.
6. F8-R10 production rehearsal exists; full automated fault injection remains future work.

## Go / No-Go

| Claim | Verdict |
|---|---|
| Attestor separates startup, health, and readiness probes | Holds for repository code and HA manifests. |
| Health exposes runtime signer or reviewer identity metadata | Closed; health no longer exposes those fields. |
| Production-shared can silently run with storage blockers | Closed; startup fail-fast and readiness blockers exist. |
| Degraded-mode grants can exceed their configured ceiling | Closed; grant creation rejects over-ceiling TTLs. |
| Async dead-letter recovery is HA-proven live | Do not claim. Repository shared-store path exists; live deployment proof remains external. |
| PKI bootstrap is fully HA-safe across distributed filesystems | Do not claim. Shared-path attestation exists; distributed lock / KMS-HSM remains outside this closure. |
| Full chaos engineering coverage exists | Do not claim. Production rehearsal is present; full automated fault injection remains backlog. |
| Signed webhook ingress has route-level tests | Holds for Stripe, SendGrid, and Mailgun service boundaries. |

## Validation

- `npm run test:f8-operational-resilience-validation`
- `npm run test:hosted-production-runtime-health-contract`
- `npm run test:service-stripe-webhook-service`
- `npm run test:service-email-webhook-service`
- `npm run test:production-rehearsal-async-recovery`
- `npm run test:production-rehearsal-backup-restore-dr`
- `npm run test:audit-remediation-tracker`
