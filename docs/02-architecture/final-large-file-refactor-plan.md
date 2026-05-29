# Final Large File Refactor Plan

Status: in progress. This document is the execution contract for the final
broad large-file reduction wave after V2 closed the `control-plane-store.ts`,
`consequence-admission/index.ts`, and `shadow-routes.ts` hotspots.

This is a repository maintainability plan only. It does not change runtime
claims, production readiness, customer enforcement, compliance posture, or live
proof state.

## Why This Exists

The final wave reduces files that are still large because they mix route,
store, bootstrap, type, or test responsibilities. It is not a blind line-count
cleanup.

Large Attestor files may remain large when the file is one coherent protocol,
adapter, proof, or conformance surface and a split would make review or
security reasoning worse.

Source-backed guardrails:

- ESLint documents large files as a maintainability and complexity concern.
- GitHub and Google engineering guidance favor small, focused changes that are
  easier to review and roll back.
- TypeScript file moves must preserve runtime module resolution, not just pass
  text search.
- Hono route grouping supports registering route families from smaller app or
  module surfaces while preserving the main application's routing contract.

References:

- <https://eslint.org/docs/latest/rules/max-lines>
- <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes>
- <https://google.github.io/eng-practices/review/developer/small-cls.html>
- <https://www.typescriptlang.org/docs/handbook/modules/theory.html>
- <https://hono.dev/api/routing>

## Targets

| File | Current lines | Target after final wave | Refactor type |
|---|---:|---:|---|
| `src/service/http/routes/account-routes.ts` | 2588 | 150-250 facade | account route-family extraction |
| `src/service/http/routes/release-policy-control-routes.ts` | 1679 | 150-300 facade | release policy route-family extraction |
| `src/service/http/routes/admin-routes.ts` | 1579 | 150-300 facade | admin route-family extraction |
| `src/service/application/stripe-webhook-billing-processor.ts` | 1352 | 400-800 | billing processor family extraction |
| `src/service/billing/billing-event-ledger.ts` | 1242 | 400-800 | billing ledger family extraction |
| `src/service/shadow/shadow-persistence-store.ts` | 1241 | 400-800 | shadow persistence family extraction |
| `src/service/bootstrap/release-runtime.ts` | 951 | 800-1200 cohesive facade | release runtime bootstrap extraction |
| `src/service/bootstrap/release-tenant-signer-boundary.ts` | 928 | 800-1200 cohesive facade | release tenant signer boundary extraction |
| `src/financial/types.ts` | 12 facade + type modules <=403 | closed | financial type-family extraction |
| `tests/live-api.test.ts` | 141 facade + modules <= 882 | closed | live API test-family extraction |
| `tests/generic-admission-mode-ladder.test.ts` | 10 facade + modules <= 578 | closed | generic admission mode test-family extraction |
| `tests/generic-admission-routes.test.ts` | 10 facade + modules <= 367 | closed | generic admission route test-family extraction |
| `tests/financial.test.ts` | 1674 | split by financial scenario | financial test-family extraction |

Estimated moved code: 18000-22000 lines into smaller responsibility-named
modules and test files.

Current execution status:

- `F-00` through `F-14` are closed repo-side.
- Next round: `F-15` financial test split and final registry/docs closeout.

## Planned Rounds

| Round | Scope | Expected reduction | Required local checks |
|---:|---|---:|---|
| F-00 | Final plan and contract | 0 | `test:large-file-budget-docs`, `test:large-file-budget`, `git diff --check` |
| F-01 | `account-routes.ts`: route inventory and parity lock | 0 | account route contract tests, hosted authorization matrix, large-file budget |
| F-02 | `account-routes.ts`: public auth/session/password routes | 500-750 | account auth service, account routes authorization, typecheck, hygiene |
| F-03 | `account-routes.ts`: federated auth, MFA, and passkey routes | 700-1000 | account auth abuse, account CORS/CSRF, account routes authorization, typecheck, hygiene |
| F-04 | `account-routes.ts`: API-key, user, invite, and password-reset routes | 700-1000 | account API-key service, user management service, account routes authorization, typecheck, hygiene |
| F-05 | `account-routes.ts`: account visibility, email delivery, billing routes, and facade closeout | 400-650 | hosted product flow docs, hosted authorization matrix, account routes authorization, large-file budget |
| F-06 | `release-policy-control-routes.ts`: inventory, read routes, and simulation/discovery routes | 500-700 | release policy admin routes, release review routes, hosted authorization matrix, typecheck, hygiene |
| F-07 | `release-policy-control-routes.ts`: mutation, activation, rollback, and facade closeout | 700-900 | release policy admin routes, release policy control tests, large-file budget |
| F-08 | `admin-routes.ts`: route inventory, read routes, and role-scoped mutation helpers | 500-700 | service admin routes HTTP tests, hosted authorization matrix, typecheck, hygiene |
| F-09 | `admin-routes.ts`: mutation route families and facade closeout | 700-900 | service admin routes HTTP tests, admin audit tests, large-file budget |
| F-10 | Billing processor and billing ledger family extraction | 700-1100 | Stripe webhook/billing tests, billing event ledger tests, typecheck, hygiene |
| F-11 | Shadow persistence store family extraction | 400-700 | shadow route HTTP tests, shadow persistence tests, typecheck, hygiene |
| F-12 | Release runtime and tenant signer bootstrap extraction | 800-1200 | release runtime, signer boundary, production-shared tests, typecheck, hygiene |
| F-13 | Financial type-family extraction | 600-900 | financial tests, typecheck, hygiene, package-surface checks if touched |
| F-14 | Live API and generic admission test-family extraction | 3000-4500 | split test scripts, package-script runner, large-file budget |
| F-15 | Financial test split and final registry/docs closeout | 1000-1700 | financial tests, large-file budget docs, large-file budget, package-script runner |

