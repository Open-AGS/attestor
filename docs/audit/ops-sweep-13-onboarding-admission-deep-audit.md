# Ops Sweep 13 - Onboarding + Admission Routes Deep Audit

Status: read-only audit report. No remediation written. No live proof captured.
No production-readiness claim.

## 0. Recent Fixes Chain-Effect Check

Source of truth:
`origin/master @ 58ca89c1e7d16c110bb65d71bd9edf6a303c64ac`.

One remediation PR landed after the original Sweep 13 draft:

- PR #519 / merge `58ca89c1e7d16c110bb65d71bd9edf6a303c64ac`
  closed OPS-100 repo-side by adding credential-bound role enforcement to the
  release-review and release-policy-control routes.

Chain-effect verdict:

- Direct regression: none. PR #519 does not touch
  `src/service/http/routes/action-surface-onboarding-routes.ts`,
  `src/service/http/routes/policy-foundry-hosted-onboarding-routes.ts`,
  `src/service/http/routes/generic-admission-routes.ts`, admission envelope
  helpers, wizard state storage, or onboarding/admission route tests.
- Downstream caller breakage: none in the onboarding/admission route scope.
- Defense-in-depth weakening: none. PR #519 strengthens a sibling
  release-decision surface.
- Config / manifest drift: none in this scope.
- Docs / index drift: intentional. Sweep 12 rows now mark OPS-100 as
  closed repo-side / live-proof-only.
- Closed finding re-opened: none.

PR #519 has no chain-effect on Sweep 13 scope. OPS-100 is no longer an
`origin/master` route-side P1 blocker, but it remains live-proof-only until
`ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF` is captured.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source HEAD | `origin/master @ 58ca89c1e7d16c110bb65d71bd9edf6a303c64ac` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline blockers in scope | Tenant mismatch, bad token, replay, dashboard/proof artifact privacy review, provider outage/degraded mode |
| Protected principles | tenant isolation; customer authority; replay and idempotency safety; fail-closed boundary; operational boundedness; data minimization and redaction; no overclaim |
| Audit driver | Current posture baseline Phase 1 route work plus the onboarding-side counterpart to the release-decision surface |
| Scope | `src/service/http/routes/action-surface-onboarding-routes.ts`; `src/service/http/routes/policy-foundry-hosted-onboarding-routes.ts`; `src/service/http/routes/generic-admission-routes.ts`; tenant middleware; admission envelope and abuse guard; wizard state store integration |

External anchors used for control vocabulary only:

- OWASP API Security Top 10 2023 API1, API3, API4, API6, and API7:
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>.
- OWASP Top 10 for LLM Applications 2025 LLM01 and LLM06:
  <https://owasp.org/www-project-top-10-for-large-language-model-applications/>.
- OWASP ASVS for access-control and web-service verification vocabulary:
  <https://owasp.org/www-project-application-security-verification-standard/>.
- NIST SP 800-218 Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>.
- RFC 7807 problem details:
  <https://www.rfc-editor.org/rfc/rfc7807>.

These anchors are not certification, compliance, production-readiness, or full
coverage claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `src/service/http/routes/generic-admission-routes.ts` | full route read | Tenant-bound consequence admission entry point |
| `src/service/http/routes/action-surface-onboarding-routes.ts` | full route read | Stateless action-surface onboarding packet generation |
| `src/service/http/routes/policy-foundry-hosted-onboarding-routes.ts` | full route read | Hosted wizard state persistence and HTML view rendering |
| `src/service/hosted/hosted-api-authorization-matrix.ts` | targeted | Admission matrix classification and OWASP LLM anchors |
| `src/service/tenant-isolation.ts` | targeted | Upstream tenant context boundary |
| Related tests | inventory | Action-surface, admission state-machine, agent-loop abuse guard, and consequence admission coverage signal |

## 3. Skipped Files

