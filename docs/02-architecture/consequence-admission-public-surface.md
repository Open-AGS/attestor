# Consequence Admission Public Surface

This is a maintainer map for the broad `attestor` and
`attestor/consequence-admission` package surfaces.

It is a reference document, not a new API, not a deprecation notice, not a
runtime route, and not production proof.

## Source Anchors

- Node package `exports` define which package subpaths are importable and keep
  non-exported subpaths outside the normal package contract:
  <https://nodejs.org/api/packages.html#exports>
- npm package scripts run from the package root, so package-surface tests can
  rely on root-relative paths:
  <https://docs.npmjs.com/cli/v11/using-npm/scripts/#working-directory-for-scripts>
- Diataxis describes reference material as structured, factual machinery
  description:
  <https://diataxis.fr/reference/>

These anchors guide the shape of this page only. They do not certify Attestor.

## Current Shape

Current source state:

```text
src/consequence-admission/index.ts
  index export lines: 98
  index direct export declarations: 97
  trailing delegation: export * from './public-surface.js'

src/consequence-admission/public-surface.ts
  public-surface module re-exports: 186
  implementation logic: none
```

Current package import paths:

| Public import path | Status | What it means |
|---|---|---|
| `attestor` | `stable-public` | Main consequence admission package entry point. |
| `attestor/consequence-admission` | `compatibility-public` | Compatibility package subpath for the same shared admission surface. |

The package `exports` map does not expose
`attestor/consequence-admission/*` deep module paths. Internal source paths
remain implementation detail unless a future PR promotes a subpath explicitly.

## Use The Surface This Way

| Need | Start here | Notes |
|---|---|---|
| Build an admission response | `attestor` | Use the canonical `admit` / `narrow` / `review` / `block` contract. |
| Use the older documented facade path | `attestor/consequence-admission` | Still valid compatibility path; do not introduce another alias. |
| Work with release authority | `attestor/release-layer` | Release-layer contracts remain outside this surface. |
| Work with policy lifecycle | `attestor/release-policy-control-plane` | Policy authoring and activation have their own package surface. |
| Work with customer PEP / verifier code | `attestor/release-enforcement-plane` | Downstream enforcement remains customer-side until live PEP proof exists. |
| Work with programmable money preflight | `attestor/crypto-execution-admission` | No hosted crypto route is claimed. |

## Surface Categories

The current broad catalogue is intentionally grouped by role. The labels below
are navigation labels, not SemVer subpath promises.

| Category | Label | Examples | Boundary |
|---|---|---|---|
| Core admission contracts | `stable-public` | `taxonomy`, `constraint-kinds`, `policy-limits`, `pack-decision-profile`, `facade`, `finance`, `crypto` | Safe to document as the main shared admission vocabulary. |
| Enforcement and proof binding | `stable-public` | `presentation-binding`, `presentation-replay-ledger`, `downstream-enforcement-contract`, `verifier-helper`, `retry-attempt-ledger`, `tamper-evident-history` | Proof/admission contracts only; not live non-bypassability proof. |
| Guard library | `specialized-public` | `untrusted-content-authority-guard`, `approval-provenance-guard`, `tool-result-poisoning-guard`, `stale-authority-policy-guard`, `scope-explosion-guard`, `authority-creep-guard` | Guards can add hold/review/block pressure; they do not grant authority. |
| Shadow and Policy Foundry | `specialized-public` | `shadow-events`, `shadow-simulation`, `policy-discovery-candidates`, `policy-foundry-*` | Shadow/discovery material remains advisory until promotion and customer PEP evidence exist. |
| Action-surface onboarding | `specialized-public` | `action-surface-*`, `pilot-readiness-packet`, `integration-mode-readiness` | Discovery/onboarding evidence only; cannot prove production readiness. |
| Golden paths and demos | `evaluation-public` | `golden-refund-*`, `golden-data-export-*`, `golden-programmable-money-*`, `golden-paths-evaluator` | Synthetic evaluation examples; not live downstream calls. |
| Assurance and invariant work | `evaluation-public` | `invariant-*`, `assurance-*`, `promotion-gate-runner`, `decision-lineage-graph`, `runtime-monitor-skeleton` | Review pressure and research/evaluation evidence unless separately wired into a hard floor. |
| Historical compatibility | `compatibility-public` | `attestor/consequence-admission` package subpath | Keep working; do not widen it into deep source imports. |

## What This Does Not Prove

- It does not prove production readiness.
- It does not prove enterprise readiness.
- It does not prove live customer PEP no-bypass.
- It does not prove external KMS/HSM runtime signing.
- It does not prove shared replay, retry, or introspection stores in a live
  multi-instance deployment.
- It does not make package-boundary exports equivalent to hosted HTTP routes.
- It does not make synthetic golden paths equivalent to live downstream calls.

## Future Split Rule

Do not split this surface just because the file is large.

A future split is justified only when it reduces real integration confusion,
keeps backward-compatible re-exports, and adds a package-surface contract test
for every new subpath.

Safe future subpaths, if they become necessary:

```text
attestor/consequence-admission/contracts
attestor/consequence-admission/guards
attestor/consequence-admission/shadow
attestor/consequence-admission/policy-foundry
```

Those are design candidates only. They are not current public import paths.

## Nearby References

- [Repository navigator](../01-overview/repository-navigator.md)
- [Glossary](glossary.md)
- [AI Action Control Plane architecture](ai-action-control-plane-architecture.md)
- [Consequence admission quickstart](../01-overview/consequence-admission-quickstart.md)
- [OPS-170 focused sub-sweep](../audit/ops-170-consequence-admission-index-focused-sub-sweep.md)
- [OPS-171 sub-sweep queue](../audit/ops-171-consequence-admission-family-sub-sweep-queue.md)
