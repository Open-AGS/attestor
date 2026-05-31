# How To Integrate Attestor

Use this when your company already has an AI workflow and a real system it can
change.

Part of: [Docs index](../README.md) -> [README Start Here](../../README.md#start-here)

Use this page as the integration hub. It shows the placement rule and then
points to the more detailed pages only when you need them.

This page covers: where Attestor sits, what to send first, how to gate the real
side effect, and which page to open next.

This page does not cover: pricing, hosted signup, live production proof, or
customer PEP no-bypass proof.

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

If you already have MCP tools, an OpenAPI file, AsyncAPI metadata, workflow
jobs, OpenTelemetry spans, CloudEvents, or gateway logs, use
[Action surface auto-context](../02-architecture/action-surface-auto-context.md)
to create the first review packet. That helps Attestor infer the starting
surface and gaps, but it is still review material. You still need policy,
evidence, approval, receipt, credential, and gate proof before enforcement.

## Step 3: Ask Attestor First

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

## Step 4: Enforce The Decision In Your App

```ts
const decision = await attestor.admit(intent);

if (decision.outcome !== 'admit' && decision.outcome !== 'narrow') {
  return decision;
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

## Step 5: Start In Observe Mode

Use `mode: "observe"` first.

In observe mode, Attestor tells you what it would have done:

```text
this refund would have required review
this export would have been narrowed
this permission grant would have been blocked
```

Your team can compare those decisions against real workflow expectations before
turning the gate into an enforcement point.

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
| observing without enforcement | [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) |
| starting from existing metadata | [Action surface auto-context](../02-architecture/action-surface-auto-context.md) |
| sending the first admission request | [Consequence admission quickstart](consequence-admission-quickstart.md) |
| wiring the downstream stop point | [Customer admission gate](customer-admission-gate.md) |
| choosing placement in a customer app | [Customer integration recipes](customer-integration-recipes.md) |
| copying framework-shaped examples | [Customer middleware examples](../../examples/customer-middleware/README.md) |
| starting from a hosted account | [First hosted API call](hosted-first-api-call.md) |

For review/support language, use [Reason codes](../05-proof/reason-codes.md).
For hosted buying and package boundaries, use
[Hosted customer journey](hosted-customer-journey.md) and
[Commercial packaging, pricing, and evaluation](product-packaging.md).

Back: [Docs index](../README.md). Deeper:
[Repository navigator](repository-navigator.md).

Boundary: this page explains the integration shape. It does not prove live
customer no-bypass enforcement, external KMS signing, shared replay safety,
production readiness, or enterprise readiness.
