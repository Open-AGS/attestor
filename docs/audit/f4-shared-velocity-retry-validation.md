# F4-LLM06-B / F4-LLM10-A / F4-LLM10-B Shared Velocity And Retry Validation

Status: partial.

Findings under review:

- F4-LLM06-B: agent-loop budget looked per-process.
- F4-LLM10-A: velocity limits depended on shared counter enforcement.
- F4-LLM10-B: retry-attempt ledger storage had not been classified.

## Validation

F4-LLM06-B is stale as a blanket statement for the hosted route. The service wrapper has a Redis-backed shared counter path, fails closed in HA/production-shared mode when Redis is unavailable, and only reports shared storage after the Redis script path has executed. The package-level `agent-loop-abuse-guard` remains an in-memory reference implementation, so the finding is not marked closed for every import path for every import path.

F4-LLM10-A is valid as a policy-limit source concern. A velocity observation without source provenance can be caller-asserted. This slice adds a `requireSharedCounter` policy flag and velocity measurement sources. When `requireSharedCounter: true`, only `shared-durable-counter` satisfies the velocity limit; `operator-asserted`, `single-process-counter`, and `unknown` fail closed.

F4-LLM10-B is valid as a production-readiness concern. The retry-attempt ledger was an in-memory reference path. The first remediation slice added a shared-store contract with atomic `recordIfAbsent(record, idempotencyScope, maxRecords)` semantics and cross-instance tests. Step 08 now adds the PostgreSQL-backed `recordSharedConsequenceRetryAttemptIfAbsent(...)` path with tenant-scope digest, unique retry attempt and idempotency constraints, and raw-idempotency-key-free storage. The default package store remains `in-memory-reference`, and runtime cutover remains unclaimed.

## Research Notes

The relevant production patterns are stable:

- Redis Lua `EVAL` gives the hosted agent-loop wrapper one atomic script path for counters and correction-signature sets.
- Kubernetes readiness semantics require dependency proof before a component reports ready.
- Stripe idempotency keys and PostgreSQL unique-conflict handling match the retry-ledger contract: a retry key/attempt must bind once and conflict on reuse.

Sources:

- Redis `EVAL`: https://redis.io/docs/latest/commands/eval/
- Kubernetes readiness probes: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Stripe API Reference, Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- PostgreSQL `INSERT ... ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html

## Evidence

- `src/service/agent-loop-abuse-guard.ts`
- `tests/consequence-admission-agent-loop-abuse-guard-shared.test.ts`
- `src/consequence-admission/policy-limits.ts`
- `tests/policy-limit-model.test.ts`
- `src/consequence-admission/retry-attempt-ledger.ts`
- `src/service/consequence-shared-atomic-stores.ts`
- `tests/retry-attempt-ledger.test.ts`
- `tests/consequence-shared-atomic-stores.test.ts`
- `tests/f4-shared-velocity-retry-validation.test.ts`
- `docs/02-architecture/agent-loop-abuse-guard.md`
- `docs/02-architecture/policy-limit-model.md`
- `docs/02-architecture/retry-attempt-ledger.md`

## Remaining Gap

This is not a full shared consequence-admission storage migration. Production-shared still needs runtime wiring, related consequence-admission stores, append-only history/outbox/read-model work, configuration, and deployment probes. Therefore these findings are closed only as repository-side partials, not full production fixes.
