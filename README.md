# Attestor

**Control infrastructure for high-risk AI actions.**

Attestor is an AI Action Control Plane that sits between AI intent and real-world consequence.

It does not try to make the model perfect. It controls the proposed action.

Attestor is designed as a control point, not a data lake. It is not built to collect all of the customer's raw data; it needs enough structured action context and proof references to decide whether the action is sufficiently bound to policy, authority, evidence, scope, freshness, replay posture, and downstream enforcement.

A prompt is not a formal rule; it is linguistic context interpreted by a probabilistic model. That makes it useful for guidance, but insufficient as deterministic control. The control point has to move from the model's text to the proposed action: the action intent can be structured, checked, admitted, narrowed, reviewed, or blocked before it becomes a real consequence.

That is the short version of Attestor: proof before consequence. Before an AI-prepared action changes money, data, access, infrastructure, or a wallet, the system should know what was requested, who or what had authority, what evidence supported it, what scope was allowed, and why the action was admitted, narrowed, sent to review, or blocked.

AI agents draft refunds, prepare supplier payments, request data exports, trigger operational changes, and build wallet transactions. The dangerous moment is not the text the model produced. It is the point where that output becomes a real action in a downstream system.

Attestor treats that proposed action as a consequence to admit, narrow, review, or block before the customer system changes state.

```text
AI proposes -> Attestor checks -> consequence is admitted, narrowed, reviewed, or blocked -> proof remains
```

## Why This Matters Now

AI systems are moving from chat into tools that can touch payment flows, data exports, access changes, customer messages, infrastructure, and programmable money. In regulated environments, that pushes AI actions into the same world as AI risk management, third-party oversight, operational resilience, ICT risk management, incident accountability, and high-risk AI governance; see the [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework), the U.S. banking agencies' [Interagency Guidance on Third-Party Relationships](https://www.federalreserve.gov/frrs/guidance/interagency-guidance-on-third-party-relationships.htm), the [EU Digital Operational Resilience Act](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2554), and the [EU AI Act](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R1689).

Attestor does not claim compliance, framework coverage, supervisory approval, or production readiness from this repository. It gives teams a concrete control point to structure, check, record, and stop high-risk AI actions before they create consequences that are hard to undo.

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

Start with the all-pack evaluator:

```bash
npm ci
npm run demo:golden-paths
npm run demo:golden-paths -- --json
```

Then run the first concrete story:

```bash
npm run demo:golden-refund
npm run demo:golden-refund -- --json
npm run demo:golden-refund -- --determinism-check
```

For the smallest admission example and onboarding packet:

```bash
npm run example:admission
npm run example:action-surface-onboarding
npm run render:action-surface-onboarding-packet
npm run example:non-bypassable-gateway
npm run example:agent-retry-wrapper
```

First useful admission demo: `npm run example:admission`.

The refund demo shows digest-only canonical shadow fixtures, runtime assurance smoke over the refund scenarios, Policy Foundry summary material with named gaps, Engine Visibility over 8 scenarios, and explicit no-claims: no live Stripe or Shopify refund, no customer deployment, no policy activation, no auto-enforcement.

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

This repository is not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit.

Green local checks such as `npm run verify` are repo-side evidence only. They do not prove live cloud infrastructure, hosted Policy Foundry production readiness, live OpenAI or Anthropic calls, Snowflake or healthcare substrate readiness, customer-operated deployment readiness, or non-bypassable customer enforcement unless those specific opt-in live checks and customer-side PEP evidence have also run.

Start review with:

1. Run `npm run demo:golden-paths` for the all-pack local status.
2. Run `npm run demo:golden-refund` for the first concrete path.
3. Use the [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md), [v0.2.0 evaluation release notes](docs/00-evaluation/v0.2.0-evaluation-release-notes.md), [Security Policy](SECURITY.md), [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml), [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md), and [Audit remediation tracker](docs/audit/attestor-audit-remediation-tracker.md) only when you need deeper evidence.
4. Use the [LLM provider runtime decision](docs/02-architecture/llm-provider-runtime-decision.md) only when evaluating provider-facing runtime work.

