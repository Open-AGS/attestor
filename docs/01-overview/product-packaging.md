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

## Hosted Plans

List prices below are USD. Operators may configure local Stripe currency and tax behavior separately, but the product positioning should use this table as the public commercial model.

| Plan | Price | Included usage | Overage | Intended use |
|---|---:|---:|---:|---|
| `developer` | free | `500` admissions / month | none; upgrade required | perpetual individual evaluation, local proof work, and low-volume shadow/warn testing |
| `trial` | free for `60` days | `5,000` admissions total | none; converts to `developer` or paid plan | serious shadow-mode evaluation with Pro-like discovery before enforcement rollout |
| `starter` | USD `$299` / month or `$2,990` / year | `25,000` admissions / month | `$0.05` / admission | first real hosted production workflow |
| `pro` | USD `$1,499` / month or `$14,990` / year | `250,000` admissions / month | `$0.025` / admission | multiple workflows, one business unit, or a growing AI/agent platform |
| `scale` | USD `$5,999` / month, contract-led | `1,000,000` admissions / month | `$0.015` / admission | high-volume hosted deployment with stricter support, retention, and integration needs |
| `enterprise` | from USD `$50,000` / year | custom, normally `5,000,000`+ admissions / month | custom | self-hosted, air-gapped, dedicated, regulated, or negotiated deployment boundary |

## Plan Details

### Developer

Perpetual free plan, not a short trial.

- `500` admissions per month
- shadow and warn mode only
- one user
- no SSO
- community support
- `7` day audit retention
- public or local proof artifacts only

Developer exists to keep the funnel alive after evaluation. It should not carry production enforcement promises.

### Free Shadow Trial

The trial is an onboarding state for serious evaluation, not a permanent plan.

- `60` day window
- `5,000` admissions total
- Pro-like feature discovery in shadow mode
- Policy Foundry discovery preview
- Policy Twin simulation preview
- readiness and no-go scoring preview
- policy candidate discovery
- no card required
- converts to Developer, Starter, Pro, Scale, or Enterprise

High-consequence teams need enough time to observe real action surfaces before asking workflows to stop. Fourteen days is usually too short for finance, crypto, healthcare, custody, or regulated operational buyers.

## Policy Foundry Packaging Boundary

Policy Foundry is the platform-core onboarding layer for observed-action policy
mining. It identifies evidence-backed, approval-required policy candidates and
missing controls from customer shadow action traffic. It is not a pack-specific
feature and should not be positioned as a finance-only or crypto-only product.

External-facing language should avoid saying that Attestor "trains on" or
"learns the company." The safer claim is that Attestor identifies policy
candidates and missing controls from observed shadow actions.

The commercial boundary is:

| Plan | Policy Foundry posture |
|---|---|
| `developer` | Basic shadow summary, action risk inventory, limited policy candidate preview, no production enforcement. |
| `trial` | Time-boxed Pro-like shadow discovery, Policy Twin preview, readiness and no-go scoring preview, no production enforcement. |
| `starter` | One production workflow with basic Policy Foundry, Policy Twin, active questions, review/enforce ladder, and short-retention audit export. |
| `pro` | Advanced confidence scoring, candidate red-team replay, multiple workflows, RBAC/SSO, dual approval, and longer retention. |
| `scale` | Higher-volume discovery, custom templates, drift detection, stronger support, and longer retention. |
| `enterprise` | Customer-operated, dedicated, air-gapped, regulated, or custom pack deployment boundaries. |

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

### Starter

First self-service paid hosted plan.

- `25,000` admissions per month
- shadow, warn, review, and enforce modes
- three team members
- one consequence pack enabled for production use
- reviewer queue
- policy authoring and activation workflow
- JSON/CSV audit export
- email or chat support with next-business-day target
- `30` day audit retention
- target hosted SLA posture: `99.5%`
- overage: `$0.05` per admission

Starter should be strong enough for one real production workflow. Do not make enforce mode a Pro-only feature; the product is an authorization gate, not only an analytics dashboard.

### Pro

Primary growth-stage plan.

- `250,000` admissions per month
- all Starter features
- finance and crypto packs included
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

Pro is where procurement-grade B2B features begin. SSO belongs here because it is a common deal requirement, not an exotic enterprise luxury.

Crypto packs are package-boundary SDK surfaces, not hosted crypto route claims.
Using them requires a customer-side adapter or PEP that imports the Attestor
crypto packages and binds wallet, Safe, bundler, custody, x402, or solver
execution to Attestor admission results. Attestor does not become the wallet,
custodian, signer, broadcaster, facilitator, or settlement verifier.

### Scale

High-volume hosted plan, still below custom enterprise deployment.

- `1,000,000` admissions per month
- all Pro features
- multi-region hosted posture where available
- named customer success owner
- `1` hour business-hours response target
- target hosted SLA posture: `99.95%`
- `3` year audit retention
- compliance-oriented evidence exports
- one custom integration or custom pack scoping workshop included
- overage: `$0.015` per admission

Scale is priced to make upgrade economically obvious before Pro overage becomes painful.

### Enterprise

Negotiated commercial path.

