# Crypto Intelligence Surface

Attestor now exposes the completed crypto intelligence layer through:

- `attestor/crypto-intelligence`

This is a curated package surface above the packaged `attestor/crypto-authorization-core` and `attestor/crypto-execution-admission` surfaces. It remains inside the Attestor modular monolith. It is not a hosted crypto route, wallet, custody service, screening oracle, solver, facilitator, relayer, or market-data product.

## Final Package Boundary

The package surface exposes one public subpath and one curated namespace object:

- public subpath: `attestor/crypto-intelligence`
- namespace object: `cryptoIntelligence`
- surface descriptor: `cryptoIntelligencePublicSurface()`

The compatibility promise is:

- the subpath name is stable
- namespace names under `cryptoIntelligence` are stable
- versioned risk, policy-gap, readiness, fixture, privacy, operator-input, dashboard, and performance specs remain the public contract
- internal `attestor/crypto-intelligence/*.js` deep module paths are not public API
- source module layout under `crypto-authorization-core` and `crypto-execution-admission` can still evolve behind the curated surface

The shape follows the repository package-boundary rule: consumers import one stable package subpath while `package.json` `exports` keeps internal paths private. The repository package remains `private: true`; this is a local/self-hosted/commercial packaging boundary, not a public npm publication claim.

## Public Contract

The public subpath exposes:

- `cryptoIntelligence`
- `cryptoIntelligencePublicSurface()`
- risk signal descriptors, constants, labels, and `createCryptoIntelligenceRiskSignalAssessment()`
- policy gap descriptors, constants, labels, and `createCryptoPolicyGapNarrowingAssessment()`
- policy coverage profile descriptors and `createCryptoPolicyCoverageProfile()`
- policy intelligence routing descriptors and `createCryptoPolicyIntelligenceRoutingProfile()`
- adapter readiness descriptors, constants, labels, and `createCryptoAdapterReadinessManifest()`
- adapter readiness intelligence descriptors, posture/risk-factor constants, labels, and `createCryptoAdapterReadinessIntelligenceProfile()`
- conformance fixture descriptors and negative fixture validation
- privacy minimization descriptors and evaluation helpers
- operator-supplied risk input descriptors, labels, and `createCryptoOperatorRiskInputBundle()`
- dashboard summary descriptors, labels, and `createCryptoIntelligenceDashboardSummary()`
- performance budget descriptors, labels, and `createCryptoIntelligencePerformanceBenchmark()`

The curated namespace object groups the platform surface as:

| Namespace | Role |
|---|---|
| `riskSignals` | Deterministic risk/readiness/freshness/velocity signals over programmable-money consequences |
| `policyGapNarrowing` | Missing evidence, policy coverage, explicit/implicit deny, stale policy evidence, policy-intelligence routing, policy gaps, and safe narrowing candidates without exposing private thresholds |
| `adapterReadiness` | Wallet, Safe, ERC-4337, modular-account, delegated-EOA, x402, custody, and solver readiness matrix plus deterministic readiness intelligence profiles |
| `conformanceFixtures` | Positive and negative execution-admission fixture coverage, including malformed, stale, contradictory, and privacy-unsafe paths |
| `privacyMinimization` | Digest-first guard for intelligence outputs, telemetry, dashboards, proof packets, and benchmark outputs |
| `operatorRiskInputs` | Customer-operated or third-party risk input contract with provenance, freshness, scope, and digest binding |
| `dashboardSummary` | Operator-facing counts, posture, attention items, missing evidence, readiness coverage, and digest-first proof links |
| `performanceBudget` | Aggregate p50/p95/max budget checks for intelligence hot paths |

## What This Surface Answers

The crypto authorization core answers what the proposed programmable-money consequence is and how it maps to policy, authority, evidence, and release/enforcement bindings.

The crypto execution-admission surface answers which wallet, guard, bundler, payment, custody, or solver handoff is involved and what must be passed to that surface before execution.

The crypto intelligence surface answers:

- what is risky or missing?
- which policy dimensions are covered, stale, conflicting, explicitly denied, or implicitly denied?
- which policy route dominates, and what operator action is required before retry?
- what adapter evidence is ready, missing, blocked, or review-required?
- which adapter standards and surfaces need the next operator action?
- what model-safe narrowing or operator action is available?
- what proof links and dashboard summaries can be shown without raw payloads?
- whether the intelligence path remains inside performance and privacy budgets?

It does not authorize execution by itself. It informs the same `admit`, `narrow`, `review`, and `block` consequence path, and downstream systems still verify before acting.

Policy coverage profile rules are fail-closed:

- explicit deny wins over narrowing suggestions
- implicit deny blocks until an explicit customer-approved allow rule matches
- stale policy evidence blocks until fresh digest-bound policy evidence is collected
- conflicting policy evidence routes to operator resolution before enforcement
- review-required coverage produces review work, not autonomous policy edits

## Privacy And Non-Claims

The surface is digest-first by default. It must not expose:

- raw wallet metadata
- raw transaction payloads
- customer identifiers
- custody callback bodies
- provider error bodies
- private policy thresholds
- solver route secrets
- raw idempotency keys
- payment headers or recipient details

It also does not claim native sanctions, fraud, compliance, counterparty screening, market-data, bridge, solver, facilitator, wallet, custody, or hosted crypto execution coverage. Those signals may enter only as customer-operated or third-party evidence bound by digest, scope, dataset/version reference, method reference, freshness, and provenance.

## Extraction Criteria

The crypto intelligence package surface is ready before standalone service extraction. Full service extraction still requires one criterion to become true:

1. Risk, readiness, and gap contracts are stable. Status: `ready`
2. Privacy and model-safe feedback boundaries are proven. Status: `ready`
3. Negative conformance and performance paths are proven. Status: `ready`
4. The package boundary is proven by export-map probes. Status: `ready`
5. Customer-operated latency, custody isolation, or independent operational scaling justifies a standalone service. Status: `pending`

So crypto intelligence is now **packaged**, but not yet **split into a separate service**.

## Consumption Example

```ts
import {
  cryptoIntelligence,
  cryptoIntelligencePublicSurface,
  createCryptoAdapterReadinessManifest,
  createCryptoAdapterReadinessIntelligenceProfile,
} from 'attestor/crypto-intelligence';

const surface = cryptoIntelligencePublicSurface();

if (surface.hostedRouteClaimed) {
  throw new Error('Crypto intelligence must not claim a hosted execution route.');
}

const riskDescriptor = cryptoIntelligence.riskSignals
  .cryptoIntelligenceRiskSignalsDescriptor();

if (!riskDescriptor.categories.includes('delegation')) {
  throw new Error('Delegation intelligence is not packaged.');
}

const readiness = createCryptoAdapterReadinessManifest({
  generatedAt: new Date().toISOString(),
  scopeRef: 'integration:treasury-wallet',
});

const readinessProfile = createCryptoAdapterReadinessIntelligenceProfile({
  manifest: readiness,
});

if (readiness.rawPayloadStored) {
  throw new Error('Crypto intelligence readiness must stay digest-first.');
}

if (readinessProfile.summary.blockedCount > 0) {
  throw new Error('Blocked adapter handoffs require operator resolution.');
}
```

## What Stays Internal

These paths are intentionally not public package API:

- `attestor/crypto-intelligence/*.js`
- `attestor/crypto-authorization-core/*.js`
- `attestor/crypto-execution-admission/*.js`
- service runtime internals
- customer-operated provider payloads and policy internals

The package surface is intentionally narrow so crypto intelligence can grow without freezing every internal module path.