## Golden Paths

Golden paths are concrete repo-side examples through the same Attestor control engine. They are not separate products and not equal-maturity claims for every pack.

- [Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md)
- [Golden Path: Controlled Data Export](docs/02-architecture/golden-data-export-shadow-pilot.md)
- [Golden Path: Authority Change](docs/02-architecture/golden-authority-change-shadow-pilot.md)
- [Golden Path: External Communication](docs/02-architecture/golden-external-communication-shadow-pilot.md)
- [Golden Path: Operational Execution](docs/02-architecture/golden-operational-execution-shadow-pilot.md)
- [Golden Path: Programmable Money](docs/02-architecture/golden-programmable-money-shadow-pilot.md)

For a compact all-pack view, run `npm run demo:golden-paths`. Use `npm run demo:golden-paths -- --json` when you need machine-readable output.

| Path | Pack | Command | What it shows |
|---|---|---|---|
| Refund | Money Movement | `npm run demo:golden-refund` | Synthetic, shadow-only refund through action surface, fixtures, runtime smoke, Policy Foundry, pilot readiness, Engine Visibility, reviewer sandbox, and demo output. |
| Controlled Data Export | Data Movement | `npm run demo:golden-data-export` | Synthetic, shadow-only customer export and report release with digest-only fixtures and no warehouse calls. |
| Authority Change | Authority Change | `npm run demo:golden-authority-change` | Synthetic, shadow-only grant, revocation, delegation, approval, and access-change scenarios. |
| External Communication | External Communication | `npm run demo:golden-external-communication` | Synthetic, shadow-only customer-facing, legal, billing, support, and public-message review path. |
| Operational Execution | Operational Execution | `npm run demo:golden-operational-execution` | Synthetic, shadow-only deploy, rollback, secret rotation, infrastructure change, incident, and runbook path. |
| Programmable Money | Programmable Money | `npm run demo:golden-programmable-money` | Synthetic, shadow-only wallet-facing intent. It does not sign, broadcast, call a wallet, activate enforcement, or prove chain settlement. |

Every case has the same shape: a proposed consequence must pass policy, authority, evidence, freshness, scope, replay, and enforcement checks before a downstream system acts.

## Golden Path: Refund

[Golden Path: Refund](docs/02-architecture/golden-refund-shadow-pilot.md) is the first end-to-end repo path a reviewer should run. It is a synthetic support refund scenario, not a refund product, finance-only product, or separate engine.

```text
refund action surface -> canonical shadow fixtures -> runtime assurance smoke -> Policy Foundry summary -> pilot readiness packet -> Engine Visibility -> optional reviewer sandbox -> demo output
```

Use it to inspect whether the Attestor consequence engine is coherent before looking at lower-level admission primitives. It does not execute refunds, call Stripe or Shopify, deploy a customer PEP, activate policy, learn from traffic, or auto-enforce.

Business contrast:

```text
Without Attestor in this repo path: no gate trace, no issue-code/no-claim boundary, no digest-bound shadow readiness evidence.
With Attestor in this repo path:    8 scenarios, 7 visible gate stages, named Foundry gaps, 0 target-system calls, shadow-pilot readiness verdict.
```

Reviewer sandbox:

```bash
npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json
```

## The Control Boundary

Use Attestor where a capable AI-assisted system should not be able to act just because it can form a request:

- a procurement agent proposes paying a supplier after reading a changed bank-account instruction
- an analytics agent requests a customer-data export or live database-backed report
- a support agent drafts a refund or billing adjustment
- an operations agent prepares a deploy, secret rotation, or incident action
- a treasury or wallet workflow prepares a programmable-money transaction

Attestor does not guess what to run automatically, and it does not bypass the customer's own enforcement point.

## Adoption Path

Attestor can start in `observe` or `warn` mode. The adoption ladder is:

```text
observe -> warn -> review -> enforce
```

The broader shadow-to-enforcement path is:

