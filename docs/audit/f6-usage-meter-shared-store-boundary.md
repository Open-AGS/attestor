# F6 Usage Meter Shared-Store Boundary

Status: repository-side claim boundary for F6-T4.

This does not claim that the file-backed usage meter is multi-node safe. It
records the current split:

- `src/service/usage-meter.ts` is a local/single-node file ledger.
- API-facing usage state goes through `src/service/control-plane-store.ts`.
- When `ATTESTOR_CONTROL_PLANE_PG_URL` is configured, `control-plane-store.ts`
  uses the shared PostgreSQL `attestor_control_plane.usage_ledger` table.

## Decision

The file-backed usage meter is local/single-node only. It is acceptable for
local development and single-runtime evaluation. It must not be used as the
basis for a multi-node quota guarantee.

The shared quota posture depends on the control-plane store mode. A
production-shared deployment must configure the shared control-plane PostgreSQL
substrate before claiming shared hosted usage/quota state.

## Repository Evidence

- `usageMeterStorageDescriptor()` reports `multiNodeSafe: false`,
  `profileScope: "local-or-single-node"`, and
  `sharedStoreEnv: "ATTESTOR_CONTROL_PLANE_PG_URL"`.
- `control-plane-store.ts` exposes `getUsageContextState`,
  `canConsumePipelineRunState`, and `consumePipelineRunState`.
- `control-plane-store.ts` increments the PostgreSQL usage ledger with
  `ON CONFLICT (tenant_id, period) DO UPDATE`.
- Deployment docs scope `ATTESTOR_USAGE_LEDGER_PATH` to the file-backed
  single-node fallback when the shared control-plane PostgreSQL URL is absent.

## Tests

Run:

```bash
npm run test:f6-usage-meter-shared-store-boundary
```

The test verifies the descriptor, control-plane PostgreSQL usage path, and docs
claim boundary.

## Remaining Boundary

F6-T4 remains `partial`, not `fixed`, because this PR does not prove an external
production PostgreSQL deployment, migration, backup/restore posture, or live
quota behavior. It only prevents the file ledger from being mistaken for a
shared multi-node quota substrate.
