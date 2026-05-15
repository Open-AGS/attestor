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
| `docs/02-architecture/action-surface-integration-artifacts.md` | Envoy `ext_authz`, NGINX `auth_request`, Istio `CUSTOM` external authorization, MCP tool gateway patterns, provider-native delegation, credential isolation, Policy Twin backtests, and red-team replay fixtures. | Initial repo-side review-draft artifact generator added for profiler output in PR #231; production deployment, credential issuance, provider activation, reviewed artifact evidence, and non-bypassable enforcement remain not proven. | Architecture research tracker and current implementation evidence; PR #231 merge commit `7618769dc7cd6c4b247c5738ca897469bba4dd92`, implementation commit `8fab274`. |
| `docs/02-architecture/action-surface-onboarding-packet.md` | OpenAPI machine-readable operation inventory, Backstage Software Templates style scaffolding, Terraform `plan` / `apply` separation, in-toto digest-linked evidence patterns, OWASP API1 tenant/object authorization, Hono body-size bounded request handling, and Attestor review-gated readiness contracts. | Initial repo-side digest-first onboarding packet added for manifest/declaration/profiler/artifact/readiness composition in PR #232. Hosted stateless route work adds tenant-scoped API rendering without raw payload storage, credential issuance, gateway deployment, or enforcement activation; UI wizard, production deployment, and scoped enforcement activation remain not proven. | Architecture research tracker and current implementation evidence; PR #232 merge commit `a6940d102833fe8779decbd3b3bd764d40a60dd8`, implementation commits `0c27bb3` and `7ddfc40`. Hosted route exact PR/commit mapping is pending until the hosted onboarding renderer PR is merged. |
| `docs/02-architecture/policy-foundry-onboarding.md` | AWS IAM Access Analyzer, Google IAM Recommender, Cedar/AWS Verified Permissions, OPA decision logs/tests, NIST SP 800-162 ABAC, ABAC policy mining research, Stripe onboarding and Billing Entitlements, Auth0 progressive profiling, LaunchDarkly/OpenFeature rollout patterns, Zanzibar/OpenFGA relationship context, OWASP session management, OWASP API authorization, W3C WCAG status messages, GOV.UK task-list pages, Playwright visual QA guidance, Terraform plan/apply separation, Kubernetes dry-run behavior, Envoy/OPA external authorization, Kubernetes readiness probe guidance, and Google SRE black-box monitoring patterns. | Policy Foundry readiness, red-team replay, active-question, hosted route, hosted UI, local hosted UI browser preview, local file-backed persistent wizard state, hosted route billing-provider entitlement enforcement, non-mutating live downstream replay evidence, opt-in production smoke probe contracts, and hosted wizard production storage-path blocker are implemented for repo-side evaluation scope; shared production wizard storage implementation remains not proven. | Architecture research tracker and implementation evidence; exact source-to-commit attribution is not expanded for every Policy Foundry step. |
| `docs/02-architecture/policy-foundry-self-onboarding-deepening.md` | AWS IAM Access Analyzer, Google IAM Recommender, Cedar/AWS Verified Permissions, OPA decision logs/tests, Stripe Connect onboarding, Stripe Billing Entitlements, Auth0 progressive profiling, Envoy/Istio/OPA external authorization, OpenFGA/Zanzibar authority modeling, W3C WCAG status messages, GOV.UK task-list pages, Playwright visual QA guidance, OWASP session management, OWASP API authorization, Terraform plan/apply separation, Kubernetes dry-run behavior, Kubernetes readiness probe guidance, and Google SRE black-box monitoring patterns. | Step 01 through Step 23 are complete repo-side: onboarding session, coverage scoring, gate planning, schema-bound registry, counterexample ledger, Policy Twin summary, authority context, review-only patch pack, self-onboarding CLI, outcome feedback, drift/policy debt, commercial boundary, local adversarial replay, hosted workflow route, hosted review surface, hosted UI flow renderer, local hosted UI browser preview, local file-backed persistent hosted wizard state, hosted route billing-provider entitlement enforcement, non-mutating live downstream replay evidence, hosted runtime replay wiring, opt-in production smoke probe, and hosted wizard storage readiness gate. Shared production wizard storage implementation and production traffic execution remain not proven. | Architecture research tracker and current implementation evidence; exact source-to-commit attribution is not expanded for every Policy Foundry step. |
| `docs/02-architecture/integration-mode-readiness.md` | AWS IAM Access Analyzer, Google IAM Recommender, Cedar/AWS Verified Permissions, OPA decision logs, Envoy `ext_authz`, Istio `CUSTOM` authorization, NGINX `auth_request`, Kubernetes admission controllers, Vault dynamic secrets, Google downscoped credentials, AWS STS session policies, provider-native delegation, MCP authorization, agent runtime guardrail patterns. | Initial contract added for repo-side onboarding automation and bypass-risk classification; live gateway/proxy generation, credential issuance, and production deployment remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the integration-mode readiness PR is merged. |
| `docs/02-architecture/guard-activation-readiness.md` | NIST AI RMF operational risk-management posture, Kubernetes readiness probes, and OPA decision/enforcement separation as anchors for distinguishing guard decision rendering from production enforcement activation. | Initial repo-side checklist added for guard activation readiness; it records required shared state, signed decision binding, PEP/verifier integration, replay fixture, audit record, runbook, and customer approval evidence. Runtime enforcement activation, customer deployment proof, and production readiness remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the guard activation readiness PR is merged. |
| `docs/02-architecture/failure-mode-runtime-extensions.md` | NIST SP 800-162 ABAC policy-administration separation, Open Policy Agent policy/data management and decision/enforcement split, and AWS Verified Permissions schema/policy-store patterns. | Initial repo-side scoped runtime extension contract added for customer-specific failure modes without mutating the canonical registry. Live customer workflow coverage, downstream verifier integration, and enforcement activation remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the runtime failure-mode extensions PR is merged. |
| `docs/02-architecture/agentic-supply-chain-guard.md` | OWASP LLM03:2025 Supply Chain, SLSA provenance and verification, NIST SSDF SP 800-218 supplier and software-integrity practices, and OpenSSF Scorecard supply-chain risk signals. | Initial repo-side guard added for agentic supply-chain component provenance, integrity, least-privilege permission scope, generated-artifact review, domain-pack boundary evidence, adapter readiness, and replay evidence. Third-party behavior, live adapter execution, customer deployment, and enforcement activation remain not proven. | Architecture research tracker and current implementation evidence; exact PR/commit mapping is pending until the agentic supply-chain guard PR is merged. |
| `docs/02-architecture/crypto-authorization-core-buildout.md` | EIP-712, EIP-191, ERC-5267, ERC-7739, ERC-1271, EIP-6492, ERC-4337, ERC-7562, EIP-5792, ERC-7715, ERC-7579, ERC-6900, EIP-2, EIP-7702, ERC-7902, Safe, x402, EIP-3009, custody policy, package exports, CAIP identifiers, Chainalysis risk data. | Complete: 20/20 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/crypto-execution-admission-buildout.md` | EIP-5792, ERC-7715, ERC-7902, ERC-1271, ERC-4337, ERC-7769, ERC-7579, ERC-6900, EIP-7702, Safe guards, x402, Fireblocks, Turnkey, ERC-7683 and intent routing. | Complete: 12/12 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/crypto-intelligence-buildout.md` | ERC-4337, ERC-7562, EIP-7702, ERC-7683, x402, Safe guards, Turnkey, Fireblocks, Chainalysis risk reporting, NIST AI RMF, OpenTelemetry, CloudEvents, W3C PROV, OFAC data boundaries, Node perf/crypto, package exports. | Complete: 10/10 frozen steps. | Tracker-level research and implementation evidence. |
| `docs/02-architecture/crypto-engine-hardening-ii.md` | ERC-4337, ERC-7562, ERC-7579, EIP-7702, x402, Safe guards, OPA decision logs, AWS IAM deny precedence, Grafana dashboard guidance, OpenTelemetry limits, Node perf/crypto, package exports, NIST Privacy Framework, OWASP logging, GDPR, NIST AI RMF, `@noble/hashes`, Node 26 runtime baseline. | Steps 01-09 implemented; Step 10 blocked on production rollout infrastructure. | Tracker-level research and implementation evidence; Node 26 and production rollout remain no-go until conditions pass. |
| `docs/02-architecture/ai-action-control-plane-architecture.md` | Reference-monitor-style control plane, PDP/PEP/PIP/PAP separation, OPA-style decision/enforcement split, Kubernetes admission-controller analogy, Envoy external authorization, OpenAPI contract-first API surface, OpenTelemetry stability language, and Stripe idempotency. | Architecture language and verification-suite tracker added; implementation boundaries remain contract-first modular monolith, not a microservice split. | Architecture research tracker; exact source-to-commit attribution is not expanded for every architecture-language step. |
| `docs/02-architecture/attestor-language-contract.md` | Infrastructure naming and claim-boundary guidance for AI Action Control Plane, Consequence Admission Core, reference-monitor-style language, enforcement adapters, audit proof, and status/non-claim vocabulary. | Current public language contract for README/docs/repo profile alignment. | Architecture research tracker and terminology contract; not a runtime control by itself. |
| `docs/02-architecture/recipient-tenant-boundary-replay.md` | Tenant and recipient boundary replay cases for cross-tenant summaries, wrong-recipient support/email/export paths, review packets, and dashboard aggregation. | Initial replay contract and tests added for recipient/tenant boundary failure modes. | Architecture research tracker and replay-fixture evidence; production customer data boundaries remain deployment-specific. |
| `docs/02-architecture/replay-layer-placement.md` | Replay/idempotency layer placement across admission, presentation, downstream execution, webhooks, billing, and external consequences. | Initial placement contract added to keep replay controls at the correct boundary. | Architecture research tracker and implementation evidence; external enforcement stores remain deployment-specific. |
| `docs/02-architecture/scope-explosion-guard.md` | Scope explosion patterns from single action to batch, amount escalation, read-to-write expansion, and authority/scope mismatch. | Initial guard contract and tests added for requested-vs-approved scope diffs. | Architecture research tracker and control-binding evidence; customer-specific thresholds remain policy configuration. |

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

