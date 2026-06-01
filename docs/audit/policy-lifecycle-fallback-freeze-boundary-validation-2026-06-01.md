# Policy Lifecycle Fallback And Freeze Boundary Validation - 2026-06-01

## Validation Frame

Source of truth before this fix: `origin/master` at
`2765bfca6e192ecf41f7bbfd02a901a9f4bc513c`.

Scope:

- release-policy activation, rollback, emergency freeze, and emergency rollback
  route lifecycle helper behavior
- fallback policy-control stores that do not implement
  `applyActivationLifecycle(...)`
- emergency freeze requests without an explicit `packId` / `bundleId`
- policy lifecycle metadata and mutation-audit provenance

Protected principles:

- fail-closed boundary
- customer authority
- proof integrity
- replay and idempotency safety
- auditability
- no overclaim

## Recent Fixes Chain-Effect Check

The prior policy-lifecycle slice closed the shared PostgreSQL lifecycle
transaction path for activation, rollback, emergency freeze, and emergency
rollback. This pass does not reopen that path. It adds a route-level guard for
request paths that require atomic lifecycle storage and tightens the
no-explicit-bundle emergency freeze provenance path.

The static-discovery frozen-scope precedence fix remains unchanged: matching
frozen activations still resolve as `policy-scope-frozen`.

## Findings

### OPS-220 - Atomic lifecycle requirement did not fail closed before fallback mutation

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `applyPolicyLifecycleMutation(...)` used `store.applyActivationLifecycle(...)`
  when available.
- If the store did not expose that method, the helper fell back to snapshot,
  applied activation write, historical write, metadata write, and audit append
  as separate operations.
- Production-shared bootstrap and request guards already prevented ordinary
  production-shared traffic from using non-shared authority stores, but the
  lifecycle helper itself did not have a route-level atomic-required guard.

Fix:

- `ReleasePolicyControlRouteDeps` now carries
  `requireAtomicPolicyLifecycle`.
- Production-shared route runtime sets the flag.
- Activation, rollback, emergency freeze, and emergency rollback route calls
  pass the flag into `applyPolicyLifecycleMutation(...)`.
- When the flag is set and the store lacks `applyActivationLifecycle(...)`, the
  route fails closed with HTTP 503 and no lifecycle/audit mutation.

Locking evidence:

- `tests/release-policy-control-plane-admin-routes.test.ts`

Boundary:

This closes the repository-side fallback mutation guard for request paths that
require atomic lifecycle storage. It does not prove live shared-store
deployment, customer-operated PostgreSQL behavior, emergency procedure
rehearsal, role-key deployment, customer PEP no-bypass, production readiness,
or enterprise readiness.

### OPS-221 - Emergency freeze without explicit bundle could carry a stale bundle reference

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- The emergency freeze route selected the current active bundle before calling
  `applyPolicyLifecycleMutation(...)` when the request did not provide
  `packId` and `bundleId`.
- The freeze action then received that preselected bundle, even though
  `freezePolicyActivationScope(...)` already knows how to derive the bundle
  from the lifecycle snapshot's current active activation.
- Runtime fail-closed behavior was preserved by the frozen activation state,
  but incident review could see a freeze activation whose bundle reference did
  not match the activation superseded inside the lifecycle snapshot.

Fix:

- No-explicit-bundle emergency freeze now checks only that an exact active
  activation exists before entering the lifecycle mutation.
- The freeze action omits `bundle` unless the caller supplied an explicit
  `packId` / `bundleId`.
- Metadata publication for implicit freeze uses the applied frozen activation's
  bundle reference, not the route preflight bundle.

Locking evidence:

- `tests/release-policy-control-plane-admin-routes.test.ts`

Boundary:

This closes the repository-side provenance mismatch for no-explicit-bundle
emergency freeze. It does not prove concurrent behavior in a deployed shared
database, operator incident response, live policy-control deployment, customer
PEP no-bypass, production readiness, or enterprise readiness.

## Positive Observations

- Shared-store lifecycle atomicity from OPS-206 remains intact.
- Static frozen activation precedence from OPS-205 remains intact.
- Emergency freeze remains break-glass role gated.
- R4 activation still requires approval before route mutation.

## Verification

Commands run locally:

- `npm run test:release-policy-control-plane-admin-routes`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `npm run test:audit-finding-evidence`
- `npm run test:security-evidence-system`
- `npm run test:audit-finding-test-coverage`
- `npm run test:baseline-alignment-contract`
- `npm run check:baseline-alignment`
- `npm run test:release-policy-authority-store`
- `npm run test:production-shared-preflight-bootstrap`
- `npm run test:production-shared-request-path-cutover`
- `npm run test:production-shared-request-guard`
- `npm run test:release-policy-control-routes-inventory`
- `npm run test:release-policy-control-plane-store-mapper-split`
- `git diff --check`

The first attempt at the package script timed out at 124 seconds and was not a
pass. The command was rerun with a longer local timeout and passed:

```text
Release policy control-plane admin-route tests: 16 passed, 0 failed
```

Full `npm run verify` was not run. This was a targeted Tier 3
route/runtime-hardening pass rather than a full release-readiness gate.

## Verdict

Repo-side remediation is complete for OPS-220 and OPS-221.

Remaining proof is live/operator proof only:

- live shared policy-control store deployment
- live emergency procedure rehearsal
- live role-key deployment
- live customer PEP no-bypass
- production readiness
- enterprise readiness
