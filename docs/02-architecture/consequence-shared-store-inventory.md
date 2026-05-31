# Consequence Shared-Store Inventory

Status: repository-side decision contract for unlock step 07. Inventory only:
this document and its paired evaluator do not create a database schema, migrate
file-backed history, start workers, configure Redis/PostgreSQL, run Debezium,
activate enforcement, or prove production readiness.

Step 08 adds the first PostgreSQL-backed atomic retry/replay store slice in
[Consequence Shared Atomic Stores](consequence-shared-atomic-stores.md).
Step 09 adds the shared source-history and outbox primitive in
[Consequence Shared History Outbox Store](consequence-shared-history-outbox-store.md).
This inventory remains the broader map because the default runtime path,
hosted wizard shared session state, agent-loop proof, read-model workers,
connector delivery, migration jobs, and deployment probes are still not cleared
for `production-shared`.

## Decision

The production-shared work started with the smallest runtime safety slice and
now moves to shared source history:

```text
08 -> atomic replay/idempotency stores (repository-side slice implemented)
09 -> append-only history, receipts, outbox, and read-model source primitive (repository-side slice implemented)
10 -> LLM provider runtime decision
```

Step 08 targeted:

- `retry-attempt-ledger`
- `presentation-replay-ledger`

Those two surfaces are the most direct multi-node correctness risk because an
in-memory reference ledger lets each process see a different retry/replay
history. Step 09 now proves the shared source-history and outbox primitive with
tenant scope, schema digest, outbox digest, worker claim query digest, and
advisory-lock keyspace digest. A shared database is not enough evidence by
itself; later runtime migration PRs still have to wire producers, read-model
workers, deployment probes, and recovery checks.

## Inventory

`evaluateConsequenceSharedStoreInventory()` records the current storage state
and target primitive for each consequence source that matters to
Shadow-to-Policy and production-shared readiness.

| Surface | Current mode | Target primitive | First target |
|---|---|---|---|
| shadow admission events | file-backed evaluation; shared primitive now exists | tenant-scoped append-only history | Step 09 primitive done |
| shadow policy simulations | file-backed evaluation; shared primitive now exists | tenant-scoped append-only history | Step 09 primitive done |
| shadow policy candidates | file-backed evaluation; shared primitive now exists | tenant-scoped append-only history | Step 09 primitive done |
| shadow activation receipts | file-backed evaluation; shared primitive now exists | tenant-scoped append-only history | Step 09 primitive done |
| Policy Foundry hosted wizard state | file-backed evaluation | tenant-scoped TTL session state | later shared-session work |
| retry attempt ledger | in-memory reference | atomic record-if-absent | Step 08 |
| presentation replay ledger | in-memory reference | atomic set-if-absent | Step 08 |
| agent-loop abuse guard | in-memory reference unless shared guard is configured and proven | atomic counter and signature set | existing shared path plus proof |
| audit evidence export | derived evaluation read model; shared source primitive now exists | shared source history | Step 09 primitive done |
| business risk dashboard | derived evaluation read model; shared source primitive now exists | shared source history | Step 09 primitive done |
| dashboard API summary | derived view; shared source primitive now exists | shared source history | Step 09 primitive done |
| downstream execution receipt | contract only; shared source primitive now exists | tenant-scoped receipt history | Step 09 primitive done |
| tamper-evident history | contract only; shared source primitive now exists | tenant-scoped tamper-evident history | Step 09 primitive done |
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

Step 08 proves `schema-digest`, `tenant-scope-digest`, and
`idempotency-constraint-digest` for both retry and presentation replay through
`src/service/consequence-shared-atomic-stores.ts` and
`tests/consequence-shared-atomic-stores.test.ts`.

Step 09 proves append-only history, receipt/read-model source history, outbox
contracts, worker claim queries, and advisory-lock keyspace through
`src/service/consequence-shared-history-outbox-store.ts` and
`tests/consequence-shared-history-outbox-store.test.ts`. It does not claim
Debezium, event-bus delivery, read-model worker operation, runtime migration, or
production readiness.

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

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

It only answers:

```text
Which consequence state surfaces must move first, and what proof must each one
produce before production-shared can be credible?
```