### 18. F1-F5 Audit Remediation Closure

- Step / PR / commit: F1-F5 project-owner supplied audit remediation queue; PR #326 merge commit `7029ea2afeec41a3afe29b9359dbdf2f844bfc99`; PR #327 merge commit `e4bca21903df7dd7ce144aefc5c7aebc559387e8`; final claim-alignment PR records this ledger update but cannot pre-record its own merge commit.
- Date if available: 2026-05-14.
- Trust surface: public README positioning, audit remediation tracker, research provenance ledger, F1 backlog closure, F5 crypto trust-delegation boundary, and final non-claim language.
- Protected principle: no overclaim; proof integrity; auditability; runtime readiness; customer authority.
- Research anchor / source used, if recorded: repository-internal validation over project-owner supplied audit reports F1 through F5, plus the external standards already recorded in the F1-F5 validation notes. This closure step does not introduce a new external standard.
- Repository evidence:
  - Contract/documentation evidence: `docs/audit/attestor-audit-remediation-tracker.md`, `docs/audit/f1-backlog-closure-validation.md`, `docs/audit/f5-crypto-trust-delegation-boundary-validation.md`, `docs/audit/final-claim-alignment-validation.md`, `README.md`, and this provenance ledger.
  - Test evidence: `tests/f1-backlog-closure-validation.test.ts`, `tests/f5-crypto-trust-delegation-boundary-validation.test.ts`, `tests/final-claim-alignment-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
  - PR evidence: PR #326 closes the F5 crypto authorization trust-delegation accepted limitation; PR #327 closes the F1 backlog evidence pass.
- Implemented control: Converts the F1-F5 report queue into a machine-checked tracker state where each row is fixed, invalid-as-stated, superseded, accepted as a limitation, partial with a stated live/customer boundary, or backlogged with evidence. Public docs keep the AI Action Control Plane positioning while preserving evaluation-release, customer-enforcement, and no-certification boundaries.
- Tests / verification: `npm run test:final-claim-alignment-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This closes the repository-side F1-F5 queue only. It does not prove external compliance certification, production deployment readiness, universal non-bypassability, public transparency-log semantics, external WORM/SIEM anchoring, external KMS/HSM custody, live multi-provider LLM resilience, or chain-authoritative crypto verification without verifiable adapter evidence.
- Status: complete for F1-F5 repository-side audit remediation tracking once the final claim-alignment PR is merged and verified on `origin/master`.

### 19. F8 Operational Resilience Audit Closure

- Step / PR / commit: F8 project-owner supplied operational resilience / chaos report; this closure PR records tracker and validation evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-14.
- Trust surface: startup, health, readiness, worker probes, async dead-letter recovery, degraded-mode grants, production-shared storage gates, webhook ingress, PKI bootstrap, PostgreSQL/Redis dependency posture, and rehearsal evidence.
- Protected principle: runtime readiness; operational boundedness; fail-closed boundary; no overclaim; data minimization and redaction.
- Research anchor / source used, if recorded: repository-internal validation over the F8 report plus already-recorded Kubernetes probes, Google SRE, OWASP API Security, NIST SP 800-53, NIST SP 800-160, Stripe webhook, and BullMQ retry/stalled-job anchors.
- Repository evidence:
  - Contract/documentation evidence: `docs/audit/f8-operational-resilience-validation.md`, `docs/audit/attestor-audit-remediation-tracker.md`, `docs/02-architecture/hosted-production-trust-hardening.md`, `docs/08-deployment/production-readiness.md`, and `docs/08-deployment/production-rehearsal-manifest.md`.
  - Test evidence: `tests/f8-operational-resilience-validation.test.ts`, `tests/hosted-production-runtime-health-contract.test.ts`, `tests/service-stripe-webhook-service.test.ts`, `tests/service-email-webhook-service.test.ts`, `tests/production-rehearsal-async-recovery.test.ts`, and `tests/production-rehearsal-backup-restore-dr.test.ts`.
