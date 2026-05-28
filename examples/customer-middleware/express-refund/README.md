# Express Refund Middleware

Use this shape when an Express route is about to call a refund service.

Source anchor: Express documents route and router middleware as functions that
can end the request-response cycle or pass control to the next handler:
https://expressjs.com/en/guide/using-middleware/

```ts
// before
await refundService.issueRefund(refundIntent);

// with Attestor
const decision = await attestor.admit(attestorIntent);
if (decision.outcome !== 'admit' && decision.outcome !== 'narrow') return decision;
await refundService.issueRefund(decision.narrowedIntent ?? attestorIntent);
```

Outcomes:

- `admit` -> original refund may proceed.
- `narrow` -> only the bounded refund may proceed.
- `review` -> return a hold response and route to review.
- `block` -> reject before the refund service is called.

This example uses synthetic references only. It does not call Stripe, Shopify,
a bank, or a live customer deployment. It shows the customer-owned gate shape;
it does not prove non-bypassable production enforcement.
