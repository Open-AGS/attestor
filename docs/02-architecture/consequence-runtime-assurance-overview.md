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

## Primary Source Anchors

Reviewed on 2026-05-17:

- STPA and unsafe control action framing: [MIT STPA Handbook](http://psas.scripts.mit.edu/home/get_file.php?name=STPA_handbook.pdf).
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
