# System Overview

Architecture of Attestor as of May 1, 2026.

This document is the short architectural truth source. The README gives the product view; the trackers and platform-surface docs give the detailed implementation view.

## One Product

Attestor should be understood as one product:

**an AI action authorization layer implemented as an AI consequence gateway for high-consequence systems**

The core pattern is:

```text
AI proposes -> policy, authority, evidence, and enforcement checks -> admitted, narrowed, reviewed, or blocked consequence
```

That same pattern spans AI-output release, programmable-money authorization, data export, authority change, communication, filing, and operational execution. The architecture therefore has one shared action-authorization core and multiple packs, not multiple unrelated products hiding in one repository.

The customer-facing operating model and decision vocabulary live in [Operating model](../01-overview/operating-model.md). Use that page when deciding how domain-native finance or crypto outcomes map to the shared `admit`, `narrow`, `review`, and `block` language.

The consequence domain vocabulary lives in [Consequence taxonomy](consequence-taxonomy.md). Use it when deciding whether a proposed AI action is a financial record, money movement, programmable-money path, data disclosure, authority change, external communication, regulated filing, system operation, decision-support artifact, or custom customer surface.

The customer-side allow/hold contract lives in [Downstream enforcement contract](downstream-enforcement-contract.md). Use it when deciding what a downstream payment adapter, wallet adapter, record writer, message sender, action dispatcher, or HTTP handler must bind before it acts on an Attestor admission.

The practical customer-side helper lives in [Verifier helper](verifier-helper.md). Use it when wiring an adapter that should call `verify` or `assert` before a downstream system acts.

The protected adapter shape lives in [Adapter framework](adapter-framework.md). Use it when an HTTP handler, queue consumer, tool wrapper, MCP tool wrapper, payment adapter, wallet adapter, record writer, or custom customer edge needs a standard verify-before-execute wrapper.

The reviewer-facing evidence package lives in [Audit evidence export](audit-evidence-export.md). Use it when shadow events, simulations, policy candidates, promotion packets, and downstream proof references need to be handed to a reviewer without raw customer payloads or fake compliance claims.

The operator-facing risk summary lives in [Business risk dashboard](business-risk-dashboard.md). Use it when a customer needs to see action volume, review load, blocked actions, policy gaps, consequence-domain risk, downstream proof coverage, and operator-supplied impact without turning raw logs into the product.

The shared redaction boundary lives in [Data minimization and redaction policy](data-minimization-redaction-policy.md). Use it when deciding what model feedback, audit evidence, dashboard metrics, retry records, presentation bindings, replay receipts, or downstream execution receipts may expose without leaking raw customer payloads.

The shared limit vocabulary lives in [Policy limit model](policy-limit-model.md). Use it when a proposed consequence must carry amount caps, velocity windows, recipient or asset allowlists, data scope, authority scope, time bounds, risk ceilings, or review thresholds before admission.

The safe-retry accounting shape lives in [Retry attempt ledger](retry-attempt-ledger.md). Use it when a model-safe correction attempt must be recorded as an idempotent continuation of a held admission rather than a fresh probe.

The execution handoff vocabulary lives in [Downstream presentation binding](downstream-presentation-binding.md). Use it when the enforcement point must bind an allowed admission to the exact target, body digest, replay key, nonce, freshness window, proof references, and acknowledged constraints it is about to present to a real system.

The single-use replay consumption shape lives in [Presentation replay ledger](presentation-replay-ledger.md). Use it when a customer enforcement point must consume the presentation replay key once and keep redacted evidence that the key was not reused.

The post-consequence result shape lives in [Downstream execution receipt](downstream-execution-receipt.md). Use it when the customer edge must record whether the consequence succeeded, failed, or was skipped after replay consumption, without storing raw downstream payloads or error bodies.

## Shared Platform Core

The platform core is made of reusable layers:

