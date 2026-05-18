# Consequence Runtime Assurance Overview

Status: saved design and sequencing target for the post-master-plan Attestor
authority layer. This is not a production claim, not a compliance claim, not a
deployed capability, and not a replacement for the completed
[Unified Shadow-To-Policy Master Plan](unified-shadow-to-policy-master-plan.md).

## Decision

Attestor stays one consequence control engine:

```text
AI-proposed consequence
  -> consequence envelope
  -> hard authority gates
  -> typed signals
  -> signal relationship fabric
  -> relationship-aware hazard fusion
  -> conflict / abstention / human comprehension gates
  -> signed assurance packet
  -> outcome and incident feedback
  -> assurance measurement plane
```

Finance, crypto, support, workflow, data, IAM, procurement, health, and
insurance remain domain packs and adapter projections into the same engine.
They must not become separate products or separate decision engines.

The north star is:

```text
AI Consequence Runtime Assurance System
```

Attestor should not become an "AI governance dashboard." It should be the
runtime assurance layer that controls whether an AI-proposed action may cross
from intent into real-world consequence.

## Why This Exists

The completed Shadow-to-Policy sequence gave Attestor:

```text
shadow capture
  -> action surface graph
  -> evidence state model
  -> policy candidate PR
  -> active question engine
  -> counterexample replay
  -> policy twin backtest
  -> review-by-exception
  -> approval / dismiss feedback
  -> pilot readiness packet
```

That sequence observes actions and turns them into reviewable policy material.
The next problem is different: the system needs an explicit internal contract
for how policy, evidence, authority, anomaly, trajectory, coverage, review, and
incident signals relate before a final decision is emitted.

The missing primitive is:

```text
Signal Relationship Fabric
```

It is not a model and not a second policy engine. It is the typed relationship
contract that explains when signals confirm, contradict, duplicate, override,
depend on, modulate, escalate, suppress, or force review.

## Runtime Shape

```text
[ Consequence Envelope ]
        |
[ Tier 1 Hard Gates ]
        |
[ Typed Signals ]
        |
[ Signal Relationship Fabric ]
        |
[ Relationship-Aware Hazard Fusion ]
        |
[ Conflict / Abstention Gate ]
        |
[ Human Comprehension Gate ]
        |
[ Signed Assurance Packet ]
        |
ADMIT | NARROW | REVIEW | BLOCK
        |
[ Outcome + Incident Feedback ]
        |
[ Safety / Review Budget Accounting ]
        |
[ Assurance Measurement Plane ]
        |
operator dashboard, alerts, and regression evidence
```

The audit plane is the proof source. The measurement plane is a read-only
observer over audit, outcome, replay, review, and incident evidence. It cannot
grant authority, mutate policy, write audit history, or make a decision safer.

## Consequence Envelope

The consequence envelope is the canonical input to the fabric. It must be
typed before any relationship-aware fusion runs.

Minimum contract fields:

```text
canonicalActionType
reversibilityClass          reversible | bounded | irreversible
blastRadiusEstimate         single | tenant | cross-tenant | systemic
tenantContext               tenant digest, maturity class, history depth
actorContext                actor digest, role/authority class
timingContext               request time, freshness window, deadline posture
priorChain                  related request/event digests
evidenceRefs                digest-only evidence refs
policyScope                 policy bundle/scope digests
targetSystemRef             digest-only downstream system ref
rawMaterialPolicy           digest-only | redacted-summary
```

No raw prompt, raw tool payload, raw provider body, customer identifier,
tenant identifier, wallet material, payment detail, downstream response body,
or private threshold belongs in the envelope.

## Signal Contract

Signals are not a flat enum. They have categories because different signal
families have different fusion rules.

```text
SignalCategory
  verdict
  observation
  gap
  boundary
  context
  measurement
```

Initial `SignalKind` values:

```text
verdict:
  hard_floor
  hazard
  abstention

observation:
  anomaly
  prediction
  confirmation
  contradiction

gap:
  evidence_gap
  authority_gap
  policy_gap
  freshness_gap

boundary:
  tenant_boundary_signal
  blast_radius_signal

context:
  reversibility_context
  maturity_context
  coverage_context

measurement:
  drift_signal
  regression_signal
  budget_pressure_signal
  measurement_degraded_signal
```

The contract should record what each signal can know, what it cannot know, what
evidence it read, which domain it applies to, and whether it is advisory or a
hard floor.

## Relationship Contract

Relationship direction is part of the type.

| Relationship | Shape | Meaning |
|---|---|---|
| `confirms` | symmetric | Two signals independently support the same hazard or gap. |
| `contradicts` | symmetric | Two signals disagree enough to raise conflict. |
| `duplicates` | symmetric | Signals share evidence or learned correlation and must be discounted. |
| `overrides` | directed | One signal has higher authority; formal/hard evidence can override advisory hypotheses. |
| `depends_on` | directed | One signal is only meaningful when another input exists. |
| `modulates` | directed | Context changes threshold, severity, or interpretation. |
| `escalates` | directed | A signal moves another signal toward a stricter action. |
| `suppresses` | directed | A higher-trust signal reduces the effect of a lower-trust signal. |
| `requires_review` | unary | A single signal is enough to force review. |

Examples:

```text
formal_deny overrides shadow_no_objection
irreversible_consequence modulates all advisory thresholds
local_anomaly confirms temporal_escalation
same_evidence_digest duplicates two advisory witnesses
low_shadow_coverage requires_review
tenant_boundary_signal escalates policy_gap
```

## Authority Planes

The architecture separates authority:

```text
decision authority      -> hard gates + approved policy + allowed review path
relationship authority  -> fabric contract and interaction rules
measurement authority   -> read-only quality and drift observation
audit authority         -> tamper-evident evidence and receipt history
```

The measurement plane never writes to the audit plane. Measurement output can
raise operator tasks, regression blockers, or degraded-state flags, but it
cannot admit, narrow, block, approve, or activate policy.

## Human Comprehension Gate

Review surfaces must be bounded. A review item should show the smallest
explanation that lets a human act:

```text
max 7 reason lines
max 3 primary questions
explicit missing evidence
explicit consequence if approved
explicit escalation path
```

If review load or review speed degrades beyond the configured budget, the
system should raise `budget_pressure_signal` or `measurement_degraded_signal`
instead of silently reducing review quality.

## Outcome And Incident Path

The happy path is not enough:

```text
admitted -> executed -> receipted -> learned
```