```text
observe -> recommend -> simulate -> approve -> enforce -> prove
```

That means a team can collect shadow events, generate review-only policy candidates, simulate them, wait for reviewer approval, and only then move toward enforcement. It does not train models, write policy automatically, or prove production readiness.

Policy Foundry is the onboarding layer for this adoption path. It turns shadow events into review-only candidates, reviewed outcome feedback, drift/policy-debt findings, and gate plans. It generates a red-team fixture bundle and local replay reports through the local adversarial replay executor, and can attach live downstream replay evidence when configured. It also packages the hosted review surface, wizard state, entitlement context, and storage-readiness checks for the hosted onboarding workflow; use `npm run preview:policy-foundry-hosted-ui` for local browser QA with safe fixtures only. For an already deployed hosted runtime, the opt-in Policy Foundry production smoke probe can verify hosted surfaces without claiming production readiness. Safety boundary: hosted onboarding returns review material only. Customers cannot self-attest readiness controls.

## Core Operating Loop

The loop is intentionally small:

1. Capture shadow events from proposed actions.
2. Build bounded action-surface material.
3. Generate review-only policy candidates.
4. Run counterexamples, Policy Twin backtests, and replay checks.
5. Require reviewer approval before promotion.
6. Return a bounded decision and proof material to the customer PEP.

The current generic admission route implements the first control ladder for this path.

## Why It Exists

Attestor is AI action control-plane infrastructure, not another chat wrapper. The goal is to move the control point from language output to the action boundary, where policy, authority, evidence, scope, replay, tenant, token, and proof checks can happen before a real system changes state.

## Decision Model

Attestor never returns an open-ended "looks good." It returns one of four bounded outcomes:

| Decision | Meaning |
|---|---|
| `admit` | The proposed action may proceed. |
| `narrow` | Only a safer bounded version may proceed. |
| `review` | The action must wait for review. |
| `block` | The action is rejected fail-closed. |

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

Some failures are deliberately not model-retryable. `policy-blocked`, unsafe signals, custom-domain review, and adapter readiness gaps route to customer review or operator control instead of teaching the model how to probe the boundary. Retry budget and loop-abuse controls are documented in the [retry attempt ledger](docs/02-architecture/retry-attempt-ledger.md) and [agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md).

## Proof Model

Attestor is built around proof before consequence. A high-risk action should not merely happen; it should leave local proof artifacts that can be reviewed later.

Read "proof material" as typed evidence, not one universal cryptographic guarantee:

| Proof material | What it means here | What it does not prove |
|---|---|---|
| Decision and reason records | The local admission outcome, reason codes, and bounded retry posture. | Cryptographic integrity by itself. |
| Canonical digests and refs | Hash-bound references that make replay and comparison possible without raw payloads. | That the referenced external fact is true or third-party immutable. |
| Signed packets and certificates | Cryptographically signed artifacts when the configured signing path is present. | A production signing boundary unless external KMS/HSM readiness is specifically proven. |
| Tamper-evident history | Hash-chained local records when the decision path writes through that ledger. | A hosted immutable ledger, third-party notarization, or customer audit completion. |
| Release and CI artifacts | Evaluation release evidence, smoke checks, and artifact attestation for repo review. | Live customer deployment, live provider availability, or production control effectiveness. |

Run the local proof surface with `npm run proof:surface`; it writes `.attestor/proof-surface/latest/manifest.json`, a machine-readable bundle, markdown summary, and one unified proof output per runnable scenario. It is a local static proof surface; it does not start a hosted console or claim a public hosted crypto route.

`npm run showcase:proof` generates a local PostgreSQL-backed proof packet. Without a live upstream model, `verify:cert` may report `PROOF_DEGRADED` and exit non-zero by design. That is evaluation honesty, not a production proof.

The first generic hosted admission route is:

```http
POST /api/v1/admissions
```

