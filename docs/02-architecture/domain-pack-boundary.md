# Domain Pack Boundary

This document records the domain-pack boundary for Attestor's AI Action Control Plane.
It is a placement and non-claim document, not a production-readiness claim and not a
claim that a pack can approve or execute customer actions by itself.

## Contract

The machine-readable contract lives in:

```text
src/consequence-admission/domain-pack-boundary.ts
```

It is exported from `attestor/consequence-admission` as:

```text
attestor.consequence-domain-pack-boundary.v1
```

The contract keeps finance, crypto, filing, general admission, and future packs on
one shared admission core.

## What A Pack May Do

A domain pack may add:

- domain defaults
- evidence shapes
- policy templates
- adapter projections
- readiness signals
- replay examples

These are domain extensions. They help a customer wire a consequence class faster,
but they do not own the admission vocabulary or the shared failure controls.

## What A Pack Must Not Do

A domain pack must not:

- fork the `admit` / `narrow` / `review` / `block` vocabulary
- fork the failure-mode registry
- fork the control-binding contract
- fork the replay layer
- self-activate enforcement
- claim production readiness
- become a separate product identity by default

## Shared Contracts

Every pack must consume the shared contracts:

- `attestor.consequence-admission-pack-decision-profile.v1`
- `attestor.consequence-failure-mode-registry-placement.v1`
- `attestor.consequence-replay-layer-placement.v1`
- the shared `admit` / `narrow` / `review` / `block` decision vocabulary

This prevents finance, crypto, filing, and future packs from drifting into separate
decision engines.

## Current Surfaces

| Surface | Pack family | Boundary |
|---|---|---|
| `finance-admission-projection` | finance | maps native finance proof posture into shared consequence admission |
| `crypto-admission-projection` | crypto | maps programmable-money plans and adapter readiness into shared consequence admission |
| `generic-admission-projection` | general | handles unknown or emerging consequence classes without automatic pack guessing |
| `domain-registry-pack` | future | describes domain defaults and policy templates |
| `filing-adapter-pack` | future | shapes filing evidence and adapter readiness |
| `future-pack-extension` | future | reserves the same boundary for later consequence packs |

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

## Verification

Use:

```text
npm run test:domain-pack-boundary
npm run test:consequence-admission-pack-decision-profile
npm run test:consequence-admission-package-surface
```

The first test verifies the boundary contract, the architecture docs, package
script exposure, and package-surface probe alignment. The package-surface probe
runs after `npm run build`.
