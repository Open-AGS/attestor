# Ops Sweep 12 - Release Review + Release Policy Control Routes Deep Audit

Status: audit report plus narrow OPS-100 repo-side remediation. No live proof
captured. No production-readiness claim.

## 0. Recent Fixes Chain-Effect Check

Source of truth before this branch:
`origin/master @ c839b0bf453dd6cbaffa67d2957c76975ca13c47`.

One remediation PR had landed since Sweep 11:

- PR #518 closed the Sweep 11 P1 shadow-route findings repo-side
  (`OPS-93`, `OPS-94`) and added the shadow mutation audit live proof gate.

Chain-effect verdict: PR #518 did not touch
`src/service/http/routes/release-review-routes.ts`,
`src/service/http/routes/release-policy-control-routes.ts`, release-layer
review primitives, policy-control-plane stores, or release-route tests. Sweep
12 starts from a clean release-route-scope precondition.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source HEAD | `origin/master @ c839b0bf453dd6cbaffa67d2957c76975ca13c47` |
| Branch evidence | `codex/ops-sweep-12-release-role-enforcement` |
| Phase | Phase 1 - Live Shadow Readiness |
| Protected principles | customer authority; operational boundedness; auditability; fail-closed boundary; release provenance; replay and idempotency safety; data minimization and redaction; no overclaim |
| Audit driver | Phase 1 required tests: bad token, replay, dashboard/proof artifact privacy review; release-decision-side counterpart to the shadow consequence-observation surface |
| Scope | `src/service/http/routes/release-review-routes.ts`, `src/service/http/routes/release-policy-control-routes.ts`, release admin role helper, release-route HTTP tests, live proof register/gate |

External anchors used as implementation references:

- OWASP API Security Top 10 2023 API5 for broken function-level
  authorization: <https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/>.
- OWASP ASVS V4 for access-control verification vocabulary:
  <https://owasp.org/www-project-application-security-verification-standard/>.
- NIST SP 800-92 for audit trail and log-management discipline:
  <https://csrc.nist.gov/pubs/sp/800/92/final>.
- RFC 7231 method semantics and status-code vocabulary:
  <https://www.rfc-editor.org/rfc/rfc7231>.

These anchors support the implementation shape only. They are not compliance,
production-readiness, or certification claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `src/service/http/routes/release-review-routes.ts` | full route inventory + remediation diff | 8 release-review routes, approve/reject/override mutation boundary |
| `src/service/http/routes/release-policy-control-routes.ts` | full route inventory + remediation diff | 23 release-policy-control routes, activation, rollback, emergency break-glass boundary |
| `src/service/http/routes/admin-routes.ts` | targeted | comparator for role-scoped admin-key enforcement pattern |
| `src/service/request-context.ts` | targeted | role-scoped admin key env contract and bearer-token validation |
| `scripts/check-ops-live-shadow-readiness.mjs` | targeted | live proof gate alignment |
| `tests/release-policy-control-plane-admin-routes.test.ts` | full | existing policy-control route flow coverage plus new role-escalation assertions |
| `tests/release-review-admin-routes.test.ts` | full | new release-review role-escalation coverage |
| `docs/audit/{finding-index,report-index,control-map,live-proof-register,current-posture-baseline}.md` | targeted | index and no-overclaim alignment |

## 3. Finding Disposition

| ID | Intake state | Validation result | Remediation |
|---|---|---|---|
| OPS-100 release-route role-scoped admin enforcement gap | P1 open | repo-proven | Closed repo-side / live-proof-only. Release-review and release-policy-control routes now require credential-bound admin roles before reads, mutations, and emergency break-glass operations. Client-supplied actor role headers can label policy-domain actors but cannot escalate the credential role. Live deployed role-key separation proof remains required. |
| OPS-101 release-policy-control typed-error gap | P2 open / partial-repo | still open | Not remediated. Policy-control mutation handlers still flatten many thrown errors to 400. |
| OPS-102 release-policy-control listing pagination gap | P2 open / partial-repo | still open | Not remediated. Several listing routes still need bounded `limit` / cursor behavior. |
| OPS-103 release-review HTML security headers gap | P2 open / partial-repo | still open | Not remediated. Reviewer HTML routes still need CSP / `nosniff` / referrer / frame headers. |
| OPS-104 break-glass body/header coercion inconsistency | P3 accepted limitation | unchanged | Not remediated. Both explicit body and header acknowledgement paths remain supported. |
| OPS-105 release-policy-control default actor role | P3 open / partial-repo | narrowed | Partially closed by OPS-100. `routeAdminActor` now derives its actor from the release admin auth helper instead of silently defaulting to `policy-admin`; policy-domain actor labels are still accepted as audit labels after credential authorization. |

