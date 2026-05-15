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
- Policy Foundry hosted wizard resume state
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
- Policy Foundry hosted wizard resume state
- retry attempt ledger
- presentation replay ledger
- agent-loop abuse guard counters and correction signatures unless the service
  wrapper has successfully connected to shared Redis and reports
  `shared-durable`
- source history for audit evidence export
- source history for the business-risk dashboard

The shared control plane and release authority already have PostgreSQL-backed
paths. This gate keeps the newer consequence-admission surfaces from being
mistaken for production shared storage before their own shared path exists.
For the agent-loop abuse guard specifically, a configured Redis URL is not
enough evidence; readiness uses the service wrapper's Redis-evaluated storage
mode.
The current Policy Foundry wizard state is a digest-only file-backed evaluation
store; it is useful for local resume tests, but it is an explicit
`production-shared` blocker until backed by shared TTL/session storage.

## Consequence Shared Store Profile

`evaluateConsequenceSharedStoreProfile()` narrows the storage-path inventory to
the consequence-admission and audit read-model surfaces that decide whether a
multi-node runtime can truthfully rely on shared state.

The profile groups the current backlog into explicit primitives:

- tenant-scoped append-only history for shadow events, simulations, policy
  candidates, and activation receipts
- tenant-scoped TTL/session state for hosted Policy Foundry resume flows
- atomic record-if-absent semantics for retry attempts
- atomic set-if-absent semantics for downstream presentation replay keys
- atomic counters and correction-signature sets for agent-loop abuse control
- shared source history for audit evidence exports and business-risk dashboard
  inputs

The profile depends on the shared control plane and shared release-authority
substrate, but it does not activate a migration, create PostgreSQL tables,
configure Redis, or rewrite any file-backed history. It is a decision contract:

```text
evaluation-shared-store-backlog-accepted
production-shared-consequence-blocked
production-shared-consequence-ready
```

`production-shared-consequence-ready` only clears this repository-side
consequence shared-store gate. External deployment proof, backup/restore,
readiness probes, worker recovery, and customer-environment rehearsal remain
separate production gates.

The same profile is now also part of the `production-shared` protected request
guard. Outside the explicit startup/health/readiness preflight paths, `/api/v1/*`
requests stay fail-closed until both conditions are true:

- the release/policy runtime request path uses the async shared authority-store
  contract
- `consequenceSharedStoreProfile.readyForSelectedProfile=true`

This avoids a partial cutover where release and policy records use shared
PostgreSQL, but retry/replay/shadow/audit state is still process-local,
file-backed, or derived from evaluation stores.

## Runtime Surface

The storage path is exposed in:

```text
GET /api/v1/health
GET /api/v1/ready
```

`/api/v1/ready` includes `checks.productionStoragePath`.

For `production-shared`, the selected storage path must be ready before the
HTTP server starts. Preflight route-runtime checks can still inspect
`/api/v1/ready`, where `checks.productionStoragePath` must be `true` before the
runtime can be treated as ready. If it is `false`, the response includes
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
- PostgreSQL `INSERT ... ON CONFLICT` provides the atomic insert/conflict shape
  needed by retry and replay ledgers.
- PostgreSQL advisory locks can coordinate application-defined locks, but their
  correct use is application responsibility; the profile therefore requires a
  tested primitive, not just "uses a shared database".
- PostgreSQL `FOR UPDATE ... SKIP LOCKED` is appropriate for queue-like
  consumers that need to avoid lock contention, but it intentionally skips
  locked rows and is not a general-purpose consistency proof.
- Debezium's outbox event router treats the outbox row id as a de-duplication
  header and expects outbox-table changes to be inserts, which is a useful
  model for future append-only event export. This profile does not implement a
  Debezium connector or claim event-bus delivery.
- Security logging guidance treats log integrity, access control, and data
  minimization as part of the system, not after-the-fact cleanup.
- AI risk governance needs repeatable evidence and explicit operational
  boundaries; a simulation or dashboard must not become authority by accident.

Primary anchors:

- [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html)
- [PostgreSQL explicit locking and advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL SELECT locking clauses / SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)

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
