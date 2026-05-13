# AI Action Control Plane Architecture

This document records the architecture decision for Attestor's control-plane shape.
It is an engineering architecture record, not a production-readiness claim, not a
certification claim, and not proof that every customer action path is already
non-bypassable in a deployed environment.

## Decision

Attestor should be built as a:

```text
Reference-monitor-style, contract-first AI Action Control Plane
```

The implementation shape is:

```text
contract-first modular monolith with explicit package and import boundaries
```

This means the product abstraction, security abstraction, authorization
architecture, and repository shape are intentionally separate:

| Layer | Attestor decision |
| --- | --- |
| Product abstraction | AI Action Control Plane |
| Security abstraction | reference-monitor-style Consequence Admission Core |
| Authorization architecture | PDP / PEP / PIP / PAP style split |
| Implementation shape | contract-first modular monolith |

Do not shorten this to "Attestor is a reference monitor." A classical reference
monitor implies complete mediation, tamper resistance, and verifiability. Attestor
can only claim the reference-monitor-style property for a customer workflow after
that workflow has a real enforcement point, gateway, verifier, or adapter that
cannot be bypassed in the customer's target runtime.

## Why This Fits Attestor

Attestor is not only a TypeScript codebase that needs cleaner modules. Its core
problem is pre-action control:

```text
AI intent -> consequence admission -> verified enforcement -> business action
```

Better models can reduce some bad proposals, but they do not create business
authority, trusted evidence, recipient safety, tenant isolation, replay safety,
or approval provenance by themselves. Attestor needs deterministic controls that
decide when AI-generated intent is allowed to become real business consequence.

A modular monolith is still the right repository form now because the core
contracts, failure-mode controls, Policy Foundry, evidence surfaces, replay
fixtures, hosted service, and domain packs are still evolving together. Splitting
them into distributed services now would add networking, deployment, tracing,
schema-versioning, and operational complexity before the internal contracts are
stable enough to extract.

## Research Anchors

These are engineering anchors. They do not certify Attestor.

- NIST reference monitor glossary: complete mediation, tamper resistance, and
  verifiability are the standard properties that make "reference monitor" a
  high bar.
- NIST SP 800-162 ABAC: separates policy decision, enforcement, information, and
  administration responsibilities.
- Kubernetes admission control: evaluates requests before persistent state or
  downstream mutation is allowed.
- Open Policy Agent: separates structured policy decisions from application
  enforcement.
- Envoy external authorization: uses a gateway enforcement point to block a
  request before it reaches upstream systems.
- AWS Verified Permissions / Cedar: uses schema and policy validation instead of
  relying on free-form natural language as policy.
- Zanzibar / OpenFGA-style authorization modeling: keeps authority and
  relationship context explicit rather than implied by a model output.
- NCSC and Microsoft prompt-injection guidance: untrusted content cannot be
  treated as an instruction or authorization source.
- Node package `exports`: explicit subpath exports are part of the package
  boundary posture.
- ESLint restricted-import and similar dependency-boundary rules: architecture
  boundaries should be testable, not only documented.

## Control-Plane Roles

| Role | Attestor meaning | Current repository home |
| --- | --- | --- |
| PDP | Policy Decision Point: produces `admit`, `narrow`, `review`, or `block` from structured action intent, policy, evidence, authority, scope, and failure-mode controls. | `src/consequence-admission`, `src/release-kernel`, `src/release-layer` |
| PEP | Policy Enforcement Point: catches an intended action before downstream execution and fails closed when proof, binding, replay, or decision checks fail. | `src/release-enforcement-plane`, verifier helper, adapter framework, customer-side gateways |
| PIP | Policy Information Point: supplies evidence, authority, tenant, recipient, no-go, freshness, policy-version, and context facts. | evidence, authority, storage, tenant, signing, and service runtime contracts |
| PAP | Policy Administration Point: owns policy lifecycle, simulation, rollout, candidate review, drift, and activation. | `src/release-policy-control-plane`, Policy Foundry surfaces |
| Audit proof | Records why the decision happened, what evidence was used, which limitations remain, and what was presented downstream. | audit evidence export, tamper-evident history, presentation replay ledger, execution receipt |
| Replay | Proves dangerous action patterns are detected before business consequence. | failure-mode replay fixtures and Policy Foundry red-team replay |
| Packs | Add domain defaults, evidence shapes, templates, adapters, and replay examples without owning a separate decision engine. | finance, crypto, filing, and future consequence packs |
| Hosted service | Composes routes, account state, billing, storage, and runtime wiring without becoming the authority model. | `src/service` |

The machine-readable naming contract for these roles lives in
`src/consequence-admission/control-plane-roles.ts`. It is exported from
`attestor/consequence-admission` so docs, package consumers, and tests refer to
the same role names and boundary prohibitions.

