# Ops Sweep 09 - Account Routes Authorization Deep Audit

Status: repository remediation landed in this branch; live proof remains outside
the repository.

This report validates and remediates the Sweep 09 intake against
`origin/master @ 906f685faa93cf0b4cb1ca16ca81635a30c31704`. It does not claim
live-shadow readiness, production readiness, enterprise readiness, or complete
coverage of every remaining non-admin public route.

## 0. Recent Fixes Chain-Effect Check

Previous merge:

- PR #515 / merge `906f685faa93cf0b4cb1ca16ca81635a30c31704`
  - scope: OPS-SWEEP-08 webhook signature verification hardening
  - files touched: webhook route handlers, email webhook services, provider
    signature verifiers, webhook rate limiting, live proof gates, deployment
    docs, and webhook tests

Chain-effect verdict:

- Direct regression into account-route scope: none. PR #515 did not modify
  `src/service/http/routes/account-routes.ts`, account auth/application
  services, `src/service/auth-abuse-guard.ts`, or account route tests.
- Defense-in-depth weakening: none. PR #515 strengthened webhook replay,
  signature, rate-limit, and live proof gates.
- Docs/index drift: intentional. OPS-SWEEP-08 closure rows are preserved and
  Sweep 09 adds account-surface evidence.
- Closed finding reopened: none.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth | `origin/master @ 906f685faa93cf0b4cb1ca16ca81635a30c31704` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline driver | Phase 1 required tests: bad token and tenant mismatch; control-map next action: remaining non-admin public route authZ and live route probes |
| Protected principles | customer authority; tenant isolation; auditability; fail-closed boundary; replay and idempotency safety; operational boundedness; data minimization and redaction; no overclaim |
| Scope | `registerAccountRoutes`: public credential challenge, federated callbacks, account-session self-service, account-admin mutations, account billing handoff, and related matrix/live-proof entries |

External anchors used as implementation references:

- OWASP API Security Top 10 2023 names broken authentication and broken
  function-level authorization as API risks for public and role-sensitive
  endpoints. <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- NIST SP 800-63B requires rate limiting for failed authentication attempts
  and salted, attack-resistant password hashing. <https://pages.nist.gov/800-63-4/sp800-63b.html>
- OpenID Connect Core defines Authorization Code Flow, `state`, and `nonce`
  validation expectations. <https://openid.net/specs/openid-connect-core-1_0.html>
- OASIS SAML 2.0 Web Browser SSO Profile defines the Assertion Consumer
  Service response path and signed POST-binding assertion expectations.
  <https://docs.oasis-open.org/security/saml/v2.0/saml-profiles-2.0-os.pdf>

These anchors support the implementation shape only. They are not compliance,
provider deployment, or production-readiness claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `src/service/http/routes/account-routes.ts` | full route inventory + remediation diff | 49 account routes, auth gates, federated callbacks, account mutations |
| `src/service/request-context.ts` | targeted | account session and cookie CSRF behavior |
| `src/service/auth-abuse-guard.ts` | targeted | auth attempt buckets, shared Redis behavior, fail-closed posture |
| `src/service/account-oidc.ts` | targeted | OIDC state, nonce, PKCE, and email-verified linking behavior |
| `src/service/account-saml.ts` | targeted | SAML callback service boundary and replay behavior |
| `src/service/account-user-store.ts` | targeted | scrypt password storage and timing-safe comparison |
| `src/service/application/account-{auth,api-key,user-management,state}-service.ts` | targeted | service-side mutation and bootstrap behavior |
| `src/service/admin-audit-log.ts` and `src/service/control-plane-store.ts` | targeted | existing hash-linked audit ledger reused for account-session audit |
| `src/service/hosted-api-authorization-matrix.ts` | targeted | account route rule claims |
| `docs/audit/{finding-index,report-index,control-map,live-proof-register,current-posture-baseline}.md` | targeted | index and live-proof reconciliation |
| `tests/service-account-routes-authorization.test.ts` | full | new route-level regression coverage |

## 3. Finding Disposition

| ID | Intake state | Validation result | Remediation |
|---|---|---|---|
| OPS-79 federated auth callback rate-limit gap | P1 open | repo-proven | Closed repo-side. SAML ACS and OIDC callback now call the existing auth abuse guard before callback verification. Route tests prove the second request returns 429 and the callback verifier is not invoked again. Live source-IP and IdP retry behavior remains proof-only. |
| OPS-80 account-internal mutation audit gap | P1 open | repo-proven | Closed repo-side for account-session mutations. The existing hash-linked admin audit ledger now accepts `account_session` actors and account action IDs; account API key lifecycle, user/invite lifecycle, password change, passkey registration/deletion, MFA changes, and billing handoff mutations write redacted audit records. Live shared-store chain proof remains required. |
| OPS-81 account-internal mutation idempotency gap | P2 open / partial-repo | repo-proven, narrowed | Still open. Billing checkout already had `Idempotency-Key`; most account-admin user/API-key mutations remain service-defined and need a future idempotency boundary if retry replay safety becomes required. |
| OPS-82 account password policy length-only | P2 open / partial-repo | source-backed decision needed | Still open. Current code enforces length and memory-hard hashing; NIST 800-63B also emphasizes rate limiting and blocklists. Product decision remains: keep length+MFA posture as an accepted limitation or add blocklist/entropy checks. |
| OPS-83 account-route JSON parsing | P2 open / partial-repo | repo-proven | Still open. Many account POST handlers still use `.catch(() => ({}))`; this sweep does not port the admin JSON helper. |
| OPS-84 OIDC callback uses GET | P2 accepted limitation | source-backed accepted limitation | Kept as accepted limitation. OIDC Authorization Code Flow returns `code` through the browser redirect; Attestor mitigates with state, nonce, PKCE, and no token exposure in the user agent. Access-log query redaction remains an ops/proxy concern. |
| OPS-85 auth attempt bucket naming hygiene | P3 open / partial-repo | repo-proven | Still open. Bucket keys are bounded but stringly typed. A typed `AuthAttemptKind` or JSDoc vocabulary can land later. |

