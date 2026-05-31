# Shadow Summary Routes

Shadow mode is only useful if operators can see the control picture without exposing the original sensitive action payload.

The first hosted read surface is intentionally narrow:

```text
GET /api/v1/shadow/summary
GET /api/v1/shadow/recommendations
GET /api/v1/shadow/audit-evidence
GET /api/v1/shadow/business-risk-dashboard
GET /api/v1/shadow/dashboard-summary
GET /api/v1/shadow/review-surface
GET /api/v1/shadow/review-surface/view
GET /api/v1/shadow/review-surface/export
GET /api/v1/shadow/review-surface/cases/:caseDigest
```

These routes summarize shadow admission events, policy simulation
recommendations, and digest-first review work for the current tenant.

## What They Return

The summary route returns:

- event count and shadow event summary counters
- latest simulation report when shadow events are available
- recommendation list from the latest simulation
- explicit `storageMode`, `productionReady`, and `rawPayloadStored` boundaries
- tenant id, tenant source, and plan id for operator context

The recommendations route returns the same recommendation list in a smaller operator-facing shape, plus the latest simulation digest.

The audit-evidence route returns the canonical audit evidence export built from the same shadow surface:

- event-set digest and sampled event digests
- shadow summary and simulation artifact references
- policy discovery evidence
- structured audit findings
- explicit `approvalRequired`, `autoEnforce`, `complianceClaimed`, `productionReady`, and `rawPayloadStored` boundaries

The business-risk dashboard route returns the operator-facing dashboard model built from that audit evidence export:

- action volume, review load, blocked, fail-closed, and policy-gap metrics
- consequence-domain risk rows
- downstream proof and control-gap signals
- source audit export digest
- explicit `decisionSupportOnly`, `autoEnforce`, `impactMode`, and raw impact boundaries

The dashboard-summary route returns the first-screen API summary built from the same audit evidence and dashboard:

- compact tiles for observed actions, review load, blocked actions, policy gaps, downstream proof coverage, and domains needing attention
- structured attention items with safe next-step routes
- top consequence-domain rows
- audit evidence and dashboard source digests
- explicit `decisionSupportOnly`, `autoEnforce`, `rawPayloadStored`, `rawImpactValueStored`, `complianceClaimed`, and `productionReady` boundaries

The review-surface route returns the unified review workspace model built from
the same audit evidence, dashboard, and dashboard summary:

- overview, queue, case digest, action-map, evidence, policy, and assurance panels
- audit evidence, dashboard, dashboard-summary, and review-surface digests
- explicit `decisionSupportOnly`, `autoEnforce`, `rawPayloadStored`,
  `complianceClaimed`, `productionReady`, and `hostedUiImplemented: false`
  boundaries

The case-detail route expands one `caseDigest` into digest-only drill-down
material for reviewers. It does not return raw case payloads and cannot admit,
block, enforce, or mutate policy.

The HTML preview route renders the same review surface as a no-store HTML page
for browser inspection. It renders from the review surface only; it does not
read raw shadow material, run JavaScript, or claim hosted UI/product readiness.

The review-surface export route returns a no-store JSON attachment built from
the same review surface plus digest-only case details. It uses a static
download filename and does not expose raw events, prompts, payloads, recipients,
or downstream responses.

## Data Boundary

The routes are read-only and data-minimized. They work from shadow metadata, digests, reason codes, action surfaces, counters, and simulation recommendations.

They do not return raw prompts, raw tool payloads, recipients, evidence ids, SQL, customer records, payment secrets, wallet material, or downstream response bodies.

The business-risk dashboard and dashboard API summary do not infer money saved, records protected, or loss avoided. Business impact can only appear when an operator supplies a separate impact observation to the package-level dashboard model; these hosted read routes do not invent impact.

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
