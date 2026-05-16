# Consequence Shared History Outbox Store

Status: repository-side implementation evidence for unlock step 09. This is a
PostgreSQL-backed shared source-history and outbox primitive. It is not runtime
cutover, not Debezium delivery, not event-bus delivery, not a migrated shadow
store, not a live read-model worker, and not production readiness.

## Decision

Step 09 adds the shared primitive that the Shadow-to-Policy engine needs before
policy candidates, audit exports, dashboards, downstream receipts, and tamper-
evident history can be trusted across processes:

```text
tenant-scoped append-only source history
  -> one digest-only outbox message per source record
  -> worker claim query with lease token
  -> optional publish marker
```

The module is `src/service/consequence-shared-history-outbox-store.ts`; the
embedded PostgreSQL proof is
`tests/consequence-shared-history-outbox-store.test.ts`.

## Store Contract

The store creates two tables inside the existing release-authority schema:

- `attestor_release_authority.consequence_shared_history_records`
- `attestor_release_authority.consequence_shared_outbox_messages`

History rows are append-only and keyed by:

```text
tenant_scope_digest
source_kind
source_key_digest
sequence
```

Outbox rows are created in the same transaction as the history row. The outbox
message carries digest-only references:

```text
history_id
tenant_scope_digest
source_kind
source_key_digest
payload_digest
record_digest
partition_key_digest
```

The store does not store raw payloads, raw tenant ids, raw worker ids, raw
provider bodies, wallet material, prompts, secrets, database URLs, or customer
records. The API accepts source keys and payloads only as digests.

## Operational Proofs

`ensureConsequenceSharedHistoryOutboxStore()` exposes digest-shaped evidence:

- `schemaDigest`
- `tenantScopeDigest`
- `outboxContractDigest`
- `workerClaimQueryDigest`
- `advisoryLockKeyspaceDigest`

The evidence covers these repository-side components:

- shadow admission events
- shadow policy simulations
- shadow policy candidates
- shadow activation receipts
- audit evidence export source history
- business risk dashboard source history
- dashboard API summary source history
- downstream execution receipt source history
- tamper-evident consequence history source history

The evidence is operational shape only. It does not prove that existing runtime
routes now read or write this store.

## Worker Claim

`claimSharedConsequenceOutboxMessages(...)` uses the PostgreSQL worker-claim
shape:

```sql
FOR UPDATE SKIP LOCKED
```

The claim updates selected rows to `claimed`, stores only a worker digest, and
sets a lease token plus expiry. `publishSharedConsequenceOutboxMessage(...)`
marks a claimed row as `published` when the caller presents the matching claim
token.

This is enough to prove repository-side multi-worker arbitration. It is not an
event delivery system by itself.

## Research Anchors

Primary anchors reviewed for this implementation:

- PostgreSQL `INSERT` and `ON CONFLICT` anchor first-writer and unique-source
  behavior: <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL row security anchors tenant-scoped shared records:
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- PostgreSQL advisory locks anchor per-tenant append sequence coordination:
  <https://www.postgresql.org/docs/current/explicit-locking.html>
- PostgreSQL `SELECT` locking clauses anchor `FOR UPDATE SKIP LOCKED` worker
  claims: <https://www.postgresql.org/docs/current/sql-select.html>
- node-postgres transaction guidance anchors the one-client transaction
  boundary: <https://node-postgres.com/features/transactions>
- Debezium Outbox Event Router anchors the outbox pattern, but this repository
  does not wire or claim a Debezium connector:
  <https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html>

## Verification

Focused verification:

```bash
npm run test:consequence-shared-history-outbox-store
```

The test proves:

- boot summary exposes digest-shaped operational evidence
- append-only tenant sequence starts at one and advances per tenant
- duplicate source digest returns `duplicate`
- same source key with different digest returns `source-conflict`
- duplicate/conflict paths do not append extra rows
- two workers can claim two messages without duplicate claim
- publish requires the claim token
- raw tenant ids, raw payload labels, raw worker ids, and database URLs are not
  exposed in stored proof or summary output

## Remaining Blockers

Still not complete:

- runtime shadow stores are not migrated to this Postgres primitive
- audit/dashboard read-model workers are not wired
- Debezium or event-bus delivery is not wired
- downstream receipt reconciliation is not runtime-persisted through this store
- tamper-evident history still needs external immutable log or transparency
  inclusion before stronger claims
- Policy Foundry hosted wizard shared TTL state remains separate work
- agent-loop abuse guard shared proof remains separate work
- external deployment, backup/restore, probes, and production rehearsal remain
  required

## Non-Claims

This step does not claim:

- production readiness
- runtime shared-store cutover
- migrated existing file-backed history
- live worker processing
- Debezium, Kafka, queue, or event-bus delivery
- customer deployment proof
- crypto custody, wallet, exchange, broadcaster, or chain analytics capability
- automatic policy activation
