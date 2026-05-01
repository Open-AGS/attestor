# Shadow Summary Routes

Shadow mode is only useful if operators can see the control picture without exposing the original sensitive action payload.

The first hosted read surface is intentionally narrow:

```text
GET /api/v1/shadow/summary
GET /api/v1/shadow/recommendations
```

These routes summarize shadow admission events and policy simulation recommendations for the current tenant.

## What They Return

The summary route returns:

- event count and shadow event summary counters
- latest simulation report when shadow events are available
- recommendation list from the latest simulation
- explicit `storageMode`, `productionReady`, and `rawPayloadStored` boundaries
- tenant id, tenant source, and plan id for operator context

The recommendations route returns the same recommendation list in a smaller operator-facing shape, plus the latest simulation digest.

## Data Boundary

The routes are read-only and data-minimized. They work from shadow metadata, digests, reason codes, action surfaces, counters, and simulation recommendations.

They do not return raw prompts, raw tool payloads, recipients, evidence ids, SQL, customer records, payment secrets, wallet material, or downstream response bodies.

Every response is served with `cache-control: no-store`.

## Current Boundary

The route dependency is runtime-supplied. In the evaluation server it returns an empty event list until a persistent shadow event store is wired into the runtime.

That is deliberate: this PR exposes the operator API contract without pretending that the hosted product already has a production shadow warehouse.

Production promotion should add:

- tenant-scoped append-only shadow event storage
- access-controlled simulation report storage
- retention and export policy
- customer-approved policy promotion from shadow to review/enforce
- dashboard views built from the same data-minimized route contract