| Path | Why skipped | Risk |
|---|---|---|
| `src/service/consequence-admission-agent-loop-abuse-guard.ts` | Route consumes the guard output; direct guard behavior has dedicated tests. | Low |
| `src/service/consequence-admission-envelope.ts` | Envelope creation is downstream of tenant-bound route context. | Low |
| `src/service/policy-foundry-hosted-wizard-state-store.ts` | Persistence details decide whether OPS-108 is already content-addressed. | Medium; follow-up if OPS-108 promotes |
| `src/service/action-surface/**` | Domain logic for manifest/declaration intake and graphing. | Low |
| `pipeline-verification-routes.ts`, `pipeline-filing-routes.ts`, `public-site-routes.ts`, `core-routes.ts` | Remaining route-surface slice. | Sweep 14 |

No critical Sweep 13 route file was skipped.

## 4. Positive Observations

| ID | Observation | Evidence | Why it matters |
|---|---|---|---|
| OPS13-POS-01 | Generic admission binds tenant through envelope creation; cross-tenant body claims fail with 403 and `tenant-scope-mismatch`. | `generic-admission-routes.ts` catches `GenericAdmissionTenantScopeMismatchError`. | BOLA defense at construction time. |
| OPS13-POS-02 | Admission mode is plan-aware and returns 403 when the requested mode is not allowed for the tenant plan. | `resolvePlanGenericAdmissionMode(...)`. | Feature authority is tied to plan context. |
| OPS13-POS-03 | Agent-loop abuse guard runs before the admission engine and returns 429 or 409 with reason codes. | `evaluateAgentLoopAbuse(...)`. | Admission floods are bounded before expensive work. |
| OPS13-POS-04 | Protected release token issuance fails closed when a high-risk admission requires a token but no issuer exists. | `protected-release-token-issuer-missing`. | The route does not silently drop token requirements. |
| OPS13-POS-05 | Protected release token issuance includes sender confirmation. | `resolveProtectedReleaseTokenConfirmation(...)`. | Release token authority is sender-bound, not raw bearer-only. |
| OPS13-POS-06 | Routes set `cache-control: no-store` and use RFC 7807-style problem shapes with reason codes. | All five routes. | Tenant-scoped responses are not cacheable by intermediaries. |
| OPS13-POS-07 | Action-surface onboarding enforces hosted manifest and declaration caps. | `MAX_HOSTED_MANIFESTS = 20`; `MAX_HOSTED_DECLARATIONS = 500`. | Request size is bounded. |
| OPS13-POS-08 | Action-surface onboarding response carries no-overclaim flags including `approvalRequired`, `autoEnforce: false`, and `productionReady: false`. | Onboarding packet response. | The route does not imply enforcement activation. |
| OPS13-POS-09 | Policy-foundry wizard session lookup uses a tenant digest for store keys. | `tenantDigest(tenant)`. | Raw tenant identifiers are not used as the session index key. |
| OPS13-POS-10 | Policy-foundry session GET returns 404 for missing sessions. | Session route. | It avoids a cross-tenant existence signal. |
| OPS13-POS-11 | Authorization matrix includes OWASP API1 plus OWASP LLM01/LLM06 anchors for admission. | `tenant.admission.action-authorization`. | AI-specific threat vocabulary is visible in the route classification. |
| OPS13-POS-12 | Broad domain tests exist for action-surface and consequence-admission primitives. | Test inventory. | Substrate coverage is stronger than route-only coverage. |
| OPS13-POS-13 | A direct HTTP-layer route test exists for the action-surface onboarding packet. | `action-surface-onboarding-packet-route.test.ts`. | At least one Sweep 13 route has direct route regression coverage. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Protected principle | Recommended action |
|---|---:|---|---|---|---|---|
| OPS-106 | P2 | `open / partial-repo` | Onboarding route shadow-event tenant defense-in-depth gap | `action-surface-onboarding-routes.ts` feeds `deps.listShadowEvents({ tenant })` directly into packet generation; shadow routes wrap equivalent event traversal with `assertTenantBoundRecord(s)`. | tenant isolation; data minimization | Apply the same tenant-bound assertion wrapper and test a planted cross-tenant event. |
| OPS-107 | P2 | `open / partial-repo` | Policy-foundry hosted-onboarding HTML view lacks browser hardening headers | The HTML view emits `text/html` and `cache-control: no-store`, but not CSP, `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy`. | data minimization and redaction; fail-closed boundary | Reuse the Sweep 12 OPS-103 HTML response helper when that helper lands. |
| OPS-108 | P2 | `open / partial-repo` | Policy-foundry wizard state persistence lacks a verified idempotency boundary | Workflow POST can persist wizard state; route does not consume `Idempotency-Key`, and store-side content-addressed dedupe was not verified in this sweep. | replay and idempotency safety; auditability | Verify `wizardStateStore.persist` dedupe, or wire the pipeline idempotency service. |
| OPS-109 | P3 | `open / partial-repo` | Onboarding/admission JSON content-type mismatch returns 400 rather than 415 | Sweep 13 body readers fail closed, but content-type mismatch is not consistently treated as unsupported media type. | data minimization; fail-closed boundary | Add a shared 415 JSON pre-check and keep malformed JSON as 400. |
| OPS-110 | P3 | `open / partial-repo` | Generic admission problem details can echo `error.message` | Generic catch path can return constructor or downstream error messages. | data minimization and redaction | Pair with OPS-90 and OPS-99 by centralizing problem-detail redaction. |
| OPS-111 | P3 | `accepted limitation` | Action-surface input caps are enforced but not surfaced in matrix/response metadata | Manifest/declaration caps are constants inside the route helpers. | operational boundedness | Document caps in matrix text and optionally echo configured caps in responses. |

