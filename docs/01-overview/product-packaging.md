# Commercial Packaging, Pricing, and Evaluation

This document is the commercial truth source for Attestor plan structure, pricing, free evaluation, hosted trial posture, delivery paths, billable usage, add-on modules, and the production licensing boundary.

Attestor is one product: an **AI Action Control Plane for high-consequence systems**. Finance is the deepest proven wedge today. Crypto extends the same platform core and control model. Healthcare and other domains should be packaged as consequence packs on the same product, not as separate products.

## What Customers Buy

Customers are not buying a file workspace, chatbot shell, wallet, or separate product per domain.

They are buying:

- governed release and authorization before consequence
- portable proof and independent verification
- authority closure and auditability
- a shared platform core that can carry multiple consequence packs
- a hosted path and a customer-operated path, depending on control requirements

Customer data, business workflows, models, agents, wallets, and operational systems stay in the customer's own environment. Attestor sits in front of the consequence boundary.

The commercial pack boundary follows the architecture boundary: packs may add domain defaults, evidence shapes, policy templates, adapter projections, readiness signals, and replay examples, but they do not become separate decision engines or separate product identities by default. The technical truth source is [Domain pack boundary](../02-architecture/domain-pack-boundary.md).

## Pricing Principle

Attestor should be priced around **admissions before consequence**, not seats, MAU, files, tokens, prompts, or generic API calls.

The value unit is:

> one proposed consequence evaluated by Attestor before a downstream system is allowed to act.

This keeps the commercial model aligned with the product promise. A high-volume customer pays for the number of controlled consequence decisions, while a careful verifier-heavy customer is not penalized for checking proof, inspecting account state, or retrying safely with idempotency.

## Billable Meter

The primary hosted meter is:

`monthly_admission_runs`

A run is billable when Attestor accepts a customer request, evaluates a proposed consequence, and produces a decision/proof posture for that consequence.

Billable examples:

- a finance pipeline admission before writing a report, filing, export, or approval artifact
- a programmable-money admission before a wallet, Safe, bundler, payment, or custody handoff
- a release or policy admission before an operational workflow proceeds
- a custom consequence-pack admission where Attestor returns `admit`, `narrow`, `review`, `warn`, or `block`

Not billable:

- health, readiness, JWKS, public metadata, or static proof reads
- account, usage, entitlement, feature, billing export, or billing portal reads
- authentication failures and unauthorized requests
- validation failures before an admission can be formed
- quota or rate-limit failures that stop before consequence evaluation
- duplicate idempotent retries for the same already-counted admission
- offline verification performed by customer systems

That boundary protects customer authority: billing should not punish safe verification, proof inspection, or fail-closed retry behavior.

## Open Foundation Boundary

Attestor adoption depends on customers being able to verify proof without turning Attestor hosted APIs into a mandatory online single point of failure.

The commercial intent is:

- admission vocabulary, canonical digest rules, and conformance fixtures should remain freely inspectable
- verifier SDKs and downstream verification helpers should not be Pro-only gates
- offline verification should stay available to customer systems
- hosted control-plane convenience, retention, collaboration, billing, policy operations, support, and enterprise deployment rights are the billable surface

Current repository licensing remains governed by [LICENSE](../../LICENSE). Any future split into separately licensed specification, verifier SDK, or conformance fixture packages must be handled explicitly before public claims are made about Apache-licensed subpackages.

## Delivery Paths

Attestor is sold through two delivery paths.

### Hosted Path

For teams that want a managed product path.

What they get:

- hosted account and tenant boundary
- API keys
- usage and billing visibility
- hosted release, proof, policy, and authorization access
- Stripe Checkout and Billing Portal handoff for self-service paid tiers

### Customer-Operated Path

For teams that need stricter runtime, isolation, data residency, air-gapped operation, or operating control.

What they get:

- the same Attestor product and core control model
- a commercial deployment path under customer control
- enterprise packaging around deployment boundary, scale, retention, support, KMS, and operating requirements

## Account Trial And Workflow Tiers

