# Service Organization Plan

This is the refactor contract and closeout map for reorganizing `src/service/`.

It started as the B-service-00 plan before runtime-near files moved. At
B-service-06, the planned move-only slices have landed and this document now
locks the final service map for future changes.

At B-service-00, `src/service/` has 96 root-level files plus the existing
`application/`, `bootstrap/`, `http/`, and `runtime/` directories. The flat
root is navigable today through the repository navigator, but it is too wide
for long-term maintenance.

At B-service-06 closeout, `src/service/` has 39 root-level cross-cutting files
plus responsibility-named directories for account, billing, async, pipeline,
release, hosted, Policy Foundry, and shadow support.

## Research Anchors

- GitHub recommends small, focused pull requests because they are easier and
  faster to review, reduce bug risk, and create clearer history:
  https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes
- TypeScript module resolution must model the runtime host. Path moves must
  prove that emitted import specifiers still resolve at runtime:
  https://www.typescriptlang.org/docs/handbook/modules/theory.html
- Hono warns that route grouping order mistakes are hard to notice. Route
  splitting is therefore not part of the first move-only service reorg:
  https://hono.dev/docs/api/routing#grouping-ordering
- Kubernetes review guidance treats moved content differently from semantic
  edits. This supports move-only PRs that avoid unrelated cleanup:
  https://kubernetes.io/docs/contribute/review/reviewing-prs/

These are engineering anchors only. They are not certifications and do not
prove Attestor production readiness.

## Protected Principles

- auditability
- fail-closed boundary
- tenant isolation
- customer authority
- replay and idempotency safety
- operational boundedness
- no overclaim

The service reorg may make ownership clearer. It must not grant authority,
weaken checks, change route behavior, or imply live readiness.

## Authority Boundary

This plan can organize files and require tests.

It cannot:

- prove customer PEP no-bypass
- prove production deployment readiness
- prove live shared-store behavior
- change `admit` / `narrow` / `review` / `block` semantics
- activate enforcement
- replace route, store, or policy tests

Repository-side path hygiene remains repository-side evidence only.

## Final Service Map

The root of `src/service/` is for cross-cutting runtime support only. New
domain-specific files should go to the closest responsibility directory unless
a short architecture note explains why they must remain root-level.

| Path | Ownership at B-service-06 closeout |
|---|---|
| `src/service/` | Cross-cutting runtime support, core stores, observability, tenant isolation, rate limiting, site support, generic protected admission, and other files that intentionally span multiple service families. |
| `src/service/account/` | Hosted account, sessions, MFA, SSO, SAML, passkeys, password policy, user/token stores, and account route support. |
| `src/service/application/` | Route-facing application services and use-case ports. |
| `src/service/async/` | Async pipeline, worker, tenant execution, weighted dispatch, dead-letter handling, and email delivery event support. |
| `src/service/billing/` | Billing entitlements, event ledger, export/reconciliation, feature catalog/service, and Stripe support under `billing/stripe/`. |
| `src/service/bootstrap/` | Runtime assembly, route dependency wiring, storage profile wiring, and bootstrap contracts. |
| `src/service/hosted/` | Hosted product-flow contracts, hosted generic admission proof bridges, hosted LLM/tool boundary, runtime health, observability/privacy, release provenance, and hosted abuse/reconciliation guards. |
| `src/service/http/` | HTTP helpers and Hono route handlers under `http/routes/`. |
| `src/service/pipeline/` | Pipeline idempotency store and pipeline route support. |
| `src/service/policy-foundry/` | Policy Foundry billing entitlement enforcement, hosted UI flow, and hosted wizard state. |
| `src/service/release/` | Release route support, release authority/request-path stores, degraded-mode grant store, decision log, evidence pack, policy authority, reviewer queue, review site, and token introspection. |
| `src/service/runtime/` | Runtime-local support contracts. |
| `src/service/shadow/` | Shadow persistence store. |

The map is enforced by `npm run test:service-organization-map`. If this test
fails because a new root-level service file is intentional, update the map and
the test in the same PR.

## Rules

1. Move one service family per PR.
2. Keep each PR move-only unless a test proves a necessary import adjustment.
3. Do not split route files in this phase.
4. Do not split `control-plane-store.ts` in this phase.
5. Do not split `api-types.ts` in this phase.
6. Do not change package exports in this phase.
7. Update every direct path reference in docs, tests, scripts, and source.
8. Run the closest route/store/application tests for the moved family.
9. Merge only after GitHub checks are green.
10. Verify `origin/master` after every merge.

