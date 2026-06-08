# Security And Data Handling

Attestor is designed to control high-risk AI-driven actions without becoming a
data lake.

Its security posture starts with a simple boundary: the AI can prepare an
action, but that intent is not execution authority. Attestor checks the proposed
action before the real side effect runs, and the customer-owned gate remains the
place where enforcement has to happen.

Attestor does not need raw customer data to make that decision. The useful input
is structured control context: the actor, action, target system, allowed scope,
tenant context, policy references, approval state, evidence references,
freshness, replay or idempotency state, and proof references.

Customer systems keep the model, agent, workflow, wallet, database, payment
system, service call, and system of record. Attestor returns a bounded decision
with reasons: `admit`, `narrow`, `review`, or `block`.

The same boundary applies to proof, review, dashboard, feedback, and audit
material. These surfaces should expose reason codes, missing checks, timestamps,
scoped references, digests, policy references, approval state, and proof
references. They should not expose raw prompts, raw tool payloads, raw customer
identifiers, personal data, payment details, wallet keys, database rows,
downstream response bodies, credentials, private thresholds, raw replay keys, or
raw idempotency keys.

Shadow mode follows the same rule. It can show what an AI agent tried to do and
what Attestor would have decided, but the record stays digest-first and
review-oriented. The point is to understand risk before enforcement without
turning observation into raw-data collection.

Runtime metadata is also bounded. OpenAPI documents, tool schemas, telemetry,
events, and gateway logs can help find where risky actions are forming. They do
not grant authority, replace admission, prove approval, or make a downstream
action executable by themselves.

The decision path is designed to fail closed around missing or unsafe control
inputs. Missing approval, stale authority, replay risk, wrong scope, missing
proof, tenant mismatch, unsafe material, or an unenforced customer gate should
move the action toward review, hold, narrow, or block instead of optimistic
execution.

Replay and idempotency are part of that posture. A decision should not be enough
to run the same action repeatedly. Protected execution paths need replay
consumption, target binding, body or argument digests, freshness checks, and a
downstream receipt that remains reviewable.

The repository also carries security controls around the evaluation baseline:
read-only reviewer workflows, CodeQL, dependency review, high-severity npm audit
blocking, supply-chain baseline checks, and release-provenance planning. These
controls protect the repository and evaluation artifacts; they are not a claim
that every production deployment profile is complete.

Attestor's security model is therefore not "trust the AI" and not "send all
data to Attestor." It is separation of authority:

```text
AI prepares the action.
Attestor decides and explains.
The customer-owned gate enforces.
Customer systems keep the sensitive data and final system of record.
```

This page describes the repository security posture for evaluation. Live
customer enforcement, external security audit, production deployment, hosted
operations, and customer-specific cloud controls remain separate proof steps.

Related evidence:

- [Data minimization and redaction policy](../02-architecture/data-minimization-redaction-policy.md)
- [Runtime signal handling](../02-architecture/runtime-signal-handling.md)
- [Downstream enforcement contract](../02-architecture/downstream-enforcement-contract.md)
- [Shadow event recorder](../02-architecture/shadow-event-recorder.md)
- [Security Policy](../../SECURITY.md)
