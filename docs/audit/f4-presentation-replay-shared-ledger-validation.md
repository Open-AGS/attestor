# F4-LLM05-B Presentation Replay Shared Ledger Validation

Status: partial.

Finding under review: the presentation replay ledger was an in-memory reference path, so duplicate presentation keys could be consumed independently by different runtime instances.

## Validation

The finding is valid as a production-readiness concern. `presentation-replay-ledger` previously closed replay only inside one process-local map. That is sufficient for local evaluation and adapter-shape tests, but it is not a shared multi-pod consume path.

This slice adds a repository-side shared-store contract:

- replay keys remain indexed only by `replayKeyDigest`
- the required consume primitive is `setIfAbsent(entry)`
- cross-instance tests prove that two ledger instances sharing the same store cannot consume the same replay key twice
- the default store remains `in-memory-reference`
- `productionSharedStoreIncluded` remains `false`

The implementation intentionally does not claim production shared storage. A real backend still needs atomic insert-or-conflict semantics, durability, operator configuration, readiness probing, and deployment evidence before this can be marked fixed.

## Research Notes

Two external patterns matter for this control:

- Stripe idempotency keys bind retry behavior to one recorded result for a given key.
- PostgreSQL `INSERT ... ON CONFLICT` is the database shape this contract expects from a durable backend: one insert wins, later inserts for the same unique digest conflict.

The repository slice implements the contract and tests the duplicate-consume behavior. It does not wire a PostgreSQL table in this PR.

Sources:

- Stripe API Reference, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- PostgreSQL Documentation, `INSERT ... ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html

## Evidence

- `src/consequence-admission/presentation-replay-ledger.ts`
- `tests/presentation-replay-ledger.test.ts`
- `tests/f4-presentation-replay-shared-ledger-validation.test.ts`
- `docs/02-architecture/presentation-replay-ledger.md`

## Remaining Gap

Production money, crypto, data export, admin, and operations flows still need a shared atomic replay backend. Until that exists and is probed in the deployment profile, F4-LLM05-B remains `partial`, not `fixed`.
