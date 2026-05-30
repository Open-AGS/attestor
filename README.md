<p align="center">
  <img src="docs/assets/attestor-readme-logo.png" alt="Attestor" width="720">
</p>

# Attestor

**A gate for high-risk AI actions.**

Attestor sits between what an AI wants to do and the system that would do it.

It does not try to make the model perfect.
It controls the proposed action before a customer system acts.

Prompts guide. They do not enforce.

A prompt can guide an AI. It cannot stop a refund service, export job, identity
admin, deploy tool, or wallet adapter when the proposed action is hallucinated, manipulated, replayed, over-scoped, or missing approval.

The stop point has to sit before the real action. Attestor checks the structured
action and returns `admit`, `narrow`, `review`, or `block`.

## One Concrete Workflow

A support AI prepares: **Refund $8,750 to customer_123 for order_789.**

The dangerous part is the next call: `refundService.issueRefund(...)`.

Attestor stops it before the service runs because manager approval is missing,
the order/customer binding is incomplete, and duplicate-refund risk is visible.

Without Attestor, that AI-prepared action can become a real refund call.
With Attestor and a customer-owned gate, no money moves. The decision keeps the trail: proposed action, reason codes, evidence references, and proof references.

This repository demo is synthetic and shadow-only. It does not call Stripe, Shopify, a bank, or a live customer deployment.

[Run the demos in order](docs/01-overview/demo-guide.md)

## Why This Matters Now

AI systems are moving from chat into tools that can touch payment flows, data exports, access changes, customer messages, infrastructure, and programmable money.

That is no longer only a prompt-quality problem. Teams need a stop point before
execution and a record after review: who asked, what was checked, why it held or
blocked, and what may run next.

Context anchors: [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai), [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework), and [DORA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554). These are not compliance claims.

## What Attestor Does

Attestor checks the proposed action: policy, approval, evidence, allowed scope, freshness, replay, tenant, token, and proof references.
It returns one decision with reasons: `admit`, `narrow`, `review`, or `block`.

The real service should run only through the customer-owned gate.

```text
AI agent
  -> AI proposes action
Attestor
  -> admit / narrow / review / block + reasons and proof references
Customer-owned gate
  -> calls the real service only when allowed
```

Without an enforced customer-side gate, gateway, verifier, or adapter, Attestor is advisory evidence.
With that enforced downstream point, Attestor becomes the stop point before action.

Run Attestor in shadow pilot mode - and map what your AI agents are trying to do in the shadow of your systems.

[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md)

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

It needs structured action context and proof references, not raw customer data.
Customer systems keep the model, agent, workflow, wallet, database, downstream
execution path, and system of record.

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
