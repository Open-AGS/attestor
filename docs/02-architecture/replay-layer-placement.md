# Replay Layer Placement

This document records where replay work belongs in the Attestor AI Action Control Plane.

It is not a production-readiness claim, not an independent audit, and not proof that every customer workflow has replay protection. It does not execute customer infrastructure. The replay layer placement contract organizes replay surfaces so synthetic replay, local replay, sandbox replay, and execution-boundary replay do not become interchangeable claims.

## Contract

- Placement file: `src/consequence-admission/replay-layer-placement.ts`
- Version: `attestor.consequence-replay-layer-placement.v1`
- Package surface: `attestor/consequence-admission`
- Test command: `npm run test:replay-layer-placement`
- Runtime stance: no auto-enforce, no production-ready claim, no raw payload storage, no production traffic execution

## Ownership

Replay placement belongs to the shared control layer.

- Primary role: replay
- Supporting roles: PDP, PEP, audit proof
- Consumers: PIP, PAP, packs, hosted service
- Non-owners: packs and hosted service routes

Packs may add domain replay examples and evidence defaults. Hosted routes may compose replay reports and ledgers. Neither should fork replay outcomes, replay safety defaults, or failure-mode replay contracts.

## Replay Surfaces

| Surface | Source | Boundary | Purpose |
| --- | --- | --- | --- |
| `synthetic-failure-mode-replay` | `src/consequence-admission/failure-mode-replay-fixtures.ts` | synthetic review material | Defines adversarial scenario targets for registered AI-action failure modes. |
| `presentation-replay-consumption` | `src/consequence-admission/presentation-replay-ledger.ts` | customer enforcement boundary | Consumes a presentation replay key once before downstream execution. |
| `local-adversarial-replay` | `src/consequence-admission/policy-foundry-adversarial-replay-executor.ts` | local non-mutating harness | Normalizes local synthetic replay observations for review. |
| `sandbox-downstream-replay` | `src/consequence-admission/policy-foundry-live-downstream-replay.ts` | sandbox or staging dry-run | Normalizes non-mutating downstream replay evidence outside production traffic. |

## Invariants

- Replay fixtures define expected negative cases before implementation claims coverage.
- Replay consumption must happen before downstream execution for non-idempotent or irreversible consequences.
- Replay evidence must use digests or references rather than raw payloads, raw replay keys, credentials, or customer bodies.
- Local and sandbox replay reports are review evidence only and cannot activate enforcement by themselves.
- Packs may contribute replay examples, but the replay layer owns the shared replay vocabulary and safety defaults.

## Research Anchors

These are engineering anchors, not certification claims:

- Stripe idempotency guidance: idempotency keys make retries safe by binding repeated requests to the same result.
- OPA decision logs: policy decisions should be recorded as structured evidence for later audit and debugging.
- NIST AI RMF / Generative AI Profile: AI risk controls need map/measure/manage evidence, not only model output.
- OWASP LLM and Agentic AI guidance: tool use, prompt injection, data leakage, and agent autonomy failures need concrete controls before action.

## Current Limitations

- Synthetic fixtures do not execute customer infrastructure.
- The included presentation replay ledger is an in-memory reference implementation and does not include a production shared atomic store.
- Local adversarial replay must not use credentials or mutate downstream systems.
- Sandbox downstream replay is dry-run review evidence only.
- Production rollout still requires customer enforcement wiring, shared replay/idempotency where applicable, approval, deployment smoke tests, and runtime readiness evidence.