List prices below are USD. Operators may configure local Stripe currency and
tax behavior separately, but the repository billing model is intentionally not
an account-plan ladder. The account starts in a free `trial` evaluation state;
paid commercial access is attached to named workflow subscription items.

| Billing surface | Price | Included usage | Overage | Intended use |
|---|---:|---:|---:|---|
| `trial` account entitlement | free | `10,000` admissions total over `30` days | none; hard stop | evaluate observed consequence surfaces before buying a workflow |
| `pilot-workflow` | USD `$99` / month | `15,000` admissions / month | none; hard stop | one selected pack in observe, warn, simulation, or scoped rollout review |
| `starter-workflow` | USD `$299` / month | `25,000` admissions / month | `$0.05` / admission | one customer-gated production workflow for one selected pack |
| `pro-workflow` | USD `$999` / month | `250,000` admissions / month | `$0.025` / admission | one advanced workflow with all current hosted packs, SSO, RBAC, and dual-control activation |
| negotiated deployment | contract | custom | custom | customer-operated, dedicated, air-gapped, regulated, or bespoke support/retention boundary |

There is no self-service hosted account billing plan named `developer`,
`starter`, `pro`, `scale`, `enterprise`, or `community` in the current billing
model. Legacy account-plan ids may remain in local compatibility records for
old tenant keys, but they are not Stripe checkout products and they do not own
paid entitlement state.

## Billing Surface Details

### Trial Account Entitlement

The trial is an account-level onboarding state for serious evaluation, not a
Stripe subscription item and not a permanent free plan.

- `30` day window
- `10,000` admissions total
- up to `2` shadow surfaces
- up to `2` account users
- `14` day retention
- no card required
- hard-limited before production workflow overage can apply

The trial lets high-consequence teams observe real action paths before asking a
workflow to review or stop actions. Production enforcement still needs a named
workflow entitlement and a customer PEP/gate.

## Policy Foundry Packaging Boundary

Policy Foundry is the platform-core onboarding layer for observed-action policy
mining. It identifies evidence-backed, approval-required policy candidates and
missing controls from customer shadow action traffic. It is not a pack-specific
feature and should not be positioned as a finance-only or crypto-only product.

External-facing language should avoid saying that Attestor "trains on" or
"learns the company." The safer claim is that Attestor identifies policy
candidates and missing controls from observed shadow actions.

The commercial boundary is:

| Billing surface | Policy Foundry posture |
|---|---|
| `trial` account entitlement | Shadow discovery, action risk inventory, Policy Twin preview, readiness and no-go scoring preview, no production enforcement. |
| `pilot-workflow` | One selected pack in observe, warn, review-simulation, and scoped-rollout-review modes with hosted review surface and audit export. |
| `starter-workflow` | One selected customer-gated production workflow with Policy Foundry, Policy Twin, active questions, review/enforce ladder, and handoff artifacts. |
| `pro-workflow` | One advanced workflow with all current hosted packs, candidate red-team replay, drift/policy-debt detection, RBAC, SSO, dual-control activation, and longer retention. |
| negotiated deployment | Customer-operated, dedicated, air-gapped, regulated, or custom pack deployment boundaries. |

Security minimums must not become paid-only features. Redaction, proof
verification, tenant isolation, fail-closed semantics, offline verifier access,
replay/idempotency safety, deterministic controls, approval-required promotion,
and the rule that shadow reads never auto-enforce must apply across all plans.

The repo-side commercial boundary contract is implemented as
`attestor.policy-foundry-commercial-boundary.v1`. It separates plan capabilities
from the safety floor and explicitly states that billing state is not required
for safety minimums. The hosted Policy Foundry route now also includes
`attestor.policy-foundry-billing-entitlement-enforcement.v1`, which uses the
billing-provider entitlement read model when it is available to prevent
request-body plan elevation and to fail closed for commercial/production
Foundry requests when billing access is missing or disabled. The implementation
boundary is still important: this is commercial access gating, not policy
authority, deployment readiness, or production activation. Current repo-side
foundations include shadow events, action risk inventory, policy discovery
candidates, simulation reports, promotion drafts, activation readiness gates,
readiness and no-go scoring, candidate red-team replay, active questions,
review-only patch packs, one-command self-onboarding, outcome feedback,
drift/policy-debt detection, the commercial boundary contract, and hosted
Foundry billing entitlement enforcement.

