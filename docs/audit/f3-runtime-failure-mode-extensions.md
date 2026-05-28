# F3-R7 Runtime Failure Mode Extensions

Status: implemented as repository-side extension contract evidence.

This audit hardening step addresses the F3 gap where the failure-mode registry
was shared and machine-readable, but customer-specific failure modes could only
be represented by changing the canonical registry.

## Research Anchors

- NIST SP 800-162 ABAC policy administration and decision/enforcement
  separation
- Open Policy Agent policy/data management and decision/enforcement separation
- AWS Verified Permissions schema and policy-store patterns

These sources are engineering anchors only. They do not certify Attestor, and
they do not prove production customer workflow coverage.

## Repository Evidence

- Code: `src/consequence-admission/failure-mode-runtime-extensions.ts`
- Test: `tests/failure-mode-runtime-extensions.test.ts`
- Docs: `docs/02-architecture/failure-mode-runtime-extensions.md`
- Registry placement: `src/consequence-admission/failure-mode-registry.ts`
- Package surface: `scripts/probe/probe-consequence-admission-package-surface.mjs`

## Control

The runtime extension contract evaluates scoped extension overlays for:

- canonical registry id collision
- tenant/workspace/domain-pack/customer-environment scope digest
- owner authority digest
- approval digest
- source record digest
- classifications and protected principles
- required controls and invariants
- enforcement phases
- required evidence, authority, and audit records
- replay binding
- expiry

## Status Change

Before:

- customer-specific failure modes required changing the canonical registry or
  staying outside the machine-readable control vocabulary

After:

- customer-specific failure modes can be represented as scoped overlays
- overlays are digest-bound to the canonical registry version and digest
- unsafe or incomplete overlays return `review` or `block`
- raw extension names and summaries are not stored in the canonical evaluation

## Limitations

Not proven:

- live customer workflow coverage
- downstream verifier integration
- production enforcement activation
- tenant policy administration process
- external audit or certification

Runtime extensions do not mutate Attestor's canonical registry and do not
activate enforcement by themselves.
