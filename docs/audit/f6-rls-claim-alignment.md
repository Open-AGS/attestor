# F6 RLS Claim Alignment

Status: repository-side claim alignment for F6-T2.

This does not wire PostgreSQL Row-Level Security into Attestor's main
control-plane stores. It removes the overclaim that the existing helper already
protects those stores.

## Decision

`src/service/tenant-rls.ts` is a sample/probe RLS substrate until a concrete
store executes through `withTenantTransaction` and the tables created by
`TENANT_SCHEMA_SQL`.

The helper can still be useful for rehearsal, experiments, and future store
integration. It is not evidence that `src/service/control-plane-store.ts` or the
hosted account/billing/usage data paths are database-enforced by RLS today.

## Repository Evidence

- `tenant-rls.ts` now states that it owns sample/probe tables only until a real
  store is wired to it.
- `runtime/rls-runtime.ts` states that auto-activation covers the RLS
  sample/probe tables, not the main control-plane stores.
- `docs/08-deployment/deployment.md` no longer lists PostgreSQL RLS as deployed
  tenant isolation for main data paths.
- `docs/audit/f6-tenant-blast-radius-validation.md` keeps F6-T2 as an accepted
  limitation rather than a fixed runtime isolation control.

## Tests

Run:

```bash
npm run test:f6-rls-claim-alignment
```

The test verifies:

- the RLS helper uses transaction-local `set_config('app.tenant_id', ...)`;
- the helper declares sample/probe boundaries;
- the runtime activation file does not overclaim main store protection;
- deployment docs describe `ATTESTOR_PG_URL` as connector/probe substrate, not
  automatic main control-plane RLS;
- the F6 tracker records F6-T2 as an accepted limitation.

## Remaining Boundary

To mark F6-T2 as fixed, a future PR must either wire concrete stores through
`withTenantTransaction` with tests over real PostgreSQL RLS policies, or replace
this helper with the selected production storage isolation design. This PR only
aligns repository claims with current behavior.
