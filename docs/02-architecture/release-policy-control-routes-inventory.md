# Release Policy Control Routes Inventory

This inventory locks the hosted release-policy control route surface before the
large-file split. It is repository-side maintainability evidence only.

It does not prove live customer enforcement, production readiness, external KMS
signing, shared replay safety, compliance readiness, or enterprise readiness.

## Guarded Boundaries

- Every route uses `authorizeReleaseAdminRoute`.
- Read routes use `RELEASE_ADMIN_READ_ROLES`.
- Normal mutation routes use `RELEASE_ADMIN_MUTATION_ROLES`.
- Emergency routes use `RELEASE_ADMIN_BREAK_GLASS_ROLES`.
- Mutations enter through `adminMutationRequest` when configured.
- Mutation responses finalize through `finalizeAdminMutation` when configured.
- JSON read and mutation responses call `noStore(c)` unless the route has a
  dedicated conditional bundle cache path.
- Bundle detail reads preserve conditional `If-None-Match` / ETag behavior.

## Route Inventory

| Method | Path | Family | Authority |
|---|---|---|---|
| `GET` | `/api/v1/admin/release-policy/control-plane` | control-plane summary | read roles |
| `GET` | `/api/v1/admin/release-policy/packs` | pack read | read roles |
| `POST` | `/api/v1/admin/release-policy/packs` | pack mutation | mutation roles + admin mutation bridge |
| `GET` | `/api/v1/admin/release-policy/packs/:packId` | pack read | read roles |
| `GET` | `/api/v1/admin/release-policy/packs/:packId/bundles` | bundle history read | read roles |
| `GET` | `/api/v1/admin/release-policy/packs/:packId/versions` | bundle history read | read roles |
| `POST` | `/api/v1/admin/release-policy/bundles` | bundle publication | mutation roles + admin mutation bridge |
| `GET` | `/api/v1/admin/release-policy/packs/:packId/bundles/:bundleId` | bundle detail read | read roles + conditional cache headers |
| `GET` | `/api/v1/admin/release-policy/activation-approvals` | approval read | read roles |
| `POST` | `/api/v1/admin/release-policy/activation-approvals` | approval request | mutation roles + admin mutation bridge |
| `GET` | `/api/v1/admin/release-policy/activation-approvals/:id` | approval read | read roles |
| `POST` | `/api/v1/admin/release-policy/activation-approvals/:id/approve` | approval decision | mutation roles + admin mutation bridge |
| `POST` | `/api/v1/admin/release-policy/activation-approvals/:id/reject` | approval decision | mutation roles + admin mutation bridge |
| `GET` | `/api/v1/admin/release-policy/activations` | activation read | read roles |
| `POST` | `/api/v1/admin/release-policy/activations` | activation mutation | mutation roles + approval gate + admin mutation bridge |
| `GET` | `/api/v1/admin/release-policy/activations/:id` | activation read | read roles |
| `POST` | `/api/v1/admin/release-policy/activations/:id/rollback` | activation rollback | mutation roles + admin mutation bridge |
| `POST` | `/api/v1/admin/release-policy/emergency/freeze` | emergency break-glass | break-glass roles + break-glass authorization + admin mutation bridge |
| `POST` | `/api/v1/admin/release-policy/emergency/rollback` | emergency break-glass | break-glass roles + break-glass authorization + admin mutation bridge |
| `POST` | `/api/v1/admin/release-policy/resolve` | resolver preview | mutation roles |
| `POST` | `/api/v1/admin/release-policy/simulations` | simulation preview | mutation roles |
| `GET` | `/api/v1/admin/release-policy/audit` | audit read | read roles |
| `GET` | `/api/v1/admin/release-policy/audit/verify` | audit verification read | read roles |

## Split Map

| Planned module | Route families |
|---|---|
| `release-policy-control-read-routes.ts` | control-plane summary, pack reads, bundle history/detail, audit reads |
| `release-policy-control-pack-routes.ts` | pack upsert and bundle publication mutations |
| `release-policy-control-activation-routes.ts` | activation approval and activation lifecycle routes |
| `release-policy-control-emergency-routes.ts` | emergency freeze and emergency rollback |
| `release-policy-control-simulation-routes.ts` | resolver and simulation preview routes |
| `release-policy-control-route-context.ts` | shared parsing, pagination, mutation, cache, actor, and response helpers that remain route-owned |

## Tests

The route split must keep these checks green or replace them with narrower
equivalent checks in the same PR:

- `npm run test:release-policy-control-routes-inventory`
- `npm run test:release-policy-control-plane-admin-routes`
- `npm run test:release-review-admin-routes`
- `npm run test:hosted-api-authorization-matrix`
- `npm run test:large-file-budget`
- `npm run typecheck`
- `npm run typecheck:hygiene`