| Layer | Role | Status |
|---|---|---|
| Release layer | decides whether a proposed consequence may proceed | evaluation-packaged |
| Policy control plane | stores, signs, scopes, activates, rolls out, simulates, and audits policy | evaluation-packaged |
| Enforcement plane | verifies authorization at downstream boundaries and fails closed without it | evaluation-packaged |
| Crypto authorization core | extends the same decision model into programmable-money authorization objects and simulations | evaluation-packaged |

The public package surfaces already reflect that shared core:

- `attestor/release-layer`
- `attestor/release-layer/finance`
- `attestor/release-policy-control-plane`
- `attestor/release-enforcement-plane`
- `attestor/crypto-authorization-core`
- `attestor/crypto-execution-admission`
- `attestor/consequence-admission`

These are stable import boundaries inside one modular monolith. They are not a claim that every layer is already a separately operated service.

They are also not a public npm availability claim. The repository package remains `private: true`; the `exports` map defines curated import boundaries for local builds, self-hosted evaluation, and commercial/customer-operated packaging unless a separate public npm release decision is made.

## Pack Model

The pack model is:

- the platform core stays common
- domain or execution packs attach to that core
- packs reuse the same policy, proof, and authorization logic
- packs do not become separate products by default

Today the two most important packs are:

- **finance pack**: the strongest proven wedge
- **crypto pack**: the active programmable-money extension

Future packs should start from the same consequence boundary. A pack is not a new product identity; it is a domain-specific way to answer whether a proposed AI-driven consequence may proceed.

The taxonomy comes before the pack. A pack may add native adapters and evidence formats, but the first classification is still the proposed consequence and the controls required before it reaches a downstream system.

The downstream contract comes before execution. A downstream integration should not act on an Attestor response until the admission id, digest, decision, consequence domain, downstream system, policy scope, proof, replay/idempotency binding, and any `narrow` constraints match the customer enforcement point.

The verifier helper packages that rule into a small customer-side API. It does not replace signed release-token verification; it gives the downstream adapter a consistent fail-closed check before it enters the stronger release-enforcement plane or the customer-owned execution layer.

The adapter framework packages the helper into a protected execution shape. It keeps the executor private to the adapter, verifies the Attestor admission before execution, and exports only digests for raw input, result, or error material.

The audit evidence export packages the shadow-to-enforcement trail for human review. It does not approve candidates, activate policies, or claim compliance; it gives reviewers a tenant-scoped, digest-first packet that shows what is proven, what is missing, and what still needs approval.

The business risk dashboard sits on top of that export. It is decision support for operators and buyers, not a new authority surface: it summarizes risk signals, but it does not infer money saved, approve enforcement, or replace the customer authority path.

The data minimization and redaction policy sits across those read surfaces. It keeps model feedback, proof exports, dashboards, retry ledgers, presentation bindings, replay ledgers, and execution receipts on structural control evidence: reason codes, safe instructions, counts, digests, scoped references, statuses, and aggregate signals instead of raw prompts, raw payloads, credentials, bank data, wallet material, private policy thresholds, or downstream error bodies.

The policy limit model sits before both. It prevents broad "yes" decisions by making the admitted consequence bounded: how much, how often, to whom, over what data, under which authority, in what window, and when human review becomes mandatory.

The retry attempt ledger sits beside policy limits in the safe-retry path. It does not authorize a consequence by itself; it records that a retry attempt was bound to the previous admission, evaluated against the retry budget, and protected from duplicate or conflicting idempotency reuse.

The presentation binding sits at the last customer-side edge. It prevents an admitted decision from being copied into a different target, body, replay attempt, or enforcement point.

The replay ledger is the consumption step after presentation binding. It turns replay posture from a caller-provided fact into an explicit single-use contract, while keeping raw replay keys, targets, and nonces out of exported entries.

The execution receipt closes the path. It binds the observed downstream result back to the admission, presentation, and replay receipt so the proof trail does not stop at permission.

## Finance Pack

