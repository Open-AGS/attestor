# Production Storage Path

Attestor's `production-shared` profile is only credible if the state behind the
AI action authorization path is shared, tenant-scoped, durable, and observable
without leaking customer data.

This document defines the storage truth gate for the consequence-admission
surfaces added around shadow mode, policy discovery, safe retry, downstream
presentation, replay consumption, activation receipts, audit evidence, and the
business-risk dashboard.

## Boundary

The current shadow and consequence-admission stores are useful evaluation
stores. They are deliberately conservative:

- file-backed evaluation stores or in-memory reference ledgers
- tenant-scoped records
- digest-first records
- raw payload storage disabled
- explicit `productionReady: false` where the surface is a report or evidence
  packet

They are not a shared production storage path.

For `local-dev` and `single-node-durable`, that is acceptable. For
`production-shared`, it is a blocker.

## Storage Inventory

`evaluateProductionStoragePath()` inventories the current storage posture:

- hosted control-plane state
- release-authority state
- shadow admission events
- shadow policy simulation reports
- shadow policy candidates
- shadow activation receipts
- retry attempt ledger
- presentation replay ledger
- agent loop abuse guard
- audit evidence export source set
- business risk dashboard source set

The diagnostic does not expose database URLs, hostnames, passwords, local file
paths, raw prompts, raw payloads, bank data, wallet data, customer records, or
downstream error bodies.

## Readiness States

The evaluator returns one of three states:

```text
evaluation-storage-accepted
production-shared-blocked
production-shared-ready
```

`evaluation-storage-accepted` means the selected runtime profile is not making a
multi-node production claim. File-backed evaluation stores can still be useful
for shadow-mode onboarding, demos, and single-node evaluation.

`production-shared-blocked` means the selected profile is `production-shared`,
but at least one required storage surface is still file-backed, in-memory,
disabled, or derived from evaluation-only sources.

`production-shared-ready` means every inventoried component is on shared
production storage for the purpose of this storage-path gate. It does not claim
the external customer environment is production-ready by itself; it only clears
this one gate.

## Current Blockers

Today, production-shared remains blocked for consequence-admission storage until
the following move to shared authority/control-plane storage:

- shadow admission event history
- shadow simulation history
- policy candidate lifecycle
- activation receipt history
- retry attempt ledger
- presentation replay ledger
- agent-loop abuse guard counters and correction signatures
- source history for audit evidence export
- source history for the business-risk dashboard

The shared control plane and release authority already have PostgreSQL-backed
paths. This gate keeps the newer consequence-admission surfaces from being
mistaken for production shared storage before their own shared path exists.

## Runtime Surface

The storage path is exposed in:

```text
GET /api/v1/health
GET /api/v1/ready
```

`/api/v1/ready` includes `checks.productionStoragePath`.

For `production-shared`, that check must be `true` before the runtime can be
treated as ready. If it is `false`, the response includes
`productionStoragePath.blockers` with component-level blocker codes.

## Promotion Packet

The production readiness packet includes:

```text
runtimeAuthority.productionStoragePath
```

When `ATTESTOR_RUNTIME_PROFILE=production-shared`, unresolved storage blockers
keep the packet in `blocked-on-environment-inputs`. This is intentional. It
prevents a green HA/observability/render packet from hiding that the
consequence-admission path is still evaluation-backed.

## Research Grounding

The design follows three stable production-storage principles:

- PostgreSQL row-level security and transaction controls are the right shape for
  tenant-scoped shared records; a shared database alone is not enough.
- Security logging guidance treats log integrity, access control, and data
  minimization as part of the system, not after-the-fact cleanup.
- AI risk governance needs repeatable evidence and explicit operational
  boundaries; a simulation or dashboard must not become authority by accident.

## Non-Claims

This gate does not claim:

- a full production shared store for every consequence-admission surface exists
  today
- file-backed evaluation history is safe for multi-node production
- audit exports or dashboards are compliance certifications
- storage readiness replaces customer-side enforcement
- storage readiness replaces external environment rehearsal

It only gives the runtime and promotion packet a crisp answer:

```text
Can this selected runtime profile truthfully rely on the current storage path?
```
