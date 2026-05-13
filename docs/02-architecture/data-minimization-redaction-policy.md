# Data Minimization And Redaction Policy

The data minimization and redaction policy is the shared privacy boundary for model feedback, proof, audit, tamper-history, dashboard, dashboard summaries, Policy Foundry active questions, Policy Foundry onboarding sessions, Policy Foundry coverage scores, Policy Foundry gate plans, Policy Foundry candidate registries, Policy Foundry counterexample ledgers, Policy Twin summaries, authority relationship contexts, review-only patch packs, outcome feedback loops, drift/policy-debt detectors, commercial boundary packets, adversarial replay executor reports, hosted onboarding workflow reports, hosted review surfaces, hosted UI flow pages, external review, retry, and downstream receipt surfaces.

It answers a narrow question:

```text
What can Attestor safely reveal after an AI action is admitted, narrowed, reviewed, blocked, retried, or summarized?
```

The answer is deliberately small: reason codes, safe instructions, missing field names, required evidence kinds, counts, digests, timestamps, scoped identifiers, status, and operator-supplied aggregate impact.

Raw customer payloads do not belong in these surfaces.

## Why It Exists

Attestor sits before consequences. That means its feedback and proof material may reach agents, customer operators, downstream adapters, auditors, dashboards, and external reviewers.

Those consumers need enough information to correct, review, verify, and audit. They do not need raw business payloads.

The policy keeps that boundary explicit:

```text
AI receives safe correction feedback
operators receive scoped review evidence
reviewers receive digest-first packets
external reviewers receive evidence maps and non-claims
tamper histories receive source digests and root digests
dashboards receive counts and aggregate signals
dashboard summaries receive tiles, attention items, and API links
downstream receipts receive result digests
```

No surface should become a hidden data lake.

## Governed Surfaces

The versioned package descriptor covers these surfaces:

- `admission-model-feedback`
- `admission-problem`
- `retry-attempt-ledger`
- `shadow-summary`
- `shadow-simulation`
- `policy-discovery-candidates`
- `policy-foundry-active-questions`
- `policy-foundry-onboarding-session`
- `policy-foundry-coverage-score`
- `policy-foundry-gate-planner`
- `policy-foundry-candidate-registry`
- `policy-foundry-counterexample-ledger`
- `policy-foundry-policy-twin-summary`
- `policy-foundry-authority-relationship-context`
- `policy-foundry-review-only-patch-pack`
- `policy-foundry-self-onboarding-cli`
- `policy-foundry-outcome-feedback-loop`
- `policy-foundry-drift-policy-debt-detector`
- `policy-foundry-commercial-boundary`
- `policy-foundry-adversarial-replay-executor`
- `policy-foundry-hosted-onboarding-workflow`
- `policy-foundry-hosted-review-surface`
- `policy-foundry-hosted-ui-flow`
- `audit-evidence-export`
- `tamper-evident-history`
- `business-risk-dashboard`
- `dashboard-api-summary`
- `external-review-packet`
- `downstream-presentation-binding`
- `presentation-replay-ledger`
- `downstream-execution-receipt`

Each surface declares an audience, allowed data units, forbidden raw classes, and whether it is model-safe.

## Allowed Data Units

Allowed units are intentionally structural:

- reason codes
- safe instructions
- missing field names
- required evidence kinds
- counts
- digests
- timestamps
- tenant and environment scope
- consequence domain
- surface digest
- artifact reference
- policy reference
- approval state
- status
- operator-supplied aggregate impact

Operator-supplied impact is allowed only as aggregate decision support. Attestor does not infer money saved, records protected, or loss avoided from raw customer data.

## Forbidden Raw Classes

These classes must not appear in model feedback, reviewer packets, tamper histories, dashboard models, retry ledgers, downstream presentation exports, replay receipts, or execution receipts:

- raw model prompts
- raw model outputs
- raw tool payloads
- raw customer identifiers
- raw personal data
- raw bank or payment data
- raw wallet keys or secrets
- raw recipient details
- raw evidence documents
- raw database rows or query results
- raw downstream responses
- credentials or secrets
- private policy thresholds
- raw idempotency keys
- raw replay keys

If a surface needs to refer to one of these items, it should use a digest, opaque reference, scoped identifier, or customer-owned evidence reference.

## Model Feedback Boundary

Model-safe feedback is not training data, not policy disclosure, and not a debug dump.

It may include:

- reason codes
- missing field names
- required evidence kinds
- a safe instruction

It must not include customer payloads, raw account data, private policy thresholds, wallet material, credentials, evidence contents, or downstream error bodies.

This is what makes the safe retry loop a correction path instead of a probing channel.

## Problem Details Boundary

HTTP/API problem responses should expose interface-level facts, not implementation internals.

A problem can say:

```text
evidence-ref-missing
```

It should not include:

```text
the raw evidence document
the downstream provider error body
the secret, account, wallet, or policy value that failed
```

The API can be useful without becoming a debugging oracle.

## Audit And Dashboard Boundary

The audit evidence export and business risk dashboard sit on top of this policy.

The audit export is digest-first review evidence. It can show what was observed, where policy gaps exist, what simulations or promotion packets were produced, and whether downstream proof exists.

The dashboard is decision support. It can show action volume, review load, blocked actions, policy gaps, consequence-domain risk, downstream proof coverage, and operator-supplied aggregate impact.

The dashboard API summary is the compact first-screen shape over that dashboard. It can show tiles, attention items, top domains, and links to deeper API surfaces.

The external review packet is a reviewer handoff. It can show source evidence digests, repository evidence references, runtime/storage evidence references, checklist items, findings, and non-claims.

None of these surfaces claim compliance, production readiness, external audit completion, or automatic enforcement.

## Payment And Programmable-Money Boundary

Money-adjacent systems need stricter defaults because account data, payment credentials, wallet material, custody metadata, and recipient details are high-value targets.

Attestor should keep those values out of feedback and proof. Use references, digests, scoped policy identifiers, tokenized recipient references, or downstream-owned evidence records instead.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `consequenceDataMinimizationRedactionPolicyDescriptor()`
- `evaluateConsequenceDataMinimizationArtifact(...)`

The descriptor is a policy map. The evaluator is a small gate that fails closed when a redacted surface declares raw payload storage, exposes a forbidden raw class, or emits a data unit outside the surface allowance.

## Research Posture

This policy follows the direction of current privacy and AI-security guidance:

- AI risk management needs documentation, measurement, and monitoring over time.
- PII should be protected against inappropriate access, use, and disclosure.
- Personal data should be adequate, relevant, and limited to what is necessary for the stated purpose.
- LLM applications should sanitize data and prevent sensitive information disclosure.
- Payment-sensitive authentication data should not be stored after authorization.
- Problem details are for HTTP interface detail, not implementation debugging internals.

For Attestor, that means the useful output is not the raw data. The useful output is the verifiable control trace.

## Boundary

This policy does not by itself prove production data handling, retention, legal compliance, encryption posture, customer DPA terms, or external audit completion.

It is a repo-level contract for what Attestor package and hosted read surfaces should expose by default.

Production deployments still need customer-specific retention, access control, secrets management, key management, logging policy, and external review.
