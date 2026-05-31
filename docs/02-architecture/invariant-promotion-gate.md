# Invariant Promotion Gate

Status: W12 Runtime Assurance Wiring v1 contract. This is not live
enforcement, not auto-promotion, not policy mutation, and not production
readiness.

## Decision

`attestor.invariant-promotion-gate.v1` is the final W12 boundary for learned
invariant candidates. It consumes:

```text
Candidate Invariant
  + Invariant Calibration Record
  + independent reviewer approval
  + review-only strengthening patch digest
  + rollout plan digest
  + rollback plan digest
```

The only positive result is:

```text
promotion-ready-for-review-only-patch
```

That means the invariant may be packaged as review material for a
review-only strengthening patch. It does not apply the patch, mutate policy,
activate enforcement, admit an action, or claim production readiness.

## External Anchors

GitHub protected branches can require pull request reviews and status checks
before a protected branch accepts changes. W12 mirrors that pattern: review
and checks are preconditions, not proof that production activation happened:
[GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

LaunchDarkly approvals prevent flag or AI Config changes from being applied
without approval. W12 uses the same approval-before-apply pattern, but stops at
review-only patch readiness:
[LaunchDarkly approvals API](https://launchdarkly.com/docs/api/approvals).

Kubernetes ValidatingAdmissionPolicy separates policy definition, parameters,
and binding before a policy takes effect. W12 follows the same separation:
candidate shape, calibration record, and promotion decision are distinct from
activation:
[Kubernetes Validating Admission Policy](https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/).

Google SRE canary guidance requires gradual rollout, evaluation, and rollback
paths to reduce impact. W12 therefore requires rollout and rollback plan
digests before an invariant can even become review patch material:
[Google SRE Canarying Releases](https://sre.google/workbook/canarying-releases/).

NIST AI RMF and TEVV frame risk management as governed, measured, and managed
work with explicit limitations. W12 keeps promotion bounded to a measured
change-control contract:
[NIST AI RMF 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10),
[NIST TEVV](https://www.nist.gov/ai-test-evaluation-validation-and-verification-tevv).

## Contract

Implementation:

```text
src/consequence-admission/invariant-promotion-gate.ts
```

Test:

```text
tests/invariant-promotion-gate.test.ts
```

Package script:

```text
npm run test:invariant-promotion-gate
```

The contract exposes:

```text
INVARIANT_PROMOTION_GATE_VERSION
invariantPromotionGateDescriptor()
createInvariantPromotionGateDecision()
evaluateInvariantPromotionGate()
```

## Required Inputs

The gate requires digest-only evidence:

```text
candidate invariant digest
calibration digest
independent reviewer digest
approval digest
policy patch digest
rollout plan digest
rollback plan digest
```

The gate rejects mismatched candidate/calibration pairs. The calibration
record must bind the same invariant digest as the candidate under review.

## Outcomes

W12 can return:

```text
promotion-ready-for-review-only-patch
held-for-candidate-review
held-for-calibration
held-for-reviewer-signoff
held-for-patch-evidence
held-for-rollout-plan
rejected-relaxation
rejected-auto-promotion
rejected-live-enforcement
```

Only `promotion-ready-for-review-only-patch` may continue to a review package.
It still does not mutate policy or activate enforcement.

## Guardrails

The promotion gate preserves these invariants:

- no live enforcement
- no auto-promotion
- no relaxation
- no policy mutation
- independent reviewer signoff is required
- candidate must be W10 `review-ready`
- calibration must be W11 `calibration-ready-for-promotion-review`
- policy patch digest is required
- rollout plan digest is required
- rollback plan digest is required
- raw score authority cannot carry through promotion
- the gate cannot admit, enforce, train, or claim production readiness

## Non-Claims

Boundary: review-only strengthening patch handoff: no live enforcement,
no auto-promotion, no relaxation, and not production readiness. Promotion still
needs an independent reviewer, rollout plan, rollback plan, and separate live
proof.