Finance is still the deepest end-to-end proof surface.

The finance pack currently includes:

- SQL governance
- policy and entitlement checks
- execution guardrails
- fixture, SQLite, and bounded PostgreSQL execution
- data contracts and reconciliation logic
- semantic clauses
- filing readiness
- signed certificates and verification kits
- reviewer endorsement and authority closure
- finance record-release enforcement as the first hard gateway wedge
- finance communication and action release flows in shadow-first posture

Finance is the current proof wedge, not the total definition of Attestor.

## Crypto Pack

The crypto pack is an extension of the same Attestor core.

Current status:

| Surface | Status |
|---|---|
| `attestor/crypto-authorization-core` | packaged for evaluation |
| `attestor/crypto-execution-admission` | packaged for evaluation |

What the crypto pack already covers:

- authorization vocabulary, object model, canonical references, and risk mapping
- EIP-712 envelopes, ERC-1271 projection, replay/freshness, and core bindings
- pre-execution simulation
- Safe transaction and module guard adapters
- ERC-4337 UserOperation adapter
- ERC-7579 and ERC-6900 modular account adapters
- EIP-7702 delegation-aware adapter
- x402 and custody/co-signer adapters
- execution-admission planning, wallet RPC handoffs, Safe guard receipts, ERC-4337 bundler handoffs, modular-account handoffs, delegated-EOA handoffs, x402 resource-server middleware, custody policy callback contracts, intent-solver admission handoffs, uniform admission telemetry / signed receipts, JSON conformance fixtures, and a curated package surface for external integrators

Current crypto execution-admission posture:

- the frozen execution-admission buildout is complete
- future crypto work should start from a new tracker rather than extending the frozen list

## Product Truth Versus First Slices

The following distinctions matter:

- the platform core is real and already strongly implemented
- the finance pack is the strongest end-to-end proof wedge
- the crypto pack is real, and the current authorization plus execution-admission package tracks are complete; future chain/customer deployment work should be tracked separately
- hosted account, billing, SSO, passkey, and tenant operations exist as product-surface slices inside the service, not as proof that every commercial surface is already independently mature
- healthcare, Snowflake, VSAC, and other supporting slices exist, but they are not as deep as the finance wedge
- distributed control-plane operation is not extracted into an independent multi-region service

So the honest architectural statement is:

**Attestor is one AI action authorization layer with a real consequence-gateway core and modular packs, but not every pack or supporting slice is equally mature.**

## Current Work Posture

Active priority:

- move through the [Production rehearsal buildout](production-rehearsal-buildout.md) so `production-shared` becomes real-environment evidence, not just repo-embedded PostgreSQL proof
- keep the completed [Production shared authority plane buildout](production-shared-authority-plane-buildout.md) aligned with production promotion gates so `production-shared` remains a tested shared authority plane, not a loose marketing claim
- keep the product story centered on one Attestor platform
- keep the README and architecture docs aligned with the trackers
- preserve the completed consequence-admission contract, quickstart, and readiness gates before widening public API claims
- keep the first consequence-admission facade explicit: callers choose `finance-pipeline-run` or `crypto-execution-plan`; Attestor does not guess the pack automatically
- treat the frozen crypto execution-admission track as complete
- keep the hosted product flow truth sources, focused gates, and production probe aligned now that the hosted product flow hardening track is complete
- avoid widening supporting hosted surfaces faster than their customer journey, billing, and readiness gates can stay honest

Hosted product flow status:

- [Hosted product flow and adoption hardening](hosted-product-flow-buildout.md) is complete
- [Consequence admission contract](consequence-admission-buildout.md) is complete

Future hosted product-flow changes should preserve the docs, contract, readiness, and probe gates before the public story expands again.

Future runtime/store work should stay inside the production rehearsal track until the production readiness packet, HA probes, and real environment rehearsal show a concrete gap. Do not reopen completed runtime-hardening or shared-authority tracks just to widen the product story.