Sweep 13 surfaces no repo-proven P0 or P1 findings.

## 6. Route-by-route Surface Matrix

Five routes were mapped across three files.

| # | Method | Path | Auth | Tenant binding | Body | Rate-limit | Idempotency | Audit | Affected findings |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/v1/admissions` | tenant context | envelope creation rejects tenant mismatch | JSON parse + problem details | agent-loop guard 429/409 plus plan gate 403 | service-defined | shadow admission recording | OPS-109, OPS-110 |
| 2 | POST | `/api/v1/shadow/action-surface/onboarding-packet` | tenant context | trusts `listShadowEvents({ tenant })` filtering | route body helper | none | stateless packet | none | OPS-106, OPS-109 |
| 3 | POST | `/api/v1/shadow/policy-foundry/hosted-onboarding-workflow` | tenant context | current tenant plus tenant digest when persisted | route body helper | none | not verified | none | OPS-108, OPS-109 |
| 4 | POST | `/api/v1/shadow/policy-foundry/hosted-onboarding-workflow/view` | tenant context | current tenant | route body helper; HTML response | none | n/a | none | OPS-107, OPS-109 |
| 5 | GET | `/api/v1/shadow/policy-foundry/hosted-onboarding-workflow/sessions/:sessionId` | tenant context | tenant digest store lookup; 404 on missing | n/a | n/a | n/a | n/a | none new |

Coverage: 5 / 5 registered onboarding/admission routes.

## 7. Consequence Admission Verification

| Question | Verdict | Evidence |
|---|---|---|
| Does `/api/v1/admissions` reject cross-tenant payload claims? | repo-proven | Envelope creation throws `GenericAdmissionTenantScopeMismatchError`; route returns 403. |
| Is admission mode plan-scoped? | repo-proven | `resolvePlanGenericAdmissionMode(...)` returns 403 on disallowed modes. |
| Are agent loops bounded before engine work? | repo-proven | `evaluateAgentLoopAbuse(...)` returns throttle/conflict outcomes before admission engine work. |
| Does protected release token issuance fail closed when required issuer config is absent? | repo-proven | Route returns 503 with `protected-release-token-issuer-missing`. |
| Is protected release token confirmation sender-bound? | repo-proven | Sender confirmation is resolved before token issuance. |
| Does shadow recording fail closed when unavailable? | repo-proven | Route returns 503 with `shadow-recording-unavailable`. |
| Does onboarding packet generation assert tenant binding on returned shadow events? | gap | OPS-106. |
| Does the hosted onboarding HTML view emit browser hardening headers? | gap | OPS-107. |
| Does hosted wizard persistence consume or prove an idempotency key boundary? | gap | OPS-108. |

