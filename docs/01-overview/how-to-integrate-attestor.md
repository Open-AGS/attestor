# How To Integrate Attestor

Use this when your company already has an AI workflow and a real system it can
change.

Part of: [Docs index](../README.md) -> [Repository README first-reader section](../../README.md#start-here)

Use this page as the integration hub. It shows the placement rule first, then
points to deeper pages only when you need them.

This page covers: where Attestor sits, what to send first, how to gate the real
side effect, and which page to open next.

For the connection map across existing metadata, observe mode, rule drafts,
admission decisions, customer gates, and proof, read
[How Attestor connects to existing systems](how-attestor-connects-to-existing-systems.md).

If you do not yet know the real action path, start with
[shadow pilot mode](shadow-event-payload-examples.md): observe one proposed
consequence path, then come back here to place the gate.

Hosted setup, pricing, and production proof live in separate pages.

Do not start with a dashboard.
Start with the line of code that does the real thing.

## The Short Version

```text
AI prepares an action
  -> your app asks Attestor first
Attestor returns a decision
  -> admit / narrow / review / block
your app enforces that decision
  -> the real service is called only when allowed
```

The dashboard, reports, and proof pages are secondary.
The first integration is the gate before the side effect.

## Step 1: Pick One Risky Action

Start with one action that can hurt if the AI is wrong:

| Action | Real service that should not be called too early |
|---|---|
| refund | refund service |
| customer export | export job or warehouse job |
| permission change | identity-admin API |
| customer message | email, chat, or ticket system |
| deploy | CI/CD or infrastructure tool |
| wallet action | wallet, Safe, bundler, custody, or payment adapter |

Do not integrate every action first.
Pick one.

## Step 2: Find The Real Side Effect

Look for the line that currently changes the world:

```ts
await refundService.issueRefund(intent);
```

That is where Attestor goes.
Not inside the prompt.
Not after the refund.
Before the real service call.

If you already have API specs, tool descriptions, workflow jobs, telemetry
spans, events, or gateway logs, start with the
[Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md).
That path turns existing metadata into review material: candidate actions,
missing controls, and gate placement notes.

If you are building adapters for that metadata path, continue with the
[Action surface integration kit buildout](../02-architecture/action-surface-integration-kit-buildout.md).

The hosted renderer for the same review packet is
`POST /api/v1/shadow/action-surface/onboarding-packet`.

That path helps identify the starting action and the missing controls, but it
is still review material. You still need policy, evidence, approval, receipt,
credentials, and gate proof before enforcement.

## Step 3: Start In Observe Mode

Use `mode: "observe"` first.

In observe mode, Attestor tells you what it would have done:

```text
this refund would have required review
this export would have been narrowed
this permission grant would have been blocked
```

Your team can compare those decisions against real workflow expectations before
turning the gate into an enforcement point.

Do not call the real service from an observe or warn response. When you move to
`enforce`, send an `Idempotency-Key` and use execution proof, not just an
admission receipt.

## Step 4: Ask Attestor First

Send structured action context.
Use references and digests, not raw customer data.

```json
{
  "mode": "observe",
  "actor": "support-ai-agent",
  "action": "issue_refund",
  "domain": "money-movement",
  "amount": { "value": 380, "currency": "USD" },
  "policyRef": "policy:refunds:v1",
  "evidenceRefs": [
    "evidence:order-owned:sha256:1111",
    "evidence:payment-captured:sha256:2222"
  ],
  "downstreamSystem": "refund-service"
}
```

Attestor does not need the raw prompt, full ticket body, payment card, wallet
key, database rows, private thresholds, or downstream error body.

## Step 5: Enforce The Decision In Your App

Use this shape only after you move out of `observe` or `warn` and into a
review/enforce path with a customer-owned gate. Observe and warn responses are
for learning; the customer gate must hold them.

```ts
const decision = await attestor.admit(intent);

const executableProof = decision.proofRefs.some(
  (proofRef) => proofRef.kind !== 'admission-receipt',
);

if (
  decision.mode === 'observe' ||
  decision.mode === 'warn' ||
  decision.allowed !== true ||
  decision.failClosed === true ||
  decision.requiredChecksSatisfied !== true ||
  decision.proofSatisfied !== true ||
  !executableProof ||
  (decision.outcome !== 'admit' && decision.outcome !== 'narrow')
) {
  return holdForReview(decision);
}

await refundService.issueRefund(decision.narrowedIntent ?? intent);
```

Meaning:

| Decision | Your app does |
|---|---|
| `admit` | call the real service |
| `narrow` | call the real service only with the safer version |
| `review` | hold the action for a human or existing approval workflow |
| `block` | reject before the real service is called |

## Step 6: Prove The Gate Cannot Be Bypassed

For a stronger enforcement claim, the customer-owned gate must be real:

```text
direct call to the downstream service must fail
valid Attestor decision must pass
replay must fail
review or block must hold
proof must remain reviewable
```

Without that customer-owned gate, Attestor is decision evidence.
With it, Attestor becomes the stop point before action.

When the stop point must check target binding, body digest, freshness, and
single-use replay, open
[Downstream presentation binding](../02-architecture/downstream-presentation-binding.md).

## What You Need From The Company

- an AI workflow that prepares actions
- one downstream service to protect first
- a policy or approval rule for that action
- evidence references the service can check later
- a place to hold `review` decisions
- a test that proves blocked actions do not call the real service

## What To Open Next

Pick the next page by where you are in the integration:

| If you are... | Open |
|---|---|
| still proving the shape | [Try Attestor first](try-attestor-first.md) |
| seeing all connection points before choosing one | [How Attestor connects to existing systems](how-attestor-connects-to-existing-systems.md) |
| observing before enforcement | [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) |
| sending a concrete admission request | [Consequence admission quickstart](consequence-admission-quickstart.md) |
| holding the real service call | [Customer admission gate](customer-admission-gate.md) |
| copying framework-shaped gate examples | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| finding deeper hosted, proof, support, or maintainer docs | [Repository navigator](repository-navigator.md) |

For review/support language, use [Reason codes](../05-proof/reason-codes.md).
For hosted buying and package boundaries, use the
[Repository navigator](repository-navigator.md).

Back: [Docs index](../README.md). Deeper:
[Repository navigator](repository-navigator.md).

Boundary: this page explains where the gate goes. Live customer enforcement,
external signing, shared replay, and production readiness require their own
proof.
