# Policy Foundry Onboarding

Policy Foundry is a platform-core onboarding layer for observed-action policy
mining: it turns customer shadow action traffic into evidence-backed policy
candidates and missing-control findings.

It is not an automatic policy writer, not a model-training promise, not a
production-readiness claim, and not a compliance certification. It exists to
reduce customer setup friction while preserving Attestor's fail-closed,
approval-required consequence boundary.

## Goal

Companies should not need to write a complete policy model before they can see
Attestor's value.

The first useful customer path is:

```text
send shadow traffic
-> profile action surfaces
-> detect policy, evidence, authority, and adapter gaps
-> propose approval-required policy candidates
-> simulate candidates with Policy Twin backtests
-> ask only blocking customer questions
-> require human approval
-> roll out from observe to warn to review to scoped enforce
```

The customer gets useful feedback from real action traffic without letting
shadow mode change production behavior.

## Research Anchors

The design follows established patterns, but does not claim that any external
standard certifies Attestor:

- AWS IAM Access Analyzer generates policy material from observed CloudTrail
  activity, then expects review and customization before use:
  https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html
- Google IAM Recommender uses observed permission usage to recommend changes,
  while keeping lifecycle and application control outside the recommender:
  https://docs.cloud.google.com/policy-intelligence/docs/role-recommendations-overview
- Cedar and AWS Verified Permissions keep authorization policy schema-bound:
  https://docs.cedarpolicy.com/policies/validation.html and
  https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/schema.html
- OPA decision logs and policy tests separate decision evidence from policy
  promotion:
  https://www.openpolicyagent.org/docs/management-decision-logs and
  https://www.openpolicyagent.org/docs/latest/policy-testing/
- NIST SP 800-162 describes ABAC in terms of subject, object, operation, and
  environmental attributes:
  https://csrc.nist.gov/pubs/sp/800/162/upd2/final
- ABAC policy-mining research supports extracting candidate policies from logs,
  but only as reviewed policy material:
  https://arxiv.org/abs/1403.5715
- Stripe onboarding is requirements-aware and can collect only currently due
  information before expanding the flow:
  https://docs.stripe.com/connect/onboarding
- Auth0 progressive profiling collects extra information only when relevant:
  https://auth0.com/docs/manage-users/user-accounts/user-profiles/progressive-profiling
- LaunchDarkly and OpenFeature model progressive rollout through context-bound
  evaluation rather than one-shot activation:
  https://launchdarkly.com/docs/home/releases/progressive-rollouts and
  https://openfeature.dev/docs/reference/concepts/evaluation-context
- Zanzibar and OpenFGA show why relationship context matters next to ABAC:
  https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/
  and https://openfga.dev/docs/concepts

## Core Versus Packs

Policy Foundry belongs in the Attestor platform core, not inside one pack.

```text
Attestor platform core:
  action surface profiler
  policy candidate discovery
  Policy Twin backtest
  readiness and no-go scoring
  active-question engine
  red-team replay suite
  rollout ladder
  audit and proof export

Consequence packs:
  finance templates
  crypto templates
  healthcare templates
  custom domain templates
  pack-specific evidence and authority hints
```

The core identifies controlled-consequence patterns from observed action
traffic. Packs provide domain schemas and templates. Finance and crypto remain
packs on the same core, not separate product identities.

## Onboarding Loop

### 1. Connect Or Send Shadow Events

The lowest-friction path should accept real shadow events first. The customer
should not need to finish a full policy editor before Attestor can produce the
first action inventory.

### 2. Profile The Action Surface

Attestor groups observed events by tenant, domain, downstream system, action,
actor, mode, decision, reason codes, evidence references, and outcome digests.
Raw prompts, payloads, customer records, wallet material, payment details, and
downstream response bodies must not become onboarding data.

### 3. Match Domain Templates

Policy Foundry should suggest a template class such as refund, data export,
production deploy, permission change, external customer communication,
programmable-money action, or custom domain. Template matching is a hint, not
authority.

### 4. Mine Policy Candidates

Candidates may be suggested from observed traffic and simulation
recommendations. Every candidate must carry:

```text
approvalRequired: true
autoEnforce: false
llmAuthorityAllowed: false
evidenceRequired: true
simulationRequired: true
```

LLM-generated summaries can explain a candidate, but they cannot become policy
authority, evidence verification, threshold authority, or an activation trigger.

External-facing language should avoid saying that Attestor "trains on" or
"learns the company." The safer product claim is:

```text
Attestor identifies policy candidates and missing controls from shadow action
traffic.
```

### 5. Run Policy Twin

Policy Twin replays shadow history against a proposed posture and reports:

- event window and sample size
- admit, narrow, review, and block counts
- review-load impact
- missing policy, evidence, authority, and adapter gaps
- high-risk auto-admit count
- counterexample count
- replay or duplicate pressure
- single-actor concentration
- downstream and human outcome signals

No candidate should move toward enforcement without a simulation result.

### 6. Score Readiness

Policy Foundry confidence is not LLM confidence. It should be computed from
observable control signals:

- sample size
- actor distribution health
- single-actor concentration
- evidence completeness
- authority completeness
- reviewer agreement when human outcomes exist
- counterexample count
- missing-proof rate
- replay or duplicate rate
- policy simplicity
- simulation quality
- red-team replay result

High sample count with low distribution health is not safe. The correct output
is a no-go reason, not a higher confidence score.

### 7. Ask Only Blocking Questions

The active-question engine should use progressive profiling. It should not ask
for every configuration field up front.

Good questions are specific and unblock the next safe step:

```text
Most refund actions are below USD 60, but actions above USD 60 have no stable
review outcome. Choose a review threshold: USD 50, USD 75, or USD 100.
```

Bad questions are broad setup friction:

```text
Define your complete refund policy.
```

### 8. Replay Adversarial Cases

Before a candidate can become review-ready or enforce-eligible, run a small
candidate-specific red-team replay set:

- unknown actor
- missing evidence
- foreign tenant record
- duplicate/replayed request
- high amount or high-risk scope
- actor burst
- malicious summary
- unsafe proof URI
- downstream adapter not ready

Failures produce no-go reasons or review-only recommendations.

### 9. Roll Out Gradually

The rollout ladder is:

```text
observe only
warn only
review required
scoped enforce for low-risk only
full enforce
rollback
```

Paid production customers should get soft overage behavior, but security gates
must not silently downgrade. If enforcement evidence is incomplete, hold the
consequence rather than converting the failure into advisory text.

## No-Go Conditions

Policy Foundry must refuse enforce recommendations when any of these remain:

- no simulation report
- no customer approval
- missing policy schema
- missing evidence connector or evidence reference coverage
- missing authority binding
- sample size below the configured minimum
- single actor dominates the candidate sample
- high-risk auto-admits appear in backtest
- counterexamples are unresolved
- replay or duplicate pressure is unresolved
- tenant boundary is not proven
- adapter readiness is missing
- red-team replay fails
- LLM text is the only source for a threshold, rule, or explanation

The correct wording is `not enough evidence` or `no-go for enforce`, not
`ready`.

## Commercial Boundary

Policy Foundry should create the free evaluation aha moment, but it should not
be unlimited free production value.

- Developer: basic shadow summary, action risk inventory, limited candidate
  preview, no production enforcement.
- Trial: time-boxed Pro-like shadow discovery, Policy Twin preview, readiness
  and no-go scoring, no production enforcement.
- Starter: one production workflow with basic Policy Foundry, Policy Twin,
  active questions, review/enforce ladder, and short-retention audit export.
- Pro: advanced confidence scoring, candidate red-team replay, multiple
  workflows, RBAC/SSO, dual approval, and longer retention.
- Scale: higher-volume discovery, custom templates, drift detection, stronger
  support, and longer retention.
- Enterprise: customer-operated, dedicated, air-gapped, regulated, or custom
  pack deployment boundaries.

Security minimums stay available across plans: redaction, proof verification,
tenant isolation, fail-closed semantics, and no auto-enforcement from shadow
reads must not become paid-only safety features.

## First Implementation Slice

The first runtime slice should be a Policy Foundry readiness contract, not a UI
rewrite:

```text
readinessScore
sampleSize
actorDistributionHealth
singleActorConcentration
evidenceCompleteness
authorityCompleteness
counterexampleCount
replayDuplicateRate
simulationQuality
redTeamReplayStatus
activeQuestions
recommendedRolloutStep
noGoReasons
approvalRequired: true
autoEnforce: false
llmAuthorityAllowed: false
```

That contract can consume the existing shadow simulation, policy discovery
candidate, action risk inventory, and activation readiness surfaces.

## Current Status

Repository foundations already exist in:

- `src/consequence-admission/action-risk-inventory.ts`
- `src/consequence-admission/policy-discovery-candidates.ts`
- `src/consequence-admission/shadow-simulation.ts`
- `src/consequence-admission/shadow-activation-readiness-gate.ts`

Policy Foundry as described here is not fully implemented. The current system
has shadow events, action risk inventory, policy discovery candidates,
simulation reports, promotion drafts, and activation readiness gates. It does
not yet have a dedicated readiness engine, active-question contract,
candidate-specific red-team replay suite, or full commercial entitlement
contract for Foundry capabilities.
