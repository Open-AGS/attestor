# Try Attestor First

Use this when you want the shortest local run before reading the deeper architecture docs.

```bash
npm ci
npm run demo:golden-refund
```

The demo renders the current Golden Path: Refund as Markdown by default. It
uses synthetic, digest-only refund fixtures and shows how one AI-proposed refund
action class can pass through:

```text
refund action surface -> canonical shadow events -> runtime assurance smoke -> Policy Foundry summary -> pilot readiness packet -> Engine Visibility -> optional reviewer sandbox
```

It does not execute a refund, call Stripe or Shopify, activate policy, write an
audit-plane record, train a model, or claim production readiness.

To see the machine-readable form, run:

```bash
npm run demo:golden-refund -- --json
```

To see the decision-relevant determinism check, run:

```bash
npm run demo:golden-refund -- --determinism-check
```

To try one strict, local reviewer-supplied refund input, run:

```bash
npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json
```

To see the smaller admission primitive behind that path, run:

```bash
npm run example:admission
```

The demo shows two AI-assisted finance consequences:

- one is admitted and allowed to proceed
- one is blocked fail-closed before the downstream action happens

In both cases, the shape is the same:

```text
proposed consequence -> Attestor admission decision -> proof refs -> downstream gate
```

## What You Should See

The Golden Path output is grouped into practical parts:

- **Business contrast:** what would be missing without the Attestor path versus what the shadow run produces: gate trace, issue codes, no-claims, target-call count, and readiness evidence.
- **Scenario coverage:** 8 synthetic refund scenarios across normal, missing evidence, stale evidence, repeated refund, approval-required, instruction-like evidence text, external risk signal, and over-policy amount.
- **Engine Visibility:** gate order, derived gate metrics, reason codes, no-claims, and digest stability.
- **Reviewer Sandbox:** one schema-bound local refund JSON input through the same shadow-only path.
- **Safety boundary:** no target-system call, no audit-plane write, no policy activation, no learning/training, no auto-enforcement.
- **Readiness:** whether the synthetic path is ready for a shadow pilot or not-ready.

This is the simplest way to see Attestor's role: proof first, action second.

To see the stronger customer-side shape after that, run:

```bash
npm run example:non-bypassable-gateway
```

That demo shows a payment adapter whose dispatch function is only reachable after the verifier helper allows the Attestor admission.

To see how an agent can retry a held action without probing the gateway, run:

```bash
npm run example:agent-retry-wrapper
```

That demo shows model-safe feedback, retry attempt binding, retry budget evaluation, and attempt-ledger duplicate handling.

To render a first action-surface onboarding packet from a safe OpenAPI example, run:

```bash
npm run example:action-surface-onboarding
```

That example shows how Attestor can turn existing API metadata into review material: discovered action surfaces, generated integration drafts, readiness blockers, and next onboarding steps. It is still only a packet. It does not deploy a gateway, issue credentials, activate enforcement, or claim production readiness.

## What This Does Not Claim

- It is not the generic hosted `POST /api/v1/admissions` route.
- It is not an apply step for the generated action-surface onboarding packet.
- It is not a public hosted crypto route.
- It is not a wallet, custody platform, agent runtime, or orchestration layer.
- It does not auto-detect packs from payload shape.

Customer systems still choose the relevant Attestor surface explicitly.

## Where To Go Next

- Need the shared admission vocabulary? Read [Consequence Admission Quickstart](consequence-admission-quickstart.md).
- Need to wire the decision into your own app? Read [Customer admission gate](customer-admission-gate.md).
- Need to see the no-bypass adapter shape? Read [Non-bypassable gateway demo](non-bypassable-gateway-demo.md).
- Need bounded agent retries? Read [Agent retry wrapper demo](agent-retry-wrapper-demo.md).
- Need to start from existing API metadata? Run `npm run example:action-surface-onboarding` and read [Action surface onboarding packet](../02-architecture/action-surface-onboarding-packet.md).
- Need the first hosted call after signup? Read [First hosted API call](hosted-first-api-call.md).
- Need the finance and crypto entry paths? Read [Finance and crypto first integrations](finance-and-crypto-first-integrations.md).
- Need pricing, evaluation, or hosted trial details? Read [Commercial packaging, pricing, and evaluation](product-packaging.md).