The incident path is first-class:

```text
admitted
  -> executed
  -> contested
  -> reversed
  -> incident
  -> postmortem
  -> learned
```

Outcome feedback must record whether the input was a downstream receipt,
reviewer label, confirmed incident, operator annotation, or inferred signal.
These evidence sources are not equivalent and must not be collapsed into one
"ground truth" field.

## Assurance Measurement Plane

The measurement plane answers:

```text
Is the decision system itself working?
```

Initial metrics:

```text
false review rate
false admit risk count
abstention rate
review load
duplicate-evidence discount rate
conflict-trigger rate
policy gap closure rate
time to human decision
drift signal rate
regression replay pass/fail
budget pressure rate
measurement degraded time
```

Goodhart protection is required: measurement metrics are not direct gradient
sources for policy relaxation. They inform regression tests, operator tasks,
and budget planning. They do not silently tune enforcement.

## Budget And Degraded Modes

Safety and review budgets must be scoped:

```text
tenant
consequence class
actor class
target system
time window
```

A global review cap is unsafe. Budget exhaustion must not fall open. It should
produce an explicit overflow condition, wake the responsible operator path, and
preserve fail-closed or review-required behavior for high-consequence classes.

If the measurement plane fails, the fabric continues to evaluate decisions, but
assurance packets and review surfaces must carry:

```text
measurement-degraded
```

The failure is visible, not silent.

## Relationship To Policy Foundry

The fabric strengthens shadow mode and Policy Foundry. It turns shadow traffic
from raw observed action events into typed signals and typed relationships:

```text
shadow event
  -> consequence envelope
  -> signal extraction
  -> relationship activation
  -> policy candidate evidence
  -> active question
  -> counterexample replay
  -> policy twin backtest
  -> review-by-exception
```

Foundry should learn candidate material only through this review path. It must
not silently activate policy, mutate enforcement, or treat measurement metrics
as approval.

## Implementation Sequence

This starts a new scoped tracker after the completed 26-step
Shadow-to-Policy master plan.

| Step | Status | Work item | Required evidence | No-go boundary |
|---|---|---|---|---|
| 00 | saved in this doc | Cross-domain research annex | Source matrix covering STPA, FMEA, fault tree, runtime assurance, NIST AI RMF, SRE, OWASP Agentic AI, causal/dependency modeling, and system dynamics. | Do not treat analogies as production proof. |
| 01 | complete | Consequence Envelope Contract | `src/consequence-admission/consequence-envelope-contract.ts`, [Consequence Envelope Contract](consequence-envelope-contract.md), `tests/consequence-envelope-contract.test.ts`, package script, digest-only field rules, required context fields, and no-authority invariants. | Do not run relationship/fusion on untyped action input. |
| 02 | complete | Signal Relationship Contract | `src/consequence-admission/signal-relationship-contract.ts`, [Signal Relationship Contract](signal-relationship-contract.md), `tests/signal-relationship-contract.test.ts`, package script, category-bound `SignalKind`, directed/symmetric/unary relationship types, monotone interaction rule shape, and no-authority invariants. | Do not use a flat signal enum or directionless relationships. |
| 03 | complete | LayerOpinion schema | `src/consequence-admission/layer-opinion-schema.ts`, [LayerOpinion Schema](layer-opinion-schema.md), `tests/layer-opinion-schema.test.ts`, package script, advisory-only positions, uncertainty, source-dependence, abstention, belief mass, and no-loosening invariants. | Do not let advisory output grant authority. |
| 04 | complete | Modulator authority tier | `src/consequence-admission/modulator-authority-tier.ts`, [Modulator Authority Tier](modulator-authority-tier.md), `tests/modulator-authority-tier.test.ts`, package script, context-only dimensions for reversibility, blast radius, tenant maturity, coverage, and freshness, and hard-floor preservation invariants. | Do not let context modulators override hard denies. |
| 05 | complete | Relationship-aware monotone fusion | `src/consequence-admission/relationship-aware-monotone-fusion.ts`, [Relationship-Aware Monotone Fusion](relationship-aware-monotone-fusion.md), `tests/relationship-aware-monotone-fusion.test.ts`, package script, duplicate discount, confirmation boost, hard-floor preservation, monotone risk aggregation, and property-style no-loosening tests. | Do not average away strong hazards or count duplicate evidence twice. |
| 06 | complete | Conflict and abstention gate | `src/consequence-admission/conflict-abstention-gate.ts`, [Conflict And Abstention Gate](conflict-abstention-gate.md), `tests/conflict-abstention-gate.test.ts`, package script, review/block-pressure/abstain-hold outcomes for high conflict, low coverage, high uncertainty, and weighted abstention, and no-admit invariant tests. | Do not turn uncertainty into admit. |
| 07 | complete | Human comprehension gate | `src/consequence-admission/human-comprehension-gate.ts`, [Human Comprehension Gate](human-comprehension-gate.md), `tests/human-comprehension-gate.test.ts`, package script, max-7 reason-line limit, default max-3 active-question cap, escalation posture, review-load visibility, and no-admit invariant tests. | Do not create a noisy dashboard that shifts work to humans. |
| 08 | complete | Signed assurance packet | `src/consequence-admission/signed-assurance-packet.ts`, [Signed Assurance Packet](signed-assurance-packet.md), `tests/signed-assurance-packet.test.ts`, package script, digest-only refs, tamper-history binding, optional signature record, production-boundary downgrade, and no-authority invariant tests. | Do not store raw payloads, claim external immutability, or turn packet signing into execution authority. |
| 09 | complete | Outcome and incident feedback contract | `src/consequence-admission/outcome-incident-feedback-contract.ts`, [Outcome And Incident Feedback Contract](outcome-incident-feedback-contract.md), `tests/outcome-incident-feedback-contract.test.ts`, package script, separated source classes, incident path states, blocked mutation requests, replay regression triggers, and no-authority invariant tests. | Do not retrain, activate, or mutate policy directly from feedback. |
| 10 | complete | Assurance measurement plane | `src/consequence-admission/assurance-measurement-plane.ts`, [Assurance Measurement Plane](assurance-measurement-plane.md), `tests/assurance-measurement-plane.test.ts`, package script, read-only metrics, CUSUM-style drift reporting, replay regression reporting, scoped budget accounting, degraded-state visibility, dashboard contract, Goodhart boundary, and no-authority invariant tests. | Do not let measurement output become decision authority. |

## First Code PR Scope

