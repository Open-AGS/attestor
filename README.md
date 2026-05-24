# Attestor

![Attestor: proof before consequence](docs/assets/attestor-readme-hero.png)

**AI Action Control Plane for high-risk AI actions.**

Attestor controls the boundary between AI intent and real-world consequence.

A prompt is not a formal rule; it is linguistic context interpreted by a probabilistic model. That makes it useful for guidance, but insufficient as deterministic control. The control point has to move from the model's text to the proposed action: the action intent can be structured, checked, admitted, narrowed, reviewed, or blocked before it becomes a real consequence.

AI agents draft refunds, prepare supplier payments, request data exports, trigger operational changes, and build wallet transactions. The dangerous moment is not the text the model produced. It is the point where that output becomes a real action in a downstream system.

Attestor treats that proposed action as a consequence to admit, narrow, review, or block before the customer system changes state.

```text
AI proposes -> Attestor checks -> consequence is admitted, narrowed, reviewed, or blocked -> proof remains
```

## Where It Sits In A Customer Stack

```text
AI agent / workflow
  -> proposed action
Customer PEP / gateway / verifier / adapter
  -> asks Attestor for an admission decision
Attestor
  -> admit / narrow / review / block + proof material
Downstream system
  -> executes only if the customer enforcement point allows it
```

Without an enforced customer-side PEP, gateway, verifier, or adapter in front of the downstream system, Attestor is advisory evidence, not a control point.
With that enforced downstream point, Attestor becomes the control point before consequence.

Start in shadow mode. See what your AI agents would have done before you let them act.

The trust boundary is the action, not the model response. Attestor does not replace the model, agent runtime, wallet, custody platform, orchestration layer, or downstream system. It sits at the consequence boundary and returns a bounded admission decision plus proof material.

> [!NOTE]
> This repository is source-available under Business Source License 1.1. Non-production use is allowed. Production use requires a commercial license until the Change Date in [LICENSE](LICENSE).

## Try It In 60 Seconds

```bash
npm ci
npm run demo:golden-refund
npm run demo:golden-refund -- --json
npm run demo:golden-refund -- --determinism-check
```

You will see:

- a synthetic AI refund action surface
- digest-only canonical shadow fixtures
- runtime assurance smoke over the refund scenarios
- Policy Foundry summary material with named gaps
- a pilot readiness packet that can only report shadow-pilot readiness or not-ready for this path
- Engine Visibility over 8 scenarios, including gate order, evidence-completeness metrics, no-claims, and deterministic/shuffled-order digest stability
- Markdown-first demo output, with JSON available for machines
- explicit no-claims: no live Stripe or Shopify refund, no customer deployment, no policy activation, no auto-enforcement

For a guided first run, see [Try Attestor first](docs/01-overview/try-attestor-first.md).

## Current Repository Truth

Attestor is an **evaluation release**: reviewer-runnable, CI-backed, and useful for technical evaluation. The repository demonstrates one product language:

```text
proposed consequence -> consequence admission -> proof material -> customer enforcement
```

Current named baseline:

```text
Package version: 0.2.0-evaluation
Tag target:      v0.2.0-evaluation
Release type:    GitHub pre-release / Golden Path evaluation baseline
```

The clearest repo-side path today is [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md): a synthetic, shadow-only refund scenario that runs through action-surface material, canonical shadow fixtures, runtime assurance smoke, Policy Foundry summary, pilot readiness, Engine Visibility, an optional reviewer sandbox, and a local demo output.

That path does not execute refunds, activate policy, call Stripe or Shopify, deploy infrastructure, or claim production readiness. The repository is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

Green local checks such as `npm run verify` are repo-side evidence only. They do not prove live cloud infrastructure, hosted Policy Foundry production readiness, live OpenAI or Anthropic calls, Snowflake or healthcare substrate readiness, customer-operated deployment readiness, or non-bypassable customer enforcement unless those specific opt-in live checks and customer-side PEP evidence have also run.

Start review with:

- [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)
- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.2.0 evaluation release notes](docs/00-evaluation/v0.2.0-evaluation-release-notes.md)
- [Security Policy](SECURITY.md)
- [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml)
- [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md)
- [Audit remediation tracker](docs/audit/attestor-audit-remediation-tracker.md)
- [LLM provider runtime decision](docs/02-architecture/llm-provider-runtime-decision.md)

## Golden Path: Refund

[Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md) is the first end-to-end repo path a reviewer should run. It is a synthetic support refund scenario, not a refund product, finance-only product, or separate engine.

It shows one concrete Money Movement consequence through the same Attestor control boundary:

```text
refund action surface -> canonical shadow fixtures -> runtime assurance smoke -> Policy Foundry summary -> pilot readiness packet -> Engine Visibility -> optional reviewer sandbox -> demo output
```

Run it with:

```bash
npm run demo:golden-refund
```

It demonstrates:

- action-surface material from a refund OpenAPI fixture
- digest-only canonical shadow fixtures
- runtime assurance smoke over the refund scenarios
- Policy Foundry summary material with named evidence and policy gaps
- a pilot readiness packet that can report shadow-pilot readiness or not-ready
- an Engine Visibility report with 8 scenarios, gate trace, derived gate metrics, no-claims, and deterministic/shuffled-order digest checks
- a Reviewer Sandbox for one strict local refund JSON input, without turning Attestor into a generic BYO-action runtime
- Markdown-first demo output, with JSON available for machines

The first business contrast is deliberately simple:

```text
Without Attestor in this repo path: no gate trace, no issue-code/no-claim boundary, no digest-bound shadow readiness evidence.
With Attestor in this repo path:    8 scenarios, 7 visible gate stages, named Foundry gaps, 0 target-system calls, shadow-pilot readiness verdict.
```

It does not execute refunds, call Stripe or Shopify, deploy a customer PEP, activate policy, learn from traffic, or auto-enforce. Use it to inspect whether the Attestor consequence engine is coherent before looking at lower-level admission primitives. The optional determinism check is:

```bash
npm run demo:golden-refund -- --determinism-check
```

To try one local reviewer-supplied refund input, run:

```bash
npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json
```

## The Control Boundary

Use Attestor where a capable AI-assisted system should not be able to act just because it can form a request:

- a support copilot drafts a refund, credit, suspension, or account-status change
- a procurement agent proposes paying a supplier after reading a changed bank-account instruction
- an analytics agent requests a customer-data export or live database-backed report
- a treasury or wallet workflow prepares a programmable-money transaction
- a compliance workflow prepares a filing, notice, or customer communication
- an operations agent proposes a deploy, secret rotation, incident action, or infrastructure change

Every case has the same shape: a proposed consequence must pass policy, authority, evidence, freshness, scope, replay, and enforcement checks before a downstream system acts. Fail-closed means the action does not proceed silently when those checks cannot close.

## Adoption Path

Attestor can start in `observe` or `warn` mode. It receives proposed AI actions, computes what would have been admitted, narrowed, reviewed, or blocked, and lets the customer measure risk and review load before switching to `review` or `enforce`.

```text
observe -> warn -> review -> enforce
```

That is the runtime mode ladder. The policy promotion path is longer because enforcement needs evidence, approval, and proof:

```text
observe -> recommend -> simulate -> approve -> enforce -> prove
```

Shadow mode discovers the real action surface first: which high-risk AI actions exist, which actions have no policy, which downstream tools have too much authority, and which consequences would have been blocked before execution. This keeps adoption on the same consequence boundary without asking the customer to stop workflows on day one.

The completed local example of this adoption shape is [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md). It is not a refund product or separate engine; it is one concrete scenario path through the same Attestor consequence engine.

## Core Operating Loop

Attestor's customer loop is deliberately simple:

```text
shadow events
  -> action-surface inventory
  -> evidence, authority, policy, and adapter gaps
  -> review-only policy candidates
  -> counterexamples and Policy Twin replay
  -> reviewer approval
  -> scoped rollout
  -> outcome feedback and drift checks
```

Policy Foundry is the onboarding layer for this adoption path. It mines observed actions into policy candidates. It does not train models, write policy automatically, or prove production readiness.