Verdict: consequence-admission hardening is repo-proven for tenant mismatch,
plan gating, abuse throttling, protected release token issuance, sender
confirmation, and fail-closed shadow recording. Onboarding-side follow-ups
remain defense-in-depth and replay hardening work.

## 8. Index Discrepancy Check

| Topic | Current state after this report | Required update |
|---|---|---|
| `Service/API boundary` next action | OPS-SWEEP-13 is now indexed and maps onboarding/admission. | Continue final route slice: pipeline verification, pipeline filing, public site, and core. |
| OPS-SWEEP-13 report row | absent before this branch | Add report-index row. |
| OPS-106..OPS-111 | absent before this branch | Add finding-index rows. |
| Live proof register | no new required live proof for this sweep | No register row added. Existing PEP/KMS/replay live proofs remain the high-value live gates. |
| Attestor remediation tracker | no F-series state change | No update. |

## 9. Chain Reactions

| Candidate | Downstream effect | Risk | Verification needed |
|---|---|---|---|
| OPS-106 tenant-bound assertion on shadow events | Store-side tenant leak would fail before packet response. | Low | Route test with planted cross-tenant event. |
| OPS-107 shared HTML helper | Release-review and policy-foundry HTML views get the same browser hardening contract. | Low | Header assertions. |
| OPS-108 wizard state idempotency | Retried hosted wizard POSTs do not create duplicate sessions. | Medium | Store inspection plus replay test. |
| OPS-109 JSON 415 helper | Error status aligns with unsupported media type semantics. | Low | Negative content-type tests. |
| OPS-110 problem-detail redactor | Internal constructor/store strings are not returned to clients. | Low | Redactor fixtures and route negative test. |
| OPS-111 surface caps in matrix/response | Operator visibility improves without changing behavior. | Low | Docs or response contract check. |

## 10. Coverage Delta

- Before Sweep 13: broad domain tests existed for action-surface and
  consequence-admission primitives, but route-surface coverage for hosted
  onboarding/admission was partial.
- After Sweep 13: all 5 onboarding/admission routes are mapped; consequence
  admission hardening is line-item verified; three P2 route hardening gaps and
  three P3 cleanup/accepted-limitation items are indexed.
- Route-surface coverage after Sweep 13: admin, webhook, account, pipeline
  execution/async, shadow, release-decision, and onboarding/admission are
  mapped. Remaining final slice: pipeline verification, pipeline filing,
  public-site, and core routes.

No security, production, compliance, or live-shadow readiness proof claim is
made by this report.

## 11. Verdict

- Sweep 13 report completeness: complete for the scoped 5-route
  onboarding/admission surface.
- Repo-proven P0: none.
- Repo-proven P1: none.
- Remediation requirement: soft yes. OPS-106/107/108 are useful P2 hardening
  items and naturally batch with earlier P2/P3 helper closures.
- Next route target: Sweep 14 for `pipeline-verification-routes.ts`,
  `pipeline-filing-routes.ts`, `public-site-routes.ts`, and `core-routes.ts`.

Recommended sequencing:

1. Finish indexing this Sweep 13 report.
2. Run Sweep 14 as the final route-surface audit.
3. Batch shared P2/P3 cleanup after Sweep 14, so HTML headers, JSON 415
   behavior, problem-detail redaction, pagination, and idempotency helpers can
   be reused consistently.