The first implementation slice is complete as the consequence envelope
contract:

```text
src/consequence-admission/consequence-envelope-contract.ts
tests/consequence-envelope-contract.test.ts
docs/02-architecture/consequence-envelope-contract.md
```

Allowed in the completed Step 01 slice:

```text
types only
descriptors
contract invariant tests
package export wiring
```

Not allowed in Step 01:

```text
runtime behavior
fusion math
learning
policy activation
measurement feedback
downstream calls
new production dependency
```

The second implementation slice is complete as the signal relationship
contract:

```text
src/consequence-admission/signal-relationship-contract.ts
tests/signal-relationship-contract.test.ts
docs/02-architecture/signal-relationship-contract.md
```

Allowed in the completed Step 02 slice:

```text
types only
descriptors
category-bound signal kind tests
relationship directionality tests
monotone interaction rule invariant tests
package export wiring
```

Not allowed in Step 02:

```text
runtime behavior
fusion math
learning
policy activation
measurement feedback
downstream calls
new production dependency
```

The third implementation slice is complete as the LayerOpinion schema:

```text
src/consequence-admission/layer-opinion-schema.ts
tests/layer-opinion-schema.test.ts
docs/02-architecture/layer-opinion-schema.md
```

Allowed in the completed Step 03 slice:

```text
types only
descriptors
advisory-only position tests
uncertainty and abstention tests
source-dependence tests
no-loosening invariant tests
package export wiring
```

Not allowed in Step 03:

```text
runtime behavior
fusion math
learning
policy activation
measurement feedback
downstream calls
new production dependency
```

The fourth implementation slice is complete as the Modulator authority tier:

```text
src/consequence-admission/modulator-authority-tier.ts
tests/modulator-authority-tier.test.ts
docs/02-architecture/modulator-authority-tier.md
```

Allowed in the completed Step 04 slice:

```text
types only
descriptors
context-only dimension tests
hard-floor preservation tests
no-loosening invariant tests
package export wiring
```

Not allowed in Step 04:

```text
runtime behavior
fusion math
learning
policy activation
measurement feedback
downstream calls
new production dependency
```

The fifth implementation slice is complete as relationship-aware monotone
fusion:

```text
src/consequence-admission/relationship-aware-monotone-fusion.ts
tests/relationship-aware-monotone-fusion.test.ts
docs/02-architecture/relationship-aware-monotone-fusion.md
```

Allowed in the completed Step 05 slice:

```text
pure deterministic fusion function
descriptors
duplicate-discount tests
confirmation/conflict/review pressure tests
hard-floor preservation tests
no-authority invariant tests
package export wiring
```

Not allowed in Step 05:

```text
learning
policy activation
runtime enforcement
downstream calls
new production dependency
calibrated production scoring claim
```

The sixth implementation slice is complete as the Conflict and abstention gate:

```text
src/consequence-admission/conflict-abstention-gate.ts
tests/conflict-abstention-gate.test.ts
docs/02-architecture/conflict-abstention-gate.md
```

Allowed in the completed Step 06 slice:

```text
pure deterministic gate function
descriptors
conflict pressure tests
weighted abstention tests
coverage and uncertainty tests
fusion block-pressure preservation tests
no-admit invariant tests
package export wiring
```

Not allowed in Step 06:

```text
admit decisions
policy activation
runtime enforcement
learning
downstream calls
new production dependency
calibrated probability or conformal validity claim
```

The seventh implementation slice is complete as the Human comprehension gate:

```text
src/consequence-admission/human-comprehension-gate.ts
tests/human-comprehension-gate.test.ts
docs/02-architecture/human-comprehension-gate.md
```

Allowed in the completed Step 07 slice:

```text
pure deterministic handoff function
descriptors
max-7 reason-line tests
default max-3 active-question cap tests
review-load visibility tests
escalation posture tests
no-admit invariant tests
package export wiring
```

Not allowed in Step 07:

```text
review UI
admit decisions
policy activation
runtime enforcement
learning
downstream calls
new production dependency
human-factors certification claim
```

The eighth implementation slice is complete as the Signed assurance packet:

```text
src/consequence-admission/signed-assurance-packet.ts
tests/signed-assurance-packet.test.ts
docs/02-architecture/signed-assurance-packet.md
```

Allowed in the completed Step 08 slice:

```text
pure deterministic packet builder
descriptors
digest-only ref tests
tamper-history binding tests
signature payload digest tests
production-boundary downgrade tests
no-authority invariant tests
package export wiring
```

Not allowed in Step 08:

```text
live signing service
admit decisions
policy activation
runtime enforcement
learning
downstream calls
new production dependency
external immutability claim
JWS, JWT, DSSE, in-toto, or NIST conformance claim
```

The ninth implementation slice is complete as the Outcome and incident feedback
contract:

```text
src/consequence-admission/outcome-incident-feedback-contract.ts
tests/outcome-incident-feedback-contract.test.ts
docs/02-architecture/outcome-incident-feedback-contract.md
```

Allowed in the completed Step 09 slice:

```text
pure deterministic feedback builder
descriptors
source-class separation tests
incident path tests
replay regression trigger tests
blocked mutation request tests
no-authority invariant tests
package export wiring
```

Not allowed in Step 09:

```text
learning system
admit decisions
policy activation
runtime enforcement
model training
automatic score or calibration mutation
downstream calls
new production dependency
incident-response completion claim
NIST SP 800-61 or NIST AI RMF conformance claim
```

The tenth implementation slice is complete as the Assurance measurement plane:

```text
src/consequence-admission/assurance-measurement-plane.ts
tests/assurance-measurement-plane.test.ts
docs/02-architecture/assurance-measurement-plane.md
```

Allowed in the completed Step 10 slice:

```text
pure deterministic measurement builder
descriptors
read-only metric tests
CUSUM-style drift signal tests
replay regression reporting tests
scoped budget pressure tests
degraded-state visibility tests
Goodhart boundary tests
no-authority invariant tests
package export wiring
```

Not allowed in Step 10:

```text
decision authority
audit-plane writes
policy relaxation
policy activation
runtime enforcement
learning
model training
automatic score or calibration mutation
downstream calls
new production dependency
production monitoring readiness claim
NIST AI RMF, SRE, or statistical conformance claim
```

## Runtime Assurance Wiring V1

The completed Step 00-10 contract stack defines the language. Runtime
Assurance Wiring v1 connects that language to canonical shadow events without
creating live enforcement.