It identifies policy candidates, generates a red-team fixture bundle and local replay reports through the local adversarial replay executor, can attach live downstream replay evidence when configured, prepares review handoff material, keeps promotion approval-required, and records reviewed outcome feedback plus drift/policy-debt findings.
The one-command self-onboarding path renders session, coverage, blockers, gate plan, handoff, red-team fixtures, and review-only patch material for review; it does not apply patches, deploy infrastructure, issue credentials, activate enforcement, or prove production readiness.

The hosted onboarding workflow contract packages the hosted review surface, wizard state, entitlement context, and storage-readiness checks. Customers cannot self-attest readiness controls.

Safety boundary: hosted onboarding returns review material only. It does not store raw manifest payloads, issue credentials, apply patches, deploy infrastructure or a gateway, execute production traffic, activate enforcement, or prove production readiness. Rendered packets can include next steps such as `add-shadow-capture`, but `applies patches: false` is the default.

For local browser QA, run `npm run preview:policy-foundry-hosted-ui` and open the printed localhost URL. The hosted UI flow preview renders blocked and ready hosted review states from safe fixtures only.

For an already deployed hosted runtime, the opt-in Policy Foundry production smoke probe checks health, readiness, hosted workflow rendering, hosted HTML rendering, passing live replay evidence, and failed replay blocking with secret-safe output.

The failure-mode registry turns known AI-action failure modes into controls before business action. Untrusted content, poisoned tool results, fake approvals, stale policy, tenant or recipient boundary mistakes, scope explosion, review fatigue, drift, no-go holds, and missing replay evidence become explicit checks.

The current generic admission route implements the first control ladder for this path. Recommendation, simulation, and reporting surfaces build on top of that ladder so enforcement can be approved before a workflow is asked to stop.

## Why It Exists

Most AI safety layers focus on prompts, outputs, model behavior, or tool routing. Those matter, but they do not close the business risk by themselves. The costly event is downstream:

```text
bad instruction -> plausible model output -> tool call -> real system changed
```

Attestor treats the proposed consequence as the object of control. It does not need the model to become perfectly reliable. It requires the action to pass a bounded admission decision before the system of record, payment layer, wallet, filing path, admin plane, or operational workflow is allowed to act.

This is AI action control-plane infrastructure: not a chatbot feature, not a prompt wrapper, not a generic agent workspace, and not a governance checklist. Gateways, verifiers, and adapters are enforcement points; the product is the control plane before important AI actions become real.

## What You Can Run Today

Use the first command when evaluating the current end-to-end repo path, then inspect the lower-level demos:

```bash
npm run demo:golden-refund                        # Golden Path: Refund shadow-only path
npm run example:admission                         # Basic admission decision demo
npm run example:customer-gate                     # Customer-side enforcement demo
npm run example:non-bypassable-gateway           # Verifier-before-dispatch demo
npm run example:agent-retry-wrapper              # Bounded correction retry demo
```

`npm run example:admission` is the First useful admission demo: a lower-level admission decision path, not the current end-to-end Golden Path.

The rest are useful once the first path makes sense: `npm run example:action-surface-onboarding`, `npm run render:action-surface-onboarding-packet`, `npm run policy-foundry:self-onboard`, `npm run preview:policy-foundry-hosted-ui`, `npm run proof:surface`, `npm run showcase:proof`, `npm run verify:cert`, and `npm run verify`.

`npm run proof:surface` writes `.attestor/proof-surface/latest/` with `.attestor/proof-surface/latest/manifest.json`, a machine-readable bundle, markdown summary, and one unified proof output per runnable scenario. It is a local static proof surface; it does not start a hosted console or claim a public hosted crypto route.

`npm run showcase:proof` generates a local PostgreSQL-backed proof packet. Without a live upstream model, `verify:cert` reports `PROOF_DEGRADED` and exits non-zero by design. The green local release gate remains `npm run verify`.

