# Attestor

![Attestor: proof before consequence](docs/assets/attestor-readme-hero.png)

AI is already taking actions.

Attestor makes sure those actions don't become real without control.

## TL;DR

Attestor is a control layer for AI actions.

AI proposes -> Attestor decides -> only safe actions execute.

It sits between AI-assisted systems and real-world consequences, then blocks, narrows, reviews, or admits critical actions before downstream systems write, send, file, or execute.

Without Attestor, AI actions can become real by default.
With Attestor, nothing becomes real unless it is allowed.

Attestor does not replace your system. It sits in front of it, controlling what is allowed to become real.

> [!NOTE]
> This repository is source-available under Business Source License 1.1. Non-production use is allowed. Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

> [!IMPORTANT]
> Start reviewer evaluation with the [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md), the [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md), the [Security Policy](SECURITY.md), and the current [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml).

## Why it matters

Without a control layer, AI actions rely on trust.

That breaks the moment something high-risk happens:

- money moves
- records are written
- irreversible actions are triggered

Attestor turns that into a controlled decision: nothing happens unless it is allowed.

## Example

An AI agent tries to send `$50,000`.

Attestor intercepts before the transaction is executed:

- policy requires approval
- no valid authority is present

Result:

- `block`
- no money leaves the system
- the path fails closed instead of becoming a real action

When policy, authority, and evidence pass, Attestor can return `admit` with proof references for later review.

## Decisions

Attestor always returns one of four bounded outcomes:

- `admit` - allow the action
- `narrow` - allow only a safer bounded version
- `review` - require human or external review
- `block` - reject fail-closed

Example decision payload:

```json
{
  "decision": "block",
  "allowed": false,
  "failClosed": true,
  "reason": "Customer gate held the consequence because Attestor returned block.",
  "reasonCodes": [
    "finance-policy-fail",
    "customer-gate-hold"
  ],
  "proofRefs": []
}
```

Allowed paths can also carry proof refs such as `certificate:...` and `verification-kit:...` for later verification.

## Proof

Every allowed or blocked action can produce verifiable decision output.

This includes:

- decision outcome
- policy context
- reason codes
- verification references when available

Proof can be stored, audited, and independently verified later.

## Data and security posture

Attestor is designed as a control point, not a data lake.

It receives the proposed consequence and the evidence needed to decide whether that consequence may proceed. Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path. Attestor returns a bounded decision, reasons, and proof references; it does not need to become the system of record for the customer's raw business data.

What the current evaluation baseline already does:

- production-like runtimes disable anonymous tenant fallback for protected routes
- connector proof paths sanitize connection URLs before exposing them in proof/probe material
- the PostgreSQL proof connector enforces read-only transactions, statement timeouts, row limits, and schema allowlists when configured
- CI runs evaluation smoke, CodeQL, dependency review, and high/critical npm audit gates

The default safety posture is fail-closed: if policy, authority, evidence, freshness, or enforcement checks cannot close, the downstream system should hold, review, or block instead of proceeding silently.

Proof and logs are not a place to dump secrets. Access tokens, private keys, database connection strings, payment details, and sensitive personal data should be masked, hashed, encrypted, or kept out unless a deployment deliberately configures otherwise.

This repository is an evaluation release. Production data handling depends on the chosen hosted or customer-operated deployment, including secrets management, retention, logging, access control, and commercial support boundaries. Start with [Security Policy](SECURITY.md), [Production readiness](docs/08-deployment/production-readiness.md), and [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md).

## What you can do with Attestor

- Prevent AI-assisted systems from sending unauthorized payments.
- Control AI-generated financial records before release.
- Gate programmable-money actions before execution.
- Add policy enforcement to automation systems.
- Require human approval for high-risk actions.

For the longer use-case map, see [What you can do with Attestor](docs/01-overview/what-you-can-do.md).

## Try it in 60 seconds

```bash
npm install
npm run example:admission
```

What you'll see:

- one path is admitted with proof references
- one path is blocked fail-closed
- the downstream gate only proceeds when the decision allows it

For the guided first run, see [Try Attestor first](docs/01-overview/try-attestor-first.md).
For an outside-review packet that explains what to run and what is proven, see [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md).
For the current evaluation release boundary and known limitations, see [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md).
For the first customer-side enforcement step, see [Customer admission gate](docs/01-overview/customer-admission-gate.md).
For copyable placement recipes, see [Customer integration recipes](docs/01-overview/customer-integration-recipes.md).

## How Attestor works in practice