| Step | Status | Work item | Required evidence | No-go boundary |
|---|---|---|---|---|
| W01 | complete | Shadow Envelope Projector | `src/consequence-admission/shadow-envelope-projector.ts`, [Shadow Envelope Projector](shadow-envelope-projector.md), `tests/shadow-envelope-projector.test.ts`, package script, package-surface probe, deterministic source-event-to-envelope projection, tenant binding, redaction preservation, idempotency digest, and no-authority invariants. | Do not extract signals, detect relationships, run fusion, sign packets, activate enforcement, learn, or grant authority. |
| W02 | complete | Signal Extractor Contract | `src/consequence-admission/signal-extractor-contract.ts`, [Signal Extractor Contract](signal-extractor-contract.md), `tests/signal-extractor-contract.test.ts`, package script, package-surface probe, category-bound extractor declarations, digest-only signal batches, source-plane preservation, authority-mode preservation, and no-authority invariants. | Do not let an extractor upgrade advisory evidence into hard authority. |
| W03 | complete | Existing Checks To Signal Adapter Registry | `src/consequence-admission/signal-adapter-registry.ts`, [Signal Adapter Registry](signal-adapter-registry.md), `tests/signal-adapter-registry.test.ts`, package script, package-surface probe, complete coverage for the six `CONSEQUENCE_ADMISSION_CHECK_KINDS`, pass-outcome exclusion, duplicate-evidence dedupe keys, and no-authority invariants. | Do not double-count duplicate evidence. |
| W04 | complete | Relationship Detector Contract | `src/consequence-admission/relationship-detector-contract.ts`, [Relationship Detector Contract](relationship-detector-contract.md), `tests/relationship-detector-contract.test.ts`, package script, package-surface probe, deterministic rule-based relationship detection, same-envelope boundary, duplicate/conflict/directed/unary relationship output, interaction-rule output, and no-authority invariants. | Do not add learned relationship inference, correlation learning, fusion, packet signing, live enforcement, or authority upgrade in v1. |
| W05 | complete | Shadow Runtime Pipeline Dry Run | `src/consequence-admission/shadow-runtime-pipeline.ts`, [Shadow Runtime Pipeline](shadow-runtime-pipeline.md), `tests/shadow-runtime-pipeline.test.ts`, package script, package-surface probe, shadow-only event -> envelope -> signals -> relationships -> fusion -> conflict gate -> human gate -> unsigned packet path, bounded review output, and no-authority invariants. | Do not emit live enforcement decisions, sign production packets, activate policy, call downstream systems, learn, aggregate cross-tenant data, or claim production readiness. |
| W06 | complete | Decision Trace Logger | `src/consequence-admission/decision-trace-logger.ts`, [Decision Trace Logger](decision-trace-logger.md), `tests/decision-trace-logger.test.ts`, package script, package-surface probe, digest-only eight-phase decision trace, linear hash chain, TTL-bound verification, replay rejection, and no-authority invariants. | Do not store raw payloads, write the audit plane, claim production log integrity, activate policy, sign packets, or claim formal verification. |
| W07 | complete | TLA+ Admission State Machine Skeleton | `specs/admission-state-machine.tla`, `specs/MCAdmission.cfg`, [Admission State Machine Spec](admission-state-machine-spec.md), `tests/admission-state-machine-spec.test.ts`, package script, manual design-first state machine, and seven named initial safety invariants. | Do not claim formal verification of the TypeScript implementation, generated-code equivalence, production certification, or model-checker execution in CI. |
| W08 | complete | Alloy Tenant Isolation Model | `specs/tenant-isolation.als`, [Tenant Isolation Model](tenant-isolation-model.md), `tests/tenant-isolation-model.test.ts`, package script, manual small-scope relation model, tenant-owned envelope/trace/signal/packet/review/decision relations, and seven non-interference assertions. | Do not mix behavior/state-machine proof with tenant relation proof, claim Alloy Analyzer execution in CI, replace runtime PEP/RLS enforcement, or claim production isolation certification. |
| W09 | complete | Baseline Cohort Contract | `src/consequence-admission/baseline-cohort-contract.ts`, [Baseline Cohort Contract](baseline-cohort-contract.md), `docs/02-architecture/baseline-cohort-contract.md`, `tests/baseline-cohort-contract.test.ts`, package script, package-surface probe, tenant-local digest-only cohort source shape, blocked-traffic exclusion, reviewer-affirmed promotion gate, no-relaxation boundary, and no-authority invariants. | Do not learn from blocked traffic, auto-promote invariants, relax policy, aggregate cross-tenant data, train a model, activate enforcement, or claim production readiness. |
| W10 | complete | Candidate Invariants Catalog | `src/consequence-admission/candidate-invariants-catalog.ts`, [Candidate Invariants Catalog](candidate-invariants-catalog.md), `docs/02-architecture/candidate-invariants-catalog.md`, `tests/candidate-invariants-catalog.test.ts`, package script, package-surface probe, safe invariant candidate taxonomy, property template kinds, danger flags, frequency-only rejection, counterexample replay requirement, reviewer requirement, and no-authority invariants. | Do not encode "frequent means safe", mine invariants, auto-promote learned invariants, relax controls, train a model, activate enforcement, or claim production readiness. |
| W11 | complete | Invariant Calibration Contract | `src/consequence-admission/invariant-calibration-contract.ts`, [Invariant Calibration Contract](invariant-calibration-contract.md), `docs/02-architecture/invariant-calibration-contract.md`, `tests/invariant-calibration-contract.test.ts`, package script, package-surface probe, calibration method vocabulary, holdout/calibration set digest binding, isotonic sample floor, confidence cap below single-signal block reference, metric threshold holds, reviewer requirement, and no-authority invariants. | Do not let raw classifier scores or calibrated confidence become authority, train a calibrator, promote an invariant, auto-relax controls, activate enforcement, or claim production readiness. |
| W12 | complete | Invariant Promotion Gate | `src/consequence-admission/invariant-promotion-gate.ts`, [Invariant Promotion Gate](invariant-promotion-gate.md), `docs/02-architecture/invariant-promotion-gate.md`, `tests/invariant-promotion-gate.test.ts`, package script, package-surface probe, W10/W11 binding, independent reviewer signoff, policy patch digest requirement, rollout and rollback plan digest requirements, no-relaxation rejection, auto-promotion rejection, live-enforcement rejection, and no-authority invariants. | Do not auto-promote, auto-relax, activate learned policy, mutate policy directly, bypass independent reviewer signoff, skip rollback/rollout evidence, or claim production readiness. |

