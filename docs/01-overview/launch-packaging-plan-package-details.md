# Launch Packaging Plan Package Details

Status: appendix to [Attestor Workflow-Based Launch Packaging Plan](launch-packaging-plan.md).

Source of truth for current repository facts: `origin/master`.

This appendix contains package-level copy and limits only. Billing runtime,
checkout, webhook convergence, workflow entitlement enforcement, customer PEP
no-bypass proof, production readiness, and enterprise readiness are not
claimed by this document.

## Package: Trial

Public name:

```text
Trial
```

Public price:

```text
$0
```

Billing unit:

```text
Account-level evaluation state. No Stripe subscription item.
```

Usage:

```text
10,000 admissions total for 30 days.
```

Billing:

```text
No card required. No overage. When the trial ends or quota is exhausted, new
admissions stop until the customer buys a paid workflow.
```

Seats:

```text
2 users.
```

Workflow scope:

```text
Up to 2 shadow surfaces. These are not paid workflow entitlements.
```

Pack scope:

```text
1 selected consequence pack for guided shadow discovery.
```

Allowed modes:

```text
observe
warn
would-review
would-block
would-narrow
```

Retention:

```text
14 days of digest-bound shadow and proof material during the active trial.
```

Included:

- hosted signup and first API key
- account usage and entitlement visibility
- full shadow ingestion for the trial quota
- canonical shadow event validation
- shadow summary
- action risk inventory
- action surface profiler
- action surface graph
- action surface manifest intake
- evidence, authority, adapter, tenant, scope, replay, and receipt gap map
- limited policy candidate discovery
- limited policy candidate PR preview
- Policy Foundry readiness preview
- Policy Twin preview
- Policy Twin v2 summary preview
- readiness and no-go scoring preview
- active question preview
- counterexample ledger preview
- candidate-specific red-team replay summary
- review-only patch pack preview
- coverage score preview
- minimum viable gate planner preview
- pilot readiness packet preview
- hosted review surface preview
- selected golden path demo for the chosen pack
- JSON summary export
- safety floor across all Trial usage

Trial limits:

- maximum `5` policy candidates shown
- maximum `10` active questions shown
- maximum `10` counterexample ledger rows shown
- maximum `1` Policy Twin summary per shadow surface
- maximum `1` review-only patch pack preview
- no full CSV audit export
- no paid workflow entitlement
- no hosted wizard persistence beyond the trial retention window
- no live downstream replay evidence
- no production smoke probe

Trial excludes:

- review-required production holds
- enforce mode
- protected release-token issuance for customer execution
- customer PEP no-bypass proof
- production workflow activation
- SSO
- RBAC
- dual-control activation approvals
- custom templates
- custom pack work
- all-pack access
- continuous drift and policy debt detection
- continuous outcome feedback loop
- Customer Portal subscription management
- support commitments beyond best-effort evaluation help

Trial promise:

```text
Find what your AI agents are trying to do before those actions become
consequences.
```

Trial non-claim:

```text
Trial is shadow evidence and decision support. It is not production readiness,
not customer deployment proof, not compliance proof, and not non-bypassable
enforcement.
```

## Package: Pilot Workflow

Public name:

```text
Pilot Workflow
```

Public price:

```text
$99 / workflow / month.
```

Billing unit:

```text
One active workflow entitlement backed by one Stripe subscription item.
```

Usage:

```text
15,000 admissions / workflow / month.
```

Billing:

```text
Stripe subscription item. No automatic overage at launch. When quota is
exhausted, new admissions for that workflow stop until the workflow is upgraded.
```

Seats:

```text
3 users on the account.
```

Workflow scope:

```text
1 pilot workflow.
```

Pack scope:

```text
1 selected consequence pack for that workflow.
```

Allowed modes:

```text
observe
warn
review-simulation
scoped-rollout-review
```

Retention:

```text
30 days of digest-bound shadow, review, and proof material for that workflow.
```

Included:

