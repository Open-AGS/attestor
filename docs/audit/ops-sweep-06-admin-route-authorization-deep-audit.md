# Ops Sweep 06 - Admin Route Authorization Deep Audit

Status: repository-side audit and remediation record. This closes the Sweep 06
P1 and P2 admin-route findings in the repository. It does not claim live
shadow readiness, production readiness, or live operator-role deployment.

## 0. Recent Fixes Chain-Effect Check

Previous merge into `origin/master`: PR #512 / commit
`bce83297395dd1c8e8467b3c322e3dcfd3b14f4c`.

PR #512 changed only observability and audit-index evidence:

| File group | Admin route audit impact |
|---|---|
| `docs/audit/{control-map,finding-index,live-proof-register,report-index}.md` | no admin route behavior change |
| `docs/audit/ops-sweep-05-collector-resilience-audit-verification.md` | no admin route behavior change |
| `ops/kubernetes/observability/**` | no admin route behavior change |
| `scripts/check/check-ops-live-shadow-readiness.mjs` | no admin route behavior change |
| `scripts/render-observability-release-bundle.ts` | no admin route behavior change |
| `tests/{kubernetes-observability-bundle,observability-release-bundle-render,ops-sweep-04-storage-collector-remediation}.test.ts` | no admin route behavior change |

Chain-effect verdict: PR #512 does not touch
`src/service/http/routes/admin-routes.ts`, `src/service/request-context.ts`,
admin application services, admin audit storage, admin idempotency storage, or
admin-route tests. No admin-route regression, config drift, defense-in-depth
weakening, or closed-finding reopening was found.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth | `origin/master @ bce83297395dd1c8e8467b3c322e3dcfd3b14f4c` |
| Phase | Phase 1 - Live Shadow Readiness |
| Baseline blocker | Admin route authorization deep audit |
| Protected principles | customer authority; operational boundedness; auditability; fail-closed boundary; data minimization and redaction; no overclaim |
| Scope | `/api/v1/admin/*` routes registered by `registerAdminRoutes`, admin auth, mutation idempotency, mutation audit, route tests, and middleware evidence |
| External anchors | OWASP API Top 10 2023 API1/API3/API5/API6; OWASP ASVS V2/V4/V9/V13; NIST SP 800-218 PW.8/PO.5; NIST SP 800-92; RFC 6750; CWE-307/CWE-770/CWE-778/CWE-862/CWE-863 |

## 2. Inspected Files

| File | Depth | Why selected |
|---|---|---|
| `src/service/http/routes/admin-routes.ts` | full | route inventory, auth gate, mutation and read behavior |
| `src/service/request-context.ts` | targeted | admin bearer auth and role-scoped credential entry points |
| `src/service/secret-derivation.ts` | targeted | scrypt-backed token comparison cost and timing-safe comparison |
| `src/service/admin-audit-log.ts` | targeted | mutation audit actor schema |
| `src/service/application/admin-mutation-service.ts` | targeted | idempotency and audit finalization |
| `src/service/control-plane-store.ts` | targeted | shared admin audit chain persistence |
| `src/service/hosted-api-authorization-matrix.ts` | targeted | admin route control map |
| `src/service/bootstrap/routes.ts` | targeted | middleware above `/api/v1/admin/*` |
| `src/service/bootstrap/production-shared-request-guard.ts` | targeted | no session/cookie authority hydration on admin routes |
| `tests/release-policy-control-plane-admin-routes.test.ts` | targeted | existing multi-actor admin header pattern |
| `tests/service-admin-{control,mutation,query}-service.test.ts` | targeted | existing application-service coverage |
| `ops/observability/prometheus/alerts.yml` | targeted | `AttestorAdminAuthFailure` alert coverage |
| `docs/audit/*index.md`, `docs/audit/ops-sweep-01..05*.md` | targeted | index alignment and prior sweep format |

## 3. Positive Observations

| ID | Observation | Evidence |
|---|---|---|
| ADM-POS-01 | Every admin route had an admin auth gate before this remediation. | `admin-routes.ts` |
| ADM-POS-02 | Admin token comparison is digest-normalized and timing-safe. | `request-context.ts`, `secret-derivation.ts` |
| ADM-POS-03 | Admin API fails closed when no admin credential is configured. | `currentAdminAuthorized` |
| ADM-POS-04 | Mutations pass through idempotency before side effects are finalized. | `admin-mutation-service.ts` |
| ADM-POS-05 | Mutation audit records are hash-linked. | `admin-audit-log.ts`, `control-plane-store.ts` |
| ADM-POS-06 | Security alerting covers repeated admin auth failures. | `ops/observability/prometheus/alerts.yml` |
| ADM-POS-07 | Admin routes do not consume cookie/session authority. | `admin-routes.ts`, `request-context.ts`, `bootstrap/routes.ts` |

## 4. Findings And Remediation