## Parity Locks Before Moves

Each major surface gets an inventory/parity lock before the risky part of the
split. A file move that compiles is not enough; the moved slice must still have
the same names, request/response shapes, defaults, status codes, headers,
redaction behavior, and storage behavior.

| Surface | Parity lock required before or in first slice |
|---|---|
| `account-routes.ts` | method/path inventory, session/auth authority inventory, mutation idempotency inventory, account audit emission inventory, response material/redaction inventory |
| `release-policy-control-routes.ts` | admin role inventory, read/mutation/break-glass route inventory, policy actor metadata inventory, status/header inventory |
| `admin-routes.ts` | role-scoped admin route inventory, mutation audit inventory, rate-limit/auth ordering inventory, response material/redaction inventory |
| Billing processor/ledger | webhook state inventory, event ordering inventory, replay/dedupe inventory, exported ledger shape inventory |
| Shadow persistence store | read/write family inventory, tenant scope inventory, snapshot/restore inventory, persistence fallback inventory |
| Release bootstrap | runtime dependency inventory, key/signer boundary inventory, shared-store and production-like guard inventory |
| Financial types/tests | type-family inventory, import compatibility inventory, scenario matrix inventory |
| Live/generic test files | scenario-family inventory, helper extraction map, package script map |

## Risk Profiles

Different files fail in different ways. Verification must follow the risk, not
one generic checklist.

| Surface | Main refactor risks | Extra checks |
|---|---|---|
| Account routes | auth/session authority drift, missing CSRF/CORS guard, mutation idempotency drift, audit omission, raw API-key response mishandling | account route authorization, account auth service, API-key service, user management service, hosted authorization matrix |
| Release policy routes | admin role escalation, break-glass route drift, policy actor metadata becoming authority, activation/rollback status drift | release policy admin routes, release review admin routes, policy control tests |
| Admin routes | role-scoped key bypass, rate-limit ordering drift, admin mutation audit omission, sensitive response drift | service admin routes HTTP tests, hosted authorization matrix, admin audit tests |
| Billing processor/ledger | webhook dedupe drift, event ordering drift, provider error leakage, billing entitlement projection drift | Stripe webhook/billing tests, billing event ledger tests |
| Shadow persistence | tenant scope drift, raw payload leakage, persistence fallback drift, snapshot/restore drift | shadow route HTTP tests, persistence/store tests |
| Release bootstrap | production-like guard weakening, signer boundary drift, shared-store dependency drift | release runtime tests, production-shared tests, signer boundary tests |
| Type/test splits | exported type drift, script path drift, scenario coverage loss | typecheck, package-script runner, split test scripts |

## Guardrails

- Keep existing public import paths and route registration functions stable.
- Prefer move-only PRs. If behavior must change, stop and open a separate PR.
- No runtime behavior change is intended. Any behavior change discovered during
  this tracker must be treated as a regression unless explicitly promoted into
  a separate behavior-change PR.
- Do not split crypto/protocol adapters in this wave unless a focused audit
  proves a coherent helper boundary and a matching negative test plan.
- Do not weaken fail-closed, redaction, idempotency, tenant isolation, role
  authority, replay, signing, or audit behavior.
- Keep each PR small enough to review and revert.
- Update the closest inventory, budget, and lock test in the same PR as the
  move.
- Run a read-only second-opinion audit at the account, release/admin, billing/
  shadow/bootstrap, and final test-split boundaries. Model output remains
  `opinion / design hypothesis` until confirmed by repository evidence.

## Intentional Exceptions

These large files are not final-wave split targets. They remain registered hard
limit exceptions unless module-specific risk warrants a focused audit and PR.

| Surface | Reason |
|---|---|
| `src/crypto-authorization-core/*` large adapter files | protocol/adapter surfaces; splitting by line count can make security reasoning worse |
| `src/crypto-execution-admission/*` large adapter and conformance files | package-boundary crypto execution surfaces; split only with adapter-specific tests |
| `src/release-enforcement-plane/envoy-ext-authz.ts` | Envoy ext_authz bridge behavior is route-risk-class sensitive |
| `src/release-enforcement-plane/async-envelope.ts` | async envelope verification surface; split only with verifier coverage |
| `src/release-kernel/release-evidence-pack.ts` | canonical proof/evidence material; split only with canonicalization/DSSE parity tests |
| `src/consequence-admission/general-crypto-transaction-gate.ts` | crypto gate surface; split only with crypto gate golden tests |

## Rollback Strategy

- One PR per slice.
- Keep compatibility facades until closeout.
- Revert the slice PR if a route/store/package/test contract drifts.
- If a behavior drift is desirable, stop the refactor and promote it into a
  separate behavior-change PR with its own tests and no-claims.

## Closeout Criteria

The final wave is complete only when all of the following are true:

- No non-exception mixed responsibility route, store, bootstrap, billing, type,
  or test file remains above 1200 lines.
- `account-routes.ts`, `release-policy-control-routes.ts`, and `admin-routes.ts`
  are small route registration facades or are explicitly justified in the
  registry with fresh route matrices.
- The remaining hard-limit registry entries are limited to intentional
  protocol, adapter, conformance, proof, or canonical evidence exceptions.
- `npm run test:large-file-budget` is green.
- Every moved slice has a targeted local check and green GitHub checks.

## No-Claims

This plan is repository-side maintainability evidence only.

It does not prove production readiness, live customer enforcement, customer PEP
no-bypass, external KMS signing, shared replay safety, compliance readiness, or
enterprise readiness.
