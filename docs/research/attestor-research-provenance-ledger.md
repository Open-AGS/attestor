# Attestor Research Provenance Ledger

This document organizes Attestor's research anchors, audit findings, repository evidence, tests, contracts, and documented limitations as they relate to hardening work. It is not a certification, not an independent external audit, and not a claim of full production readiness.

Attestor's engineering method is AI-assisted, research-backed, audit-driven assurance engineering:

```text
research anchor -> audit or hardening gap -> repository evidence -> implemented control -> verification -> limitation or no-go
```

This ledger uses only repository history, merged PR evidence, current source/docs/tests, and recorded research notes. It does not invent sources. If a hardening step did not require an external source, the entry says `External anchor: not required / repository-internal hardening evidence only.` If evidence was not found in the inspected repo or PR record, the entry says `not recorded` or `not proven`.

## Protected Principles

- proof integrity
- fail-closed boundary
- tenant isolation
- customer authority
- data minimization and redaction
- no overclaim
- runtime readiness
- release provenance
- auditability
- replay/idempotency safety
- operational boundedness

## Evidence Types

- Research anchor evidence: external or repository-recorded source material used as an engineering anchor.
- PR/commit evidence: merged PR number, commit hash, merge date, or implementation commit.
- Code evidence: source files implementing the control.
- Test evidence: focused tests, package scripts, CI gates, or probes.
- Contract/documentation evidence: README, OpenAPI, tracker, readiness, or architecture docs.
- Limitation evidence: explicit non-claim, no-go, or blocked condition.

## Recorded Research Source Index

This index records research and buildout sources found in the repository. A source being listed here does not mean every later PR or commit consumed that source. Exact commit attribution is only asserted in the detailed entries where PR, commit, docs, and tests support that mapping.

### Repository Research Notes

| Source | Recorded scope | Trust surfaces / protected principles | Mapping status |
|---|---|---|---|
| `docs/research/db-tenancy-and-distributed.md` | PostgreSQL shared-schema RLS, schema-per-tenant, project-per-tenant, Drizzle RLS, Hono/BullMQ/Inngest/Temporal deployment patterns, Railway/Fly deployment choices. | tenant isolation; runtime readiness; operational boundedness. | Source-indexed. Used as repository research evidence for tenant and distributed-runtime work where referenced by tracker or PR evidence. |
| `docs/research/domains-and-pki-default.md` | Multi-domain governance engines, OPA bundles, dbt/GX, OSCAL, healthcare/insurance governance, Sigstore/Fulcio, SLSA provenance, PKI-by-default transition. | proof integrity; release provenance; auditability; no overclaim. | Source-indexed. Used as repository research evidence for domain governance and PKI/default-verifier work where referenced by tracker or PR evidence. |
| `docs/research/final-6-features.md` | OIDC/keychain, PKI mandatory verify, Redis default, PostgreSQL RLS activation, distributed deployment, QRDA III healthcare feasibility. | customer authority; proof integrity; tenant isolation; runtime readiness; no overclaim. | Source-indexed roadmap research; not every item has a commit-level implementation mapping in this ledger. |
| `docs/research/implementation-wave2.md` | OIDC session, PKI default verifier, Redis-backed BullMQ default, PostgreSQL RLS, schema attestation, distributed deployment, healthcare eCQM measures. | customer authority; proof integrity; tenant isolation; runtime readiness; auditability. | Source-indexed implementation research; exact per-commit mapping is not recorded for every item. |
| `docs/research/oidc-and-redis-async.md` | `openid-client` v6, CLI SSO patterns, token/keychain handling, BullMQ v5 retry/DLQ/health/rate-limit rules, embedded Redis constraints. | customer authority; runtime readiness; replay/idempotency safety; operational boundedness. | Source-indexed; async/webhook hardening entries use BullMQ guidance where tracker evidence records it. |
| `docs/research/schema-attestation-and-filing.md` | PostgreSQL/Snowflake schema fingerprints, pgaudit, dbt contracts, SEC EDGAR/iXBRL, EBA DPM/xBRL-CSV, filing-grade evidence. | proof integrity; auditability; no overclaim; release provenance. | Source-indexed finance and filing research; exact per-commit mapping is not recorded for every item. |
| `docs/research/cms-validation-path.md` | QRDA III validation, CMS Schematron, Cypress CVU+ constraints, honest claim boundary for "CMS-validatable" output. | no overclaim; proof integrity; auditability. | Source-indexed healthcare validation research; no production-readiness claim. |

### Recorded Audit And Truth-Source Notes

| Source | Recorded scope | Trust surfaces / protected principles | Mapping status |
|---|---|---|---|
| `docs/01-overview/hosted-product-flow-audit.md` | Hosted account, API key, usage, billing, Stripe, entitlement, adoption flow, truth sources, runtime routes, service boundaries, tests/probes, and hardening gaps. | runtime readiness; customer authority; no overclaim; replay/idempotency safety; auditability. | Audit-indexed. Used as context for hosted product hardening, but exact per-PR mapping is not expanded in this ledger. |

### Buildout Trackers With Recorded Research Anchors

