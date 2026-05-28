# Crypto Intelligence Buildout Tracker

This tracker covers the next Attestor crypto frontier after the completed crypto authorization core and crypto execution-admission tracks.

The goal is not to add another wallet, custody platform, bundler, paymaster, facilitator, bridge, solver, oracle, compliance product, or public hosted crypto route. The goal is to make the existing programmable-money admission engine smarter about risk, missing evidence, adapter readiness, privacy posture, and operator decision support before a customer-operated system executes.

## Guardrails For This Tracker

- The numbered step list below is frozen for this buildout track.
- Step ids and titles do not get rewritten or renumbered later.
- We may append clarifying notes, acceptance criteria, or sub-notes.
- We may only change the `Status`, `Evidence`, and `Notes` columns as work progresses.
- Keep Attestor as one product with one platform core and modular packs.
- Do not add a public hosted crypto route as part of this tracker.
- Do not make Attestor a wallet, custody platform, bundler, paymaster, bridge, facilitator, solver, relayer, oracle, or market-data vendor.
- Do not claim sanctions, fraud, compliance, or counterparty screening coverage unless a customer-operated or third-party evidence source is explicitly bound by digest and scope.
- Do not expose raw wallet metadata, raw transaction payloads, customer identifiers, custody callback bodies, provider error bodies, private policy thresholds, or solver route secrets in telemetry, dashboards, proof packets, fixtures, or model-safe feedback.
- Keep model-safe feedback bounded: reason codes, missing evidence classes, safe instructions, scoped refs, and digests are allowed; raw policy internals and customer data are not.
- Preserve fail-closed behavior when intelligence inputs are absent, stale, ambiguous, contradictory, or outside the admitted scope.

## Why This Track Exists

The current crypto foundation is complete in its stated scope:

- `attestor/crypto-authorization-core` is packaged and covers vocabulary, object model, canonical references, risk mapping, EIP-712, ERC-1271, replay/freshness, release/policy/enforcement bindings, simulation, Safe, approval/allowance, ERC-4337, modular accounts, EIP-7702, x402, and custody adapters.
- `attestor/crypto-execution-admission` is packaged and covers wallet RPC, Safe guard, ERC-4337 bundler, modular-account, delegated-EOA, x402 resource-server, custody callback, intent-solver, telemetry/receipts, conformance fixtures, and package-boundary probes.

The next missing layer is intelligence over those surfaces:

```text
crypto preflight evidence
  -> risk and readiness signals
  -> policy gap / missing evidence interpretation
  -> model-safe correction or operator review
  -> admission remains admit / review / block
  -> downstream system still verifies before execute
```

This track should make Attestor better at explaining what is risky, what is missing, what can be safely narrowed, and what must be held for review without teaching a model how to probe private policy boundaries.

## Research Anchors

Reviewed on 2026-05-11 before opening this track:

- ERC-4337 keeps UserOperation validation, EntryPoint binding, `userOpHash`, and bundler behavior as the pre-execution account-abstraction surface, so crypto intelligence must preserve independent hash recomputation and bundler evidence rather than trusting a submitted operation blindly: [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)
- ERC-7562 formalizes account-abstraction validation-scope constraints and DoS-sensitive validation rules, so adapter readiness must continue to distinguish "simulation ran" from "validation posture is acceptable": [ERC-7562](https://eips.ethereum.org/EIPS/eip-7562)
- EIP-7702 makes delegated EOA authorization tuples, delegate-code posture, nonce freshness, and revocation/reset behavior first-class risk surfaces, so delegated execution should receive explicit intelligence signals instead of being treated as a generic wallet call: [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)
- ERC-7683 standardizes cross-chain intent order surfaces while leaving route and settlement security to implementations, so intent-solver intelligence must bind route, counterparty, liquidity, refund, settlement, deadline, and replay evidence before handoff: [ERC-7683](https://eips.ethereum.org/EIPS/eip-7683)
- x402 separates HTTP transport, exact payment schemes, facilitator verification, settlement, and payment response material, so agent-payment intelligence must keep resource, amount, recipient, facilitator, budget, privacy metadata, and idempotency evidence explicit: [x402 specification v2](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
- Safe guards and module guards can block smart-account execution; guard readiness therefore needs recoverability, interface support, installation, and post-execution evidence instead of a boolean "Safe supported" label: [Safe Guards](https://docs.safe.global/advanced/smart-account-guards)
- Turnkey documents explicit allow/deny policy effects, consensus, and implicit deny behavior. Attestor crypto policy intelligence should preserve explicit-deny precedence and fail closed on missing policy evidence rather than invent permissive defaults: [Turnkey policy engine](https://docs.turnkey.com/products/embedded-wallets/features/policy-engine)
- Fireblocks co-signer and authorization policy documentation treats callback configuration, authentication, and response behavior as custody safety controls. Attestor custody intelligence must therefore bind callback freshness, auth posture, quorum, screening, velocity, and provider terminal status before an allow response: [Fireblocks API co-signers](https://developers.fireblocks.com/docs/cosigner-architecture-overview)
- Chainalysis crypto-crime reporting continues to concentrate risk around private-key compromise, service compromise, laundering paths, bridge movement, and high-value theft. Attestor should treat key posture, custody posture, bridges, counterparty, route, delegated authority, allowance, and velocity as first-class risk signals while avoiding claims that it replaces a threat-intelligence or compliance vendor: [Chainalysis Crypto Crime Report](https://www.chainalysis.com/blog/2025-crypto-crime-report-introduction/)
- NIST AI RMF frames governance around measuring, managing, and documenting risk over time. For Attestor, crypto intelligence should emit structured evidence and operator-facing explanations, not ungrounded autonomous policy learning: [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
- OpenTelemetry and CloudEvents keep event data structured and portable. Crypto intelligence telemetry should remain low-cardinality, digest-first, and safe for customer-operated observability stacks: [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/), [CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md)
- W3C PROV models provenance around entities, activities, and agents. Operator-supplied risk inputs should therefore bind source, method, dataset version, retrieval time, and evidence digest instead of relying on a raw provider response: [W3C PROV-O](https://www.w3.org/TR/prov-o/)
- OFAC publishes sanctions list services and data formats, but Attestor must not claim native sanctions coverage. Customer-operated or third-party screening can only enter as scoped, digest-bound evidence with dataset version references: [OFAC sanctions list service](https://ofac.treasury.gov/sanctions-list-service)
- Node's performance hooks and crypto hashing APIs provide stable local measurement and digest primitives, so Step 09 records aggregate p50/p95/max timing budgets for intelligence hot paths without persisting raw benchmark inputs: [Node.js perf_hooks](https://nodejs.org/api/perf_hooks.html), [Node.js crypto](https://nodejs.org/api/crypto.html)
- Node package `exports` maps define explicit package entrypoints and keep unexported package subpaths private, so Step 10 exposes one `attestor/crypto-intelligence` boundary instead of freezing internal deep imports: [Node.js packages](https://nodejs.org/api/packages.html)
- TypeScript `moduleResolution: "bundler"` supports package `exports` and `imports`, so the Step 10 surface can be type-checked through the same package-boundary model used by the rest of Attestor: [TypeScript moduleResolution](https://www.typescriptlang.org/tsconfig/#moduleResolution)

## Architecture Decision

Start crypto intelligence as a new repository track above the packaged crypto surfaces:

- canonical tracker: `docs/02-architecture/crypto-intelligence-buildout.md`
- final package location: `attestor/crypto-intelligence`, backed by existing `src/crypto-authorization-core` and `src/crypto-execution-admission` source modules
- first output shape: risk/readiness interpretation and policy-gap signals, not a new execution path
- first guardrail: digest-first privacy and anti-overclaim tests before adding public UI or hosted route claims
- extraction rule: standalone crypto-intelligence service waits until real customer-operated integrations prove latency, custody isolation, or operational separation requirements

## Intelligence Vocabulary

| Term | Meaning |
|---|---|
| Crypto risk signal | A bounded fact about account, chain, route, counterparty, allowance, delegation, custody, solver, payment, or freshness posture. |
| Adapter readiness signal | Evidence that a specific wallet, guard, bundler, modular runtime, delegated runtime, x402 server, custody policy engine, or solver can safely execute the admitted path. |
| Policy gap | A missing or insufficient policy dimension required to decide the proposed crypto consequence. |
| Missing evidence class | A model-safe category that tells an operator or integration what evidence class is missing without leaking private policy internals. |
| Narrowing candidate | A safer bounded form of the same proposed consequence, such as lower amount, shorter validity, fewer calls, narrower target, or review-only posture. |
| Operator-supplied risk input | A customer-owned or third-party signal referenced by digest and scope, not treated as an Attestor-native oracle. |
| Intelligence receipt | Digest-first proof that records which risk/readiness/gap signals were used to explain, narrow, review, or block an admission. |

## Progress Summary

| Metric | Value |
|---|---|
| Total frozen steps | 10 |
| Completed | 10 |
| In progress | 0 |
| Not started | 0 |
| Current posture | The crypto intelligence buildout track is complete for the current evaluation package: `attestor/crypto-intelligence` now groups risk signals, policy gaps, adapter readiness, conformance fixtures, privacy minimization, operator risk inputs, dashboard summaries, aggregate performance budgets, and package-surface consistency checks behind one package-boundary probe. |

## Frozen Step List

| Step | Status | Deliverable | Evidence | Notes |
|---|---|---|---|---|
| 01 | complete | Define crypto intelligence scope, research anchors, vocabulary, and guardrails | `docs/02-architecture/crypto-intelligence-buildout.md`, `tests/crypto-intelligence-buildout-docs.test.ts`, `README.md`, `docs/02-architecture/system-overview.md`, `package.json` | Opens the next crypto track without reopening the completed crypto authorization or execution-admission trackers. Preserves one-product framing, digest-first privacy, fail-closed posture, and the no-hosted-crypto-route guardrail. |
| 02 | complete | Add crypto risk signal model and severity mapping | `src/crypto-authorization-core/intelligence-risk-signals.ts`, `tests/crypto-authorization-core-intelligence-risk-signals.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Interprets account kind, chain, asset, amount, counterparty, bridge/route, allowance, delegation, custody, x402, solver, freshness, readiness, and velocity posture into deterministic model-safe signals without replacing the existing core risk mapper. |
| 03 | complete | Add policy gap and safe narrowing candidate generation | `src/crypto-authorization-core/policy-gap-narrowing.ts`, `tests/crypto-authorization-core-policy-gap-narrowing.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Converts missing policy dimensions and failed limits into model-safe gap classes and approval-required narrowing candidates while keeping private policy thresholds out of feedback. |
| 04 | complete | Add adapter readiness matrix and manifest | `src/crypto-execution-admission/adapter-readiness-manifest.ts`, `tests/crypto-execution-admission-adapter-readiness-manifest.test.ts`, `tests/crypto-execution-admission-platform-surface.test.ts`, `scripts/probe/probe-crypto-execution-admission-package-surface.mjs`, `package.json` | Summarizes readiness across wallet RPC, Safe guard, ERC-4337 bundler, modular account runtime, delegated EOA runtime, x402 resource server, custody policy engine, and intent solver surfaces using model-safe reason codes, evidence classes, plan digests, and explicit no-raw-payload privacy boundaries. |
| 05 | complete | Expand negative conformance fixtures for crypto intelligence | `src/crypto-execution-admission/conformance-fixtures.ts`, `tests/crypto-execution-admission-negative-conformance-fixtures.test.ts`, `tests/crypto-execution-admission-conformance-fixtures.test.ts`, `scripts/probe/probe-crypto-execution-admission-package-surface.mjs`, `package.json` | Adds 40 fail-closed negative fixtures: malformed, stale, malicious, contradictory, and privacy-unsafe cases for wallet RPC, Safe guard, ERC-4337 bundler, modular account runtime, delegated EOA runtime, x402 resource server, custody policy engine, and intent solver. |
| 06 | complete | Harden crypto privacy and telemetry minimization | `src/crypto-authorization-core/intelligence-privacy-minimization.ts`, `tests/crypto-authorization-core-intelligence-privacy-minimization.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Adds a digest-first privacy minimization gate for risk signals, policy gaps, adapter readiness manifests, negative fixtures, telemetry events, dashboard summaries, and proof packets. The gate fails closed on raw wallet metadata, transaction payloads, custody callback bodies, provider error bodies, route secrets, customer identifiers, raw idempotency keys, payment headers, recipient details, and private policy threshold exposure. |
| 07 | complete | Add operator-supplied risk input contract | `src/crypto-authorization-core/operator-risk-input-contract.ts`, `tests/crypto-authorization-core-operator-risk-input-contract.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Defines how customer-owned or third-party sanctions, screening, counterparty, route, liquidity, bridge, custody, market, and fraud signals enter crypto intelligence as digest-bound, scoped, fresh, provenance-bound evidence. The contract fails closed on stale evidence, missing digest references, missing scope, privacy-minimization failures, and any Attestor-native oracle claim. |
| 08 | complete | Add crypto intelligence dashboard summary | `src/crypto-authorization-core/intelligence-dashboard-summary.ts`, `tests/crypto-authorization-core-intelligence-dashboard-summary.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Exposes operator-facing counts, top surfaces, top failure reasons, missing evidence classes, readiness coverage, attention items, and digest-first proof links without raw payload drilldown, customer/provider material, compliance claims, or financial-impact overclaims. |
| 09 | complete | Add crypto intelligence performance budget and benchmarks | `src/crypto-authorization-core/intelligence-performance-budget.ts`, `tests/crypto-authorization-core-intelligence-performance-budget.test.ts`, `scripts/benchmark-crypto-intelligence-performance.ts`, `tests/crypto-authorization-core-intelligence-privacy-minimization.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Baselines risk-signal, policy-gap, operator-risk-input, dashboard-summary, privacy-scan, canonicalization/hash, negative-fixture, and telemetry-safety paths with p50/p95/max budgets. Benchmark output is digest-first, aggregate-only, fail-closed on budget breaches or insufficient samples, and does not store raw benchmark inputs. |
| 10 | complete | Package and document the crypto intelligence surface | `src/crypto-intelligence/index.ts`, `docs/02-architecture/crypto-intelligence-platform-surface.md`, `tests/crypto-intelligence-platform-surface.test.ts`, `scripts/probe/probe-crypto-intelligence-package-surface.mjs`, `tests/crypto-intelligence-buildout-docs.test.ts`, `package.json`, `README.md`, `docs/02-architecture/system-overview.md`, `docs/01-overview/purpose.md` | Crypto intelligence now ships as the curated `attestor/crypto-intelligence` package subpath with namespace grouping for risk signals, policy gaps, adapter readiness, conformance fixtures, privacy minimization, operator risk inputs, dashboard summary, performance budget, and package-surface consistency. The package-boundary probe blocks internal `attestor/crypto-intelligence/*.js` deep imports and checks export-map, descriptor, and deep-import drift across the crypto pack surfaces. Standalone service extraction remains pending until customer-operated latency, custody isolation, or independent operational-scaling requirements justify it. |

## Completion Definition

This track is complete only when:

- every supported crypto surface has deterministic risk/readiness/gap intelligence
- missing evidence and narrowing feedback are model-safe and privacy-safe
- negative conformance fixtures cover unsafe and malformed paths
- operator-supplied risk inputs are provenance-bound, scoped, fresh, and non-oracular
- dashboards and proof outputs stay digest-first and avoid raw crypto/customer payloads
- performance budgets exist for intelligence paths
- package-surface consistency fails closed on export-map, descriptor, or deep-import drift
- any public package surface is explicitly exported and package-boundary tested
- no public hosted crypto route or wallet/custody/bundler/facilitator/solver role is claimed by accident

## Immediate Next Step

The frozen crypto intelligence buildout track is complete. Next crypto work should build on `attestor/crypto-intelligence` rather than reopening the completed authorization, execution-admission, or intelligence tracks.