It accepts an explicit action domain and adoption mode: `observe`, `warn`, `review`, or `enforce`. This is the route-level entry point for the shadow-to-enforcement ladder described above.

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
  "evidenceRefs": ["order:987", "payment:456"],
  "policyRef": "policy:refunds:v1"
}
```

## Consequence Packs

Attestor packs are organized by the kind of real-world action an AI system can create, not by the industry the customer happens to be in.

A pack does not answer "is this finance or crypto?" It answers the control question:

```text
What real system action is this AI trying to create?
```

The current pack language is:

- **Money Movement** - refunds, payouts, supplier payments, credits, adjustments, and payment-adjacent dispatch.
- **Data Movement** - warehouse queries, customer exports, report releases, and controlled data packages.
- **Authority Change** - grants, revocations, unlocks, approvals, delegations, and access changes.
- **External Communication** - customer-facing, legal, regulated, billing, support, or public messages.
- **Operational Execution** - deploys, secret rotations, infrastructure changes, incident actions, and live operations.
- **Programmable Money** - wallet calls, Safe transactions, account-abstraction flows, custody callbacks, payment middleware, and intent settlement.

The pack is the consequence class. Adapters sit underneath it. The pack list is taxonomy, not an equal-maturity claim. Other packs name action classes and integration boundaries that can mature at different speeds without becoming separate products.

## Architecture: Core And Packs

Attestor is one product: an AI Action Control Plane with a shared admission core and modular packs for specific action domains.

One product. One platform core.

The deeper architecture decision is [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md). It uses PDP / PEP / PIP / PAP-style separation inside a contract-first modular monolith. This is not a claim that every customer workflow is already non-bypassable; that posture requires a real customer-side enforcement point, gateway, verifier, or adapter.

Attestor without that enforced downstream PEP is advisory, not control.

Read the architecture as a path, not a stack diagram:

```text
proposed action
  -> admission
  -> policy, authority, evidence, freshness, and enforcement checks
  -> bounded decision
  -> proof material
  -> downstream verification
