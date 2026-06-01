# Consequence Shared Atomic Stores

Status: repository-side Step 08 implementation slice. This is not a production
readiness claim and does not migrate shadow history, receipts, outbox workers,
or read models.

## Scope

This slice adds the first PostgreSQL-backed shared atomic store slice for
consequence state:

```text
retry-attempt-ledger              -> atomic record-if-absent
presentation-replay-ledger        -> atomic consume-if-absent
```

The implementation lives in `src/service/consequence-shared-atomic-stores.ts`
and uses the existing release-authority PostgreSQL substrate. The package-level
ledgers still default to their in-memory reference stores, so the descriptor
exposes `productionSharedStoreIncluded: true` and
`productionSharedStoreRuntimeWired: false`.

## Store Contract

Retry attempts are stored in:

```text
attestor_release_authority.consequence_retry_attempt_records
```

The atomic boundaries are:

- primary key: `record_id`
- unique tenant-bound retry key: `(tenant_scope_digest, retry_attempt_id)`
- partial unique tenant-bound idempotency key:
  `(tenant_scope_digest, idempotency_scope_digest)` where the idempotency scope
  digest is present

Presentation replay consumptions are stored in:

```text
attestor_release_authority.consequence_presentation_replay_consumptions
```

The atomic boundary is:

- primary key: `entry_digest`
- unique tenant-bound replay key: `(tenant_scope_digest, replay_key_digest)`

Both operations run inside one PostgreSQL transaction and use
`INSERT ... ON CONFLICT` so one writer wins and later writers get duplicate or
conflict results.

## Tenant Scope

The store derives a `tenant_scope_digest` from tenant and environment and sets
it as the transaction-local `attestor.tenant_scope_digest` session value before
accessing tenant-scoped rows. The tables install row-security policies that
compare rows against that setting.

RLS is enabled and forced for table owners. PostgreSQL superusers and roles with
`BYPASSRLS` still bypass RLS, so this remains repository-side schema evidence,
not a complete customer database privilege model or live deployment proof.

## Data Minimization

The shared store does not store raw idempotency keys or raw replay keys.

Stored retry records keep:

- retry attempt id and digest
- previous admission id and digest
- retry budget digest
- idempotency key digest
- record digest
- `rawPayloadStored: false`

Stored replay entries keep:

- replay key digest
- binding and admission digests
- target digest
- nonce digest
- retention timestamps

Diagnostics return schema, tenant-scope, and idempotency-constraint digests.
They do not return connection strings or database hostnames.

## Primary Anchors

- PostgreSQL `INSERT ... ON CONFLICT`:
  <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL unique constraints and indexes:
  <https://www.postgresql.org/docs/current/ddl-constraints.html>
- PostgreSQL row security policies:
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- node-postgres transaction requirement to use one client per transaction:
  <https://node-postgres.com/features/transactions>

These sources anchor the engineering shape only. They do not prove live
deployment, compliance, cloud-provider certification, or customer-operated
production readiness.

## Remaining Work

This slice does not clear `production-shared`.

Remaining shared-store work includes append-only shadow history, activation
receipts, downstream execution receipts, tamper-evident history, outbox/worker
claim contracts, audit/dashboard source histories, hosted wizard shared state,
agent-loop shared proof integration, runtime cutover, deployment probes, backup
and restore rehearsal, and customer target evidence.
