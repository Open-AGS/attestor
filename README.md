# Attestor

![Attestor: proof before consequence](docs/assets/attestor-readme-hero.png)

**AI Action Control Plane.**

Your AI agent is about to issue a $50k refund to the wrong customer. Another one read a changed supplier bank-account instruction and wants to pay it. A third is preparing a wallet transaction. Attestor sits before those requests reach systems that write, send, file, settle, grant access, release data, or execute.

Attestor decides when AI intent is allowed to become business consequence.

Models propose actions. Systems change state. Attestor controls the consequence boundary between them. Start in shadow mode. See what your AI agents would have done before you let them act.

The trust boundary is not the model response. The trust boundary is the action that reaches a real system.

Attestor sits at that boundary. It admits, narrows, routes to review, or blocks proposed consequences before downstream execution. Attestor does not replace the model, agent runtime, wallet, custody platform, orchestration layer, or downstream system. It is the control plane before a proposed AI action becomes a real-world consequence.

> [!NOTE]
> This repository is source-available under Business Source License 1.1. Non-production use is allowed. Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

## Current Status

Attestor is an **evaluation release**: reviewer-runnable, CI-backed, and useful for technical evaluation. It demonstrates the AI Action Control Plane model, consequence-admission proof artifacts, consequence-pack surfaces, programmable-money extension surfaces, hosted account and billing surfaces, and current fail-closed boundaries.

It is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

Start review with:

- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.1.2 evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md)
- [Security Policy](SECURITY.md)
- [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)
- [Audit remediation tracker](docs/audit/attestor-audit-remediation-tracker.md)

## What Attestor Does

Attestor authorizes high-risk AI actions before they become consequences that matter:

```text
AI proposes -> Attestor admits / narrows / reviews / blocks -> allowed consequences proceed -> proof remains
```

Use it where a capable AI-assisted system should not be able to act just because it can form a request:

- a support copilot drafts a refund, credit, suspension, or account-status change
- a procurement agent proposes paying a supplier after reading a changed bank-account instruction
- an analytics agent requests a customer-data export or live database-backed report
- a treasury or wallet workflow prepares a programmable-money transaction
- a compliance workflow prepares a filing, notice, or customer communication
- an operations agent proposes a deploy, secret rotation, incident action, or infrastructure change

Fail-closed means the action does not proceed silently when the proof is incomplete. If policy, authority, evidence, freshness, scope, or verification cannot close, the consequence does not proceed silently.

## Start Without Blocking

Attestor can start in `observe` or `warn` mode. It receives proposed AI actions, computes what would have been admitted, narrowed, reviewed, or blocked, and lets the customer measure risk and review load before switching to `review` or `enforce`.

```text
observe -> warn -> review -> enforce
```

The shadow-to-enforcement path stays explicit:

```text
observe -> recommend -> simulate -> approve -> enforce -> prove
```

Shadow mode discovers the real action surface first: which high-risk AI actions exist, which actions have no policy, which downstream tools have too much authority, and which consequences would have been blocked before execution.

Policy Foundry is the onboarding layer for this path. It identifies policy candidates and missing controls from shadow traffic, simulates impact through Policy Twin, runs candidate-specific red-team replay through the local adversarial replay executor, keeps promotion approval-required, captures reviewed outcome feedback, emits drift/policy-debt findings, and separates commercial capabilities from non-paywalled safety minimums. It is observed-action policy mining, not model training, not automatic policy writing, and not a production-readiness claim.

The failure-mode registry turns known AI-action failure modes into controls before business action. Untrusted content, poisoned tool results, fake approvals, stale policy, tenant or recipient boundary mistakes, scope explosion, review fatigue, drift, no-go holds, and missing replay evidence become explicit control, evidence, authority, audit, and replay checks.

The current generic admission route implements the first control ladder for this path. Recommendation, simulation, and reporting surfaces build on top of that ladder so enforcement can be approved before a workflow is asked to stop.

## Why It Exists

Most AI safety layers focus on prompts, outputs, model behavior, or tool routing. Those matter, but they do not close the business risk by themselves. The costly event is downstream:

```text
bad instruction -> plausible model output -> tool call -> real system changed
```

Attestor treats the proposed consequence as the object of control. It does not need the model to become perfectly reliable. It requires the action to pass a bounded admission decision before the system of record, payment layer, wallet, filing path, admin plane, or operational workflow is allowed to act.

This is AI action control-plane infrastructure: not a chatbot feature, not a prompt wrapper, not a generic agent workspace, and not a governance checklist. Gateways, verifiers, and adapters are enforcement points; the product is the control plane before important AI actions become real.

## Try It In 60 Seconds

