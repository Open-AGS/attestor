# Middleware Policy Freeze Boundary Validation - 2026-06-01

## Validation Frame

Source of truth: `origin/master` at
`c23bcdaa1e97989dc3f9cc9106104b8898d647cc`.

Scope:

- generic HTTP release-enforcement middleware method defaults
- explicit mutation-only middleware opt-out behavior
- release policy discovery static mode versus frozen activation precedence
- runtime resolver behavior when a frozen policy scope matches

Protected principles:

- fail-closed boundary
- customer authority
- proof integrity
- replay and idempotency safety
- auditability
- no overclaim

Primary anchors:

- OWASP authorization guidance: deny by default and validate permissions on
  every request.
- RFC 9110 HTTP semantics: `GET` retrieves a representation and `HEAD` is the
  same request shape without response content.
- Google SRE production guidance: fail sanely when inputs or state are
  implausible.

## Recent Fixes Chain-Effect Check

The immediately preceding boundary slice closed release-review terminal
transition ordering, evidence-pack ID immutability, and Envoy target binding
defaults. This pass does not reopen those closures.

The report claim that release-review identity and terminal mutation remained
open is stale against current repository evidence. Reviewer/requester authority
and stale final approval side effects are already covered by OPS-197 and
OPS-201.

## Findings

### OPS-204 - Generic middleware skipped consequence-bearing GET routes by default

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `src/release-enforcement-plane/middleware.ts` protected only `POST`, `PUT`,
  `PATCH`, and `DELETE` by default.
- `tests/release-enforcement-plane-middleware.test.ts` proved a `GET`
  route under the middleware returned `skipped` and reached the handler without
  release authorization.

Fix:

- The default protected method set now includes `GET` and `HEAD`.
- Consequence-bearing read/export routes fail closed by default when release
  authorization is missing.
- Mutation-only route groups can still opt out explicitly by setting
  `protectedMethods`.

Locking evidence:

- `tests/release-enforcement-plane-middleware.test.ts`

Boundary:

This closes the default repository middleware bypass for GET/HEAD paths. It
does not prove live customer PEP no-bypass, route-map coverage in a deployed
customer service, upstream gateway trust, or production readiness.

### OPS-205 - Static policy discovery could bypass emergency freeze precedence

State: closed repo-side / live-proof-only.

Current repository evidence before this fix:

- `src/release-policy-control-plane/discovery.ts` returned the static metadata
  bundle before checking frozen activations.
- `src/release-policy-control-plane/resolver.ts` already mapped a frozen
  resolution to `policy-scope-frozen`, but static resolution could avoid that
  status before this fix.

Fix:

- Frozen activation precedence is now checked before the static discovery
  branch.
- Static discovery still resolves the metadata bundle when no matching frozen
  activation exists.
- Matching frozen activations now fail closed in both discovery and runtime
  resolver paths.

Locking evidence:

- `tests/release-policy-control-plane-discovery.test.ts`
- `tests/release-policy-control-plane-resolver.test.ts`

Boundary:

This closes the repository static-discovery freeze-precedence gap. It does not
prove live policy-control shared-store behavior, deployed emergency procedures,
operator response, or production readiness.

## Positive Observations

- Non-static frozen-scope resolution already failed closed before this pass.
- Policy bundle publication and signed-bundle verification remain unchanged.
- Token lifecycle and decision-log findings called out in the intake are already
  mitigated in current repository tests.
- Static discovery behavior remains available for explicit non-frozen
  deployments.

## Verdict

Repo-side remediation is complete for OPS-204 and OPS-205.

Remaining proof is live/operator proof only:

- live customer PEP no-bypass
- live route-map coverage for customer middleware deployments
- live upstream gateway/workload binding proof
- live policy-control shared-store and emergency procedure proof
- production readiness
- enterprise readiness
