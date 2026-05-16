# Consequence Shared-Store Inventory

Status: repository-side decision contract for unlock step 07. Inventory only:
this document and its paired evaluator do not create a database schema, migrate
file-backed history, start workers, configure Redis/PostgreSQL, run Debezium,
activate enforcement, or prove production readiness.

## Decision

The next production-shared work should start with the smallest runtime safety
slice:

```text
08 -> atomic replay/idempotency stores
09 -> append-only history, receipts, outbox, and read-model source history
```

That means the first implementation PR should target:

- `retry-attempt-ledger`
- `presentation-replay-ledger`

Those two surfaces are the most direct multi-node correctness risk because an
in-memory reference ledger lets each process see a different retry/replay
history. A shared database is not enough evidence by itself; the PR must prove
tenant scope, schema digest, and atomic conflict arbitration.

## Inventory

`evaluateConsequenceSharedStoreInventory()` records the current storage state
and target primitive for each consequence source that matters to
Shadow-to-Policy and production-shared readiness.

| Surface | Current mode | Target primitive | First target |
|---|---|---|---|
| shadow admission events | file-backed evaluation | tenant-scoped append-only history | Step 09 |
| shadow policy simulations | file-backed evaluation | tenant-scoped append-only history | Step 09 |
| shadow policy candidates | file-backed evaluation | tenant-scoped append-only history | Step 09 |
| shadow activation receipts | file-backed evaluation | tenant-scoped append-only history | Step 09 |
| Policy Foundry hosted wizard state | file-backed evaluation | tenant-scoped TTL session state | Step 09 |
| retry attempt ledger | in-memory reference | atomic record-if-absent | Step 08 |
| presentation replay ledger | in-memory reference | atomic set-if-absent | Step 08 |
| agent-loop abuse guard | in-memory reference unless shared guard is configured and proven | atomic counter and signature set | existing shared path plus proof |
| audit evidence export | derived evaluation read model | shared source history | Step 09 |
| business risk dashboard | derived evaluation read model | shared source history | Step 09 |
| dashboard API summary | derived view | shared source history | Step 09 |
| downstream execution receipt | contract only | tenant-scoped receipt history | Step 09 |
| tamper-evident history | contract only | tenant-scoped tamper-evident history | Step 09 |
| crypto execution-admission telemetry and receipts | local ephemeral sink | domain-adapter event history | later domain projection |

The crypto row is intentional. Crypto execution admission is a domain adapter
into the same consequence engine. Put plainly: crypto execution-admission telemetry and receipts stay a domain projection into the same shared event/receipt history, not a separate storage engine, wallet, custodian, exchange, or broadcaster.

## Required Proofs

The inventory keeps the same proof vocabulary as the existing consequence
shared-store profile:

- `schema-digest`
- `tenant-scope-digest`
- `idempotency-constraint-digest`
- `outbox-contract-digest`
- `worker-claim-query-digest`
- `advisory-lock-keyspace-digest`

Step 08 should prove `schema-digest`, `tenant-scope-digest`, and
`idempotency-constraint-digest` for both retry and presentation replay.

Step 09 should prove append-only history, receipt history, read-model source
history, outbox contracts, worker claim queries, and recovery behavior. It may
define an outbox contract digest, but it must not claim Debezium or event-bus
delivery unless a connector is actually wired and tested.

## Research Anchors

Primary anchors reviewed for this inventory:

- PostgreSQL `INSERT ... ON CONFLICT` gives the atomic insert/conflict shape for
  retry attempts, replay keys, receipt ids, and idempotency digests:
  <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL row security policies are the stable tenant-bound shared-schema
  anchor: <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- PostgreSQL advisory locks can coordinate application-defined lock namespaces,
  but correctness belongs to the application contract:
  <https://www.postgresql.org/docs/current/explicit-locking.html>
- PostgreSQL `FOR UPDATE ... SKIP LOCKED` can support worker-claim patterns, but
  skipped locked rows are not a general consistency proof:
  <https://www.postgresql.org/docs/current/sql-select.html>
- Debezium's Outbox Event Router is a useful insert-oriented outbox model, but
  this inventory does not claim a Debezium connector:
  <https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html>

## No-Go Conditions

- Do not clear `production-shared` while profile components remain file-backed,
  in-memory, contract-only, or derived from evaluation sources.
- Do not store raw prompts, raw payloads, provider bodies, wallet material,
  customer records, connection strings, or secrets in the shared-store proof.
- Do not split crypto into a separate Attestor store engine.
- Do not claim outbox delivery without a wired connector and worker/recovery
  evidence.
- Do not treat "uses a shared database" as production evidence without tenant
  scope, idempotency/conflict, schema, and operational proof digests.

## Non-Claims

This inventory does not claim:

- production readiness
- shared durable consequence storage implementation
- migration from existing evaluation files
- event-bus, Debezium, or worker delivery
- customer deployment proof
- crypto custody, wallet, exchange, or transaction broadcasting capability
- automatic policy activation

It only answers:

```text
Which consequence state surfaces must move first, and what proof must each one
produce before production-shared can be credible?
```
