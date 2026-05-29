# Large File Budget

This is the Phase 0 guard for the large-file reduction track.

It does not refactor code. It prevents new oversized files from appearing
without an explicit registry entry and keeps the current oversized files from
growing while they wait for focused split work.

## Budget

| Range | Rule |
|---|---|
| `<= 800` lines | Normal target for source, tests, scripts, and examples. |
| `801-1200` lines | Tolerated when a file is still one coherent concept. Review before adding more. |
| `> 1200` lines | Hard-limit exception. Must be listed in the large-file registry. |

Generated files, lockfiles, OpenAPI JSON, and large fixture JSON are outside
this code-file guard. They should not drive source refactor decisions.

## Current Guard

Run:

```bash
npm run test:large-file-budget
```

The guard scans tracked files under:

```text
src/
tests/
scripts/
examples/
```

It checks TypeScript and JavaScript source-like files only.

The check fails when:

- a file grows above `1200` lines without a registry entry;
- a registered oversized file grows beyond its locked `maxLines`;
- a registered oversized file no longer exists and the registry was not cleaned;
- the registry contains duplicates.

The check reports files above `800` lines, but Phase 0 does not fail all of
them. The first job is to stop growth. Later phases shrink the existing list.

## Why This Shape

- ESLint's `max-lines` rule exists to aid maintainability and reduce
  complexity. Its default is `300`, which is useful as a pressure signal but
  too strict for Attestor's current trust-sensitive adapter and route surfaces.
- GitHub and Google engineering guidance both favor small, focused changes
  because they are easier to review, merge, test, and roll back.
- TypeScript module resolution means file moves must preserve runtime import
  resolution, not merely pass a text search.
- Hono route grouping supports registering route families from smaller route
  modules while keeping the main app's route contract stable.

References:

- <https://eslint.org/docs/latest/rules/max-lines>
- <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes>
- <https://google.github.io/eng-practices/review/developer/small-cls.html>
- <https://www.typescriptlang.org/docs/handbook/modules/theory.html>
- <https://hono.dev/api/routing>

## Split Policy

Default target:

```text
Most files: <= 800 lines
Hard exceptions: <= 1200 lines when genuinely cohesive
Current oversized files: no growth while queued
```

Do not split files just because they are large. Split when one of these is
true:

- the file has multiple ownership domains;
- route handlers for unrelated workflows live together;
- store/repository implementations are mixed;
- public barrels contain implementation logic;
- tests cover several behavior families that can be run independently;
- a script has separate collection, assertion, and rendering phases.

Do not split protocol adapters casually. Crypto and enforcement adapters may
temporarily exceed `800` lines when the file remains one canonical protocol
surface and the split would make review or security reasoning worse.

## Planned Reduction Order

Current execution contract: [Final Large File Refactor Plan](final-large-file-refactor-plan.md).

Completed:

- `src/service/api-types.ts` is now a compatibility barrel over the
  responsibility-named `src/service/api-types/*` modules.
- `src/financial/cli.ts` is now a small operator entrypoint over
  responsibility-named `src/financial/cli/*` command modules.
- `scripts/probe/probe-consequence-admission-package-surface.mjs` is now a
  small package-surface probe entrypoint over
  `scripts/probe/consequence-admission-package-surface/*` assertion modules.
- `src/service/control-plane-store.ts` inventory is now documented in
  `docs/02-architecture/control-plane-store-inventory.md`; the next PR may
  split store families behind the existing compatibility facade.
- `src/service/control-plane-store.ts` now imports the PostgreSQL schema SQL
  from `src/service/control-plane-store/schema.ts`, keeping the existing facade
  path while removing the inline schema block.
- `src/service/control-plane-store.ts` now imports PostgreSQL pool, schema, and
  transaction helpers from `src/service/control-plane-store/pg.ts`, keeping the
  existing facade path while isolating shared PG lifecycle state.
- `src/service/control-plane-store.ts` now imports side-effect-free normalizers,
  row mappers, and helper functions from `src/service/control-plane-store/mappers.ts`.
- `src/service/control-plane-store.ts` now re-exports pipeline idempotency state
  from `src/service/control-plane-store/pipeline-idempotency-state.ts`, keeping
  the existing facade while isolating the pipeline replay/advisory-lock family.
- `src/service/control-plane-store.ts` now imports and re-exports admin audit
  and admin idempotency state from `src/service/control-plane-store/admin-audit-state.ts`
  and `src/service/control-plane-store/admin-idempotency-state.ts`, keeping
  the existing facade while isolating the admin replay/audit families.
- `src/service/control-plane-store.ts` now re-exports async dead-letter state
  from `src/service/control-plane-store/async-dead-letter-state.ts`, keeping
  the existing facade while isolating the DLQ PostgreSQL/file fallback and
  snapshot family.
- `src/service/control-plane-store.ts` now re-exports hosted email delivery
  state from `src/service/control-plane-store/email-delivery-state.ts`, keeping
  the existing facade while isolating email provider/dispatch event persistence
  and snapshot behavior.
- `src/service/control-plane-store.ts` now re-exports Stripe webhook state from
  `src/service/control-plane-store/stripe-webhook-state.ts`, keeping the
  existing facade while isolating webhook dedupe, claim/finalize/release, claim
  lease cleanup, and snapshot behavior.
