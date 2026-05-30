# Consequence Admission Scope And Webhook Validation

Status: no-code validation intake. This report validates an external reviewer
packet against current repository evidence and official provider/security
documentation. It does not import raw reviewer output and does not create new
production, compliance, live-enforcement, or enterprise-readiness claims.

## Recent Fixes Chain-Effect Check

Source of truth: `origin/master @ 3c28b5a4bcce303975277867c9c41236af5e2efb`.

Recent relevant merges:

- PR #714 / `8d1f0ce6` surfaced scope-guard reason codes on generic admission
  checks and added regression coverage for narrow scope outcomes.
- PR #722 / `68407546` hardened hosted generic-admission tenant and shadow
  recording checks.
- PR #724 / `e1e21054` clarified the scope tenant boundary no-claim in docs and
  tests.
- PR #729 / `3c28b5a4` changed only the README logo asset and markup.

Chain-effect verdict: the current scope/webhook claims are not affected by the
README-logo work. The earlier consequence-admission fixes remain present on
`origin/master`; no reopened P0/P1 was found in this validation slice.

## Validation Frame

| Field | Value |
|---|---|
| Source of truth | `origin/master`, not local `master` |
| Current HEAD | `3c28b5a4bcce303975277867c9c41236af5e2efb` |
| Scope | Scope-explosion guard check surfacing, hosted generic-admission tenant handling, shadow-recording fail-closed behavior, Stripe/SendGrid/Mailgun webhook signature localization, selected carryover claims about `control-plane-store` and admin route authorization |
| Protected principles | tenant isolation; fail-closed boundary; proof integrity; no overclaim; auditability |
| Research anchors | Repository source/tests first; official provider docs for webhook signature behavior; OWASP/NIST anchors for authorization/tenant-boundary discipline |
| No-claim | This is not a full package-export, OpenAPI, admin-route, or line-by-line `src/service/**` audit |

Official source anchors used for this validation:

- Stripe webhook signature verification docs:
  <https://docs.stripe.com/webhooks?lang=node>
- Twilio SendGrid signed event webhook security features:
  <https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features>
- Mailgun webhook signing guidance:
  <https://mailgun-docs.redoc.ly/docs/mailgun/user-manual/tracking-messages/#securing-webhooks>
- OWASP Authorization Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>
- NIST SP 800-162 ABAC:
  <https://csrc.nist.gov/pubs/sp/800/162/upd2/final>

## Inspected Files

- `AGENTS.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/report-index.md`
- `docs/audit/finding-index.md`
- `docs/audit/control-map.md`
- `docs/audit/live-proof-register.md`
- `docs/audit/attestor-audit-remediation-tracker.md`
- `docs/02-architecture/scope-explosion-guard.md`
- `docs/05-proof/failure-modes-and-controls.md`
- `src/consequence-admission/contracts.ts`
- `src/consequence-admission/generic-engine.ts`
- `src/consequence-admission/scope-explosion-guard.ts`
- `src/service/http/routes/generic-admission-routes.ts`
- `src/service/application/stripe-webhook-service.ts`
- `src/service/http/routes/stripe-webhook-routes.ts`
- `src/service/mailgun-email-webhook.ts`
- `src/service/sendgrid-email-webhook.ts`
- `src/service/control-plane-store.ts`
- `src/service/http/routes/admin-route-helpers.ts`
- `tests/generic-admission-routes.test.ts`
- `tests/generic-admission-mode-ladder.test.ts`
- `tests/scope-explosion-guard.test.ts`
- `tests/service-email-webhook-signature-verifiers.test.ts`
- `tests/service-stripe-webhook-service.test.ts`
- `tests/stripe-webhook-support-hardening.test.ts`

`CLAUDE.md` was not present in the current checkout.

## Skipped Files

- Full `src/service/**` line-by-line audit.
- Full package exports, OpenAPI, scripts, and package-surface review.
- Full `control-plane-store` byte-for-byte facade audit beyond current
  re-export inventory evidence.
