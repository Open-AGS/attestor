# Assurance Case Contract

Status: I00 complete. This is a contract artifact for Runtime Intelligence
Activation v1. It is not a runtime engine, reviewer UI, policy activation
system, learned model, production readiness claim, or compliance claim.

## Decision

Attestor keeps one core consequence engine. The Assurance Case Contract adds the
canonical argument form that future learned and shadow-derived artifacts must
feed. It does not create a separate Attestor product or a second policy engine.

The contract represents an Eliminative Argumentation living assurance case:

```text
claim / strategy / evidence / context / assumption / justification
        +
rebutting / undermining / undercutting defeaters
        +
open / closed-by-evidence / closed-by-scope / residual-accepted state
        +
indefeasibility check
```

The point is simple: a candidate does not become review-ready because it has many
positive facts. It becomes review-ready only when the known ways it could be
wrong are named and closed, scoped out, or explicitly accepted as residual risk.

## Source Anchors

- GSN render view: Goal Structuring Notation Community Standard v3 / SCSC-141C.
- SACM 2.3-aligned substrate: OMG Structured Assurance Case Metamodel 2.3.
- Eliminative Argumentation: CMU/SEI-2015-TR-005.
- Assurance 2.0 defeasibility framing: Bloomfield and Rushby Assurance 2.0.
- Dynamic/living assurance case framing: ENTRUST dynamic assurance cases.
- ML assurance adaptation: University of York AMLAS.

These are source anchors, not conformance claims. The implementation is
SACM 2.3-aligned, not a SACM certification or complete SACM tool.

## Contract Surface

```text
src/consequence-admission/assurance-case-contract.ts
tests/assurance-case-contract.test.ts
```

The contract exports:

- `ASSURANCE_CASE_CONTRACT_VERSION`
- `assuranceCaseContractDescriptor()`
- `createAssuranceCaseNode()`
- `createAssuranceCaseDefeater()`
- `createAssuranceCaseTransition()`
- `createAssuranceCaseContract()`
- `evaluateAssuranceCaseIndefeasibility()`
- `evaluateAssuranceCaseModuleComposition()`
- `evaluateAssuranceCaseScopeChange()`

Every object is a deterministic value with canonical JSON and a SHA-256 digest.
The contract has no clock access outside caller-provided timestamps, no network,
no file IO, no database access, no model call, and no authority to admit or
enforce a consequence.

## Invariants

- A root claim must be a `claim` node.
- Every node and defeater is tenant-bound by digest.
- Cross-tenant nodes or defeaters are rejected.
- A defeater must attack an existing node.
- `open` defeat state cannot include closure or residual acceptance material.
- `closed-by-evidence` requires evidence, actor, and timestamp digests.
- `closed-by-scope` requires actor, timestamp, and scope reason digests.
- `residual-accepted` requires actor, timestamp, and residual reason digests.
- In-place scope broadening is rejected; a broader claim requires a new claim id.
- Module composition is indefeasible only when modules are indefeasible and
  cross-module defeaters are closed.
- The contract cannot grant authority, admit, activate enforcement, auto-enforce,
  or claim production readiness.

## How It Connects

The next Runtime Intelligence Activation steps do not produce free-floating
artifacts. They generate assurance-case material:

| Step | Role inside the assurance case |
|---|---|
| I01 learned artifact release budget | context and undermining defeaters for privacy/reconstruction risk |
| I02 shadow data quality gate | undermining defeaters against shadow evidence |
| I03 baseline cohort builder | evidence nodes for cohort claims |
| I04 candidate invariant synthesizer | claim and strategy nodes |
| I05 counterexample replay | rebutting defeaters and minimal witness evidence |
| I06 calibration lower-bound runner | evidence confidence annotations |
| I07 reviewer packet | open-defeater view |
| I08 promotion gate runner | indefeasibility predicate execution |
| I09 TLA+ trace validator bridge | formal evidence nodes |
| I10 runtime monitor skeleton | living-case update source |
| I11 decision lineage graph | signed transition lineage |
| I12 Goodhart / authority-creep guard | undercutting defeaters |
| I13 outcome feedback / COE wiring | outcome-triggered rebutting defeaters |

## Non-Claims

- `not-live-enforcement`
- `not-runtime-assurance-engine`
- `not-sacm-conformance-claim`
- `not-gsn-tooling`
- `not-formal-proof`
- `not-reviewer-ui`
- `not-learning-system`
- `not-policy-activation`
- `not-production-ready`

I00 only gives the shared argument shape. It does not prove that a candidate is
safe, does not promote learned invariants, does not run against live customers,
and does not replace deterministic Attestor gates.