```bash
npm install
npm run example:admission
npm run example:action-surface-onboarding
npm run policy-foundry:self-onboard -- --openapi=examples/action-surface-onboarding/refund.openapi.json --default-domain=money-movement --downstream-system=refund-service --credential-posture=agent-held-static-secret
```

You will see:

- one proposed consequence admitted with proof references
- one proposed consequence blocked fail-closed
- a customer-side gate that only proceeds when Attestor allows it
- a non-bypassable gateway demo where a payment adapter cannot dispatch without verifier allow
- an agent retry wrapper demo where model-safe feedback becomes one bounded correction attempt
- an action-surface onboarding packet rendered from a safe OpenAPI example without deploying anything
- a Policy Foundry self-onboarding packet with session, coverage, blockers, gate plan, handoff, red-team fixtures, failure-mode gaps, and review-only patch drafts

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

# 60-second action-surface onboarding packet from a safe OpenAPI example
npm run example:action-surface-onboarding

# Render a review-required action-surface onboarding packet
npm run render:action-surface-onboarding-packet -- --openapi=path/to/openapi.yaml

# Render the one-command Policy Foundry self-onboarding review packet
npm run policy-foundry:self-onboard -- --openapi=path/to/openapi.yaml

# Local browser QA preview for the hosted Policy Foundry review UI
npm run preview:policy-foundry-hosted-ui

# Local cross-pack proof surface
npm run proof:surface

# Portable proof-showcase packet
npm run showcase:proof

# Verify a generated kit
npm run verify:cert -- .attestor/showcase/latest/evidence/kit.json

# Local verification gate
npm run verify

# Opt-in deployed Policy Foundry smoke probe, requires ATTESTOR_BASE_URL and ATTESTOR_API_KEY
npm run probe:policy-foundry-production-smoke
```

`npm run proof:surface` writes `.attestor/proof-surface/latest/` with `.attestor/proof-surface/latest/manifest.json`, a machine-readable bundle, markdown summary, and one unified proof output per runnable scenario. It is a local static proof surface; it does not start a hosted console or claim a public hosted crypto route.

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

Hosted onboarding entry points:

- `POST /api/v1/shadow/action-surface/onboarding-packet` renders a review-required action-surface packet from bounded manifests, declarations, and tenant-scoped shadow events.
- `POST /api/v1/shadow/policy-foundry/hosted-onboarding-workflow` is the hosted onboarding workflow contract. It composes the self-onboarding packet, local adversarial replay reports, optional live downstream replay reports, billing-entitlement review material, commercial-boundary review material, and hosted wizard storage readiness gating.
- `GET /api/v1/shadow/policy-foundry/hosted-onboarding-workflow/sessions/:sessionId` resumes persistent hosted wizard state from the current local file-backed evaluation store.

Safety boundary: hosted onboarding returns review material only. It does not store raw manifest payloads, issue credentials, apply patches, deploy a gateway, execute production traffic, or activate enforcement. Rendered packets can include next steps such as `add-shadow-capture`, but `applies patches: false` is the default. The hosted review surface and local hosted UI flow help a customer inspect task cards, no-go cards, evidence digests, and the next safe step; they are not production-readiness proof. The path where customers self-attest readiness controls is not allowed.

For local browser QA before deployment, run `npm run preview:policy-foundry-hosted-ui` and open the printed localhost URL. The preview renders blocked and ready hosted review states from safe fixtures only. It is not a hosted deployment, credential flow, enforcement activation, or production-readiness proof.

For an already deployed hosted runtime, the opt-in Policy Foundry production smoke probe is:

```bash
ATTESTOR_BASE_URL=https://your-attestor-host \
ATTESTOR_API_KEY=... \
npm run probe:policy-foundry-production-smoke
```

It checks health, readiness, hosted workflow rendering, hosted HTML rendering, passing live downstream replay evidence, and failed live replay blocking with secret-safe output.

It does not deploy infrastructure, issue credentials, activate enforcement, execute production traffic, or prove production readiness.

## Decision Model

Attestor never returns an open-ended "looks good." It returns one of four bounded outcomes:

| Decision | Meaning |
|---|---|
| `admit` | The proposed consequence may proceed. |
| `narrow` | Only a safer bounded version may proceed. |
| `review` | The consequence must wait for review. |
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

The corrected request must carry a `retryAttempt` binding back to the held admission. That binding makes a retry an auditable continuation, not a fresh probe against the gateway. Some failures are deliberately not model-retryable. `policy-blocked`, unsafe signals, custom-domain review, and adapter readiness gaps route to customer review or operator control instead of teaching the model how to probe the boundary.

Retry budget and loop-abuse controls are documented in the [retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md) and [agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md).

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

- **Money Movement** - refunds, payouts, supplier payments, credits, adjustments, and payment-adjacent dispatch.
- **Data Movement** - warehouse queries, customer exports, report releases, and controlled data packages.
- **Authority Change** - grants, revocations, unlocks, approvals, delegations, and access changes.
- **External Communication** - customer-facing, legal, regulated, billing, support, or public messages.
- **Operational Execution** - deploys, secret rotations, infrastructure changes, incident actions, and live operations.
- **Programmable Money** - wallet calls, Safe transactions, account-abstraction flows, custody callbacks, payment middleware, and intent settlement.

The pack is the consequence class. Adapters sit underneath it. A refund service, payment processor, ERP, wallet RPC, Snowflake connector, CRM, identity provider, email sender, or deployment system can all attach to the same admission core without changing the public trust story.

## Architecture: Core And Packs

Attestor is one product: an AI Action Control Plane with a shared consequence-admission core and modular packs for specific consequence domains.

One product. One platform core.

The current engine shape is a reference-monitor-style consequence admission path, not a prompt filter. The deeper architecture decision is [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md). It uses PDP / PEP / PIP / PAP-style separation inside a contract-first modular monolith. This is not a claim that every customer workflow is already non-bypassable; that posture requires a real customer-side enforcement point, gateway, verifier, or adapter.

Read the architecture as a path, not a stack diagram:

```text
proposed consequence
  -> consequence admission
  -> policy, authority, evidence, freshness, and enforcement checks
  -> bounded decision
  -> proof material
  -> downstream verification