- Full admin-route helper byte audit beyond existing index/test evidence.
- Live Stripe, SendGrid, Mailgun dashboard endpoint bindings and fake-signature
  probes.

## Trust Boundaries And Relevant Surfaces

- The scope-explosion guard compares supplied requested-vs-approved scope
  metadata. It can narrow or block based on that metadata, but it does not prove
  tenant isolation by itself.
- The hosted generic-admission route is the tenant-boundary surface for hosted
  requests in this slice. It rejects top-level and nested scope tenant mismatch
  before shadow recording.
- Package-level callers must still source `approvedScope` metadata from a
  trusted policy/operator boundary. Caller-supplied scope metadata alone is not
  live tenant-isolation proof.
- Stripe webhook verification remains a route/service raw-payload signature
  boundary, not live Stripe dashboard proof.
- SendGrid and Mailgun verifier code remains repository-side proof only.
  Provider endpoint binding and multi-instance replay behavior remain live
  proof.

## Positive Observations

| ID | Observation | Evidence |
|---|---|---|
| CA-SCOPE-WEBHOOK-POS-01 | Scope guard reason codes are surfaced on generic admission checks in current HEAD. | `src/consequence-admission/contracts.ts`; `src/consequence-admission/generic-engine.ts`; `tests/generic-admission-mode-ladder/drift-authority-scope-tests.ts`; PR #714 |
| CA-SCOPE-WEBHOOK-POS-02 | Hosted generic admission rejects mismatched `tenantId`, `requestedScope.tenantId`, and `approvedScope.tenantId` before shadow recording. | `src/service/http/routes/generic-admission-routes.ts`; `tests/generic-admission-routes/fail-closed-retry-tests.ts`; PR #722 |
| CA-SCOPE-WEBHOOK-POS-03 | The scope-tenant no-claim is explicit: route tenant binding is separate from package-level scope metadata comparison. | `docs/02-architecture/scope-explosion-guard.md`; `docs/05-proof/failure-modes-and-controls.md`; `tests/scope-explosion-guard.test.ts`; PR #724 |
| CA-SCOPE-WEBHOOK-POS-04 | Hosted generic admission fails closed when shadow recording is unavailable. | `src/service/http/routes/generic-admission-routes.ts`; `tests/generic-admission-routes/fail-closed-retry-tests.ts` |
| CA-SCOPE-WEBHOOK-POS-05 | Stripe webhook verification is localized in the service via the Stripe SDK `constructEvent` path, with raw route body and `stripe-signature` header passed from the HTTP route. | `src/service/application/stripe-webhook-service.ts`; `src/service/http/routes/stripe-webhook-routes.ts`; Stripe docs |
| CA-SCOPE-WEBHOOK-POS-06 | SendGrid and Mailgun verifier helpers are direct source-level verifiers with negative tests for malformed, expired, missing-key, and invalid-signature inputs. | `src/service/sendgrid-email-webhook.ts`; `src/service/mailgun-email-webhook.ts`; `tests/service-email-webhook-signature-verifiers.test.ts`; Twilio SendGrid and Mailgun docs |

## Claim Reconciliation

