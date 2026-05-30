# Attestor

**A gate for high-risk AI actions.**

Attestor sits between what an AI wants to do and the system that would do it.

It does not try to make the model perfect.
It controls the proposed action before a customer system acts.

Prompts guide. They do not enforce.

A prompt can guide an AI, but it cannot stop your refund service, export job, identity admin, deploy tool, or wallet adapter. The stop point has to sit before the real action. Attestor checks that structured action and returns `admit`, `narrow`, `review`, or `block`.

## One Concrete Workflow

A support AI prepares this action:

```text
Refund $380 to customer_123.
```

Attestor checks:

- is there a refund policy?
- does the order belong to this customer?
- is the payment real?
- is manager approval required?
- was this already refunded?
- can the refund service execute only after Attestor allows it?

Outcome:

```text
blocked before money moves
```

Reason:

```text
manager approval is missing and duplicate-refund risk is present
```

What the reviewer sees:

- the proposed action
- the missing approval
- the duplicate-risk signal
- the evidence references
- the safe next step
- the proof trail

Without Attestor:

```text
the AI-generated refund request can reach the refund service with no gate trace
```

With Attestor and a customer-owned gate:

```text
money does not move
proof remains
```

In this repository, the refund path is synthetic and shadow-only. It does not call Stripe, Shopify, a bank, or a live customer deployment.

Run it:

```bash
npm ci
npm run demo:golden-refund
npm run demo:golden-refund -- --json
```

The output shows what was checked, why the action held or blocked, and which
proof references remain.

Then run all local golden paths:

```bash
npm run demo:golden-paths
npm run demo:golden-paths -- --json
```

## Why This Matters Now

AI systems are moving from chat into tools that can touch payment flows, data exports, access changes, customer messages, infrastructure, and programmable money.

That is no longer just a prompt-quality problem.
Teams need to know who asked for the action, what evidence supported it, whether it was replayed, and whether the final service can be stopped.

This is the same general direction visible in serious external anchors: the [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai), the [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework), and [DORA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554).

These links are context anchors, not compliance claims.
Attestor targets the action boundary those conversations keep circling around.

## What Attestor Does

The dangerous moment is not the text the model produced.
It is the moment that text becomes a refund, data export, permission change, deploy, customer message, or wallet transaction.

Attestor checks the proposed action: policy, approval, evidence, allowed scope, freshness, replay, tenant, token, and proof references.
The real service runs only through the customer-owned gate.

```text
AI agent
  -> AI proposes action
Attestor
  -> checks the action
  -> admit / narrow / review / block + reasons and proof references
Customer-owned gate
  -> calls the real service only when allowed
```

Without an enforced customer-side gate, gateway, verifier, or adapter, Attestor is advisory evidence.
With that enforced downstream point, Attestor becomes the stop point before action.

Start in shadow mode.
See what the AI would have done before you let it act.

## The Same Pattern Across Actions

The refund example is the first story, not the whole product.

The same control pattern extends to:

| Action class | Examples |
|---|---|
| Money Movement | refunds, payouts, supplier payments, credits, adjustments |
| Data Movement | customer exports, warehouse queries, report releases |
| Authority Change | grants, revocations, unlocks, approvals, delegations |
| External Communication | customer-facing, legal, billing, support, public messages |
| Operational Execution | deploys, secret rotations, infrastructure changes, incidents |
| Programmable Money | wallet calls, Safe transactions, account-abstraction flows, settlement intents |

These are examples over one Attestor engine.
They are not separate products and not equal-maturity claims.

## Local Demos

These local demos run repo-side examples through the same decision engine.

| Path | Command | What it shows |
|---|---|---|
| Refund | `npm run demo:golden-refund` | Synthetic support refund, reviewer path, named gaps, no live refund call. |
| Controlled Data Export | `npm run demo:golden-data-export` | Synthetic customer export and report release, no warehouse call. |
| Authority Change | `npm run demo:golden-authority-change` | Synthetic grant, revocation, delegation, and approval scenarios. |
| External Communication | `npm run demo:golden-external-communication` | Synthetic customer-facing, legal, billing, support, and public-message review path. |
| Operational Execution | `npm run demo:golden-operational-execution` | Synthetic deploy, rollback, secret rotation, incident, and runbook path. |
| Programmable Money | `npm run demo:golden-programmable-money` | Synthetic wallet-facing intent. It does not sign, broadcast, call a wallet, or prove settlement. |

For a guided first run, see [Try Attestor first](docs/01-overview/try-attestor-first.md).
For an integration path, see [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md).

## Current Repository Truth

Attestor is an **evaluation release**.

It is reviewer-runnable, CI-backed, and useful for technical evaluation.
It is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

Current baseline:

```text
Package version: 0.2.0-evaluation
Tag target:      v0.2.0-evaluation
Release type:    GitHub pre-release / Golden Path evaluation baseline
```

Green local checks are repo-side evidence only.
They do not prove live cloud infrastructure, live customer enforcement, external KMS/HSM signing, shared replay stores, production readiness, or enterprise readiness.

