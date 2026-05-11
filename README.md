# Attestor

![Attestor: proof before consequence](docs/assets/attestor-readme-hero.png)

**AI Action Authorization Layer.**

Attestor is the authorization layer for AI actions before they become consequences.

Models propose actions. Systems change state. Attestor authorizes the gap between them.

Start in shadow mode. See what your AI agents would have done before you let them act.

AI systems now reach tools that write to ledgers, CRMs, filing paths, wallets, ticketing systems, databases, and deployment pipelines. A bad answer can be corrected. A bad consequence has to be unwound. The trust boundary is not the model response. The trust boundary is the action that reaches a real system.

Attestor sits at that boundary. A model, agent, workflow, wallet, or application proposes an action; Attestor admits it, narrows it, sends it to review, or blocks it before the downstream system writes, sends, files, settles, grants access, releases data, or executes.

Attestor does not replace the model, agent runtime, wallet, custody platform, orchestration layer, or downstream system. It is the authorization layer before a proposed AI action becomes a real-world consequence.

> [!NOTE]
> This repository is source-available under Business Source License 1.1. Non-production use is allowed. Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

## Current Status

Attestor is currently an **evaluation release**: reviewer-runnable, CI-backed, and useful for technical evaluation. It demonstrates the AI action authorization model, consequence-gateway proof artifacts, consequence-pack surfaces, programmable-money extension surfaces, hosted account and billing surfaces, and current fail-closed boundaries.

It is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

Start review with:

- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md)
- [Security Policy](SECURITY.md)
- [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)

## What Attestor Does

Attestor authorizes high-risk AI actions before they become consequences that matter:

```text
AI proposes -> Attestor admits / narrows / reviews / blocks -> allowed consequences proceed -> proof remains
```

Use it where an AI-assisted system should not be able to act just because it can form a request:

- a support copilot drafts a refund, credit, suspension, or account-status change
- a procurement agent proposes paying a supplier after reading a changed bank-account instruction
- an analytics agent requests a customer-data export or live database-backed report
- a treasury or wallet workflow prepares a programmable-money transaction
- a compliance workflow prepares a filing, notice, or customer communication
- an operations agent proposes a deploy, secret rotation, incident action, or infrastructure change

The posture is fail-closed. If policy, authority, evidence, freshness, scope, or verification cannot close, the consequence does not proceed silently.

## Start Without Blocking

Teams do not need to begin by blocking production workflows.

Attestor can start in `observe` or `warn` mode. It receives proposed AI actions, computes what would have been admitted, narrowed, reviewed, or blocked, and lets the customer measure risk and review load before switching to `review` or `enforce`.

```text
observe -> warn -> review -> enforce
```

The adoption path stays explicit:

```text
observe -> recommend -> simulate -> approve -> enforce -> prove
```

Shadow mode is for discovering the real action surface before asking production workflows to stop:

- which high-risk AI actions exist
- which actions have no policy
- which downstream tools have too much authority
- which actions would create review load
- which consequences would have been blocked before execution

The current generic admission route implements the first control ladder for this path. Recommendation, simulation, and reporting surfaces build on top of that ladder; they should make enforcement easier to approve before a workflow is asked to stop.

## Why It Exists

Most AI safety layers focus on prompts, outputs, model behavior, or tool routing. Those matter, but they do not close the business risk by themselves. The costly event is downstream:

```text
bad instruction -> plausible model output -> tool call -> real system changed
```

Attestor treats the proposed consequence as the object of control. It does not need the model to become perfectly reliable. It requires the action to pass a bounded admission decision before the system of record, payment layer, wallet, filing path, admin plane, or operational workflow is allowed to act.

This is AI action authorization infrastructure: not a chatbot feature, not a prompt wrapper, not a generic agent workspace, and not a governance checklist. A gateway before important AI actions become real.

## Try It In 60 Seconds

```bash
npm install
npm run example:admission
```

You will see:

- one proposed consequence admitted with proof references
- one proposed consequence blocked fail-closed
- a customer-side gate that only proceeds when Attestor allows it
- a non-bypassable gateway demo where a payment adapter cannot dispatch without verifier allow
- an agent retry wrapper demo where model-safe feedback becomes one bounded correction attempt

For a guided first run, see [Try Attestor first](docs/01-overview/try-attestor-first.md).

## What You Can Run Today

