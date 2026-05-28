# Golden Path: Refund

Status: complete for the first concrete golden path after the completed
Shadow-to-Policy, Consequence Runtime Assurance, and Runtime Activation
repository-side tracks. This is a planning and evidence-shaping artifact. It is
not live connector coverage, not Google Cloud work, not production readiness,
and not live enforcement.

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
  -> engine visibility report
  -> optional reviewer sandbox
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
| Refund fixtures | `src/consequence-admission/golden-refund-shadow-fixtures.ts` emits eight synthetic digest-only canonical shadow events: normal, missing-evidence, stale-evidence, repeated-refund, approval-required, adversarial-text-in-evidence, external-fraud-signal-high, and over-policy-amount. | repo-proven |
| Foundry refund projection | `src/consequence-admission/golden-refund-policy-foundry-projection.ts` projects the G03 fixtures into a review-only candidate, named evidence/authority/relationship gaps, backtest material, and an existing Policy Twin summary. | repo-proven |
| Refund runtime smoke | `src/consequence-admission/golden-refund-runtime-smoke.ts` runs all eight G03 fixtures through the existing R02-R07 shadow runtime smoke chain without target-system calls, audit writes, external exports, policy activation, learning, training, or admission authority. | repo-proven |
| Refund pilot readiness probe | `src/consequence-admission/golden-refund-pilot-readiness-probe.ts` wraps the G05 runtime smoke in a digest-bound Pilot Readiness Packet and allows only `ready-for-shadow-pilot` or `not-ready`. `ready-for-scoped-pilot` remains outside this golden path. | repo-proven |
| Refund demo CLI | `scripts/demo/demo-golden-refund.ts` renders the G03-G08 golden path as Markdown by default and JSON with `--json`, and renders the G09 Reviewer Sandbox with `--scenario`, without writing files or calling target systems. | repo-proven |
| Engine visibility report | `src/consequence-admission/golden-refund-engine-visibility.ts` renders the eight-scenario gate trace, derived gate metrics, no-claims, and deterministic/shuffled-order digest stability checks. | repo-proven |
| Reviewer sandbox | `src/consequence-admission/golden-refund-reviewer-sandbox.ts` lets a reviewer pass a strict, schema-bound local refund JSON file through the same shadow-only engine path with `npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json`. | repo-proven |
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

G08 makes the engine path visible without adding side effects. Source anchors:
[OpenTelemetry traces and spans](https://opentelemetry.io/docs/concepts/signals/traces/),
[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests),
[Reproducible Builds definition](https://reproducible-builds.org/docs/definition/),
and [SLSA provenance](https://slsa.dev/provenance).

G09 makes the path actively testable with a reviewer-supplied local JSON file
without turning Attestor into a generic BYO-action runtime. Source anchors:
[JSON Schema](https://json-schema.org/learn/getting-started-step-by-step),
[OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html),
and [Node.js `fs.readFileSync`](https://nodejs.org/api/fs.html#fsreadfilesyncpath-options).

## G-Series Tracker

Progress after G09 lands: 9/9 complete. 0 steps remain.

| Step | Status | Slice | Evidence target |
|---|---|---|---|
| G01 | complete | Golden Path decision packet | This document, package script, and architecture links. |
| G02 | complete | Refund OpenAPI enrichment | The refund surface includes refund reason, payment/order evidence refs, refund method, approval refs, and a prior refund signal. |
| G03 | complete | Refund shadow fixture builder | Synthetic digest-only canonical shadow events for normal, missing-evidence, stale-evidence, repeated-refund, approval-required, adversarial-text-in-evidence, external-fraud-signal-high, and over-policy-amount paths. |
| G04 | complete | Policy Foundry refund projection | Policy twin summary over refund fixtures with named gaps, review-only candidates, and backtest material. |
| G05 | complete | Runtime smoke | Run the existing R02-R07 shadow runtime smoke chain over the refund fixtures end to end without target-system calls. |
| G06 | complete | Pilot readiness probe | Emit only `ready-for-shadow-pilot` or `not-ready` for the golden path. `ready-for-scoped-pilot` is outside the G-series until real shadow observation, customer PEP, receipt evidence, and approval are present. |
| G07 | complete | Demo CLI | `npm run demo:golden-refund` renders Markdown as the primary G07 output and JSON as secondary machine output. |
| G08 | complete | Engine visibility report | The demo output now includes an Engine Visibility section over 8 synthetic scenarios, gate order, derived gate metrics, no-claims, and a determinism check (`npm run demo:golden-refund -- --determinism-check`). |
| G09 | complete | Reviewer Sandbox | A reviewer can run a strict local JSON input with `npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json`. The sandbox rejects unknown fields, handles out-of-scope inputs without running the engine, and keeps every result shadow-only. |

## Business Contrast

The Golden Path output starts with a simple contrast for non-specialist readers:

```text
Without Attestor in this repo path:
  no Attestor gate trace
  no issue-code/no-claim boundary
  no digest-bound shadow readiness evidence

With Attestor in this repo path:
  8 synthetic refund scenarios
  7 visible gate stages
  named Foundry gaps
  0 target-system calls
  shadow-pilot readiness verdict
```

This does not claim that a real customer workflow would execute without
Attestor. It only states what this repository-side path adds to a proposed
refund consequence: visible checks, bounded no-claims, and digest-bound review
material.

## Engine Visibility

G08 is not a new product surface. It makes the existing Golden Path: Refund
inspectable. The report shows:

- 8 synthetic scenarios across happy path, missing evidence, stale evidence,
  repeated refund, approval-required, instruction-like evidence text, external
  risk signal, and over-policy amount;
- gate order from shadow envelope projection through signed assurance packet;
- derived gate metrics, including evidence completeness from the conflict gate
  coverage gap score;
- explicit no-claims per run: no target-system call, no audit-plane write, no
  policy activation, no learning/training activation, no admission authority,
  and no production readiness;
- deterministic decision-relevant digest checks for identical input and shuffled
  opinion/relationship/modulator ordering.

## Reviewer Sandbox

G09 is the active reviewer path. It lets a reviewer try one local, schema-bound
refund action input against the same shadow-only engine path:

```bash
npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json
npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json --json
```

This is still not live execution. The sandbox:

- allows only a small allowlisted refund input shape;
- rejects unknown fields rather than storing raw customer, order, or payment
  details;
- handles schema-valid but logically inconsistent input as an engine finding
  with `refund:inconsistent-input-detected`;
- handles out-of-scope action surfaces as `outside-scope` without running the
  refund engine path;
- emits no target-system calls, audit writes, policy activation, learning,
  training, or admission authority.

## Why G02 Matters

G02 adds the prior refund signal as the bridge from this golden path into the
existing runtime assurance work. A repeated refund can create `confirms` or
`escalates` relationship material. Contradictory payment evidence can create an
`undermining defeater`. This connects the refund path to the W-series and
I-series contracts without inventing a separate refund engine.

## Scenario Boundary

G01-G09 can be completed repo-side and locally with synthetic material.

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
