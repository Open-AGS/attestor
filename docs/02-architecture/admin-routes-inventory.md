# Admin Routes Inventory

This inventory locks the hosted admin route surface before the large-file split.
It is repository-side maintainability evidence only.

It does not prove live customer enforcement, production readiness, external KMS
signing, shared replay safety, compliance readiness, or enterprise readiness.

## Guarded Boundaries

- Admin routes use `authorizeAdminRoute` with role-specific admin role sets.
- Metrics-only `/api/v1/metrics` uses `currentMetricsAuthorized`, not the admin
  mutation/read helper.
- Mutating admin routes enter through `beginAdminMutation`.
- `beginAdminMutation` binds the route id, request payload, admin actor, and
  optional `Idempotency-Key`.
- Mutating admin routes finalize through the admin mutation service.
- Tenant-key, account, billing, queue, and release-degraded-mode route families
  keep their current authority scopes during the split.

## Route Inventory

| Method | Path | Family | Authority |
|---|---|---|---|
| `GET` | `/api/v1/admin/tenant-keys` | tenant-key read | key read roles |
| `GET` | `/api/v1/admin/accounts` | account read | account read roles |
| `GET` | `/api/v1/admin/accounts/:id/billing/export` | billing export read | billing read roles |
| `GET` | `/api/v1/admin/accounts/:id/features` | account feature read | account read roles |
| `GET` | `/api/v1/admin/accounts/:id/billing/reconciliation` | billing reconciliation read | billing read roles |
| `GET` | `/api/v1/admin/plans` | plan read | admin read roles |
| `GET` | `/api/v1/admin/audit` | audit read | audit read roles |
| `GET` | `/api/v1/admin/billing/events` | billing event read | billing read roles |
| `GET` | `/api/v1/admin/billing/entitlements` | billing entitlement read | billing read roles |
| `GET` | `/api/v1/admin/metrics` | ops metrics read | ops read roles |
| `GET` | `/api/v1/metrics` | Prometheus metrics read | metrics authorization helper |
| `GET` | `/api/v1/admin/telemetry` | telemetry read | ops read roles |
| `GET` | `/api/v1/admin/email/deliveries` | email delivery read | ops read roles |
| `GET` | `/api/v1/admin/queue` | queue read | ops read roles |
| `GET` | `/api/v1/admin/queue/dlq` | dead-letter queue read | ops read roles |
| `POST` | `/api/v1/admin/queue/jobs/:id/retry` | dead-letter queue mutation | ops roles + admin mutation bridge |
| `POST` | `/api/v1/admin/accounts` | account mutation | account roles + admin mutation bridge |
| `POST` | `/api/v1/admin/accounts/:id/billing/stripe` | billing mutation | billing roles + admin mutation bridge |
| `POST` | `/api/v1/admin/accounts/:id/suspend` | account mutation | account roles + admin mutation bridge |
| `POST` | `/api/v1/admin/accounts/:id/reactivate` | account mutation | account roles + admin mutation bridge |
| `POST` | `/api/v1/admin/accounts/:id/archive` | account mutation | account roles + admin mutation bridge |
| `POST` | `/api/v1/admin/tenant-keys` | tenant-key mutation | key roles + admin mutation bridge |
| `POST` | `/api/v1/admin/tenant-keys/:id/rotate` | tenant-key mutation | key roles + admin mutation bridge |
| `POST` | `/api/v1/admin/tenant-keys/:id/deactivate` | tenant-key mutation | key roles + admin mutation bridge |
| `POST` | `/api/v1/admin/tenant-keys/:id/reactivate` | tenant-key mutation | key roles + admin mutation bridge |
| `POST` | `/api/v1/admin/tenant-keys/:id/recover` | tenant-key mutation | key roles + admin mutation bridge |
| `POST` | `/api/v1/admin/tenant-keys/:id/revoke` | tenant-key mutation | key roles + admin mutation bridge |
| `POST` | `/api/v1/admin/release-tokens/:id/revoke` | release token mutation | release roles + admin mutation bridge |
| `GET` | `/api/v1/admin/release-enforcement/degraded-mode/grants` | degraded-mode grant read | release read roles |
| `POST` | `/api/v1/admin/release-enforcement/degraded-mode/grants` | degraded-mode grant mutation | release roles + admin mutation bridge |
| `POST` | `/api/v1/admin/release-enforcement/degraded-mode/grants/:id/revoke` | degraded-mode grant mutation | release roles + admin mutation bridge |
| `GET` | `/api/v1/admin/usage` | usage read | billing read roles |

## Split Map

| Planned module | Route families |
|---|---|
| `admin-route-context.ts` | shared deps type, mutation bridge, response helpers that remain route-owned |
| `admin-read-routes.ts` | tenant-key/account/billing/ops read routes and metrics route |
| `admin-account-mutation-routes.ts` | account create, suspend, reactivate, archive, Stripe billing attach |
| `admin-tenant-key-routes.ts` | tenant-key issue, rotate, deactivate, reactivate, recover, revoke |
| `admin-queue-routes.ts` | queue, DLQ, and failed-job retry routes |
| `admin-release-enforcement-routes.ts` | release token revoke and degraded-mode grant routes |

## Tests

The route split must keep these checks green or replace them with narrower
equivalent checks in the same PR:

- `npm run test:admin-routes-inventory`
- `npm run test:service-admin-routes-http`
- `npm run test:admin-route-helper-split`
- `npm run test:hosted-api-authorization-matrix`
- `npm run test:release-enforcement-plane-degraded-mode`
- `npm run test:large-file-budget`
- `npm run typecheck`
- `npm run typecheck:hygiene`
