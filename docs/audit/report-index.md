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
