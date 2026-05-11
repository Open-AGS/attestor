# Crypto Engine Hardening II

This tracker continues after the frozen crypto authorization, execution-admission, and crypto intelligence tracks. It keeps the same product boundary: Attestor is a governance and proof engine, not a wallet, custody platform, bundler, paymaster, bridge, facilitator, solver, relayer, oracle, screening vendor, or hosted crypto execution route.

## Guardrails

- Keep the core decision vocabulary stable: `admit`, `narrow`, `review`, and `block`.
- Preserve fail-closed behavior when policy, authority, evidence, freshness, enforcement, adapter readiness, or privacy posture is missing, stale, contradictory, or outside scope.
- Keep privacy sacred: no raw wallet metadata, raw transaction payloads, customer identifiers, custody callback bodies, provider error bodies, private policy thresholds, raw idempotency keys, payment headers, recipient details, or solver route secrets in telemetry, dashboards, proof packets, benchmarks, fixtures, or model-safe feedback.
- Customer-operated and third-party risk inputs remain digest-bound evidence. Attestor must not claim native sanctions, fraud, compliance, counterparty screening, market-data, bridge, solver, facilitator, wallet, custody, or hosted execution coverage.
- Prefer deterministic, inspectable intelligence over autonomous policy mutation.
- Every hardening PR must include a local probe or test that proves the behavior and the package boundary it changes.

## Research Anchors

Reviewed on 2026-05-11 before Step 01:

- ERC-4337 keeps `UserOperation`, EntryPoint validation, bundler behavior, and simulation as pre-execution account-abstraction concerns. Adapter readiness must keep validation evidence explicit before handoff: [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)
- ERC-7562 constrains account-abstraction validation behavior and DoS-sensitive validation scope. A green adapter check should distinguish "simulation exists" from "validation posture is acceptable": [ERC-7562](https://eips.ethereum.org/EIPS/eip-7562)
- ERC-7579 defines modular smart-account execution through validator, executor, hook, and fallback-handler modules. Readiness must treat module and hook posture as first-class evidence: [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579)
- EIP-7702 adds delegated EOA authorization and delegate-code posture. Delegated execution must not be treated as a generic wallet call: [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)
- x402 separates HTTP transport from payment requirement, verification, settlement, and response material. Agent-payment readiness must keep those evidence classes explicit and digest-bound: [x402 specification](https://github.com/x402-foundation/x402)
- Safe guards can reject transactions before or after execution. Guard readiness must include precheck, installation, recoverability, and terminal evidence posture rather than a boolean "Safe supported" label: [Safe Guards](https://docs.safe.global/advanced/smart-account-guards)

## Step List

| Step | Status | Deliverable | Evidence | Notes |
|---|---|---|---|---|
| 01 | complete | Adapter readiness intelligence profile | `src/crypto-execution-admission/adapter-readiness-manifest.ts`, `tests/crypto-execution-admission-adapter-readiness-manifest.test.ts`, `tests/crypto-execution-admission-platform-surface.test.ts`, `tests/crypto-intelligence-platform-surface.test.ts`, `tests/crypto-authorization-core-intelligence-privacy-minimization.test.ts`, `scripts/probe-crypto-intelligence-package-surface.mjs` | Adds deterministic posture, readiness score, risk-factor, next-action, standards-coverage, attention-item, and digest-first privacy flags above the existing adapter readiness manifest. |
| 02 | pending | Pack-specific decision logic | pending | Deepen finance and crypto pack-specific interpretation while preserving the shared `admit` / `narrow` / `review` / `block` contract. |
| 03 | pending | Policy intelligence deepening II | pending | Add stronger conflict resolution, stale-policy routing, and review routing on top of policy coverage profiles. |
| 04 | pending | Proof console and dashboard hardening | pending | Improve priority ordering, top blockers, missing evidence, and readiness heatmap surfaces without raw payload drilldown. |
| 05 | pending | Runtime performance and efficiency | pending | Tighten hot-path budgets, canonicalization/hash costs, memoization boundaries, and benchmark regressions. |
| 06 | pending | Package surface consistency | pending | Strengthen public subpaths, descriptor drift checks, and deep-import probes across pack surfaces. |
| 07 | pending | Privacy and data-minimization enforcement II | pending | Add extra regression coverage against raw prompt, raw payload, provider body, idempotency, threshold, recipient, route, and customer leakage. |
| 08 | pending | Dependency risk cleanup | pending | Validate the `@noble/hashes` major bump separately before merge; do not blind-merge runtime crypto dependency changes. |
| 09 | pending | Node 26 runtime validation | pending | Validate the Docker Node 26 path against build, runtime, and native dependency edges before accepting the runtime image bump. |
| 10 | blocked | Production rollout readiness | live infra funding / GCP or equivalent deployment target | Live Stripe is configured, but full production rollout still requires deployment env update, restart, readiness probe, and smoke tests on working production infrastructure. |

## Current Posture

Step 01 is implemented in code as a reusable package surface, not just documentation. The remaining steps are intentionally scoped follow-up PRs.