```

- **PDP:** turns structured action intent, policy, evidence, authority, scope, and failure-mode controls into `admit`, `narrow`, `review`, or `block`.
- **PEP:** sits at the downstream edge and verifies the decision, proof, binding, and replay posture before execution.
- **PIP:** supplies evidence, authority, tenant, recipient, freshness, policy-version, no-go, and context facts. It does not approve actions by itself.
- **PAP:** handles policy lifecycle: signed bundles, simulation, rollout, activation rules, reviewer constraints, and provenance checks.

Pack-specific adapters live below this layer. They provide native evidence, simulations, verifier bindings, conformance fixtures, and downstream handoff details for an action class without getting a separate product identity or trust story.

The machine-readable role contract is exported from `attestor/consequence-admission`. The machine-readable domain-pack boundary is exported from `attestor/consequence-admission`. That boundary keeps finance, crypto, filing, general admission, and future packs as bounded extensions over the shared admission core.

For one visual map of the whole internal machine, start with the [Attestor internal machine map](docs/02-architecture/attestor-internal-machine-map.md).

## Data And Security Posture

Attestor is designed as a control point, not a data lake.

It receives the proposed action and the evidence needed to decide whether that action may proceed. Customer systems keep ownership of the model, agent, workflow, wallet, database, and downstream execution path. Attestor returns a bounded decision, reasons, and proof references.

The [data minimization and redaction policy](docs/02-architecture/data-minimization-redaction-policy.md) defines forbidden raw classes for raw prompts, raw tool payloads, raw customer identifiers, bank/payment data, wallet material, credentials, private policy thresholds, and downstream error bodies. Model feedback, retry records, audit evidence, dashboard summaries, and downstream receipts should expose structural control evidence, not raw business data.

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

**Evaluate the repo.** Run the Golden Paths above first, then use the evaluation packet and quickstarts:

- [Attestor Evaluation Packet v0.1](docs/00-evaluation/v0.1-evaluation-packet.md)
- [v0.2.0 evaluation release notes](docs/00-evaluation/v0.2.0-evaluation-release-notes.md)
- [Try Attestor first](docs/01-overview/try-attestor-first.md)
- [Consequence admission quickstart](docs/01-overview/consequence-admission-quickstart.md)
- [Customer admission gate](docs/01-overview/customer-admission-gate.md)
- [Non-bypassable gateway demo](docs/01-overview/non-bypassable-gateway-demo.md)
- [Agent retry wrapper demo](docs/01-overview/agent-retry-wrapper-demo.md)
- [Proof model](docs/05-proof/proof-model.md)
- [Signing and verification](docs/06-signing/signing-verification.md)

**Place it in a customer system.** These docs answer where the control point sits and how an evaluator should think about rollout: [What you can do with Attestor](docs/01-overview/what-you-can-do.md), [Attestor operating model](docs/01-overview/operating-model.md), [Customer integration recipes](docs/01-overview/customer-integration-recipes.md), [Hosted action authorization API](docs/01-overview/hosted-action-authorization-api.md), [First hosted API call](docs/01-overview/hosted-first-api-call.md), [Finance and crypto first integrations](docs/01-overview/finance-and-crypto-first-integrations.md), [Commercial packaging, pricing, and evaluation](docs/01-overview/product-packaging.md), [Pricing ROI calculator](docs/01-overview/pricing-roi-calculator.md), [Hosted customer journey](docs/01-overview/hosted-customer-journey.md), [Hosted account visibility](docs/01-overview/hosted-account-visibility.md).

**Change the core carefully.** Read these before changing public language, package boundaries, or admission semantics: [Attestor internal machine map](docs/02-architecture/attestor-internal-machine-map.md), [AI Action Control Plane architecture](docs/02-architecture/ai-action-control-plane-architecture.md), [Attestor language contract](docs/02-architecture/attestor-language-contract.md), [Consequence taxonomy](docs/02-architecture/consequence-taxonomy.md), [Domain pack boundary](docs/02-architecture/domain-pack-boundary.md), [Downstream enforcement contract](docs/02-architecture/downstream-enforcement-contract.md), [Verifier helper](docs/02-architecture/verifier-helper.md), [Adapter framework](docs/02-architecture/adapter-framework.md), [General Crypto Transaction Gate](docs/02-architecture/general-crypto-transaction-gate.md).

**Run local proof and readiness paths.** The repo includes local-only proof, rehearsal, and promotion packet tooling: [Proof surface tracker](docs/02-architecture/proof-console-buildout.md), [Production runtime hardening](docs/02-architecture/production-runtime-hardening-buildout.md), [Production shared authority plane](docs/02-architecture/production-shared-authority-plane-buildout.md), [Production rehearsal buildout](docs/02-architecture/production-rehearsal-buildout.md), [Production go/no-go packet](docs/08-deployment/production-go-no-go-packet.md), [Artifact attestation plan](docs/08-deployment/artifact-attestation-plan.md), [Evaluation Smoke workflow](.github/workflows/evaluation-smoke.yml).

**Onboard a new action surface.** Start from one golden path, then use Policy Foundry artifacts and review material. Safety boundary: generated onboarding output is review material only, applies patches: false, and should add-shadow-capture before enforcement.

```bash
npm run policy-foundry:self-onboard
```

The self-onboarding command renders session, coverage, blockers, gate plan, handoff, red-team fixtures, and review-only patch material. The handoff is a review handoff, and the fixtures are packaged as a red-team fixture bundle.

Hosted route for the same review packet: `POST /api/v1/shadow/action-surface/onboarding-packet`.
Hosted Policy Foundry workflow route: `POST /api/v1/shadow/policy-foundry/hosted-onboarding-workflow`.

<details>
<summary>Maintainer reference index</summary>

**Action surface and Policy Foundry.** [Action surface manifest intake](docs/02-architecture/action-surface-manifest-intake.md), [Action surface declaration ingestors](docs/02-architecture/action-surface-declaration-ingestors.md), [Action surface integration artifacts](docs/02-architecture/action-surface-integration-artifacts.md), [Action surface graph](docs/02-architecture/action-surface-graph.md), [Action surface profiler](docs/02-architecture/action-surface-profiler.md), [Action surface onboarding packet](docs/02-architecture/action-surface-onboarding-packet.md), [Evidence state model](docs/02-architecture/evidence-state-model.md), [Policy Candidate PR contract](docs/02-architecture/policy-candidate-pr-contract.md), [Active Question Engine](docs/02-architecture/active-question-engine.md), [Counterexample replay generator](docs/02-architecture/counterexample-replay-generator.md), [Policy Twin backtest](docs/02-architecture/policy-twin-backtest.md), [Review-by-exception inbox](docs/02-architecture/review-by-exception-inbox.md), [Approval/dismiss feedback loop](docs/02-architecture/approval-dismiss-feedback-loop.md), [Enterprise integration recipes](docs/02-architecture/enterprise-integration-recipes.md), [Domain consequence recipes](docs/02-architecture/domain-consequence-recipes.md), [Pilot readiness packet](docs/02-architecture/pilot-readiness-packet.md), [Policy Foundry onboarding](docs/02-architecture/policy-foundry-onboarding.md), hosted onboarding workflow contract, hosted review surface, hosted UI flow, [Integration mode readiness](docs/02-architecture/integration-mode-readiness.md), live downstream replay evidence.

**Controls, evidence, and replay.** [Failure mode registry](docs/02-architecture/failure-mode-registry.md), [Failure mode control bindings](docs/02-architecture/failure-mode-control-bindings.md), [Failure mode replay fixtures](docs/02-architecture/failure-mode-replay-fixtures.md), [Untrusted content authority guard](docs/02-architecture/untrusted-content-authority-guard.md), [Adversarial evidence fixtures](docs/02-architecture/adversarial-evidence-fixtures.md), local adversarial replay executor, [Tool result poisoning guard](docs/02-architecture/tool-result-poisoning-guard.md), [Approval provenance guard](docs/02-architecture/approval-provenance-guard.md), [Stale authority policy guard](docs/02-architecture/stale-authority-policy-guard.md), [Agent loop abuse guard](docs/02-architecture/agent-loop-abuse-guard.md), [Scope explosion guard](docs/02-architecture/scope-explosion-guard.md), [Human review fatigue guard](docs/02-architecture/human-review-fatigue-guard.md), [Decision context drift binding](docs/02-architecture/decision-context-drift-binding.md), [No-go condition ledger](docs/02-architecture/no-go-condition-ledger.md), [Recipient tenant boundary replay](docs/02-architecture/recipient-tenant-boundary-replay.md), [Audit evidence export](docs/02-architecture/audit-evidence-export.md), [Tamper-evident history](docs/02-architecture/tamper-evident-history.md), [Business risk dashboard](docs/02-architecture/business-risk-dashboard.md), [Dashboard API summary](docs/02-architecture/dashboard-api-summary.md), [External review packet](docs/02-architecture/external-review-packet.md), [Policy limit model](docs/02-architecture/policy-limit-model.md), [Downstream presentation binding](docs/02-architecture/downstream-presentation-binding.md), [Presentation replay ledger](docs/02-architecture/presentation-replay-ledger.md), [Downstream execution receipt](docs/02-architecture/downstream-execution-receipt.md).

**Crypto and runtime boundaries.** [Crypto intelligence buildout](docs/02-architecture/crypto-intelligence-buildout.md), [Crypto intelligence surface](docs/02-architecture/crypto-intelligence-platform-surface.md), [Production storage path](docs/02-architecture/production-storage-path.md), [Tenant isolation boundary](docs/02-architecture/tenant-isolation-boundary.md), [Attestor unlock source of truth](docs/02-architecture/attestor-unlock-source-of-truth.md), [Unified Shadow-to-Policy Master Plan](docs/02-architecture/unified-shadow-to-policy-master-plan.md), [Consequence Runtime Assurance Overview](docs/02-architecture/consequence-runtime-assurance-overview.md), [Runtime Activation Decision Packet](docs/02-architecture/runtime-activation-decision-packet.md).

</details>