The first wiring slice is complete as the Shadow Envelope Projector:

```text
src/consequence-admission/shadow-envelope-projector.ts
tests/shadow-envelope-projector.test.ts
docs/02-architecture/shadow-envelope-projector.md
```

Allowed in the completed W01 slice:

```text
pure deterministic projection builder
descriptors
source-event digest binding tests
tenant-binding tests
redaction-preservation tests
idempotency digest tests
no-mutation tests
no-authority invariant tests
package export wiring
```

Not allowed in W01:

```text
signal extraction
relationship detection
fusion
packet signing
live enforcement
learning
new production dependency
runtime deployment readiness claim
```

The second wiring slice is complete as the Signal Extractor Contract:

```text
src/consequence-admission/signal-extractor-contract.ts
tests/signal-extractor-contract.test.ts
docs/02-architecture/signal-extractor-contract.md
```

Allowed in the completed W02 slice:

```text
category-bound extractor declarations
signals-only extraction batches
source-plane tag preservation tests
authority-mode preservation tests
digest-only evidence ref tests
advisory-cannot-emit-hard-floor tests
no-authority invariant tests
package export wiring
```

Not allowed in W02:

```text
adapter registry
relationship detection
fusion
packet signing
live enforcement
learning
raw payload access
new production dependency
runtime deployment readiness claim
```

The third wiring slice is complete as the Signal Adapter Registry:

```text
src/consequence-admission/signal-adapter-registry.ts
tests/signal-adapter-registry.test.ts
docs/02-architecture/signal-adapter-registry.md
```

Allowed in the completed W03 slice:

```text
built-in registrations for existing admission checks
source-check coverage tests
check-to-signal mapping tests
pass-outcome exclusion tests
duplicate-evidence registry tests
no-authority invariant tests
package export wiring
```

Not allowed in W03:

```text
runtime adaptation
relationship detection
fusion
packet signing
live enforcement
learning
pass-to-safe signal generation
new production dependency
runtime deployment readiness claim
```

The fourth wiring slice is complete as the Relationship Detector Contract:

```text
src/consequence-admission/relationship-detector-contract.ts
tests/relationship-detector-contract.test.ts
docs/02-architecture/relationship-detector-contract.md
```

Allowed in the completed W04 slice:

```text
rule-based relationship detector descriptor
deterministic signal-to-relationship batch builder
duplicate-evidence relationship tests
confirmation and contradiction relationship tests
directed relationship shape tests
unary requires-review relationship tests
same-envelope boundary tests
no-authority invariant tests
package export wiring
```

Not allowed in W04:

```text
learned relationship inference
correlation learning
fusion
packet signing
live enforcement
policy activation
authority upgrade
cross-envelope relationship detection
new production dependency
runtime deployment readiness claim
```

The fifth wiring slice is complete as the Shadow Runtime Pipeline Dry Run:

```text
src/consequence-admission/shadow-runtime-pipeline.ts
tests/shadow-runtime-pipeline.test.ts
docs/02-architecture/shadow-runtime-pipeline.md
```

Allowed in the completed W05 slice:

```text
pure deterministic shadow-only runner
canonical shadow event projection
built-in adapter registry use
typed signal extraction batches
rule-based relationship detection
relationship-aware monotone fusion
conflict and abstention gate evaluation
human comprehension gate evaluation
unsigned assurance packet creation
bounded reason lines and active questions
no-authority invariant tests
package export wiring
```

Not allowed in W05:

```text
live enforcement
policy activation
downstream execution
packet signing
TLA+ validation claim
Alloy validation claim
learning
baseline extraction
cross-tenant aggregation
new production dependency
runtime deployment readiness claim
```

The sixth wiring slice is complete as the Decision Trace Logger:

```text
src/consequence-admission/decision-trace-logger.ts
tests/decision-trace-logger.test.ts
docs/02-architecture/decision-trace-logger.md
```

Allowed in the completed W06 slice:

```text
digest-only trace entries
eight ordered shadow pipeline phases
linear hash-chain verification
TTL-bound trace expiry
pipeline digest replay rejection
capacity hold fail-closed behavior
structured snapshot for later offline spec checks
no-authority invariant tests
package export wiring
```

Not allowed in W06:

```text
audit-plane writes
production log integrity claim
external immutability claim
live enforcement
policy activation
downstream execution
packet signing
TLA+ validation claim
Alloy validation claim
learning
baseline extraction
cross-tenant aggregation
new production dependency
runtime deployment readiness claim
```

The seventh wiring slice is complete as the TLA+ Admission State Machine
Skeleton:

```text
specs/admission-state-machine.tla
specs/MCAdmission.cfg
tests/admission-state-machine-spec.test.ts
docs/02-architecture/admission-state-machine-spec.md
```

Allowed in the completed W07 slice:

```text
manual design-first TLA+ module
small TLC config
state variables for request stage, authority, trace, packet, nonce, review,
hazard, and enforcement state
initial invariant names for authority, packet, tenant, review, monotonicity,
and replay safety
static repository alignment test
package script wiring
```

Not allowed in W07:

```text
TypeScript implementation verification claim
generated-code equivalence claim
production certification
live enforcement
policy activation
downstream execution
packet signing
model-checker execution claim
TLC or Apalache CI dependency
learning
baseline extraction
cross-tenant aggregation
new production dependency
runtime deployment readiness claim
```

The eighth wiring slice is complete as the Alloy Tenant Isolation Model:

```text
specs/tenant-isolation.als
tests/tenant-isolation-model.test.ts
docs/02-architecture/tenant-isolation-model.md
```

Allowed in the completed W08 slice:

```text
manual Alloy relation model
tenant-owned Actor, Resource, Reviewer, Envelope, Trace, Signal, Packet,
Access, ReviewAssignment, and Decision signatures
TenantScopedReferences fact
NoSignalCycles structural fact
small-scope check commands
non-interference assertion names
static repository alignment test
package script wiring
```

Not allowed in W08:

```text
TypeScript implementation verification claim
generated-code equivalence claim
behavior or temporal proof
TLA+ replacement
Alloy Analyzer execution claim
Alloy Analyzer CI dependency
production isolation certificate
PostgreSQL RLS replacement
runtime PEP replacement
cross-tenant aggregation
new production dependency
runtime deployment readiness claim
```

## Runtime Intelligence Activation v1

