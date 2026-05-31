# Baseline Cohort Contract

Status: W09 Runtime Assurance Wiring v1 contract. This is not a baseline
mining engine, not learned invariant promotion, not live enforcement, and not
production readiness.

## Decision

`attestor.baseline-cohort-contract.v1` defines the digest-only shape for a
tenant-local baseline cohort candidate. The contract exists so the later Layer
2 baseline/invariant work can reason over shadow traffic without accidentally
learning from blocked or unsafe examples.

The contract accepts source records derived from:

- canonical shadow events
- shadow runtime pipeline results
- decision traces
- reviewer labels
- downstream receipts
- incident feedback

All source records stay digest-only. They preserve:

- source event digest
- tenant digest
- optional envelope digest
- optional trace digest
- decision class
- evidence digests
- raw-material false flags

## External Anchors

Splunk Enterprise Security UEBA identifies anomalies by comparing current
activity to learned baselines for users and assets, extracting behavioral
features, measuring deviations, and assigning risk scores. Attestor uses the
same baseline/deviation pattern, but only as a review-bound contract in this
slice: [Splunk Enterprise Security UEBA](https://help.splunk.com/en/splunk-enterprise-security-8/administer/8.5/user-and-entity-behavior-analytics/user-and-entity-behavior-analytics-ueba-overview-in-splunk-enterprise-security).

Microsoft Sentinel UEBA builds behavioral profiles for users, hosts, IP
addresses, applications, and other entities, then compares activity to those
baselines. Attestor mirrors the entity-bound profile idea with tenant-bound
cohorts and digest-only evidence: [Microsoft Sentinel UEBA](https://learn.microsoft.com/en-us/azure/sentinel/identify-threats-with-entity-behavior-analytics).

NIST AI RMF calls for measuring and tracking identified and emergent AI risks
over time, while documenting what cannot be measured. W09 therefore records
explicit no-claims and keeps the contract non-authoritative:
[NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf).

NIST AI 100-2 identifies data poisoning as part of the adversarial machine
learning taxonomy. W09 treats unknown or unsafe source material as a
poisoning-risk hold rather than as baseline truth:
[NIST AI 100-2 E2025](https://csrc.nist.gov/pubs/ai/100/2/e2025/final).

Daikon reports likely invariants by observing executions and producing
statistically justified properties. W09 is only the cohort boundary that a
future invariant catalog can consume; it does not infer invariants:
[Daikon dynamic invariant detection](https://people.csail.mit.edu/cpacheco/publications/daikon-tool-scp2006.pdf).

## Contract

Implementation:

```text
src/consequence-admission/baseline-cohort-contract.ts
```

Test:

```text
tests/baseline-cohort-contract.test.ts
```

Package script:

```text
npm run test:baseline-cohort-contract
```

The contract exposes:

```text
BASELINE_COHORT_CONTRACT_VERSION
baselineCohortContractDescriptor()
createBaselineCohortSourceFromShadowEvent()
createBaselineCohortCandidate()
evaluateBaselineCohortPromotion()
evidenceRefDigestsForSignals()
```

## Invariants

The baseline cohort contract preserves these invariants:

- block decisions cannot enter a baseline cohort
- all source events must be from one tenant
- all evidence references are digest-only
- raw payload, prompt, provider body, wallet material, and tenant identifiers
  are not stored
- reviewer affirmation is required before a cohort can move to invariant
  candidate review
- automatic promotion is forbidden
- relaxation is forbidden; only strengthen-only mutation is representable
- cross-tenant aggregation is forbidden
- the contract cannot admit, enforce, or activate policy

## Promotion Gate

The promotion gate returns one of:

```text
eligible-for-invariant-candidate-review
held-for-review
held-for-sample-floor
held-for-safety-label
rejected-relaxation
```

The only positive outcome is `eligible-for-invariant-candidate-review`, and it
still does not activate enforcement. It only says the cohort can be handed to
the later W10/W12 invariant review path.

## Non-Claims

Boundary: cohort evidence only: not a baseline mining engine, not learned
invariant promotion, not live enforcement, and not production readiness. It
cannot grant authority or reduce review requirements.
