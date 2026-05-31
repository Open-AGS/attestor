# System Overview

Architecture of Attestor as of May 19, 2026.

This document is the short architectural truth source. The README gives the product view; the trackers and platform-surface docs give the detailed implementation view.

## One Product

Attestor should be understood as one product:

**an AI Action Control Plane for proposed AI actions before business consequences**

The core pattern is:

```text
AI proposes -> policy, authority, evidence, and enforcement checks -> admitted, narrowed, reviewed, or blocked consequence
```

That same pattern spans AI-output release, programmable-money authorization, data export, authority change, communication, filing, and operational execution. The architecture therefore has one shared consequence-admission core and multiple packs, not multiple unrelated products hiding in one repository.

The security target is reference-monitor-style, not a blanket claim that Attestor is a classical reference monitor in every customer deployment. A workflow only earns that posture when a real PEP, gateway, verifier, or adapter catches the action before downstream execution and the path is tested against the admission proof, binding, replay, and failure-mode controls.

The customer-facing operating model and decision vocabulary live in [Operating model](../01-overview/operating-model.md). Use that page when deciding how domain-native finance or crypto outcomes map to the shared `admit`, `narrow`, `review`, and `block` language.

The deeper architecture decision lives in [AI Action Control Plane architecture](ai-action-control-plane-architecture.md). Use it when deciding whether a change belongs in the reference-monitor-style admission core, an enforcement point, an evidence/authority source, policy administration, a pack, or the hosted service composition root.

The raw internal project structure lives in [Attestor internal machine map](attestor-internal-machine-map.md). Use it when you need to see the repository as one machine: major parts, decision axes, fan-out/fan-in aggregators, domain paths, side loops, and folder layout.

The consequence domain vocabulary lives in [Consequence taxonomy](consequence-taxonomy.md). Use it when deciding whether a proposed AI action is a financial record, money movement, programmable-money path, data disclosure, authority change, external communication, regulated filing, system operation, decision-support artifact, or custom customer surface.

The customer-side allow/hold contract lives in [Downstream enforcement contract](downstream-enforcement-contract.md). Use it when deciding what a downstream payment adapter, wallet adapter, record writer, message sender, action dispatcher, or HTTP handler must bind before it acts on an Attestor admission.

The practical customer-side helper lives in [Verifier helper](verifier-helper.md). Use it when wiring an adapter that should call `verify` or `assert` before a downstream system acts.

The protected adapter shape lives in [Adapter framework](adapter-framework.md). Use it when an HTTP handler, queue consumer, tool wrapper, MCP tool wrapper, payment adapter, wallet adapter, record writer, or custom customer edge needs a standard verify-before-execute wrapper.

The reviewer-facing evidence package lives in [Audit evidence export](audit-evidence-export.md). Use it when shadow events, simulations, policy candidates, promotion packets, and downstream proof references need to be handed to a reviewer without raw customer payloads or fake compliance claims.

The review-only candidate diff contract lives in [policy candidate PR contract](policy-candidate-pr-contract.md). Use it when evidence-state surfaces need to become schema-bound, digest-only candidate PR material without activating enforcement.

The ranked human-question layer lives in [Active Question Engine](active-question-engine.md). Use it when candidate PR material needs to become a small set of high-impact reviewer questions instead of a broad policy-writing task.

The negative replay-fixture layer lives in [Counterexample replay generator](counterexample-replay-generator.md). Use it when candidate PR material and active questions need synthetic tenant-mismatch, stale-approval, missing-evidence, bypass, replay, prompt/tool poisoning, unsafe-approval, and crypto-abuse cases before backtesting.

The adversarial evidence fixture layer lives in [Adversarial evidence fixtures](adversarial-evidence-fixtures.md). Use it when prompt-injection-like content, tool output, model rationale, signed evidence, or mixed trusted/untrusted sources need local synthetic proof that language and evidence do not become authority by themselves.

The digest-bound backtest layer lives in [Policy Twin backtest](policy-twin-backtest.md). Use it when candidate PR material and counterexample fixtures need historical admit/review/hold/block projection, false-admit checks, missed-evidence accounting, and review-load impact before the review inbox.