The Runtime Assurance Wiring track made real shadow events speak the existing
contract language. Runtime Intelligence Activation v1 uses the same Attestor core
and adds the argument form that learned, replayed, formal, calibrated, and
human-reviewed artifacts must share.

This is not a new product, a second policy engine, or a separate governance
system. It is the assurance-case layer inside the same consequence runtime:

```text
shadow / replay / formal / calibration / outcome material
        -> Assurance Case Contract
        -> open defeaters and closed evidence
        -> promotion gate can review what remains unknown
```

Progress: 13/14 complete after I12. 1 step remains.

| Step | Status | Slice | Evidence |
|---|---|---|---|
| I00 | complete | Assurance Case Contract | `src/consequence-admission/assurance-case-contract.ts`; `tests/assurance-case-contract.test.ts`; `docs/02-architecture/assurance-case-contract.md` |
| I01 | complete | Learned Artifact Release Budget | `src/consequence-admission/learned-artifact-release-budget.ts`; `tests/learned-artifact-release-budget.test.ts`; `docs/02-architecture/learned-artifact-release-budget.md` |
| I02 | complete | Shadow Data Quality Gate | `src/consequence-admission/shadow-data-quality-gate.ts`; `tests/shadow-data-quality-gate.test.ts`; `docs/02-architecture/shadow-data-quality-gate.md` |
| I03 | complete | Baseline Cohort Builder | `src/consequence-admission/baseline-cohort-builder.ts`; `tests/baseline-cohort-builder.test.ts`; `docs/02-architecture/baseline-cohort-builder.md` |
| I04 | complete | Candidate Invariant Synthesizer | `src/consequence-admission/candidate-invariant-synthesizer.ts`; `tests/candidate-invariant-synthesizer.test.ts`; `docs/02-architecture/candidate-invariant-synthesizer.md` |
| I05 | complete | Counterexample Minimal Witness | `src/consequence-admission/counterexample-minimal-witness.ts`; `tests/counterexample-minimal-witness.test.ts`; `docs/02-architecture/counterexample-minimal-witness.md` |
| I06 | complete | Calibration Lower-Bound Runner | `src/consequence-admission/calibration-lower-bound-runner.ts`; `tests/calibration-lower-bound-runner.test.ts`; `docs/02-architecture/calibration-lower-bound-runner.md` |
| I07 | complete | Reviewer Packet / Open Defeater View | `src/consequence-admission/reviewer-open-defeater-view.ts`; `tests/reviewer-open-defeater-view.test.ts`; `docs/02-architecture/reviewer-open-defeater-view.md` |
| I08 | complete | Promotion Gate Runner | `src/consequence-admission/promotion-gate-runner.ts`; `tests/promotion-gate-runner.test.ts`; `docs/02-architecture/promotion-gate-runner.md` |
| I09 | complete | TLA+ Trace Validator Bridge | `src/consequence-admission/tla-trace-validator-bridge.ts`; `tests/tla-trace-validator-bridge.test.ts`; `docs/02-architecture/tla-trace-validator-bridge.md` |
| I10 | complete | Runtime Monitor Skeleton | `src/consequence-admission/runtime-monitor-skeleton.ts`; `tests/runtime-monitor-skeleton.test.ts`; `docs/02-architecture/runtime-monitor-skeleton.md` |
| I11 | complete | Decision Lineage Graph | `src/consequence-admission/decision-lineage-graph.ts`; `tests/decision-lineage-graph.test.ts`; `docs/02-architecture/decision-lineage-graph.md` |
| I12 | complete | Goodhart / Authority-Creep Guard | `src/consequence-admission/authority-creep-guard.ts`; `tests/authority-creep-guard.test.ts`; `docs/02-architecture/authority-creep-guard.md` |
| I13 | planned | Outcome Feedback / COE Wiring | Outcome-triggered rebutting defeaters |

I00 is SACM 2.3-aligned, GSN render-view compatible, and grounded in
Eliminative Argumentation / Assurance 2.0 style defeasibility. It does not claim
SACM conformance, formal proof, runtime assurance, reviewer UI, learned model
deployment, live enforcement, or production readiness.

I01 makes learned artifact release an explicit information-release budget
problem. It binds each candidate artifact to tenant, cohort, finite budget,
reviewer, assurance case, and reconstruction-risk context. It does not implement
differential privacy, does not provide a DP guarantee, does not release artifacts,
and rejects public, raw-material, and cross-tenant release paths.

I02 turns shadow evidence quality into explicit undermining-defeater material.
It evaluates canonical shadow events across schema, provenance, freshness,
coverage, redaction, correlation, and decision-integrity checks before later
steps use them as assurance-case evidence. It does not admit, block, enforce,
train, claim provenance-standard conformance, or act as a data-quality platform.

I03 turns a W09 baseline cohort candidate into an I00 assurance-case evidence
node only when I02 quality gates cover every source event and I01 release budget
permits the cohort-summary artifact for assurance review. It does not mine
baselines, synthesize invariants, train, promote, aggregate tenants, activate
policy, or enforce.

I04 turns a review-ready W10 candidate invariant plus ready I03 cohort evidence
into I00 claim and strategy nodes for open-defeater review. It does not mine
invariants, accept claims automatically, promote policy, train, enforce, or
claim proof.

I05 turns a minimal reproducing counterexample witness into I00 evidence and an
open rebutting defeater against the I04 claim node. It keeps the witness
digest-only, deterministic, tenant-bound, and review-only. It does not execute
replay, reject claims automatically, use credentials, touch target systems,
activate policy, or enforce.

I06 turns W11 calibration records into I00 lower-bound confidence evidence, or
opens an undercutting defeater when the lower bound is too weak. It treats point
estimates as context, not authority, and never promotes, admits, activates
policy, trains a calibrator, or enforces.

I07 turns I05 and I06 open defeaters into a bounded reviewer-facing packet. It
renders only open defeat material, caps the packet at 7 reason lines and 3
questions, and rejects raw-evidence or authority-action requests. It does not
close defeat, decide review, promote, admit, activate policy, or enforce.

I08 runs the bounded indefeasibility predicate over the I07
reviewer-open-defeater view. It allows only a review-only patch handoff when the
claim is ready, assurance-case/claim/strategy digests are bound, no open
defeaters remain, and no raw, closure, review-decision, policy-activation, or
live-enforcement request is present. It does not close defeat, decide review,
generate a patch, activate policy, admit, or enforce.