- custom admission volume, normally `5,000,000`+ admissions per month
- customer-operated deployment option
- air-gapped or on-premises deployment option
- dedicated infrastructure option
- custom retention, usually `5`+ years
- DPA and regulated-contract support where applicable
- external audit support
- quarterly business reviews
- bespoke consequence-pack and integration terms
- pre-release feature access when commercially approved

Enterprise is where banks, insurers, regulated healthcare operators, custody providers, large AI platforms, and strict data-boundary customers fit.

## Add-On Modules

| Add-on | Price posture | What it adds |
|---|---:|---|
| Healthcare Pack | USD `$999` / month | CMS QRDA III, FHIR, VSAC, and healthcare measure-reporting controls |
| Compliance Pack | USD `$3,000` / year | SOC 2-oriented evidence package and auditor-ready documentation exports |
| External Audit Co-Signing | USD `$5,000` / audit window | Attestor co-signing support for customer external audit packets |
| Custom Domain Pack Development | USD `$50,000` - `$250,000` engagement | bespoke consequence pack for insurance claims, energy, procurement, government, or other customer domain |
| 24/7 Premium Support | `+20%` on tier | Pro, Scale, and Enterprise support uplift |
| Private Policy Bundle Mirror | USD `$500` / month | signed customer-specific policy bundle distribution endpoint |

Add-ons should not fragment the core trust story. They extend the same admission and proof model into deeper domains or operating requirements.

## Overage Philosophy

Paid hosted overage should be soft by default.

When a paid customer exceeds included usage:

- continue processing admissions
- mark usage as overage
- emit one Stripe Billing Meter Event per over-quota admission
- notify at `80%`, `100%`, and `110%`
- expose overage clearly in account usage and billing export
- avoid surprise hard stops on production consequence gates

Hard quota remains appropriate for free Developer and Trial plans. Paid production customers should not discover on a Friday night that all consequence gates stopped because billing crossed a line.

The Stripe runtime contract for the default hosted model is:

- base monthly prices: `ATTESTOR_STRIPE_PRICE_STARTER`, `ATTESTOR_STRIPE_PRICE_PRO`, `ATTESTOR_STRIPE_PRICE_SCALE`
- metered overage prices: `ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER`, `ATTESTOR_STRIPE_OVERAGE_PRICE_PRO`, `ATTESTOR_STRIPE_OVERAGE_PRICE_SCALE`
- overage meter event name: `attestor_admission_overage` unless `ATTESTOR_STRIPE_OVERAGE_METER_EVENT_NAME` is explicitly overridden
- meter payload keys: `stripe_customer_id` and `value`

## Buying Motion

The customer path should stay simple:

1. use Developer or Trial to observe the consequence surface
2. upgrade through Stripe Checkout for Starter or Pro
3. talk to sales for Scale when volume, support, or retention needs are larger
4. move to Enterprise for customer-operated deployment, air-gapped operation, custom compliance, or negotiated legal terms
5. keep the same account plane for keys, usage, billing, entitlement, and proof visibility

For the detailed hosted signup and checkout flow, see [Hosted customer journey](hosted-customer-journey.md). For exact route order, auth boundaries, success signals, and failure signals, see [Hosted journey contract](hosted-journey-contract.md).

## Production Licensing

This repository is source-available under Business Source License 1.1.

The practical commercial rule is:

- non-production use is allowed
- production use requires a commercial license until the Change Date in [LICENSE](../../LICENSE)

That applies whether Attestor is used through a hosted paid plan or through a customer-operated production deployment.

## Current Implementation Status

This pricing model is now the runtime plan-catalog shape for hosted account provisioning, quota defaults, rate limits, admin plan views, Stripe price lookup, and usage response naming.

Current shipped hosted implementation uses:

- plan ids: `developer`, `trial`, `starter`, `pro`, `scale`, `enterprise`
- legacy alias: `community` resolves to `developer` for backward compatibility with older local records
- usage meter name: `monthly_admission_runs`
- paid hosted quota behavior: Starter, Pro, and Scale continue into soft overage; Developer and Free Shadow Trial remain hard-limited
- first free hosted path: `developer` with `500` admissions per month
- free shadow trial plan metadata: `trial` with `60` days and `5,000` admissions
- required paid Stripe price env vars: `ATTESTOR_STRIPE_PRICE_STARTER`, `ATTESTOR_STRIPE_PRICE_PRO`, and `ATTESTOR_STRIPE_PRICE_SCALE`
- required paid Stripe overage price env vars: `ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER`, `ATTESTOR_STRIPE_OVERAGE_PRICE_PRO`, and `ATTESTOR_STRIPE_OVERAGE_PRICE_SCALE`
- Stripe overage meter events are emitted for over-quota paid admissions through the `attestor_admission_overage` meter event name
- optional Enterprise self-service price env var: `ATTESTOR_STRIPE_PRICE_ENTERPRISE`, only when Enterprise checkout is intentionally enabled

One commercial behavior is still a separate lifecycle step and must not be overclaimed:

- The `trial` plan exists in the catalog, but signup still provisions Developer by default; trial invitation/conversion lifecycle is a separate implementation step.

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

The operator-side Stripe and billing bootstrap lives in [Stripe commercial bootstrap](stripe-commercial-bootstrap.md). That page must stay operator-facing and should not become a second public pricing page.

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