```

The PDP surfaces turn structured action intent, policy, evidence, authority, scope, and failure-mode controls into `admit`, `narrow`, `review`, or `block`.

The PEP surfaces sit at the downstream edge and verify the decision, proof, binding, and replay posture before execution.

The PIP surfaces supply evidence, authority, tenant, recipient, freshness, policy-version, no-go, and context facts; they do not approve actions by themselves.

The PAP surfaces control policy lifecycle through signed bundles, simulation, rollout, activation rules, reviewer constraints, and provenance checks.

Pack-specific adapters live below this layer. They provide native evidence, simulations, verifier bindings, conformance fixtures, and downstream handoff details for a consequence class without getting a separate product identity or trust story.

Attestor does not guess what to run automatically, and it does not bypass the customer's own enforcement point.

The machine-readable role contract is exported from `attestor/consequence-admission`. Package consumers, docs, and tests use the same PDP / PEP / PIP / PAP vocabulary.

The machine-readable domain-pack boundary is exported from `attestor/consequence-admission`. It keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core, with pack-specific defaults below the shared decision vocabulary, failure registry, control bindings, and replay layer.

## Data And Security Posture

Attestor is designed as a control point, not a data lake.

It receives the proposed consequence and the evidence needed to decide whether that consequence may proceed. Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path. Attestor returns a bounded decision, reasons, and proof references.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) defines forbidden raw classes for raw prompts, raw tool payloads, raw customer identifiers, bank/payment data, wallet material, credentials, private policy thresholds, and downstream error bodies. Model feedback, retry records, audit evidence, dashboard summaries, and downstream receipts should expose structural control evidence, not raw business data.

The current evaluation baseline includes protected-route guards, tenant-boundary route guards, sanitized connector proof paths, PostgreSQL proof connector limits when configured, CI coverage for smoke/security/provenance checks, and explicit live/ops verification separation.

Production data handling depends on the chosen hosted or customer-operated deployment, including secrets management, retention, logging, access control, and commercial support boundaries. Start with [Security Policy](SECURITY.md) and [Production readiness](docs/08-deployment/production-readiness.md).

## What Attestor Is Not

Attestor is not:

- the model, the agent runtime, or a generic orchestration workspace
- a wallet, custody platform, payment processor, or downstream system of record
- a permission slip for AI actions without customer-side enforcement
- proof that any runtime profile in this evaluation release is production-ready
- a substitute for an external security audit, compliance certification, or customer deployment review

## Deeper Docs

Use this as a map, not a wall of links.

**Evaluation and first run.** Start here when you want to run the repo and understand exactly what the evaluation release proves: [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md), [v0.1.2 evaluation release notes](docs/00-evaluation/v0.1.2-evaluation-release-notes.md), [Try Attestor first](docs/01-overview/try-attestor-first.md), [What you can do with Attestor](docs/01-overview/what-you-can-do.md), [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md), [Customer admission gate](docs/01-overview/customer-admission-gate.md), [Non-bypassable gateway demo](docs/01-overview/non-bypassable-gateway-demo.md), [Agent retry wrapper demo](docs/01-overview/agent-retry-wrapper-demo.md), [Proof model](docs/05-proof/proof-model.md), [Signing and verification](docs/06-signing/signing-verification.md).

**Product and integration path.** Use these when deciding how Attestor fits into a customer workflow: [AI action authorization positioning](docs/01-overview/action-authorization-positioning.md), [Attestor operating model](docs/01-overview/operating-model.md), [Customer integration recipes](docs/01-overview/customer-integration-recipes.md), [Hosted action authorization API](docs/01-overview/hosted-action-authorization-api.md), [First hosted API call](docs/01-overview/hosted-first-api-call.md), [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md), [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md), [Pricing ROI calculator](docs/01-overview/pricing-roi-calculator.md), [Hosted customer journey](docs/01-overview/hosted-customer-journey.md), [Hosted account visibility](docs/01-overview/hosted-account-visibility.md).

**Core contracts.** These are the documents to read before changing the admission engine, package surface, or public language: [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md), [Attestor language contract](docs/02-architecture/attestor-language-contract.md), [Consequence taxonomy](docs/02-architecture/consequence-taxonomy.md), [Domain pack boundary](docs/02-architecture/domain-pack-boundary.md), [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md), [Verifier helper](docs/02-architecture/verifier-helper.md), [Adapter framework](docs/02-architecture/adapter-framework.md), [Crypto intelligence buildout](docs/02-architecture/crypto-intelligence-buildout.md), [Crypto intelligence surface](docs/02-architecture/crypto-intelligence-platform-surface.md).

**Action surface and Policy Foundry.** These explain how OpenAPI/manifests, shadow traffic, review handoff, red-team fixture bundle output, and live downstream replay evidence become review material: [Action surface manifest intake](docs/02-architecture/action-surface-manifest-intake.md), [Action surface declaration ingestors](docs/02-architecture/action-surface-declaration-ingestors.md), [Action surface profiler](docs/02-architecture/action-surface-profiler.md), [Action surface integration artifacts](docs/02-architecture/action-surface-integration-artifacts.md), [Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md), [Policy Foundry onboarding](docs/02-architecture/policy-foundry-onboarding.md), [Policy Foundry failure gap map](docs/02-architecture/policy-foundry-failure-gap-map.md), [Integration mode readiness](docs/02-architecture/integration-mode-readiness.md).

**Failure controls, evidence, and replay.** Read these when a finding needs to become a control, fixture, proof packet, or runtime check: [Failure mode registry](docs/02-architecture/failure-mode-registry.md), [Failure mode control bindings](docs/02-architecture/failure-mode-control-bindings.md), [Failure mode replay fixtures](docs/02-architecture/failure-mode-replay-fixtures.md), [Untrusted content authority guard](docs/02-architecture/untrusted-content-authority-guard.md), [Tool result poisoning guard](docs/02-architecture/tool-result-poisoning-guard.md), [Approval provenance guard](docs/02-architecture/approval-provenance-guard.md), [Stale authority policy guard](docs/02-architecture/stale-authority-policy-guard.md), [Recipient tenant boundary replay](docs/02-architecture/recipient-tenant-boundary-replay.md), [Scope explosion guard](docs/02-architecture/scope-explosion-guard.md), [Human review fatigue guard](docs/02-architecture/human-review-fatigue-guard.md), [Decision context drift binding](docs/02-architecture/decision-context-drift-binding.md), [No-go condition ledger](docs/02-architecture/no-go-condition-ledger.md), [Audit evidence export](docs/02-architecture/audit-evidence-export.md), [Tamper-evident history](docs/02-architecture/tamper-evident-history.md), [Business risk dashboard](docs/02-architecture/business-risk-dashboard.md), [Dashboard API summary](docs/02-architecture/dashboard-api-summary.md), [External review packet](docs/02-architecture/external-review-packet.md), [Policy limit model](docs/02-architecture/policy-limit-model.md), [Downstream presentation binding](docs/02-architecture/downstream-presentation-binding.md), [Presentation replay ledger](docs/02-architecture/presentation-replay-ledger.md), [Downstream execution receipt](docs/02-architecture/downstream-execution-receipt.md).

**Runtime and production boundary.** These are for operators moving beyond local evaluation: [Production storage path](docs/02-architecture/production-storage-path.md), [Proof console buildout](docs/02-architecture/proof-console-buildout.md), [Production runtime hardening buildout](docs/02-architecture/production-runtime-hardening-buildout.md), [Production shared authority plane buildout](docs/02-architecture/production-shared-authority-plane-buildout.md), [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md), [Production readiness](docs/08-deployment/production-readiness.md), [Tenant isolation boundary](docs/02-architecture/tenant-isolation-boundary.md), [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md), [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml).