I09 turns W06 decision trace snapshots plus external TLA+ validator report
digests into I00 formal-spec evidence nodes or open rebutting/undercutting
defeaters. It requires a verified digest-only trace, spec/config digest binding,
an explicit invariant set, and validator report material before evidence is
created. It does not run TLC or Apalache, act as a runtime oracle, claim formal
proof, close defeat, activate policy, admit, or enforce.

I10 turns W05/W06 runtime observations into I00 living-case update material. It
binds the shadow runtime pipeline digest, envelope digest, unsigned assurance
packet digest, decision trace snapshot digest, optional measurement-plane digest,
observed timestamp, freshness window, and operator-visible monitor findings. A
healthy observation creates an evidence node; invalid/stale/mismatched evidence
opens an undermining defeater; monitor or measurement degradation opens an
undercutting defeater. It does not write the audit plane, act as an enforcement
monitor, claim OpenTelemetry/SIEM conformance, activate policy, admit, learn,
train, or enforce.

I11 turns the I00 assurance-case material, artifact references, and signature
references into a digest-bound decision lineage graph. It links case nodes,
defeaters, transitions, artifact refs, and signature refs while keeping open
defeat visible and signature coverage explicit. It does not export OpenLineage,
claim PROV/SACM conformance, create DSSE or in-toto signatures, write audit,
activate policy, admit, learn, train, or enforce.

I12 turns the I11 decision lineage graph and optional assurance measurement
plane material into authority-creep evidence or open undercutting defeaters. It
detects measurement-as-authority paths such as measurement artifacts supporting
claim/strategy nodes, blocked metric uses, policy-relaxation requests,
lineage-side authority actions, and direct boundary requests. It does not mutate
the lineage graph, close defeat, decide review, activate policy, admit, learn,
train, or enforce.

## Primary Source Anchors

Reviewed on 2026-05-17 and 2026-05-18:

- STPA and unsafe control action framing: [MIT STPA Handbook](http://psas.scripts.mit.edu/home/get_file.php?name=STPA_handbook.pdf).
- Calibration lower-bound framing: [FDA Data Mining White Paper](https://www.fda.gov/science-research/data-mining/data-mining-fda-white-paper),
  [NIST/SEMATECH Engineering Statistics Handbook](https://www.nist.gov/programs-projects/nistsematech-engineering-statistics-handbook),
  [scikit-learn Probability calibration](https://scikit-learn.org/stable/modules/calibration.html),
  and [NIST AI RMF 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10).
- Reviewer open-defeater framing: [Microsoft Human-AI Interaction Guidelines](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/),
  [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook/),
  [GitHub code scanning alert resolution](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolving-code-scanning-alerts),
  and [GSN Community Standard v3](https://scsc.uk/gsn).
- Promotion-gate predicate framing: [CMU SEI Eliminative Argumentation](https://www.sei.cmu.edu/library/eliminative-argumentation-a-basis-for-arguing-confidence-in-system-properties/),
  [SRI Assurance 2.0](https://www.csl.sri.com/users/rushby/assurance2.0),
  [OMG SACM 2.3](https://www.omg.org/spec/SACM),
  [CISA SSVC](https://www.cisa.gov/stakeholder-specific-vulnerability-categorization-ssvc),
  and [GitHub code scanning alert resolution](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolving-code-scanning-alerts).
- Runtime assurance framing for trusted safety monitors around untrusted or advanced autonomy: [NASA Runtime Assurance](https://ntrs.nasa.gov/citations/20240006522).
- Failure modes and upstream/downstream dependency modeling: [NASA FMEA Tool](https://software.nasa.gov/software/MSC-25379-1) and [NASA SW Failure Modes and Effects Analysis](https://swehb.nasa.gov/display/SWEHBVD/8.05%2B-%2BSW%2BFailure%2BModes%2Band%2BEffects%2BAnalysis).
- Fault/event tree analysis: [NRC Fault Tree Handbook, NUREG-0492](https://www.nrc.gov/reading-rm/doc-collections/nuregs/staff/sr0492/index.html).
- Govern/map/measure/manage risk lifecycle framing: [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) and [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook).
- Risk budget and operational measurement discipline: [Google SRE, Embracing Risk](https://sre.google/sre-book/embracing-risk/) and [Google SRE, Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- Human review and alert load discipline: [NIST AI RMF Appendix C](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf), [NASA Human Systems Integration Handbook](https://ntrs.nasa.gov/citations/20210010952), [Google SRE Practical Alerting](https://sre.google/sre-book/practical-alerting/), and [Microsoft Human-AI Interaction Guidelines](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf).
- Signed packet and digest-bound artifact framing: [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785), [RFC 7515 JSON Web Signature](https://www.rfc-editor.org/rfc/rfc7515), [RFC 8725 JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725), [in-toto Attestation Statement](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md), and [DSSE](https://github.com/secure-systems-lab/dsse).
- Outcome and incident feedback framing: [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), [Google SRE Postmortem Culture](https://sre.google/sre-book/postmortem-culture/), [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), and [MIT STPA Handbook](http://psas.scripts.mit.edu/home/get_file.php?name=STPA_handbook.pdf).
- Assurance measurement framing: [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [Google SRE Service Level Objectives](https://sre.google/sre-book/service-level-objectives/), [Google SRE Embracing Risk](https://sre.google/sre-book/embracing-risk/), [NIST CUSUM Control Charts](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc323.htm), [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), and [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/).
- Agentic threat and tool-action risk framing: [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/).
- Causal dependency framing: [Pearl, Causality](https://bayes.cs.ucla.edu/BOOK-2K/causality.html).
- Feedback loop and dynamic-system framing: [System Dynamics Society](https://systemdynamics.org/what-is-system-dynamics-old/).
- Design-first formal specification framing: [Microsoft Research, Specifying Systems](https://www.microsoft.com/en-us/research/publication/specifying-systems-the-tla-language-and-tools-for-hardware-and-software-engineers/), [How Amazon Web Services uses formal methods](https://cacm.acm.org/research/how-amazon-web-services-uses-formal-methods/), [Systems Correctness Practices at AWS](https://cacm.acm.org/practice/systems-correctness-practices-at-amazon-web-services/), and [Apalache TLA+ model checker documentation](https://apalache-mc.org/docs/).
- TLA+ trace-validation bridge framing: [Microsoft Research, Specifying Systems](https://www.microsoft.com/en-us/research/publication/specifying-systems-the-tla-language-and-tools-for-hardware-and-software-engineers/), [How Amazon Web Services uses formal methods](https://cacm.acm.org/research/how-amazon-web-services-uses-formal-methods/), [Systems Correctness Practices at AWS](https://cacm.acm.org/practice/systems-correctness-practices-at-amazon-web-services/), [Apalache TLA+ model checker documentation](https://apalache-mc.org/docs/), and the W06 decision trace logger contract.
- Runtime monitor skeleton framing: [NASA Runtime Assurance of Aeronautical Products](https://ntrs.nasa.gov/citations/20220015734), [NASA Robust Software Engineering](https://www.nasa.gov/intelligent-systems-division/robust-software-engineering/), [ENTRUST dynamic assurance cases](https://arxiv.org/abs/1703.06350), [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/), [Google SRE Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/), [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final), and [OMG SACM 2.3](https://www.omg.org/spec/SACM).
- Decision lineage graph framing: [W3C PROV-DM](https://www.w3.org/TR/prov-dm/), [OpenLineage core specification](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md), [OpenLineage API](https://openlineage.io/apidocs/openapi/), [in-toto Attestation Statement](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md), [DSSE Envelope](https://github.com/secure-systems-lab/dsse/blob/master/envelope.md), [W3C Trace Context](https://www.w3.org/TR/trace-context/), and [OMG SACM 2.1](https://www.omg.org/spec/SACM/2.1/PDF).
- Authority-creep guard framing: [Goodhart variants](https://arxiv.org/abs/1803.04585), [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), [Google SRE Embracing Risk](https://sre.google/sre-book/embracing-risk/), [Google SRE Service Level Objectives](https://sre.google/sre-book/service-level-objectives/), [CISA SSVC](https://www.cisa.gov/stakeholder-specific-vulnerability-categorization-ssvc), [SRI Assurance 2.0](https://www.csl.sri.com/users/rushby/assurance2.0), and [CMU SEI Eliminative Argumentation](https://www.sei.cmu.edu/library/eliminative-argumentation-a-basis-for-arguing-confidence-in-system-properties/).
- Tenant isolation and relation-model framing: [Alloy language reference](https://alloytools.org/download/alloy-language-reference.pdf), [Alloy in CACM](https://cacm.acm.org/research/alloy/), [AWS SaaS tenant isolation concepts](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/core-isolation-concepts.html), [AWS Lambda tenant isolation](https://docs.aws.amazon.com/lambda/latest/dg/tenant-isolation.html), and [NIST SP 800-207A](https://csrc.nist.gov/pubs/sp/800/207/a/final).
- Assurance-case argument structure and exchange framing: [GSN Community Standard v3](https://scsc.uk/gsn), [OMG SACM 2.3](https://www.omg.org/spec/SACM), [CMU SEI Eliminative Argumentation](https://www.sei.cmu.edu/library/eliminative-argumentation-a-basis-for-arguing-confidence-in-system-properties/), [SRI Assurance 2.0](https://www.csl.sri.com/users/rushby/assurance2.0), [ENTRUST dynamic assurance cases](https://arxiv.org/abs/1703.06350), and [University of York AMLAS](https://www.york.ac.uk/assuring-autonomy/guidance/amlas/).
- Learned artifact privacy and reconstruction-risk framing: [NIST SP 800-226](https://csrc.nist.gov/pubs/sp/800/226/final), [OpenDP Context](https://docs.opendp.org/en/stable/api/user-guide/context/index.html), [OpenDP typical workflow](https://docs.opendp.org/en/stable/getting-started/typical-workflow.html), [U.S. Census reconstruction and reidentification attack](https://www.census.gov/library/working-papers/2023/adrm/CES-WP-23-63.html), and [Google Differential Privacy libraries](https://github.com/google/differential-privacy).
- Shadow evidence quality framing: [CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md), [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/), [W3C PROV Overview](https://www.w3.org/TR/prov-overview/), [W3C Trace Context](https://www.w3.org/TR/trace-context/), [OpenLineage API](https://openlineage.io/apidocs/openapi/), [Great Expectations Validation Result](https://docs.greatexpectations.io/docs/0.18/reference/learn/terms/validation_result/), and [AWS Deequ](https://github.com/awslabs/deequ).
- Baseline cohort evidence framing: [TensorFlow Data Validation anomaly reference](https://www.tensorflow.org/tfx/data_validation/anomalies), [TFX ML Metadata](https://tensorflow.github.io/tfx/guide/mlmd/), [Google Data Cards Playbook](https://sites.research.google/datacardsplaybook/), [Datasheets for Datasets](https://www.microsoft.com/en-us/research/publication/datasheets-for-datasets/), [DVC data versioning](https://doc.dvc.org/user-guide), [lakeFS versioning internals](https://docs.lakefs.io/dev/understand/how/versioning-internals/), and [OpenLineage core model](https://github.com/OpenLineage/OpenLineage).
- Candidate invariant synthesis framing: [Daikon dynamic invariant detection](https://plse.cs.washington.edu/daikon/), [Texada LTL specification mining](https://www.cs.ubc.ca/~bestchai/papers/texada-ase15_final.pdf), [Synoptic log invariant mining](https://homes.cs.washington.edu/~mernst/pubs/invariants-logs-debs2010.pdf), [Dwyer property specification patterns](https://matthewbdwyer.github.io/psp/), and [GitHub CodeQL custom model documentation](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/editing-your-configuration-of-default-setup-for-code-scanning).
- Counterexample minimal witness framing: [Jepsen Elle](https://github.com/jepsen-io/elle), [ClusterFuzz](https://google.github.io/clusterfuzz/), [QuickCheck shrinking](https://hackage.haskell.org/package/QuickCheck/docs/Test-QuickCheck.html), [Zeller and Hildebrandt delta debugging](https://www.st.cs.uni-saarland.de/papers/tse2002/), and [FoundationDB deterministic simulation](https://www.foundationdb.org/files/fdb-paper.pdf).

These sources are engineering anchors only. They do not prove production
readiness, compliance certification, customer deployment, target-system
coverage, or mathematical correctness of future Attestor implementations.

## Non-Claims

This overview does not claim:

- production readiness
- NIST AI RMF conformance
- safety certification
- live customer deployment
- live target-system integration
- external immutable log coverage
- formal verification
- trained hazard models
- automatic policy activation
- that measurement metrics can tune enforcement
- that the current repository implements a production runtime assurance system

It records the next sequenced implementation plan after the completed
Shadow-to-Policy master list.