| Claim / carryover | Current state | Evidence | Action |
|---|---|---|---|
| Scope-guard reasons were previously not surfaced on generic admission check outcomes. | `repo-proven` historically before PR #714; closed in current HEAD. | `git show 8d1f0ce6^:src/consequence-admission/generic-engine.ts`; `git show 8d1f0ce6:src/consequence-admission/generic-engine.ts`; current tests. | No new code action. Keep `npm run test:generic-admission-mode-ladder` and `npm run test:scope-explosion-guard` green. |
| Scope tenant comparison is a hosted route tenant-isolation bypass. | `contradicted` for the hosted route. | Hosted route rejects top-level and nested tenant mismatches with `tenant-scope-mismatch`; route tests cover the negative cases. | No route code action. |
| Scope tenant comparison can be misleading if package callers supply both requested and approved tenant metadata themselves. | `repo-proven accepted limitation`. | Scope docs state the guard compares supplied metadata and that package callers need trusted policy-source metadata. | Keep the no-claim boundary. No new P0/P1. |
| Stripe `constructEvent` location was not found. | `contradicted`. | `src/service/application/stripe-webhook-service.ts` calls `deps.stripeClient().webhooks.constructEvent(input.rawPayload, signature, webhookSecret)`. | No code action. |
| SendGrid and Mailgun verifier localization needs confirmation. | `repo-proven` and `source-backed`. | Verifier source and tests align with official provider signature shapes. | No code action; live endpoint proof remains required. |
| Hosted shadow recording might silently skip when `recordShadowAdmission` is absent. | `contradicted` for the hosted route. | `src/service/http/routes/generic-admission-routes.ts` returns 503 `shadow-recording-unavailable` when the dependency is absent or throws. | No code action. |
| `control-plane-store` facade export count requires follow-up. | `not proven` as a new defect in this slice; exact external count was contradicted by current source inventory. | `src/service/control-plane-store.ts`; `tests/control-plane-store-inventory-docs.test.ts`. | Not integrated as a finding. Run a separate package/facade audit only if scoped. |
| `authorizeAdminRoute` needs byte-audit follow-up. | `not audited` in this slice; existing P1/live-proof boundaries already track admin role-key deployment. | `docs/audit/finding-index.md`; `docs/audit/live-proof-register.md`; admin route tests. | No new finding here. Full admin-route audit remains a separate scoped task. |

## Chain Reactions

- Direct regression: none found in the validated scope.
- Downstream caller breakage: none introduced; no runtime code changed.
- Defense-in-depth weakening: none; current checks remain fail-closed for
  hosted tenant mismatch and shadow-recording unavailability.
- Behavior change: none in this report.
- Cross-fix interaction: PR #714, #722, and #724 now align. The route protects
  hosted tenant context, while docs keep package-level scope metadata honest.
- Test coverage drift: no drift found for the validated route/webhook paths;
  targeted tests remain available.
- Config/manifest drift: none.
- Docs/index drift: this report adds the required report-index intake row for
  the external validation packet.
- Previously closed finding reopened: no repo-proven reopened P0/P1 found.

## Coverage Delta

This report adds no runtime behavior and no new finding-index row because it
does not introduce or close a P0/P1 finding, and it does not change public
readiness posture.

Validated targeted checks for this slice:

- `npm run test:scope-explosion-guard`
- `npm run test:generic-admission-routes`
- `npm run test:generic-admission-mode-ladder`
- `npm run test:service-email-webhook-signature-verifiers`
- `npm run test:service-stripe-webhook-service`
- `npm run test:stripe-webhook-support-hardening`
- `npm run check:security-evidence-system`
- `npm run test:security-evidence-system`
- `npm run test:audit-finding-test-coverage`
- `git diff --check`

Tier 4 `npm run verify` is not required for this no-code validation intake and
was not run.

## Verdict

The external scope/webhook validation packet is integrated as a no-code,
repository-evidence report. No repo-proven P0/P1 remediation was found in this
slice. Several carryover claims are contradicted by current repository evidence;
the remaining package-level and live-provider concerns are explicit
no-claim/live-proof boundaries rather than immediate repo-code bugs.

## Next Locked Target

Run a focused package exports/OpenAPI/scripts/admin-helper audit only if it is
scoped as a separate validation pass. Otherwise continue the active baseline
queue and keep live proof blockers separate from repository-side closure.

## Final Checkpoint

- Scoped validation complete: yes, for the scope/webhook packet intake.
- Another round required: no for this no-code validation slice; yes only for a
  separately scoped package/admin/API audit.
- Repo-proven P0/P1 introduced: no.
- Live proof needed: unchanged. Customer PEP no-bypass, shared replay/retry
  stores, live tenant shared-store/RLS, and live Stripe/SendGrid/Mailgun
  endpoint proof remain required before stronger runtime claims.
- Production proven: no.
- Enterprise ready: no.