The first generic hosted consequence-admission route is:

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
- `POST /api/v1/shadow/policy-foundry/hosted-onboarding-workflow` renders the hosted onboarding workflow contract.
- `GET /api/v1/shadow/policy-foundry/hosted-onboarding-workflow/sessions/:sessionId` resumes persistent hosted wizard state from the current local file-backed evaluation store.

For an already deployed hosted runtime, run the smoke probe with `ATTESTOR_BASE_URL` and `ATTESTOR_API_KEY`:

```bash
ATTESTOR_BASE_URL=https://your-attestor-host \
ATTESTOR_API_KEY=... \
npm run probe:policy-foundry-production-smoke
```

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
    "safeForModel": true,
    "missingFields": ["evidenceRefs"],
    "safeInstruction": "Retry only with bounded references for the missing fields."
  },
  "retry": {
    "retryAllowed": true,
    "maxAttempts": 2,
    "requiresChangedRequest": true,
    "sameRequestReplayAllowed": false
  }
}
```

The corrected request must bind back to the held admission. That makes a retry an auditable continuation, not a fresh probe. Some failures are deliberately not model-retryable. `policy-blocked`, unsafe signals, custom-domain review, and adapter readiness gaps route to customer review or operator control instead of teaching the model how to probe the boundary.

Retry budget and loop-abuse controls are documented in the [retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md) and [agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md).

## Proof Model

Attestor is built around proof before consequence. A consequence should not merely happen; it should leave a bounded record of why it was allowed, narrowed, reviewed, or blocked.

A decision can include outcome, policy context, authority and evidence status, reason codes, verification references, and local proof artifacts that can be reviewed later.

The current evaluation baseline includes local proof packets, verification kits, signed proof paths, CI-backed smoke checks, and release artifact attestation for tagged evaluation releases. The exact boundary and non-claims are documented in the [Evaluation Packet](docs/00-evaluation/v0.1-evaluation-packet.md), [v0.2.0 release notes](docs/00-evaluation/v0.2.0-evaluation-release-notes.md), and [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md).

Read "proof material" as typed evidence, not one universal cryptographic guarantee:

| Proof material | What it means here | What it does not prove |
|---|---|---|
| Decision and reason records | The local admission outcome, reason codes, and bounded retry posture. | Cryptographic integrity by itself. |
| Canonical digests and refs | Hash-bound references that make replay and comparison possible without raw payloads. | That the referenced external fact is true or third-party immutable. |
| Signed packets and certificates | Cryptographically signed artifacts when the configured signing path is present. | A production signing boundary unless external KMS/HSM readiness is specifically proven. |
| Tamper-evident history | Hash-chained local records when the decision path writes through that ledger. | A hosted immutable ledger, third-party notarization, or customer audit completion. |
| Release and CI artifacts | Evaluation release evidence, smoke checks, and artifact attestation for repo review. | Live customer deployment, live provider availability, or production control effectiveness. |

When a live upstream model or external verifier is absent, proof verification can intentionally degrade instead of pretending full trust. For example, `verify:cert` may report `PROOF_DEGRADED`; that is evaluation honesty, not a production proof.

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

The pack list is taxonomy, not an equal-maturity claim. The clearest end-to-end repo path today is still Golden Path: Refund; other packs name consequence classes and integration boundaries that can mature at different speeds without becoming separate products.

## Architecture: Core And Packs

Attestor is one product: an AI Action Control Plane with a shared consequence-admission core and modular packs for specific consequence domains.

One product. One platform core.

The current engine shape is a reference-monitor-style consequence admission path, not a prompt filter. The deeper architecture decision is [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md). It uses PDP / PEP / PIP / PAP-style separation inside a contract-first modular monolith. This is not a claim that every customer workflow is already non-bypassable; that posture requires a real customer-side enforcement point, gateway, verifier, or adapter.

Attestor without that enforced downstream PEP is advisory, not control.

For one visual map of the whole internal machine, start with the [Attestor internal machine map](docs/02-architecture/attestor-internal-machine-map.md). It shows the route lanes, all ten decision axes, current decision points, module groups, stores, packs, side loops, and terminal outcomes in one dark system-design SVG map.

Read the architecture as a path, not a stack diagram:

```text
proposed consequence
  -> consequence admission
  -> policy, authority, evidence, freshness, and enforcement checks
  -> bounded decision
  -> proof material
  -> downstream verification
