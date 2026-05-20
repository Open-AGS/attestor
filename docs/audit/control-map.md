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
| Live proof separation | runtime readiness; operational boundedness | `docs/audit/live-proof-register.md`; `scripts/check-ops-live-shadow-readiness.mjs`. | HTTPS, IAM, KMS, ClusterSecretStore, WAF, replay/introspection, customer PEP. | Capture live proof artifacts without raw customer data. |
| Release provenance | release provenance | SHA-pinned workflows, branch governance, stale branch remediation docs. | Branch protection settings for commit signatures and PR reviews. | Enable and verify branch-protection controls. |
| Proof and signing authority | proof integrity; customer authority | Ed25519 verification, trusted fingerprint matching, DSSE/in-toto policy bundle evidence. | External KMS/HSM runtime signing proof. | Wire and prove KMS-backed signer before limited enforcement. |
| Token and replay safety | replay and idempotency safety | DPoP, TTL policy, freshness/replay primitives, token exchange remediation. | Multi-instance replay/introspection store proof. | Run HA replay/outage tests. |
| Service/API boundary | customer authority; tenant isolation; auditability | Edge contract, auth/MFA/session/federated auth sampled; OPS-SWEEP-06 maps the 32-route admin surface, adds role-scoped admin credentials, route role allowlists, admin actor-role audit fields, admin auth rate limiting, HTTP route tests, JSON body fail-closed parsing, and list caps. | Live route probes, customer PEP integration, role-scoped admin key deployment, legacy superuser-key rotation, and admin auth rate-limit abuse proof. | Continue public route authZ and live route probes; keep admin read-audit and response key-material limitations visible. |
| Ops and infrastructure | runtime readiness; operational boundedness | Ops Sweep 01/02/03/04/05/06 remediation, HA manifests, observability alerting/token hardening, PITR/Redis recovery hardening, collector securityContext, observability namespace NetworkPolicy/Pod Security Admission labels, admin-route role/rate-limit hardening, and live proof register entries. | Cloud/IAM/KMS/network/storage observability proof, alert delivery, backend auth/storage, PITR/Redis recovery proof, CNI/Pod Security Admission enforcement proof, budget telemetry proof, admin role-key deployment proof, and admin rate-limit abuse proof. | Continue ops sweep with remaining profiles, provider overlays, and live proof capture. |
| PITR/Redis recovery | runtime readiness; replay and idempotency safety; operational boundedness | `ops/postgres/pitr/archive-wal.sh`, `ops/postgres/pitr/restore-wal.sh`, `ops/redis/redis-recovery.conf`, `docker-compose.dr.yml`, and OPS-SWEEP-04 remediation. | Offsite WAL object-store durability, base backup scheduling, restore drill, Redis ACL/network isolation, and secret rotation proof. | Capture live DR evidence before limited enforcement or stronger recovery claims. |
| Public demo safety | data minimization and redaction; no overclaim | Baseline flags demo path traversal and redaction gaps. | Demo artifact privacy crawl before public use. | Revalidate/fix demo CLI path and redaction fixtures. |

## Update Rule

When a PR changes a control claim:

1. update the relevant evidence doc,
2. update `finding-index.md` if a finding state changed,
3. update `live-proof-register.md` if live proof is still needed,
4. update this map if the external anchor or control claim changed,
5. state what the PR does not prove.
