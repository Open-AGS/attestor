<p align="center">
  <img src="docs/assets/attestor-readme-logo.png" alt="Attestor" width="720">
</p>

# Attestor

**A gate for high-risk AI actions.**

Attestor sits between what an AI wants to do and the system that would do it.

It does not try to make the model perfect.
It controls the proposed action before a customer system acts.

Prompts guide. They do not enforce.

A prompt can guide an AI, but it cannot stop a refund service, export job, identity admin, deploy tool, or wallet adapter when the proposed action is hallucinated, manipulated, replayed, over-scoped, or missing approval. The stop point has to sit before the real action. Attestor checks the structured action and returns `admit`, `narrow`, `review`, or `block`.

## One Concrete Workflow

A support AI prepares a refund: **Refund $8,750 to customer_123 for order_789.**

The dangerous step is not the sentence.
It is the service call after it: `refundService.issueRefund(...)`.

Attestor checks the structured action before that call:

- the order belongs to the customer
- the payment exists and was not already refunded
- the amount is inside policy
- manager approval is attached and valid
- the refund service is reachable only through the customer-owned gate

Outcome: **block before the refund service runs.**

Reason: manager approval is missing; order/customer binding is incomplete; duplicate-refund risk is present.

Without Attestor, the AI-prepared refund can become an executable service call.
With Attestor and a customer-owned gate, the call does not run. The decision leaves a reviewable trail: proposed action, reason codes, evidence references, and proof references.

In this repository, the refund path is synthetic and shadow-only. It does not call Stripe, Shopify, a bank, or a live customer deployment.

Run it:

```bash
npm ci
npm run demo:golden-refund
npm run demo:golden-refund -- --json
```

The output shows what was checked, why the action held or blocked, and which
proof references remain.

Want the full local path? [Run the demos in order](docs/01-overview/demo-guide.md) - refund first, then the six action classes, then the integration-shape examples.

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
[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md) - map what your AI agents are trying to do in the shadow of your systems.

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

## Current State

```text
Package version: 0.2.0-evaluation
Tag target:      v0.2.0-evaluation
Release stage:   evaluation release
Release type:    GitHub pre-release / Golden Path evaluation baseline
```

Attestor is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

## Data Posture

Attestor is a control point, not a data lake.

It does not need all customer data.
It needs enough structured action context and proof references to decide whether the action is sufficiently bound.

Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path.
They also keep the system of record.
Attestor returns a bounded decision, reasons, and proof references.

Attestor is not the model, an agent runtime, a chat wrapper, a generic workflow app, a wallet, a custody platform, a payment processor, or a permission slip for AI actions without customer-side enforcement.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) forbids raw prompts, raw tool payloads, raw customer identifiers, bank/payment data, wallet material, credentials, private policy thresholds, and downstream error bodies in public evidence surfaces.

## Start Here

Use one entry point first. It opens the rest.

- [Repository navigator](docs/01-overview/repository-navigator.md) - choose the right path for reading, integrating, verifying, or changing code.
- [Try Attestor first](docs/01-overview/try-attestor-first.md) - run the refund workflow.
- [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md) - place the check before a real service call.
- [Reason codes](docs/05-proof/reason-codes.md) - explain a `review` or `block`.
- [License and use](docs/01-overview/license-and-use.md) - understand allowed use.
- [Security Policy](SECURITY.md) - report vulnerabilities and review security scope.