- everything relevant from Trial for this workflow
- full shadow mode for this workflow
- full policy candidate discovery for this workflow
- full Policy Foundry readiness for this workflow
- full active question engine for this workflow
- full onboarding session contract for this workflow
- full coverage score for this workflow
- full minimum viable gate planner for this workflow
- full schema-bound candidate registry for this workflow
- full counterexample ledger for this workflow
- full Policy Twin backtest for this workflow
- full Policy Twin v2 summary for this workflow
- authority relationship context for this workflow
- review-only integration patch pack for this workflow
- one-command self-onboarding packet for this workflow
- adversarial replay executor with synthetic fixtures
- outcome feedback loop for reviewed pilot outcomes
- pilot readiness packet for `shadow-entry`
- pilot readiness packet preparation for `scoped-enforcement-entry`
- integration-mode readiness
- hosted review surface
- hosted UI flow
- selected golden path projection and readiness probe
- JSON and CSV export for this workflow
- Customer Portal for payment method and invoice management
- billing export and billing reconciliation

Pilot Workflow limits:

- maximum `1` workflow entitlement per purchased subscription item
- maximum `1` consequence pack for the workflow
- maximum `3` users on the account
- no automatic paid overage
- no production enforce mode
- no customer-operated deployment
- no SSO
- no RBAC beyond basic account roles
- no dual-control activation approval
- no continuous drift and policy debt monitoring
- no custom templates
- no all-pack workflow
- no support SLA claim

Pilot Workflow excludes:

- live production execution by Attestor
- native connector coverage claims
- customer PEP no-bypass proof as an included outcome
- KMS/HSM-backed production signing proof
- shared-store production proof
- compliance certification
- enterprise deployment boundary

Pilot Workflow promise:

```text
Turn one shadow workflow into a reviewable proof packet: policies, blockers,
questions, replay evidence, gate plan, and next safe step.
```

Pilot Workflow non-claim:

```text
Pilot Workflow can prepare a scoped rollout review. It does not activate
enforcement, deploy customer infrastructure, or prove production readiness.
```

## Package: Starter Workflow

Public name:

```text
Starter Workflow
```

Public price:

```text
$299 / workflow / month.
```

Billing unit:

```text
One active workflow entitlement backed by one Stripe subscription item.
```

Usage:

```text
25,000 admissions / workflow / month.
```

Billing:

```text
Stripe subscription item with soft overage at $0.05 per admission after
included usage for that workflow.
```

Seats:

```text
5 users on the account.
```

Workflow scope:

```text
1 customer-gated workflow.
```

Pack scope:

```text
1 selected consequence pack for that workflow.
```

Allowed modes:

```text
observe
warn
review
enforce, only when customer gate or PEP proof exists for the target path
```

Retention:

```text
90 days of digest-bound decision, shadow, review, and proof material for that workflow.
```

Included:

- everything in Pilot Workflow for this workflow
- review-required mode for this workflow
- enforce mode only behind customer gate, verifier, adapter, or PEP proof
- protected admission end-to-end proof plan
- customer PEP adoption package
- protected release-token proof plan for high-risk review/enforce admissions
- downstream execution receipt contract
- downstream integration proof packet
- shadow activation readiness gate
- shadow customer activation handoff
- shadow customer activation receipt
- reviewer queue for this workflow
- policy authoring and activation workflow for this workflow
- audit and proof export for this workflow
- basic webhook or queue handoff for this workflow
- live downstream replay contract for sandbox, staging, or preview evidence
- Policy Foundry hosted onboarding workflow for this workflow
- hosted wizard state for this workflow, within retention limits
- billing entitlement enforcement for commercial Foundry requests
- Stripe Customer Portal for payment method and invoice management
- billing export and reconciliation
- email support with next-business-day target

Starter Workflow limits:

- maximum `1` workflow entitlement per purchased subscription item
- maximum `1` consequence pack for the workflow
- maximum `5` users on the account
- no SSO
- no broad RBAC beyond basic account roles
- no dual-control activation approvals
- no custom templates
- no all-pack workflow
- no continuous drift and policy debt detector
- no customer-operated deployment
- no dedicated infrastructure
- no 24/7 support