## Import Strategy

Use the smallest strategy that preserves runtime behavior.

### Direct mechanical move

Use this when all importers are internal repository callers and TypeScript
checks can prove the moved path graph.

Required evidence:

- `rg` for old paths returns no stale references, except intentional historical
  audit references if explicitly documented.
- `npm run typecheck` passes.
- `npm run typecheck:hygiene` passes.
- The closest targeted tests pass.

### Compatibility shim

Use this when a moved file is imported by public examples, scripts, docs that
act as copy-paste integration material, or another package-boundary-like
surface.

The old path may keep a re-export shim for one deprecation cycle. The shim must
state that it is compatibility-only and must not add behavior.

Default rule: prefer direct mechanical moves for private service internals;
prefer a shim when path stability is customer-facing or package-adjacent.

## Planned Slices

| Step | Slice | Move target | Why this order | Minimum local gates |
|---|---|---|---|---|
| B-service-00 | Plan/contract | no source move | Make the contract reviewable before runtime-near files move. | `npm run test:service-organization-plan-docs`; `npm run test:repository-navigator-docs`; `git diff --check` |
| B-service-01 | Account support | `src/service/account/` | Good validating slice: many files, strong route tests, bounded domain. | account route/auth/user tests; `npm run typecheck`; `npm run typecheck:hygiene` |
| B-service-02 | Billing and Stripe support | `src/service/billing/` and `src/service/billing/stripe/` | Webhook and billing support are cohesive and already well tested. | Stripe webhook/billing tests; package-script-runner if scripts change; typecheck gates |
| B-service-03 | Release support | `src/service/release/` | Medium risk, but backed by release route and policy-control tests. | release-review tests; release-policy-control tests; typecheck gates |
| B-service-04 | Async and pipeline support | `src/service/pipeline/` and `src/service/async/` | Higher risk because replay, idempotency, and queue behavior are involved. Do it after three move slices establish the workflow. | pipeline idempotency tests; async route tests; typecheck gates |
| B-service-05 | Hosted, Policy Foundry, and shadow support | `src/service/hosted/`, `src/service/policy-foundry/`, `src/service/shadow/` | Cross-cutting hosted/shadow material comes after narrower slices. | shadow route tests; hosted onboarding tests; Policy Foundry tests; typecheck gates |
| B-service-06 | Closeout lock | docs/tests only unless drift is found | Lock the final service map and run broader verification. | navigator/service-plan docs tests; package-script-runner; typecheck; hygiene; build; `npm run verify` |

If customer feedback changes the order after launch, update this document before
moving the next slice.

## Not Now

These are explicitly outside the B-service move phase:

- splitting `src/service/http/routes/shadow-routes.ts`
- splitting `src/service/http/routes/account-routes.ts`
- splitting `src/service/http/routes/release-policy-control-routes.ts`
- splitting `src/service/http/routes/admin-routes.ts`
- splitting `src/service/control-plane-store.ts`
- splitting `src/service/api-types.ts`
- moving `src/consequence-admission/golden-*-*.ts`
- changing the public package exports map

Each of those needs its own plan, tests, and risk review.

## Slice Exit Criteria

Each move PR must end with:

- changed files listed in the PR body
- old path search result
- new directory ownership stated
- targeted tests named and passing
- typecheck gates passing for source moves
- no-claims stated explicitly
- GitHub checks green before merge
- merge commit verified on `origin/master`

## Final Closeout

B-service-06 is complete only when:

- the repository navigator points to the current service map
- this document reflects the final moved shape
- `npm run test:service-organization-map` locks the final service directory map
- no stale path references remain outside intentional historical audit entries
- the relevant route and package-script path tests pass
- `npm run typecheck` passes
- `npm run typecheck:hygiene` passes
- `npm run build` passes
- `npm run verify` runs to completion

If `npm run verify` times out or fails, B-service-06 is not complete.

## No-Claims

This plan does not make Attestor production-ready.

It does not prove live customer enforcement, customer PEP no-bypass, live KMS signing,
live replay-store safety, live route authorization, or enterprise readiness.

It is a repository-organization contract for future move-only PRs.