- A customer system proposes a sensitive output, record, action, or programmable-money move.
- It calls Attestor before the downstream system writes, sends, files, or executes that consequence.
- Attestor evaluates active policy, required authority, and evidence requirements.
- Attestor returns a bounded decision: admit, narrow, review, or block, plus proof material.
- The downstream system proceeds only when the decision allows it and otherwise fails closed.
- The result can be reviewed and independently verified later.

For the canonical customer-facing operating model and decision vocabulary, see [Attestor operating model](docs/01-overview/operating-model.md).

## One product, modular packs

Attestor is one product, not a collection of unrelated products.

One product. One platform core. Hosted and customer-operated delivery paths. Modular packs for finance, crypto, and later consequence domains.

The same platform core stays in place across domains: release decisions, policy activation, enforcement verification, and portable authorization objects. Finance and crypto sit on top of that shared core as modular packs.

- **Finance pack:** the strongest proof wedge today
- **Crypto pack:** the programmable-money extension on the same policy / authority / proof / fail-closed model
- **Later packs:** additional consequence domains can attach to the same core without becoming separate primary products by default

Attestor does not magically guess what to run. Customer systems call the relevant Attestor path for the consequence they want to control.

## Current proof wedge

The deepest proven wedge today is finance.

The first hard boundary is:

**AI output -> structured financial record release**

That is where weak acceptance models break quickly: reviewer authority matters, deterministic checks matter, portable proof matters, and auditability is not optional.

Finance is the current proving ground, not the ceiling of the platform.

See [AI-assisted financial reporting acceptance](docs/01-overview/financial-reporting-acceptance.md).

## How teams adopt Attestor

Teams buy a control layer, not a replacement for their existing systems.

Attestor is called from the customer's own environment. Customer data, business workflows, models, agents, wallets, and operational systems stay where they already are.

Teams are buying governed release and authorization infrastructure, portable proof, independent verification, and a bounded control point before consequence.

A practical buying path is simple:

- Evaluation starts on the free `community` path or locally from this repo.
- If the hosted path fits, teams sign up, receive the first API key, and upgrade through Stripe when moving onto a paid hosted plan.
- If stricter runtime or isolation is required, production moves through the enterprise customer-operated path.

In both paths, Attestor stays in front of an existing system that would otherwise write, send, file, or execute the consequence directly.

Paid hosted starts at `starter`; customer-operated production fits the enterprise path. Production use is commercial under BSL 1.1 until the Change Date in [LICENSE](LICENSE).

Need pricing, free evaluation, or hosted trial details? See [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md).

Need the hosted sign-up, first API key, and checkout flow? See [Hosted customer journey](docs/01-overview/hosted-customer-journey.md).

Need the canonical consequence-admission vocabulary? See [Attestor operating model](docs/01-overview/operating-model.md).

Need the customer-facing admission facade? See [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md).

Need the first hosted API call after signup? See [First hosted API call](docs/01-overview/hosted-first-api-call.md).

Need first finance and crypto integration paths? See [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md).

Need to know where current plan, usage, billing, and entitlements live? See [Hosted account visibility](docs/01-overview/hosted-account-visibility.md).

## Platform core

| Core layer | Role | Status |
|---|---|---|
| Release layer | consequence decisions, deterministic checks, tokens, reviewer queue, evidence packs | evaluation-packaged |
| Policy control plane | signed policy bundles, activation, rollback, scoping, simulation, audit trail | evaluation-packaged |
| Enforcement plane | offline/online verification, gateways, DPoP, mTLS/SPIFFE, HTTP message signatures | evaluation-packaged |
| Crypto authorization core | programmable-money authorization vocabulary, bindings, simulation, adapter preflight | evaluation-packaged |

## Pack status

| Pack | What it means today | Status |
|---|---|---|
| Finance | deepest proven path today; financial reporting is the current proving wedge | evaluation proving pack |
| Crypto | real programmable-money core on the same model, with packaged admission surfaces for external integrations | authorization and execution-admission surfaces packaged for evaluation |

The crypto pack already covers the authorization core and execution-admission surfaces, including wallet RPC, Safe guard, ERC-4337 bundler, modular-account runtime, delegated-EOA runtime, x402 resource-server middleware, custody policy callback paths, intent-solver handoffs, uniform admission telemetry / signed receipts, JSON conformance fixtures, and a curated package surface for external integrators. It extends the same Attestor control model; it is not a separate product identity.

## Proof and verification

Attestor does not stop at policy text. It produces portable proof material and supports independent verification.

To inspect the shared finance/crypto proof surface locally:

```bash
npm run proof:surface
```

That command writes `.attestor/proof-surface/latest/` with a manifest, machine-readable bundle, markdown summary, and one unified proof output per runnable scenario. It is a local static proof surface; it does not start a hosted console or claim a public hosted crypto route.

Shortest proof path:

