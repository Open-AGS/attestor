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
| Assurance case argumentation | [GSN Community Standard v3](https://scsc.uk/gsn), [OMG SACM 2.3](https://www.omg.org/spec/SACM), [CMU SEI Eliminative Argumentation](https://www.sei.cmu.edu/library/eliminative-argumentation-a-basis-for-arguing-confidence-in-system-properties/), [SRI Assurance 2.0](https://www.csl.sri.com/users/rushby/assurance2.0), [University of York AMLAS](https://www.york.ac.uk/assuring-autonomy/guidance/amlas/) | Claims, evidence, argument strategy, explicit defeat/uncertainty, and ML assurance case structure. | Assurance Case Contract, open defeater view, promotion gate evidence boundary. | No SACM conformance, GSN tooling, formal proof, or ML safety certification claim. |
| Learned artifact privacy | [NIST SP 800-226](https://csrc.nist.gov/pubs/sp/800/226/final), [OpenDP Context](https://docs.opendp.org/en/stable/api/user-guide/context/index.html), [U.S. Census reconstruction and reidentification attack](https://www.census.gov/library/working-papers/2023/adrm/CES-WP-23-63.html), [Google Differential Privacy libraries](https://github.com/google/differential-privacy) | Treat learned candidates as information releases with bounded budget, mediated access, and reconstruction-risk review. | Learned Artifact Release Budget, privacy/reconstruction undermining defeaters. | No differential privacy engine, DP guarantee, public release, or cross-tenant aggregation claim. |
| Shadow evidence quality | [CloudEvents required context and privacy](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md), [OpenTelemetry log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/), [W3C PROV provenance data model](https://www.w3.org/TR/prov-overview/), [W3C Trace Context](https://www.w3.org/TR/trace-context/), [OpenLineage API](https://openlineage.io/apidocs/openapi/), [Great Expectations Validation Result](https://docs.greatexpectations.io/docs/0.18/reference/learn/terms/validation_result/), [AWS Deequ](https://github.com/awslabs/deequ) | Event context, observed timestamp, trace correlation, producer/schema/provenance refs, validation-result records, and data-quality checks as explicit assumptions. | Shadow Data Quality Gate and provenance/freshness/coverage undermining defeaters. | No CloudEvents/OpenTelemetry/PROV/OpenLineage conformance, data-quality platform, or production readiness claim. |
| Baseline cohort evidence | [TensorFlow Data Validation anomaly gate](https://www.tensorflow.org/tfx/data_validation/anomalies), [TFX ML Metadata artifact lineage](https://tensorflow.github.io/tfx/guide/mlmd/), [Google Data Cards Playbook](https://sites.research.google/datacardsplaybook/), [Datasheets for Datasets](https://www.microsoft.com/en-us/research/publication/datasheets-for-datasets/), [DVC data versioning](https://doc.dvc.org/user-guide), [lakeFS versioning internals](https://docs.lakefs.io/dev/understand/how/versioning-internals/), [OpenLineage core model](https://github.com/OpenLineage/OpenLineage) | Treat cohorts as documented, digest-addressed, lineage-bound dataset artifacts whose anomalies and scope gaps remain explicit. | Baseline Cohort Builder and assurance-case evidence nodes for candidate claims. | No TFDV/MLMD/Data Cards/DVC/lakeFS/OpenLineage conformance, no baseline mining engine, and no automatic invariant synthesis claim. |
| Candidate invariant synthesis | [Daikon likely invariants](https://plse.cs.washington.edu/daikon/), [Texada LTL specification mining](https://www.cs.ubc.ca/~bestchai/papers/texada-ase15_final.pdf), [Synoptic log invariant mining](https://homes.cs.washington.edu/~mernst/pubs/invariants-logs-debs2010.pdf), [Dwyer property specification patterns](https://matthewbdwyer.github.io/psp/), [CodeQL model and sanitizer workflows](https://docs.github.com/en/code-security/code-scanning/managing-your-code-scanning-configuration/editing-your-configuration-of-default-setup-for-code-scanning) | Treat mined or template-derived invariants as likely, scoped, reviewable claim candidates with structural model effects separated from promotion. | Candidate Invariant Synthesizer claim and strategy nodes. | No invariant mining engine, no automatic claim acceptance, no CodeQL conformance, no proof, and no policy activation claim. |
| Counterexample minimal witness | [Jepsen Elle](https://github.com/jepsen-io/elle), [ClusterFuzz](https://google.github.io/clusterfuzz/), [QuickCheck shrinking](https://hackage.haskell.org/package/QuickCheck/docs/Test-QuickCheck.html), [Zeller/Hildebrandt delta debugging](https://www.st.cs.uni-saarland.de/papers/tse2002/), [FoundationDB deterministic simulation](https://www.foundationdb.org/files/fdb-paper.pdf) | Reduce counterexamples into small, deterministic, reproducible, digest-bound witnesses before human review. | Counterexample Minimal Witness evidence and rebutting defeater nodes. | No replay execution engine, no policy correctness proof, no production traffic, and no automatic claim rejection. |
| Calibration lower-bound runner | [FDA Data Mining White Paper](https://www.fda.gov/science-research/data-mining/data-mining-fda-white-paper), [NIST/SEMATECH Engineering Statistics Handbook](https://www.nist.gov/programs-projects/nistsematech-engineering-statistics-handbook), [scikit-learn probability calibration](https://scikit-learn.org/stable/modules/calibration.html), [NIST AI RMF 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10) | Treat calibrated confidence as uncertainty-bearing measurement evidence; require lower-bound framing and keep point estimates outside authority paths. | Calibration Lower-Bound Runner evidence nodes and weak-confidence undercutting defeaters. | No calibration training engine, no statistical guarantee, no promotion gate, no policy activation, and no authority claim. |
| Reviewer open-defeater view | [Microsoft Human-AI Interaction Guidelines](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/), [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook/), [GitHub code scanning alert resolution](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolving-code-scanning-alerts), [GSN Community Standard v3](https://scsc.uk/gsn) | Render only the remaining open defeat material, bound the reviewer workload, keep uncertainty visible, and separate display from review/dismissal decisions. | Reviewer Open Defeater View packets. | No reviewer UI, no review decision, no defeater closure, no promotion gate, no live enforcement, and no production readiness claim. |
| Promotion gate runner | [CMU SEI Eliminative Argumentation](https://www.sei.cmu.edu/library/eliminative-argumentation-a-basis-for-arguing-confidence-in-system-properties/), [SRI Assurance 2.0](https://www.csl.sri.com/users/rushby/assurance2.0), [OMG SACM 2.3](https://www.omg.org/spec/SACM), [CISA SSVC](https://www.cisa.gov/stakeholder-specific-vulnerability-categorization-ssvc), [GitHub code scanning alert resolution](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-code-scanning-alerts/resolving-code-scanning-alerts) | Execute a bounded indefeasibility predicate over open-defeater review material and map it to one next action without closing defeat or activating policy. | Promotion Gate Runner. | No reviewer decision, no defeater closure, no policy patch generation, no policy activation, no live enforcement, and no authority claim. |

Data Cards and Datasheets are used here as documentation anchors for cohort
scope, provenance, maintenance, intended use, and stakeholder-readable limits.

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
13. Shadow evidence must pass provenance/freshness/coverage gates before it can support a claim.
14. Baseline cohorts become evidence only after every source event has a quality gate and the cohort summary has a release budget.
15. Candidate invariants become claims only after baseline evidence is ready and the candidate itself is review-ready; likely invariants remain hypotheses until open defeaters are closed.
16. Minimal counterexamples become review material only after they reproduce the violation, reduce or prove already-minimal shape, and bind to the exact tenant, cohort, invariant, replay, and claim digests.
17. Calibration evidence must use lower bounds and uncertainty context; point estimates can never become authority.
18. Reviewer packets should render open defeaters only, cap visible reason lines and questions, and leave closure, dismissal, and promotion decisions to later authority-bound steps.
19. Promotion gates should execute a bounded indefeasibility predicate over the open-defeater view, then permit only a review-only handoff; closure, review decisions, patch generation, policy activation, and enforcement stay separate.

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
| Assurance case contract | SACM-aligned argument substrate with GSN render view and defeater-first promotion logic. |
| Learned artifact release budget | Bounded release-budget context and privacy/reconstruction undermining defeaters before learned candidates can progress. |
| Shadow data quality gate | Converts weak shadow evidence into explicit undermining-defeater material instead of silently trusting logs. |
| Baseline cohort builder | Converts budgeted, quality-gated cohort material into assurance-case evidence nodes without mining, training, or granting authority. |
| Candidate invariant synthesizer | Converts review-ready invariant candidates into assurance-case claim and strategy nodes without accepting, promoting, or enforcing the claim. |
| Counterexample minimal witness | Converts digest-only reproducing counterexamples into evidence nodes and open rebutting defeaters without executing replay or rejecting claims automatically. |
| Calibration lower-bound runner | Converts ready calibration records into lower-bound confidence evidence, or weak-confidence undercutting defeaters, without making confidence authoritative. |
| Reviewer open-defeater view | Converts I05 and I06 open defeaters into a bounded digest-only reviewer packet without closing defeat, deciding review, promoting policy, or activating enforcement. |
| Promotion gate runner | Converts a no-open-defeater reviewer view into a bounded review-only patch handoff record without closing defeat, deciding review, generating patches, activating policy, or enforcing. |

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
11. assurance case contract for Runtime Intelligence Activation v1
12. learned artifact release budget for Runtime Intelligence Activation v1
13. shadow data quality gate for Runtime Intelligence Activation v1
14. counterexample minimal witness for Runtime Intelligence Activation v1
15. calibration lower-bound runner for Runtime Intelligence Activation v1
16. reviewer open-defeater view for Runtime Intelligence Activation v1
17. promotion gate runner for Runtime Intelligence Activation v1
```

Each new slice should keep the smallest pure deterministic boundary it can
support. Learning, authority changes, policy activation, and measurement
feedback stay out of these contracts until the preceding evidence, non-claims,
and tests are stable.

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
