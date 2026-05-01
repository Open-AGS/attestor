# Shadow Persistence Stores

Attestor shadow mode needs a durable evaluation trail before it can become useful policy discovery.

This first slice adds three local file-backed stores:

- shadow admission events, scoped by tenant
- shadow simulation reports, scoped by tenant
- shadow policy candidates, scoped by tenant and held behind an approval lifecycle

The goal is not automatic learning. The goal is:

```text
observe -> recommend -> approve -> enforce
```

Shadow events show what AI actions would have done. Policy candidates summarize possible controls, but they remain non-enforcing until a customer-controlled approval path promotes them.

Simulation reports replay the observed event set against a proposed mode, such as `review` or `enforce`, without changing downstream behavior. This gives teams an impact report before they tighten controls.

## Storage Boundary

These stores are evaluation/self-hosted first slices.

They are:

- file-backed
- atomically written
- guarded by process/file locks
- tenant-scoped at the record level
- data-minimized
- explicit about `productionReady: false`

They are not:

- a production shared database
- an immutable audit ledger
- a SIEM
- a policy authoring UI
- a replacement for customer-side enforcement

Production deployments should move this state into the shared authority/control plane with stronger durability, backup, retention, and operator controls.

## Shadow Admission Events

The admission event store persists records produced from the generic admission route.

The event stores:

- admission id and digest
- mode and shadow decision
- effective decision
- actor, action, domain, and downstream system
- action surface
- policy reference presence
- reason codes
- downstream and human outcome markers
- observed feature keys and digest
- evidence/native input counts

The event does not store raw recipient values, raw evidence ids, raw prompts, raw payloads, or raw observed feature values.

## Shadow Simulation Reports

Simulation reports are dry-run impact reports over already-recorded shadow admission events.

They store:

- report id and digest
- proposed mode
- event count
- event digests
- decision counts
- gap counts
- review/block impact
- surface-level simulations
- recommendations

They do not store raw event payloads, raw recipients, raw evidence ids, raw prompts, or raw observed feature values.

The hosted route exposes the simulation history surface:

```text
POST /api/v1/shadow/simulations
GET  /api/v1/shadow/simulations
GET  /api/v1/shadow/simulations/:reportId
```

The `POST` route creates a new impact report from current tenant-scoped shadow events and persists it. Listing and lookup return persisted reports without exposing the local backing file path.

## Policy Candidate Lifecycle

Policy candidates are derived from shadow-mode simulation reports.

Candidates are persisted with:

- `approvalRequired: true`
- `autoEnforce: false`
- `rawPayloadStored: false`
- source report id and digest
- candidate digest
- status history

The first lifecycle is intentionally conservative:

```text
draft -> proposed -> approved -> activated
draft/proposed/approved -> rejected or superseded
activated/rejected -> superseded
```

An `activated` candidate is still not automatic enforcement. It means the candidate has passed a customer-controlled approval path and can be used by a later policy/enforcement promotion workflow.

## Approval API Surface

The hosted shadow route exposes a small approval surface over this lifecycle:

```text
POST  /api/v1/shadow/policy-candidates/materialize
GET   /api/v1/shadow/policy-candidate-records
PATCH /api/v1/shadow/policy-candidates/:candidateId/status
```

Materialization turns the current shadow simulation output into persisted candidate records. Listing returns the persisted records for the current tenant. Status transition requires an explicit `status`, `actorRef`, and `reason`.

The API does not expose the local file path of the backing store, and status transitions keep `approvalRequired: true`, `autoEnforce: false`, and `rawPayloadStored: false`.

Invalid lifecycle jumps fail closed. For example, a `draft` candidate cannot move directly to `activated`; it must move through `proposed` and `approved` first.

## Why This Shape

This follows the same pattern used by mature control systems:

- observe real activity before tightening controls
- generate recommendations from observed activity
- keep recommendation state explicit
- require a human/operator transition before applying changes
- avoid storing sensitive raw input in decision logs

For Attestor, that maps to:

```text
AI action observed
shadow decision recorded
candidate policy/control inferred
customer approves or rejects
only then can enforcement promotion happen
```

That makes shadow mode useful for adoption without making unsafe claims about autonomous policy learning.