### Pilot Workflow

First self-service paid workflow for bounded rollout.

- `15,000` admissions per month
- observe, warn, review-simulation, and scoped-rollout-review modes
- one selected consequence pack
- `3` account users
- hosted review surface and hosted UI flow
- audit export
- `30` day retention
- hard stop at quota

Pilot Workflow does not carry automatic paid overage and does not unlock enforce
mode. It is for real workflow discovery and controlled rollout rehearsal before
production enforcement.

### Starter Workflow

First self-service paid workflow for customer-gated production use.

- `25,000` admissions per month
- shadow, warn, review, and enforce modes
- `5` account users
- one selected consequence pack enabled for production use
- reviewer queue
- policy authoring and activation workflow
- JSON/CSV audit export
- email or chat support with next-business-day target
- `90` day audit retention
- target hosted SLA posture: `99.5%`
- overage: `$0.05` per admission

Starter Workflow should be strong enough for one real production workflow. Do
not make enforce mode a Pro-only feature; the product is an authorization gate,
not only an analytics dashboard. Enforce mode still requires a customer
PEP/gate; the workflow entitlement does not create downstream authority by
itself.

### Pro Workflow

Advanced self-service workflow.

- `250,000` admissions per month
- all Starter Workflow features
- all current hosted consequence packs inside one workflow boundary
- `25` team members
- RBAC
- SSO with OIDC or SAML
- dual-control activation approvals
- tamper-evident attestation log and audit export
- webhook and queue integrations
- custom admission rules
- priority support with `4` hour target
- `1` year audit retention
- target hosted SLA posture: `99.9%`
- overage: `$0.025` per admission

Pro Workflow is where procurement-grade B2B features begin. SSO belongs here
because it is a common deal requirement, not an exotic enterprise luxury.

Crypto packs are package-boundary SDK surfaces, not hosted crypto route claims.
Using them requires a customer-side adapter or PEP that imports the Attestor
crypto packages and binds wallet, Safe, bundler, custody, x402, or solver
execution to Attestor admission results. Attestor does not become the wallet,
custodian, signer, broadcaster, facilitator, or settlement verifier.

### Negotiated Deployment

Negotiated commercial path.

- custom admission volume
- customer-operated deployment option
- air-gapped or on-premises deployment option
- dedicated infrastructure option
- custom retention, usually `5`+ years
- DPA and regulated-contract support where applicable
- external audit support
- quarterly business reviews
- bespoke consequence-pack and integration terms
- pre-release feature access when commercially approved

Negotiated deployment is where banks, insurers, regulated healthcare operators,
custody providers, large AI platforms, and strict data-boundary customers fit.
It is not a self-service hosted account plan and is not wired through the legacy
Stripe account-plan checkout.

## Add-On Modules

| Add-on | Price posture | What it adds |
|---|---:|---|
| Healthcare Pack | USD `$999` / month | CMS QRDA III, FHIR, VSAC, and healthcare measure-reporting controls |
| Compliance Pack | USD `$3,000` / year | SOC 2-oriented evidence package and auditor-ready documentation exports |
| External Audit Co-Signing | USD `$5,000` / audit window | Attestor co-signing support for customer external audit packets |
| Custom Domain Pack Development | USD `$50,000` - `$250,000` engagement | bespoke consequence pack for insurance claims, energy, procurement, government, or other customer domain |
| 24/7 Premium Support | `+20%` on tier | Pro Workflow and negotiated deployment support uplift |
| Private Policy Bundle Mirror | USD `$500` / month | signed customer-specific policy bundle distribution endpoint |

