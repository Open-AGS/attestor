# Attestor

**Control infrastructure for high-risk AI actions.**

Attestor sits between AI intent and real-world action.

It does not try to make the model perfect.
It controls the proposed action before a customer system acts.

Prompts guide. They do not enforce.

A prompt is not a formal rule; it is linguistic context interpreted by a probabilistic model. That makes it useful for guidance, but insufficient as deterministic control. The control point has to move from the model's text to the proposed action: the action intent can be structured, checked, admitted, narrowed, reviewed, or blocked before it becomes a real consequence.

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

With Attestor and a customer enforcement point:

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

Then run all local golden paths:

```bash
npm run demo:golden-paths
npm run demo:golden-paths -- --json
```

## How It Works

The dangerous moment is not the text the model produced.
It is the moment that text becomes a refund, data export, permission change, deploy, customer message, or wallet transaction.

Attestor checks policy, authority, evidence, scope, freshness, replay, tenant, token, and proof.
Downstream action executes only through the customer PEP / gate.

```text
AI agent
  -> proposed action
Attestor
  -> checks policy, authority, evidence, scope, freshness, replay, tenant, token, and proof
  -> admit / narrow / review / block + proof
Customer PEP / gateway
  -> downstream executes only if admitted
```

Without an enforced customer-side PEP, gateway, verifier, or adapter, Attestor is advisory evidence.
With that enforced downstream point, Attestor becomes the control point before action.

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

These are domain packs over one Attestor engine.
They are not separate products and not equal-maturity claims.

## Local Golden Paths

Golden paths are repo-side examples through the shared control engine.

| Path | Command | What it shows |
|---|---|---|
| Refund | `npm run demo:golden-refund` | Synthetic support refund, reviewer path, named gaps, no live refund call. |
| Controlled Data Export | `npm run demo:golden-data-export` | Synthetic customer export and report release, no warehouse call. |
| Authority Change | `npm run demo:golden-authority-change` | Synthetic grant, revocation, delegation, and approval scenarios. |
| External Communication | `npm run demo:golden-external-communication` | Synthetic customer-facing, legal, billing, support, and public-message review path. |
| Operational Execution | `npm run demo:golden-operational-execution` | Synthetic deploy, rollback, secret rotation, incident, and runbook path. |
| Programmable Money | `npm run demo:golden-programmable-money` | Synthetic wallet-facing intent. It does not sign, broadcast, call a wallet, or prove settlement. |

For a guided first run, see [Try Attestor first](docs/01-overview/try-attestor-first.md).

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

Production control requires live customer PEP proof:

```text
direct downstream bypass must fail
valid Attestor decision must pass
replay must fail across instances
proof must remain reviewable
```

This repository is source-available under Business Source License 1.1.
Non-production use is allowed.
Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

## Scope And Limitations

Attestor is a control point, not a data lake.

It does not need all customer data.
It needs enough structured action context and proof references to decide whether the action is sufficiently bound.

Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path.
They also keep the system of record.
Attestor returns a bounded decision, reasons, and proof references.

Proof material can include:

- decision and reason records
- canonical digests and evidence references
- signed packets and certificates when signing is configured
- tamper-evident local history
- release and CI evidence for repo review

Read proof material as typed evidence, not a universal cryptographic guarantee.
It does not automatically prove external facts, third-party immutability, production signing authority, or live customer deployment.

Attestor is not the model, an agent runtime, a chat wrapper, a generic workflow app, a wallet, a custody platform, a payment processor, or a permission slip for AI actions without customer-side enforcement.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) forbids raw prompts, raw tool payloads, raw customer identifiers, bank/payment data, wallet material, credentials, private policy thresholds, and downstream error bodies in public evidence surfaces.

Run the local proof surface if you want the repo-side evidence packet:

```bash
npm run proof:surface
```

The command writes `.attestor/proof-surface/latest/manifest.json`.
It is a local static proof surface. It does not start a hosted console or claim a public hosted crypto route.

## Decision Model

Attestor never returns an open-ended "looks good."

| Decision | Meaning |
|---|---|
| `admit` | The proposed action may proceed. |
| `narrow` | Only a safer bounded version may proceed. |
| `review` | The action must wait for review. |
| `block` | The action is rejected fail-closed. |

## Why This Matters Now

AI systems are moving from chat into tools that can touch payment flows, data exports, access changes, customer messages, infrastructure, and programmable money.

That is no longer just a prompt-quality problem.
Teams need to know who asked for the action, what evidence supported it, whether it was replayed, and whether a downstream gate can stop it.

Attestor targets that moment.
It is not a compliance claim, and it is not a production guarantee.

## Start Here

- [Try Attestor first](docs/01-overview/try-attestor-first.md)
- [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)
- [First hosted API call](docs/01-overview/hosted-first-api-call.md)
- [Customer admission gate](docs/01-overview/customer-admission-gate.md)
- [Pricing and packaging](docs/01-overview/product-packaging.md)
- [Security Policy](SECURITY.md)

<details>
<summary>Maintainer reference</summary>

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
- The hosted onboarding workflow packages the hosted review surface, wizard state, entitlement context, and storage-readiness checks.
- Local browser QA uses `preview:policy-foundry-hosted-ui` with safe fixtures only.
- For an already deployed hosted runtime, the opt-in Policy Foundry production smoke probe checks the route contract without proving production readiness.
- Safety boundary: hosted onboarding returns review material only.
- [Policy Foundry onboarding](docs/02-architecture/policy-foundry-onboarding.md)

### Risk and regulation anchors

These links are context anchors, not compliance claims.

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [U.S. Interagency Guidance on Third-Party Relationships](https://www.federalreserve.gov/frrs/guidance/interagency-guidance-on-third-party-relationships.htm)
- [EU Digital Operational Resilience Act](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554)
- [EU AI Act](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1689)

### Architecture, proof, and deployment

The machine-readable role contract is exported from `attestor/consequence-admission`.

- [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md)
- [Attestor language contract](docs/02-architecture/attestor-language-contract.md)
- [Consequence taxonomy](docs/02-architecture/consequence-taxonomy.md)
- [Domain pack boundary](docs/02-architecture/domain-pack-boundary.md)
- [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md)
- [Failure mode registry](docs/02-architecture/failure-mode-registry.md)
- [Review-by-exception inbox](docs/02-architecture/review-by-exception-inbox.md)
- [Retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md)
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
- [Action-surface onboarding red-team fixture bundle](docs/02-architecture/action-surface-onboarding-packet.md)

</details>
