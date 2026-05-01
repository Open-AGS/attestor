# Attestor

![Attestor: proof before consequence](docs/assets/attestor-readme-hero.png)

**AI Consequence Gateway.**

Models propose. Systems change. Attestor sits between those two facts.

AI systems now reach tools that write to ledgers, CRMs, filing paths, wallets, ticketing systems, databases, and deployment pipelines. A bad answer can be corrected. A bad consequence has to be unwound. The trust boundary is not the model. The trust boundary is the consequence.

Attestor sits at that boundary. A model, agent, workflow, wallet, or application proposes an action; Attestor admits it, narrows it, sends it to review, or blocks it before the downstream system writes, sends, files, settles, grants access, releases data, or executes.

Attestor does not replace the model, agent runtime, wallet, custody platform, orchestration layer, or downstream system. It is the admission layer before a proposed AI action becomes a real-world consequence.

> [!NOTE]
> This repository is source-available under Business Source License 1.1. Non-production use is allowed. Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

## Current Status

Attestor is currently an **evaluation release**: reviewer-runnable, CI-backed, and useful for technical evaluation. It demonstrates the consequence-gateway model, proof artifacts, finance wedge, crypto extension surfaces, and current fail-closed boundaries.

It is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

Start review with:

- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md)
- [Security Policy](SECURITY.md)
- [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)

## What Attestor Does

Attestor is admission control for AI-driven consequences that matter:

```text
AI proposes -> Attestor admits / narrows / reviews / blocks -> allowed consequences proceed -> proof remains
```

Use it where an AI-assisted system should not be able to create a consequence just because it can form a request:

- a finance assistant prepares a report from live warehouse data
- an agent proposes paying a supplier after reading a changed bank-account instruction
- a crypto workflow prepares a Safe transaction, wallet RPC call, custody callback, or solver handoff
- a support copilot drafts a refund, credit, suspension, or account-status change
- an internal AI requests a customer-data export or live database-backed report
- a compliance workflow prepares a filing, notice, or customer communication
- an operations agent proposes a deploy, secret rotation, incident action, or infrastructure change

The posture is fail-closed. If policy, authority, evidence, freshness, scope, or verification cannot close, the consequence does not proceed silently.

## Why It Exists

Most AI safety layers focus on prompts, outputs, model behavior, or tool routing. Those matter, but they do not close the business risk by themselves. The costly event is downstream:

```text
bad instruction -> plausible model output -> tool call -> real system changed
```

Attestor treats the proposed consequence as the object of control. It does not need the model to become perfectly reliable. It requires the action to pass a bounded admission decision before the system of record, payment layer, wallet, filing path, admin plane, or operational workflow is allowed to act.

This is AI consequence infrastructure: not a chatbot feature, not a prompt wrapper, not a generic agent workspace. A gateway before important AI actions become real.

## Try It In 60 Seconds

```bash
npm install
npm run example:admission
```

You will see:

- one proposed consequence admitted with proof references
- one proposed consequence blocked fail-closed
- a customer-side gate that only proceeds when Attestor allows it

For a guided first run, see [Try Attestor first](docs/01-overview/try-attestor-first.md).

## What You Can Run Today

```bash
# First useful admission demo
npm run example:admission

# Customer-side enforcement demo
npm run example:customer-gate

# Local cross-pack proof surface
npm run proof:surface

# Portable proof-showcase packet
npm run showcase:proof

# Verify a generated kit
npm run verify:cert -- .attestor/showcase/latest/evidence/kit.json

# Local verification gate
npm run verify
```

`npm run proof:surface` writes `.attestor/proof-surface/latest/` with `.attestor/proof-surface/latest/manifest.json`, a machine-readable bundle, markdown summary, and one unified proof output per runnable scenario.

It is a local static proof surface; it does not start a hosted console or claim a public hosted crypto route.

`npm run showcase:proof` generates a local PostgreSQL-backed proof packet. Without a live upstream model, `verify:cert` reports `PROOF_DEGRADED` and exits non-zero by design. The green local release gate remains `npm run verify`.

## Decision Model

Attestor never returns an open-ended "looks good." It returns one of four bounded outcomes:

| Decision | Meaning |
|---|---|
| `admit` | The proposed consequence may proceed. |
| `narrow` | Only a safer bounded version may proceed. |
| `review` | The consequence must wait for human or external review. |
| `block` | The consequence is rejected fail-closed. |

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

Allowed paths can carry proof references such as `certificate:...` and `verification-kit:...`. Blocked paths keep the reason codes that explain why the gate did not open.

## Proof Model

Attestor is built around proof before consequence. A consequence should not merely happen; it should leave a bounded record of why it was allowed, narrowed, reviewed, or blocked.

A decision can include:

- decision outcome
- policy context
- authority and evidence status
- reason codes
- verification references when available
- local proof artifacts that can be reviewed later

The current evaluation baseline includes local proof packets, verification kits, signed proof paths, CI-backed smoke checks, and release artifact attestation for tagged evaluation releases. The exact boundary and non-claims are documented in the [Evaluation Packet](docs/00-evaluation/v0.1-evaluation-packet.md), [v0.1.2 release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md), and [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md).

## Current Proof Wedge

The deepest proven wedge today is **finance**, because finance makes the gateway requirement obvious: records, approvals, authority, and audit trails cannot be hand-waved.

The first hard boundary is:

```text
AI output -> structured financial record release
```