| ID | Severity | Final state | Evidence | Remediation |
|---|---:|---|---|---|
| OPS-57 | P1 | `closed / live-proof-only` | single global admin bearer existed for all admin routes | Added role-scoped admin credentials, route-level role allowlists, actor identity capture, and `actorRole` audit persistence. Legacy `ATTESTOR_ADMIN_API_KEY` remains a superuser fallback for compatibility; live deployment must prove role-scoped key adoption before stronger claims. |
| OPS-58 | P1 | `closed` | `admin-routes.ts` had no HTTP-layer route tests | Added `tests/service-admin-routes-http.test.ts` covering role-scoped account creation, read-key mutation denial, auth-rate-limit short circuit, JSON content-type enforcement, and list default limits. |
| OPS-59 | P1 | `closed / live-proof-only` | admin auth ran scrypt comparison before any route-level throttle | Added path-scoped admin auth rate limiting before `currentAdminAuthorized`; test proves the third over-limit request does not call the auth check. Live abuse traffic proof remains outside repository evidence. |
| OPS-60 | P2 | `accepted limitation` | admin GET routes do not write mutation audit records | Kept as a documented limitation. Read audit volume and actor identity retention should be decided after live role-scoped operator deployment. |
| OPS-61 | P2 | `closed` | admin POST handlers cast JSON bodies and several silently coerced malformed JSON to `{}` | Added a shared JSON body helper requiring `Content-Type: application/json`, object bodies, and fail-closed 400/415 responses. |
| OPS-62 | P2 | `closed` | listing routes allowed unlimited reads or optional unlimited `limit` | Added default and maximum caps to admin list/read surfaces, including accounts, tenant keys, audit, billing, email delivery, DLQ, degraded-mode grants, usage, and billing export/reconciliation. |
| OPS-63 | P2 | `accepted limitation` | key issuance, rotation, and recovery return one-time clear-text API key material | Kept behavior because issuance requires returning the newly generated secret once; matrix privacy text now names response-side key material and redaction requirements. |
| OPS-64 | P2 | `contradicted` | potential cookie/session pass-through into admin routes | Repo evidence shows admin routes read only bearer auth and do not call session/cookie helpers; the only pre-admin middleware does not hydrate account session authority. |

## 5. Route Coverage

All 32 `registerAdminRoutes` admin routes were mapped. Every mutation now
enters through:

```text
admin auth rate limit
  -> currentAdminAuthorized
  -> route role allowlist
  -> admin mutation idempotency
  -> side effect
  -> audit finalization with actorType / actorLabel / actorRole
```

Read routes now require a route role and apply bounded list limits where the
route can return multiple records. `/api/v1/metrics` remains under
`currentMetricsAuthorized` and is not treated as an admin mutation surface.

## 6. Discrepancy Check Against Indexes

| Index topic | Result |
|---|---|
| `src/service` admin routes gap | Reconciled. The gap is now mapped, and the P1/P2 route-surface findings are closed repo-side except accepted limitations. |
| Admin API key blast radius | Narrowed from single global bearer to role-scoped credential support plus legacy superuser fallback. Live proof is still needed for real role-key deployment and legacy-key rotation. |
| Test adequacy map | Admin route HTTP slice is now covered by a dedicated test file. The global test adequacy map remains open. |
| OPS-30 security alert coverage | Unchanged; admin auth failure alert remains in place. |
| OPS-64 | Disputed/closed by repository evidence and not added as an open finding. |

## 7. Chain-Effect Check

| Area | Check |
|---|---|
| Direct regressions | Targeted HTTP tests cover new role gate, rate limit, JSON helper, and list cap behavior. |
| Downstream callers | Legacy `ATTESTOR_ADMIN_API_KEY` still works as `admin-superuser`, so existing operator scripts are not broken by requiring new role headers immediately. |
| Defense-in-depth | Role-scoped keys are accepted by `currentAdminAuthorized`; admin routes then enforce route-specific roles. |
| Config drift | New optional env keys are role-scoped; absence does not disable the legacy admin key path. |
| Docs drift | `finding-index.md`, `report-index.md`, `live-proof-register.md`, and `control-map.md` are updated with repo/live proof boundaries. |
| Test coverage drift | `test:service-admin-routes-http` and existing admin mutation tests cover the changed behavior. |
| Closed findings | OPS-64 remains contradicted; no prior closed ops finding is reopened. |

## 8. Remaining Proof And Limitations

- This does not prove live operator-role deployment.
- This does not prove live rate-limit behavior under real abuse traffic.
- This does not remove the legacy `ATTESTOR_ADMIN_API_KEY` superuser fallback;
  it keeps compatibility while enabling role-scoped deployment.
- Admin read access is still not written to the mutation audit ledger.
- Response-side API key material remains an accepted issuance limitation and
  must be protected by runtime/proxy log redaction.
- Production readiness, limited enforcement readiness, and enterprise readiness
  are still not claimed.

## 9. Verdict

- Sweep 06 report: complete repository-side.
- Repo-proven P0 remaining in this sweep: none.
- Repo-proven P1 remaining in this sweep: none after remediation.
- Repo-proven P2 remaining in this sweep: none requiring immediate code change;
  OPS-60 and OPS-63 are accepted limitations.
- Live proof still required: role-scoped operator deployment, admin rate-limit
  abuse probe, and the broader Phase 1 live-shadow proofs in
  `live-proof-register.md`.
- Next locked target: continue Ops Sweep 07 with profiles, provider overlays,
  and live proof capture, while keeping the accepted admin read/key-material
  limitations visible.
