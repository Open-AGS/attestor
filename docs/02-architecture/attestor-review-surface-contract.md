# Attestor Review Surface Contract

The Attestor Review Surface contract is the typed shape for the human workspace
over Attestor evidence.

It answers one question:

```text
What should a team see, review, and export from Attestor without inspecting raw events or mistaking review material for enforcement?
```

This is a contract-ready slice. It is not a hosted UI implementation, not live
customer deployment proof, not compliance certification, and not production
readiness.

## Where It Sits

The review surface sits above existing read models:

```text
shadow events, simulations, candidates, evidence, proof refs
  -> audit evidence export and business risk dashboard
  -> dashboard API summary
  -> Attestor Review Surface contract
  -> UI, API, export, packet, and proof-bundle shapes
```

The same contract can feed a dashboard, queue, case view, action map, evidence
library, policy panel, and assurance panel. These are areas inside one Attestor
consequence engine. They are not separate products.

## Areas

The contract defines seven areas:

| Area | Purpose |
|---|---|
| Overview | What needs attention now: review load, blockers, policy gaps, proof gaps, stale evidence, and degraded signals. |
| Review Queue | Daily reviewer work list, with blocked and needs-review work visible before monitoring-only items. |
| Cases | One proposed action or proof path, with decision posture, reason codes, evidence, blockers, timeline, and next safe step. |
| Action Map | Actor to proposed action to downstream system to evidence to policy to proof. |
| Evidence Library | Digest-first artifact and proof index, not a raw-file browser. |
| Policy | Candidate review, questions, simulations, promotion blockers, and approval state. |
| Assurance | Health of the decision system: stale proof, degraded measurement, drift signals, and review load. |

Counts are navigation into work. They should not become decorative metrics or
claims about money saved, records protected, compliance readiness, or production
readiness.

## Data Forms

The same redacted evidence can appear as:

- UI rows and panels
- JSON API objects
- CSV exports
- Markdown or HTML review packets
- ZIP proof bundles
- digest or reference links

All forms keep the same boundary: raw prompts, payloads, provider bodies,
customer identifiers, payment details, wallet material, credentials, private
thresholds, replay keys, downstream responses, and provider error bodies stay
out of the review surface.

## Contract Slices

The package exports `attestor.review-surface.v1` through:

- `ReviewSurfaceOverview`
- `ReviewQueueItem`
- `ReviewCaseDetail`
- `EvidenceArtifactIndex`
- `ActionSurfaceMapView`
- `PolicyPromotionPanel`
- `AssuranceHealthPanel`

Every slice carries tenant digest or null, environment, time window, mode,
decision posture, reason codes, no-go reasons, evidence state, source digests,
freshness state, next safe step, and explicit non-authority flags.

## Freshness And Lifecycle

Rows and cases can be `fresh`, `stale`, `degraded`, or `unknown`.

Review lifecycle state is separate from freshness:

```text
open -> needs-review -> accepted | dismissed | reopened | superseded | stale | monitoring
```

Stale evidence does not automatically prove an action unsafe. It raises review
pressure and can block promotion when a workflow requires fresh proof.

## Authority Boundary

The review surface can summarize evidence, prioritize review, show no-go
reasons, show freshness and degraded states, and produce digest-first review
packets.

It cannot admit an action, block an action by itself, grant authority, reduce
evidence requirements, activate enforcement, deploy infrastructure, issue
credentials, mutate policy bundles, prove customer PEP no-bypass, prove
production readiness, or prove compliance certification.

Downstream non-bypassability still needs customer-side proof through
[Downstream enforcement contract](downstream-enforcement-contract.md),
[Verifier helper](verifier-helper.md), [Adapter framework](adapter-framework.md),
and `LP-CUSTOMER-PEP-NO-BYPASS`.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core APIs:

- `attestorReviewSurfaceContractDescriptor()`
- `createAttestorReviewSurface(...)`
- `createAttestorReviewCaseDetail(...)`

Source:

- `src/consequence-admission/attestor-review-surface-contract.ts`

Focused check:

- `npm run test:attestor-review-surface-contract`

## Aggregator

`createAttestorReviewSurface(...)` composes the first read model from existing
Attestor outputs:

