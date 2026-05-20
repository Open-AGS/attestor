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
| Service/API boundary | customer authority; tenant isolation | Edge contract, auth/MFA/session/federated auth sampled; admin route gap remains. | Live route probes and customer PEP integration. | Deep audit admin routes and public route authZ. |
| Ops and infrastructure | runtime readiness; operational boundedness | Ops Sweep 01/02/03 remediation, HA manifests, observability alerting/token hardening, and live proof register entries. | Cloud/IAM/KMS/network/storage observability proof, alert delivery, backend auth/storage, and budget telemetry proof. | Continue ops sweep with PITR/Redis/recovery and remaining observability deployment internals. |
| Public demo safety | data minimization and redaction; no overclaim | Baseline flags demo path traversal and redaction gaps. | Demo artifact privacy crawl before public use. | Revalidate/fix demo CLI path and redaction fixtures. |

## Update Rule

When a PR changes a control claim:

1. update the relevant evidence doc,
2. update `finding-index.md` if a finding state changed,
3. update `live-proof-register.md` if live proof is still needed,
4. update this map if the external anchor or control claim changed,
5. state what the PR does not prove.