Production control requires live customer no-bypass proof:

```text
direct downstream bypass must fail
valid Attestor decision must pass
replay must fail across instances
proof must remain reviewable
```

This repository is source-available under Business Source License 1.1.
Non-production use is allowed.
Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

## Data Posture

Attestor is a control point, not a data lake.

It does not need all customer data.
It needs enough structured action context and proof references to decide whether the action is sufficiently bound.

Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path.
They also keep the system of record.
Attestor returns a bounded decision, reasons, and proof references.

Attestor is not the model, an agent runtime, a chat wrapper, a generic workflow app, a wallet, a custody platform, a payment processor, or a permission slip for AI actions without customer-side enforcement.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) forbids raw prompts, raw tool payloads, raw customer identifiers, bank/payment data, wallet material, credentials, private policy thresholds, and downstream error bodies in public evidence surfaces.

## Decision Model

Attestor never returns an open-ended "looks good."

| Decision | Meaning |
|---|---|
| `admit` | The proposed action may proceed. |
| `narrow` | Only a safer bounded version may proceed. |
| `review` | The action must wait for review. |
| `block` | The action is rejected fail-closed. |

## Proof Model

Proof material can include:

- decision and reason records
- canonical digests and evidence references
- signed packets and certificates when signing is configured
- tamper-evident local history
- release and CI evidence for repo review

Read proof material as typed evidence, not a universal cryptographic guarantee.
It does not automatically prove external facts, third-party immutability, production signing authority, or live customer deployment.

Run the local proof surface if you want the repo-side evidence packet:

```bash
npm run proof:surface
```

The command writes `.attestor/proof-surface/latest/manifest.json`.
It is a local static proof surface. It does not start a hosted console or claim a public hosted crypto route.

## Start Here

- [Repository navigator](docs/01-overview/repository-navigator.md)
- [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)
- [Try Attestor first](docs/01-overview/try-attestor-first.md)
- [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)
- [Golden Path: External Communication](docs/02-architecture/golden-external-communication-shadow-pilot.md)
- [Golden Path: Operational Execution](docs/02-architecture/golden-operational-execution-shadow-pilot.md)
- [Golden Path: Programmable Money](docs/02-architecture/golden-programmable-money-shadow-pilot.md)
- [First hosted API call](docs/01-overview/hosted-first-api-call.md)
- [Shadow event payload examples](docs/01-overview/shadow-event-payload-examples.md)
- [Customer middleware examples](examples/customer-middleware/README.md)
- [Agent retry wrapper demo](docs/01-overview/agent-retry-wrapper-demo.md): `npm run example:agent-retry-wrapper`
- [Non-bypassable gateway demo](docs/01-overview/non-bypassable-gateway-demo.md): `npm run example:non-bypassable-gateway`
- [Customer integration recipes](docs/01-overview/customer-integration-recipes.md)
- [Customer admission gate](docs/01-overview/customer-admission-gate.md)
- [Pricing and packaging](docs/01-overview/product-packaging.md)
- [Security Policy](SECURITY.md)

## Maintainer Reference

### Evaluation and reviewer paths

- [What you can do with Attestor](docs/01-overview/what-you-can-do.md)
- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.2.0 evaluation release notes](docs/00-evaluation/v0.2.0-evaluation-release-notes.md)
- [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md)
- [Attestor operating model](docs/01-overview/operating-model.md)
- [Controlled Data Export](docs/02-architecture/golden-data-export-shadow-pilot.md)
- [Hosted action authorization API](docs/01-overview/hosted-action-authorization-api.md)
- [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md)
- [Non-bypassable gateway demo](docs/01-overview/non-bypassable-gateway-demo.md)
- [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)

Policy Foundry evaluator notes:

- Policy Foundry is the onboarding layer for this adoption path. It does not train models, write policy automatically, or prove production readiness.
- Customers cannot self-attest readiness controls; readiness evidence must come from trusted runtime, operator, reviewer, or downstream integration evidence.
- It keeps reviewed outcome feedback, drift/policy-debt findings, active questions, and candidate evidence as review material.
- It generates a red-team fixture bundle and local replay reports through the local adversarial replay executor.
- It can attach live downstream replay evidence when configured, but that remains live evidence, not a repo-side production claim.
- The hosted onboarding workflow contract packages the hosted review surface, wizard state, entitlement context, and storage-readiness checks.
- Hosted route: `/api/v1/shadow/policy-foundry/hosted-onboarding-workflow`.
- The hosted UI flow can be previewed locally with `preview:policy-foundry-hosted-ui` and safe fixtures only.
- Local self-onboarding uses `npm run policy-foundry:self-onboard` and renders session, coverage, blockers, gate plan, handoff, red-team fixtures.
- For an already deployed hosted runtime, the opt-in Policy Foundry production smoke probe checks the route contract without proving production readiness.
- Safety boundary: hosted onboarding returns review material only.
- [Policy Foundry onboarding](docs/02-architecture/policy-foundry-onboarding.md)

### Architecture, proof, and deployment

