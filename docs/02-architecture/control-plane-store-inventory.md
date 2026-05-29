# Control Plane Store Inventory

Status: facade closeout complete. This document names the current
responsibilities behind `src/service/control-plane-store.ts`, which now remains
as a compatibility export facade over smaller store-family modules.

The public service import path remains `src/service/control-plane-store.ts`.
The shared PostgreSQL lifecycle now lives in `control-plane-store/pg.ts`; the
schema DDL lives in `control-plane-store/schema.ts`; side-effect-free mapping
helpers live in `control-plane-store/mappers.ts`; pipeline idempotency state now
lives in `control-plane-store/pipeline-idempotency-state.ts`; admin audit and
admin idempotency state now live in `control-plane-store/admin-audit-state.ts`
and `control-plane-store/admin-idempotency-state.ts`; async dead-letter state
now lives in `control-plane-store/async-dead-letter-state.ts`; hosted email
delivery state now lives in `control-plane-store/email-delivery-state.ts`;
Stripe webhook state now lives in `control-plane-store/stripe-webhook-state.ts`;
tenant key state now lives in `control-plane-store/tenant-key-state.ts`; usage
state now lives in `control-plane-store/usage-state.ts`; account users,
sessions, action tokens, and hosted SAML replay now live in
`control-plane-store/account-auth-state.ts`; hosted account lifecycle, billing
entitlements, and Stripe billing event state now live in
`control-plane-store/hosted-billing-state.ts`; snapshot export/restore and the
shared store test reset now live in `control-plane-store/snapshots.ts`.

## Current Shape

| Slice | Current lines | Responsibility | Split target |
|---|---:|---|---|
| Compatibility facade | `control-plane-store.ts` | Historical public service import path over smaller store-family modules. | Complete; keep behavior-free re-exports only. |
| Snapshot export/restore and test reset | `snapshots.ts` | Backup/restore adapters across store families plus shared PostgreSQL test reset. | Complete for this slice; future snapshot helpers should stay out of the facade. |
| PostgreSQL connection and schema bootstrap | `pg.ts` plus `schema.ts` | `ATTESTOR_CONTROL_PLANE_PG_URL`, pool, transaction lifecycle, schema creation, indexes, shared tables. | Complete for this slice; future store-family modules should import from `control-plane-store/pg.ts`. |
| Normalizers, coercers, row mappers, shared helpers | `mappers.ts` | API-key digests, billing status normalization, row-to-record mappers, advisory locks, usage context projection. | Complete for this slice; future store-family modules should import from `control-plane-store/mappers.ts`. |
| Hosted account and billing state facade | `hosted-billing-state.ts` | Account lifecycle, provisioning, Stripe subscription/checkout/invoice application, billing entitlement projection, file fallback, and backup/restore snapshot behavior. | Complete for this slice; future callers should keep using the facade export. |
| Tenant keys and usage state facade | `tenant-key-state.ts` plus `usage-state.ts` | Tenant API key issuance/rotation/revocation, tenant plan sync, API-key recovery, usage ledger, and backup/restore snapshot behavior. | Complete for this slice; future callers should keep using the facade export. |
| Account users, sessions, tokens, SAML replay | `account-auth-state.ts` | Account users, identities, password/MFA/passkey tokens, sessions, hosted SAML replay, and backup/restore snapshot behavior. | Complete for this slice; future callers should keep using the facade export. |
| Admin audit and admin idempotency | `admin-audit-state.ts` plus `admin-idempotency-state.ts` | Hash-linked admin audit ledger, admin idempotency replay records, PostgreSQL advisory transactions, file fallback. | Complete for this slice; snapshot export/restore now lives in `snapshots.ts`. |
| Pipeline idempotency | `pipeline-idempotency-state.ts` | Pipeline request idempotency lookup/record, PostgreSQL advisory transaction, file fallback. | Complete for this slice; future callers should keep using the facade export. |
| Stripe webhook processing | `stripe-webhook-state.ts` | Processed Stripe webhook lookup, claim/finalize/release, in-memory claim leases, file fallback, and backup/restore snapshot behavior. | Complete for this slice; future callers should keep using the facade export. |
| Async dead-letter state | `async-dead-letter-state.ts` | Async DLQ shared PostgreSQL persistence, file fallback, list/upsert/remove facade functions, and backup/restore snapshot behavior. | Complete for this slice; future callers should keep using the facade export. |
| Hosted email delivery | `email-delivery-state.ts` | Hosted email provider/dispatch event state, replay-safe provider event insert, delivery list facade, and backup/restore snapshot behavior. | Complete for this slice; future callers should keep using the facade export. |

## Split Order

1. Extract shared PostgreSQL/schema helpers first, without changing exported
   state function names. Schema SQL and PG helper extraction are complete.
2. Extract row mappers and normalization helpers that have no side effects.
   This is complete in `control-plane-store/mappers.ts`.
3. Extract low-coupling families: async dead-letter and hosted email delivery.
   Pipeline idempotency is complete in `control-plane-store/pipeline-idempotency-state.ts`;
   admin audit/idempotency is complete in `control-plane-store/admin-audit-state.ts`
   and `control-plane-store/admin-idempotency-state.ts`; async dead-letter state
   is complete in `control-plane-store/async-dead-letter-state.ts`; hosted email
   delivery state is complete in `control-plane-store/email-delivery-state.ts`;
   Stripe webhook state is complete in `control-plane-store/stripe-webhook-state.ts`.
4. Extract medium-coupling families: tenant keys and usage. This is complete in
   `control-plane-store/tenant-key-state.ts` and `control-plane-store/usage-state.ts`.
5. Extract account-heavy families last: hosted accounts, billing entitlements,
   account users, sessions, action tokens, SAML replay. Account users,
   sessions, action tokens, and hosted SAML replay are complete in
   `control-plane-store/account-auth-state.ts`; hosted account lifecycle,
   billing entitlements, and Stripe billing event state are complete in
   `control-plane-store/hosted-billing-state.ts`.
6. Keep `src/service/control-plane-store.ts` as a compatibility facade. The
   closeout PR proves the facade through TypeScript, route/store tests, backup
   tests, package-script runner, and the large-file budget guard.

## Guardrails

- No behavior change in the store-family split PR.
- No schema change unless it is isolated in a separate migration PR.
- No caller path churn until the facade is proven.
- No production, multi-region, RLS, or live HA claim from this refactor.
- Do not weaken file-backed fallback behavior.
- Do not expose API keys, tenant secrets, Stripe payloads, webhook bodies, or
  provider error bodies in logs, docs, snapshots, or PR text.

## Verification

Store-family split and closeout PRs must run the smallest checks that prove the
changed surface. The control-plane closeout target uses at least:

- `npm run typecheck`
- `npm run typecheck:hygiene`
- `npm run test:large-file-budget`
- `npm run test:control-plane-store-inventory-docs`
- `npm run test:package-script-runner`
- closest store tests such as `test:control-plane-backup-pg`,
  `test:service-route-boundary`, and the touched account/billing/store tests

Tier 4 `npm run verify` remains reserved for release prep, broad runtime
rewiring, production/live/ops readiness changes, or explicit investigation of a
full verify failure.

## No-Claims

This inventory is repo-side planning evidence only. It does not prove live
PostgreSQL deployment, RLS isolation, multi-region behavior, external backup
restore, production readiness, or enterprise readiness.
