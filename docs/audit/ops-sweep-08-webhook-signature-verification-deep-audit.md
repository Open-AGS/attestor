# Ops Sweep 08 - Webhook Signature Verification Deep Audit

Status: repository remediation landed in this branch; live provider/dashboard
proof remains outside the repository.

This report validates and remediates the Sweep 08 intake against
`origin/master @ f4009b1acaf3dc88529cb05d7ce7e75e196643d8`. It does not claim
live-shadow readiness, production readiness, enterprise readiness, or live
provider webhook deployment completion.

## 0. Recent Fixes Chain-Effect Check

Previous merge:

- PR #514 / merge `f4009b1acaf3dc88529cb05d7ce7e75e196643d8`
  - scope: OPS-SWEEP-07 provider overlays, profiles, and live proof gates
  - files touched: ops provider manifests/docs, observability profile renderer,
    live proof register/gate, and provider/profile tests

Chain-effect verdict:

- Direct regression into webhook signature scope: none. PR #514 did not modify
  `src/service/http/routes/*webhook*`, email/Stripe webhook services, provider
  signature helpers, webhook stores, or webhook tests.
- Defense-in-depth weakening: none. PR #514 strengthened live proof gates and
  provider manifest safety.
- Docs/index drift: intentional. OPS-SWEEP-07 added live proof flags; webhook
  provider proof flags were still absent and are closed in this sweep.
- Closed finding reopened: none. OPS-68 remains `disputed/closed` because the
  current Prometheus alert file already carries the SLO burn-rate alerts.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth | `origin/master @ f4009b1acaf3dc88529cb05d7ce7e75e196643d8` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline driver | Phase 1 required test: fake signature; control-map next action: public route authZ and live route probes |
| Protected principles | proof integrity; fail-closed boundary; replay and idempotency safety; operational boundedness; auditability; no overclaim |
| Scope | `/api/v1/billing/stripe/webhook`, `/api/v1/email/sendgrid/webhook`, `/api/v1/email/mailgun/webhook`, signature verifiers, email replay-store boundary, webhook live proof flags, and direct tests |

External anchors used as implementation references:

- Stripe webhooks: official libraries verify signatures with the raw event
  payload, the `Stripe-Signature` header, and endpoint secret; Stripe also
  describes timestamp-based replay mitigation and the default five-minute
  tolerance.
  <https://docs.stripe.com/webhooks?lang=node>
- Stripe signature troubleshooting: `stripe.webhooks.constructEvent(requestBody,
  signature, endpointSecret)` is the Node SDK verification path.
  <https://docs.stripe.com/webhooks/signature?lang=node>
- Twilio SendGrid signed event webhook: requests carry
  `X-Twilio-Email-Event-Webhook-Signature` and
  `X-Twilio-Email-Event-Webhook-Timestamp`; verification uses ECDSA over the
  timestamp plus raw payload bytes.
  <https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features>
- Mailgun webhooks: delivery webhooks include `timestamp`, `token`, and
  `signature`; verification concatenates timestamp and token and compares a
  SHA-256 HMAC using the HTTP webhook signing key.
  <https://documentation.mailgun.com/docs/mailgun/user-manual/webhooks/webhooks>
  <https://www.mailgun.com/blog/product/a-guide-to-using-mailguns-webhooks/>

These anchors support the implementation shape only. They are not compliance,
provider deployment, or production-readiness claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `src/service/http/routes/stripe-webhook-routes.ts` | full | Stripe route raw body and signature header wiring |
| `src/service/http/routes/email-webhook-routes.ts` | full | SendGrid and Mailgun route raw body wiring |
| `src/service/application/stripe-webhook-service.ts` | full | Stripe signature verification and dedupe dispatch |
| `src/service/application/email-webhook-service.ts` | full | Email provider signature gate, shared-store requirement, and event recording |
| `src/service/sendgrid-email-webhook.ts` | full | SendGrid ECDSA verifier and event parsing |
| `src/service/mailgun-email-webhook.ts` | full | Mailgun HMAC verifier, timestamp window, and replay-token digest |
| `src/service/billing/stripe/stripe-webhook-store.ts` | targeted | Stripe local fallback boundary |
| `src/service/hosted-webhook-async-reconciliation-hardening.ts` | targeted | webhook/async hardening evidence contract |
| `scripts/check/check-ops-live-shadow-readiness.mjs` | targeted | live proof flag set |
| `docs/audit/{finding-index,report-index,control-map,live-proof-register,current-posture-baseline}.md` | targeted | evidence index reconciliation |
| `tests/service-email-webhook-service.test.ts` | full | email webhook service behavior |
| `tests/live-account-email-{provider,mailgun}-webhook.test.ts` | targeted | local single-node live-style test compatibility |

## 3. Finding Disposition

