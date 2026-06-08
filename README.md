<p align="center">
  <img src="docs/assets/attestor-readme-logo.png" alt="Attestor" width="100%">
</p>

<p align="center">
  <a href="docs/00-evaluation/v0.3.0-evaluation-release-notes.md"><img alt="version 0.3.0-evaluation" src="https://img.shields.io/badge/version-0.3.0--evaluation-334155"></a>
  <a href="docs/research/cross-domain-pattern-sources.md"><img alt="NIST AI RMF mapped" src="https://img.shields.io/badge/NIST%20AI%20RMF-mapped-0369a1"></a>
  <a href="docs/03-governance/iso42001-2023-annex-a-mapping.md"><img alt="ISO 42001 mapped" src="https://img.shields.io/badge/ISO%2042001-mapped-0369a1"></a>
  <a href="docs/02-architecture/data-movement-full-consequence-engine-proof.md#m03b---fail-closed-matrix"><img alt="fail-closed locked" src="https://img.shields.io/badge/fail--closed-locked-16a34a"></a>
</p>

<p align="center"><sub>Badges point to repository evidence.</sub></p>

<p align="center">
  <a href="docs/01-overview/how-attestor-connects-to-existing-systems.md"><strong>How Attestor connects to existing systems</strong></a>
</p>

**Control infrastructure for high-risk AI-driven operations.**

Attestor sits between an AI-prepared operation and the system that would execute it.
Prompts can guide behavior, but they cannot enforce it or stop a real service call.

Unsafe requests can come from hallucination, stale context, poisoned tool output,
replay, missing approval, or hostile content. Before anything runs, Attestor checks
policy, authority, scope, freshness, replay, and evidence, then returns `admit`,
`narrow`, `review`, or `block`.

With a customer-owned gate in place, the downstream action stays behind that
decision. The trail records what was proposed, what was checked, and why it was
held or allowed.

## Why This Matters Now

AI systems are moving from chat into tools that can touch payments, data,
access, customer messages, infrastructure, and programmable money.

That is no longer a prompt-quality problem. Teams need a stop point before
execution, and a record after review: who asked, what was checked, why it held
or blocked, and what may run next.

Context anchors: [EU AI Act](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai), [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework), and [DORA](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554). These are not compliance claims.

## What It Does

Attestor translates AI intent into a structured consequence, then reduces it to
a decision, gate status, and proof references.

It checks policy, approval, evidence, allowed scope, freshness, replay, tenant,
and token, then returns one bounded decision with reasons: `admit`, `narrow`,
`review`, or `block`.

The real service should run only through the customer-owned gate.

System metadata can show where risky actions are forming. Existing APIs, tools,
jobs, telemetry, events, and gateway logs can become review material for
action discovery, rule drafts, admission decisions, customer gates, and proof.

[View the full consequence path map](docs/02-architecture/attestor-internal-machine-map.md)

```text
AI agent
  -> proposes an operation
Attestor
  -> admit / narrow / review / block + reasons and proof references
Customer-owned gate
  -> calls the real service only when allowed
```

Without a customer-side gate, the decision is evidence, not enforcement. With
that [downstream point](docs/02-architecture/downstream-enforcement-contract.md),
it becomes the stop point.

### Run Attestor in shadow pilot mode

Observe mode shows what actions agents would try, why they may be risky, and
which policy, approval, and evidence are present. You see the risk before a
real service runs.

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
Package version: 0.3.0-evaluation
Release tag:     pending
Release stage:   evaluation baseline
Release type:    repository baseline / multi-path local review
```

This baseline is for local review and integration planning. Live customer
deployment and external security audit are separate proof steps.

## Data Posture

Attestor is a control point, not a data lake. It needs structured request
context and proof references, not raw customer data. Customer systems keep the
model, agent, workflow, wallet, database, service call, and system of record.

[Security and data handling](docs/01-overview/security-and-data-handling.md)

## Start Here

Start light. Go deeper only when you need the detail.
If you are new, follow this order: [local run](docs/01-overview/try-attestor-first.md), [shadow pilot](docs/01-overview/shadow-event-payload-examples.md), then [customer gate](docs/01-overview/customer-admission-gate.md).

- [Try Attestor first](docs/01-overview/try-attestor-first.md) - run the smallest local refund path and see the decision trail.
- [Run Attestor in shadow pilot mode](docs/01-overview/shadow-event-payload-examples.md) - observe one real action path before enforcing anything.
- [How to integrate Attestor](docs/01-overview/how-to-integrate-attestor.md) - find the real side effect and place the customer-owned gate.
- [Repository navigator](docs/01-overview/repository-navigator.md) - find deeper docs for hosted, pricing, support, proof, or maintainer work.

Use boundaries: [License and use](docs/01-overview/license-and-use.md) and [Security Policy](SECURITY.md).
