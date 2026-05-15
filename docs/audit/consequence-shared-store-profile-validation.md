# Consequence Shared Store Profile Validation

Status: repository-side decision contract.

This validation covers the production-shared storage decision profile for the
consequence-admission plane. It is not a production migration, certification, or
external deployment proof.

## Protected principles

- fail-closed boundary
- tenant isolation
- data minimization and redaction
- runtime readiness
- replay and idempotency safety
- auditability
- no overclaim

## Finding

The consequence-admission plane has several useful evaluation and reference
stores, but a multi-node production-shared runtime cannot rely on process-local,
file-backed, or derived-only state for replay protection, retry budgets,
activation history, wizard resume state, or audit/dashboard source history.

## Research anchors

- PostgreSQL `INSERT ... ON CONFLICT` is the primary durable shape for retry and
  replay ledgers because unique constraints can arbitrate one writer under
  concurrency: <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL transaction isolation and row-level locks define the database
  consistency boundary for shared records:
  <https://www.postgresql.org/docs/current/transaction-iso.html> and
  <https://www.postgresql.org/docs/current/explicit-locking.html>
- PostgreSQL advisory locks can model application-defined coordination, but the
  application must use them correctly; they are not a readiness claim by
  themselves: <https://www.postgresql.org/docs/current/explicit-locking.html>
- PostgreSQL `FOR UPDATE ... SKIP LOCKED` can support queue-like workers by
  skipping locked rows, but it is explicitly not a general-purpose consistent
  view: <https://www.postgresql.org/docs/current/sql-select.html>
- Debezium's outbox event router documents an insert-oriented outbox table with
  a unique event id used for de-duplication, which is a useful future model for
  append-only event export without claiming that Attestor has a connector today:
  <https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html>
- PostgreSQL row security policies are the right anchor for tenant-scoped shared
  data-path hardening, but this profile does not prove RLS wiring:
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>

## Repository evidence

- `src/service/bootstrap/production-storage-path.ts`
- `src/service/bootstrap/consequence-shared-store-profile.ts`
- `src/service/bootstrap/production-shared-request-guard.ts`
- `src/service/bootstrap/server.ts`
- `src/consequence-admission/retry-attempt-ledger.ts`
- `src/consequence-admission/presentation-replay-ledger.ts`
- `src/consequence-admission/agent-loop-abuse-guard.ts`
- `src/service/agent-loop-abuse-guard.ts`
- `docs/02-architecture/production-storage-path.md`

## Smallest safe fix

Add a focused evaluator that consumes the existing production storage inventory
and returns:

- backlog components for all relevant consequence/admission and audit read-model
  storage surfaces
- blockers only when `ATTESTOR_RUNTIME_PROFILE=production-shared` or the
  equivalent runtime profile is selected
- required store primitives for retry, replay, agent-loop, shadow history,
  hosted wizard state, audit export, and dashboard source history
- no-go conditions for file-backed, in-memory, derived, disabled, or unproven
  shared store modes
- secret-safe diagnostics with no connection strings, hostnames, raw payloads,
  prompts, provider bodies, or customer records

Wire that evaluator into the `production-shared` protected request guard and
startup diagnostics so non-preflight API routes do not open when the release
authority path is shared but consequence-admission retry/replay/history state
is still evaluation-backed.

## Regression proof

```text
npm run test:consequence-shared-store-profile
npm run test:production-storage-path
npm run test:production-shared-request-guard
npm run test:production-shared-preflight-bootstrap
npm run test:f8-operational-resilience-validation
npm run test:retry-attempt-ledger
npm run test:presentation-replay-ledger
npm run test:agent-loop-abuse-guard-shared
```

## Remaining limitation

This profile does not create shared durable backends. It does not migrate file
history, add PostgreSQL schemas, configure Redis, prove backup/restore, prove
multi-worker recovery, or verify any customer production environment. Until
those proofs exist, the consequence shared-store migration remains backlog even
when this repository-side profile is present.
