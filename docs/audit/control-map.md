# Audit Control Map

This map connects Attestor's current audit evidence to external control
anchors. The anchors support control mapping only. They are not certifications
or independent assurance claims.

## External Anchors

| Anchor | How it is used | No-overclaim boundary |
|---|---|---|
| NIST SP 800-218 Secure Software Development Framework | Secure SDLC, provenance, vulnerability response, recurrence prevention, and release evidence discipline. | Does not prove SSDF conformance or government certification. |
| NIST Cybersecurity Framework 2.0 | Govern / Identify / Protect / Detect / Respond / Recover vocabulary for posture and roadmap planning. | Does not prove organizational CSF maturity. |
| OWASP SAMM | Program-level governance, implementation, verification, operations, and measurement structure. | Does not prove SAMM maturity level. |
| OWASP ASVS | Application security verification requirement vocabulary for API, auth, session, logging, and crypto controls. | Does not prove full ASVS verification. |
| CWE | Weakness taxonomy for specific finding mapping. | Does not prove exhaustive weakness coverage. |

## Current Control Areas

| Control area | Protected principle | Current repo evidence | Live proof needed | Next action |
|---|---|---|---|---|
| Current posture governance | no overclaim; auditability | `docs/audit/current-posture-baseline.md`; this evidence system. | None for repository claims; live claims still need proof. | Keep baseline updated only on material P0/P1 or readiness changes. |
| Finding lifecycle closure | auditability; no overclaim | `docs/audit/finding-lifecycle-and-evidence-ledger.md`; `scripts/check-audit-finding-evidence.mjs`; `docs/audit/ledger-template.md`. | None for repository lifecycle schema. | Keep new closed findings mapped to external anchors and tests. |
| Report/finding indexing | auditability; no overclaim | `docs/audit/report-index.md`; `docs/audit/finding-index.md`; `scripts/check-security-evidence-system.mjs`. | None for index presence. | Backfill high-signal historical P0/P1 findings as they are revalidated. |
| Live proof separation | runtime readiness; operational boundedness | `docs/audit/live-proof-register.md`; `scripts/check-ops-live-shadow-readiness.mjs`; OPS-SWEEP-07 stage-aware proof gate alignment; OPS-SWEEP-08 webhook provider proof gates; OPS-SWEEP-09 account callback/audit proof gates; OPS-SWEEP-10 pipeline idempotency proof gate; OPS-SWEEP-11 shadow mutation audit proof gate; OPS-SWEEP-12 release-route role enforcement proof gate. | HTTPS, IAM, KMS, ClusterSecretStore, WAF, replay/introspection, customer PEP, KEDA Redis TLS, KEDA Prometheus auth, admin role-key/rate-limit behavior, release-route role enforcement, webhook provider endpoint/fake-signature proof, federated callback rate-limit proof, account mutation audit-chain proof, shared auth-abuse-store proof, pipeline idempotency proof, and shadow mutation audit-chain proof. | Capture live proof artifacts without raw customer data; keep register entries aligned with the gate. |
| Release provenance | release provenance | SHA-pinned workflows, branch governance, stale branch remediation docs, PR-contract validation, supply-chain gates, CodeQL security-extended, evaluation artifact/SBOM attestation, and OPS-SWEEP-15 audit of 13 governance artifacts. | Branch protection settings for commit signatures and PR reviews remain unproven until OPS-121/122 remediation adds runtime assertions and operator GitHub-settings proof. | Extend `branch-governance.yml` to verify `required_signatures` and `required_pull_request_reviews`; operator enables settings and captures unsigned/self-merge negative proof. |
| Proof and signing authority | proof integrity; customer authority | Ed25519 verification, trusted fingerprint matching, DSSE/in-toto policy bundle evidence. | External KMS/HSM runtime signing proof. | Wire and prove KMS-backed signer before limited enforcement. |
| Token and replay safety | replay and idempotency safety | DPoP, TTL policy, freshness/replay primitives, token exchange remediation. | Multi-instance replay/introspection store proof. | Run HA replay/outage tests. |
| Service/API boundary | customer authority; tenant isolation; auditability | Edge contract, auth/MFA/session/federated auth sampled; OPS-SWEEP-06 maps the 32-route admin surface; OPS-SWEEP-08 maps and hardens the 3 inbound webhook signature surfaces; OPS-SWEEP-09 maps the 49-route account surface and adds federated callback rate limiting plus account-session mutation audit; OPS-SWEEP-10 maps the pipeline execution/async surface and adds pipeline `Idempotency-Key` replay protection; OPS-SWEEP-11 maps the 27-route shadow surface and adds shadow mutation audit plus direct HTTP route coverage; OPS-SWEEP-12 maps the 31-route release-decision surface and adds credential-bound role enforcement to release-review and release-policy-control; OPS-SWEEP-13 maps the 5-route onboarding/admission surface and verifies envelope tenant binding, plan-mode gating, agent-loop abuse throttling, protected release token issuance, and sender confirmation; OPS-SWEEP-14 maps the final 21-route verification, filing, public-site, and core surface, verifies PKI mandatory gate, release-token consume-on-success, path traversal defense, and public trust-root contract, and completes the `/api/v1/**` route-layer deep-audit chain. | Live route probes, customer PEP integration, role-scoped admin key deployment, release-route role enforcement proof, legacy superuser-key rotation, admin/webhook/account callback rate-limit abuse proof, provider webhook endpoint proof, email webhook replay-store proof, account mutation audit-chain proof, pipeline idempotency proof, shadow mutation audit-chain proof, health diagnostic split proof, and verify-route rate-limit proof. | Route-layer deep audit complete. Remediate OPS-112/113, then move to live route probes and non-route Phase 1 work: branch protection, demo safety/redaction, and test adequacy map. |
| Ops and infrastructure | runtime readiness; operational boundedness | Ops Sweep 01/02/03/04/05/06/07/08 remediation, HA manifests, observability alerting/token hardening, PITR/Redis recovery hardening, collector securityContext, observability namespace NetworkPolicy/Pod Security Admission labels, admin-route role/rate-limit hardening, release-route role enforcement, AWS HTTPS/WAF example, KEDA TLS/auth examples, webhook provider proof gates, and stage-aware live proof register gates. | Cloud/IAM/KMS/network/storage observability proof, alert delivery, backend auth/storage, PITR/Redis recovery proof, CNI/Pod Security Admission enforcement proof, budget telemetry proof, admin role-key deployment proof, release-route role enforcement proof, admin/webhook rate-limit abuse proof, provider endpoint proof, AWS HTTPS/WAF proof, and KEDA scaler proof. | Continue ops sweep with remaining provider/live proof surfaces and capture live proof artifacts before stronger runtime claims. |
| PITR/Redis recovery | runtime readiness; replay and idempotency safety; operational boundedness | `ops/postgres/pitr/archive-wal.sh`, `ops/postgres/pitr/restore-wal.sh`, `ops/redis/redis-recovery.conf`, `docker-compose.dr.yml`, and OPS-SWEEP-04 remediation. | Offsite WAL object-store durability, base backup scheduling, restore drill, Redis ACL/network isolation, and secret rotation proof. | Capture live DR evidence before limited enforcement or stronger recovery claims. |
| Public demo safety | data minimization and redaction; no overclaim | Baseline flags demo path traversal and redaction gaps. | Demo artifact privacy crawl before public use. | Revalidate/fix demo CLI path and redaction fixtures. |

## Update Rule

When a PR changes a control claim:

1. update the relevant evidence doc,
2. update `finding-index.md` if a finding state changed,
3. update `live-proof-register.md` if live proof is still needed,
4. update this map if the external anchor or control claim changed,
5. state what the PR does not prove.
