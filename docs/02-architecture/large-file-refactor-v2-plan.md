# Large File Refactor V2 Plan

Status: in progress. This document is the execution contract for the current
large-file reduction wave after the first `control-plane-store.ts` splits.

This is a repository maintainability plan only. It does not change runtime
claims, production readiness, customer enforcement, compliance posture, or live
proof state.

## Why This Exists

Large Attestor files should shrink because they mix responsibilities, not
because line count is a goal by itself. The target is local change, reviewable
diffs, clear boundaries, and tests that prove the moved surface still behaves
the same.

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

| File | Current lines | Target after V2 | Refactor type |
|---|---:|---:|---|
| `src/service/control-plane-store.ts` | 3415 | 700-1000 | store-family extraction behind compatibility facade |
| `src/consequence-admission/index.ts` | 108 after V2-12 | achieved | compatibility facade over split public-surface and engine-helper modules |
| `src/service/http/routes/shadow-routes.ts` | 1611 after V2-15 | 900-1300 | route-family extraction behind `registerShadowRoutes` |

Estimated moved code: 6500-7500 lines into smaller responsibility-named modules.

## Planned Rounds

| Round | Scope | Expected reduction | Required local checks |
|---:|---|---:|---|
| 1 | V2 plan and contract | 0 | `test:large-file-budget-docs`, `test:large-file-budget`, `git diff --check` |
| 2 | `control-plane-store`: async dead-letter state | 120-180 | store inventory, large-file budget, typecheck, hygiene, async/DLQ tests |
| 3 | `control-plane-store`: hosted email delivery state | 160-220 | store inventory, large-file budget, typecheck, hygiene, email delivery tests |
| 4 | `control-plane-store`: Stripe webhook state | 250-320 | store inventory, large-file budget, typecheck, hygiene, Stripe webhook tests |
| 5 | `control-plane-store`: tenant key and usage state | 450-650 | store inventory, large-file budget, typecheck, hygiene, usage/tenant-key tests |
| 6 | `control-plane-store`: account users, sessions, tokens | 700-900 | store inventory, large-file budget, typecheck, hygiene, account/auth tests |
| 7 | `control-plane-store`: hosted account and billing state | 600-800 | store inventory, large-file budget, typecheck, hygiene, billing/account tests |
| 8 | `control-plane-store`: snapshots plus facade closeout | 300-500 | backup PG, package-script runner, large-file budget, typecheck, hygiene |
| 9 | `consequence-admission/index.ts`: public-surface inventory lock | 0 | public-surface docs/tests, package-surface probe, large-file budget |
| 10 | `consequence-admission/index.ts`: constants/types/contracts split | 900-1200 | consequence admission contract/surface tests, typecheck, hygiene |
| 11 | `consequence-admission/index.ts`: descriptor/catalog split | 700-1000 | package-surface probe, public-surface contract, typecheck, hygiene |
| 12 | `consequence-admission/index.ts`: engine helpers split and closeout | complete; facade now 108 lines | admission mode ladder, generic routes, package-surface probe, typecheck, hygiene |
| 13 | `shadow-routes.ts`: summary/dashboard/audit routes | complete; extracted to `shadow-summary-dashboard-routes.ts` | shadow summary/dashboard route tests, typecheck, hygiene |
| 14 | `shadow-routes.ts`: simulation/history routes | complete; extracted to `shadow-simulation-history-routes.ts` plus shared mutation helpers | shadow simulation/history tests, tenant boundary, typecheck, hygiene |
| 15 | `shadow-routes.ts`: policy-foundry/promotion routes | complete; extracted to `shadow-policy-foundry-promotion-routes.ts` | policy-foundry, promotion, bundle publication tests, typecheck, hygiene |
| 16 | `shadow-routes.ts`: activation/receipt routes plus closeout | 500-800 | activation, handoff, receipt, shadow HTTP tests, large-file budget |

## Parity Locks Before Moves

Each major surface gets an inventory/parity lock before the risky part of the
split. A file move that compiles is not enough; the moved slice must still have
the same names, request/response shapes, defaults, and storage behavior.

| Surface | Parity lock required before or in first slice |
|---|---|
| `control-plane-store.ts` | public store method inventory, state key inventory, mutation/read path inventory, persistence and snapshot behavior inventory |
| `consequence-admission/index.ts` | public export inventory, admission outcome contract inventory, constants/types/contracts split map, no public surface drift test |
| `shadow-routes.ts` | route registry inventory, method/path/status/header inventory, `Cache-Control: no-store` inventory, redaction and `decisionSupportOnly` inventory |

## Risk Profiles

Different files fail in different ways. Verification must follow the risk, not
one generic checklist.

| Surface | Main refactor risks | Extra checks |
|---|---|---|
| `control-plane-store.ts` | state shape drift, key-name drift, tenant scope mixup, snapshot/restore drift, mutation ordering changes, default initialization drift | targeted store/state tests, snapshot roundtrip tests when touched, tenant/account/session tests when touched |
| `consequence-admission/index.ts` | public export drift, `admit`/`narrow`/`review`/`block` semantic drift, fail-closed default drift, type import drift, barrel over/under-export | package surface probe, public export inventory lock, admission golden scenarios, fail-closed regression tests |
| `shadow-routes.ts` | missing `no-store` header, raw evidence/payload/impact leakage, `decisionSupportOnly` drift, route status/shape drift, tenant scoping drift | route contract tests, header tests, redaction tests, `decisionSupportOnly` tests, tenant-boundary tests |

## Guardrails

- Keep existing public import paths and route registration functions stable.
- Prefer move-only PRs. If behavior must change, stop and open a separate PR.
- No runtime behavior change is intended. Any behavior change discovered during
  this tracker must be treated as a regression unless explicitly promoted into
  a separate behavior-change PR.
- Do not split crypto/protocol adapters in this wave.
- Do not split `account-routes.ts` in this wave; it needs its own route matrix.
- Do not weaken fail-closed, redaction, idempotency, tenant isolation, or audit
  behavior.
- Keep each PR small enough to review and revert.
- Update the closest inventory, budget, and lock test in the same PR as the
  move.
- Use a read-only Opus/second-opinion audit at each major surface boundary:
  after `control-plane-store.ts` closeout, after `consequence-admission/index.ts`
  closeout, and after `shadow-routes.ts` closeout. Model output remains
  `opinion / design hypothesis` until confirmed by repository evidence.

## Rollback Strategy

- One PR per slice.
- Keep compatibility facades until closeout.
- Revert the slice PR if a route/store/package-surface contract drifts.
- If a behavior drift is desirable, stop the refactor and promote it into a
  separate behavior-change PR with its own tests and no-claims.

## Closeout Criteria

V2 is complete only when all of the following are true:

- `src/service/control-plane-store.ts` is at or below 1000 lines, or the remaining
  facade lines are explicitly justified.
- `src/consequence-admission/index.ts` is at or below 1300 lines and public
  surface compatibility is locked by tests.
- `src/service/http/routes/shadow-routes.ts` is at or below 1300 lines and route
  registration compatibility is locked by tests.
- `npm run test:large-file-budget` is green.
- Every moved slice has a targeted local check and green GitHub checks.

## No-Claims

This plan is repository-side maintainability evidence only.

It does not prove production readiness, live customer enforcement, customer PEP
no-bypass, external KMS signing, shared replay safety, compliance readiness, or
enterprise readiness.