```bash
# First useful admission demo
npm run example:admission

# Customer-side enforcement demo
npm run example:customer-gate

# Non-bypassable gateway demo
npm run example:non-bypassable-gateway

# Agent retry wrapper demo
npm run example:agent-retry-wrapper

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

The first generic hosted action-authorization route is:

```http
POST /api/v1/admissions
```

It accepts an explicit consequence domain and adoption mode: `observe`, `warn`, `review`, or `enforce`. This is the route-level entry point for the shadow-to-enforcement ladder described above.

Minimal request shape:

```json
{
  "mode": "observe",
  "actor": "support-ai-agent",
  "action": "issue_refund",
  "domain": "money-movement",
  "downstreamSystem": "refund-service",
  "amount": {
    "value": 380,
    "currency": "USD"
  },
  "evidenceRefs": [
    "order:987",
    "payment:456"
  ],
  "policyRef": "policy:refunds:v1"
}
```

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
    "policy-fail",
    "customer-gate-hold"
  ],
  "proofRefs": []
}
```

Allowed paths can carry proof references such as `certificate:...` and `verification-kit:...`. Blocked paths keep the reason codes that explain why the gate did not open.

Admission responses also carry model-safe feedback. This is not raw policy disclosure and not autonomous policy learning; it is a bounded correction contract for agents and customer runtimes that want to retry safely:

```json
{
  "feedback": {
    "disclosureLevel": "actionable",
    "safeForModel": true,
    "missingFields": [
      "evidenceRefs"
    ],
    "requiredEvidenceKinds": [
      "evidence_ref"
    ],
    "safeInstruction": "Retry only with bounded references for the missing fields. Do not include raw customer, bank, wallet, credential, secret, or private policy data."
  },
  "retry": {
    "retryAllowed": true,
    "retryCategory": "safe-correction",
    "maxAttempts": 2,
    "requiresChangedRequest": true,
    "sameRequestReplayAllowed": false,
    "retryBindingRequired": true,
    "retryBindingFields": [
      "previousAdmissionId",
      "previousAdmissionDigest",
      "previousRequestId",
      "attemptNumber",
      "correctionReasonCodes"
    ]
  }
}
```

The corrected request must carry a `retryAttempt` binding back to the held admission. That binding includes the previous admission ID, previous admission digest, previous request ID, attempt number, and correction reason codes. This makes a retry an auditable continuation, not a fresh probe against the gateway.

Retry attempts are also budgeted. The current contract allows at most two model correction attempts within a 300-second window from the held admission. A retry outside that budget, outside the window, or with correction reasons that do not match the previous model-safe feedback must hold for customer review or operator control.

The [retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md) records each bound retry attempt after budget evaluation. It keeps the previous admission link, retry attempt digest, budget digest, and idempotency key digest without storing raw retry payloads or raw idempotency keys. Duplicate attempts return the existing record; conflicting idempotency keys hold fail-closed.

The [agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md) sits above the retry ledger. It keeps automatic correction from turning into DoS or policy probing by bounding retry attempts per held admission, actor/action/downstream windows, non-retryable correction reasons, and distinct correction signatures.

Correction reason codes come from a stable correction catalog. The catalog separates model-retryable gaps such as missing `evidenceRefs` from customer-review or operator-control reasons such as `policy-blocked`, `feature-unsafe`, and `adapter-readiness-missing`.

Some failures are deliberately not model-retryable. `policy-blocked`, unsafe signals, custom-domain review, and adapter readiness gaps route to customer review or operator control instead of teaching the model how to probe the boundary.

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

## Consequence Packs

Attestor packs are organized by the type of consequence an AI action can create, not by the industry the customer happens to be in.

A pack does not answer "is this finance or crypto?" It answers the control question:

```text
What real system consequence is this AI action trying to create?
```

The current pack language is:

- **Money Movement** - AI actions that move or modify financial value: refunds, payouts, supplier payments, credits, adjustments, and payment-adjacent dispatch.
- **Data Movement** - AI actions that read, export, disclose, or release sensitive data: warehouse queries, customer exports, report releases, and controlled data packages.
- **Authority Change** - AI actions that grant, revoke, unlock, approve, delegate, or change access and control.
- **External Communication** - AI actions that send customer-facing, legal, regulated, billing, support, or public messages.
- **Operational Execution** - AI actions that deploy, rotate secrets, change infrastructure, trigger incident actions, or modify live operations.
- **Programmable Money** - AI actions that prepare, approve, sign, submit, or settle on programmable-money rails: wallet calls, Safe transactions, account-abstraction flows, custody callbacks, payment middleware, and intent settlement.

The pack is the consequence class. Adapters sit underneath it. A refund service, payment processor, ERP, wallet RPC, Snowflake connector, CRM, identity provider, email sender, or deployment system can all attach to the same admission core without changing the public trust story.

## Architecture: Core And Packs

Attestor is one product with a shared AI action authorization core and modular packs for specific consequence domains.

One product. One platform core.

The current engine shape is a consequence gateway, not a prompt filter. The core admits, narrows, reviews, or blocks proposed consequences; the release layer turns decisions into proof material; the policy control plane binds authority and provenance; the enforcement plane verifies at the downstream edge; and the evidence path stays data-minimized by default.

