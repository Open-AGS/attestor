# Shadow Persistence Stores

Attestor shadow mode needs a durable evaluation trail before it can become useful policy discovery.

This first slice adds two local file-backed stores:

- shadow admission events, scoped by tenant
- shadow policy candidates, scoped by tenant and held behind an approval lifecycle

The goal is not automatic learning. The goal is:

```text
observe -> recommend -> approve -> enforce
```

Shadow events show what AI actions would have done. Policy candidates summarize possible controls, but they remain non-enforcing until a customer-controlled approval path promotes them.

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
