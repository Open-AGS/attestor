# Dashboard API Summary

The dashboard API summary is the compact read model for the first dashboard screen.

It is not a raw event feed.

It answers a narrow question:

```text
What should a customer see first after shadow mode starts producing evidence?
```

The answer is deliberately operational: how many AI actions were observed, how many would need review or blocking, where policy is missing, which consequence domains need attention, and which API surface should be opened next.

## Why It Exists

The business risk dashboard is the full operator model. The audit evidence export is the reviewer-grade proof source.

Most product surfaces need a smaller object:

```text
audit evidence export
  -> business risk dashboard
  -> dashboard API summary
  -> first-screen tiles, attention items, domain rows, and API links
```

This keeps the first screen fast, stable, and readable without losing the proof chain.

## What It Shows

The summary contains:

- observed AI action count
- actions that would need review
- actions that would block
- policy gap count
- downstream proof coverage
- domains needing attention
- top consequence-domain rows
- structured attention items
- links to deeper API surfaces
- source audit and dashboard digests

The wording is business-facing, but the backing data remains proof-bound.

## What It Does Not Show

The summary does not include:

- raw prompts
- raw model output
- raw tool payloads
- raw customer identifiers
- raw evidence refs
- raw bank, payment, recipient, wallet, or credential material
- raw downstream results or error bodies

It also does not infer money saved, approve enforcement, activate policies, claim compliance, or claim production readiness.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceDashboardApiSummary(...)`
- `consequenceDashboardApiSummaryDescriptor()`

The summary must be bound to a dashboard whose `sourceAuditExportDigest` matches the audit evidence digest. A mismatched dashboard is rejected.

## Hosted Read Surface

The hosted shadow route exposes the compact summary for the current tenant:

```text
GET /api/v1/shadow/dashboard-summary
```

The route is read-only and served with `cache-control: no-store`.

It returns:

- tenant summary
- audit evidence digest
- dashboard digest
- compact dashboard API summary
- explicit non-claims

The route keeps these boundaries explicit:

- `decisionSupportOnly: true`
- `autoEnforce: false`
- `rawPayloadStored: false`
- `rawImpactValueStored: false`
- `complianceClaimed: false`
- `productionReady: false`

## Attention Items

Attention items turn audit findings into product-safe next steps.

Examples:

- `start-shadow-mode`
- `define-policy`
- `review-load`
- `blocked-action`
- `downstream-proof-missing`
- `raw-payload-risk`
- `approve-candidates`
- `promotion-not-ready`

These are not automation instructions. They are links into the control workflow.

## Relationship To Shadow Mode

Shadow mode is easier to adopt when the first result is visible and useful without blocking production.

The dashboard API summary makes that visible:

```text
observe -> dashboard summary -> policy candidates -> simulation -> approval -> enforcement
```

It should help a customer answer:

```text
Where would Attestor have intervened, and what must we fix before turning enforcement on?
```

## Research Posture

This shape follows current risk and API practice:

- AI risk management benefits from measurement and monitoring over time.
- API summaries should expose bounded, least-necessary fields rather than raw data.
- Observability views should preserve correlation through IDs and digests without becoming the source of sensitive payloads.
- Security dashboards should distinguish signals from authority; a dashboard can guide review but should not execute.

For Attestor, the summary is the first-screen view over proof. It is not the proof itself and not a new authority surface.
