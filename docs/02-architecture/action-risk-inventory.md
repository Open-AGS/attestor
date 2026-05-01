# Action Risk Inventory

Shadow mode should answer the first operator question before it recommends policy:

```text
Where can AI actions create real consequences?
```

The action risk inventory groups shadow admission events by action surface and turns them into a data-minimized control map.

```text
GET /api/v1/shadow/action-risk-inventory
```

## What It Shows

Each action surface includes:

- consequence domain
- downstream system and action
- event count and actor count
- mode, shadow decision, effective decision, downstream outcome, and human outcome counters
- policy, evidence, authority, and adapter gap counts
- review load, block, downstream failure, and human rejection counts
- risk tier and risk signals
- recommended next operator step
- event digests

The route is meant to make hidden AI action surfaces visible before teams start writing or enforcing policy.

## Risk Tiers

The first risk model is intentionally conservative:

- `critical` when a surface has blocks, human rejections, or downstream failures
- `high` when policy, authority, or adapter closure is missing
- `medium` when evidence is missing or review load is already visible
- `low` when enough clean shadow traffic exists without those gaps

Risk tiers do not automatically promote a surface. They help operators prioritize review.

## Data Boundary

The inventory does not return raw prompts, raw tool payloads, recipients, evidence ids, SQL, customer records, payment secrets, wallet material, or downstream response bodies.

It works from shadow event metadata, counters, reason codes, and event digests. Every hosted response is served with `cache-control: no-store`.

## Current Boundary

This is an evaluation inventory model and hosted read route. It is not yet:

- a persistent production inventory store
- an autonomous policy writer
- a permission scanner for every downstream tool
- a complete business-risk dashboard
- a compliance report by itself

The production path should bind this inventory to tenant-scoped shadow event storage, customer-approved policy recommendations, and promotion workflows from `observe` to `review` and `enforce`.
