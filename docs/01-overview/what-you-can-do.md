# What You Can Do With Attestor

Attestor is useful when an AI-assisted system is about to create real consequence and informal trust is not enough.

The pattern is always the same:

```text
AI proposal -> Attestor decision and proof -> customer gate -> downstream action
```

## Common First Uses

| Use case | What Attestor sits before | What happens |
|---|---|---|
| AI-assisted finance report | a reporting store, filing workflow, or review queue | admit safe output, hold weak output, keep proof |
| Customer-facing message | an email, notification, legal notice, or controlled communication sender | block unsupported messages before they are sent |
| Financial action | supplier payment, refund, payout, adjustment, or operational action dispatch | require policy, authority, and evidence before execution |
| Programmable-money path | wallet, Safe guard, bundler, payment server, custody callback, or solver | admit, request evidence, or deny before signing or settlement |
| Data access or export | live database query, customer export, or sensitive report | require scope, freshness, and proof before data leaves the boundary |
| Authority change | account status, entitlement, role, or admin mutation | require explicit authority before the system changes control state |
| Operational action | deploy, secret rotation, incident response, or infrastructure change | route high-risk actions through admission, review, or block |
| Hosted API workflow | a customer app using its first tenant API key | call Attestor, project the response, enforce the customer gate |
| Audit and verification | a reviewer, verifier, or internal audit system | inspect durable proof after the decision |

## What The Customer Owns

The customer still owns the model, workflow, wallet, database, message system, filing tool, deployment system, or payment rail.

Attestor owns the control point before consequence:

- policy decision
- authority check
- evidence and proof references
- fail-closed gate semantics
- later verification path

## Start With The Smallest Useful Path

For local evaluation:

```bash
npm run example:admission
npm run example:customer-gate
```

For hosted evaluation:

1. sign up for the hosted account
2. use the first tenant API key
3. call `POST /api/v1/pipeline/run`
4. project the response with `attestor/consequence-admission`
5. enforce the customer gate before the downstream action

See [First hosted API call](hosted-first-api-call.md) for the hosted path and [Customer admission gate](customer-admission-gate.md) for the customer-side enforcement helper.

For concrete placement examples in customer applications, see [Customer integration recipes](customer-integration-recipes.md).

## What This Is Not

- Not a claim that every pack has the same hosted route.
- Not automatic pack detection.
- Not a wallet, custody platform, database, message system, model runtime, or orchestration tool.
- Not a prompt wrapper.
- Not proof that an AI output is true because an AI produced it.