- audit evidence export
- business risk dashboard
- dashboard API summary
- review-by-exception inbox, when available
- evidence state model, when available
- assurance measurement plane, when available

The aggregator validates that the dashboard and summary are bound to the same
audit export digest. Optional sources stay digest-bound. If any source asks for
raw payload storage or auto-enforcement, the aggregator fails closed.

The output is still review material only. It does not create cases, serve HTTP
routes, render the hosted UI, export files, activate enforcement, or mutate
policy.

## Case Detail

`createAttestorReviewCaseDetail(...)` turns one review queue item or case digest
into the digest-only drill-down shape for the later hosted route and export
slices.

It can carry:

- admission digests
- event digests
- candidate digests
- evidence digests
- proof link digests
- timeline digests
- correlation digests

The case detail rejects unknown case digests and keeps the same authority
boundary as the rest of the review surface: it cannot admit, block, enforce, or
store raw case material.

## Hosted Read Route

The shadow read surface now exposes the review contract for the current tenant:

```text
GET /api/v1/shadow/review-surface
GET /api/v1/shadow/review-surface/view
GET /api/v1/shadow/review-surface/export
GET /api/v1/shadow/review-surface/cases/:caseDigest
```

The route is read-only and served with `cache-control: no-store`. It builds the
review surface from the current tenant's audit evidence export, business risk
dashboard, and dashboard API summary. The case route returns digest-only
drill-down material for a known `caseDigest`.

The HTML preview renderer lives in
`src/service/shadow/attestor-review-surface-html-preview.ts` and renders from
the review surface only. It uses context-specific HTML escaping, no JavaScript,
security headers, and short task-list-style review rows.

The export route returns a JSON attachment built from the same review surface
and digest-only case details. It is served as `application/json` with
`Content-Disposition: attachment`, `cache-control: no-store`, `nosniff`, and a
static filename:

- `src/service/shadow/attestor-review-surface-export.ts`
- `attestor.review-surface-export.v1`
- `npm run test:attestor-review-surface-export`

This is a JSON route, an HTML preview route, and a JSON export route, not the
hosted UI product. They do not activate enforcement, mutate policy, grant
authority, prove customer PEP no-bypass, prove production readiness, or prove
compliance.

## Hosted Route Hardening

The hosted review routes share one route-hardening descriptor:

- `src/service/shadow/attestor-review-surface-route-hardening.ts`
- `attestor.review-surface-route-hardening.v1`
- `npm run test:attestor-review-surface-route-hardening`

It tracks the four hosted review routes, their `no-store` requirement, the HTML
preview security headers, the JSON export attachment headers, the prohibited raw
classes, and the non-authority flags. It is a guard for route drift, not a new
runtime authority layer.

## Research Posture

The contract shape follows source-backed implementation patterns, without
claiming certification:

- Kubernetes conditions separate type, status, reason, message, transition time,
  and observed generation so people and controllers can understand state without
  relying on one overloaded value.
- OpenTelemetry log records distinguish event time, observed time, event name,
  attributes, severity, and trace references; the review surface keeps similar
  correlation structure through digests and bounded refs instead of raw bodies.
- W3C Verifiable Credentials treats the data model as the structure that
  different serializations map back to; Attestor uses one review contract across
  UI, API, CSV, packets, bundles, and links.
- RFC 8259 anchors the JSON export as a portable structured data interchange
  form, and RFC 6266 anchors the download route as an HTTP attachment rather
  than inline browser content.
- RFC 9111 anchors the hosted review route cache posture: review, case, preview,
  and export responses use `cache-control: no-store` because they carry
  tenant-scoped review material.
- OWASP API3:2023 warns against exposing sensitive object properties through
  broad API representations. The export uses an explicit artifact shape built
  from the redacted review surface instead of raw event objects.
- GOV.UK interface writing guidance favors short, direct copy and clear link
  text. The review surface should guide teams into the next useful evidence
  view without explaining the whole system on every page.

## Non-Claims

This contract and hosted JSON/export routes do not implement the hosted UI, do
not prove production storage, do not prove customer deployment, do not prove
customer PEP no-bypass, do not activate enforcement, and do not prove
compliance.
