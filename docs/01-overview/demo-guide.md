# Demo Guide

Use this when you want to run Attestor locally and see the product shape before
reading architecture.

The demos are synthetic and repo-side. They do not call Stripe, Shopify,
warehouses, identity providers, deploy systems, wallets, banks, or customer
production infrastructure.

## Run The Demos In Order

### 1. Start With The Refund

This is the shortest path to the core idea: an AI-prepared refund is checked
before the refund service can run.

```bash
npm ci
npm run demo:golden-refund
npm run demo:golden-refund -- --json
```

Stop when you can explain:

- what action the AI prepared
- why the refund was held or blocked
- what reason codes and proof references remain
- why no live refund was executed

### 2. Run All Action Classes

Use this when you want the whole local picture in one command.

```bash
npm run demo:golden-paths
npm run demo:golden-paths -- --json
```

Stop when you can name the six action classes and the risk each one represents.

### 3. Pick The Action Class You Care About

| If your AI can... | Run | Read |
|---|---|---|
| issue refunds, payouts, credits, or adjustments | `npm run demo:golden-refund` | [Golden Path: Refund](../02-architecture/golden-refund-shadow-pilot.md) |
| export customer data or release reports | `npm run demo:golden-data-export` | [Golden Path: Data Export](../02-architecture/golden-data-export-shadow-pilot.md) |
| grant, revoke, unlock, approve, or delegate authority | `npm run demo:golden-authority-change` | [Golden Path: Authority Change](../02-architecture/golden-authority-change-shadow-pilot.md) |
| send customer, legal, billing, support, or public messages | `npm run demo:golden-external-communication` | [Golden Path: External Communication](../02-architecture/golden-external-communication-shadow-pilot.md) |
| deploy, roll back, rotate secrets, or touch infrastructure | `npm run demo:golden-operational-execution` | [Golden Path: Operational Execution](../02-architecture/golden-operational-execution-shadow-pilot.md) |
| prepare wallet, Safe, account-abstraction, or settlement actions | `npm run demo:golden-programmable-money` | [Golden Path: Programmable Money](../02-architecture/golden-programmable-money-shadow-pilot.md) |

### 4. See The Integration Shape

These examples are smaller than an SDK. They show where the check sits in a
customer application.

| If you want to see... | Run | Read |
|---|---|---|
| the smallest admission call | `npm run example:admission` | [Try Attestor first](try-attestor-first.md) |
| a customer gate decision shape | `npm run example:customer-gate` | [Customer admission gate](customer-admission-gate.md) |
| a protected adapter that cannot dispatch without allow | `npm run example:non-bypassable-gateway` | [Non-bypassable gateway demo](non-bypassable-gateway-demo.md) |
| bounded retry feedback for an agent | `npm run example:agent-retry-wrapper` | [Agent retry wrapper demo](agent-retry-wrapper-demo.md) |
| action-surface onboarding from an OpenAPI file | `npm run example:action-surface-onboarding` | [Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md) |

## What These Demos Do Not Prove

They do not prove live customer enforcement, customer PEP no-bypass,
production readiness, external KMS signing, live settlement, live data export,
or compliance.

They prove the repo-side shape: proposed action, checks, outcome, reason codes,
and proof references.

## Next

- To wire a real app, read [How to integrate Attestor](how-to-integrate-attestor.md).
- To send event-shaped data first, read [Shadow event payload examples](shadow-event-payload-examples.md).
- To explain a `review` or `block`, read [Reason codes](../05-proof/reason-codes.md).
