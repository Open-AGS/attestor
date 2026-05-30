<p align="center">
  <img src="docs/assets/attestor-readme-logo.png" alt="Attestor" width="720">
</p>

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
Plain-language summary: [License and use](docs/01-overview/license-and-use.md).

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

Pick the shortest useful path. Do not read the whole repository first.

- Find the right page: [Docs front door](docs/README.md) and [Repository navigator](docs/01-overview/repository-navigator.md)
- Run the concrete refund workflow: [Try Attestor first](docs/01-overview/try-attestor-first.md)
- Put Attestor before a real service call: [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md)
- Copy framework-shaped examples: [Customer middleware examples](examples/customer-middleware/README.md)
- Send shadow events without an SDK: [Shadow event payload examples](docs/01-overview/shadow-event-payload-examples.md)
- Explain a `review` or `block`: [Reason codes](docs/05-proof/reason-codes.md)
- Make the first hosted request: [First hosted API call](docs/01-overview/hosted-first-api-call.md)
- Understand what the license allows: [License and use](docs/01-overview/license-and-use.md)

## Maintainer Reference

Use this after you already know what Attestor does.

- [Docs front door](docs/README.md)
- [Repository navigator](docs/01-overview/repository-navigator.md)
- [Repository map](docs/01-overview/repository-map.md)
- [Test system map](docs/02-architecture/test-system-map.md)
- [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md)
- [Attestor language contract](docs/02-architecture/attestor-language-contract.md)
- [Glossary](docs/02-architecture/glossary.md)
- [Domain pack boundary](docs/02-architecture/domain-pack-boundary.md)
- [Consequence admission public surface](docs/02-architecture/consequence-admission-public-surface.md)
- [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md)
- [Audit evidence system](docs/audit/README.md)
- [Current posture baseline](docs/audit/current-posture-baseline.md)
- [Live proof register](docs/audit/live-proof-register.md)
- [Security Policy](SECURITY.md)
