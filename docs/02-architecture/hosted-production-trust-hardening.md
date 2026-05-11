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
- SLSA v1.0 emphasizes build provenance and tamper-resistant release evidence. Production trust hardening must keep release packets and proof surfaces tied to verifiable artifacts rather than prose claims: [SLSA v1.0 levels](https://slsa.dev/spec/v1.0/levels)
- Kubernetes readiness, liveness, and startup probes separate routing readiness from process existence. Attestor production rollout should keep health, readiness, worker, and dependency status explicit: [Kubernetes probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
- Stripe's go-live checklist keeps live keys, webhook secrets, payment method readiness, and webhook testing as concrete launch gates. Billing live readiness is not complete until deployment env, restart, and smoke tests pass: [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)

## Step List

| Step | Status | Deliverable | Evidence | Notes |
|---|---|---|---|---|
| 01 | complete | Hosted API Authorization Matrix | `src/service/hosted-api-authorization-matrix.ts`, `tests/hosted-api-authorization-matrix.test.ts`, `src/service/http/routes/pipeline-async-routes.ts`, `docs/01-overview/hosted-journey-contract.md`, `package.json` | Adds a machine-readable route authorization matrix for public metadata, credential challenge, account plane, tenant runtime, signed webhooks, shadow control, and operator admin routes. Also fixes the confirmed async job status BOLA edge by requiring the job tenant to match the current tenant before returning status. |
| 02 | not started | Sensitive Business Flow Abuse Guard | TBD | Harden checkout, portal, API-key issue/rotate, tenant admin, signup/bootstrap, and auth challenges against retry abuse, replay, role confusion, and unsafe automation. |
| 03 | not started | Webhook And Async Reconciliation Hardening | TBD | Strengthen duplicate, delayed, out-of-order, and replay paths for Stripe, email webhooks, async jobs, entitlement convergence, and dead-letter recovery. |
| 04 | not started | LLM/Agent Tool-Use Boundary Guard | TBD | Ensure hosted action-authorization, shadow, recommendation, and model-safe feedback paths cannot leak private prompts, raw tool payloads, provider bodies, or unsafe retry authority. |
| 05 | not started | Production Runtime Health Contract | TBD | Define route, worker, queue, storage, webhook, and degraded-mode readiness contracts aligned with readiness/liveness/startup semantics. |
| 06 | not started | Release Provenance And SLSA Alignment | TBD | Tie build, SBOM, package surface, proof packet, and release evidence into verifiable provenance and tamper-evident artifacts. |
| 07 | not started | Observability Privacy And Incident Evidence | TBD | Add privacy-safe operational evidence, alert context, incident packet shape, low-cardinality telemetry guard, and no-raw-customer-data checks. |
| 08 | not started | Backup/Restore/DR Proof Tightening | TBD | Add restore dry-run evidence, freshness, checksum, recovery objective, and operator runbook guards. |
| 09 | not started | Customer Activation And Adoption Gate | TBD | Harden first API key, first run, shadow-to-warn-to-review-to-enforce transition, and customer-side readiness receipts. |
| 10 | blocked | Final Production Rollout Execution | deployment target and operator-managed runtime access | Requires operator-managed deployment env, service restart, Stripe readiness probe, webhook smoke test, and hosted product smoke test on a working deployment target. |

## Current Posture

Step 01 is complete in code and test coverage. Steps 02-09 remain implementation work. Step 10 remains blocked until a working deployment target is available.
