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
| 01 | next | Consequence Envelope Contract | Types, docs, digest-only field rules, tests for required fields and forbidden raw material. | Do not run relationship/fusion on untyped action input. |
| 02 | planned | Signal Relationship Contract | `SignalCategory`, category-bound `SignalKind`, directed/symmetric/unary relationship types, interaction rule shape, tests. | Do not use a flat signal enum or directionless relationships. |
| 03 | planned | LayerOpinion schema | Opinion type as a special advisory signal, with uncertainty, source-dependence, abstention, and no-loosening invariants. | Do not let advisory output grant authority. |
| 04 | planned | Modulator authority tier | Context modulators for reversibility, blast radius, tenant maturity, coverage, and freshness. | Do not let context modulators override hard denies. |
| 05 | planned | Relationship-aware monotone fusion | Duplicate discount, confirmation boost, formal override, monotone risk aggregation, property tests. | Do not average away strong hazards or count duplicate evidence twice. |
| 06 | planned | Conflict and abstention gate | Review/block outcomes for high conflict, low coverage, high uncertainty, and weighted abstention. | Do not turn uncertainty into admit. |
| 07 | planned | Human comprehension gate | Reason-line limit, active question cap, escalation and review-load visibility tests. | Do not create a noisy dashboard that shifts work to humans. |
| 08 | planned | Signed assurance packet | Digest-bound packet tied to tamper-evident history, policy, evidence, signals, relationships, and replay refs. | Do not store raw payloads or claim external immutability. |
| 09 | planned | Outcome and incident feedback contract | Outcome source classes, incident path states, bounded mutation rules, replay regression triggers. | Do not retrain, activate, or mutate policy directly from feedback. |
| 10 | planned | Assurance measurement plane | Read-only metrics, drift/regression/degraded-state reporting, scoped budget accounting, dashboard contract. | Do not let measurement output become decision authority. |

## First Code PR Scope

The first implementation PR should be narrow:

```text
src/consequence-admission/consequence-envelope-contract.ts
src/consequence-admission/signal-relationship-contract.ts
tests/consequence-runtime-assurance-contract.test.ts
```

Allowed:

```text
types only
descriptors
normalizers for allowed enum values
digest-only validation helpers
contract invariant tests
package export wiring
```

Not allowed in the first PR:

```text
runtime behavior
fusion math
learning
policy activation
measurement feedback
downstream calls
new production dependency
```

## Primary Source Anchors

Reviewed on 2026-05-17:

- STPA and unsafe control action framing: [MIT STPA Handbook](http://psas.scripts.mit.edu/home/get_file.php?name=STPA_handbook.pdf).
- Runtime assurance framing for trusted safety monitors around untrusted or advanced autonomy: [NASA Runtime Assurance](https://ntrs.nasa.gov/citations/20240006522).
- Failure modes and upstream/downstream dependency modeling: [NASA FMEA Tool](https://software.nasa.gov/software/MSC-25379-1) and [NASA SW Failure Modes and Effects Analysis](https://swehb.nasa.gov/display/SWEHBVD/8.05%2B-%2BSW%2BFailure%2BModes%2Band%2BEffects%2BAnalysis).
- Fault/event tree analysis: [NRC Fault Tree Handbook, NUREG-0492](https://www.nrc.gov/reading-rm/doc-collections/nuregs/staff/sr0492/index.html).
- Govern/map/measure/manage risk lifecycle framing: [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework) and [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook).
- Risk budget and operational measurement discipline: [Google SRE, Embracing Risk](https://sre.google/sre-book/embracing-risk/) and [Google SRE, Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/).
- Agentic threat and tool-action risk framing: [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/).
- Causal dependency framing: [Pearl, Causality](https://bayes.cs.ucla.edu/BOOK-2K/causality.html).
- Feedback loop and dynamic-system framing: [System Dynamics Society](https://systemdynamics.org/what-is-system-dynamics-old/).

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
- that the current repository implements the Signal Relationship Fabric

It records the next sequenced implementation plan after the completed
Shadow-to-Policy master list.