The candidate-level review queue lives in [Review-by-exception inbox](review-by-exception-inbox.md). Use it when Policy Twin results need to become one bounded item per candidate across failed-replay, blocked-by-evidence, needs-answer, ready-to-approve, and monitoring-only lanes without asking humans to inspect every raw event.

The reviewer-decision feedback layer lives in [Approval/dismiss feedback loop](approval-dismiss-feedback-loop.md). Use it when approvals, dismissals, stricter-version requests, threshold edits, and rollback requests need to become digest-bound feedback without mutating a policy bundle, retraining a model, or activating enforcement.

The enterprise placement catalog lives in [Enterprise integration recipes](enterprise-integration-recipes.md). Use it when Salesforce, Microsoft Copilot/Power Automate, ServiceNow, Workato, MuleSoft, n8n, Zapier, Zendesk, Intercom, Snowflake, Databricks, Okta, Entra, or SailPoint needs a concrete pre-side-effect Attestor gate without claiming native connector coverage.

The general crypto decision contract lives in [General Crypto Transaction Gate](general-crypto-transaction-gate.md). Use it when native transfers, ERC-20 transfer/approve, permit signing, swaps, bridges, Safe transaction proposals, ERC-4337 UserOperations, session-key grants, delegated EOA authorization, or x402 payments need digest-only admit/review/block material before customer-owned execution.

The domain placement catalog lives in [Domain consequence recipes](domain-consequence-recipes.md). Use it when spend, procurement, data/AI, IAM, health, clinical decision-support, claim, or policy-administration surfaces need a concrete pre-side-effect Attestor gate without claiming native connector coverage, records-system ownership, workflow-workspace ownership, clinical authority, insurance-system ownership, customer deployment, or production readiness.

The customer-pilot packaging boundary lives in [Pilot readiness packet](pilot-readiness-packet.md). Use it when a source-backed domain recipe needs to become a digest-only shadow-entry or scoped-enforcement-entry pilot packet without claiming live customer pilot execution, native connector coverage, customer deployment, compliance certification, or production readiness.

The first concrete repo-side path through these pieces is [Golden Path: Refund](golden-refund-shadow-pilot.md). Use it when you need a runnable, synthetic, shadow-only scenario that carries a refund action surface through canonical shadow fixtures, runtime assurance smoke, Policy Foundry summary, and a pilot readiness packet without executing refunds, activating policy, or claiming production readiness.

The append-only proof trail lives in [Tamper-evident history](tamper-evident-history.md). Use it when digest-first evidence needs a linear history root that can detect modified, deleted, or reordered entries before a reviewer trusts an export.

The operator-facing risk summary lives in [Business risk dashboard](business-risk-dashboard.md). Use it when a customer needs to see action volume, review load, blocked actions, policy gaps, consequence-domain risk, downstream proof coverage, and operator-supplied impact without turning raw logs into the product.

The first-screen dashboard API lives in [Dashboard API summary](dashboard-api-summary.md). Use it when a UI, CLI, or customer-facing API needs compact tiles, attention items, top domains, and links to deeper proof surfaces without exposing raw event data.

The unified review workspace contract lives in [Attestor Review Surface contract](attestor-review-surface-contract.md). Use it when dashboard, queue, case, action-map, evidence, policy, and assurance views need one redacted, digest-first contract before hosted UI, API routes, or exports are implemented.

The outside-reviewer handoff lives in [External review packet](external-review-packet.md). Use it when an independent reviewer needs a digest-first map of audit evidence, dashboard context, runtime/storage evidence, repository security references, checklist items, and non-claims without raw customer payloads or fake audit badges.

The shared redaction boundary lives in [Data minimization and redaction policy](data-minimization-redaction-policy.md). Use it when deciding what model feedback, audit evidence, dashboard metrics, retry records, presentation bindings, replay receipts, or downstream execution receipts may expose without leaking raw customer payloads.

The shared limit vocabulary lives in [Policy limit model](policy-limit-model.md). Use it when a proposed consequence must carry amount caps, velocity windows, recipient or asset allowlists, data scope, authority scope, time bounds, risk ceilings, or review thresholds before admission.

The safe-retry accounting shape lives in [Retry attempt ledger](retry-attempt-ledger.md). Use it when a model-safe correction attempt must be recorded as an idempotent continuation of a held admission rather than a fresh probe.

