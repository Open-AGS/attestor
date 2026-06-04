# Run The Local Evaluation Path

Use this as the local evaluation path. Write the local evaluation package first,
then open the refund, all-pack sweep, or integration-shape example closest to
your system.

This path is synthetic and repo-side. It does not call Stripe, Shopify,
warehouses, identity providers, deploy systems, wallets, banks, or customer
production infrastructure.

## 1. Write The Local Evaluation Package

Use this for one local folder with the human summary, decision trail, refund
path, and no-claim boundary.

```bash
npm ci
npm run evaluate:local
```

The default artifact root is `.attestor/evaluation/latest`.

## 2. Start With The Refund

Shortest path: one AI-prepared refund, checked before the refund service can
run.

```bash
npm run demo:golden-refund
npm run demo:golden-refund -- --json
```

Stop when you can explain the action, the stop reason, the proof references,
and why no live refund ran.

## 3. Run All Action Classes

Use this for the whole local picture in one command.

```bash
npm run demo:golden-paths
npm run demo:golden-paths -- --json
```

Stop when you can name the six action classes and the risk each one represents.

## 4. Pick The Action Class You Care About

| Demo | What it shows | Run | Read |
|---|---|---|---|
| Refund | money movement before a refund service call | `npm run demo:golden-refund` | [Golden Path: Refund](../02-architecture/golden-refund-shadow-pilot.md) |
| Data export | data movement before a customer export | `npm run demo:golden-data-export` | [Golden Path: Data Export](../02-architecture/golden-data-export-shadow-pilot.md) |
| Authority change | grants, revocations, unlocks, approvals, delegations | `npm run demo:golden-authority-change` | [Golden Path: Authority Change](../02-architecture/golden-authority-change-shadow-pilot.md) |
| External communication | customer, legal, billing, support, or public messages | `npm run demo:golden-external-communication` | [Golden Path: External Communication](../02-architecture/golden-external-communication-shadow-pilot.md) |
| Operational execution | deploys, rollbacks, secret rotations, infrastructure changes | `npm run demo:golden-operational-execution` | [Golden Path: Operational Execution](../02-architecture/golden-operational-execution-shadow-pilot.md) |
| Programmable money | wallet, Safe, account-abstraction, or settlement actions | `npm run demo:golden-programmable-money` | [Golden Path: Programmable Money](../02-architecture/golden-programmable-money-shadow-pilot.md) |

## 5. See The Integration Shape

These examples are smaller than an SDK. They show where the check sits in a
customer application.

| If you want to see... | Run | Read |
|---|---|---|
| the smallest admission call | `npm run example:admission` | [Try Attestor first](try-attestor-first.md) |
| a customer gate decision shape | `npm run example:customer-gate` | [Customer admission gate](customer-admission-gate.md) |
| a protected adapter that cannot dispatch without allow | `npm run example:non-bypassable-gateway` | [Non-bypassable gateway demo](non-bypassable-gateway-demo.md) |
| bounded retry feedback for an agent | `npm run example:agent-retry-wrapper` | [Agent retry wrapper demo](agent-retry-wrapper-demo.md) |
| action-surface onboarding from an OpenAPI file | `npm run example:action-surface-onboarding` | [Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md) |
| integration kit review files from an OpenAPI file | `npm run example:action-surface-integration-kit` | [Action surface integration kit buildout](../02-architecture/action-surface-integration-kit-buildout.md) |

## What This Local Path Does Not Prove

It does not prove live customer enforcement, customer PEP no-bypass,
production readiness, external KMS signing, live settlement, live data export,
or compliance.

It proves the repo-side shape: proposed action, checks, outcome, reason codes,
and proof references.

## Next

- To wire a real app, read [How to integrate Attestor](how-to-integrate-attestor.md).
- To send event-shaped data first, read [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md).
- To explain a `review` or `block`, read [Reason codes](../05-proof/reason-codes.md).
