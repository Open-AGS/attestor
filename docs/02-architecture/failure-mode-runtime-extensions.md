# Failure Mode Runtime Extensions

Version: `attestor.consequence-failure-mode-runtime-extension.v1`

Source file: `src/consequence-admission/failure-mode-runtime-extensions.ts`

Test command: `npm run test:failure-mode-runtime-extensions`

## Purpose

Runtime extensions let a tenant, workspace, domain pack, or customer
environment describe a scoped failure mode that is not part of Attestor's
canonical registry yet.

This is an overlay contract. It does not mutate the canonical registry, fork
the decision vocabulary, or activate enforcement. The canonical registry
remains shared, versioned, and digest-bound.

## Research Anchors

- NIST SP 800-162 ABAC separation of policy decision, policy enforcement,
  policy information, and policy administration responsibilities
- Open Policy Agent decision/enforcement separation and external policy/data
  management patterns
- AWS Verified Permissions schema and policy-store patterns for structured,
  validated authorization models

These anchors support the shape of the extension mechanism. They do not certify
Attestor or prove customer workflow coverage.

## Required Evidence

Each runtime extension must include:

- extension id that does not collide with the canonical registry
- scope kind and scope digest
- owner authority digest
- approval digest
- source record digest
- classifications, severity, and protected principles
- required controls
- invariant ids
- enforcement phases
- required evidence, authority, and audit records
- replay binding

The evaluation stores digest-only observations for extension ids, names,
summaries, controls, authority, evidence, and audit records. It does not store
raw customer workflow names, prompts, payloads, secrets, tenant ids, or source
system details.

## Decision Rules

The evaluator returns:

- `pass` when the scoped extension is authority-bound, approval-bound,
  source-recorded, replay-bound, and has controls, invariants, evidence,
  authority, and audit records.
- `review` when no extension is supplied or non-critical source/classification
  metadata is incomplete.
- `block` when the extension collides with the canonical registry, lacks scope,
  owner authority, approval, controls, invariants, required evidence,
  required authority, required audit records, replay binding, or has expired.

## Non-Claims

Runtime extensions are not production enforcement. They do not prove live
customer workflow coverage, third-party source truth, downstream verifier
integration, or external audit approval. They provide a safe way to express
customer-specific failure modes without weakening the shared Attestor registry.
