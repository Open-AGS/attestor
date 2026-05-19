# Golden Path: Refund

Status: G05 runtime smoke for the first concrete golden path after the
completed Shadow-to-Policy, Consequence Runtime Assurance, and Runtime
Activation repository-side tracks. This is a planning and evidence-shaping
artifact. It is not runtime code, not live connector coverage, not Google Cloud
work, not production readiness, and not live enforcement.

## Decision

Golden Path: Refund is the first concrete path.

It proves that one AI-proposed refund action class can be carried through the
existing Attestor consequence engine:

```text
refund action surface
  -> synthetic canonical shadow events
  -> shadow runtime replay
  -> Policy Foundry summary
  -> pilot readiness packet
```

This is the first path because refund is understandable, bounded, reversible in
many business systems, easy to fixture synthetically, and already represented in
the repository action-surface example.

Non-split boundary:

```text
Not a refund product.
Not a refund engine.
Not a separate finance direction.
Not a new Attestor mode.
```

The path uses the same consequence grammar as every other Attestor consequence:
tenant, actor, action, resource, evidence references, review posture, replay
material, and readiness evidence. The refund domain supplies the example
surface; it does not get independent authority.

## Repository Evidence

| Area | Evidence | State |
|---|---|---|
| Refund surface | `examples/action-surface-onboarding/refund.openapi.json` defines a refund action surface with `POST /refunds`, approval route material, refund reason, refund method, digest-bound evidence refs, and a prior refund signal. | repo-proven |
| Refund fixtures | `src/consequence-admission/golden-refund-shadow-fixtures.ts` emits five synthetic digest-only canonical shadow events: normal, missing-evidence, stale-evidence, repeated-refund, and approval-required. | repo-proven |
| Foundry refund projection | `src/consequence-admission/golden-refund-policy-foundry-projection.ts` projects the G03 fixtures into a review-only candidate, named evidence/authority/relationship gaps, backtest material, and an existing Policy Twin summary. | repo-proven |
| Refund runtime smoke | `src/consequence-admission/golden-refund-runtime-smoke.ts` runs all five G03 fixtures through the existing R02-R07 shadow runtime smoke chain without target-system calls, audit writes, external exports, policy activation, learning, training, or admission authority. | repo-proven |
| Manifest intake | `src/consequence-admission/action-surface-manifest-intake.ts` accepts OpenAPI manifests as action-surface intake material. | repo-proven |
| Shadow replay | `src/consequence-admission/shadow-runtime-fixture-replay-smoke.ts` replays synthetic fixtures through the R02-R07 shadow runtime activation chain without target-system calls. | repo-proven |
| Foundry summary | `src/consequence-admission/policy-foundry-policy-twin-summary.ts` summarizes candidate, evidence, replay, and review material without activating policy. | repo-proven |
| Pilot packet | `src/consequence-admission/pilot-readiness-packet.ts` emits pilot readiness verdicts, including `ready-for-shadow-pilot`, `ready-for-scoped-pilot`, and `not-ready`. | repo-proven |
| Worker | `src/service/worker.ts` exists, but it is not a shadow runtime activation worker for this path. | partial-repo |
| Shared outbox | `src/service/consequence-shared-history-outbox-store.ts` exists for future shared runtime delivery, but G01 does not require it. | partial-repo |

## Research Anchors

Refund systems commonly expose explicit refund creation and lifecycle APIs, so
the golden path can be tested with synthetic events before a live connector:
[Stripe Refunds API](https://docs.stripe.com/api/refunds/create) and
[Shopify `refundCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/refundCreate).

The path follows review-before-apply and no-side-effect preview patterns rather
than direct mutation. Source anchors:
[AWS IAM Access Analyzer policy generation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html),
[Google Cloud role recommendations review/apply](https://cloud.google.com/policy-intelligence/docs/review-apply-role-recommendations),
[Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan),
and [Kubernetes dry-run](https://kubernetes.io/docs/reference/using-api/api-concepts/#dry-run).

Policy and audit material stay schema-bound and replayable. Source anchors:
[OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs),
[Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html),
[OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0.html), and
[CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md).

## G-Series Tracker

Progress after G05 lands: 5/7 complete. 2 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| G01 | complete | Golden Path decision packet | This document, package script, and architecture links. |
| G02 | complete | Refund OpenAPI enrichment | The refund surface includes refund reason, payment/order evidence refs, refund method, approval refs, and a prior refund signal. |
| G03 | complete | Refund shadow fixture builder | Synthetic digest-only canonical shadow events for normal, missing-evidence, stale-evidence, repeated-refund, and approval-required paths. |
| G04 | complete | Policy Foundry refund projection | Policy twin summary over refund fixtures with named gaps, review-only candidates, and backtest material. |
| G05 | complete | Runtime smoke | Run the existing R02-R07 shadow runtime smoke chain over the refund fixtures end to end without target-system calls. |
| G06 | planned | Pilot readiness probe | Emit only `ready-for-shadow-pilot` or `not-ready` for the golden path. `ready-for-scoped-pilot` is outside the G-series until real shadow observation, customer PEP, receipt evidence, and approval are present. |
| G07 | planned | Demo CLI | `npm run demo:golden-refund` renders Markdown as the primary G07 output and JSON as secondary machine output. |

## Why G02 Matters

G02 adds the prior refund signal as the bridge from this golden path into the
existing runtime assurance work. A repeated refund can create `confirms` or
`escalates` relationship material. Contradictory payment evidence can create an
`undermining defeater`. This connects the refund path to the W-series and
I-series contracts without inventing a separate refund engine.

## Scenario Boundary

G01-G07 can be completed repo-side and locally with synthetic material.

Required boundaries:

- no live Stripe refund;
- no live Shopify refund;
- no Google Cloud work;
- no GKE requirement;
- no GCP KMS requirement;
- no production worker readiness claim;
- no live customer PEP claim;
- no auto-enforcement;
- no raw customer identifier;
- no raw tenant identifier;
- no raw payment payload;
- no raw order payload.

The path is shadow-only until a future customer-specific scoped tracker provides
real integration proof, customer authorization, receipt evidence, and operational
rollout evidence.

## Data Minimization

Fixtures and outputs use action type, consequence class, amount class, policy
state, evidence references, digest references, and synthetic identifiers. They
must not store or render raw customer names, raw tenant IDs, raw payment details,
raw order payloads, webhook bodies, idempotency keys, or downstream error bodies.

## Stop Criteria

The G-series is complete when this statement is repo-proven:

```text
Attestor can run an AI refund shadow pilot: it ingests synthetic refund actions,
identifies evidence/policy gaps, proposes review-only candidate material, and
emits a pilot readiness packet. It does not execute refunds automatically.
```

This stop criterion intentionally excludes production readiness, live customer
deployment, live connector coverage, compliance claims, and scoped enforcement.

## No-Claims

This document does not claim:

- production readiness;
- live Stripe connector coverage;
- live Shopify connector coverage;
- Google Cloud deployment;
- GKE deployment;
- GCP KMS signing;
- live customer pilot execution;
- scoped pilot readiness;
- live enforcement;
- refund execution;
- refund product status;
- refund engine status;
- compliance readiness.