- Implemented control: Converts the F8 report into a machine-checked tracker state where startup/health/readiness separation, health PKI redaction, degraded-mode TTL enforcement, worker readiness, webhook signature proof, and production-shared startup fail-fast are closed, while DLQ HA proof, PKI distributed locking, PostgreSQL circuit-breaker policy, exact degraded-grant expiry, and full automated fault injection remain explicit boundaries.
- Tests / verification: `npm run test:f8-operational-resilience-validation`, `npm run test:hosted-production-runtime-health-contract`, `npm run test:service-stripe-webhook-service`, `npm run test:service-email-webhook-service`, `npm run test:production-rehearsal-async-recovery`, `npm run test:production-rehearsal-backup-restore-dr`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This closes the repository-side F8 queue only. It does not prove a live Kubernetes deployment, external PostgreSQL/Redis behavior, distributed PKI locking, KMS/HSM custody, customer-operated worker drain, webhook smoke tests, observability delivery, or full fault-injection chaos practice.
- Status: complete for F8 repository-side audit remediation tracking once this PR is merged and verified on `origin/master`.

### 20. F9 Compliance Gap Analysis Closure

- Step / PR / commit: F9 project-owner supplied compliance gap report for SOC 2 TSC, ISO/IEC 27001:2022, and ISO/IEC 42001:2023; this closure PR records governance documentation, tracker evidence, and validation tests but cannot pre-record its own merge commit.
- Date if available: 2026-05-14.
- Trust surface: compliance engineering-anchor mapping, evidence boundaries, shared responsibility, provider inventory, retention, data residency, privacy, cryptography, security testing, segregation of duties, DR documentation, and AI accessibility/bias boundary.
- Protected principle: no overclaim; auditability; customer authority; data minimization and redaction; runtime readiness; proof integrity.
- Research anchor / source used, if recorded: AICPA Trust Services Criteria 2017 with revised points of focus 2022; ISO/IEC 27001:2022; ISO/IEC 42001:2023; NIST CSF 2.0; NIST AI RMF; NIST SP 800-115; GDPR; EU AI Act; AWS shared responsibility model. These are used as engineering anchors only, not as assurance claims.
- Repository evidence:
  - Contract/documentation evidence: `docs/03-governance/soc2-tsc-mapping.md`, `docs/03-governance/iso27001-2022-annex-a-mapping.md`, `docs/03-governance/iso42001-2023-annex-a-mapping.md`, `docs/03-governance/compliance-evidence-boundary.md`, `docs/03-governance/shared-responsibility-matrix.md`, `docs/03-governance/segregation-of-duties.md`, `docs/03-governance/third-party-providers.md`, `docs/03-governance/data-residency.md`, `docs/03-governance/retention-policy.md`, `docs/03-governance/security-testing.md`, `docs/03-governance/cryptography-policy.md`, `docs/03-governance/privacy-notice-template.md`, `docs/03-governance/ai-accessibility-bias-boundary.md`, `docs/audit/f9-compliance-gap-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/f9-compliance-gap-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Converts F9 from a narrative compliance gap report into machine-checked documentation coverage. SOC 2, ISO/IEC 27001, and ISO/IEC 42001 mappings are discoverable; evidence-pack boundaries are explicit; customer/operator responsibilities are separated from repository controls; provider, retention, residency, testing, privacy, cryptography, and SoD docs exist.
- Tests / verification: `npm run test:f9-compliance-gap-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This closes the repository-side F9 documentation queue only. It does not prove SOC 2 Type I/II assurance, ISO management-system audit completion, GDPR compliance, EU AI Act conformity, live data-residency controls, customer access reviews, vendor due-diligence records, legal notices, independent penetration-test results, or customer production operations.
- Status: complete for F9 repository-side compliance documentation once this PR is merged and verified on `origin/master`.

### 21. F10 Customer Escape-Hatch Abuse Closure

- Step / PR / commit: F10 project-owner supplied customer escape-hatch abuse report; this closure PR records validation evidence but cannot pre-record its own merge commit.
- Trust surface: verifier downgrade flags, customer-gate proof requirements, no-go bypass handling, hosted OIDC insecure HTTP override, account auth key-source observability, keyless CA test reset, degraded-mode break-glass TTL, policy shared-counter defaults, and aggregate escape-hatch telemetry.
- Protected principle: fail-closed boundary; auditability; customer authority; no overclaim; runtime readiness; data minimization and redaction.
- Research anchor / source used, if recorded: OWASP API Security Top 10 2023, NIST SP 800-53 Rev. 5, NIST SP 800-92, SOC 2 TSC, ISO/IEC 27001:2022, and ISO/IEC 42001:2023. These are engineering anchors only, not assurance claims.
- Repository evidence:
  - Contract/code evidence: `src/signing/verify-cli.ts`, `src/consequence-admission/customer-gate.ts`, `src/consequence-admission/no-go-condition-ledger.ts`, `src/consequence-admission/escape-hatch-telemetry.ts`, `src/service/account-oidc.ts`, `src/service/http/routes/core-routes.ts`, `src/signing/keyless-signer.ts`, `docs/audit/f10-escape-hatch-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/f10-escape-hatch-validation.test.ts`, `tests/consequence-admission-customer-gate.test.ts`, `tests/no-go-condition-ledger.test.ts`, `tests/account-oidc-linking-policy.test.ts`, `tests/service-core-routes.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Converts F10 from an escape-hatch inventory into machine-checked repository evidence. Legacy flat verification now requires a reason; proof-skip is separately visible; natural-language bypass attempts can be inferred without storing raw text; insecure OIDC HTTP is blocked in production-like runtimes; health reports nonsecret auth key-source labels; the generic keyless CA reset export is removed; and a digest-only escape-hatch telemetry summary contract exists.
- Tests / verification: `npm run test:f10-escape-hatch-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This closes the repository-side F10 queue only. It does not prove persisted SIEM/admin reporting, live OIDC provider operation, customer downstream gateway enforcement, every upstream text extraction path into the no-go scanner, or live production operator monitoring.
- Status: complete for F10 repository-side validation once this PR is merged and verified on `origin/master`.

### 22. F11 Supply Chain Depth Closure

- Step / PR / commit: F11 project-owner supplied runtime / model / data supply-chain depth report; this closure PR records validation evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: container base images, observability runtime images, critical runtime dependencies, release SBOM packaging, release provenance permissions, OpenAI model observation, generated adapter / MCP vocabulary, webhook ingress, and connector/plugin supply-chain posture.
- Protected principle: proof integrity; release provenance; runtime readiness; auditability; no overclaim; data minimization and redaction.
- Research anchor / source used, if recorded: SLSA v1.0, NIST SP 800-161 Rev. 1, NIST SP 800-218 SSDF, CycloneDX SBOM, Sigstore in-toto attestation concepts, OWASP LLM03 supply chain, and Docker Hub tag/digest lookups for the pinned reference images. These are engineering anchors only, not assurance claims.
- Repository evidence:
  - Contract/code evidence: `Dockerfile`, `docker-compose.ha.yml`, `docker-compose.dr.yml`, `docker-compose.observability.yml`, `ops/kubernetes/observability/deployment.yaml`, `ops/kubernetes/observability/providers/grafana-alloy/patch-deployment.yaml`, `scripts/check-supply-chain-baseline.mjs`, `src/api/openai.ts`, `.github/workflows/release-provenance.yml`, `package.json`, `package-lock.json`, `docs/audit/f11-supply-chain-depth-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/f11-supply-chain-depth-validation.test.ts`, `tests/security-baseline-docs.test.ts`, `tests/agentic-supply-chain-guard.test.ts`, `tests/f2-llm-provider-supply-chain-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Converts F11 from a runtime supply-chain report into machine-checked repository evidence. External runtime images in shipped compose/Kubernetes references are digest-pinned; critical runtime dependencies are exact-pinned; the supply-chain baseline rejects missing image digests and `:latest`; OpenAI responses now emit configured-vs-observed model telemetry; and SBOM/release provenance/webhook evidence is indexed without overclaim.
- Tests / verification: `npm run test:f11-supply-chain-depth-validation`, `npm run security:supply-chain-baseline`, `npm run test:security-baseline-docs`, `npm run test:agentic-supply-chain-guard`, `npm run test:f2-llm-provider-supply-chain-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This closes the repository-side F11 validation queue only. It does not prove multi-provider LLM failover, persisted model drift enforcement, universal evidence re-fetch/re-hash, signed generated-adapter provenance, MCP registry implementation, external production image-refresh operations, or an independently assessed SLSA level.
- Status: complete for F11 repository-side validation once this PR is merged and verified on `origin/master`.

