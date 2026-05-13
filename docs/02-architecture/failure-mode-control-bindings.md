# Failure Mode Control Bindings

This document describes the Attestor control binding contract for known AI-action failure modes.

It does not activate enforcement, does not certify production readiness, and does not prove customer workflow coverage. It binds the failure mode registry to explicit invariants, required controls, required evidence, required authority, audit records, and replay expectations.

## Contract

- Contract file: `src/consequence-admission/failure-mode-control-bindings.ts`
- Version: `attestor.consequence-failure-control-binding.v1`
- Source registry: `attestor.consequence-failure-mode-registry.v1`
- Test command: `npm run test:failure-mode-control-bindings`
- Runtime stance: no auto-enforce, no production-ready claim, no raw payload storage

Each binding includes:

- `failureModeId`
- invariant ids
- control ids carried from the registry
- default and violation decision
- enforcement phases
- required evidence
- required authority
- required audit records
- replay requirement
- explicit limitation

## Core Invariants

The first binding contract uses these invariants:

- `untrusted-content-cannot-authorize-action`
- `trusted-evidence-required`
- `verified-approval-provenance-required`
- `scope-cannot-exceed-approved-boundary`
- `tenant-and-recipient-boundaries-must-hold`
- `review-or-block-cannot-auto-promote`
- `no-go-hold-overrides-natural-language`
- `replay-and-idempotency-required-before-execution`
- `decision-context-version-must-be-bound`
- `downstream-side-effects-must-be-declared`
- `least-privilege-tooling-and-supply-chain-review`
- `human-review-packet-must-highlight-risk`
- `sensitive-data-minimization-required`

The invariant set follows the researched direction from NIST AI risk management, OWASP LLM and Agentic guidance, Microsoft indirect prompt-injection mitigation patterns, NCSC prompt-injection guidance, OpenAI agent safety guidance, and agent benchmark/incident research. These are engineering anchors, not certification claims.

## Enforcement Phases

Bindings can point to one or more phases:

- `admission`
- `customer-gate`
- `downstream-enforcement`
- `policy-foundry`
- `review-surface`
- `audit-proof`
- `runtime-readiness`

This keeps the system from pretending that one API decision alone protects the full business-action chain. A failure mode can require admission controls, customer-side gate behavior, downstream proof, review packet design, audit proof, or runtime readiness evidence.

## Current Use

This step gives later implementation work stable targets:

- Control Binding Contract maps every registry failure mode to invariants.
- Replay Fixture Matrix can use `failureModeId` and invariant ids as scenario targets.
- Future enforcement can check whether a workflow has evidence for the required controls before promotion.
- Policy Foundry can explain which missing controls block safe rollout.

## Current Limitations

- This contract does not execute controls by itself.
- Some required controls already have code/tests; others are still future replay or enforcement work.
- Customer integrations still need downstream enforcement points, shared replay/idempotency where relevant, and source-specific evidence validators.
- The contract is intentionally conservative: review, narrow, or block remain the only failure-mode default decisions.
