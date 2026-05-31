# Local Consequence Shared-Store Rehearsal

Status: repository-side local rehearsal. This is not live proof, not customer
deployment proof, and not production readiness.

## Scope

The rehearsal exercises the service-layer PostgreSQL shared atomic stores for:

```text
retry-attempt-ledger       -> record-if-absent / idempotency conflict
presentation-replay-ledger -> consume-if-absent / replay duplicate
```

It runs two local "runtime" callers against the same embedded PostgreSQL
release-authority substrate, then closes the local connection pool and verifies
that the recorded retry/replay state is still visible after reconnect.

## Why This Exists

The live-proof register keeps shared replay, shared introspection, and
consequence retry-attempt shared-store proof as `repo-gated`. A repository test
cannot prove a customer-operated Redis/PostgreSQL deployment, a load balancer,
or multi-replica routing. It can still lock the local contract that later live
proof must satisfy:

- one retry attempt wins under concurrent callers;
- duplicate retry attempts return the existing record;
- reused idempotency scope fails closed;
- one replay presentation consumes the replay key;
- duplicate replay consumption is rejected;
- raw payloads, raw idempotency keys, raw replay keys, and connection strings
  are not exposed through the shared-store summary;
- the summary keeps `productionSharedRuntimeWired: false`.

## Source Anchors

- PostgreSQL `INSERT ... ON CONFLICT`:
  <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL advisory locks:
  <https://www.postgresql.org/docs/current/explicit-locking.html>
- PostgreSQL row security policies:
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- node-postgres transactions:
  <https://node-postgres.com/features/transactions>

These anchors justify the local engineering pattern only. They do not certify a
live environment, customer database privilege model, cloud topology, compliance
posture, or non-bypassable enforcement.

## Verification

Run:

```bash
npm run test:local-consequence-shared-store-rehearsal
```

Related tests:

```bash
npm run test:consequence-shared-atomic-stores
npm run test:consequence-admission-proof-discipline
npm run test:production-shared-multi-instance-recovery
```

## No-Claims

This rehearsal leaves the shared replay/introspection/retry-attempt live-proof
items open. It is not customer PEP no-bypass proof, external KMS runtime signing
proof, or production, live, enterprise, or compliance readiness.

Those remain live/operator/customer proof items.
