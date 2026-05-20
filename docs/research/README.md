# Research Evidence Index

This directory records source-backed research used to shape Attestor design,
audit remediation, and readiness planning.

The canonical detailed ledger is:

- `docs/research/attestor-research-provenance-ledger.md`

That ledger is the source-index for research notes. New research should be
added here only when it materially affects a control, finding, readiness claim,
or implementation plan.

## Current Research Files

| File | Scope | Use |
|---|---|---|
| `attestor-research-provenance-ledger.md` | Research anchor -> audit/hardening gap -> repo evidence -> verification -> limitation. | Canonical research provenance ledger. |
| `cross-domain-pattern-sources.md` | Runtime assurance, STPA/FMEA, NIST AI RMF, SRE, OWASP agentic AI patterns. | AI-specific and consequence assurance design context. |
| `db-tenancy-and-distributed.md` | PostgreSQL tenancy, RLS, distributed runtime patterns. | Tenant isolation and shared-store readiness context. |
| `domains-and-pki-default.md` | Governance engines, OPA bundles, Sigstore/Fulcio, SLSA, PKI defaults. | Proof/signing/release provenance design context. |
| `oidc-and-redis-async.md` | OIDC, CLI SSO, BullMQ/Redis retry/DLQ/health patterns. | Auth/session and replay/async readiness context. |
| `schema-attestation-and-filing.md` | Schema fingerprints, pgaudit, filing-grade evidence. | Auditability and proof-surface context. |
| `cms-validation-path.md` | QRDA/CMS validation constraints and claim boundaries. | No-overclaim healthcare validation context. |
| `implementation-wave2.md` | OIDC, PKI, Redis, RLS, schema attestation, distributed deployment. | Historical implementation planning context. |
| `final-6-features.md` | OIDC/keychain, PKI verifier, Redis default, RLS activation, distributed deployment. | Historical roadmap context. |
| `ops-observability-readiness-anchors.md` | Prometheus auth files, Alertmanager receivers, Loki tenant auth, and OTel collector TLS config. | OPS-SWEEP-03 observability remediation source anchors. |

## Research Intake Rule

New research must say:

- source,
- why it applies,
- why it does not prove more than the current claim,
- affected protected principle,
- affected audit/control/finding ID,
- repository evidence or planned implementation link.

Do not cite research as a certification. Research anchors support engineering
decisions and control mapping; they do not replace tests, live proof, or
external assessment.
