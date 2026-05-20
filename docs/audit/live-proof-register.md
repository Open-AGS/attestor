# Live Proof Register

This register tracks evidence that cannot be closed by repository changes
alone. A proof listed here remains `needs live test` or `needs ops proof` until
the live environment, cloud control plane, or customer integration produces
verifiable evidence.

Do not mark these items closed from documentation-only remediation.

## Proof Status Labels

- `required`: required before the named readiness stage.
- `repo-gated`: repository contains a check or flag requiring operator proof.
- `captured`: live evidence captured and linked.
- `blocked`: cannot run because a dependency is missing.
- `not applicable`: explicitly not required for the current phase.

## Current Live Proofs

| Proof ID | Readiness stage | Status | Required evidence | Repo gate / evidence | Current limitation |
|---|---|---|---|---|---|
| `LP-HTTPS-EDGE` | Live shadow | `repo-gated` | HTTPS listener or cloud load balancer TLS termination probe, including redirect/cleartext denial. | `scripts/check-ops-live-shadow-readiness.mjs`; `ATTESTOR_LIVE_SHADOW_HTTPS_PROOF`. | Active repo gateway may remain HTTP when TLS is proven by cloud LB. |
| `LP-CLUSTER-SECRET-STORE` | Live shadow | `repo-gated` | External Secrets `ClusterSecretStore` backend type, Workload Identity binding, and Secret Manager/Vault access audit. | `ATTESTOR_CLUSTER_SECRET_STORE_PROOF`; GKE example in ops provider docs. | Backend is environment-specific and not committed. |
| `LP-NETWORK-POLICY` | Live shadow | `repo-gated` | Applied default-deny and explicit allowlist NetworkPolicies verified in cluster. | `ATTESTOR_NETWORK_POLICY_PROOF`; `ops/kubernetes/ha/networkpolicy.yaml`; `ops/kubernetes/observability/networkpolicy.yaml`. | CNI enforcement must be proven in the live cluster, including any managed observability backend egress override. |
| `LP-EDGE-WAF` | Live shadow | `repo-gated` | Cloud Armor or equivalent edge WAF policy attached with intended rules. | `ATTESTOR_EDGE_WAF_PROOF`; active backend policy references Cloud Armor name. | Cloud Armor rule definition is outside the repo. |
| `LP-GCP-IAM-LEAST-PRIVILEGE` | Live shadow | `repo-gated` | GCP IAM role list for runtime, worker, External Secrets, and Cloud SQL access. | `ATTESTOR_GCP_IAM_LEAST_PRIVILEGE_PROOF`. | IAM policy is live cloud state. |
| `LP-RUNTIME-PKI-STORAGE` | Live shadow | `repo-gated` | Release runtime PKI StorageClass, encryption-at-rest, access mode, and backup/restore boundary proof. | `ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF`; PKI PVC annotations. | StorageClass and encryption are cluster facts. |
| `LP-TLS-MATERIAL-SOURCE` | Live shadow | `repo-gated` | One selected TLS material path: cert-manager OR External Secrets, not both. | `ATTESTOR_TLS_MATERIAL_SOURCE_PROOF`; provider README contracts. | Operator must prove selected path in the live overlay. |
| `LP-SHARED-REPLAY-STORE` | Live shadow / limited enforcement | `required` | Multi-instance replay and nonce rejection across API replicas with Redis/Postgres backing. | Baseline and token/replay posture. | In-memory fallback cannot prove HA replay safety. |
| `LP-SHARED-INTROSPECTION-STORE` | Limited enforcement | `required` | Introspection cache/store behavior under restart, outage, and stale-token scenarios. | Release-enforcement primitives and live ops gate. | Requires deployed shared backing services. |
| `LP-CUSTOMER-PEP-NO-BYPASS` | Limited enforcement | `required` | Reference customer PEP integration where direct downstream bypass fails. | Baseline P0 blocker. | Repository middleware alone cannot prove customer deployment enforcement. |
| `LP-KMS-RUNTIME-SIGNING` | Limited enforcement / enterprise pilot | `required` | KMS/HSM-backed signing proof, key authority binding, and no raw private key export path. | Baseline P0 blocker; PKI PVC boundary docs. | File/PVC signing remains insufficient for production authority claims. |
| `LP-DEGRADED-MODE-OUTAGE` | Limited enforcement | `required` | Provider/Redis/Vault/DB outage test proving fail-closed or bounded degraded behavior. | Degraded-mode repo hardening. | Static checks do not prove live outage behavior. |
| `LP-OBSERVABILITY-ALERT-DELIVERY` | Live shadow | `repo-gated` | End-to-end Alertmanager delivery to at least one warning and one critical receiver, plus Watchdog route validation. | OPS-SWEEP-03 remediation; Alertmanager renderer/probe scripts. | Static receiver config and render tests do not prove an external pager/webhook receives alerts. |
| `LP-OBSERVABILITY-BACKEND-AUTH` | Live shadow | `repo-gated` | Loki/managed backend auth boundary, tenant header behavior, and namespace/network access proof. | Local Loki auth enabled; OTel/Grafana `X-Scope-OrgID` contract. | Managed backend or live cluster auth behavior is environment-specific. |
| `LP-OBSERVABILITY-STORAGE` | Live shadow / limited enforcement | `required` | Loki/Tempo storage backend, encryption-at-rest, retention, and backup/restore proof. | OPS-SWEEP-03 documentation and retention env wiring. | Local filesystem backends are evaluation/shadow rehearsal only. |
| `LP-BUDGET-ALERTING` | Live shadow | `repo-gated` | Cloud budget telemetry source and alert delivery proof. | `AttestorBudgetTelemetryMissing` alert makes absence visible. | Real GCP billing budget integration is live cloud state. |
| `LP-POSTGRES-PITR-OFFSITE` | Live shadow / limited enforcement | `required` | PostgreSQL base backup, offsite WAL archive, checksum verification, encryption-at-rest, and restore-drill evidence. | OPS-SWEEP-04 adds offsite WAL archive hooks and checksum verification. | Repository scripts do not prove offsite object-store durability or a successful live restore. |
| `LP-REDIS-AUTH-BOUNDARY` | Live shadow / limited enforcement | `repo-gated` | Redis ACL/password policy, network isolation, secret rotation, and replay/idempotency behavior under restart. | OPS-SWEEP-04 hardens the DR reference config and compose path. | Managed Redis behavior and cluster reachability are live environment facts. |
| `LP-OBSERVABILITY-POD-SECURITY` | Live shadow | `repo-gated` | Pod Security Admission or equivalent runtime proof that collector securityContext constraints are enforced. | OPS-SWEEP-04 adds collector non-root/seccomp/no-privilege-escalation/read-only-rootfs manifest evidence; OPS-SWEEP-05 adds restricted Pod Security Admission namespace labels. | Node/runtime enforcement is not proven by YAML alone. |

## Capture Rule

Each captured proof must include:

- environment name,
- timestamp,
- command or probe,
- redacted output artifact,
- responsible operator,
- no-raw-data confirmation,
- remaining limitation.

Captured proof should be linked from this file, not pasted with secrets or raw
customer data.
