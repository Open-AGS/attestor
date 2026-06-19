# Attestor Workflow-Based Launch Packaging Plan

Status: local planning draft, not the current public pricing source.

Source of truth for current repository facts: `origin/master`.

Current evidence state:

- Current repository model is still account/plan-centered:
  `developer`, `trial`, `starter`, `pro`, `scale`, and `enterprise`.
- This document proposes a workflow-entitlement launch model:
  `trial`, `pilot-workflow`, `starter-workflow`, and `pro-workflow`.
- Repository state on the workflow branch is now `partial-repo`: the
  workflow tier catalog, workflow entitlement access contract, Stripe
  bootstrap/readiness manifest, and targeted tests exist. Checkout routes,
  webhook convergence into workflow entitlements, usage metering by workflow,
  and public pricing copy are not complete.
- This document does not claim production readiness, customer PEP no-bypass,
  compliance readiness, live billing readiness, or enterprise readiness.

## Evidence Frame

Repository evidence used:

- `docs/01-overview/product-packaging.md`
- `docs/01-overview/hosted-customer-journey.md`
- `docs/01-overview/hosted-journey-contract.md`
- `docs/01-overview/stripe-commercial-bootstrap.md`
- `docs/01-overview/hosted-action-authorization-api.md`
- `docs/01-overview/consequence-admission-quickstart.md`
- `docs/02-architecture/policy-foundry-onboarding.md`
- `docs/02-architecture/domain-pack-boundary.md`
- `docs/02-architecture/domain-consequence-recipes.md`
- `docs/02-architecture/general-crypto-transaction-gate.md`
- `docs/02-architecture/pilot-readiness-packet.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/control-map.md`
- `docs/audit/live-proof-register.md`
- `src/service/plan-catalog.ts`
- `src/consequence-admission/policy-foundry-commercial-boundary.ts`
- `scripts/probe/probe-stripe-live-readiness.ts`
- `scripts/ops/bootstrap-stripe-commercial.ts`
- `package.json`

Official billing sources used:

- Stripe subscription Checkout:
  <https://docs.stripe.com/payments/checkout/build-subscriptions>
- Stripe Customer Portal:
  <https://docs.stripe.com/customer-management/integrate-customer-portal>
- Stripe usage-based billing:
  <https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide>
- Stripe subscription items:
  <https://docs.stripe.com/api/subscription_items>
- Stripe pricing for Hungary:
  <https://stripe.com/en-hu/pricing>
- Stripe Billing pricing:
  <https://stripe.com/en-hu/billing/pricing>

Source-backed Stripe notes:

- Stripe Checkout supports subscription mode for recurring purchases.
- Stripe recommends Products and Prices as the catalog model.
- Subscription items support complex subscription relationships and quantity.
- Usage-based billing uses meters and meter events.
- Customer Portal can let customers manage subscriptions and invoices.
- Attestor should not build manual renewal loops with raw PaymentIntents.
- Attestor should not use deprecated Stripe Plan objects.

## Launch Decision

The paid commercial unit is a workflow entitlement.

```text
one paid workflow entitlement = one monthly price
```

Trial remains account-level and free. Paid packages are sold per workflow.

| Unit | Price | Included usage | Overage | Launch role |
|---|---:|---:|---:|---|
| `trial` | `$0` | `10,000` total / `30` days | none | shadow discovery |
| `pilot-workflow` | `$99` / workflow / month | `15,000` / workflow / month | none | proof packet |
| `starter-workflow` | `$299` / wf / month | `25,000` / wf / month | `$0.05` | first gated wf |
| `pro-workflow` | `$999` / wf / month | `250,000` / wf / month | `$0.025` | advanced wf |

Remove from public launch packaging:

- public `developer`
- account-bundle `starter`
- account-bundle `pro`
- public `scale`
- public `enterprise`
- self-service annual billing
- launch add-ons

Keep only if needed internally:

- a hidden local/evaluation plan may remain for tests, examples, local proof
  work, or compatibility with existing records.
- that internal plan must not be marketed as a public free tier.

## Why Workflow Pricing Fits Attestor

Attestor value is not primarily a seat, MAU, token, file, or generic API-call
value. The value is controlling a specific consequence path before it becomes a
real-world effect.

That means the cleanest launch unit is:

```text
one controlled consequence workflow
```

Examples:

- refund approval before a refund service call
- customer data export before a warehouse/query/export call
- permission grant before an IAM change
- public communication before a customer-facing send
- production deploy before an infrastructure mutation
- Safe transaction proposal before programmable-money execution

If a customer wants to control another consequence path, they buy another
workflow entitlement.

## Workflow Definition

A workflow is:

```text
one tenant-bound controlled consequence path:
one downstream system or integration family
+ one consequence family
+ one policy/gate path
+ one workflow entitlement
```

The following should normally be separate workflows:

- refund creation
- payout approval
- supplier payment approval
- customer data export
- permission grant or revocation
- production deployment
- external customer communication
- Safe transaction proposal
- x402 payment handoff

The following should not be accepted as one workflow without operator review:

- multiple unrelated downstream systems
- multiple unrelated consequence families
- mixed money movement and data movement
- mixed authority change and public communication
- an entire business unit with many unrelated action types
- a generic "all AI actions" bucket

This boundary prevents customers from buying one workflow and pushing a whole
control-plane estate through it.

## Package Inheritance Rule

Larger paid workflow tiers include the relevant lower-tier capabilities for
that same workflow.

```text
Trial shadow base
-> Pilot Workflow = Trial shadow base + proof packet and simulation
-> Starter Workflow = Pilot Workflow + customer-gated review/enforce path
-> Pro Workflow = Starter Workflow + advanced hosted capabilities
```

Trial is account-level. Pilot, Starter, and Pro are workflow-level.

## Product Boundary

Attestor is one AI Action Control Plane and consequence admission layer.

The core flow remains:

```text
AI proposes an action
-> Attestor checks policy, evidence, authority, scope, replay, token, tenant, and proof refs
-> Attestor returns admit, narrow, review, or block
-> a customer-owned gate, verifier, adapter, or PEP controls downstream execution
```

Without a customer-owned gate, verifier, adapter, or PEP, Attestor output is
evidence and decision support, not proven non-bypassable enforcement.

Domain packs are not separate products. They add defaults, evidence shapes,
policy templates, adapter projections, readiness signals, and replay examples
to the same engine.

Launch operation classes:

- Money Movement
- Data Movement
- Authority Change
- External Communication
- Operational Execution
- Programmable Money

Finance and crypto are consequence packs on the same core. Crypto packaging
does not make Attestor a wallet, custodian, signer, broadcaster, exchange,
facilitator, settlement verifier, or payment processor.

## Safety Floor For Every Package

These capabilities must not become paid-only features:

- redaction
- proof verification
- tenant isolation
- fail-closed semantics
- deterministic controls
- offline verifier access
- replay and idempotency safety
- approval-required promotion
- shadow reads never auto-enforce
- no raw prompt, raw payload, provider body, wallet material, payment detail,
  customer identifier, tenant secret, or downstream error body in public
  evidence or customer-facing proof output

These are safety requirements, not commercial upsell features.

## Machine Model

The system must not decide paid capabilities from request-body plan claims.

The decision path should be:

```text
request arrives
-> authenticate account and tenant
-> read workflowId from the request or route context
-> load workflow entitlement for account + tenant + workflowId
-> load tier definition from the plan/workflow catalog
-> check workflow status, quota, mode, pack, and capability set
-> fail closed for missing billing state on paid workflow features
```

Required account-level state:

```text
AccountEntitlement
  accountId
  tenantId
  trialState
  trialStartedAt
  trialEndsAt
  trialAdmissionQuotaTotal
  trialAdmissionUsed
  maxTrialShadowSurfaces
```

Required workflow-level state:

```text
WorkflowEntitlement
  workflowId
  accountId
  tenantId
  tier: pilot-workflow | starter-workflow | pro-workflow
  status: active | trialing | past_due | canceled | incomplete
  stripeCustomerId
  stripeSubscriptionId
  stripeSubscriptionItemId
  stripePriceId
  stripeOveragePriceId
  consequencePack
  downstreamSystemRef
  policyGatePathRef
  includedAdmissionsMonthly
  monthlyAdmissionsUsed
  allowedModes
  capabilitySet
  currentPeriodStart
  currentPeriodEnd
```

Required invariant:

```text
workflowId must be bound to exactly one active paid workflow entitlement
before paid workflow capabilities are enabled.
```

## Stripe Model

Use Stripe Products and Prices for the paid workflow tiers:

- `Attestor Pilot Workflow`
- `Attestor Starter Workflow`
- `Attestor Pro Workflow`

Use one active monthly base Price per workflow tier:

- `ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW`
- `ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW`
- `ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW`

Use metered overage Prices only where overage is sold:

- no Pilot overage at launch
- `ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW`
- `ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW`

Use one overage meter event name:

```text
attestor_admission_overage
```

Recommended Stripe mapping:

```text
one workflow entitlement = one Stripe subscription item
```

Why subscription item per workflow:

- each workflow needs its own `workflowId`
- each workflow can have a different tier
- each workflow can have a different consequence pack
- each workflow needs separate quota and usage accounting
- each workflow may be upgraded, downgraded, or canceled separately
- customer billing still remains on one account/customer

Avoid launch quantity-only mapping as the primary model:

```text
Starter Workflow quantity = 3
```

Quantity can bill three identical workflow units, but it does not naturally
bind each paid unit to a workflowId, pack, gate path, quota, or proof state.
Quantity can be revisited later for bulk purchase UI, but the internal source
of truth should remain subscription-item-to-workflow mapping.

Stripe metadata should bind subscription items to workflow entitlements:

```text
attestor_account_id
attestor_tenant_digest
attestor_workflow_id
attestor_workflow_tier
attestor_consequence_pack
attestor_downstream_ref_digest
```

Metadata must not include raw tenant ids, raw customer ids, raw payloads,
payment details, wallet material, or private policy text.

## Checkout Model

Checkout should support:

```text
Create new paid workflow
Upgrade existing workflow
Downgrade existing workflow
Cancel workflow renewal
```

Required checkout request fields:

```text
workflowAction: create | upgrade | downgrade
workflowId: optional for create, required for upgrade/downgrade
tier: pilot-workflow | starter-workflow | pro-workflow
consequencePack
downstreamSystemRef
policyGatePathRef
idempotencyKey
```

Checkout must reject:

- missing idempotency key
- unsupported tier
- `scale`
- `enterprise`
- public `developer`
- account-level paid plan request without workflow intent
- request-body claim that tries to assert active entitlement
- workflow upgrade for a workflow not owned by the account/tenant

Checkout may create a pending workflow entitlement, but paid capabilities
should not activate until signed Stripe webhook convergence confirms the
subscription item and status.

## Webhook Convergence

Signed Stripe webhooks remain the source that converges billing into Attestor
entitlement state.

Relevant event classes:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- entitlement update events where configured

Webhook handling should:

- verify signature
- dedupe events
- read subscription items
- map each relevant subscription item to a workflow entitlement
- update workflow tier, price, period, and status
- fail closed when metadata is missing or conflicting
- avoid raw customer data in logs/evidence

Workflow paid capability status:

| Stripe/account state | Workflow capability posture |
|---|---|
| active subscription item | use tier capability set |
| trialing subscription item | use tier only if explicitly configured |
| incomplete | paid workflow features blocked |
| past_due | review-only or blocked, per grace policy |
| canceled | paid workflow features blocked |
| missing subscription item | paid workflow features blocked |
| metadata conflict | paid workflow features blocked |

Launch recommendation:

```text
past_due = review-only grace for 7 days, then block paid workflow features
```

This grace policy is a business decision and must be explicit before runtime
implementation.

## Customer Portal Model

Customer Portal should let customers manage payment methods, invoices, and
subscription state.

Portal price switching is useful, but workflow identity is Attestor-specific.
The portal by itself cannot be the only source of workflow tier changes unless
webhook metadata and reconciliation can bind the changed subscription item back
to the correct workflow entitlement.

Launch rule:

```text
Attestor-owned checkout and workflow management screens should create,
upgrade, downgrade, and cancel workflow entitlements.
Customer Portal should handle payment methods, invoices, and cancellation
until workflow-level portal mapping is proven.
```

If portal plan switching is enabled later, the readiness probe must verify that
only Pilot Workflow, Starter Workflow, and Pro Workflow Prices are exposed.

## Package Details

Detailed Trial, Pilot Workflow, Starter Workflow, and Pro Workflow package
definitions live in [Launch Packaging Plan Package Details](launch-packaging-plan-package-details.md).

This file keeps the launch decision, workflow model, implementation order,
and no-claim boundaries in one reviewable plan while the package copy stays
in a bounded appendix.
## Multi-Workflow Examples

Example 1:

```text
1 Starter Workflow for refund approval
= $299 / month
```

Example 2:

```text
2 Starter Workflows:
- refund approval
- customer data export
= 2 * $299 = $598 / month
```

Example 3:

```text
1 Starter Workflow for refund approval
1 Pro Workflow for programmable-money Safe proposals
= $299 + $999 = $1,298 / month
```

Example 4:

```text
1 Pilot Workflow for support refunds
1 Pilot Workflow for external customer communication
= 2 * $99 = $198 / month
```

This is the intended scaling path: customers pay more when they control more
distinct consequence paths, not when they add a reader seat.

## Capability Matrix

| Capability | Trial | Pilot Workflow | Starter Workflow | Pro Workflow |
|---|---|---|---|---|
| Billing unit | account | workflow item | workflow item | workflow item |
| Safety floor | yes | yes | yes | yes |
| Hosted signup and API key | yes | yes | yes | yes |
| Usage and entitlement view | account | workflow | workflow | workflow |
| Stripe subscription item | no | yes | yes | yes |
| Customer Portal | no | limited | limited | limited |
| Shadow ingestion | yes | yes | yes | yes |
| Shadow summary | yes | yes | yes | yes |
| Action risk inventory | yes | yes | yes | yes |
| Action surface graph | yes | yes | yes | yes |
| Manifest intake | yes | yes | yes | yes |
| Policy candidate discovery | limited | full | full | full |
| Policy candidate PR contract | preview | full | full | full |
| Policy Foundry readiness | preview | full | full | full |
| Policy Twin backtest | preview | full | full | full |
| Policy Twin v2 summary | preview | full | full | full |
| Active questions | top 10 | full | full | full |
| Counterexample ledger | top 10 rows | full | full | full |
| Candidate red-team replay | summary | full synthetic | full synthetic | full synthetic |
| Authority relationship context | preview | full | full | full |
| Review-only patch pack | preview | full | full | full |
| Self-onboarding packet | preview | full | full | full |
| Coverage score | preview | full | full | full |
| Gate planner | preview | full | full | full |
| Outcome feedback loop | no | pilot workflow | included | included |
| Drift and policy debt detector | no | no | no | yes |
| Hosted onboarding workflow | preview | included | included | included |
| Hosted review surface | preview | included | included | included |
| Hosted UI flow | preview | included | included | included |
| Hosted wizard state | no | no | included | included |
| Live downstream replay contract | no | no | sandbox/staging | sandbox/staging |
| Production smoke probe | no | no | no | yes |
| Pilot readiness packet | preview | full | full | full |
| Customer PEP adoption package | no | review material | included | included |
| Protected admission proof plan | no | review material | included | included |
| Review mode | no | simulation only | yes | yes |
| Enforce mode | no | no | customer proof required | customer proof required |
| Customer PEP no-bypass claim | no | no | only after live proof | only after live proof |
| Workflow count per unit | 2 shadow surfaces | 1 paid wf | 1 paid wf | 1 paid wf |
| Users | 2 | 3 | 5 | 25 |
| Retention | 14 days | 30 days | 90 days | 365 days |
| Consequence packs | 1 selected pack | 1 selected pack | 1 selected pack | all packs for workflow |
| SSO | no | no | no | yes |
| RBAC | no | basic roles | basic roles | yes |
| Dual approval | no | no | no | yes |
| Custom templates | no | no | no | yes |
| Audit export | JSON summary | JSON/CSV | JSON/CSV | JSON/CSV |
| Webhook or queue handoff | no | no | included | included |
| Support | best effort | email | next business day target | priority business |
| Customer-operated deployment | no | no | no | no |
| Scale or Enterprise features | no | no | no | no |

## Public Pricing Page Copy

Use this shorter wording when this launch model becomes the public packaging
source.

Trial:

```text
Trial
$0
30 days, 10,000 admissions total

Find what your AI agents are trying to do before those actions become
consequences. Trial maps observed actions, policy candidates, missing evidence,
and readiness blockers in shadow mode.
```

Pilot Workflow:

```text
Pilot Workflow
$99 / workflow / month
15,000 admissions / workflow / month

Turn one shadow workflow into a proof packet: Policy Foundry, Policy Twin,
active questions, counterexamples, gate planning, and the next safe step.
```

Starter Workflow:

```text
Starter Workflow
$299 / workflow / month
25,000 admissions / workflow / month
$0.05 per additional admission

Run the first customer-gated Attestor workflow with review, proof, receipts,
audit export, and a bounded path toward scoped enforcement.
```

Pro Workflow:

```text
Pro Workflow
$999 / workflow / month
250,000 admissions / workflow / month
$0.025 per additional admission

Operate one advanced Attestor-controlled workflow with all current hosted
packs, SSO, RBAC, dual approval, replay evidence, Policy Twin, drift detection,
and audit export.
```

Global public no-claim text:

```text
Attestor is an AI Action Control Plane and consequence admission layer.
Without a customer-owned gate, verifier, adapter, or PEP, Attestor output is
evidence and decision support, not proven non-bypassable enforcement. This
launch packaging is not a production-readiness claim, compliance claim, or
customer deployment proof.
```

## Required Repository Changes If Accepted

If this workflow-based plan is accepted, update:

- `docs/01-overview/product-packaging.md`
- `docs/01-overview/pricing-roi-calculator.md`
- `docs/01-overview/stripe-commercial-bootstrap.md`
- `docs/01-overview/hosted-customer-journey.md`
- `docs/01-overview/hosted-journey-contract.md`
- `src/service/plan-catalog.ts`
- a new workflow entitlement contract under `src/service` or
  `src/consequence-admission`
- checkout request/response contracts for workflow create/upgrade/downgrade
- billing webhook convergence logic for subscription item to workflow mapping
- `src/consequence-admission/policy-foundry-commercial-boundary.ts`
- `scripts/probe/probe-stripe-live-readiness.ts`
- `scripts/ops/bootstrap-stripe-commercial.ts`
- related pricing, plan catalog, commercial boundary, Stripe readiness,
  workflow entitlement, checkout, webhook, and hosted journey tests

Implementation rules:

- keep Trial account-level
- make paid entitlements workflow-level
- require `workflowId` for paid workflow feature checks
- keep billing-provider state above request-body claims
- add `pilot-workflow` before removing public `scale`
- remove `scale` from self-service Stripe bootstrap and readiness probes
- remove `enterprise` from self-service checkout
- keep Enterprise/customer-operated as future/offline boundary
- keep annual pricing out of self-service until runtime billing intervals are
  wired and tested
- keep safety minimums available across all plans
- keep no-overclaim language wherever review, enforce, or customer PEP appears
- do not expose raw Stripe ids, customer ids, tenant ids, workflow internals, or
  private policy material in public evidence

## Implementation Order

Recommended order:

1. Add workflow-tier definitions without removing old account plans. Done in
   `src/service/workflow-entitlement-catalog.ts`.
2. Add workflow entitlement contract and tests. Done in
   `src/service/workflow-entitlement.ts`,
   `tests/workflow-entitlement-catalog.test.ts`, and
   `tests/workflow-entitlement.test.ts`.
3. Add workflow-based capability resolver. Partially done through
   `evaluateWorkflowEntitlementAccess`; not yet wired into hosted routes.
4. Update Policy Foundry commercial boundary to accept workflow tier context.
   Not done.
5. Update checkout contract for workflow create/upgrade/downgrade. Not done.
6. Update Stripe bootstrap for Pilot/Starter/Pro Workflow products and Prices.
   Done for the operator bootstrap script.
7. Update Stripe readiness probe for workflow Prices and overage meter. Done.
8. Update docs to make workflow pricing public truth. Not done by design; this
   branch keeps the public switch as a later explicit step.
9. Keep legacy `developer`, `scale`, and `enterprise` compatibility internal
   until tests and migration paths are explicit.
10. Remove public/self-service exposure for legacy plans.

This avoids breaking the existing hosted account plane before the workflow
entitlement model is in place.

## Final Launch Verdict

The most coherent low-cash launch model is:

```text
Trial account
-> Pilot Workflow
-> Starter Workflow
-> Pro Workflow
```

Trial sells the problem.

Pilot Workflow sells the first proof packet.

Starter Workflow sells the first customer-gated consequence path.

Pro Workflow sells the full current hosted capability set for one advanced
consequence path.

Additional consequence paths require additional workflow entitlements.

Scale and Enterprise should stay out of launch because they create cost,
support, deployment, retention, and legal expectations that are not yet proven
and are not needed for the first customers.

This plan is not done until it is implemented in the repository contracts,
validated locally, pushed through CI, and aligned with live Stripe setup.