The automatic retry abuse boundary lives in [Agent loop abuse guard](agent-loop-abuse-guard.md). Use it when a model-safe retry loop needs rate, window, and correction-signature limits so it cannot become DoS or policy probing.

The guard activation boundary lives in [Guard activation readiness](guard-activation-readiness.md). Use it when a guard can already render fail-closed decisions but must not be described as production enforcement-active until shared state, signed decision binding, PEP/verifier integration, replay fixtures, audit output, runbooks, and customer approval are proven.

The production storage truth gate lives in [Production storage path](production-storage-path.md). Use it when deciding whether shadow events, simulations, candidates, activation receipts, retry/replay ledgers, loop-guard counters, audit exports, and dashboards are still evaluation-backed or ready to support a `production-shared` claim.

The execution handoff vocabulary lives in [Downstream presentation binding](downstream-presentation-binding.md). Use it when the enforcement point must bind an allowed admission to the exact target, body digest, replay key, nonce, freshness window, proof references, and acknowledged constraints it is about to present to a real system.

The single-use replay consumption shape lives in [Presentation replay ledger](presentation-replay-ledger.md). Use it when a customer enforcement point must consume the presentation replay key once and keep redacted evidence that the key was not reused.

The post-consequence result shape lives in [Downstream execution receipt](downstream-execution-receipt.md). Use it when the customer edge must record whether the consequence succeeded, failed, or was skipped after replay consumption, without storing raw downstream payloads or error bodies.

## Shared Platform Core

The platform core is made of reusable layers:

| Control-plane role | Attestor surface | Boundary |
|---|---|---|
| PDP | Consequence admission, release kernel, and release layer | decides `admit`, `narrow`, `review`, or `block` from structured action intent, policy, evidence, authority, scope, and failure-mode controls |
| PEP | Enforcement plane, verifier helper, adapter framework, customer gateways | verifies proof, binding, replay, and decision posture before downstream execution |
| PIP | Evidence, authority, tenant, recipient, freshness, policy-version, no-go, and runtime context providers | supplies facts without silently approving an action |
| PAP | Release policy control plane and Policy Foundry surfaces | controls policy lifecycle, simulation, rollout, activation, reviewer constraints, and provenance |
| Audit and replay | Audit evidence export, tamper-evident history, presentation replay ledger, execution receipt, and replay fixtures | records why a decision happened and whether the allowed action was presented and consumed safely |

The machine-readable naming contract lives in `src/consequence-admission/control-plane-roles.ts`. It keeps PDP, PEP, PIP, PAP, audit-proof, replay, pack, and hosted-service vocabulary aligned across package exports, docs, and tests.

The machine-readable domain-pack boundary lives in `src/consequence-admission/domain-pack-boundary.ts`. It keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core instead of separate products or separate decision engines.

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
- `attestor/crypto-intelligence`
- `attestor/consequence-admission`

These are stable import boundaries inside one modular monolith. They are not a claim that every layer is already a separately operated service.

They are also not a public npm availability claim. The repository package remains `private: true`; the `exports` map defines curated import boundaries for local builds, self-hosted evaluation, and commercial/customer-operated packaging unless a separate public npm release decision is made.

## Pack Model

The pack model is:

- the platform core stays common
- domain or execution packs attach to that core
- packs reuse the same policy, proof, and authorization logic
- packs do not become separate products by default

The detailed pack placement contract is [Domain pack boundary](domain-pack-boundary.md). A pack may add domain defaults, evidence shapes, policy templates, adapter projections, readiness signals, and replay examples. It must not fork the `admit` / `narrow` / `review` / `block` vocabulary, the failure-mode registry, the control-binding contract, or the replay layer.

Today the two most important packs are:

- **finance pack**: the strongest proven wedge
- **crypto pack**: the active programmable-money extension

Future packs should start from the same consequence boundary. A pack is not a new product identity; it is a domain-specific way to answer whether a proposed AI-driven consequence may proceed.

The taxonomy comes before the pack. A pack may add native adapters and evidence formats, but the first classification is still the proposed consequence and the controls required before it reaches a downstream system.