## 4. Remediation Summary

Repository changes:

- Added federated callback rate limiting for:
  - `POST /api/v1/auth/saml/acs`
  - `GET /api/v1/auth/oidc/callback`
- Reused the existing auth abuse guard, so the mitigation inherits Redis-backed
  shared-state behavior and production-like fail-closed behavior.
- Extended the existing hash-linked admin audit ledger with
  `actorType: 'account_session'` and account-plane action IDs.
- Wired account-session mutation audit through `buildAccountRouteDeps` so
  runtime routes persist through `appendAdminAuditRecordState`.
- Recorded redacted request material by HMAC-fingerprinting user-facing
  sensitive values before they enter audit metadata.
- Updated the hosted API authorization matrix for account callback rate limits
  and account-session mutation audit.
- Added live proof flags and register entries for federated callback rate
  limits, account mutation audit-chain behavior, and shared auth-abuse store
  behavior.
- Added `tests/service-account-routes-authorization.test.ts`.

## 5. Account Route Coverage

| Route family | Count | Repo-side state after this sweep |
|---|---:|---|
| Public credential challenge and federated callbacks | 15 | Initiation paths are rate-limited; SAML ACS and OIDC callback now rate-limit before callback verification. Signup/login/passkey/MFA/password-reset flows remain action-token or challenge-token bounded. |
| Account-session self-service | 15 | `requireAccountSession` remains the authority boundary; cookie transport keeps CSRF protection. Sensitive account-session mutations now write account-session audit records. |
| Account-admin role-gated API key, user, invite, and reset actions | 15 | `account_admin` role gates remain; mutations now write account-session audit records. Idempotency is still service-defined except where already explicit. |
| Billing handoff | 4 | Checkout keeps the existing `Idempotency-Key`; checkout and portal handoffs now write account-session audit records. |

Coverage: 49/49 account routes were inventoried from
`src/service/http/routes/account-routes.ts`. This is repo-side route evidence,
not live production proof.

## 6. Authority Boundary

How this strengthens the single Attestor consequence boundary:

- It reduces pre-auth crypto amplification on account federation callbacks.
- It makes account-session mutations for customer authority visible in the same
  hash-linked audit ledger already used by operator admin mutations.
- It keeps the audit path as evidence only. Account mutation audit does not
  grant authority, weaken role checks, reduce CSRF/session requirements, write
  policy, or activate enforcement.

The new audit signal is operator-owned forensic evidence. It is not an
authorization source and cannot approve, block, or bypass a route on its own.

## 7. Chain Effects

| Surface | Effect |
|---|---|
| Direct regression | Account callback routes now have a new 429 path before expensive callback verification. This is intentional operational boundedness and tested. |
| Downstream caller breakage | Very bursty IdP retries can now hit the auth abuse bucket. Live IdP retry compatibility is listed as `LP-FEDERATED-CALLBACK-RATE-LIMIT`. |
| Audit ledger schema | `AdminAuditRecord.actorType` now includes `account_session`, and `AdminAuditAction` includes account-plane actions. Existing admin actors/actions remain valid. |
| Privacy / redaction | Audit records use request hashes and HMAC fingerprints for sensitive account/provider reference values. One-time plaintext API keys, passwords, invite tokens, reset tokens, passkey credential IDs, raw Stripe handoff IDs, and raw provider callback bodies are not written to audit metadata. |
| Live proof | New live proof flags are required for callback rate-limit behavior, account audit-chain behavior, and shared auth-abuse-store behavior. |

## 8. Verification

Local checks run:

- `npm run test:service-account-routes-authorization`
- `npm run typecheck`

Broader checks for this PR are tracked in the final PR/merge checkpoint. This
report alone does not claim Tier 4 `npm run verify` completion.

## 9. Remaining No-Claims

- No claim of production, live-shadow, or enterprise readiness.
- No claim that live IdP source-IP behavior or retry behavior is proven.
- No claim that live audit records are retained, monitored, or cross-instance
  chain-verified until `LP-ACCOUNT-MUTATION-AUDIT-CHAIN` is captured.
- No claim that all account mutations are idempotency-keyed; OPS-81 remains
  open for future work.
- No claim that malformed JSON handling is closed for account routes; OPS-83
  remains open.
- No claim that password policy is stronger than the current length, hashing,
  MFA, and rate-limit posture; OPS-82 remains a product/security decision.

## 10. Verdict

- OPS-79: closed repo-side / live-proof-only.
- OPS-80: closed repo-side / live-proof-only for account-session mutations.
- OPS-81: open / partial-repo.
- OPS-82: open / partial-repo.
- OPS-83: open / partial-repo.
- OPS-84: accepted limitation.
- OPS-85: open / partial-repo.

Recommended next target after this PR: Sweep 10 on
`pipeline-execution-routes.ts` and `pipeline-async-routes.ts`, because tenant
runtime authorization, bad-token behavior, provider outage handling, and
consequence-control execution converge there.