Starter Workflow excludes:

- production readiness claim
- compliance certification
- enterprise security review package
- air-gapped or on-prem deployment
- customer PEP no-bypass proof unless the customer integration actually
  provides and passes that proof
- external KMS/HSM production signer proof unless separately wired and proven
- multi-instance shared-store production proof unless separately wired and
  proven

Starter Workflow promise:

```text
Run the first real customer-gated Attestor workflow with review, proof,
receipts, and a bounded path toward scoped enforcement.
```

Starter Workflow non-claim:

```text
Starter Workflow is commercial hosted access for one workflow. It is not a
standalone production-readiness guarantee and does not make Attestor
non-bypassable without the customer-owned gate.
```

## Package: Pro Workflow

Public name:

```text
Pro Workflow
```

Public price:

```text
$999 / workflow / month.
```

Billing unit:

```text
One active workflow entitlement backed by one Stripe subscription item.
```

Usage:

```text
250,000 admissions / workflow / month.
```

Billing:

```text
Stripe subscription item with soft overage at $0.025 per admission after
included usage for that workflow.
```

Seats:

```text
25 users on the account.
```

Workflow scope:

```text
1 advanced customer-gated workflow.
```

Pack scope:

```text
All current hosted consequence packs may be used for that workflow when the
workflow definition is still one coherent controlled consequence path.
```

Allowed modes:

```text
observe
warn
review
enforce, only when customer gate or PEP proof exists for the target path
```

Retention:

```text
365 days of digest-bound decision, shadow, review, and proof material for that workflow.
```

Included:

- everything in Starter Workflow for this workflow
- all current hosted consequence packs for that workflow boundary
- Money Movement pack
- Data Movement pack
- Authority Change pack
- External Communication pack
- Operational Execution pack
- Programmable Money pack
- finance templates
- crypto templates as package-boundary SDK surfaces
- custom templates within the hosted product boundary
- full counterexample ledger for this workflow
- full Policy Twin v2 summary for this workflow
- full authority relationship context for this workflow
- full review-only integration patch pack for this workflow
- full outcome feedback loop for this workflow
- continuous drift and policy debt detector for this workflow
- adversarial replay executor for this workflow
- live downstream replay contract for sandbox, staging, or preview evidence
- hosted onboarding workflow for this workflow
- hosted UI flow and hosted wizard state for this workflow
- production smoke probe for deployed hosted runtime checks
- RBAC
- SSO with OIDC or SAML
- dual-control activation approvals
- tamper-evident attestation log and audit export
- webhooks and queue integrations for this workflow
- priority business support, without a launch SLA claim

Pro Workflow limits:

- maximum `1` workflow entitlement per purchased subscription item
- maximum `25` users on the account
- hosted product boundary only
- no dedicated infrastructure
- no air-gapped or on-prem deployment
- no customer-operated deployment
- no regulated deployment boundary
- no custom pack engineering engagement included by default
- no 24/7 support included by default
- no explicit response-time SLA until support capacity is proven

Pro Workflow excludes:

- production readiness claim
- compliance certification
- audit certification
- native connector marketplace certification
- customer PEP no-bypass proof unless the customer integration actually
  provides and passes that proof
- external KMS/HSM production signer proof unless separately wired and proven
- multi-instance shared-store production proof unless separately wired and
  proven
- wallet custody, signing, broadcasting, settlement verification, or payment
  processing

Pro Workflow promise:

```text
Operate one advanced Attestor-controlled consequence workflow with the full
current hosted capability set: all packs, SSO, RBAC, dual approval, replay
evidence, Policy Twin, drift detection, and audit export.
```

Pro Workflow non-claim:

```text
Pro Workflow is the highest launch hosted workflow tier. It is not Enterprise,
not customer-operated deployment, not air-gapped, not compliance certification,
and not production readiness without live environment and customer-gate proof.
```
