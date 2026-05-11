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

## Architecture Decision

Start crypto intelligence as a new repository track above the packaged crypto surfaces:

- canonical tracker: `docs/02-architecture/crypto-intelligence-buildout.md`
- initial package location: existing `src/crypto-authorization-core` and `src/crypto-execution-admission` surfaces until a later step proves a dedicated subpath is needed
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
| Completed | 6 |
| In progress | 0 |
| Not started | 4 |
| Current posture | Step 06 adds a crypto intelligence privacy-minimization gate that rejects raw wallet metadata, transaction payloads, custody callback bodies, provider error bodies, route secrets, customer identifiers, raw idempotency keys, and private policy thresholds before telemetry, proof, dashboard, or model-safe feedback can treat an artifact as safe. |

## Frozen Step List

| Step | Status | Deliverable | Evidence | Notes |
|---|---|---|---|---|
| 01 | complete | Define crypto intelligence scope, research anchors, vocabulary, and guardrails | `docs/02-architecture/crypto-intelligence-buildout.md`, `tests/crypto-intelligence-buildout-docs.test.ts`, `README.md`, `docs/02-architecture/system-overview.md`, `package.json` | Opens the next crypto track without reopening the completed crypto authorization or execution-admission trackers. Preserves one-product framing, digest-first privacy, fail-closed posture, and the no-hosted-crypto-route guardrail. |
| 02 | complete | Add crypto risk signal model and severity mapping | `src/crypto-authorization-core/intelligence-risk-signals.ts`, `tests/crypto-authorization-core-intelligence-risk-signals.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Interprets account kind, chain, asset, amount, counterparty, bridge/route, allowance, delegation, custody, x402, solver, freshness, readiness, and velocity posture into deterministic model-safe signals without replacing the existing core risk mapper. |
| 03 | complete | Add policy gap and safe narrowing candidate generation | `src/crypto-authorization-core/policy-gap-narrowing.ts`, `tests/crypto-authorization-core-policy-gap-narrowing.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Converts missing policy dimensions and failed limits into model-safe gap classes and approval-required narrowing candidates while keeping private policy thresholds out of feedback. |
| 04 | complete | Add adapter readiness matrix and manifest | `src/crypto-execution-admission/adapter-readiness-manifest.ts`, `tests/crypto-execution-admission-adapter-readiness-manifest.test.ts`, `tests/crypto-execution-admission-platform-surface.test.ts`, `scripts/probe-crypto-execution-admission-package-surface.mjs`, `package.json` | Summarizes readiness across wallet RPC, Safe guard, ERC-4337 bundler, modular account runtime, delegated EOA runtime, x402 resource server, custody policy engine, and intent solver surfaces using model-safe reason codes, evidence classes, plan digests, and explicit no-raw-payload privacy boundaries. |
| 05 | complete | Expand negative conformance fixtures for crypto intelligence | `src/crypto-execution-admission/conformance-fixtures.ts`, `tests/crypto-execution-admission-negative-conformance-fixtures.test.ts`, `tests/crypto-execution-admission-conformance-fixtures.test.ts`, `scripts/probe-crypto-execution-admission-package-surface.mjs`, `package.json` | Adds 40 fail-closed negative fixtures: malformed, stale, malicious, contradictory, and privacy-unsafe cases for wallet RPC, Safe guard, ERC-4337 bundler, modular account runtime, delegated EOA runtime, x402 resource server, custody policy engine, and intent solver. |
| 06 | complete | Harden crypto privacy and telemetry minimization | `src/crypto-authorization-core/intelligence-privacy-minimization.ts`, `tests/crypto-authorization-core-intelligence-privacy-minimization.test.ts`, `tests/crypto-authorization-core-platform-surface.test.ts`, `scripts/probe-crypto-authorization-core-package-surface.mjs`, `package.json` | Adds a digest-first privacy minimization gate for risk signals, policy gaps, adapter readiness manifests, negative fixtures, telemetry events, dashboard summaries, and proof packets. The gate fails closed on raw wallet metadata, transaction payloads, custody callback bodies, provider error bodies, route secrets, customer identifiers, raw idempotency keys, payment headers, recipient details, and private policy threshold exposure. |
| 07 | pending | Add operator-supplied risk input contract | _pending_ | Should define how customer-owned or third-party risk, sanctions, screening, route, liquidity, and counterparty inputs are referenced by digest, scope, freshness, and provenance without becoming Attestor-native oracle claims. |
| 08 | pending | Add crypto intelligence dashboard summary | _pending_ | Should expose operator-facing counts, top surfaces, top failure reasons, missing evidence classes, readiness coverage, and proof links without raw payload drilldown or financial-impact overclaims. |
| 09 | pending | Add crypto intelligence performance budget and benchmarks | _pending_ | Should baseline canonicalization, hashing, fixture validation, telemetry safety scans, and signal aggregation paths, then add regression budgets that preserve fail-closed behavior. |
| 10 | pending | Package and document the crypto intelligence surface | _pending_ | Should decide whether the intelligence layer stays under existing package surfaces or becomes a curated `attestor/crypto-intelligence` subpath, with package-boundary probes only after the contract is stable. |

## Completion Definition

This track is complete only when:

- every supported crypto surface has deterministic risk/readiness/gap intelligence
- missing evidence and narrowing feedback are model-safe and privacy-safe
- negative conformance fixtures cover unsafe and malformed paths
- operator-supplied risk inputs are provenance-bound, scoped, fresh, and non-oracular
- dashboards and proof outputs stay digest-first and avoid raw crypto/customer payloads
- performance budgets exist for intelligence paths
- any public package surface is explicitly exported and package-boundary tested
- no public hosted crypto route or wallet/custody/bundler/facilitator/solver role is claimed by accident

## Immediate Next Step

Implement Step 07: add operator-supplied risk input contract.
