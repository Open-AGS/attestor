# How Attestor Connects To Existing Systems

Use this when a team already has APIs, tools, jobs, telemetry, or service calls
and wants to see where Attestor fits without finding every risky action by hand.

Attestor starts from what the customer already runs, turns that into reviewable
decision material, and keeps real execution behind a customer-owned gate.

## 1. Find Where Real Consequences Can Happen

Existing API docs, tool descriptions, workflow metadata, telemetry, events, or
gateway logs can show where AI-driven work may touch money, data, permissions,
messages, infrastructure, or wallet actions.

This reduces manual discovery. The output is review material, not authority.

Primary path: [Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md)

## 2. Turn Existing Signals Into A Risk Picture

A route, span, event, or gateway log is useful context, but it is not permission
to execute. Attestor turns those signals into bounded review material: what
system was involved, what operation may be forming, what proof or approval is
visible, and what is missing.

Primary path: [System signals and gate placement](../02-architecture/runtime-signal-handling.md)

## 3. Start By Observing, Not Blocking

Teams can start in observe mode so existing behavior is not changed. Attestor
shows what it would have allowed, narrowed, sent to review, or blocked, so the
team can compare decisions against real workflows before enforcement.

Primary path: [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md)

## 4. Prepare Rules From Observed Behavior

Attestor can help prepare rule drafts from observed work. It can show which
refunds, exports, permission changes, or deployment attempts appear, what
approval, evidence, scope, freshness, or replay checks are missing, and what a
human team should review.

Final rules remain human-approved. Attestor does not activate new company
policy by itself.

Primary path: [Policy Foundry onboarding](../02-architecture/policy-foundry-onboarding.md)

## 5. Ask For A Decision Before Execution

Before a real service call runs, the AI-prepared operation becomes a structured
request: actor, action, target, scope, tenant, evidence, approval, freshness,
replay/idempotency, and policy context.

Attestor returns one bounded decision: `admit`, `narrow`, `review`, or `block`.

Primary path: [Consequence admission quickstart](consequence-admission-quickstart.md)

## 6. Put The Stop Point Before The Real Service Call

The decision becomes enforcement only when the customer-owned gate sits before
the actual service call. That gate can be middleware, an API gateway, worker,
service wrapper, or workflow step.

It checks the decision, proof, scope, and replay state before the refund,
export, permission change, deployment, message, or wallet action runs.

Primary path: [Customer admission gate](customer-admission-gate.md)

## 7. Keep Proof After Each Decision

The useful output is not only allowed or blocked. Reviewers need to see what was
proposed, what was checked, what was missing, why it was allowed, narrowed,
reviewed, or blocked, and what evidence ties the decision to later receipts or
replay/no-bypass checks.

Primary path: [Proof model](../05-proof/proof-model.md)

## Supporting Paths

- [Customer middleware examples](../../examples/customer-middleware/README.md)
- [Reason codes](../05-proof/reason-codes.md)
- [Downstream enforcement contract](../02-architecture/downstream-enforcement-contract.md)
- [Repository navigator](repository-navigator.md)

Boundary: this page explains connection paths. A deployed customer gate, live
no-bypass proof, and external security audit remain separate proof steps.