Add-ons should not fragment the core trust story. They extend the same admission and proof model into deeper domains or operating requirements.

## Overage Philosophy

Paid workflow overage should be soft by default for production workflow tiers.

When a paid workflow exceeds included usage:

- continue processing admissions
- mark usage as overage
- emit one Stripe Billing Meter Event per over-quota admission
- notify at `80%`, `100%`, and `110%`
- expose overage clearly in account usage and billing export
- avoid surprise hard stops on production consequence gates

Hard quota remains appropriate for the free Trial account entitlement and Pilot
Workflow. Paid production customers should not discover on a Friday night that
all consequence gates stopped because billing crossed a line.

The Stripe runtime contract for the hosted workflow model is:

- base monthly prices: `ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW`, `ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW`, `ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW`
- metered overage prices: `ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW`, `ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW`
- overage meter event name: `attestor_admission_overage` unless `ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME` is explicitly overridden
- meter payload keys: `stripe_customer_id` and `value`

## Buying Motion

The customer path should stay simple:

1. use Trial to observe the consequence surface
2. create a paid workflow through Stripe Checkout for Pilot, Starter Workflow, or Pro Workflow
3. talk to sales for higher-volume, support, retention, or customer-operated deployment needs
4. keep negotiated deployment offline/operator-owned for air-gapped operation, custom compliance, or negotiated legal terms
5. keep the same account plane for keys, usage, billing, entitlement, and proof visibility

For the detailed hosted signup and checkout flow, see [Hosted customer journey](hosted-customer-journey.md). For exact route order, auth boundaries, success signals, and failure signals, see [Hosted journey contract](hosted-journey-contract.md).

## Production Licensing

This repository is source-available under Business Source License 1.1.

The practical commercial rule is:

- non-production use is allowed
- production use requires a commercial license until the Change Date in [LICENSE](../../LICENSE)

That applies whether Attestor is used through a hosted paid plan or through a customer-operated production deployment.

## Current Implementation Status

This pricing model is now split between account access/quota compatibility and workflow billing entitlements.

Current shipped hosted implementation uses:

- account access ids: `trial` plus legacy compatibility records for older local tenant keys
- account usage meter name: `monthly_admission_runs`
- workflow usage meter name: `workflow_monthly_admissions`
- first free hosted path: `trial` with `10,000` admissions over `30` days
- paid workflow tiers: `pilot-workflow`, `starter-workflow`, `pro-workflow`
- required paid Stripe workflow price env vars: `ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW`, `ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW`, and `ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW`
- required paid Stripe workflow overage price env vars: `ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW` and `ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW`
- Stripe overage meter events are emitted for over-quota workflow admissions through the `attestor_admission_overage` meter event name

## Hosted Commercial Surface

The hosted commercial surface only needs to cover:

- signup and login
- account overview
- entitlement and usage
- API key lifecycle
- Stripe Checkout and Billing Portal
- docs and onboarding

It does not need to become a broad document workspace or generic AI application.

## Operator Handoff

This document defines the public commercial shape and the current implementation boundary.

The buyer-facing sizing worksheet and ROI formula lives in [Pricing ROI calculator](pricing-roi-calculator.md). That page may feed a public website widget later, but this document remains the plan, price, quota, and licensing source of truth.

The operator-side Stripe and billing bootstrap lives in
[Stripe commercial bootstrap](stripe-commercial-bootstrap.md). That page must
stay operator-facing and should not become a second public pricing page. Its
workflow-based setup instructions implement this document's current billing
model: account-level trial first, then workflow subscription items through
Stripe Checkout and signed webhook convergence.

## Product Truth To Preserve

Do not describe Attestor as:

- a file uploader
- an AI workspace
- a generic AI-for-everything platform
- a separate finance product and separate crypto product
- a token-metered AI model wrapper
- a user-seat governance dashboard

Describe it as:

**Attestor is one product: an AI Action Control Plane for high-consequence systems, delivered through hosted and customer-operated paths, priced around admissions before consequence, with finance as the deepest proven wedge and crypto and healthcare as consequence packs on the same core.**