| ID | Intake state | Validation result | Remediation |
|---|---|---|---|
| OPS-73 email webhook HA replay store opt-in | P1 open | repo-proven | Closed repo-side. SendGrid/Mailgun webhooks now require shared control-plane storage by default. Local/file-backed storage requires explicit `ATTESTOR_EMAIL_WEBHOOK_ALLOW_LOCAL_STORE=accept-the-risk`. Live multi-instance proof remains required. |
| OPS-74 webhook signature verifier unit tests | P1 open | repo-proven | Closed. Added direct Mailgun and SendGrid verifier tests for valid signatures, missing keys, expired timestamps, malformed timestamps, malformed signatures, and malformed public key configuration. |
| OPS-75 webhook surface rate-limit absence | P2 open | repo-proven | Closed repo-side. Added per-provider webhook auth rate limit before raw-body read and signature/service work; route tests prove 429 short-circuits provider service calls. Live edge/client-IP behavior remains proof-only. |
| OPS-76 webhook secret env not gated as live proof | P2 open | repo-proven | Closed repo-side. Added Stripe, SendGrid, Mailgun, and email replay-store proof flags to the live-shadow gate and live proof register. |
| OPS-77 Mailgun signature does not cover body | P2 accepted limitation | source-backed accepted limitation | Kept as accepted limitation. Mailgun's Send webhook signing scheme signs timestamp plus token; residual replay risk is bounded by timestamp freshness and shared replay/idempotency storage. |
| OPS-78 webhook timestamp `parseInt` accepts trailing junk | P3 open | repo-proven | Closed. Mailgun and SendGrid signature verifier timestamps now require strict unsigned integer strings. |

## 4. Remediation Summary

Repository changes:

- Made email provider webhook replay/idempotency storage fail closed by default
  unless shared control-plane storage is configured or a single-node evaluation
  override is set.
- Added strict timestamp parsing for Mailgun and SendGrid signature verifiers.
- Wrapped SendGrid public key/signature verification in a fail-closed guard so
  malformed key material returns false rather than throwing through the route.
- Added path-scoped webhook auth rate limiting before expensive signature
  verification and service processing.
- Added direct verifier tests and route-level rate-limit tests.
- Extended live proof gates and register entries for webhook provider
  configuration and email webhook replay-store behavior.
- Updated deployment env docs, hosted webhook hardening evidence, audit
  finding/report indexes, baseline, and control map.

## 5. Chain-Effect Check

| Surface | Effect |
|---|---|
| Direct regression | Webhook routes now have a new 429 path before signature work. This is intentional operational boundedness and tested. |
| Downstream caller breakage | Local single-node email webhook tests or demos must set `ATTESTOR_EMAIL_WEBHOOK_ALLOW_LOCAL_STORE=accept-the-risk` if no shared control-plane store is configured. Live/provider-facing deployments should use shared control-plane storage. |
| Defense-in-depth | Strengthened: default shared-store requirement, strict timestamp parsing, direct verifier tests, and pre-crypto rate limiting. |
| Config/manifest drift | Reduced by adding live proof flags and deployment env documentation. |
| Docs drift | Reduced by updating baseline, finding index, report index, control map, live proof register, and deployment docs. |
| Test coverage drift | Reduced by direct crypto verifier and route rate-limit tests. |
| Closed finding reopened | None. OPS-77 remains an accepted vendor-design limitation, not an Attestor code bug. |

## 6. Webhook Route Matrix After Remediation

| Method | Path | Signature authority | Replay/idempotency boundary | Rate limit | Live proof |
|---|---|---|---|---|---|
| POST | `/api/v1/billing/stripe/webhook` | Stripe SDK `constructEvent` over raw payload + `Stripe-Signature` + endpoint secret | Stripe event id and payload hash; shared billing ledger or shared control-plane store when configured, local fallback for evaluation | `ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE`, scope `stripe` | `ATTESTOR_STRIPE_WEBHOOK_PROOF` |
| POST | `/api/v1/email/sendgrid/webhook` | ECDSA signature over timestamp + raw payload bytes; signed event public key | `sg_event_id` via shared control-plane storage by default; local fallback only with explicit risk override | `ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE`, scope `sendgrid` | `ATTESTOR_SENDGRID_EVENT_WEBHOOK_PROOF`; `ATTESTOR_EMAIL_WEBHOOK_REPLAY_STORE_PROOF` |
| POST | `/api/v1/email/mailgun/webhook` | SHA-256 HMAC over timestamp + token using Mailgun HTTP webhook signing key | `event-data.id` and domain-separated token digest via shared control-plane storage by default; local fallback only with explicit risk override | `ATTESTOR_WEBHOOK_AUTH_RATE_LIMIT_PER_MINUTE`, scope `mailgun` | `ATTESTOR_MAILGUN_WEBHOOK_PROOF`; `ATTESTOR_EMAIL_WEBHOOK_REPLAY_STORE_PROOF` |

## 7. Remaining Limitations

- Repository tests do not prove live Stripe dashboard endpoint binding,
  SendGrid webhook configuration, Mailgun webhook configuration, provider IP
  behavior, or provider retry behavior.
- Static rate-limit tests do not prove reverse-proxy source-IP correctness in a
  live deployment.
- Mailgun's Send webhook signature scheme signs timestamp plus token, not the
  body. This is source-backed upstream behavior and remains an accepted
  limitation, mitigated by freshness and shared replay/idempotency storage.
- Production, enterprise, and live-shadow readiness are still not claimed. Live
  proof artifacts must be captured separately.

## 8. Verification Plan

Targeted local checks for this remediation:

- `npm run test:service-email-webhook-service`
- `npm run test:service-email-webhook-signature-verifiers`
- `npm run test:service-webhook-route-rate-limit`
- `npm run test:hosted-webhook-async-reconciliation-hardening`
- `npm run test:ops-live-shadow-readiness`
- `npm run test:audit-finding-evidence`
- `npm run check:ops-live-shadow`
- `npm run check:security-evidence-system`
- `npm run check:baseline-alignment`
- `npm run test:package-script-runner`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `git diff --check`

Tier 4 `npm run verify` is not required for this scoped service/API and
live-proof-gate remediation unless CI reveals a broader regression.