### 23. F12 Continuous Red-Team Automation Closure

- Step / PR / commit: F12 project-owner supplied continuous red-team automation report; this closure PR records validation evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: F-series regression tests, red-team replay fixtures, canonicalizer/signature verifier robustness smoke, coordinated disclosure path, audit tracker, and research provenance ledger.
- Protected principle: auditability; proof integrity; fail-closed boundary; no overclaim; operational boundedness; release provenance.
- Research anchor / source used, if recorded: NIST SP 800-115, NIST SP 800-216, NIST SP 800-218 SSDF, ISO/IEC 29147, ISO/IEC 30111, OWASP DSOMM, OWASP ASVS, AgentDojo, The Agent Company, DEF CON Generative Red Team, OpenAI Preparedness Framework, Anthropic Responsible Scaling Policy, MITRE Engenuity ATT&CK Evaluations, and EU AI Act Art. 60. These are engineering anchors only, not benchmark or certification claims.
- Repository evidence:
  - Contract/code evidence: `.github/workflows/f-series-continuous-validation.yml`, `scripts/run-f-series-continuous-validation.mjs`, `SECURITY.md`, `/.well-known/security.txt`, `docs/audit/f12-continuous-red-team-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/f12-continuous-red-team-validation.test.ts`, `tests/f12-canonicalizer-fuzz-smoke.test.ts`, `tests/security-baseline-docs.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Converts F12 from a point-in-time red-team automation report into machine-checked repository evidence. F-series validation and red-team replay now have a secretless nightly / PR workflow; canonical JSON signing has deterministic fuzz smoke; coordinated disclosure has public metadata and response targets; and the tracker records remaining benchmark, live-runtime, paid-bounty, and production-traffic intake boundaries without overclaim.
- Tests / verification: `npm run test:f12-continuous-red-team-validation`, `npm run test:f12-canonicalizer-fuzz-smoke`, `npm run audit:f-series-continuous-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This closes the repository-side F12 validation queue only. It does not prove AgentDojo benchmark execution, public leaderboard participation, paid bug-bounty operation, random-byte fuzzing at scale, production-traffic pattern intake, live customer-runtime red-team execution, or external penetration-test completion.
- Status: complete for F12 repository-side validation once this PR is merged and verified on `origin/master`.

### 24. LLM Provider Registry Contract

- Step / PR / commit: LLM provider registry, OpenAI runtime policy, and OpenAI reasoning live smoke proof unlock; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: Attestor-owned optional live-model proof path, provider selection, provider credentials, timeout/output-token budget policy, live smoke proof, rate-limit/backoff policy, structured-output capability, provider/model drift context, and proof-context minimization.
- Protected principle: fail-closed boundary; customer authority; data minimization and redaction; runtime readiness; auditability; operational boundedness; no overclaim.
- Research anchor / source used, if recorded: OpenAI Responses API, OpenAI structured outputs, OpenAI rate-limit guidance, Anthropic Messages/tool-use/rate-limit docs, Vertex AI structured output and quotas, and Azure OpenAI structured outputs/quotas. These are engineering anchors only, not provider certification or production-readiness claims.
- Repository evidence:
  - Contract/code evidence: `src/api/llm-provider-registry.ts`, `src/api/llm-provider-models.ts`, `src/api/openai.ts`, `scripts/probe-openai-live-smoke.ts`, `scripts/run-live-ops-gate.mjs`, `src/financial/types.ts`, `src/financial/cli.ts`, `docs/02-architecture/llm-provider-registry.md`, `docs/03-governance/third-party-providers.md`, `docs/08-deployment/deployment.md`, `docs/08-deployment/production-readiness.md`, `docs/audit/f2-llm-provider-supply-chain-validation.md`, `docs/audit/f11-supply-chain-depth-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/llm-provider-registry.test.ts`, `tests/openai-runtime-policy.test.ts`, `tests/openai-live-smoke-proof.test.ts`, `tests/verify-live-ops-gate.test.ts`, `tests/f2-llm-provider-supply-chain-validation.test.ts`, `tests/f11-supply-chain-depth-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Adds a deterministic provider registry contract that records OpenAI as the only wired provider and Anthropic, Vertex AI, and Azure OpenAI as planned provider surfaces. Production/failover-required route evaluation fails closed until a second provider and live smoke proof evidence are available. The OpenAI wrapper now disables hidden SDK retries, applies per-request timeout and output-token budget policy, uses jittered bounded retries, sets provider response storage to `false`, returns digest-only provider proof context, and exposes an opt-in OpenAI reasoning live smoke probe whose output can gate production-like reasoning calls by digest, timestamp, model, and purpose. The optional financial live-model proof carries provider context without storing raw prompt or provider bodies.
- Tests / verification: `npm run test:llm-provider-registry`, `npm run test:openai-runtime-policy`, `npm run test:openai-live-smoke-proof`, `npm run test:verify-live-ops-gate`, `npm run test:f2-llm-provider-supply-chain-validation`, `npm run test:f11-supply-chain-depth-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live multi-provider client implementation. It does not prove Anthropic, Vertex AI, or Azure OpenAI calls; live failover; hosted consequence-admission dependence on live LLMs; OpenAI vision smoke proof; non-OpenAI smoke proof; or production provider readiness.
- Status: complete for repository-side registry, OpenAI runtime-policy, and OpenAI reasoning live-smoke contract once this PR is merged and verified on `origin/master`.

### 25. Tenant Signer Live Provider Proof Gate