The downstream contract comes before execution. A downstream integration should not act on an Attestor response until the admission id, digest, decision, consequence domain, downstream system, policy scope, proof, replay/idempotency binding, and any `narrow` constraints match the customer enforcement point.

The verifier helper packages that rule into a small customer-side API. It does not replace signed release-token verification; it gives the downstream adapter a consistent fail-closed check before it enters the stronger release-enforcement plane or the customer-owned execution layer.

The adapter framework packages the helper into a protected execution shape. It keeps the executor private to the adapter, verifies the Attestor admission before execution, and exports only digests for raw input, result, or error material.

The audit evidence export packages the shadow-to-enforcement trail for human review. It does not approve candidates, activate policies, or claim compliance; it gives reviewers a tenant-scoped, digest-first packet that shows what is proven, what is missing, and what still needs approval.

The tamper-evident history sits behind that packet. It records digest-only source artifacts in a linear hash chain and exports a root digest plus verification summary, without claiming external immutability, signatures, or production durability.

The business risk dashboard sits on top of that export. It is decision support for operators and buyers, not a new authority surface: it summarizes risk signals, but it does not infer money saved, approve enforcement, or replace the customer authority path.

The dashboard API summary sits on top of the business dashboard. It is the compact first-screen shape for product surfaces: observed action count, review/block counts, policy gaps, downstream proof coverage, top consequence domains, attention items, and links to the deeper read APIs.

The Attestor Review Surface contract sits above those summaries. It turns review evidence into seven workspace areas: overview, review queue, cases, action map, evidence library, policy, and assurance. It is still review material only: it does not admit actions, block actions by itself, activate enforcement, mutate policy bundles, deploy infrastructure, issue credentials, or prove production readiness.

The external review packet sits above both. It packages source digests, runtime/storage evidence refs, repository evidence refs, reviewer checklist items, findings, and non-claims so a third-party reviewer can inspect the system without receiving raw prompts, raw tool payloads, customer records, bank data, wallet material, credentials, or downstream error bodies.

The data minimization and redaction policy sits across those read surfaces. It keeps model feedback, proof exports, dashboards, retry ledgers, presentation bindings, replay ledgers, and execution receipts on structural control evidence: reason codes, safe instructions, counts, digests, scoped references, statuses, and aggregate signals instead of raw prompts, raw payloads, credentials, bank data, wallet material, private policy thresholds, or downstream error bodies.

The crypto intelligence buildout applies that same boundary to programmable-money paths. Its current summary surface aggregates crypto risk signals, policy gaps, operator-supplied risk inputs, adapter readiness, missing evidence, digest-first proof links, aggregate performance budgets, and package-surface consistency checks without raw wallet/payment payload drilldown, native screening claims, or inferred financial impact.

The policy limit model sits before both. It prevents broad "yes" decisions by making the admitted consequence bounded: how much, how often, to whom, over what data, under which authority, in what window, and when human review becomes mandatory.

The retry attempt ledger sits beside policy limits in the safe-retry path. It does not authorize a consequence by itself; it records that a retry attempt was bound to the previous admission, evaluated against the retry budget, and protected from duplicate or conflicting idempotency reuse.

The agent loop abuse guard sits above that ledger. It limits automatic retries per previous admission, actor/action/downstream windows, non-retryable correction reasons, and distinct correction signatures so correction does not degrade into overload or policy probing.

The production storage path sits below those surfaces. It does not make file-backed evaluation stores production-ready; it inventories the storage mode behind the consequence-admission path and makes `production-shared` fail closed until the needed history, ledgers, guards, exports, and dashboard sources move to shared durable storage.

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
| `attestor/crypto-intelligence` | packaged for evaluation |

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
- crypto intelligence now packages risk signals, policy gaps, adapter readiness, operator risk inputs, dashboard summaries, conformance fixtures, privacy gates, performance budgets, and package-surface consistency checks through `attestor/crypto-intelligence` without raw wallet/payment payload drilldown or native screening claims

Current crypto execution-admission posture:

- the frozen execution-admission buildout is complete
- the frozen crypto intelligence buildout is complete
- future crypto hardening should build on [Crypto engine hardening II](crypto-engine-hardening-ii.md), [Crypto intelligence buildout](crypto-intelligence-buildout.md), and the packaged `attestor/crypto-intelligence` surface rather than reopening the frozen authorization, execution-admission, or intelligence lists; current hardening adds adapter-readiness intelligence, consequence-admission pack decision profiles, policy-intelligence routing, proof-console prioritization, runtime efficiency guards, and package-surface consistency checks for finance and crypto

## Product Truth Versus First Slices

The following distinctions matter:

- the platform core is real and already strongly implemented
- the finance pack is the strongest end-to-end proof wedge
- the crypto pack is real, and the current authorization plus execution-admission package tracks are complete; future chain/customer deployment work should be tracked separately
- hosted account, billing, SSO, passkey, and tenant operations exist as product-surface slices inside the service, not as proof that every commercial surface is already independently mature
- healthcare, Snowflake, VSAC, and other supporting slices exist, but they are not as deep as the finance wedge
- distributed control-plane operation is not extracted into an independent multi-region service

So the honest architectural statement is:

**Attestor is one AI Action Control Plane with a shared consequence-admission core and modular packs, but not every pack or supporting slice is equally mature.**

## Current Work Posture

Current posture:

- use [Golden Path: Refund](golden-refund-shadow-pilot.md) as the first runnable repo-side scenario before widening demos or customer-pilot claims
- keep future golden paths as scenario paths through the same consequence engine, not new products, engines, or domain identities

- use the [Attestor unlock source of truth](attestor-unlock-source-of-truth.md) as completed trust-unlock history before reopening signer, customer PEP, consequence shared-store, LLM provider, or production rehearsal decisions
- use the [target-system compatibility matrix](target-system-compatibility-matrix.md) before adding enterprise or crypto recipes so target integrations stay one-engine adapters instead of vendor-specific products
- use the [shadow event canonical schema](shadow-event-canonical-schema.md) before building the action surface graph so observed target facts and inferred classifications do not collapse into one ambiguous event shape
- use the [action surface graph](action-surface-graph.md) before the [evidence state model](evidence-state-model.md) so tenant-bound systems, tools, resources, route coverage, missing proof links, and observed/inferred/missing/conflicting/stale/untrusted/approved/enforceable states are explicit before candidate generation
- use the [LLM provider runtime decision](llm-provider-runtime-decision.md) before starting the Anthropic adapter so provider diversity does not outrun proof minimization, rate-limit handling, timeout/budget controls, or the consequence enforcement chain
- move through the [Production rehearsal buildout](production-rehearsal-buildout.md) so `production-shared` becomes real-environment evidence, not just repo-embedded PostgreSQL proof
- keep the completed [Production shared authority plane buildout](production-shared-authority-plane-buildout.md) aligned with production promotion gates so `production-shared` remains a tested shared authority plane, not a loose marketing claim
- keep the [AI Action Control Plane architecture](ai-action-control-plane-architecture.md) aligned with the README, package boundaries, failure registry, replay fixtures, and customer-side enforcement contract
- keep the product story centered on one Attestor platform
- keep the README and architecture docs aligned with the trackers
- preserve the completed consequence-admission contract, quickstart, and readiness gates before widening public API claims
- keep the first consequence-admission facade explicit: callers choose `finance-pipeline-run` or `crypto-execution-plan`; Attestor does not guess the pack automatically
- treat the frozen crypto execution-admission and crypto intelligence tracks as complete, and route new crypto hardening through a new tracker or explicit follow-up scope rather than reopening those frozen lists
- keep the hosted product flow truth sources, focused gates, and production probe aligned now that the hosted product flow hardening track is complete
- avoid widening supporting hosted surfaces faster than their customer journey, billing, and readiness gates can stay honest

Hosted product flow status:

- [Hosted product flow and adoption hardening](hosted-product-flow-buildout.md) is complete
- [Consequence admission contract](consequence-admission-buildout.md) is complete

Future hosted product-flow changes should preserve the docs, contract, readiness, and probe gates before the public story expands again.

Future runtime/store work should stay inside the production rehearsal track until the production readiness packet, HA probes, and real environment rehearsal show a concrete gap. Do not reopen completed runtime-hardening or shared-authority tracks just to widen the product story.
