# Audit Report Index

This index tracks audit and posture reports as report artifacts. It does not
replace per-finding evidence records. Its purpose is to keep report state,
remediation PRs, and remaining proof gaps findable from one place.

## Status Labels

- `open`: unresolved repository evidence gap remains.
- `closed`: repository evidence shows the report's remediable findings are
  closed.
- `live-proof-only`: repository-side remediation is complete, but deployment
  proof remains outside the repository.
- `superseded`: later report or baseline replaces this report as the current
  posture source.
- `partial`: report was inspected but not fully remediated or not fully indexed.

## Current Operating Reports

| Report ID | Source / scope | Source HEAD | Report state | Remediation evidence | Remaining proof / next action |
|---|---|---|---|---|---|
| `POSTURE-BASELINE-2026-05-20` | Calibrated posture consolidation and execution baseline. | `f92c905984292eafa469e00af2ae54082763cd53` | `partial` | `docs/audit/current-posture-baseline.md`; this index layer. | Keep baseline current only on material P0/P1 or readiness changes. |
| `OPS-SWEEP-01` | Live shadow ops audit: Kubernetes HA API/worker, External Secrets, Gateway, Cloud Armor, compose. | `d842737fababc66687ed9fa1b500a52897d6cc01` | `live-proof-only` | `docs/audit/ops-sweep-01-live-shadow-remediation.md`; PRs `#504`, `#505`. | Live proof flags for HTTPS, ClusterSecretStore, NetworkPolicy, WAF, IAM. |
| `OPS-SWEEP-02` | PKI / TLS / secrets / Sweep 01 verification. | `0ad50fd22270a13bc340e87b5d8b5bb0bd85ba03` | `live-proof-only` | `docs/audit/ops-sweep-02-pki-tls-secrets-remediation.md`; PR `#506`; merge `f92c905984292eafa469e00af2ae54082763cd53`. | Live proof for release runtime PKI StorageClass and selected TLS material source. |
| `OPS-SWEEP-03` | Observability, kill-switch visibility, telemetry data minimization, and alert routing. | `f92c905984292eafa469e00af2ae54082763cd53` | `live-proof-only` | `docs/audit/ops-sweep-03-observability-remediation.md`. | Live proof for alert delivery, managed backend auth/storage, budget telemetry, and telemetry redaction. |
| `OPS-SWEEP-04` | PostgreSQL PITR, Redis recovery, observability collector deployment, and Sweep 03 chain effects. | `300a6cda236e6d85d858b3a6eae3ebb1f7262e5b` | `live-proof-only` | `docs/audit/ops-sweep-04-storage-collector-remediation.md`. | Live proof for offsite PITR/base backup/restore, Redis isolation/auth rotation, Pod Security Admission, and observability backend reachability. |
| `OPS-SWEEP-05` | Collector resilience, audit-index verification, and Sweep 04 discrepancy check. | `78e79a2208401dc140941af48a61baef97b7d1b9` | `live-proof-only` | `docs/audit/ops-sweep-05-collector-resilience-audit-verification.md`; `ops/kubernetes/observability/networkpolicy.yaml`; `scripts/check-ops-live-shadow-readiness.mjs`. | Live proof for observability namespace NetworkPolicy/CNI enforcement, Pod Security Admission enforcement, and any managed backend namespace/egress override. |
| `OPS-SWEEP-06` | Admin route authorization deep audit and remediation. | `bce83297395dd1c8e8467b3c322e3dcfd3b14f4c` | `live-proof-only` | `docs/audit/ops-sweep-06-admin-route-authorization-deep-audit.md`; `src/service/http/routes/admin-routes.ts`; `src/service/request-context.ts`; `tests/service-admin-routes-http.test.ts`. | Live proof for role-scoped admin key deployment, legacy superuser-key rotation, and admin auth rate-limit behavior under abuse traffic. |
| `OPS-SWEEP-07` | Profiles, provider overlays, and live proof capture remediation. | `1ea495a39ff06d4ce9ff009234ee70d1d911054d` | `live-proof-only` | `docs/audit/ops-sweep-07-profiles-provider-overlays-live-proof-capture.md`; `scripts/check-ops-live-shadow-readiness.mjs`; `ops/kubernetes/ha/providers/aws/alb-ingress.https.example.yaml`; `ops/kubernetes/ha/providers/keda/*.example.yaml`; `tests/ops-live-shadow-readiness.test.ts`; `tests/kubernetes-ha-bundle.test.ts`; `tests/kubernetes-observability-bundle.test.ts`. | Live proof for expanded proof flags, AWS HTTPS/WAF, KEDA Redis TLS, KEDA Prometheus auth, and all existing live-cloud/storage/runtime proof entries. |
| `OPS-SWEEP-08` | Webhook signature verification deep audit and remediation for Stripe, SendGrid, and Mailgun inbound provider callbacks. | `f4009b1acaf3dc88529cb05d7ce7e75e196643d8` | `live-proof-only` | `docs/audit/ops-sweep-08-webhook-signature-verification-deep-audit.md`; `src/service/application/email-webhook-service.ts`; `src/service/{mailgun-email-webhook,sendgrid-email-webhook,webhook-rate-limit}.ts`; `scripts/check-ops-live-shadow-readiness.mjs`; `tests/service-email-webhook-{service,signature-verifiers}.test.ts`; `tests/service-webhook-route-rate-limit.test.ts`. | Live proof for Stripe/SendGrid/Mailgun provider endpoint binding, fake-signature probes, source-IP/rate-limit behavior, and multi-instance email webhook replay-store behavior. |
| `OPS-SWEEP-09` | Account routes authorization deep audit and P1 remediation for federated callback rate limiting and account-session mutation audit. | `906f685faa93cf0b4cb1ca16ca81635a30c31704` | `partial` | `docs/audit/ops-sweep-09-account-routes-authorization-deep-audit.md`; `src/service/http/routes/account-routes.ts`; `src/service/admin-audit-log.ts`; `src/service/bootstrap/http-route-builders.ts`; `tests/service-account-routes-authorization.test.ts`; `scripts/check-ops-live-shadow-readiness.mjs`. | P1 repo-side remediation is live-proof-only; OPS-81/82/83/85 remain follow-up findings. Capture callback rate-limit, account audit-chain, and shared auth-abuse-store live proofs. |
| `OPS-SWEEP-10` | Pipeline execution + async routes authorization deep audit and OPS-86 idempotency remediation. | `a7e0073d8ed6bf72ab6ea797859d8243b9388130` | `partial` | `docs/audit/ops-sweep-10-pipeline-execution-async-deep-audit.md`; `src/service/pipeline-idempotency-store.ts`; `src/service/application/pipeline-idempotency-service.ts`; `src/service/control-plane-store.ts`; `src/service/http/routes/pipeline-{execution,async}-routes.ts`; `tests/service-pipeline-routes-idempotency.test.ts`; `scripts/check-ops-live-shadow-readiness.mjs`. | OPS-86 is repo-side closed and live-proof-only. Capture `ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF`; OPS-87/88/89/90/92 remain follow-up findings and OPS-91 remains an accepted limitation. |
| `OPS-SWEEP-11` | Shadow routes authorization deep audit and P1 remediation for shadow mutation audit plus direct HTTP route coverage. | `765b2518257cdd69dc1293937588ba211cfb8b76` | `partial` | `docs/audit/ops-sweep-11-shadow-routes-authorization-deep-audit.md`; `src/service/http/routes/shadow-routes.ts`; `src/service/bootstrap/routes.ts`; `src/service/admin-audit-log.ts`; `tests/service-shadow-routes-http.test.ts`; `scripts/check-ops-live-shadow-readiness.mjs`. | OPS-93 is repo-side closed and live-proof-only; OPS-94 is closed. Capture `ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF`; OPS-95/96/97/98/99 remain follow-up findings. |
| `OPS-SWEEP-12` | Release-review + release-policy-control routes deep audit and OPS-100 role-scoped admin enforcement remediation. | `c839b0bf453dd6cbaffa67d2957c76975ca13c47` | `partial` | `docs/audit/ops-sweep-12-release-routes-deep-audit.md`; `src/service/http/release-admin-authorization.ts`; `src/service/http/routes/release-review-routes.ts`; `src/service/http/routes/release-policy-control-routes.ts`; `tests/release-policy-control-plane-admin-routes.test.ts`; `tests/release-review-admin-routes.test.ts`; `scripts/check-ops-live-shadow-readiness.mjs`. | OPS-100 is repo-side closed and live-proof-only. Capture `ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF`; OPS-101/102/103 remain follow-up findings, OPS-104 remains accepted, and OPS-105 is narrowed cleanup. |

## Historical Audit Families

These files remain historical evidence. They are not automatically current
truth unless their finding appears in `finding-index.md` with current
repository evidence.

| Family | Evidence location | Current indexing state | Notes |
|---|---|---|---|
| F-series validations | `docs/audit/f*.md` | `partial` | Historical validation docs; keep linked through research and tracker evidence. |
| v0.2.0 remediation notes | `docs/audit/v0.2.0-*.md` | `partial` | Historical closure notes; important findings should be promoted into `finding-index.md`. |
| Audit IDs / aliases | `docs/audit/audit-id-alias-registry.md` | `active` | Use for canonical ID reconciliation. |
| Lifecycle / ledger schema | `docs/audit/finding-lifecycle-and-evidence-ledger.md`; `docs/audit/ledger-template.md` | `active` | Controls required closure evidence fields. |

## Intake Rule For New Reports

Every new external or agent-generated report must add or update one row here
before it is considered integrated into the operating baseline.

Minimum row evidence:

- report ID,
- source or scope,
- current `origin/master` HEAD used for validation,
- report state,
- remediation evidence or explicit no-fix decision,
- remaining proof or next action.
