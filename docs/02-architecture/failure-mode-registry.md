# Failure Mode Registry

This document describes the machine-readable Attestor failure mode registry.

It is not a certification, not an independent audit, not a production-readiness claim, and not proof that every customer workflow is covered. The registry is a conservative engineering contract: known AI-action failure modes are named, sourced, tied to protected principles, and assigned required controls before later binding and replay work.

## Contract

- Registry file: `src/consequence-admission/failure-mode-registry.ts`
- Version: `attestor.consequence-failure-mode-registry.v1`
- Placement version: `attestor.consequence-failure-mode-registry-placement.v1`
- Test command: `npm run test:failure-mode-registry`
- Runtime stance: no auto-enforce, no production-ready claim, no raw payload storage

Each entry contains:

- failure mode id and name
- research or repo-backed source references
- severity
- protected principle
- required control names
- conservative default decision: `narrow`, `review`, or `block`
- repository evidence references
- explicit limitation

The registry intentionally has no `admit` default. A failure mode can only narrow, require review, or block until later controls prove a safer outcome.

## Placement

The failure-mode registry, control binding contract, and replay fixture matrix
belong to the shared control layer. The machine-readable placement descriptor is
exported from `src/consequence-admission/failure-mode-registry.ts` through
`attestor/consequence-admission`.

Placement source files:

- `src/consequence-admission/failure-mode-registry.ts`
- `src/consequence-admission/failure-mode-control-bindings.ts`
- `src/consequence-admission/failure-mode-replay-fixtures.ts`

Ownership:

- Primary role: PDP / shared decision control.
- Supporting roles: audit proof and replay.
- Consumers: PEP, PIP, PAP, packs, and hosted service composition.
- Packs and hosted routes consume this contract; they do not own or fork it.

Packs may add domain templates, evidence defaults, adapters, and replay examples.
Hosted routes may compose the shared contracts. Neither should create a separate
failure-mode registry, binding vocabulary, replay matrix, or decision vocabulary.

## Source Anchors

The first registry version uses only sources already accepted in the AI-action failure research track:

- NIST AI 600-1 Generative AI Profile
- OWASP Top 10 for LLM Applications 2025
- OWASP Top 10 for Agentic Applications 2026
- NCSC prompt-injection guidance
- Microsoft indirect prompt-injection guidance
- OpenAI agent builder safety guidance
- AgentDojo
- TheAgentCompany
- EchoLeak

These sources are engineering anchors. They do not certify Attestor or replace customer-specific control testing.

## Initial Coverage

The registry currently includes 20 failure modes, including:

- `direct-prompt-injection`
- `indirect-prompt-injection`
- `untrusted-content-authorizes-action`
- `tool-result-poisoning`
- `sensitive-data-disclosure`
- `cross-tenant-leakage`
- `wrong-recipient-disclosure`
- `fake-approval-laundering`
- `stale-authority-or-policy`
- `no-go-hold-bypass`
- `scope-explosion`
- `duplicate-execution-replay`
- `review-required-auto-promote`
- `human-review-fatigue`
- `model-tool-config-drift`
- `agentic-supply-chain-compromise`

## How It Is Used Now

This step creates the canonical vocabulary and required-control inventory. It does not yet make the engine enforce every entry.

Current use:

- normalize AI/agent failure terminology across code, tests, and docs
- prevent undocumented failure modes from becoming vague product claims
- give the next Control Binding Contract step stable ids
- give the Replay Fixture Matrix step stable scenario targets
- keep limitations explicit when repository evidence is partial

## Current Limitations

- The registry is not a coverage audit by itself.
- Repository evidence means the repo has a related control or test; it does not prove full customer deployment coverage.
- Some controls are present as contracts or tests, while others remain future binding/replay work.
- Customer-specific workflows still need shadow evidence, authority evidence, replay results, and deployment checks before enforcement claims.