Read the architecture as a path, not a stack diagram:

```text
proposed consequence
  -> consequence admission
  -> policy, authority, evidence, freshness, and enforcement checks
  -> bounded decision
  -> proof material
  -> downstream verification
```

The [consequence taxonomy](docs/02-architecture/consequence-taxonomy.md) names the domains this path is meant to control: financial records, money movement, programmable money, data disclosure, authority change, external communication, regulated filing, system operation, decision support, and custom customer-defined surfaces.

The consequence-admission core gives every pack the same public language: `admit`, `narrow`, `review`, or `block`. Money movement, data movement, authority change, external communication, operational execution, programmable money, and future packs should not invent their own trust story. They attach to the same admission model.

The [downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md) defines what customer systems must bind before acting on an admission: admission id, digest, decision, consequence domain, consequence kind, risk class, downstream system, policy scope, proof, idempotency, and `narrow` constraints. This is where the gateway stops being advice.

The [verifier helper](docs/02-architecture/verifier-helper.md) is the small customer-side wrapper for that contract. A downstream adapter can call `verify` for a structured hold decision or `assert` to stop execution fail-closed.

The [adapter framework](docs/02-architecture/adapter-framework.md) turns that verifier rule into a protected execution shape for HTTP handlers, queue consumers, tool wrappers, MCP tool wrappers, payment adapters, wallet adapters, and custom customer edges: verify before execute.

The [audit evidence export](docs/02-architecture/audit-evidence-export.md) packages shadow events, simulations, policy discovery, promotion packets, and downstream proof references into a canonical reviewer packet without claiming compliance or exporting raw customer payloads.

The [tamper-evident history](docs/02-architecture/tamper-evident-history.md) links digest-first evidence over time. It exports a root digest and verification summary so modified, deleted, or reordered records fail closed before a reviewer trusts the packet.

The [business risk dashboard](docs/02-architecture/business-risk-dashboard.md) turns that reviewer packet into operator-facing metrics: observed AI actions, review load, blocked actions, policy gaps, domain risk, downstream proof coverage, and optional operator-supplied impact.

The [dashboard API summary](docs/02-architecture/dashboard-api-summary.md) gives the first-screen product shape over that dashboard: compact tiles, attention items, top consequence domains, and links to deeper proof surfaces.

The [crypto intelligence buildout](docs/02-architecture/crypto-intelligence-buildout.md) packages that same summary discipline at `attestor/crypto-intelligence`: risk signals, policy coverage, policy gaps, adapter readiness, operator-supplied risk inputs, missing evidence, conformance fixtures, privacy gates, aggregate performance budgets, and digest-first proof links without raw wallet/payment payload drilldown or native screening claims. The next [engine hardening track](docs/02-architecture/crypto-engine-hardening-ii.md) adds adapter-readiness intelligence, pack-specific decision profiles, policy-intelligence routing, proof-console prioritization, and runtime efficiency guards for explicit-deny precedence, stale-policy refresh, conflict resolution, readiness heatmaps, top blockers, benchmark regression detection, next operator actions, and finance/crypto pack signals without changing Attestor into a hosted crypto execution provider.

The [external review packet](docs/02-architecture/external-review-packet.md) wraps audit evidence, dashboard context, runtime/storage evidence, repository security refs, checklist items, and non-claims into a digest-first reviewer handoff. It is not a security audit, compliance certificate, or production-readiness guarantee.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) defines what model feedback, audit packets, dashboards, dashboard summaries, external review packets, retry ledgers, presentation bindings, replay receipts, and execution receipts may expose by default: reason codes, safe instructions, counts, digests, scoped references, and aggregate signals instead of raw customer payloads.

The [policy limit model](docs/02-architecture/policy-limit-model.md) gives those admissions bounded policy material: amount caps, velocity windows, recipient and asset allowlists, data scope, authority scope, time windows, risk ceilings, and review thresholds.

The [retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md) records safe-retry attempts after the retry budget closes. It makes automatic correction attempts idempotent and auditable without storing raw retry payloads.

The [agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md) limits the surrounding retry behavior so a bounded correction loop cannot become overload or policy probing.

The [downstream presentation binding](docs/02-architecture/downstream-presentation-binding.md) binds an allowed admission to the exact enforcement point, target, method, body digest, replay key, nonce, freshness window, proof refs, and acknowledged constraints that are about to cross into the real system.

The [presentation replay ledger](docs/02-architecture/presentation-replay-ledger.md) consumes that replay key once. The evaluation helper keeps exported ledger entries redacted; production deployments should back the same contract with a shared atomic store at the enforcement edge.

The [downstream execution receipt](docs/02-architecture/downstream-execution-receipt.md) records what happened after the replay key was consumed: succeeded, failed, or skipped, with result/error/receipt material kept as digests instead of raw downstream data.

