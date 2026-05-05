# Business Risk Dashboard

The business risk dashboard is the operator-facing summary built from the audit evidence export.

It exists to answer a practical question:

```text
What did AI try to do, what did Attestor hold or block, and where does the customer still need to close policy, review, or downstream proof?
```

It is not a frontend claim yet. It is the package-level dashboard model that a hosted UI or API response can render.

## What It Shows

The dashboard summarizes:

- observed AI action volume
- review load
- blocked actions
- fail-closed events
- policy gap events
- non-enforcing shadow events
- consequence-domain risk rows
- downstream integration proof coverage
- structured business-risk signals
- optional operator-supplied impact observations

The dashboard is meant to make shadow mode legible to buyers and operators without turning proof artifacts into a data warehouse.

The compact first-screen API view lives in [Dashboard API summary](dashboard-api-summary.md). Use it when a UI, CLI, or customer-facing API needs tiles, attention items, top domains, and links without returning the full dashboard model.

## Impact Boundary

The dashboard does not infer money saved, customer loss prevented, records protected, or business damage avoided.

Those numbers can be shown only when the operator supplies an explicit impact observation with a source digest and confidence value.

This keeps the claim clean:

```text
Attestor can show what it observed and controlled.
Operators may attach their own impact estimates.
Attestor does not invent financial impact.
```

## Data Posture

The dashboard is redacted by construction.

It reads from the audit evidence export and preserves these boundaries:

- `rawPayloadStored: false`
- `rawImpactValueStored: false`
- `complianceClaimed: false`
- `productionReady: false`
- `decisionSupportOnly: true`
- `autoEnforce: false`

It does not include raw prompts, raw tool payloads, raw evidence refs, raw customer identifiers, bank details, wallet details, provider error bodies, credentials, or secrets.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceBusinessRiskDashboard(...)`
- `consequenceBusinessRiskDashboardDescriptor()`

## Hosted Read Surface

The hosted shadow route exposes the dashboard model for the current tenant:

```text
GET /api/v1/shadow/business-risk-dashboard
```

The route is read-only and served with `cache-control: no-store`. It builds a fresh audit evidence export from the current shadow summary surface, then returns the dashboard bound to that export digest.

The route keeps these boundaries explicit:

- `decisionSupportOnly: true`
- `autoEnforce: false`
- `impactMode: not-supplied` unless operator impact evidence is added through the package model
- `rawPayloadStored: false`
- `rawImpactValueStored: false`
- `complianceClaimed: false`
- `productionReady: false`

Dashboard widgets:

- `action-volume`
- `decision-posture`
- `mode-ladder`
- `consequence-domain-risk`
- `control-gaps`
- `review-load`
- `blocked-actions`
- `downstream-integration`
- `operator-supplied-impact`

## Relationship To Shadow Mode

Shadow mode gets customers in the door because it starts with visibility rather than production blocking.

The dashboard is the first buyer-readable surface of that visibility:

```text
observe -> summarize risk -> recommend policy -> simulate impact -> approve -> enforce -> prove
```

It should help a team decide where to focus next. It should not authorize a consequence, activate a policy, or replace a reviewer.

## Research Posture

This shape follows the direction of current risk and observability practice:

- AI risk management needs measurement, documentation, and monitoring over time.
- LLM excessive-agency controls need downstream activity logging and monitoring.
- Observability data should be structured enough to compare operations without inventing vendor-specific meaning.
- SLO-style operational views are useful because they distinguish a signal from a raw log stream.

For Attestor, the business-risk dashboard is therefore not the proof itself. It is the risk-readable view over proof.