## Boundary Rules

These rules are the architecture target for future boundary tests.

1. `src/platform` may contain only domain-neutral primitives. It must not import
   `src/service`, packs, release planes, crypto, filing, or financial modules.
2. `src/service` is a composition root. Domain modules must not import hosted
   service internals.
3. The Consequence Admission Core must not depend on hosted billing, HTTP route
   wiring, customer session state, or deployment-specific runtime details.
4. PEP/verifier code may call PDP contracts, but PDP code must not call a
   concrete downstream executor.
5. PIP code may provide evidence, authority, tenant, recipient, and no-go facts;
   it must not silently approve an action.
6. PAP/Policy Foundry may propose, simulate, score, and prepare review material;
   it must not auto-enforce a policy candidate.
7. Packs may provide domain templates, evidence defaults, adapters, and replay
   fixtures; packs must not fork the admission decision vocabulary.
8. Failure-mode registry, control binding, and replay targets belong to the
   shared control layer, not to individual packs or hosted service routes.
9. Public/package entrypoints should be explicit. Deep imports across bounded
   contexts should be treated as architecture debt unless a tracker explicitly
   allows them.
10. Documentation must distinguish repository evidence, evaluation readiness,
    customer-operated deployment proof, and production readiness.

## Reference-Monitor-Style Invariants

These invariants define the direction. A workflow can only claim this posture when
its PEP integration is actually present and tested.

| Invariant | Default when violated |
| --- | --- |
| Untrusted content cannot authorize action. | `review` or `block` |
| Model confidence cannot replace business authority. | `review` |
| Requested scope cannot exceed approved scope. | `narrow`, `review`, or `block` |
| High-impact actions require verified authority and evidence. | `review` or `block` |
| Tenant and recipient boundaries cannot be inferred from natural language. | `block` |
| Missing evidence cannot silently become approval. | `review` or `block` |
| Stale policy, stale approval, and stale no-go state require re-evaluation. | `review` or `block` |
| Non-idempotent or irreversible actions require replay protection and stronger proof. | `block` |
| Every accepted action must produce audit proof sufficient for later review. | `review` |
| Proposer, approver, executor, and auditor roles should remain separable. | `review` |

## Repository Shape

The long-term shape should stay modular without turning into either a generic
`utils` pile or a premature microservice graph.

```text
src/platform
  domain-neutral primitives

src/consequence-admission
  admission facade, failure modes, control binding, Policy Foundry contracts

src/release-kernel
src/release-layer
src/release-policy-control-plane
src/release-enforcement-plane
  release decision, policy lifecycle, and enforcement verification planes

src/evidence or existing evidence surfaces
  evidence, trusted-source, proof, and export contracts as they harden

src/authority or existing authority surfaces
  authority, approval provenance, tenant, recipient, and no-go state contracts

src/financial
src/filing
src/crypto-authorization-core
src/crypto-execution-admission
  domain packs and adapters

src/service
  hosted service composition root
```

New top-level directories should be added only when a repeated boundary is
already proven by code, tests, and docs. Until then, prefer narrow extraction
inside the existing bounded context.

## First Refactor Proof

The completed trailing-slash normalizer cleanup is the first small platform
primitive extraction:

- create a domain-neutral deterministic helper under `src/platform`
- replace repeated regex-based trailing slash trimming with that helper
- keep domain-specific wrappers such as issuer or endpoint normalization in their
  own modules
- add regression tests for long slash input and slash-only input
- do not turn `src/platform` into a broad utility dumping ground

This is intentionally small. It proves the boundary discipline before larger
Policy Foundry, failure-mode, replay, or authority graph refactors continue.

## Non-Claims

- This document does not claim Attestor is production-ready.
- This document does not claim every customer action path is non-bypassable.
- This document does not claim external standards certify Attestor.
- This document does not require a microservice split.
- This document does not allow packs to become separate products.
- This document does not allow Policy Foundry or an LLM to auto-enforce policy
  candidates without verified approval, evidence, simulation, and rollout gates.

## Next Steps

1. Keep the boundary guard test green for the architecture rules that can be
   checked from repository imports: `npm run test:architecture-boundary-imports`.
2. Keep the deterministic trailing-slash platform primitive covered by
   `npm run test:platform-string-normalization`.
3. Keep README and `system-overview.md` aligned with this architecture without
   expanding public readiness claims.
4. Continue naming alignment only where it clarifies PDP, PEP, PIP, PAP,
   failure-registry, replay, pack, or hosted-service boundaries; do not perform
   broad renames without a local boundary test.
5. Place failure-mode registry, control binding, and replay work in the shared
   control layer unless a tracker proves that a pack-specific extension is the
   safer boundary.
