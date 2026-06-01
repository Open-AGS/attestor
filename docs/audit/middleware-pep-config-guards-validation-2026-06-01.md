# Middleware PEP Config Guards Validation - 2026-06-01

## Validation Frame

Source of truth: `origin/master` at
`784a35b5fb3ae853eb8d1975d2ed10789064bd3f`.

Scope:

- generic HTTP release-enforcement middleware method opt-outs
- generic HTTP `trusted-upstream` binding mode
- adjacent Envoy, webhook, and record-write boundaries for chain-effect
  regression only

Protected principles:

- fail-closed boundary
- proof integrity
- customer authority
- replay and idempotency safety
- auditability
- no overclaim

Primary anchors:

- OWASP API Security 2023 API8: security-sensitive configuration must be
  reviewed and hardened instead of left as accidental deployment drift.
- RFC 9421 HTTP Message Signatures: covered components and signature metadata
  are the stronger path for request binding when a boundary accepts upstream
  assertions.
- Envoy external authorization filter documentation: the proxy authorization
  point can inspect request attributes before upstream admission.

## Recent Fixes Chain-Effect Check

Recent repo-side fixes already closed the default middleware GET/HEAD skip
behavior, default caller-supplied binding-header trust, Envoy client target
header trust, webhook raw break-glass reuse, customer middleware example gates,
and downstream execution-proof receipt-only gaps.

This pass did not reopen those closures. The remaining issue was narrower:
operators could still deliberately configure a risky middleware mode without a
reviewed proof reference.

## Findings

### OPS-217 - Generic middleware method opt-out lacked proof

State: closed repo-side / live-proof-only.

Current evidence before this fix:

- `DEFAULT_PROTECTED_HTTP_METHODS` already included `GET` and `HEAD`.
- `protectedMethods` was still configurable.
- A custom mutation-only list caused a GET route under the middleware to return
  `skipped` and reach the handler.

Fix:

- Custom `protectedMethods` configurations that exclude any default-covered
  method now require `methodCoverageProof`.
- The proof must include a non-empty `proofRef` and `readOnlyRoutesOnly: true`.
- Without that proof, middleware option validation fails before the route can
  run.

Locking evidence:

- `tests/release-enforcement-plane-middleware.test.ts`

Boundary:

This is a repository-side configuration guard. It does not prove a live
customer route map, live customer PEP no-bypass, production readiness, or that
the proof reference was reviewed in a deployed customer environment.

### OPS-218 - `trusted-upstream` mode lacked upstream proof

State: closed repo-side / live-proof-only.

Current evidence before this fix:

- Default middleware rejected caller-supplied binding headers.
- `bindingHeaderMode: 'trusted-upstream'` explicitly allowed pre-bound
  target/output/consequence/body digest headers.
- That mode did not require a proof reference for upstream no-bypass,
  header-stripping, or body-derived digest calculation.

Fix:

- `trusted-upstream` mode now requires `trustedUpstreamProof`.
- The proof must include a non-empty `proofRef`, `nonBypassableUpstream: true`,
  `stripsClientAttestorHeaders: true`, and
  `derivesBodyDigestFromRequest: true`.
- Missing proof fails middleware option validation before request evaluation.

Locking evidence:

- `tests/release-enforcement-plane-middleware.test.ts`

Boundary:

This is a configuration guard for the generic middleware. Live upstream gateway
signature/body-digest proof, live workload extraction, shared replay and
introspection proof, and customer PEP no-bypass remain live-proof-only.

## Positive Observations

- Default GET/HEAD protection remains repo-proven.
- Default caller binding headers remain rejected.
- High-risk bearer-only generic middleware paths remain fail-closed under the
  required sender-constraint verifier profile.
- Envoy, webhook receiver, and record-write adapter evidence stayed aligned:
  Envoy ignores client target headers by default, webhook body tamper/replay is
  rejected, and record-write derives hashes from the exact mutation.

## Verdict

Repo-side remediation is complete for the two configuration guard findings in
this scope.

Remaining proof is live/operator proof only:

- live customer PEP no-bypass
- live route-map coverage for customer middleware deployments
- live upstream gateway header-stripping and body-digest proof
- live shared replay/introspection proof
- production readiness
- enterprise readiness