## 4. Remediation Summary

Repository changes:

- Added `src/service/http/release-admin-authorization.ts` as the release-route
  role enforcement helper.
- Applied read, mutation, and break-glass role allowlists to every
  release-review route.
- Applied read, mutation, and break-glass role allowlists to every
  release-policy-control route.
- Replaced claimed-role-only emergency authorization with credential-bound
  route authorization; `policy-break-glass` remains an audit actor label, not
  an authorizing credential role.
- Cached configured role-key digests inside the helper so release-route tests
  do not repeatedly pay the full scrypt cost per configured admin key.
- Added release-review and release-policy-control HTTP tests proving that
  `admin-read` / `admin-release-admin` keys cannot escalate by changing
  `x-attestor-admin-actor-role`.
- Added `ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF` as the live proof gate.

## 5. Release Route Coverage

| Route family | Count | Repo-side state after this sweep |
|---|---:|---|
| Release-review reads | 5 | Credential-bound read roles only: `admin-superuser`, `admin-read`, `admin-release-admin`, `admin-break-glass`. |
| Release-review approve/reject | 2 | Credential-bound mutation roles only: `admin-superuser`, `admin-release-admin`. |
| Release-review override | 1 | Credential-bound break-glass roles only: `admin-superuser`, `admin-break-glass`. |
| Release-policy-control reads | 11 | Credential-bound read roles only. |
| Release-policy-control normal mutations | 10 | Credential-bound mutation roles only. |
| Release-policy-control emergency freeze/rollback | 2 | Credential-bound break-glass roles only; body/header acknowledgement plus reason/rationale still required. |

Coverage: 31 / 31 registered release-decision routes.

## 6. Authority Boundary

How this strengthens the single Attestor consequence boundary:

- It prevents broad admin-key holders from approving, activating, rolling back,
  or emergency-freezing release policy state by changing a client-controlled
  actor-role header.
- It keeps emergency release operations tied to deployed break-glass credential
  material, not request wording or audit-label claims.
- It preserves the existing admin audit chain and policy mutation audit chain.

What it does not have authority to do:

- It does not prove deployed operators actually use separate role-scoped keys.
- It does not rotate or remove the legacy `ATTESTOR_ADMIN_API_KEY` superuser
  fallback.
- It does not close policy-control typed errors, pagination, or release-review
  HTML security headers.
- It does not grant policy-domain actor labels authority; they remain audit
  metadata after the credential role is accepted.

## 7. Chain Effects

| Surface | Effect |
|---|---|
| Direct regression | Release-review and release-policy-control now use the shared release role helper before route work. |
| Audit ledger | Existing admin and policy mutation audit writes remain in place; actor metadata is now derived from the credential-bound helper. |
| Emergency operations | Freeze and rollback still require explicit break-glass acknowledgement plus reason/rationale; authorization now comes from `admin-break-glass` or superuser credentials. |
| Live proof | New live proof flag is required before claiming deployed release-route role-key separation. |
| Remaining gaps | OPS-101, OPS-102, OPS-103 remain open follow-ups; OPS-104 remains accepted; OPS-105 is narrowed but not promoted as a standalone closure claim. |

## 8. Verification

Local checks run for this branch:

- `npm run test:release-policy-control-plane-admin-routes`
- `npm run test:release-review-admin-routes`
- `npm run test:hosted-api-authorization-matrix`
- `npm run test:ops-live-shadow-readiness`
- `npm run test:package-script-runner`
- `npm run test:audit-finding-evidence`
- `npm run test:security-evidence-system`
- `npm run check:baseline-alignment`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `git diff --check`

Broader checks are tracked in the PR/merge checkpoint. Tier 4 `npm run verify`
is not claimed by this report.

## 9. Remaining No-Claims

- No live proof was captured.
- No production, limited-enforcement, enterprise-readiness, compliance, or
  full security posture claim is made.
- No claim that the deployed role-scoped admin keys are split until
  `ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF` is captured.
- No claim that the legacy superuser key has been rotated or tightly held.
- No claim that OPS-101, OPS-102, or OPS-103 are closed.

## 10. Verdict

- OPS-100: closed repo-side / live-proof-only.
- OPS-101: open / partial-repo.
- OPS-102: open / partial-repo.
- OPS-103: open / partial-repo.
- OPS-104: accepted limitation.
- OPS-105: narrowed by OPS-100, still tracked as cleanup if actor-label
  defaults are revisited.

Recommended next target: Sweep 13 on
`action-surface-onboarding-routes.ts`, `policy-foundry-hosted-onboarding-routes.ts`,
and `generic-admission-routes.ts`, the onboarding-side counterpart to the
release-decision surface.
