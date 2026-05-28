# Customer Middleware Examples

These examples show where Attestor fits in ordinary application code.

They are not an SDK. They are copy-paste shapes for the customer-owned gate
immediately before a real side effect.

```ts
// before
await downstreamService.execute(intent);

// with Attestor
const decision = await attestor.admit(attestorIntent);
if (decision.outcome !== 'admit' && decision.outcome !== 'narrow') return decision;
await downstreamService.execute(decision.narrowedIntent ?? attestorIntent);
```

## What To Copy First

| Example | Action class | Where the gate sits |
|---|---|---|
| [Express refund](express-refund/README.md) | Money Movement | before refund service call |
| [FastAPI data export](fastapi-data-export/README.md) | Data Movement | before export job starts |
| [Next.js permission change](nextjs-permission-change/README.md) | Authority Change | before identity-admin mutation |
| [LangChain wallet tool](langchain-wallet-tool/README.md) | Programmable Money | before wallet-facing tool execution |

Outcome rules:

- `admit` executes the original action.
- `narrow` executes only the bounded action Attestor returned.
- `review` holds the action for a customer-owned review path.
- `block` rejects before the downstream system is called.

## Boundary

These examples show the integration shape.
This does not prove live customer PEP no-bypass.
They also do not prove external KMS signing, shared replay safety, or production readiness.

Use synthetic references in examples. Do not send raw prompts, raw tool
payloads, credentials, payment details, wallet material, customer identifiers,
private thresholds, or downstream error bodies.

## Source Anchors

- Express middleware: https://expressjs.com/en/guide/using-middleware/
- FastAPI middleware: https://fastapi.tiangolo.com/tutorial/middleware/
- FastAPI dependencies: https://fastapi.tiangolo.com/tutorial/dependencies/
- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Next.js forms/actions: https://nextjs.org/docs/app/guides/forms
- LangChain tools: https://docs.langchain.com/oss/javascript/langchain/tools