This is a proving wedge, not the ceiling. The same admission model applies to money-adjacent actions, programmable-money handoffs, data exports, authority changes, regulated filings, customer communications, and operational execution.

See [AI-assisted financial reporting acceptance](docs/01-overview/financial-reporting-acceptance.md).

## Architecture: Core And Packs

Attestor is one product with a shared consequence-gateway core and modular packs for specific consequence domains.

One product. One platform core.

| Layer | Role | Current status |
|---|---|---|
| Consequence admission | common admit / narrow / review / block vocabulary and customer-side gate model | evaluation-packaged |
| Release layer | decisions, deterministic checks, tokens, reviewer queue, evidence packs | evaluation-packaged |
| Policy control plane | signed policy bundles, activation, rollback, scoping, simulation, audit trail | evaluation-packaged |
| Enforcement plane | offline/online verification, gateways, DPoP, mTLS/SPIFFE, HTTP message signatures | evaluation-packaged |
| Crypto authorization core | programmable-money authorization vocabulary, bindings, simulation, adapter preflight | evaluation-packaged |

Customer systems call the relevant Attestor path for the consequence they want to control. Attestor does not guess what to run automatically, and it does not bypass the customer's own enforcement point.

## Pack Status

| Pack | What it means today | Status |
|---|---|---|
| Finance | deepest proven path today; financial reporting is the current proof wedge | evaluation proving pack |
| Crypto | packaged extension of the same policy / authority / proof / fail-closed model for programmable-money admission surfaces | authorization and execution-admission surfaces packaged for evaluation |

The crypto pack applies the same gate to programmable-money surfaces: wallet RPC, Safe guard, ERC-4337 bundler, modular-account runtime, delegated-EOA runtime, x402 resource-server middleware, custody policy callbacks, intent-solver handoffs, telemetry receipts, and conformance fixtures. It extends the shared Attestor model; it is not a separate product identity.

## Data And Security Posture

Attestor is designed as a control point, not a data lake.

It receives the proposed consequence and the evidence needed to decide whether that consequence may proceed. Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path. Attestor returns a bounded decision, reasons, and proof references. It does not need to become the system of record for raw business data.

The current evaluation baseline already includes:

- protected-route guards that disable anonymous tenant fallback in production-like runtimes
- connector proof paths that sanitize connection URLs before exposing proof or probe material
- PostgreSQL proof connector limits including read-only transactions, statement timeouts, row limits, and schema allowlists when configured
- CI coverage for evaluation smoke, CodeQL, dependency review, high/critical npm audit gates, and supply-chain baseline checks
- release signing provider readiness that distinguishes runtime-ephemeral, file-backed, and external KMS-style provider boundaries
- explicit live/ops verification separation so external live integrations are not implied by a secretless reviewer run

Proof and logs are not a place to dump secrets. Access tokens, private keys, database connection strings, payment details, and sensitive personal data should be masked, hashed, encrypted, or kept out unless a deployment deliberately configures otherwise.

Production data handling depends on the chosen hosted or customer-operated deployment, including secrets management, retention, logging, access control, and commercial support boundaries. Start with [Security Policy](SECURITY.md) and [Production readiness](docs/08-deployment/production-readiness.md).

## What Attestor Is Not

Attestor is not:

- the model
- the agent runtime
- a wallet or custody platform
- an orchestration framework or generic AI workspace
- the downstream system that writes, sends, files, executes, settles, or stores the final result
- a permission slip for AI actions without customer-side enforcement
- a magical system that guesses the right consequence path automatically
- proof that AI or programmable execution is inherently trustworthy
- a claim that every runtime profile is production-ready in this evaluation release

## Deeper Docs

Start here:

- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md) - compact outside-review packet
- [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md) - current release boundary and known limitations
- [Try Attestor first](docs/01-overview/try-attestor-first.md) - shortest guided run
- [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md) - package facade and first admission call
- [Attestor operating model](docs/01-overview/operating-model.md) - decision vocabulary and placement model
- [Customer admission gate](docs/01-overview/customer-admission-gate.md) - first customer-side enforcement step
- [Customer integration recipes](docs/01-overview/customer-integration-recipes.md) - where to put Attestor in an existing app
- [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md) - commercial truth source and evaluation boundary
- [Hosted customer journey](docs/01-overview/hosted-customer-journey.md) - hosted account and checkout path
- [First hosted API call](docs/01-overview/hosted-first-api-call.md) - first hosted API-call quickstart
- [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md) - first integration examples
- [Hosted account visibility](docs/01-overview/hosted-account-visibility.md) - account, usage, and billing visibility
- [What you can do with Attestor](docs/01-overview/what-you-can-do.md) - longer use-case map
- [System overview](docs/02-architecture/system-overview.md) - architecture map
- [Proof console buildout](docs/02-architecture/proof-console-buildout.md) - local proof-surface tracker
- [Production runtime hardening buildout](docs/02-architecture/production-runtime-hardening-buildout.md) - runtime profile and fail-closed hardening tracker
- [Production shared authority plane buildout](docs/02-architecture/production-shared-authority-plane-buildout.md) - shared production authority-plane tracker
- [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md) - active production rehearsal tracker
- [Proof model](docs/05-proof/proof-model.md) - proof vocabulary and artifacts
- [Signing and verification](docs/06-signing/signing-verification.md) - signed proof verification path
- [Production readiness](docs/08-deployment/production-readiness.md) - deployment and maturity boundary
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md) - release artifact attestation scope
- [Security Policy](SECURITY.md) - disclosure path, CI trust boundary, and evaluation security status
