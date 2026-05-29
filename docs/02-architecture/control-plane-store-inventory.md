# Control Plane Store Inventory

Status: first split started. This document names the current responsibilities
inside `src/service/control-plane-store.ts` as the compatibility facade shrinks
behind smaller store modules.

The current file is intentionally still the public service import path. The next
split must preserve `src/service/control-plane-store.ts` as a compatibility
facade until all callers and tests are proven against smaller modules. The
shared PostgreSQL lifecycle now lives in `control-plane-store/pg.ts`; the schema
DDL lives in `control-plane-store/schema.ts`; side-effect-free mapping helpers
live in `control-plane-store/mappers.ts`.

## Current Shape

| Slice | Current lines | Responsibility | Split target |
|---|---:|---|---|
| Boundary comment and imports | 1-258 | Shared control-plane boundary and file-store imports. | Keep imports local to each family after split. |
| Snapshot interfaces and Stripe claim lease types | 259-357 | Backup/restore snapshot contracts and in-memory webhook lease state. | `control-plane-store/contracts.ts` and `stripe-webhook-state.ts`. |
| PostgreSQL connection and schema bootstrap | `pg.ts` plus `schema.ts` | `ATTESTOR_CONTROL_PLANE_PG_URL`, pool, transaction lifecycle, schema creation, indexes, shared tables. | Complete for this slice; future store-family modules should import from `control-plane-store/pg.ts`. |
| Normalizers, coercers, row mappers, shared helpers | `mappers.ts` | API-key digests, billing status normalization, row-to-record mappers, advisory locks, usage context projection. | Complete for this slice; future store-family modules should import from `control-plane-store/mappers.ts`. |
| PostgreSQL repository helpers | 358-993 | Pg helpers for hosted accounts, billing entitlements, tenant keys, usage, account auth, SAML replay. | Keep near the store family that owns each table. |
| Hosted account and billing state facade | 994-1504 | Account lifecycle, Stripe subscription/checkout/invoice application, file fallback. | `hosted-account-state.ts`, `billing-entitlement-state.ts`. |
| Tenant keys and usage state facade | 1505-1773 | Tenant API key issuance/rotation/revocation, tenant plan sync, usage ledger. | `tenant-key-state.ts`, `usage-state.ts`. |
| Account users, sessions, tokens, SAML replay | 1774-2284 | Account users, identities, password/MFA/passkey tokens, sessions, SAML replay. | `account-user-state.ts`, `account-session-state.ts`, `account-token-state.ts`. |
| Admin audit and admin idempotency | 2285-2505 | Hash-linked admin audit ledger, admin idempotency replay records. | `admin-audit-state.ts`, `admin-idempotency-state.ts`. |
| Pipeline idempotency | 2506-2650 | Pipeline request idempotency lookup/record, PostgreSQL advisory transaction. | `pipeline-idempotency-state.ts`. |
| Stripe webhook processing | 2651-2933 | Processed Stripe webhook lookup, claim/finalize/release, file fallback. | `stripe-webhook-state.ts`. |
| Async dead-letter and hosted email delivery | 2934-3230 | Async DLQ persistence and hosted email provider/dispatch event state. | `async-dead-letter-state.ts`, `email-delivery-state.ts`. |
| Snapshot export/restore and test reset | 3231-3784 | Backup/restore adapters across all store families and test reset. | `snapshots.ts`, then per-family snapshot helpers. |

## Split Order

1. Extract shared PostgreSQL/schema helpers first, without changing exported
   state function names. Schema SQL and PG helper extraction are complete.
2. Extract row mappers and normalization helpers that have no side effects.
   This is complete in `control-plane-store/mappers.ts`.
3. Extract low-coupling families: async dead-letter, hosted email delivery,
   pipeline idempotency, admin audit/idempotency.
4. Extract medium-coupling families: Stripe webhook, tenant keys, usage.
5. Extract account-heavy families last: hosted accounts, billing entitlements,
   account users, sessions, action tokens, SAML replay.
6. Keep `src/service/control-plane-store.ts` as a compatibility facade until the
   final closeout PR proves every caller through TypeScript, route tests, backup
   tests, and package-script runner.

## Guardrails

- No behavior change in the store-family split PR.
- No schema change unless it is isolated in a separate migration PR.
- No caller path churn until the facade is proven.
- No production, multi-region, RLS, or live HA claim from this refactor.
- Do not weaken file-backed fallback behavior.
- Do not expose API keys, tenant secrets, Stripe payloads, webhook bodies, or
  provider error bodies in logs, docs, snapshots, or PR text.

## Verification Before Split

The first behavior-preserving split PR must run at least:

- `npm run typecheck`
- `npm run typecheck:hygiene`
- `npm run test:large-file-budget`
- `npm run test:control-plane-store-inventory-docs`
- `npm run test:package-script-runner` if `package.json` changes
- closest store tests: `test:service-pipeline-routes-idempotency`,
  `test:control-plane-backup-pg`, `test:f6-usage-meter-shared-store-boundary`,
  `test:f8-operational-resilience-validation`

Tier 4 `npm run verify` is reserved for the closeout or any broad runtime
rewiring; a single narrow family split should use targeted Tier 2/3 checks.

## No-Claims

This inventory is repo-side planning evidence only. It does not prove live
PostgreSQL deployment, RLS isolation, multi-region behavior, external backup
restore, production readiness, or enterprise readiness.