- `src/service/control-plane-store.ts` now re-exports tenant key state from
  `src/service/control-plane-store/tenant-key-state.ts`, keeping the existing
  facade while isolating API-key issuance, rotation, recovery, tenant plan sync,
  and snapshot behavior.
- `src/service/control-plane-store.ts` now re-exports usage ledger state from
  `src/service/control-plane-store/usage-state.ts`, keeping the existing facade
  while isolating quota read/consume/query and snapshot behavior.
- `src/service/control-plane-store.ts` now re-exports account auth state from
  `src/service/control-plane-store/account-auth-state.ts`, keeping the existing
  facade while isolating account users, sessions, action tokens, hosted SAML
  replay, and their backup/restore snapshot behavior.
- `src/service/control-plane-store.ts` now re-exports hosted account and billing
  state from `src/service/control-plane-store/hosted-billing-state.ts`, keeping
  the existing facade while isolating hosted account provisioning, billing
  entitlement projection, Stripe billing event state, and hosted account/billing
  snapshot behavior.
- `src/service/control-plane-store.ts` now re-exports control-plane backup,
  restore, and shared-store test reset behavior from
  `src/service/control-plane-store/snapshots.ts`, closing the control-plane
  store split with the facade reduced to behavior-free exports.
- `src/consequence-admission/index.ts` now has a V2-09 public-surface inventory
  lock in `docs/02-architecture/consequence-admission-public-surface.md`,
  covering the current index-owned contract/constants/types, generic admission
  normalization/orchestration, correction/retry catalogue, descriptor builders,
  and compatibility delegation before code movement begins.
- `src/consequence-admission/index.ts` now imports and selectively re-exports
  constants, literal vocabularies, core admission request/response types, and
  generic admission request/envelope types from
  `src/consequence-admission/contracts.ts`, keeping `index.ts` as the package
  compatibility facade.
- `src/consequence-admission/index.ts` now imports and re-exports correction
  catalogue, safe-feedback, retry-guidance, and retry-budget behavior from
  `src/consequence-admission/correction-catalog.ts`, and imports/re-exports
  `consequenceAdmissionDescriptor()` from `src/consequence-admission/descriptor.ts`.
- `src/consequence-admission/index.ts` is now a small compatibility facade over
  `src/consequence-admission/engine.ts`, with normalization helpers, generic
  input normalization, request/response builders, and generic guard
  orchestration split into responsibility-named internal modules.
- `src/service/http/routes/shadow-routes.ts` now delegates the shadow
  summary, recommendations, action-risk inventory, audit-evidence,
  business-risk dashboard, and dashboard-summary read routes to
  `src/service/http/routes/shadow-summary-dashboard-routes.ts`, preserving
  `registerShadowRoutes` as the public route registration facade.
- `src/service/http/routes/shadow-routes.ts` now delegates shadow simulation
  create/list/load routes to
  `src/service/http/routes/shadow-simulation-history-routes.ts` and shares
  mutation idempotency, rate-limit, and audit helpers through
  `src/service/http/routes/shadow-mutation-route-helpers.ts`.
- `src/service/http/routes/shadow-routes.ts` now delegates policy candidate,
  Policy Foundry readiness/active-question/red-team, promotion draft/packet/
  simulation, bundle publication, and candidate status routes to
  `src/service/http/routes/shadow-policy-foundry-promotion-routes.ts`.
- `src/service/http/routes/shadow-routes.ts` is now a small route registration
  facade. Downstream verification/integration and activation-readiness routes
  live in `src/service/http/routes/shadow-downstream-activation-routes.ts`;
  customer activation handoff/receipt routes live in
  `src/service/http/routes/shadow-customer-activation-routes.ts`.
- `src/service/http/routes/account-routes.ts` is now a small route registration
  facade. Public account/session routes, federated/MFA/passkey routes,
  account-admin mutation routes, and account visibility/email/billing routes
  live in responsibility-named route-family modules.
- `src/service/http/routes/release-policy-control-routes.ts` is now a small
  route registration facade. Read/simulation/discovery routes and mutation/
  activation/rollback routes live in responsibility-named route-family modules.
- `src/service/http/routes/admin-routes.ts` is now a small route registration
  facade. Read, account mutation, tenant-key, queue, and release-enforcement
  admin routes live in responsibility-named route-family modules.
- `src/service/application/stripe-webhook-billing-processor.ts` now imports and
  re-exports billing processor contracts from
  `src/service/application/stripe-webhook-billing-processor-types.ts`, context
  helpers from `src/service/application/stripe-webhook-billing-processor-context.ts`,
  Stripe helper functions from
  `src/service/application/stripe-webhook-billing-processor-helpers.ts`, and
  unsupported-event handling from
  `src/service/application/stripe-webhook-billing-unsupported-event.ts`.
- `src/service/billing/billing-event-ledger.ts` now imports and re-exports
  billing event, line-item, charge, list-filter, input, and snapshot contracts
  from `src/service/billing/billing-event-ledger-types.ts`, keeping the ledger
  API stable while isolating the type surface.

Next:

1. Continue the final wave from
   [Final Large File Refactor Plan](final-large-file-refactor-plan.md), starting
   with `F-11` shadow persistence store family extraction.
2. Touch crypto/protocol adapters only where module-specific risk warrants it.

## No-Claims

This guard is repository-side maintainability evidence only.

It does not prove production readiness, live customer enforcement, customer PEP
no-bypass, external KMS signing, shared replay safety, or enterprise readiness.