```bash
npm run showcase:proof
npm run verify:cert -- .attestor/showcase/latest/evidence/kit.json
```

That path generates a local PostgreSQL-backed proof packet, then verifies the resulting kit outside the main runtime. Without a live upstream model, `verify:cert` reports `PROOF_DEGRADED` and exits non-zero by design; the full local release gate remains `npm run verify`.

For tagged evaluation releases, the separate [Release Provenance workflow](.github/workflows/release-provenance.yml) packages the review artifacts and publishes a GitHub artifact attestation for the resulting `evaluation-artifacts.tar.gz` bundle. Scope and non-claims are in [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md).

## Quick start

```bash
npm install

# Run the first useful admission demo
npm run example:admission

# Render the cross-pack local proof surface
npm run proof:surface

# Explore the reference scenarios
npm run list

# Run the bounded fixture scenario
npm run scenario -- counterparty

# Generate a signed proof for the same scenario
npm run prove -- counterparty

# Generate a portable proof-showcase packet
npm run showcase:proof

# Run the local verification gate
npm run verify
```

## Documentation map

- [System overview](docs/02-architecture/system-overview.md)
- [Attestor operating model](docs/01-overview/operating-model.md)
- [What you can do with Attestor](docs/01-overview/what-you-can-do.md)
- [Customer integration recipes](docs/01-overview/customer-integration-recipes.md)
- [Try Attestor first](docs/01-overview/try-attestor-first.md)
- [Customer admission gate](docs/01-overview/customer-admission-gate.md)
- [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md)
- [Release layer buildout](docs/02-architecture/release-layer-buildout.md)
- [Policy control-plane buildout](docs/02-architecture/release-policy-control-plane-buildout.md)
- [Enforcement-plane buildout](docs/02-architecture/release-enforcement-plane-buildout.md)
- [Crypto authorization core buildout](docs/02-architecture/crypto-authorization-core-buildout.md)
- [Crypto execution-admission buildout](docs/02-architecture/crypto-execution-admission-buildout.md)
- [Consequence admission buildout](docs/02-architecture/consequence-admission-buildout.md)
- [Proof surface buildout](docs/02-architecture/proof-console-buildout.md)
- [Hosted product flow buildout](docs/02-architecture/hosted-product-flow-buildout.md)
- [Production runtime hardening buildout](docs/02-architecture/production-runtime-hardening-buildout.md)
- [Production shared authority plane buildout](docs/02-architecture/production-shared-authority-plane-buildout.md)
- [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md)
- [Production readiness](docs/08-deployment/production-readiness.md)
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)
- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md)

## Start here

- Want the shortest first run? Start with [Try Attestor first](docs/01-overview/try-attestor-first.md) or run `npm run example:admission`.
- Want a compact outside-review packet? Start with [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md).
- Want the exact release boundary and known limitations? Start with [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md).
- Want the current disclosure path and CI trust boundary? Start with [Security Policy](SECURITY.md) and [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md).
- Want the path from repo-proof to real environment proof? Start with [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md).
- Want to wire the decision into your own app? Start with [Customer admission gate](docs/01-overview/customer-admission-gate.md) or run `npm run example:customer-gate`.
- Want to know exactly where to put Attestor in your app? Start with [Customer integration recipes](docs/01-overview/customer-integration-recipes.md).
- Want the deepest proof wedge? Start with [Financial reporting acceptance](docs/01-overview/financial-reporting-acceptance.md).
- Want pricing, free evaluation, or hosted trial details? Start with [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md).
- Want the managed customer path, sign-up flow, and billing handoff? Start with [Hosted customer journey](docs/01-overview/hosted-customer-journey.md).
- Want the simple operating model and decision vocabulary? Start with [Attestor operating model](docs/01-overview/operating-model.md).
- Want the First useful admission demo? Run `npm run example:admission`.
- Want the first API call after signup? Start with [First hosted API call](docs/01-overview/hosted-first-api-call.md).
- Want the first finance or crypto integration path? Start with [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md).
- Want to see where plan, usage, entitlement, and billing state live? Start with [Hosted account visibility](docs/01-overview/hosted-account-visibility.md).
- Want to run the visible proof surface? Use `npm run proof:surface`, then inspect `.attestor/proof-surface/latest/manifest.json`; background is in [Proof surface buildout](docs/02-architecture/proof-console-buildout.md).

## What Attestor is not

- Not the model
- Not the agent runtime
- Not the downstream system that actually writes, sends, files, executes, or settles
- Not a wallet or custody platform
- Not an orchestration framework or generic AI workspace
- Not a magical system that guesses the right path automatically
- Not proof that AI or programmable execution is inherently trustworthy