The machine-readable role contract is exported from `attestor/consequence-admission`.

- [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md)
- [Attestor language contract](docs/02-architecture/attestor-language-contract.md)
- [Glossary](docs/02-architecture/glossary.md)
- [Attestor unlock source of truth](docs/02-architecture/attestor-unlock-source-of-truth.md)
- [Consequence admission public surface](docs/02-architecture/consequence-admission-public-surface.md)
- [Service organization plan](docs/02-architecture/service-organization-plan.md)
- [Scripts inventory](docs/02-architecture/scripts-inventory.md)
- [Consequence taxonomy](docs/02-architecture/consequence-taxonomy.md)
- [Agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md)
- [Adapter framework](docs/02-architecture/adapter-framework.md)
- [Domain pack boundary](docs/02-architecture/domain-pack-boundary.md)
- [Domain consequence recipes](docs/02-architecture/domain-consequence-recipes.md)
- [Integration mode readiness](docs/02-architecture/integration-mode-readiness.md)
- [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md)
- [Downstream presentation binding](docs/02-architecture/downstream-presentation-binding.md)
- [Downstream execution receipt](docs/02-architecture/downstream-execution-receipt.md)
- [External review packet](docs/02-architecture/external-review-packet.md)
- [Verifier helper](docs/02-architecture/verifier-helper.md)
- [Evidence state model](docs/02-architecture/evidence-state-model.md)
- [Data minimization redaction policy](docs/02-architecture/data-minimization-redaction-policy.md)
- [Audit evidence export](docs/02-architecture/audit-evidence-export.md)
- [Business risk dashboard](docs/02-architecture/business-risk-dashboard.md)
- [Dashboard API summary](docs/02-architecture/dashboard-api-summary.md)
- [Tamper-evident history](docs/02-architecture/tamper-evident-history.md)
- [Failure mode registry](docs/02-architecture/failure-mode-registry.md)
- [Crypto intelligence buildout](docs/02-architecture/crypto-intelligence-buildout.md)
- [General Crypto Transaction Gate](docs/02-architecture/general-crypto-transaction-gate.md)
- [LLM provider runtime decision](docs/02-architecture/llm-provider-runtime-decision.md)
- [Action surface graph](docs/02-architecture/action-surface-graph.md)
- [Action surface manifest intake](docs/02-architecture/action-surface-manifest-intake.md)
- [Action surface declaration ingestors](docs/02-architecture/action-surface-declaration-ingestors.md)
- [Action surface integration artifacts](docs/02-architecture/action-surface-integration-artifacts.md)
- [Action surface profiler](docs/02-architecture/action-surface-profiler.md)
- [Active Question Engine](docs/02-architecture/active-question-engine.md)
- [Approval/dismiss feedback loop](docs/02-architecture/approval-dismiss-feedback-loop.md)
- [Adversarial evidence fixtures](docs/02-architecture/adversarial-evidence-fixtures.md)
- [Counterexample replay generator](docs/02-architecture/counterexample-replay-generator.md)
- [Pilot readiness packet](docs/02-architecture/pilot-readiness-packet.md)
- [Policy Candidate PR contract](docs/02-architecture/policy-candidate-pr-contract.md)
- [Policy Twin backtest](docs/02-architecture/policy-twin-backtest.md)
- [Policy limit model](docs/02-architecture/policy-limit-model.md)
- [Enterprise integration recipes](docs/02-architecture/enterprise-integration-recipes.md)
- [Reason codes](docs/05-proof/reason-codes.md)
- [Failure modes and controls](docs/05-proof/failure-modes-and-controls.md)
- [Review-by-exception inbox](docs/02-architecture/review-by-exception-inbox.md)
- [Retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md)
- [Presentation replay ledger](docs/02-architecture/presentation-replay-ledger.md)
- [Production runtime hardening](docs/02-architecture/production-runtime-hardening-buildout.md)
- [Production shared authority plane](docs/02-architecture/production-shared-authority-plane-buildout.md)
- [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md)
- [Audit remediation tracker](docs/audit/attestor-audit-remediation-tracker.md)
- [Proof model](docs/05-proof/proof-model.md)
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)
- [Production readiness](docs/08-deployment/production-readiness.md)
- [Proof surface tracker](docs/02-architecture/proof-console-buildout.md)
- [Pricing ROI calculator](docs/01-overview/pricing-roi-calculator.md)
- [Hosted customer journey](docs/01-overview/hosted-customer-journey.md)
- [Hosted account visibility](docs/01-overview/hosted-account-visibility.md)
- [Attestor internal machine map](docs/02-architecture/attestor-internal-machine-map.md)
- Render an action-surface onboarding packet with `npm run render:action-surface-onboarding-packet`.
- Run the checked example with `npm run example:action-surface-onboarding`.
- Hosted action-surface onboarding route: `POST /api/v1/shadow/action-surface/onboarding-packet`.
- The same packet path produces a review handoff checklist for human approval before any enforcement promotion.
- Run the refund reviewer sandbox with `npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json`.
- [Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md)
