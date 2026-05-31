<p align="center">
  <img src="docs/assets/attestor-readme-logo.png" alt="Attestor" width="100%">
</p>

**Control infrastructure for high-risk AI-driven operations.**

Attestor sits between an AI-prepared operation and the system that would execute it.

Prompts guide. They do not enforce.

Unsafe proposed requests can come from hallucination, stale context, poisoned
tool output, replayed requests, missing approval, or hostile content.

A prompt cannot stop a refund service, export job, identity admin, deploy tool, or wallet adapter.

The stop point has to sit before execution: check the structured request,
then return `admit`, `narrow`, `review`, or `block`.

Hostile content still has to pass authority, scope, freshness, replay,
and evidence checks before anything runs.

Every decision leaves a trail: what was proposed, what was checked, why it held
or blocked, reason codes, and evidence/proof references.

## One Concrete Workflow

A support AI prepares: **Refund $8,750 to customer_123 for order_789.**

The risky part is the next call: `refundService.issueRefund(...)`.

The gate stops it before the service runs: manager approval is missing,
order/customer binding is incomplete, and duplicate-refund risk is visible.

Without this gate, that AI-prepared request can become a real refund call.
With a customer-owned gate, no money moves. The trail remains: proposed request,
stop reason, reason codes, evidence references, proof references, and the next
safe step.

The repo demo is synthetic and shadow-only. It does not call Stripe, Shopify, a
bank, or a live customer deployment.

[Run the demos in order](docs/01-overview/demo-guide.md)

## Why This Matters Now

AI systems are moving from chat into tools that can touch payments, data,
access, customer messages, infrastructure, and programmable money.

That is no longer a prompt-quality problem. Teams need a stop point before
execution, and a record after review: who asked, what was checked, why it held
or blocked, and what may run next.

Context anchors: [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai), [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework), and [DORA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554). These are not compliance claims.

## What It Does

It checks policy, approval, evidence, allowed scope, freshness, replay, tenant,
token, and proof references. It returns one decision with reasons: `admit`,
`narrow`, `review`, or `block`.

The real service should run only through the customer-owned gate.

```text
AI agent
  -> proposes an operation
Attestor
  -> admit / narrow / review / block + reasons and proof references
Customer-owned gate
  -> calls the real service only when allowed
```

Without a customer-side gate, gateway, verifier, or adapter, the decision is
evidence, not enforcement. With that downstream point, it becomes the stop point.

### Run Attestor in shadow pilot mode - and map what your AI agents are trying to do in the shadow of your systems.

[Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md)

## The Same Pattern Across Operations

The same gate can sit before these operation classes:

| Operation class | Examples |
|---|---|
| Money Movement | refunds, payouts, supplier payments, credits, adjustments |
| Data Movement | customer exports, warehouse queries, report releases |
| Authority Change | grants, revocations, unlocks, approvals, delegations |
| External Communication | customer-facing, legal, billing, support, public messages |
| Operational Execution | deploys, secret rotations, infrastructure changes, incidents |
| Programmable Money | wallet calls, Safe transactions, account-abstraction flows, settlement intents |

## Current State

```text
Package version: 0.2.0-evaluation
Tag target:      v0.2.0-evaluation
Release stage:   evaluation release
Release type:    GitHub pre-release / Golden Path evaluation baseline
```

This is an evaluation release. It is not public SaaS, a production guarantee, a
completed customer deployment, or a substitute for an external security audit.

## Data Posture

This is a control point, not a data lake.

It needs structured request context and proof references, not raw customer data.
Customer systems keep the model, agent, workflow, wallet, database, service
call, and system of record.

It returns a bounded decision, reasons, and proof references.

It is not a model, agent runtime, chat wrapper, workflow app, wallet, custody layer, or payment processor.
Without a customer-owned gate, it is evidence, not enforcement.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) keeps raw prompts, tool payloads, customer identifiers, bank/payment data, wallet material, credentials, private thresholds, and downstream error bodies out of public evidence surfaces.

## Start Here

Start light. Go deeper only when you need the detail.

- [Try Attestor first](docs/01-overview/try-attestor-first.md) - run the smallest local refund path and see the decision trail.
- [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md) - find the real side effect and place the customer-owned gate.
- [Action surface auto-context](docs/02-architecture/action-surface-auto-context.md) - start from MCP, OpenAPI, AsyncAPI, workflow, or telemetry metadata; output stays review material, not enforcement.
- [Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md) - turn reviewed metadata into a review-required integration plan.
- [Action surface integration kit buildout](docs/02-architecture/action-surface-integration-kit-buildout.md) - render review files from existing metadata before any apply or deploy step.
- Hosted packet route: `POST /api/v1/shadow/action-surface/onboarding-packet` - render a stateless review packet.
- [Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md) - send observe-mode examples before enforcing anything.
- [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md) - use the shared admission shape and decision vocabulary.
- [Repository navigator](docs/01-overview/repository-navigator.md) - find deeper docs for hosted, pricing, support, proof, or maintainer work.
- [License and use](docs/01-overview/license-and-use.md) and [Security Policy](SECURITY.md) - understand use boundaries and reporting.
