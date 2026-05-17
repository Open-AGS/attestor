# Cross-Domain Pattern Sources For Consequence Runtime Assurance

Status: research annex for
[Consequence Runtime Assurance Overview](../02-architecture/consequence-runtime-assurance-overview.md).
This is source mapping and design hypothesis, not production proof, not
compliance evidence, and not a claim that Attestor implements every pattern.

## Purpose

The next Attestor phase should learn from safety-critical and high-reliability
engineering domains without copying their claims. The goal is to translate
stable patterns into Attestor contracts:

```text
source domain pattern
  -> imported engineering constraint
  -> Attestor artifact
  -> explicit non-claim
```

## Source Matrix

| Source area | Primary anchor | What Attestor imports | Artifact it informs | What we do not claim |
|---|---|---|---|---|
| STPA / STAMP | [MIT STPA Handbook](http://psas.scripts.mit.edu/home/get_file.php?name=STPA_handbook.pdf) | Unsafe control actions, control constraints, process model mismatch, timing hazards. | Consequence envelope, interaction rules, incident path. | Attestor is not certified as an STPA-complete system. |
| Runtime assurance | [NASA Runtime Assurance](https://ntrs.nasa.gov/citations/20240006522) | Trusted monitor around advanced/untrusted autonomy; fail-safe intervention when safety properties are threatened. | Tier 1 hard gates, no-loosening rule, review/block fallback. | No claim that current Attestor is deployed as an RTA system. |
| FMEA | [NASA FMEA Tool](https://software.nasa.gov/software/MSC-25379-1), [NASA SW FMEA](https://swehb.nasa.gov/display/SWEHBVD/8.05%2B-%2BSW%2BFailure%2BModes%2Band%2BEffects%2BAnalysis) | Failure modes, causes, immediate effects, upstream/downstream dependencies, early lifecycle risk mitigation. | Signal categories, consequence fields, failure/gap signals. | No claim that Attestor has completed FMEA for every action family. |
| Fault tree / event tree | [NRC Fault Tree Handbook](https://www.nrc.gov/reading-rm/doc-collections/nuregs/staff/sr0492/index.html) | Explicit dependency structure, AND/OR propagation, top-down event reasoning. | Signal relationship graph, interaction matrix, conflict gate. | No probabilistic risk assessment certification. |
| AI risk lifecycle | [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook) | Govern, map, measure, manage as a lifecycle vocabulary. | Authority planes, measurement plane, non-claim posture. | Only AI RMF-mappable language is claimed, not conformance. |
| SRE risk budgets | [Google SRE, Embracing Risk](https://sre.google/sre-book/embracing-risk/), [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) | Explicit risk budget, symptom/cause separation, actionable measurement. | Safety/review budget accounting, measurement metrics. | No SRE maturity or availability SLO claim. |
| Agentic threat modeling | [OWASP Agentic AI threats and mitigations](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) | Tool/action misuse, chaining, misconfiguration, excessive authority, resilience planning. | Threat library versioning, counterexample replay, fabric regression. | No complete threat coverage claim. |
| Causal dependency | [Pearl, Causality](https://bayes.cs.ucla.edu/BOOK-2K/causality.html) | Separate correlation from causal/dependency structure before inference. | Directed relationships, duplicate/dependence discount, modulator rules. | No causal discovery engine is implemented by this plan. |
| System dynamics | [System Dynamics Society](https://systemdynamics.org/what-is-system-dynamics-old/) | Stocks, flows, delays, feedback loops, drift as system behavior. | Outcome feedback, drift signals, measurement plane. | No dynamic simulation is shipped in the first contract PR. |
| Human-AI review | [Microsoft Human-AI Guidelines](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/), [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook/) | Human attention is bounded; uncertainty and recourse should be visible. | Human comprehension gate, active questions, review-by-exception. | No claim that review UX is complete without user testing. |

## Translation Rules

These are the engineering rules imported from the source matrix.

1. Treat AI actions as control actions with consequences, not as chat output.
2. Type the consequence before any risk fusion runs.
3. Separate hard authority gates from advisory witnesses.
4. Relationship semantics fire before fusion math.
5. Relationship direction is part of the contract.
6. Duplicate evidence and correlated witnesses must be discounted.
7. Conflict and abstention are safety signals.
8. Measurement is not authority.
9. Incident paths are first-class feedback sources.
10. Human review must be bounded and actionable.
11. Budget exhaustion must not fall open.
12. Every future fabric mutation must run replay/backtest regression.

## Attestor Mapping

| Attestor primitive | Research-backed design role |
|---|---|
| Consequence envelope | STPA control action context plus FMEA effect context. |
| Tier 1 hard gates | Runtime assurance monitor and fail-safe floor. |
| Typed signals | FMEA-style failure/effect vocabulary adapted to AI actions. |
| Signal relationships | Fault-tree and causal-dependency structure before fusion. |
| Relationship-aware fusion | Sensor/fault-style aggregation after duplicate/conflict handling. |
| Conflict / abstention gate | Safety response when the system does not understand the region. |
| Human comprehension gate | Human-AI review workload boundary. |
| Assurance packet | Digest-bound assurance case and audit export material. |
| Outcome / incident feedback | Post-event learning path that does not silently activate policy. |
| Assurance measurement plane | NIST/SRE-style measure/manage surface without decision authority. |

## Sequenced Implementation

The research supports the following order:

```text
0. research annex and overview
1. consequence envelope contract
2. signal relationship contract
3. LayerOpinion as advisory signal
4. modulator authority tier
5. relationship-aware monotone fusion
6. conflict / abstention gate
7. human comprehension gate
8. signed assurance packet
9. outcome and incident feedback contract
10. assurance measurement plane
```

The first code PR should stay types-only. Any behavior, learning, fusion math,
or measurement feedback should wait until the contract vocabulary is stable and
covered by tests.

## Non-Claims

This annex does not claim:

- production readiness
- safety certification
- NIST AI RMF conformance
- STPA completeness
- FMEA completion
- probabilistic risk assessment completion
- live customer deployment
- native connector coverage
- formal verification
- trained hazard models
- automatic policy activation

It is a bounded source map for the next Attestor architecture phase.