- Step / PR / commit: Tenant signer / external KMS structured live-proof gate; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: per-tenant release signing boundary, external KMS/HSM provider proof, confidential signing attestation input, key-reference minimization, signer compromise blast-radius claims, and fail-closed production promotion gates.
- Protected principle: tenant isolation; release provenance; proof integrity; fail-closed boundary; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: AWS KMS asymmetric keys and Sign API, Google Cloud KMS algorithms and protection levels, Azure Key Vault key operations and Managed HSM key isolation, and Azure Attestation concepts. These are engineering anchors only, not cloud-provider certification or live deployment evidence.
- Repository evidence:
  - Contract/code evidence: `src/service/bootstrap/release-tenant-signer-boundary.ts`, `docs/03-governance/cryptography-policy.md`, `docs/08-deployment/production-readiness.md`, `docs/audit/f6-tenant-blast-radius-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/production-tenant-signer-boundary.test.ts` and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Replaces the previous bare `liveProviderVerified` readiness input with a structured digest-only live provider proof evaluation. The descriptor only marks live provider verification when the proof is fresh, sign/verify successful, bound to the tenant digest, key-reference digest, key id, provider class, algorithm, public verification key reference, and the standard Attestor challenge digest. Missing, stale, failed, or mismatched proof fails closed.
- Tests / verification: `npm run test:production-tenant-signer-boundary` and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live AWS, Google Cloud, Azure, HSM, or confidential-compute signer adapter. Runtime release-token issuance still uses the existing release signing provider path, and external KMS/HSM-backed release signing remains unproven until a real provider adapter, live sign/verify probe, rotation plan, compromise response, and deployment evidence exist.
- Status: complete for repository-side structured proof gate once this PR is merged and verified on `origin/master`.

### 26. Signed Bearer Customer Gate

- Step / PR / commit: Signed bearer token customer-gate compatibility path; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: customer-side consequence gate, signed release-token presentation, admission proof binding, tenant/audience binding, bearer-token downgrade risk, and protected enforcement routing.
- Protected principle: customer authority; fail-closed boundary; proof integrity; replay and idempotency safety; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: OAuth 2.0 Bearer Token Usage RFC 6750, JWT Best Current Practices RFC 8725, OAuth DPoP RFC 9449, OAuth mTLS-bound tokens RFC 8705, and existing release-enforcement-plane DPoP / mTLS / HTTP Message Signature repository evidence. These are engineering anchors only, not OAuth certification or production customer-enforcement evidence.
- Repository evidence:
  - Contract/code evidence: `src/consequence-admission/customer-gate.ts`, `src/release-kernel/release-token.ts`, `docs/01-overview/customer-admission-gate.md`, `docs/audit/f2-customer-gate-enforcement-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/consequence-admission-customer-gate.test.ts`, `tests/research-provenance-ledger.test.ts`, and `tests/audit-remediation-tracker.test.ts`.
- Implemented control: Adds an optional signed bearer release-token verifier to the customer gate. It verifies the compact signed release token, audience, tenant binding, and admission `release-token` proof reference by token id and digest, while recording only token digest/id metadata. It fails closed when the base customer gate holds, the token is missing/malformed/invalid, proof binding is absent, the token requires online introspection, or sender-constrained confirmation is present.
- Tests / verification: `npm run test:consequence-admission-customer-gate`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is bearer-only compatibility for lower-risk customer integrations. It does not consume replay, perform online introspection, verify DPoP/mTLS/SPIFFE/HTTP Message Signature sender constraints, auto-issue tokens from generic consequence-admission responses, or prove customer runtime adoption. R3/R4 or production-sensitive paths still require `attestor/release-enforcement-plane` or equivalent customer-operated protected enforcement.
- Status: complete for repository-side signed bearer customer-gate compatibility once this PR is merged and verified on `origin/master`.

### 27. Tenant KMS Provider Capability Contract

- Step / PR / commit: Tenant signer provider-native algorithm and input-mode contract; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: per-tenant release signing boundary, external KMS/HSM adapter portability, provider algorithm mapping, raw-vs-digest signing input, and unsupported provider/algorithm downgrade risk.
- Protected principle: tenant isolation; release provenance; proof integrity; fail-closed boundary; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: AWS KMS Sign API records that callers must record the KMS key and signing algorithm and must choose RAW versus DIGEST message type; Google Cloud KMS algorithms and asymmetricSign docs distinguish raw Ed25519 from digest-based ECDSA/RSA signing and expose protection levels; Azure Key Vault / Managed HSM Sign docs describe digest signing and ES/PS/RS algorithm ids; Azure Managed HSM docs record single-tenant HSM isolation. These are engineering anchors only, not live cloud-provider evidence.
- Repository evidence:
  - Contract/code evidence: `src/service/bootstrap/release-tenant-signer-boundary.ts`, `docs/03-governance/cryptography-policy.md`, `docs/08-deployment/production-readiness.md`, `docs/audit/f6-tenant-blast-radius-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/production-tenant-signer-boundary.test.ts`, `tests/research-provenance-ledger.test.ts`, and `tests/audit-remediation-tracker.test.ts`.
- Implemented control: Adds a provider capability resolver that maps Attestor release signer algorithms to provider-native algorithm ids and sign-input modes for AWS KMS, Google Cloud KMS, Azure Key Vault / Managed HSM, runtime-local, and the fake external KMS test adapter. Descriptors and live provider proofs now bind the portable JOSE algorithm, provider-native algorithm, and raw/digest input mode. Unsupported provider/algorithm pairs, including Azure Key Vault Ed25519, fail closed before satisfying the tenant signer contract.
- Tests / verification: `npm run test:production-tenant-signer-boundary`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live AWS, Google Cloud, Azure, HSM, or confidential-compute signer adapter. Runtime release-token issuance still uses the existing release signing provider path, and external KMS/HSM-backed release signing remains unproven until a real provider adapter, live sign/verify probe, signature-format conversion, rotation plan, compromise response, and deployment evidence exist.
- Status: complete for repository-side provider capability contract once this PR is merged and verified on `origin/master`.

### 28. Consequence Shared-Store Request Guard