The release layer turns a decision into something the rest of the system can inspect: deterministic checks, release tokens, reviewer queues, evidence packs, and proof references. This is where "the AI said so" becomes a bounded release decision.

The policy control plane is where authority changes are controlled: signed policy bundles, activation, rollback, scoping, simulation, and audit trail. A gateway without policy provenance is only an interruption point.

The enforcement plane is the downstream edge. It verifies releases offline or online and fails closed when the required proof is absent, stale, out of scope, or invalid. This is the difference between advice and a gate.

Pack-specific adapters live below this layer. They provide native evidence, simulations, verifier bindings, release material, conformance fixtures, and downstream handoff details for a consequence class. They do not get a separate product identity or a separate trust story.

Customer systems call the relevant Attestor path for the consequence they want to control. Attestor does not guess what to run automatically, and it does not bypass the customer's own enforcement point.

## Data And Security Posture

Attestor is designed as a control point, not a data lake.

It receives the proposed consequence and the evidence needed to decide whether that consequence may proceed. Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path. Attestor returns a bounded decision, reasons, and proof references. It does not need to become the system of record for raw business data.

The default redaction rule is explicit in the [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md): model feedback, retry records, audit evidence, dashboard summaries, and downstream receipts should expose structural control evidence, not raw prompts, raw tool payloads, raw customer identifiers, bank/payment data, wallet material, credentials, private policy thresholds, or downstream error bodies.

The current evaluation baseline already includes:

- protected-route guards that disable anonymous tenant fallback in production-like runtimes
- tenant-boundary route guards for shadow, policy, simulation, and activation receipt records
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

Use this as a map, not a full index:

- Review boundary: [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md), [v0.1.2-evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md), [Security Policy](SECURITY.md), [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md).
- First run and product framing: [Try Attestor first](docs/01-overview/try-attestor-first.md), [What you can do with Attestor](docs/01-overview/what-you-can-do.md), [AI action authorization positioning](docs/01-overview/action-authorization-positioning.md), [Attestor operating model](docs/01-overview/operating-model.md), [Customer integration recipes](docs/01-overview/customer-integration-recipes.md).
- Admission and hosted entry points: [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md), [Customer admission gate](docs/01-overview/customer-admission-gate.md), [Non-bypassable gateway demo](docs/01-overview/non-bypassable-gateway-demo.md), [Agent retry wrapper demo](docs/01-overview/agent-retry-wrapper-demo.md), [Hosted action authorization API](docs/01-overview/hosted-action-authorization-api.md), [First hosted API call](docs/01-overview/hosted-first-api-call.md), [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md).
- Hosted product and billing: [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md), [Pricing ROI calculator](docs/01-overview/pricing-roi-calculator.md), [Hosted customer journey](docs/01-overview/hosted-customer-journey.md), [Hosted account visibility](docs/01-overview/hosted-account-visibility.md).
- Core architecture: [System overview](docs/02-architecture/system-overview.md), [Consequence taxonomy](docs/02-architecture/consequence-taxonomy.md), [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md), [Verifier helper](docs/02-architecture/verifier-helper.md), [Adapter framework](docs/02-architecture/adapter-framework.md), [Crypto intelligence buildout](docs/02-architecture/crypto-intelligence-buildout.md), [Crypto intelligence surface](docs/02-architecture/crypto-intelligence-platform-surface.md).
- Evidence and safety ledgers: [Audit evidence export](docs/02-architecture/audit-evidence-export.md), [Tamper-evident history](docs/02-architecture/tamper-evident-history.md), [Business risk dashboard](docs/02-architecture/business-risk-dashboard.md), [Dashboard API summary](docs/02-architecture/dashboard-api-summary.md), [External review packet](docs/02-architecture/external-review-packet.md), [Data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md), [Policy limit model](docs/02-architecture/policy-limit-model.md), [Retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md), [Agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md), [Downstream presentation binding](docs/02-architecture/downstream-presentation-binding.md), [Presentation replay ledger](docs/02-architecture/presentation-replay-ledger.md), [Downstream execution receipt](docs/02-architecture/downstream-execution-receipt.md).
- Runtime and promotion: [Production storage path](docs/02-architecture/production-storage-path.md), [Proof console buildout](docs/02-architecture/proof-console-buildout.md), [Production runtime hardening buildout](docs/02-architecture/production-runtime-hardening-buildout.md), [Production shared authority plane buildout](docs/02-architecture/production-shared-authority-plane-buildout.md), [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md), [Proof model](docs/05-proof/proof-model.md), [Signing and verification](docs/06-signing/signing-verification.md), [Production readiness](docs/08-deployment/production-readiness.md), [Tenant isolation boundary](docs/02-architecture/tenant-isolation-boundary.md).