| Source | Recorded anchors / scope | Current recorded status | Mapping status |
|---|---|---|---|
| `docs/02-architecture/release-layer-buildout.md` | Modular monolith vs strangler extraction, release kernel, risk controls, OPA/Cedar-style policy design, decision logs, canonicalization, JOSE, RFC 6750/7662/7009, SLSA/in-toto, rollout controls. | Complete: 24/24 frozen steps. | Tracker-level research and implementation evidence; exact PR mapping is not expanded for every step in this ledger. |
| `docs/02-architecture/release-policy-control-plane-buildout.md` | OPA bundles/discovery, Amazon Verified Permissions policy stores, Kubernetes admission good practices, signed bundle lifecycle, simulation, activation, audit, approvals, rollback. | Complete: 20/20 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/release-enforcement-plane-buildout.md` | NIST SP 800-207 PEP/PDP/PAP separation, Istio/Envoy external authorization, Kubernetes admission, RFC 7662/7009/8693/9449/8705/9421, SPIFFE/SPIRE, Sigstore, GitHub attestations, SCITT. | Complete: 20/20 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/proof-console-buildout.md` | Proof/adoption credibility research, SEC/iXBRL/EDGAR, EIP-7702, x402, ERC-4337, Safe guards, W3C VC, CloudEvents, OpenTelemetry, NIST AI RMF, SLSA/in-toto, JSON Schema, README/style/Diataxis guidance. | Complete: 8/8 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/consequence-admission-buildout.md` | NIST AI RMF, MCP authorization, x402, runtime guardrails, SEC EDGAR, OPA decision logs, RFC 8785, ERC-4337, EIP-7702, ERC-6900, RFC 9457, OpenAPI 3.1.1. | Complete: 6/6 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/hosted-product-flow-buildout.md` | Stripe Checkout, Customer Portal, subscription webhooks, Entitlements, idempotency, webhook signatures, OpenAPI, OAuth bearer auth, OWASP API risks, SEC/iXBRL, EIP-712/ERC-1271/ERC-4337/EIP-7702 positioning. | Complete: 8/8 frozen steps. | Tracker-level research and implementation evidence; live deployment remains separate. |
| `docs/02-architecture/production-runtime-hardening-buildout.md` | Runtime profile matrix, durable stores, restart/recovery, readiness endpoint checks, production-shared boundary, anti-overclaim language. | Complete: 8/8 frozen steps. | Tracker-level research and implementation evidence; customer-operated production remains unproven without target probes. |
| `docs/02-architecture/production-shared-authority-plane-buildout.md` | PostgreSQL transaction isolation, `ON CONFLICT`, advisory locks, `SKIP LOCKED`, LISTEN/NOTIFY, WAL reliability, Redis persistence, node-postgres pooling/transactions, Kubernetes probes, libpq URLs. | Complete: 9/9 frozen steps. | Tracker-level research and implementation evidence; external production inputs still required. |
| `docs/02-architecture/production-rehearsal-buildout.md` | NIST SSDF, SLSA artifact provenance, GitHub artifact attestations, Kubernetes production guidance, PostgreSQL HA, BullMQ production guidance, OWASP API Security Top 10. | Complete: 10/10 frozen steps. | Tracker-level rehearsal evidence; not market validation or independent compliance approval. |
| `docs/02-architecture/hosted-production-trust-hardening.md` | OWASP API/LLM/Agentic risks, NIST SSDF, SLSA, GitHub attestations, Kubernetes probes, Stripe go-live/idempotency/webhooks, BullMQ retries, OpenAI agent safety, Google SRE, OpenTelemetry, OWASP logging, NIST incident response. | Steps 01-07 complete; Steps 08-09 not started; Step 10 blocked. | Detailed entries map Steps 01, 03, 05, 06, and 07 to PR/commit evidence. |
| `docs/02-architecture/action-surface-profiler.md` | OpenAPI paths/operations/tags, AsyncAPI channels/operations/messages, MCP tools, GitHub Actions workflows/jobs/steps, provider logs, and manual action inventories as machine-readable discovery surfaces. | Initial contract added for repo-side data-minimized action surface discovery; live provider ingestion, parser generation, and downstream gateway generation remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the action-surface profiler PR is merged. |
| `docs/02-architecture/action-surface-declaration-ingestors.md` | OpenAPI paths and operations, AsyncAPI operations/channels, MCP tool definitions, and GitHub Actions jobs/steps as existing customer metadata that can be normalized into action-surface declarations. | Initial repo-side ingestors added for parsed metadata only; YAML parsing, live provider discovery, generated gateway configs, and non-bypassable enforcement remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the declaration ingestors PR is merged. |
| `docs/02-architecture/action-surface-manifest-intake.md` | `js-yaml` YAML parsing, JSON parsing, OpenAPI/AsyncAPI/MCP/workflow manifest detection, bounded manifest size, and digest-first manifest handling. | Initial repo-side JSON/YAML manifest intake added; live provider discovery, generated gateway configs, and non-bypassable enforcement remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the manifest intake PR is merged. |
| `docs/02-architecture/action-surface-integration-artifacts.md` | Envoy `ext_authz`, NGINX `auth_request`, Istio `CUSTOM` external authorization, MCP tool gateway patterns, provider-native delegation, credential isolation, Policy Twin backtests, and red-team replay fixtures. | Initial repo-side review-draft artifact generator added for profiler output; production deployment, credential issuance, provider activation, reviewed artifact evidence, and non-bypassable enforcement remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the integration artifact PR is merged. |
| `docs/02-architecture/action-surface-onboarding-packet.md` | OpenAPI machine-readable operation inventory, Backstage Software Templates style scaffolding, Terraform `plan` / `apply` separation, in-toto digest-linked evidence patterns, and Attestor review-gated readiness contracts. | Initial repo-side digest-first onboarding packet added for manifest/declaration/profiler/artifact/readiness composition; hosted route, UI wizard, credential issuance, production deployment, and scoped enforcement activation remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the onboarding packet PR is merged. |
| `docs/02-architecture/policy-foundry-onboarding.md` | AWS IAM Access Analyzer, Google IAM Recommender, Cedar/AWS Verified Permissions, OPA decision logs/tests, NIST SP 800-162 ABAC, ABAC policy mining research, Stripe onboarding, Auth0 progressive profiling, LaunchDarkly/OpenFeature rollout patterns, Zanzibar/OpenFGA relationship context. | Policy Foundry readiness, red-team replay, active-question, and no-go contracts are implemented for repo-side evaluation scope; live UI/commercial entitlement and live adversarial executor remain not proven. | Architecture research tracker and implementation evidence; exact source-to-commit attribution is not expanded for every Policy Foundry step. |
| `docs/02-architecture/integration-mode-readiness.md` | AWS IAM Access Analyzer, Google IAM Recommender, Cedar/AWS Verified Permissions, OPA decision logs, Envoy `ext_authz`, Istio `CUSTOM` authorization, NGINX `auth_request`, Kubernetes admission controllers, Vault dynamic secrets, Google downscoped credentials, AWS STS session policies, provider-native delegation, MCP authorization, agent runtime guardrail patterns. | Initial contract added for repo-side onboarding automation and bypass-risk classification; live gateway/proxy generation, credential issuance, and production deployment remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the integration-mode readiness PR is merged. |
| `docs/02-architecture/crypto-authorization-core-buildout.md` | EIP-712, EIP-191, ERC-5267, ERC-7739, ERC-1271, EIP-6492, ERC-4337, ERC-7562, EIP-5792, ERC-7715, ERC-7579, ERC-6900, EIP-2, EIP-7702, ERC-7902, Safe, x402, EIP-3009, custody policy, package exports, CAIP identifiers, Chainalysis risk data. | Complete: 20/20 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/crypto-execution-admission-buildout.md` | EIP-5792, ERC-7715, ERC-7902, ERC-1271, ERC-4337, ERC-7769, ERC-7579, ERC-6900, EIP-7702, Safe guards, x402, Fireblocks, Turnkey, ERC-7683 and intent routing. | Complete: 12/12 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/crypto-intelligence-buildout.md` | ERC-4337, ERC-7562, EIP-7702, ERC-7683, x402, Safe guards, Turnkey, Fireblocks, Chainalysis risk reporting, NIST AI RMF, OpenTelemetry, CloudEvents, W3C PROV, OFAC data boundaries, Node perf/crypto, package exports. | Complete: 10/10 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/crypto-engine-hardening-ii.md` | ERC-4337, ERC-7562, ERC-7579, EIP-7702, x402, Safe guards, OPA decision logs, AWS IAM deny precedence, Grafana dashboard guidance, OpenTelemetry limits, Node perf/crypto, package exports, NIST Privacy Framework, OWASP logging, GDPR, NIST AI RMF, `@noble/hashes`, Node 26 runtime baseline. | Steps 01-09 implemented; Step 10 blocked on production rollout infrastructure. | Tracker-level research and implementation evidence; Node 26 and production rollout remain no-go until conditions pass. |

## Entries

### 1. Hosted API Authorization Matrix And Async Job Ownership

- Step / PR / commit: Hosted Production Trust Hardening Step 01; PR #210; commit `d1f28d9c333105ab8b3a51d3181b212bd48bdb2d`.
- Date if available: 2026-05-11.
- Trust surface: hosted API route authorization, tenant/account/object authorization, async job status ownership.
- Protected principle: tenant isolation; customer authority; fail-closed boundary; auditability.
- Research anchor / source used, if recorded: `docs/02-architecture/hosted-production-trust-hardening.md` records OWASP API Security Top 10 2023 for BOLA/BFLA, NIST SSDF SP 800-218 for verified implementation, and hosted-route research anchors reviewed on 2026-05-11.
- Repository evidence:
  - Code evidence: `src/service/hosted-api-authorization-matrix.ts`, `src/service/http/routes/pipeline-async-routes.ts`.
  - Test evidence: `tests/hosted-api-authorization-matrix.test.ts`, `tests/package-script-runner.test.ts`.
  - Contract/documentation evidence: `docs/01-overview/hosted-journey-contract.md`, `docs/02-architecture/hosted-production-trust-hardening.md`, `package.json`.
  - PR evidence: PR #210 title `Add hosted API authorization matrix`.
- Implemented control: Adds a machine-readable route authorization matrix for public metadata, credential challenge, account plane, tenant runtime, signed webhooks, shadow control, and operator admin routes. The async job status route now hides cross-tenant jobs for both in-process and BullMQ-backed status reads.
- Tests / verification: `npm run test:hosted-api-authorization-matrix`; package runner exposure through `tests/package-script-runner.test.ts`; GitHub PR checks recorded on the merged PR.
- Remaining limitation or no-go condition: Repo-side route authorization evidence does not prove a customer-operated deployment target, external Redis/PostgreSQL, or live production traffic behavior.
- Status: complete, repo-side hardening.

### 2. Webhook Replay, Idempotency, And Async Reconciliation

- Step / PR / commit: Hosted Production Trust Hardening Step 03; PR #212; commit `0a018431e5b76b5568f3f4de10f39a41abbbb4e8`.
- Date if available: 2026-05-12.
- Trust surface: Stripe webhook ingress, billing convergence, provider-event ordering, async queue reconciliation, dead-letter recovery.
- Protected principle: replay/idempotency safety; fail-closed boundary; operational boundedness; data minimization and redaction.
- Research anchor / source used, if recorded: `docs/02-architecture/hosted-production-trust-hardening.md` records Stripe idempotent requests, Stripe webhooks, Stripe webhook signatures, BullMQ retry/stalled-job guidance, OWASP API4/API6, and NIST SSDF as engineering anchors.
- Repository evidence:
  - Code evidence: `src/service/hosted-webhook-async-reconciliation-hardening.ts`, `src/service/account-store.ts`, `src/service/control-plane-store.ts`, `src/service/application/stripe-webhook-billing-processor.ts`.
  - Test evidence: `tests/hosted-webhook-async-reconciliation-hardening.test.ts`, `tests/service-stripe-webhook-billing-processor.test.ts`, `tests/service-admin-query-service.test.ts`, `tests/package-script-runner.test.ts`.
  - Contract/documentation evidence: `docs/01-overview/hosted-journey-contract.md`, `docs/02-architecture/hosted-production-trust-hardening.md`.
  - PR evidence: PR #212 validation recorded `npm run test:service-stripe-webhook-billing-processor`, `npm run test:service-stripe-webhook-service`, `npm run test:hosted-stripe-billing-convergence-flow`, `npm run test:stripe-webhook-events`, and `npm run test:stripe-webhook-support-hardening`.
- Implemented control: Adds a machine-readable reconciliation profile and stale Stripe subscription/invoice event ordering guards. Older provider events finalize as ignored instead of regressing tenant plan, entitlement, or billing audit state.
- Tests / verification: Focused webhook, billing processor, hosted billing convergence, Stripe event, and support-hardening tests recorded in PR #212.
- Remaining limitation or no-go condition: Live webhook readiness still requires deployment env, `STRIPE_WEBHOOK_SECRET`, service restart, webhook smoke test, and working deployment target evidence.
- Status: complete, repo-side hardening; live deployment proof remains separate.

### 3. Production Runtime Health Contract

- Step / PR / commit: Hosted Production Trust Hardening Step 05; PR #214; commit `a866f41d374a7becead7a4cbb7e590b24d892c01`.
- Date if available: 2026-05-12.
- Trust surface: API liveness, API readiness, worker readiness, dependency readiness, degraded-mode visibility, health response privacy.
- Protected principle: runtime readiness; no overclaim; operational boundedness; data minimization and redaction.
- Research anchor / source used, if recorded: `docs/02-architecture/hosted-production-trust-hardening.md` records Kubernetes readiness/liveness/startup probes, Google SRE monitoring guidance, OpenTelemetry service attributes, OpenTelemetry semantic conventions, and NIST SSDF as engineering anchors.
- Repository evidence:
  - Code evidence: `src/service/hosted-production-runtime-health-contract.ts`, `src/service/http/routes/core-routes.ts`, `src/service/worker.ts`.
  - Test evidence: `tests/hosted-production-runtime-health-contract.test.ts`, `tests/service-core-routes.test.ts`, `tests/live-worker-health.test.ts`, `tests/package-script-runner.test.ts`.
  - Contract/documentation evidence: `docs/01-overview/hosted-journey-contract.md`, `docs/08-deployment/production-readiness.md`, `docs/02-architecture/hosted-production-trust-hardening.md`.
  - PR evidence: PR #214 title `[codex] Add production runtime health contract`.
- Implemented control: Adds a machine-readable health contract across API process health, dependency readiness, worker health/readiness, async queue runtime, storage/release authority readiness, webhook ingress readiness, and degraded-mode visibility. Health and readiness responses are explicitly `no-store`.
- Tests / verification: `npm run test:hosted-production-runtime-health-contract`; route and worker health tests listed above.
- Remaining limitation or no-go condition: Repository health contracts do not prove external PostgreSQL, Redis, Kubernetes, DNS, TLS, observability, billing, or customer-operated runtime readiness until target-specific probes and rehearsal pass.
- Status: complete, repo-side hardening.

### 4. Release Provenance And SLSA Alignment

- Step / PR / commit: Hosted Production Trust Hardening Step 06; PR #215; merge commit `4b0c24c7f64f4a843a57dd0092e415ccaa4d859b`; implementation commit `bfcea20`.
- Date if available: 2026-05-12.
- Trust surface: evaluation release artifact provenance, SBOM attestation, workflow identity, package-surface evidence, proof/evidence packet binding.
- Protected principle: release provenance; proof integrity; no overclaim; auditability.
- Research anchor / source used, if recorded: `docs/02-architecture/hosted-production-trust-hardening.md` records SLSA v1.2 build provenance and verification plus GitHub artifact attestations. `docs/08-deployment/artifact-attestation-plan.md` records the evaluation-artifact provenance boundary and non-claims.
- Repository evidence:
  - Code/workflow evidence: `.github/workflows/release-provenance.yml`, `src/service/hosted-release-provenance-slsa-alignment.ts`.
  - Test evidence: `tests/hosted-release-provenance-slsa-alignment.test.ts`, `tests/package-script-runner.test.ts`.
  - Contract/documentation evidence: `docs/08-deployment/artifact-attestation-plan.md`, `docs/08-deployment/production-readiness.md`, `docs/01-overview/hosted-journey-contract.md`, `docs/02-architecture/hosted-production-trust-hardening.md`.
  - PR evidence: PR #215 validation recorded `npm run test:hosted-release-provenance-slsa-alignment`.
- Implemented control: Adds a release provenance/SLSA alignment profile and a dedicated release-only provenance workflow that packages evaluation artifacts and publishes separate build provenance and CycloneDX SBOM attestations.
- Tests / verification: `npm run test:hosted-release-provenance-slsa-alignment`; GitHub attestation verification commands documented in `docs/08-deployment/artifact-attestation-plan.md`.
- Remaining limitation or no-go condition: This is evaluation-release artifact provenance. It is not full production supply-chain provenance, not SLSA certification, and not production deployment provenance for customer environments.
- Status: complete, evaluation-release provenance boundary.

### 5. Observability Privacy And Incident Evidence

- Step / PR / commit: Hosted Production Trust Hardening Step 07; PR #216; merge commit `ebb8f9e57afc49eb07765a3c9cfa5f87311c838b`; implementation commit `93b61ba`.
- Date if available: 2026-05-12.
- Trust surface: request traces, metrics, JSONL/OTLP request logs, alert context, incident packet shape, dashboard runtime truth.
- Protected principle: data minimization and redaction; runtime readiness; auditability; operational boundedness.
- Research anchor / source used, if recorded: `docs/02-architecture/hosted-production-trust-hardening.md` records OpenTelemetry semantic conventions and attribute requirement levels, OWASP Logging Cheat Sheet, NIST SP 800-61 Rev. 3, Google SRE monitoring, and Google SRE postmortem culture.
- Repository evidence:
  - Code evidence: `src/service/hosted-observability-privacy-incident-evidence.ts`, `src/service/observability.ts`, `src/service/request-observability-middleware.ts`.
  - Test evidence: `tests/hosted-observability-privacy-incident-evidence.test.ts`, `tests/live-api.test.ts`, `tests/package-script-runner.test.ts`.
  - Contract/documentation evidence: `docs/01-overview/hosted-journey-contract.md`, `docs/08-deployment/production-readiness.md`, `docs/02-architecture/hosted-production-trust-hardening.md`.
  - PR evidence: PR #216 notes Step 07 research anchors and production-readiness boundary.
- Implemented control: Adds a machine-readable observability privacy and incident-evidence profile. Request observability exports omit raw URLs, paths, tenant ids, account ids, IPs, and user agents, using route labels, presence booleans, and trace context instead.
- Tests / verification: `npm run test:hosted-observability-privacy-incident-evidence`; PR #216 also recorded `test:live-api` passed 794/794 assertions with non-failing shutdown noise.
- Remaining limitation or no-go condition: Live collector credentials, alert destination delivery, retention policy, customer incident communications, deployment restart, Stripe/webhook smoke tests, and target-specific rehearsal remain outside repo-side proof.
- Status: complete, repo-side hardening.

### 6. Tenant Isolation Boundary

- Step / PR / commit: PR #84; merge commit `fddee10a1a017db27de4075bba4842269aa3394c`; implementation commit `d34b95d`.
- Date if available: 2026-05-05.
- Trust surface: hosted shadow route tenant boundary, tenant-scoped simulation/candidate/activation records, database-level tenant isolation research.
- Protected principle: tenant isolation; fail-closed boundary; customer authority; data minimization and redaction.
- Research anchor / source used, if recorded: PR #84 records OWASP API1:2023 Broken Object Level Authorization and NIST SP 800-53 Rev. 5 access control as research basis. `docs/research/db-tenancy-and-distributed.md` records PostgreSQL RLS, transaction-local `app.tenant_id`, composite tenant indexes, and cross-tenant test expectations for data-layer tenant isolation.
- Repository evidence:
  - Code evidence: `src/service/http/routes/shadow-routes.ts`, `src/service/tenant-isolation.ts`, `src/service/tenant-rls.ts`.
  - Test evidence: `tests/shadow-route-tenant-boundary.test.ts`, `tests/tenant-isolation-production-guard.test.ts`, `tests/shadow-persistence-store.test.ts`.
  - Contract/documentation evidence: `docs/02-architecture/tenant-isolation-boundary.md`, `docs/research/db-tenancy-and-distributed.md`, `docs/08-deployment/deployment.md`.
  - PR evidence: PR #84 title `Harden shadow tenant boundary checks`.
- Implemented control: Adds explicit route-side tenant-bound checks so foreign tenant records returned by a store, adapter, or test double fail closed before serialization. Database RLS research and implementation evidence exists separately for production data-layer isolation.
- Tests / verification: `npm run test:shadow-route-tenant-boundary`; tenant/RLS-related tests listed above.
- Remaining limitation or no-go condition: Route guards are defense-in-depth and do not by themselves prove complete production tenancy. Production deployments still require selected storage enforcement such as shared authority/control-plane storage, PostgreSQL RLS, per-tenant keys, or other customer-approved isolation controls.
- Status: complete for route-side hardening; production data-layer proof remains deployment-specific.

### 7. Data Minimization And Redaction

- Step / PR / commit: PR #83 merge commit `8bea3298f63846f0063a26534871d63ad1cb6e1f`; implementation commit `552ae47`; follow-up PR #170 commit `237f9199ff6409cbdb6360ad054271315ae1a4e5`.
- Date if available: 2026-05-05 and 2026-05-10.
- Trust surface: model feedback, proof/audit packets, dashboard summaries, external review packets, retry ledgers, telemetry, downstream receipts.
- Protected principle: data minimization and redaction; auditability; proof integrity; no overclaim.
- Research anchor / source used, if recorded: PR #83 records NIST AI RMF / GenAI risk management documentation, NIST SP 800-122 PII confidentiality guidance, and OWASP LLM02 sensitive information disclosure mitigation. PR #170 is recorded as repository-internal telemetry data minimization hardening.
- Repository evidence:
  - Code evidence: `src/consequence-admission/data-minimization-redaction-policy.ts`, `src/consequence-admission/audit-evidence-export.ts`, `src/consequence-admission/business-risk-dashboard.ts`, `src/crypto-execution-admission/telemetry-receipts.ts`, `src/release-enforcement-plane/telemetry.ts`.
  - Test evidence: `tests/data-minimization-redaction-policy.test.ts`.
  - Contract/documentation evidence: `docs/02-architecture/data-minimization-redaction-policy.md`, `README.md`, `docs/02-architecture/system-overview.md`.
  - PR evidence: PR #83 title `Add data minimization redaction policy`; PR #170 title `Centralize telemetry data minimization scans`.
- Implemented control: Defines allowed structural data units and forbidden raw classes for model feedback, audit packets, dashboards, retry ledgers, replay receipts, execution receipts, and telemetry. Follow-up hardening centralizes telemetry data minimization scans.
- Tests / verification: `npm run test:data-minimization-redaction-policy`; PR #170 recorded focused telemetry/conformance test commands.
- Remaining limitation or no-go condition: The policy is not an external privacy audit. New surfaces must continue to bind to the policy and tests or their privacy posture is not proven.
- Status: complete for recorded surfaces; ongoing guardrail for future surfaces.

### 8. Release Signing Provider Gate

- Step / PR / commit: PR #20; merge commit `94fdc5475ada4e2ee78a6926adb940e5bd219472`; implementation commit `5d84cb0`.
- Date if available: 2026-05-01.
- Trust surface: release signing provider truth, runtime signing diagnostics, external KMS/HSM declaration.
- Protected principle: proof integrity; release provenance; no overclaim; fail-closed boundary.
- Research anchor / source used, if recorded: External anchor: not required / repository-internal hardening evidence only. PR #20 records the implementation goal and fail-closed behavior, but no PR-specific external research source was recorded.
- Repository evidence:
  - Code evidence: `src/service/bootstrap/release-signing-provider.ts`, `src/service/bootstrap/release-runtime.ts`, `src/service/bootstrap/api-route-runtime.ts`, `src/service/http/routes/core-routes.ts`.
  - Test evidence: `tests/production-release-signing-provider.test.ts`, `tests/service-core-routes.test.ts`.
  - Contract/documentation evidence: `docs/08-deployment/deployment.md`, `docs/08-deployment/production-readiness.md`.
  - PR evidence: PR #20 title `Harden release signing provider truth gate`.
- Implemented control: Adds explicit provider diagnostics for `runtime-ephemeral`, `file-pem`, and `external-kms`; fails closed when `external-kms` is declared before a real KMS/HSM signer exists or when the production-provider gate is required.
- Tests / verification: `npm run test:production-release-signing-provider`; `npm run test:service-core-routes`.
- Remaining limitation or no-go condition: External KMS/HSM-backed signing is not implemented. `file-pem` is restart-recoverable but remains exportable runtime material and is not production-provider proof.
- Status: complete truth gate; external KMS/HSM implementation remains no-go.

### 9. PKI Persistence, HA PKI Boundary, And PKI Validity

- Step / PR / commit: commit `865f5dc` (`Persist release runtime issuer PKI`); PR #97 merge commit `8a449b79092adcae16c2bde663f26f3559d5a656` with implementation commit `f5b4343`; PR #109 merge commit `a0d4da00177fdf2dcc9b51e88d5c77b4cce6e512` with implementation commit `c9360e0`.
- Date if available: 2026-04-29, 2026-05-06, and 2026-05-07.
- Trust surface: release runtime issuer persistence, PKI trust-chain verification, HA/shared release-runtime PKI path, signer validity.
- Protected principle: proof integrity; release provenance; runtime readiness; fail-closed boundary.
- Research anchor / source used, if recorded: `docs/research/domains-and-pki-default.md` records PKI-by-default signing, Sigstore/Fulcio/SLSA provenance patterns, and flat-key-to-chain verification transition. `docs/research/implementation-wave2.md` records the PKI default verifier implementation direction.
- Repository evidence:
  - Code evidence: `src/service/bootstrap/release-runtime.ts`, `src/signing/keyless-signer.ts`, `src/signing/pki-chain.ts`, `src/signing/bundle.ts`, `src/signing/certificate.ts`.
  - Test evidence: `src/signing/signing.test.ts`, `tests/production-runtime-restart-recovery.test.ts`, `tests/production-runtime-pki-rotation.test.ts`, `tests/production-release-signing-provider.test.ts`, `tests/ha-release-input-probe.test.ts`, `tests/ha-promotion-packet.test.ts`, `tests/kubernetes-ha-bundle.test.ts`.
  - Contract/documentation evidence: `docs/06-signing/signing-verification.md`, `docs/08-deployment/deployment.md`, `docs/08-deployment/production-readiness.md`, `ops/kubernetes/ha/release-runtime-pki-pvc.yaml`.
  - PR evidence: PR #97 title `Harden release PKI for HA deployments`; PR #109 title `Harden release signing PKI validity`.
- Implemented control: Persists release runtime issuer PKI, adds shared-path HA checks, wires release-input/promotion gates to shared PKI requirements, and hardens PKI trust-chain validity handling.
- Tests / verification: `npm run test:production-runtime-pki-rotation`, `npm run test:production-release-signing-provider`, `npm run test:ha-release-input-probe`, `npm run test:ha-promotion-packet`, `npm run test:kubernetes-ha-bundle`, and signing tests.
- Remaining limitation or no-go condition: File-backed PKI is not KMS/HSM custody. HA shared-path truth depends on operator attestation and mounted shared storage. KMS/HSM rotation, compromise response, and key destruction remain separate operator controls.
- Status: complete for file-backed and HA guardrails; external key custody not proven.

### 10. Presentation Replay Ledger

- Step / PR / commit: PR #31; merge commit `f698e4d2d93c84d23dfbd81f9b0b62cd8a408a38`; implementation commit `a08f111`.
- Date if available: 2026-05-01.
- Trust surface: downstream presentation binding, replay key consumption, customer enforcement edge.
- Protected principle: replay/idempotency safety; fail-closed boundary; proof integrity; auditability.
- Research anchor / source used, if recorded: PR #31 records NIST SP 800-207 for policy/enforcement separation and OWASP Agentic Applications 2026 for autonomous tool-use boundaries.
- Repository evidence:
  - Code evidence: `src/consequence-admission/presentation-replay-ledger.ts`, `src/consequence-admission/index.ts`.
  - Test evidence: `tests/presentation-replay-ledger.test.ts`, `tests/package-script-runner.test.ts`.
  - Contract/documentation evidence: `docs/02-architecture/presentation-replay-ledger.md`, `docs/02-architecture/downstream-presentation-binding.md`, `docs/01-overview/purpose.md`, `docs/01-overview/what-you-can-do.md`.
  - PR evidence: PR #31 title `Add presentation replay ledger`.
- Implemented control: Adds single-use replay consumption and redacted replay evidence for downstream presentations so admitted consequences do not become portable permission.
- Tests / verification: `npm run test:presentation-replay-ledger`; package-surface probe coverage through `scripts/probe-consequence-admission-package-surface.mjs`.
- Remaining limitation or no-go condition: Production customer edges should back the replay contract with a shared atomic store at the enforcement edge; the evaluation helper does not prove every customer deployment.
- Status: complete for evaluation helper and contract; production enforcement-store proof remains deployment-specific.

### 11. Runtime Baseline No-Go And Production Readiness Limitations

- Step / PR / commit: PR #207 commit `31b3ff653128ddba2e9964a2130f080019c89a7a`; PR #208 commit `f8058c1acda2a59a142aaef280439883b475208a`; PR #209 commit `1804e00dfb589109f8cb556fd464716525f88b6e`.
- Date if available: 2026-05-11.
- Trust surface: runtime baseline, public production rollout boundary, secret-safe readiness output.
- Protected principle: runtime readiness; no overclaim; data minimization and redaction; operational boundedness.
- Research anchor / source used, if recorded:
  - PR #207 records Node 26 Current-not-LTS and official Node Docker Alpine/musl runtime validation concerns.
  - PR #208 and PR #209: External anchor: not required / repository-internal hardening evidence only.
- Repository evidence:
  - Code/test evidence: `tests/node-26-runtime-validation.test.ts`, `tests/production-rollout-public-boundary.test.ts`, `tests/production-readiness-secret-safe-output.test.ts`, `scripts/secret-safe-output.ts`, readiness render/probe scripts changed by PR #209.
  - Contract/documentation evidence: `docs/02-architecture/crypto-engine-hardening-ii.md`, `docs/08-deployment/production-readiness.md`.
  - PR evidence: PR #207 title `Validate Node 26 runtime no-go`; PR #208 title `Guard production rollout public boundary`; PR #209 title `Harden production readiness secret-safe output`.
- Implemented control: Keeps Docker/package/CI runtime baseline on Node 22 until Node 26 is LTS and runtime smoke is proven; prevents public production rollout claims without deployment env, restart, readiness probe, and smoke tests; redacts live Stripe keys, webhook secrets, bearer tokens, credentialed DB URLs, and Stripe/customer/session refs from operator-facing output.
- Tests / verification: `npm run test:node-26-runtime-validation`, `npm run test:production-rollout-public-boundary`, `npm run test:production-readiness-secret-safe-output`.
- Remaining limitation or no-go condition: Node 26 runtime remains rejected for now. Production rollout remains blocked until a working deployment target, environment inputs, service restart, readiness probes, Stripe/webhook smoke tests, and hosted product smoke tests pass.
- Status: complete no-go and public-boundary hardening; production rollout still blocked.

## Additional Recorded Research-Backed Tracks

The entries above are the most concrete PR/commit-linked hardening records. The tracks below are also recorded research-backed engineering work, but this ledger does not yet expand every frozen step into a separate commit-linked entry. Where exact PR or commit attribution is not recorded here, the tracker file remains the source of truth.

### 12. Release Layer Buildout

- Step / PR / commit: `docs/02-architecture/release-layer-buildout.md`; exact per-step PR/commit mapping not expanded in this ledger.
- Date if available: not recorded in the ledger.
- Trust surface: release decisions, release tokens, reviewer authority, evidence packs, deterministic checks, token lifecycle, replay protection, first hard finance gateway.
- Protected principle: proof integrity; fail-closed boundary; release provenance; auditability; replay/idempotency safety.
- Research anchor / source used, if recorded: Microsoft monolith architecture, AWS strangler fig pattern, NIST AI RMF, OPA/Cedar-style policy patterns, OPA decision logs, NIST log-management patterns, RFC 8785, JOSE/JWT, RFC 6750/7662/7009, SLSA/in-toto, Kubernetes warn/audit/deny rollout patterns, and structured reporting anchors recorded in tracker step notes.
- Repository evidence: `src/release-kernel/*`, `src/release-layer/*`, `tests/release-kernel-*.test.ts`, `tests/release-layer-platform-surface.test.ts`, `scripts/probe-release-layer-package-surface.mjs`, `docs/02-architecture/release-layer-platform-surface.md`.
- Implemented control: Turns release authorization into a packaged consequence boundary with deterministic checks, signed tokens, introspection, revocation, replay consumption, reviewer queue, dual approval, break-glass, evidence packs, rollout posture, and package-surface controls.
- Tests / verification: Tracker records per-step focused tests and package-surface probes; exact full command set for every historical step is not expanded here.
- Remaining limitation or no-go condition: The track proves packaged release-layer behavior inside the repo; customer-operated production adoption still requires deployment-specific enforcement and runtime proof.
- Status: complete tracker, source-indexed in this ledger.

### 13. Release Policy Control Plane

- Step / PR / commit: `docs/02-architecture/release-policy-control-plane-buildout.md`; exact per-step PR/commit mapping not expanded in this ledger.
- Date if available: not recorded in the ledger.
- Trust surface: policy-pack lifecycle, signed policy bundles, scoped activation, dry-run simulation, mutation audit, reviewer approval, rollback, package surface.
- Protected principle: customer authority; proof integrity; fail-closed boundary; auditability; release provenance.
- Research anchor / source used, if recorded: OPA bundles/discovery, Amazon Verified Permissions policy stores/schemas/authorization, Kubernetes admission webhook good practices.
- Repository evidence: `src/release-policy-control-plane/*`, `src/service/http/routes/release-policy-control-routes.ts`, `tests/release-policy-control-plane-*.test.ts`, `docs/02-architecture/release-policy-control-plane-platform-surface.md`.
- Implemented control: Adds deterministic policy pack objects, signed bundle verification, scope precedence, active resolution, simulation, impact summaries, executable test packs, hash-linked audit logs, admin routes, approval gates, rollback, and packaging.
- Tests / verification: Tracker records focused unit and route tests for each frozen step.
- Remaining limitation or no-go condition: Repository control-plane tests do not prove customer policy governance, external approval identity, or production operator process.
- Status: complete tracker, source-indexed in this ledger.

### 14. Release Enforcement Plane

- Step / PR / commit: `docs/02-architecture/release-enforcement-plane-buildout.md`; exact per-step PR/commit mapping not expanded in this ledger.
- Date if available: not recorded in the ledger.
- Trust surface: distributed enforcement points, offline/online verification, sender-constrained presentation, HTTP/webhook/async/record/communication/action gateways, proxy bridge, degraded mode, transparency receipts.
- Protected principle: fail-closed boundary; replay/idempotency safety; proof integrity; operational boundedness; auditability.
- Research anchor / source used, if recorded: NIST SP 800-207, Istio/Envoy external authorization, Kubernetes admission policies, RFC 7662/7009/8693/9449/8705/9421, SPIFFE/SPIRE, Sigstore policy-controller, GitHub artifact-attestation enforcement, SCITT.
- Repository evidence: `src/release-enforcement-plane/*`, `tests/release-enforcement-plane-*.test.ts`, `docs/08-deployment/release-enforcement-plane-envoy.md`, `docs/02-architecture/release-enforcement-plane-platform-surface.md`.
- Implemented control: Packages reusable policy enforcement points that fail closed without valid Attestor release authorization and bind authorization to the caller, workload, request, queue envelope, proxy context, or downstream consequence.
- Tests / verification: Tracker records focused verifier, presentation, middleware, gateway, Envoy, degraded-mode, telemetry, conformance, and package-surface tests.
- Remaining limitation or no-go condition: Reference PEPs and adapters do not prove every customer mesh, proxy, queue, or service runtime until deployed and rehearsed in that target.
- Status: complete tracker, source-indexed in this ledger.

### 15. Proof Surface And Consequence Admission Tracks

- Step / PR / commit: `docs/02-architecture/proof-console-buildout.md` and `docs/02-architecture/consequence-admission-buildout.md`; exact per-step PR/commit mapping not expanded in this ledger.
- Date if available: reviewed on 2026-04-22 and 2026-04-23 according to tracker evidence.
- Trust surface: proof surface, admission vocabulary, canonical admission object, facade route behavior, finance and crypto proof scenarios, evaluator-facing documentation.
- Protected principle: proof integrity; auditability; no overclaim; fail-closed boundary; data minimization and redaction.
- Research anchor / source used, if recorded: Stanford Web Credibility, FTC dark patterns, SEC/iXBRL/EDGAR, XBRL, EIP-7702, x402, ERC-4337, Safe guards, W3C VC, CloudEvents, OpenTelemetry, NIST AI RMF, SLSA/in-toto, JSON Schema, GitHub README guidance, Google style, Diataxis, MCP authorization, OPA decision logs, RFC 8785, RFC 9457, OpenAPI 3.1.1.
- Repository evidence: proof surface scripts, proof-surface registry and manifest files, `src/consequence-admission/*`, package-surface probes, README proof commands, architecture trackers.
- Implemented control: Makes proof outputs runnable, digest-bound, inspectable, and package-bound while keeping admission mode explicit and avoiding hidden auto-routing or universal-route claims.
- Tests / verification: Tracker records proof-surface readiness gates, package-surface probes, and consequence-admission package tests.
- Remaining limitation or no-go condition: Proof outputs are evaluation and integration evidence, not independent certification or full production assurance.
- Status: complete trackers, source-indexed in this ledger.

### 16. Hosted Product, Runtime, Shared Authority, And Rehearsal Tracks

- Step / PR / commit: `docs/02-architecture/hosted-product-flow-buildout.md`, `docs/02-architecture/production-runtime-hardening-buildout.md`, `docs/02-architecture/production-shared-authority-plane-buildout.md`, and `docs/02-architecture/production-rehearsal-buildout.md`; exact per-step PR/commit mapping not expanded in this ledger.
- Date if available: hosted product reviewed on 2026-04-22; runtime reviewed on 2026-04-23; shared authority reviewed on 2026-04-24; rehearsal reviewed on 2026-04-27.
- Trust surface: commercial hosted flow, checkout/portal/webhooks, tenant API keys, runtime profiles, durable stores, shared PostgreSQL authority plane, promotion rehearsal evidence.
- Protected principle: runtime readiness; customer authority; tenant isolation; replay/idempotency safety; no overclaim; operational boundedness.
- Research anchor / source used, if recorded: Stripe Checkout/Portal/subscriptions/Entitlements/idempotency/webhooks, OpenAPI, OAuth/RFC bearer auth, OWASP API Security, SEC/iXBRL, EIP-712/ERC-1271/ERC-4337/EIP-7702, PostgreSQL transaction/locking/WAL/libpq guidance, Redis persistence, node-postgres pooling, Kubernetes probes/production guidance, NIST SSDF, SLSA, GitHub artifact attestations, BullMQ production guidance.
- Repository evidence: hosted account/billing routes, runtime bootstrap and readiness files, release authority store, production readiness docs, deployment docs, rehearsal artifacts/scripts, focused hosted/runtime/shared-authority tests.
- Implemented control: Adds current-scope hosted product flow evidence, runtime profile boundaries, durable restart-safe mode, shared authority-store cut line, readiness contracts, and signed rehearsal candidate evidence.
- Tests / verification: Tracker records hosted flow readiness tests, runtime profile/restart/recovery tests, shared-authority multi-instance recovery tests, and production rehearsal gates.
- Remaining limitation or no-go condition: External customer-operated production remains unproven until environment inputs, deployment restart, readiness probes, webhook smoke tests, hosted product smoke tests, and target rehearsal pass.
- Status: hosted/runtime/shared/rehearsal trackers complete for repo-side scope; live production rollout remains blocked separately.

### 17. Crypto Authorization, Execution, Intelligence, And Engine Hardening

- Step / PR / commit: `docs/02-architecture/crypto-authorization-core-buildout.md`, `docs/02-architecture/crypto-execution-admission-buildout.md`, `docs/02-architecture/crypto-intelligence-buildout.md`, and `docs/02-architecture/crypto-engine-hardening-ii.md`; exact per-step PR/commit mapping not expanded in this ledger.
- Date if available: execution reviewed on 2026-04-22; intelligence and hardening II reviewed on 2026-05-11; authorization date not recorded in this ledger.
- Trust surface: programmable-money authorization, wallet and smart-account adapters, execution-admission preflight, custody callbacks, intent routing, operator risk input, dashboard intelligence, privacy enforcement, package surfaces, runtime/dependency hardening.
- Protected principle: proof integrity; fail-closed boundary; customer authority; replay/idempotency safety; data minimization and redaction; operational boundedness.
- Research anchor / source used, if recorded: EIP-712, EIP-191, ERC-5267, ERC-7739, ERC-1271, EIP-6492, ERC-4337, ERC-7562, EIP-5792, ERC-7715, ERC-7769, ERC-7579, ERC-6900, EIP-2, EIP-7702, ERC-7902, Safe guards/modules, x402, EIP-3009, ERC-7683, Turnkey, Fireblocks, Chainalysis risk data, W3C PROV, OFAC data boundaries, OPA decision logs, AWS IAM evaluation, Grafana dashboard guidance, OpenTelemetry, NIST Privacy Framework, OWASP logging, GDPR, NIST AI RMF, Node perf/crypto/package exports, TypeScript module resolution, `@noble/hashes`, Node release/Docker runtime guidance.
- Repository evidence: `src/crypto-authorization-core/*`, `src/crypto-execution-admission/*`, `src/crypto-intelligence/index.ts`, package-surface probes, crypto focused tests, crypto intelligence benchmark script, crypto hardening docs/tests.
- Implemented control: Builds crypto authorization and execution admission as packaged deterministic surfaces, adds intelligence over risk/readiness/gaps, enforces digest-first privacy, records performance budgets, validates package boundaries, and blocks Node 26 / unresolved production rollout as no-go conditions.
- Tests / verification: Tracker records crypto package tests, adapter/conformance tests, privacy minimization tests, dashboard/performance/package-surface tests, dependency-risk tests, and Node 26 runtime validation.
- Remaining limitation or no-go condition: Attestor does not become a wallet, custody platform, bundler, paymaster, bridge, facilitator, solver, relayer, oracle, sanctions provider, fraud provider, or market-data vendor. Customer-operated integrations and third-party signals must be digest-bound and scoped before execution claims.
- Status: crypto authorization, execution, and intelligence trackers complete for current package scope; engine hardening Step 10 remains blocked on production rollout infrastructure.

## Strong Recorded Research Support

The strongest recorded research support appears in:

- PR #210 / Hosted API Authorization Matrix: OWASP API Security Top 10, NIST SSDF, and hosted production trust hardening anchors.
- PR #212 / Webhook And Async Reconciliation: Stripe idempotency/webhook/signature guidance, BullMQ retry/stalled-job guidance, OWASP API4/API6, NIST SSDF.
- PR #214 / Production Runtime Health Contract: Kubernetes probes, Google SRE monitoring, OpenTelemetry service attributes/conventions, NIST SSDF.
- PR #215 / Release Provenance And SLSA Alignment: SLSA v1.2 and GitHub artifact attestations.
- PR #216 / Observability Privacy And Incident Evidence: OpenTelemetry, OWASP Logging, NIST SP 800-61, Google SRE monitoring/postmortem guidance.
- PR #83 / Data Minimization Redaction Policy: NIST AI RMF, NIST SP 800-122, OWASP LLM02.
- PR #84 / Tenant Isolation Boundary: OWASP API1:2023 and NIST SP 800-53 Rev. 5.
- PR #31 / Presentation Replay Ledger: NIST SP 800-207 and OWASP Agentic Applications 2026.
- PR #207 / Node 26 Runtime No-Go: Node LTS status and Node Docker Alpine/musl validation concerns.
- Release-layer, policy-control-plane, enforcement-plane, proof-console, consequence-admission, hosted-product, production-runtime, shared-authority, production-rehearsal, and crypto buildout trackers: strong tracker-level research support recorded in `docs/02-architecture/*-buildout.md`.
- Repository research notes in `docs/research/*.md`: strong source-index support for tenant isolation, distributed runtime, PKI/default verification, schema attestation, filing paths, OIDC/session posture, Redis/BullMQ async behavior, and healthcare validation boundaries.

## Repository-Internal Only Entries

These entries are primarily repository-internal hardening evidence rather than externally anchored steps:

- PR #20 / Release Signing Provider Gate: explicit provider truth and fail-closed behavior.
- PR #170 / Centralize Telemetry Data Minimization Scans: follow-up enforcement of the existing data minimization policy.
- PR #208 / Production Rollout Public Boundary: public no-overclaim boundary.
- PR #209 / Production Readiness Secret-Safe Output: secret-safe operator output.

## Missing Evidence Marked Not Recorded Or Not Proven

- PR #20 has no PR-specific external research source recorded; the entry is marked repository-internal only.
- PR #170 has no PR-specific external research source recorded; it is treated as follow-up enforcement of the already recorded data minimization policy.
- PR #208 and PR #209 have no PR-specific external source recorded; both are repository-internal no-overclaim/secret-safety hardening.
- Many frozen buildout steps have tracker-level research anchors and per-step repository evidence but are not expanded here into one entry per historical PR or commit. Their exact PR/commit mapping is therefore marked not expanded rather than invented.
- Some repository research notes are source-indexed only. If a later commit, PR body, tracker row, or test does not explicitly reference them, this ledger does not claim direct source-to-commit causality.
- Complete production readiness is not proven. The repository records this as blocked on target-specific deployment env, service restart, readiness probes, webhook smoke tests, hosted product smoke tests, and production rehearsal evidence.
- External KMS/HSM-backed release signing is not proven or implemented.
- Customer-operated replay/idempotency storage at every downstream enforcement edge is not proven by evaluation helper tests alone.