```

The roles are simple enough to keep in your head:

- **PDP:** turns structured action intent, policy, evidence, authority, scope, and failure-mode controls into `admit`, `narrow`, `review`, or `block`.
- **PEP:** sits at the downstream edge and verifies the decision, proof, binding, and replay posture before execution.
- **PIP:** supplies evidence, authority, tenant, recipient, freshness, policy-version, no-go, and context facts. It does not approve actions by itself.
- **PAP:** handles policy lifecycle: signed bundles, simulation, rollout, activation rules, reviewer constraints, and provenance checks.

Pack-specific adapters live below this layer. They provide native evidence, simulations, verifier bindings, conformance fixtures, and downstream handoff details for a consequence class without getting a separate product identity or trust story.

Attestor does not guess what to run automatically, and it does not bypass the customer's own enforcement point.

The machine-readable role contract is exported from `attestor/consequence-admission`. The machine-readable domain-pack boundary is exported from `attestor/consequence-admission`. That boundary keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core.

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

Use this as a map, not a wall of links. Start with the small set below; the expandable index is for maintainers changing the contract surface.

**Evaluate the repo.** Run this path first if you want to know what is real today: [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md), [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md), [v0.2.0 evaluation release notes](docs/00-evaluation/v0.2.0-evaluation-release-notes.md), [Try Attestor first](docs/01-overview/try-attestor-first.md), [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md), [Customer admission gate](docs/01-overview/customer-admission-gate.md), [Non-bypassable gateway demo](docs/01-overview/non-bypassable-gateway-demo.md), [Agent retry wrapper demo](docs/01-overview/agent-retry-wrapper-demo.md), [Proof model](docs/05-proof/proof-model.md), [Signing and verification](docs/06-signing/signing-verification.md).

**Place it in a customer system.** These docs answer where the control point sits and how an evaluator should think about rollout: [What you can do with Attestor](docs/01-overview/what-you-can-do.md), [Attestor operating model](docs/01-overview/operating-model.md), [Customer integration recipes](docs/01-overview/customer-integration-recipes.md), [Hosted action authorization API](docs/01-overview/hosted-action-authorization-api.md), [First hosted API call](docs/01-overview/hosted-first-api-call.md), [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md), [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md), [Pricing ROI calculator](docs/01-overview/pricing-roi-calculator.md), [Hosted customer journey](docs/01-overview/hosted-customer-journey.md), [Hosted account visibility](docs/01-overview/hosted-account-visibility.md).

**Change the core carefully.** Read these before changing public language, package boundaries, or admission semantics: [Attestor internal machine map](docs/02-architecture/attestor-internal-machine-map.md), [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md), [Attestor language contract](docs/02-architecture/attestor-language-contract.md), [Consequence taxonomy](docs/02-architecture/consequence-taxonomy.md), [Domain pack boundary](docs/02-architecture/domain-pack-boundary.md), [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md), [Verifier helper](docs/02-architecture/verifier-helper.md), [Adapter framework](docs/02-architecture/adapter-framework.md).

**Plan trust unlocks without reopening frozen work.** Use the [Attestor unlock source of truth](docs/02-architecture/attestor-unlock-source-of-truth.md), [Unified Shadow-to-Policy Master Plan](docs/02-architecture/unified-shadow-to-policy-master-plan.md), [Consequence Runtime Assurance Overview](docs/02-architecture/consequence-runtime-assurance-overview.md), and [Runtime Activation Decision Packet](docs/02-architecture/runtime-activation-decision-packet.md) before opening broad production, signer, customer PEP, shared-store, LLM-provider, runtime-wiring, or customer pilot work. These docs record repo truth and the non-claims that must stay intact.

**Onboard a new action surface.** Start from the concrete [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md), then use the Policy Foundry path from API/manifests to review material: [Action surface manifest intake](docs/02-architecture/action-surface-manifest-intake.md), [Action surface declaration ingestors](docs/02-architecture/action-surface-declaration-ingestors.md), [Action surface graph](docs/02-architecture/action-surface-graph.md), [Evidence state model](docs/02-architecture/evidence-state-model.md), [Policy Candidate PR contract](docs/02-architecture/policy-candidate-pr-contract.md), [Active Question Engine](docs/02-architecture/active-question-engine.md), [Counterexample replay generator](docs/02-architecture/counterexample-replay-generator.md), [Policy Twin backtest](docs/02-architecture/policy-twin-backtest.md), [Review-by-exception inbox](docs/02-architecture/review-by-exception-inbox.md), [Approval/dismiss feedback loop](docs/02-architecture/approval-dismiss-feedback-loop.md), [Enterprise integration recipes](docs/02-architecture/enterprise-integration-recipes.md), [General Crypto Transaction Gate](docs/02-architecture/general-crypto-transaction-gate.md), [Domain consequence recipes](docs/02-architecture/domain-consequence-recipes.md), [Pilot readiness packet](docs/02-architecture/pilot-readiness-packet.md), [Action surface profiler](docs/02-architecture/action-surface-profiler.md), [Action surface integration artifacts](docs/02-architecture/action-surface-integration-artifacts.md), [Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md), [Policy Foundry onboarding](docs/02-architecture/policy-foundry-onboarding.md), [Policy Foundry failure gap map](docs/02-architecture/policy-foundry-failure-gap-map.md), [Integration mode readiness](docs/02-architecture/integration-mode-readiness.md).

<details>
<summary>Maintainer reference index</summary>

**Controls, evidence, and replay.** [Failure mode registry](docs/02-architecture/failure-mode-registry.md), [Failure mode control bindings](docs/02-architecture/failure-mode-control-bindings.md), [Failure mode replay fixtures](docs/02-architecture/failure-mode-replay-fixtures.md), [Untrusted content authority guard](docs/02-architecture/untrusted-content-authority-guard.md), [Tool result poisoning guard](docs/02-architecture/tool-result-poisoning-guard.md), [Approval provenance guard](docs/02-architecture/approval-provenance-guard.md), [Stale authority policy guard](docs/02-architecture/stale-authority-policy-guard.md), [Agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md), [Scope explosion guard](docs/02-architecture/scope-explosion-guard.md), [Human review fatigue guard](docs/02-architecture/human-review-fatigue-guard.md), [Decision context drift binding](docs/02-architecture/decision-context-drift-binding.md), [No-go condition ledger](docs/02-architecture/no-go-condition-ledger.md), [Recipient tenant boundary replay](docs/02-architecture/recipient-tenant-boundary-replay.md), [Audit evidence export](docs/02-architecture/audit-evidence-export.md), [Tamper-evident history](docs/02-architecture/tamper-evident-history.md), [Business risk dashboard](docs/02-architecture/business-risk-dashboard.md), [Dashboard API summary](docs/02-architecture/dashboard-api-summary.md), [External review packet](docs/02-architecture/external-review-packet.md), [Policy limit model](docs/02-architecture/policy-limit-model.md), [Downstream presentation binding](docs/02-architecture/downstream-presentation-binding.md), [Presentation replay ledger](docs/02-architecture/presentation-replay-ledger.md), [Downstream execution receipt](docs/02-architecture/downstream-execution-receipt.md).

**Crypto and runtime boundaries.** [Crypto intelligence buildout](docs/02-architecture/crypto-intelligence-buildout.md), [Crypto intelligence surface](docs/02-architecture/crypto-intelligence-platform-surface.md), [Production storage path](docs/02-architecture/production-storage-path.md), [Proof console buildout](docs/02-architecture/proof-console-buildout.md), [Production runtime hardening buildout](docs/02-architecture/production-runtime-hardening-buildout.md), [Production shared authority plane buildout](docs/02-architecture/production-shared-authority-plane-buildout.md), [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md), [Tenant isolation boundary](docs/02-architecture/tenant-isolation-boundary.md), [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md), [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml).

</details>
