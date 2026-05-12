# Hosted Production Trust Hardening I

This tracker follows the completed hosted product-flow track. It hardens the hosted product path as a production trust surface without widening Attestor into a new product line.

## Guardrails

- Keep Attestor as one platform core with modular packs.
- Treat account, tenant, admin, billing, webhook, shadow, and release routes as separate trust surfaces.
- Every sensitive route must have an explicit auth boundary, tenant or account boundary, object boundary, mutation safety boundary, idempotency or replay boundary, and privacy boundary.
- Private customer data stays sacred: no raw prompts, payloads, credentials, provider bodies, payment details, wallet material, private thresholds, or idempotency keys in telemetry, public docs, proof packets, dashboards, or model feedback.
- Fix confirmed BOLA, BFLA, replay, privacy, or abuse issues in the same hardening step where they are found.
- Keep final production rollout separate from repo-side readiness until a working deployment target exists.

## Research Anchors

Reviewed on 2026-05-11 before opening this track:

- OWASP API Security Top 10 2023 treats broken object-level authorization and broken function-level authorization as first-order API risks. Hosted route work must therefore bind object ids, account ids, tenant ids, admin ids, and provider refs explicitly instead of trusting a path parameter alone: [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- NIST SSDF SP 800-218 frames secure software development as defined requirements, verified implementation, vulnerability response, and protected code. This track uses machine-readable route rules plus tests as the verification layer: [NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- OWASP Top 10 for LLM Applications 2025 includes sensitive information disclosure, excessive agency, and system prompt leakage. Hosted action-authorization and shadow routes must therefore keep model-facing and proof-facing outputs data-minimized: [OWASP LLM Top 10 2025](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/)
- SLSA v1.2 emphasizes build provenance, trusted builders, artifact subjects, and verifier policy. Production trust hardening must keep release packets, SBOMs, package surfaces, and proof surfaces tied to verifiable artifacts rather than prose claims: [SLSA v1.2 build provenance](https://slsa.dev/spec/v1.2/build-provenance), [SLSA v1.2 verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
- GitHub artifact attestations provide the GitHub-native build provenance path for release artifacts and require verifier-side checks against repository and signer workflow identity. Attestor release evidence should therefore publish narrow artifact attestations and document the exact reviewer command: [GitHub artifact attestations](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
- Kubernetes readiness, liveness, and startup probes separate routing readiness from process existence. Attestor production rollout should keep health, readiness, worker, and dependency status explicit: [Kubernetes probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
- Stripe's go-live checklist keeps live keys, webhook secrets, payment method readiness, and webhook testing as concrete launch gates. Billing live readiness is not complete until deployment env, restart, and smoke tests pass: [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- OWASP API6:2023 treats automated access to sensitive business flows as a distinct API risk even when requests are otherwise valid. Hosted checkout, portal, API-key lifecycle, auth challenges, admin mutations, tenant execution, provider webhooks, and release-bound exports must therefore declare abuse, replay, cost, duplicate, role, and privacy controls explicitly: [OWASP API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
- Stripe idempotency guidance makes retry semantics a provider-facing contract for mutating API calls. Hosted Checkout keeps a required customer-supplied `Idempotency-Key` at the route and Stripe SDK layer; Portal remains a short-lived hosted handoff whose subscription effects converge through signed webhooks: [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- Stripe webhook guidance requires raw-body signature verification, duplicate-event handling, and deterministic 2xx/4xx outcomes. Hosted billing webhooks therefore keep signed ingress, payload hash conflict rejection, provider event dedupe, claim release, and shared-store production posture explicit: [Stripe webhooks](https://docs.stripe.com/webhooks)
- Stripe webhook signature guidance warns that signature verification depends on the exact raw payload and signed header. Hosted Stripe webhook routes must therefore pass the unmodified request body into the verifier before parsing or projecting billing state: [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature)
- BullMQ retry and stalled-job guidance treats attempts, backoff, and stalled recovery as explicit worker policy. Hosted async jobs therefore keep retry, backoff, stalled limit, tenant execution lease, and dead-letter recovery as first-class controls: [BullMQ retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs), [BullMQ stalled jobs](https://docs.bullmq.io/guide/jobs/stalled)
- OWASP API4:2023 treats unbounded repeated work as a resource-consumption risk. Provider callbacks, async queue admission, retry loops, and dead-letter recovery must therefore be bounded by dedupe, quota, rate, retry, and privacy-safe evidence: [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- OWASP Top 10 for Agentic Applications 2026 treats tool misuse and excessive agent authority as first-order risks for agent systems. Hosted model feedback, tool wrappers, retries, and recommendation reads must therefore separate model-readable guidance from executable authority: [OWASP Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
- NIST AI RMF frames trustworthy AI risk work as govern, map, measure, and manage functions. Attestor's LLM/agent boundary therefore needs machine-readable controls plus tests, not only prose warnings: [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
- OpenAI agent safety guidance recommends structured outputs, tool approvals, guardrails, evals, and isolating untrusted data from tool-driving agent behavior. Attestor's boundary follows the same pattern by exposing structured safe feedback and keeping tool authority outside model-visible text: [OpenAI Safety in building agents](https://platform.openai.com/docs/guides/agent-builder-safety)
- Google SRE monitoring guidance separates symptoms, causes, and actionable signals. Attestor runtime health should therefore expose process health, dependency readiness, blocker codes, and operational state without turning noisy diagnostics into routability claims: [Google SRE monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- OpenTelemetry service semantic conventions provide stable service identity attributes. Attestor health and readiness surfaces should keep `serviceVersion`, `instanceId`, runtime profile, and backend modes explicit and low-cardinality: [OpenTelemetry service attributes](https://opentelemetry.io/docs/specs/semconv/resource/)

## Step List

| Step | Status | Deliverable | Evidence | Notes |
|---|---|---|---|---|
| 01 | complete | Hosted API Authorization Matrix | `src/service/hosted-api-authorization-matrix.ts`, `tests/hosted-api-authorization-matrix.test.ts`, `src/service/http/routes/pipeline-async-routes.ts`, `docs/01-overview/hosted-journey-contract.md`, `package.json` | Adds a machine-readable route authorization matrix for public metadata, credential challenge, account plane, tenant runtime, signed webhooks, shadow control, and operator admin routes. Also fixes the confirmed async job status BOLA edge by requiring the job tenant to match the current tenant before returning status. |
| 02 | complete | Sensitive Business Flow Abuse Guard | `src/service/hosted-sensitive-business-flow-abuse-guard.ts`, `tests/hosted-sensitive-business-flow-abuse-guard.test.ts`, `src/service/http/routes/account-routes.ts`, `package.json` | Adds a machine-readable abuse-control profile for checkout, portal, API-key issue/rotate/status/revoke, tenant admin, signup/bootstrap, auth challenges, tenant execution, provider webhooks, and release-bound export. Also wires SAML and OIDC login initiation through the shared auth abuse budget. |
| 03 | complete | Webhook And Async Reconciliation Hardening | `src/service/hosted-webhook-async-reconciliation-hardening.ts`, `tests/hosted-webhook-async-reconciliation-hardening.test.ts`, `src/service/account-store.ts`, `src/service/control-plane-store.ts`, `src/service/application/stripe-webhook-billing-processor.ts`, `package.json` | Adds a machine-readable reconciliation profile for Stripe ingress, billing convergence, email provider webhooks, tenant async execution, and dead-letter recovery. Also adds provider-event ordering guards so older Stripe subscription and invoice events are finalized as ignored instead of overwriting fresher state. |
| 04 | complete | LLM/Agent Tool-Use Boundary Guard | `src/service/hosted-llm-agent-tool-boundary-guard.ts`, `tests/hosted-llm-agent-tool-boundary-guard.test.ts`, `docs/api/attestor-action-authorization.openapi.json`, `tests/hosted-action-authorization-openapi.test.ts`, `package.json` | Adds a machine-readable boundary profile across model-safe admission feedback, agent retry authority, shadow recommendation reads, protected adapter execution, and proof/dashboard/problem-detail surfaces. Also extends the OpenAPI contract with model-safe feedback and explicit no-tool-authority/no-unsafe-retry boundary flags. |
| 05 | complete | Production Runtime Health Contract | `src/service/hosted-production-runtime-health-contract.ts`, `tests/hosted-production-runtime-health-contract.test.ts`, `src/service/http/routes/core-routes.ts`, `src/service/worker.ts`, `package.json` | Adds a machine-readable health contract across API process health, API dependency readiness, worker health/readiness, async queue runtime, storage/release authority readiness, webhook ingress readiness, and degraded-mode visibility. Also makes API and worker probe responses explicitly no-store at the route/server level. |
| 06 | complete | Release Provenance And SLSA Alignment | `src/service/hosted-release-provenance-slsa-alignment.ts`, `tests/hosted-release-provenance-slsa-alignment.test.ts`, `.github/workflows/release-provenance.yml`, `docs/08-deployment/artifact-attestation-plan.md`, `docs/01-overview/hosted-journey-contract.md`, `docs/08-deployment/production-readiness.md`, `package.json` | Adds a machine-readable release provenance/SLSA alignment profile across workflow identity, artifact subject/digest verification, SBOM/dependency evidence, package-surface gates, proof/evidence packet binding, and production non-claim boundaries. Also publishes separate build provenance and CycloneDX SBOM attestations for the release evaluation archive. |
| 07 | not started | Observability Privacy And Incident Evidence | TBD | Add privacy-safe operational evidence, alert context, incident packet shape, low-cardinality telemetry guard, and no-raw-customer-data checks. |
| 08 | not started | Backup/Restore/DR Proof Tightening | TBD | Add restore dry-run evidence, freshness, checksum, recovery objective, and operator runbook guards. |
| 09 | not started | Customer Activation And Adoption Gate | TBD | Harden first API key, first run, shadow-to-warn-to-review-to-enforce transition, and customer-side readiness receipts. |
| 10 | blocked | Final Production Rollout Execution | deployment target and operator-managed runtime access | Requires operator-managed deployment env, service restart, Stripe readiness probe, webhook smoke test, and hosted product smoke test on a working deployment target. |

## Current Posture

Steps 01-06 are complete in code and test coverage. Steps 07-09 remain implementation work. Step 10 remains blocked until a working deployment target is available.

## Step 02 Evidence

The sensitive business flow guard is repo-side hardening, not a production rollout claim.

- `src/service/hosted-sensitive-business-flow-abuse-guard.ts` declares the sensitive flow profile across auth challenges, first-user bootstrap, API-key lifecycle, Stripe Checkout, Stripe Portal, tenant execution, operator admin mutations, signed provider webhooks, and release-bound filing export.
- `tests/hosted-sensitive-business-flow-abuse-guard.test.ts` verifies route ownership against the hosted authorization matrix, required controls, source evidence, validation evidence, secret-safe output, docs, and package-runner exposure.
- `src/service/http/routes/account-routes.ts` now rate-limits SAML and OIDC login initiation with the same hosted auth abuse guard used by password login, signup, passkeys, password reset, and invite acceptance.
- Billing production readiness is still separate: live deployment env, service restart, Stripe readiness probe, and webhook smoke test remain Step 10 work on a working deployment target.

## Step 03 Evidence

The webhook and async reconciliation guard is repo-side hardening, not a production rollout claim.

- `src/service/hosted-webhook-async-reconciliation-hardening.ts` declares the reconciliation profile across Stripe signed ingress, Stripe billing convergence, email provider callbacks, tenant async execution, and dead-letter recovery.
- `tests/hosted-webhook-async-reconciliation-hardening.test.ts` verifies source evidence, validation evidence, controls, external research anchors, package-runner exposure, docs exposure, and secret-safe output.
- `src/service/account-store.ts` and `src/service/control-plane-store.ts` now persist provider-created timestamps for subscription and invoice event lanes and reject stale provider events before they can regress account or billing state.
- `src/service/application/stripe-webhook-billing-processor.ts` now finalizes stale Stripe subscription and invoice events as ignored with deterministic reasons instead of syncing tenant plan, entitlement, or applied audit records from older event material.
- Async production readiness is still separate from deployment: Redis-backed queue/worker readiness, deployment env, service restart, and runtime smoke tests remain Step 10 work on a working deployment target.

## Step 04 Evidence

The LLM/agent tool-use boundary guard is repo-side hardening, not a production rollout claim.

- `src/service/hosted-llm-agent-tool-boundary-guard.ts` declares the boundary profile across model-safe feedback, retry authority, shadow recommendation reads, protected adapter execution, and proof/dashboard/problem-detail surfaces.
- `tests/hosted-llm-agent-tool-boundary-guard.test.ts` verifies source evidence, validation evidence, controls, data-minimization descriptors, retry boundaries, adapter boundaries, OpenAPI exposure, package-runner exposure, and secret-safe output.
- `docs/api/attestor-action-authorization.openapi.json` now documents `ModelSafeFeedback` and explicit boundary flags: model-safe feedback only, no tool execution authority, no unsafe retry authority, no provider bodies exposed to model, and no raw tool payload storage from shadow reads.
- `tests/hosted-action-authorization-openapi.test.ts` keeps the public action-authorization contract aligned with those model, tool, retry, and shadow-read boundaries.
- Production readiness is still separate from this repo-side guard: deployment env, service restart, readiness probes, webhook smoke tests, and hosted product smoke tests remain Step 10 work on a working deployment target.

## Step 05 Evidence

The production runtime health contract is repo-side hardening, not a production rollout claim.

- `src/service/hosted-production-runtime-health-contract.ts` declares the health contract across API liveness/startup diagnostics, API readiness, worker readiness, async queue runtime, storage/release authority readiness, webhook ingress readiness, and degraded-mode visibility.
- `tests/hosted-production-runtime-health-contract.test.ts` verifies source evidence, validation evidence, required controls, external research anchors, package-runner exposure, docs exposure, no-secret contract output, and readiness/liveness separation.
- `src/service/http/routes/core-routes.ts` now sets `cache-control: no-store` directly on `/api/v1/health` and `/api/v1/ready`, even when the routes are mounted without the full HTTP edge middleware.
- `src/service/worker.ts` now sets `cache-control: no-store` directly on worker `/health` and `/ready` probe responses.
- Production readiness is still separate from this repo-side guard: real deployment env, endpoint reachability, worker reachability, Stripe/webhook smoke tests, observability checks, and rehearsal remain Step 10 work on a working deployment target.

## Step 06 Evidence

The release provenance and SLSA alignment profile is repo-side hardening, not a production rollout claim.

- `src/service/hosted-release-provenance-slsa-alignment.ts` declares the release provenance profile across release workflow identity, artifact subject/digest verification, SBOM/dependency evidence, package-surface gates, proof/evidence packet binding, and production non-claim boundaries.
- `tests/hosted-release-provenance-slsa-alignment.test.ts` verifies source evidence, validation evidence, required controls, external research anchors, package-runner exposure, docs exposure, no-secret contract output, SLSA non-claims, and GitHub attestation verification commands.
- `.github/workflows/release-provenance.yml` now publishes separate GitHub build provenance and CycloneDX SBOM attestations for the release evaluation archive while keeping elevated `attestations: write` and `id-token: write` permissions scoped to the dedicated release workflow only.
- `docs/08-deployment/artifact-attestation-plan.md` now documents SLSA v1.2-aligned release provenance and the signer-workflow-pinned reviewer verification command.
- Production provenance is still separate from this repo-side guard: deployment env, service restart, endpoint probes, worker probes, Stripe/webhook smoke tests, observability checks, and rehearsal remain Step 10 work on a working deployment target.