- Step / PR / commit: `production-shared` consequence shared-store request-guard bridge; this PR records repository-side guard evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: multi-node consequence-admission state, retry/replay/idempotency ledgers, shadow history, Policy Foundry hosted wizard state, audit/dashboard source history, protected API request handling, and startup diagnostics.
- Protected principle: fail-closed boundary; tenant isolation; replay and idempotency safety; auditability; runtime readiness; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: PostgreSQL `INSERT ... ON CONFLICT` for atomic conflict arbitration, PostgreSQL transaction isolation and row/advisory locking, PostgreSQL `FOR UPDATE ... SKIP LOCKED` queue-like worker semantics, PostgreSQL row security policies for tenant-scoped data paths, and Debezium Outbox Event Router insert-oriented event export/de-duplication shape. These are engineering anchors only, not an implemented shared database, RLS policy set, Debezium connector, or production deployment proof.
- Repository evidence:
  - Contract/code evidence: `src/service/bootstrap/consequence-shared-store-profile.ts`, `src/service/bootstrap/production-storage-path.ts`, `src/service/bootstrap/production-shared-request-guard.ts`, `src/service/bootstrap/api-route-runtime.ts`, `src/service/bootstrap/server.ts`, `docs/02-architecture/production-storage-path.md`, `docs/08-deployment/production-readiness.md`, and `docs/audit/consequence-shared-store-profile-validation.md`.
  - Test evidence: `tests/consequence-shared-store-profile.test.ts`, `tests/production-storage-path.test.ts`, `tests/production-shared-request-guard.test.ts`, `tests/production-shared-preflight-bootstrap.test.ts`, `tests/f8-operational-resilience-validation.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Promotes the existing consequence shared-store profile from readiness-only diagnostics into the `production-shared` protected request and startup boundary. Non-preflight `/api/v1/*` routes now require both async shared release/policy authority stores and `consequenceSharedStoreProfile.readyForSelectedProfile=true`; startup diagnostics can fail closed on consequence shared-store blockers even if the broad production storage path is otherwise ready.
- Tests / verification: `npm run test:consequence-shared-store-profile`, `npm run test:production-storage-path`, `npm run test:production-shared-request-guard`, `npm run test:production-shared-preflight-bootstrap`, `npm run test:f8-operational-resilience-validation`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a shared durable backend implementation. It does not create PostgreSQL schemas, migrate file histories, wire RLS policies, add Redis-backed retry/replay stores, run Debezium, prove backup/restore, or verify a customer production environment.
- Status: complete for repository-side consequence shared-store guard bridge once this PR is merged and verified on `origin/master`.

### 29. LLM Provider Failover Compatibility Gate

- Step / PR / commit: LLM provider route compatibility gate; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: Attestor-owned optional live-model proof path, provider route selection, failover readiness, structured-output parity, tool-routing parity, rate-limit/backoff policy, provider/model drift context, and proof-context minimization.
- Protected principle: fail-closed boundary; customer authority; data minimization and redaction; runtime readiness; auditability; operational boundedness; no overclaim.
- Research anchor / source used, if recorded: OpenAI Responses API and Structured Outputs docs, OpenAI rate-limit retry guidance, Anthropic Messages/tool-use/rate-limit docs, Vertex AI structured output and quotas, and Azure OpenAI structured outputs/quotas. These are engineering anchors only, not provider certification, live provider evidence, or production-readiness evidence.
- Repository evidence:
  - Contract/code evidence: `src/api/llm-provider-registry.ts`, `docs/02-architecture/llm-provider-registry.md`, `docs/03-governance/third-party-providers.md`, `docs/audit/f2-llm-provider-supply-chain-validation.md`, `docs/audit/f11-supply-chain-depth-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/llm-provider-registry.test.ts`, `tests/f2-llm-provider-supply-chain-validation.test.ts`, `tests/f11-supply-chain-depth-validation.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Tightens the provider registry so failover readiness cannot be satisfied by a generic second wired provider. A fallback provider must be wired for the same requested purpose, have a configured model for that purpose, satisfy required text/vision/tool/structured-output capabilities, and expose provider rate-limit signals before it can count as route-compatible. A wired but incompatible fallback fails closed with `llm-provider-compatible-failover-provider-not-ready`.
- Tests / verification: `npm run test:llm-provider-registry`, `npm run test:f2-llm-provider-supply-chain-validation`, `npm run test:f11-supply-chain-depth-validation`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is still not a live multi-provider client implementation. It does not prove Anthropic, Vertex AI, or Azure OpenAI calls; runtime failover execution; OpenAI vision smoke proof; non-OpenAI smoke proof; provider-specific credential isolation; customer provider approval; or hosted LLM runtime readiness.
- Status: complete for repository-side failover compatibility gating once this PR is merged and verified on `origin/master`.

### 30. Customer Gate Release-Enforcement Proof Consumer

- Step / PR / commit: Customer-gate protected release-enforcement verifier consumer; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: customer-side consequence gate, signed release-token presentation, DPoP/mTLS/SPIFFE/HTTP Message Signature sender-constrained verifier output, token introspection liveness, replay consumption, tenant/audience binding, and admission proof binding.
- Protected principle: customer authority; fail-closed boundary; proof integrity; replay and idempotency safety; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: OAuth DPoP RFC 9449, OAuth mTLS-bound tokens RFC 8705, OAuth Token Introspection RFC 7662, OAuth Bearer Token Usage RFC 6750, SPIFFE overview, and existing release-enforcement-plane DPoP / mTLS / SPIFFE repository evidence. These are engineering anchors only, not OAuth certification, SPIFFE certification, customer runtime adoption, or production enforcement evidence.
- Repository evidence:
  - Contract/code evidence: `src/consequence-admission/customer-gate.ts`, `src/release-enforcement-plane/offline-verifier.ts`, `src/release-enforcement-plane/online-verifier.ts`, `docs/01-overview/customer-admission-gate.md`, `docs/audit/f2-customer-gate-enforcement-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/consequence-admission-customer-gate.test.ts`, `tests/f2-customer-gate-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Adds a customer-gate release-enforcement proof consumer that accepts an already verified release-enforcement result only when it is valid, sender-constrained, online-checked, replay-consumed, tenant/audience matched, and bound to an admission `release-token` proof reference by token id and digest. The returned decision stores digest/token/verifier metadata only, not the raw release token or DPoP/sender proof.
- Tests / verification: `npm run test:consequence-admission-customer-gate`, `npm run test:f2-customer-gate-validation`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a customer PEP runtime, not generic consequence-to-token issuance, not a hosted enforcement service, and not a new DPoP/mTLS/SPIFFE verifier. The helper consumes release-enforcement verifier evidence produced elsewhere; customer deployment, replay store durability, token-introspection authority, trust anchors, and runtime adoption remain required before a production enforcement claim.
- Status: complete for repository-side protected verifier-consumer contract once this PR is merged and verified on `origin/master`.

### 31. Generic Admission Protected Release-Token Issuance

- Step / PR / commit: Generic high-risk admission protected release-token issuance contract; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: generic hosted admission, high-risk downstream authorization, sender-constrained release-token issuance, tenant/audience binding, compiled policy provenance, raw-token minimization, and shadow/audit recording.
- Protected principle: customer authority; fail-closed boundary; proof integrity; replay and idempotency safety; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: OAuth Token Exchange RFC 8693 for audience/resource/scope-bound downstream credentials, OAuth Rich Authorization Requests RFC 9396 for structured authorization detail framing, JWT BCP RFC 8725 for signed-token safety posture, OAuth DPoP RFC 9449 for sender-constrained presentation, OAuth Token Introspection RFC 7662 for liveness, and OAuth Bearer Token Usage RFC 6750 as the contrast case for bearer-only risk. These are engineering anchors only, not OAuth certification, live authorization-server proof, customer runtime adoption, or production enforcement evidence.
- Repository evidence:
  - Contract/code evidence: `src/consequence-admission/generic-protected-release-token.ts`, `src/service/http/routes/generic-admission-routes.ts`, `docs/01-overview/consequence-admission-quickstart.md`, `docs/audit/f2-customer-gate-enforcement-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/generic-admission-protected-release-token.test.ts`, `tests/generic-admission-routes.test.ts`, `tests/f2-customer-gate-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Adds a generic admission release-token issuer helper and route hook. Allowed high-risk enforcing generic admissions can be recreated with a `release-token` proof reference only after a sender-constrained confirmation, tenant id, and high-risk reviewer reference are present. The issued token is tenant-bound, audience-scoped to the downstream system, requires introspection/replay consumption through the release-enforcement plane, and carries compiled policy provenance. The sanitized envelope and shadow path store token digest/metadata only; the raw token is returned only as immediate authorization material.
- Tests / verification: `npm run test:generic-admission-protected-release-token`, `npm run test:generic-admission-routes`, `npm run test:f2-customer-gate-validation`, `npm run test:audit-remediation-tracker`, `npm run test:research-provenance-ledger`, and `npm run test:consequence-admission-package-surface`.
- Remaining limitation or no-go condition: This is not a customer PEP runtime, not a live authorization server, and not durable replay/introspection storage. Standalone route imports can still choose compatibility behavior if they intentionally register the generic route without the hosted bootstrap route guard; production claims require the hosted route guard, token-introspection store, replay store, sender-proof verifier, and non-bypassable downstream PEP to be active.
- Status: complete for repository-side generic high-risk consequence-to-token binding contract once this PR is merged and verified on `origin/master`.

### 32. Customer PEP Runtime Adoption Proof

- Step / PR / commit: Customer PEP runtime adoption proof contract; this PR records repository-side contract evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: customer-operated PEP, Envoy/Istio/OPA/Hono/Node enforcement edge, release-enforcement verifier adoption, sender-constrained release-token presentation, token-introspection liveness, replay consumption, route bypass prevention, runtime controls, and activation evidence.
- Protected principle: customer authority; fail-closed boundary; proof integrity; replay and idempotency safety; data minimization and redaction; runtime readiness; no overclaim.
- Research anchor / source used, if recorded: Envoy external authorization filter delegates HTTP authorization checks to an external service and documents fail-open risk through `failure_mode_allow`; Istio `CUSTOM` authorization delegates access control to an external authorizer that implements Envoy `ext_authz`; the OPA-Envoy plugin implements Envoy External Authorization and supports policy decisions outside the application; OAuth DPoP RFC 9449 and OAuth mTLS RFC 8705 define sender-constrained token use; OAuth Token Introspection RFC 7662 anchors active-token liveness checks; SPIFFE records workload identity with short-lived SVIDs. These are engineering anchors only, not live customer deployment, OAuth certification, SPIFFE certification, or production enforcement evidence.
- Repository evidence:
  - Contract/code evidence: `src/consequence-admission/customer-pep-runtime-adoption.ts`, `src/consequence-admission/protected-enforcement-profile.ts`, `src/release-enforcement-plane/envoy-ext-authz.ts`, `docs/audit/f2-customer-gate-enforcement-validation.md`, and `docs/audit/attestor-audit-remediation-tracker.md`.
  - Test evidence: `tests/customer-pep-runtime-adoption.test.ts`, `tests/f2-customer-gate-validation.test.ts`, `tests/audit-remediation-tracker.test.ts`, `tests/research-provenance-ledger.test.ts`, and `scripts/probe-consequence-admission-package-surface.mjs`.
- Implemented control: Adds a scoped customer PEP runtime adoption proof that is ready only when a release-enforcement-plane protected profile is active, all protected routes are covered, the runtime is fail-closed with no bypass routes, the verifier is integrated, sender-constrained presentation modes are used, online introspection and replay consumption are required, proof/audience/tenant bindings are required, replay and introspection stores are durable, runtime health/rollback/kill-switch/monitoring/audit/customer approval evidence is present, activation handoff and receipt digests are bound, and raw token/payload/provider-body storage is disabled.
- Tests / verification: `npm run test:customer-pep-runtime-adoption`, `npm run test:f2-customer-gate-validation`, `npm run test:audit-remediation-tracker`, `npm run test:research-provenance-ledger`, and `npm run test:consequence-admission-package-surface`.
- Remaining limitation or no-go condition: This is not a deployed customer PEP, not hosted production configuration proof, not a shared durable store implementation, and not a live Envoy/Istio/OPA/Hono/Node rollout. It proves the shape and completeness of scoped runtime adoption evidence; live deployment, store migration, traffic routing, customer operation, and production rehearsal remain external proof.
- Status: complete for repository-side customer PEP runtime adoption proof contract once this PR is merged and verified on `origin/master`.

### 33. Hosted Generic Admission Protected Route Guard

- Step / PR / commit: Hosted generic admission protected route guard; this PR records repository-side configuration evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: hosted generic admission route, runtime bootstrap dependency wiring, production-shared readiness, protected release-token issuer presence, sender-confirmation source, raw-token minimization, and compatibility-mode bypass prevention.
- Protected principle: customer authority; fail-closed boundary; proof integrity; data minimization and redaction; runtime readiness; no overclaim.
- Research anchor / source used, if recorded: OAuth Token Exchange RFC 8693 for audience/scope-bound downstream credentials, OAuth Rich Authorization Requests RFC 9396 for structured authorization details, JWT BCP RFC 8725 for signed-token safety posture, OAuth DPoP RFC 9449 and OAuth mTLS RFC 8705 for sender-constrained token use, OAuth Token Introspection RFC 7662 for active-token liveness checks, and Envoy external authorization failure-mode documentation as the fail-closed contrast. These are engineering anchors only, not OAuth certification, live authorization-server proof, Envoy/Istio deployment proof, or production readiness evidence.
- Repository evidence:
  - Contract/code evidence: `src/service/generic-admission-protected-route.ts`, `src/service/bootstrap/routes.ts`, `src/service/bootstrap/api-route-runtime.ts`, `src/service/http/routes/core-routes.ts`, `docs/01-overview/consequence-admission-quickstart.md`, and `docs/audit/f2-customer-gate-enforcement-validation.md`.
  - Test evidence: `tests/generic-admission-protected-route.test.ts`, `tests/generic-admission-routes.test.ts`, `tests/generic-admission-protected-release-token.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Adds a machine-readable hosted route proof for `POST /api/v1/admissions`, wires hosted bootstrap to require protected release-token issuance for high-risk generic admissions, and exposes `genericAdmissionProtectedRoute` through health/readiness diagnostics. The proof now distinguishes runtime-local issuers from external KMS/HSM issuer boundaries and requires structured issuer boundary evidence with a valid live provider proof before `production-shared` route readiness can clear. The proof records that raw tokens are caller-only authorization material and not stored in admissions or shadow records.
- Tests / verification: `npm run test:generic-admission-protected-route`, `npm run test:generic-admission-routes`, `npm run test:generic-admission-protected-release-token`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live authorization server, live external KMS/HSM signer adapter, live deployed replay/introspection backend operation, deployed customer PEP, or production deployment proof. The hosted route can issue DPoP-confirmed protected tokens in non-production profiles, but production-shared readiness stays blocked until structured external issuer boundary proof, shared replay/introspection storage, and downstream enforcement evidence are present.
- Status: complete for repository-side hosted generic protected route guard once this PR is merged and verified on `origin/master`.

### 34. Hosted Generic Admission DPoP Issuer Bridge

- Step / PR / commit: Hosted generic admission DPoP issuer bridge; this PR records repository-side active bridge evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: hosted generic admission route, token-request DPoP proof validation, `cnf.jkt` sender confirmation, runtime release-token issuer handoff, raw-proof/raw-token minimization, high-risk route fail-closed behavior, and production-shared issuer boundary.
- Protected principle: customer authority; fail-closed boundary; proof integrity; data minimization and redaction; runtime readiness; no overclaim.
- Research anchor / source used, if recorded: OAuth DPoP RFC 9449 defines the `DPoP` HTTP header, proof validation, and `cnf.jkt` JWK thumbprint confirmation for sender-constrained tokens; OAuth Token Exchange RFC 8693 anchors audience/resource/scope-bound downstream credentials; OAuth mTLS RFC 8705 remains the alternative certificate-bound sender-constrained path; OAuth Token Introspection RFC 7662 anchors active-token liveness checks after issuance. These are engineering anchors only, not OAuth certification, live authorization-server proof, external KMS/HSM proof, customer PEP deployment, or production readiness evidence.
- Repository evidence:
  - Contract/code evidence: `src/service/hosted-generic-admission-sender-confirmation.ts`, `src/service/http/routes/generic-admission-routes.ts`, `src/service/bootstrap/routes.ts`, `src/service/bootstrap/api-route-runtime.ts`, `src/service/generic-admission-protected-route.ts`, `docs/01-overview/consequence-admission-quickstart.md`, and `docs/audit/f2-customer-gate-enforcement-validation.md`.
  - Test evidence: `tests/hosted-generic-admission-sender-confirmation.test.ts`, `tests/generic-admission-routes.test.ts`, `tests/generic-admission-protected-route.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Adds a hosted DPoP sender-confirmation resolver that validates the route-bound token-request DPoP proof, derives a `cnf.jkt` confirmation, and never serializes the raw DPoP proof. The hosted runtime passes the existing release-token issuer as a private service, and generic admission route issuance now consumes the resolver output. Valid DPoP proof lets high-risk generic admissions receive sender-constrained protected authorization; missing or invalid proof fails closed before shadow recording.
- Tests / verification: `npm run test:hosted-generic-admission-sender-confirmation`, `npm run test:generic-admission-routes`, `npm run test:generic-admission-protected-route`, `npm run test:generic-admission-protected-release-token`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live external KMS/HSM signer adapter, not durable DPoP replay consumption for the token-request proof, not a deployed customer PEP, and not a production deployment proof. Production-shared remains blocked while the issuer boundary is runtime-local or lacks structured live provider proof.
- Status: complete for repository-side hosted generic DPoP issuer bridge once this PR is merged and verified on `origin/master`.

### 35. Hosted Generic Admission External Issuer Boundary Proof Gate

- Step / PR / commit: Hosted generic admission external issuer boundary proof gate; this PR records repository-side readiness evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: hosted generic admission route readiness, external release-token issuer boundary claims, KMS/HSM live provider proof, raw provider response minimization, and production-shared promotion gate.
- Protected principle: fail-closed boundary; proof integrity; release provenance; tenant isolation; runtime readiness; no overclaim.
- Research anchor / source used, if recorded: AWS KMS Sign API, Google Cloud KMS asymmetricSign API, Azure Key Vault / Managed HSM Sign API, and the existing tenant signer boundary contract. These anchors require provider-native signing semantics and live verification evidence before Attestor can treat an external key boundary as production evidence.
- Repository evidence:
  - Contract/code evidence: `src/service/generic-admission-protected-route.ts`, `src/service/bootstrap/api-route-runtime.ts`, `src/service/bootstrap/release-tenant-signer-boundary.ts`, and `docs/audit/f2-customer-gate-enforcement-validation.md`.
  - Test evidence: `tests/generic-admission-protected-route.test.ts`, `tests/production-tenant-signer-boundary.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: `production-shared` hosted generic route readiness no longer clears on a bare `external-kms-hsm` boundary label. It requires structured issuer boundary evidence from the release tenant signer boundary descriptor, a valid live provider proof state, `liveProviderVerified=true`, and `rawProviderResponseStored=false`; otherwise the route emits explicit blockers such as `external-issuer-boundary-proof-missing` or `external-issuer-live-provider-proof-not-valid`.
- Tests / verification: `npm run test:generic-admission-protected-route`, `npm run test:production-tenant-signer-boundary`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live AWS, Google Cloud, Azure, HSM, or confidential-compute signer adapter and does not activate external release-token signing. It prevents production-shared route readiness overclaim until a real provider adapter, sign/verify probe, rotation plan, compromise response, live deployed introspection/replay backend operation, and deployed customer PEP evidence exist.
- Status: complete for repository-side hosted generic external issuer boundary proof gate once this PR is merged and verified on `origin/master`.

### 36. Hosted Generic Admission Durable Introspection And Replay Wiring

- Step / PR / commit: Hosted generic admission durable introspection and replay wiring; this PR records repository-side shared-store wiring evidence but cannot pre-record its own merge commit.
- Date if available: 2026-05-15.
- Trust surface: hosted generic admission route, release-token introspection authority, issued-token registration, replay consumption, shared production profile readiness, raw-token minimization, and online release-enforcement verifier store compatibility.
- Protected principle: customer authority; fail-closed boundary; proof integrity; replay and idempotency safety; runtime readiness; data minimization and redaction; no overclaim.
- Research anchor / source used, if recorded: OAuth Token Introspection RFC 7662 anchors protected-resource active-token liveness and token metadata lookup; PostgreSQL `SELECT ... FOR UPDATE` anchors the shared-store row-lock pattern already used for single-use token consumption. These are engineering anchors only, not OAuth certification, customer PEP deployment, or live production database evidence.
- Repository evidence:
  - Contract/code evidence: `src/consequence-admission/generic-protected-release-token.ts`, `src/release-enforcement-plane/online-verifier.ts`, `src/service/generic-admission-protected-route.ts`, `src/service/bootstrap/routes.ts`, `src/service/bootstrap/api-route-runtime.ts`, `src/service/release-token-introspection-store.ts`, `docs/01-overview/consequence-admission-quickstart.md`, and `docs/audit/f2-customer-gate-enforcement-validation.md`.
  - Test evidence: `tests/generic-admission-protected-release-token.test.ts`, `tests/generic-admission-routes.test.ts`, `tests/generic-admission-protected-route.test.ts`, `tests/release-token-introspection-store.test.ts`, `tests/audit-remediation-tracker.test.ts`, and `tests/research-provenance-ledger.test.ts`.
- Implemented control: Hosted generic protected-token issuance can now register issued tokens with the release-token introspection authority by token id and release-decision metadata while keeping the raw token caller-only. The online release-enforcement verifier accepts awaitable introspection stores, so shared PostgreSQL-backed token-use consumption can sit behind the same usage-store contract. Hosted route readiness now records token-introspection and replay-consumption store configuration and blocks `production-shared` when either store is missing or runtime-local.
- Tests / verification: `npm run test:generic-admission-protected-release-token`, `npm run test:generic-admission-routes`, `npm run test:generic-admission-protected-route`, `npm run test:release-token-introspection-store`, `npx tsx tests/release-enforcement-plane-online-verifier.test.ts`, `npm run test:audit-remediation-tracker`, and `npm run test:research-provenance-ledger`.
- Remaining limitation or no-go condition: This is not a live customer PEP, not a live authorization server, not durable DPoP replay consumption for the token-request proof, not live external KMS/HSM signing, and not production deployment proof. It proves repository-side issued-token registration and shared-store replay/introspection readiness gating; live traffic routing, deployment probes, customer operation, and external signer proof remain required.
- Status: complete for repository-side hosted generic durable introspection and replay wiring once this PR is merged and verified on `origin/master`.

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
