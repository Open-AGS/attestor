# Purpose

Use this page as the shortest internal orientation note.

For the public product framing, use the [README](../../README.md).
For the category framing, use [AI Action Control Plane positioning](action-authorization-positioning.md).
For the naming and claim boundary, use [Attestor language contract](../02-architecture/attestor-language-contract.md).
For the customer-facing operating model, use [Operating model](operating-model.md).
For the architecture map, use [System overview](../02-architecture/system-overview.md).
For the consequence domain vocabulary, use [Consequence taxonomy](../02-architecture/consequence-taxonomy.md).
For the pack placement and non-claim boundary, use [Domain pack boundary](../02-architecture/domain-pack-boundary.md).
For the customer-side allow/hold binding, use [Downstream enforcement contract](../02-architecture/downstream-enforcement-contract.md).
For the customer-side verify/assert helper, use [Verifier helper](../02-architecture/verifier-helper.md).
For bounded policy limits, use [Policy limit model](../02-architecture/policy-limit-model.md).
For the first-screen dashboard API summary, use [Dashboard API summary](../02-architecture/dashboard-api-summary.md).
For the external review packet and reviewer handoff boundary, use [External review packet](../02-architecture/external-review-packet.md).
For final target/body/replay/freshness binding at the customer edge, use [Downstream presentation binding](../02-architecture/downstream-presentation-binding.md).
For single-use replay consumption at that edge, use [Presentation replay ledger](../02-architecture/presentation-replay-ledger.md).
For redacted post-consequence result receipts, use [Downstream execution receipt](../02-architecture/downstream-execution-receipt.md).
For digest-chain reviewer history, use [Tamper-evident history](../02-architecture/tamper-evident-history.md).
For commercial packaging, use [Commercial packaging, pricing, and evaluation](product-packaging.md).

## Current Repository Truth

Attestor is one product:

**an AI Action Control Plane with a shared consequence-admission core before important AI actions become real system changes.**

The repository currently contains a shared platform core with curated package surfaces:

- `attestor/release-layer`
- `attestor/release-layer/finance`
- `attestor/release-policy-control-plane`
- `attestor/release-enforcement-plane`
- `attestor/crypto-authorization-core`
- `attestor/crypto-execution-admission`
- `attestor/crypto-intelligence`
- `attestor/consequence-admission`

These are repository and commercial/self-hosted import boundaries, not a public npm publication claim. `package.json` remains `private: true`; public npm distribution would require a separate release decision.

The finance pack remains the deepest proven wedge today. It carries the strongest end-to-end path for AI-assisted financial reporting acceptance, governed SQL, deterministic checks, release decisions, signed proof, reviewer authority, verification kits, and downstream consequence gating.

The crypto pack extends the same platform core into programmable-money authorization, execution admission, and intelligence. Its first public integration shape is packaged authorization/admission/intelligence surfaces for external integrators, not a public hosted crypto HTTP route.

The domain-pack boundary keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core. Packs may add domain defaults, evidence shapes, policy templates, adapter projections, readiness signals, and replay examples; they must not fork the shared decision vocabulary, failure-mode registry, control-binding contract, or replay layer.

The hosted path includes account signup, the first API key, tenant API-key calls, usage and entitlement visibility, Stripe checkout and portal handoff, signed webhook convergence, billing export/reconciliation, and focused readiness gates.

The service/API refactor keeps the HTTP server thin: `api-server.ts` is now a small Hono composition root, with route registration, server lifecycle, runtime wiring, and route dependency construction under `src/service/bootstrap`.

Supporting slices such as healthcare, Snowflake, VSAC, observability, HA/DR, OIDC, SAML, passkeys, and live provider probes show architectural breadth. They are not all as deep as the finance proof wedge.

## What It Is

Attestor is an AI Action Control Plane for high-risk actions, implemented through a shared consequence-admission core and enforcement points.

It is used when a customer-controlled system has a proposed output, record, communication, action, filing-like artifact, data export, authority change, infrastructure change, or programmable-money execution path that should not proceed on informal trust.

The customer system calls Attestor before the downstream system writes, sends, files, executes, signs, broadcasts, settles, or routes the consequence. Attestor evaluates policy, authority, evidence, freshness, scope, replay posture, and enforcement posture, then returns a bounded admission decision and proof material.

The consequence taxonomy names the domains behind that boundary: financial records, money movement, programmable money, data disclosure, authority change, external communication, regulated filing, system operation, decision support, and custom customer surfaces.

The downstream enforcement contract names what a customer enforcement point must bind before it acts: admission id, digest, decision, consequence domain, downstream system, policy scope, proof, idempotency, and any `narrow` constraints.

The verifier helper packages that contract into a small customer-side API for adapters that should stop fail-closed before calling a payment rail, wallet adapter, record writer, message sender, admin plane, or operations system.

The policy limit model keeps an admission from becoming a broad permission. It carries bounded checks such as amount, velocity, recipient, asset, data scope, authority scope, time window, risk ceiling, and human-review threshold.

The downstream presentation binding keeps an admitted consequence from becoming portable permission. It binds the admission to the exact enforcement point, target, body digest, replay key, nonce, freshness window, proof refs, and acknowledged constraints that are about to reach a real system.

The presentation replay ledger consumes that replay key once and exports only redacted ledger evidence. A customer edge should not call the downstream system until presentation binding and replay consumption both close.

The downstream execution receipt records what happened after the customer-owned enforcement point acted or deliberately skipped the action. It binds the result back to the admission and replay receipt without storing raw downstream data.

The tamper-evident history links digest-first evidence over time. It gives reviewer exports a root digest and verification summary that detects modified, deleted, or reordered records without storing raw business payloads.

The canonical customer-facing decision vocabulary is `admit`, `narrow`, `review`, or `block`. Domain-native surfaces may still expose older values, such as the finance hosted route's `pass` allow branch or the crypto package's `needs-evidence` review branch; [Operating model](operating-model.md) owns that mapping.

## What It Is Not

- not the model
- not the agent runtime
- not the downstream system of record
- not a financial chatbot
- not a wallet or custody platform
- not a bundler, paymaster, bridge, facilitator, solver, or relayer
- not an LLM orchestration framework
- not a prompt wrapper
- not a BI front-end
- not a generic AI compliance checklist
- not a magical router that guesses the correct pack automatically

Attestor makes the handoff from AI proposal to real consequence governable. It does not make AI or programmable execution inherently trustworthy.

## Who This Is For

- teams introducing AI into high-consequence internal workflows
- reviewers and control functions who need evidence-bearing release decisions
- builders who need portable proof, not just a model answer
- organizations that want AI assistance without surrendering authority, auditability, or verification
- finance, crypto, healthcare, insurance, security, operations, and internal AI platform teams that need an admission boundary before real systems change
