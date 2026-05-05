# Tenant Isolation Boundary

Attestor treats tenant isolation as an object-level authorization boundary, not only as request authentication.

Every tenant-scoped shadow, policy, simulation, and customer-activation route resolves the authenticated tenant first, then verifies that records returned by route dependencies still belong to that tenant before the API serializes them. If a store, adapter, or test double returns a record from another tenant, the route fails closed with a tenant-boundary error.

## What Is Checked

The hosted shadow routes now apply explicit tenant-bound record checks to:

- shadow admission events used by summary, recommendation, dashboard, audit, simulation, and promotion surfaces; explicit foreign tenant ids are blocked, while legacy/evaluation events with no embedded tenant id rely on the already tenant-scoped event dependency
- persisted shadow simulation records returned by creation, listing, and lookup routes
- policy candidate records returned by materialization, listing, promotion, publication, downstream-binding, activation, handoff, and status-transition routes
- customer activation receipt records returned by creation, listing, and lookup routes

These checks are intentionally route-side as well as store-side. Store filters are necessary, but route guards catch integration mistakes where a dependency returns a record that does not match the tenant in the current request context.

## Failure Posture

Tenant-boundary violations are treated as server-side trust-boundary failures:

- the API returns a problem response instead of the foreign record
- the response does not include the foreign tenant id
- the route remains `no-store`
- raw payload material is not added to proof or logs by this guard

This keeps the failure aligned with Attestor's core posture: do not let a mismatched authority context silently become evidence, policy, activation, or audit output.

## Boundary

This is evaluation-route hardening. It does not claim complete production tenancy by itself.

Production deployments still need the selected storage model to enforce tenant partitioning at the data layer, for example through shared authority/control-plane storage, database row-level security, per-tenant keys, or other customer-approved isolation controls. The route guard is a defense-in-depth layer that prevents tenant-confused objects from leaving the API when application dependencies are miswired.
