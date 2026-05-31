# Pilot Readiness Packet

Status: repository-side Step 26 contract for deciding whether a customer-owned
pilot can start shadow observation or ask for a scoped enforcement pilot. This
is not production readiness, not live customer deployment proof, and not native
connector coverage.

## Decision

The pilot readiness packet sits after the domain recipes:

```text
domain consequence recipes
  -> pilot readiness packet
  -> customer-owned shadow pilot
  -> scoped rollout only after target evidence
```

The packet does not execute a pilot. It packages the minimum digest-bound
evidence needed to say one of three things:

```text
ready-for-shadow-pilot
ready-for-scoped-pilot
not-ready
```

The human work should be small: review the blockers, approve the bounded pilot
path, or keep the target in shadow. The customer still owns the system of
record, target deployment, approval authority, and downstream execution path.

## Runtime Contract

| Field | Value |
|---|---|
| Version | `attestor.pilot-readiness-packet.v1` |
| Source module | `src/consequence-admission/pilot-readiness-packet.ts` |
| Test | `tests/pilot-readiness-packet.test.ts` |
| Package script | `npm run test:pilot-readiness-packet` |
| Stages | `shadow-entry`, `scoped-enforcement-entry` |
| Rollout modes | `shadow-only`, `review-required`, `canary-enforce` |
| Verdicts | `ready-for-shadow-pilot`, `ready-for-scoped-pilot`, `not-ready` |

The packet accepts only digests, percentages, counts, recipe refs, and bounded
mode names. It does not store raw prompts, raw provider bodies, raw target
payloads, customer identifiers, tenant ids, payment details, wallet material,
downstream error bodies, or secrets.

## Stage Semantics

| Stage | Meaning | Required posture |
|---|---|---|
| `shadow-entry` | Enough integration, owner, approval, rollback, audit, and non-claim evidence exists to begin observing target actions in shadow. | Must use `shadow-only`; no historical traffic threshold is required yet. |
| `scoped-enforcement-entry` | Shadow observation has produced enough event quality, evidence coverage, receipt coverage, and active-question closure to ask for a scoped pilot. | Must use `review-required` or `canary-enforce`; canary requires customer PEP proof. |

## Gates

| Gate | Checks | Protected principle |
|---|---|---|
| `integration-prerequisites` | Pilot, tenant, target system, integration owner, system-of-record owner, and target recipe refs are digest-bound. | tenant isolation, customer authority, no overclaim |
| `shadow-observation-window` | Scoped pilot requests have enough shadow days and event count. | auditability, operational boundedness, no overclaim |
| `event-quality` | Shadow events meet schema, tenant-binding, and receipt-binding coverage. | proof integrity, tenant isolation, data minimization and redaction |
| `evidence-coverage` | Evidence refs and downstream receipt refs are covered enough for scoped review. | proof integrity, auditability, replay and idempotency safety |
| `active-question-resolution` | Critical questions are closed and high-impact unresolved questions are within threshold. | customer authority, operational boundedness, no overclaim |
| `approval-path` | Approval path and reviewer queue are digest-bound. | customer authority, auditability, operational boundedness |
| `rollout-mode` | Stage and rollout mode match, and canary has customer PEP proof. | fail-closed boundary, customer authority, no overclaim |
| `rollback-plan` | Rollback plan and operator runbook are digest-bound. | operational boundedness, runtime readiness, no overclaim |
| `receipt-and-audit-trail` | Decision log or audit trail destination is digest-bound. | auditability, proof integrity, data minimization and redaction |
| `non-claim-boundary` | Pilot users acknowledge that the packet is not production, compliance, connector, or deployment proof. | no overclaim, customer authority, operational boundedness |

Any required failed gate makes the packet `not-ready`. The packet never
auto-enforces and never activates a policy bundle.

## Thresholds

| Threshold | Default |
|---|---:|
| Minimum shadow observation days | 14 |
| Minimum shadow event count | 100 |
| Minimum event schema coverage | 95% |
| Minimum tenant binding coverage | 100% |
| Minimum receipt binding coverage | 80% |
| Minimum evidence coverage | 80% |
| Minimum downstream receipt coverage | 70% |
| Maximum unresolved critical questions | 0 |
| Maximum unresolved high-impact questions | 2 |

These defaults are pilot-packaging thresholds, not universal production
thresholds. A customer or regulated target can require stricter values before
scoped rollout.

## Adoption Checklist

Before `shadow-entry`:

- Choose the target domain recipe.
- Bind pilot, tenant, requester, target system, integration owner, and
  system-of-record owner as digests.
- Bind approval path, reviewer queue, rollback plan, operator runbook, and
  decision-log destination.
- Use `shadow-only`.
- Accept the pilot non-claims.

Before `scoped-enforcement-entry`:

- Provide shadow duration and event-count evidence.
- Provide schema, tenant-binding, and receipt-binding coverage.
- Provide evidence and downstream receipt coverage.
- Resolve all critical active questions.
- Keep unresolved high-impact questions within threshold.
- Use `review-required`, or use `canary-enforce` only with customer PEP proof.

## Research Anchors

The packet follows primary-source patterns that separate observation,
recommendation, review, dry-run or plan, approval, and production cutover:

- [AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html) uses CloudTrail activity to generate a policy template, then requires review, customization, create, and attach steps.
- [Google Cloud role recommendations](https://cloud.google.com/policy-intelligence/docs/role-recommendations-overview) requires enough observation data for IAM recommendations and records cases where no safe recommendation is generated.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) anchor decision records with policy input, result, bundle revision, and trace metadata.
- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan) anchors preview-before-apply behavior; `plan` does not carry out the proposed changes by itself.
- [Kubernetes dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run) evaluates mutating requests through admission and validation without persistence or side effects.
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) anchors required reviewers and protected deployment environments.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) anchors secure-development vocabulary and acquisition communication without implying certification.
- [Microsoft HAX Toolkit](https://www.microsoft.com/en-us/haxtoolkit/) and [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook-v2/) anchor human-AI review, feedback, and control patterns.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It only proves the repository-side, digest-only pilot readiness packet contract
that closes the 26-step master list.
