# Agent Retry Wrapper Demo

Run this after the generic admission and safe-retry pieces are clear:

```bash
npm run example:agent-retry-wrapper
```

The demo shows how a customer-side agent wrapper can let an AI-assisted action retry safely without turning Attestor into a probing oracle.

```text
agent proposes incomplete action
  -> Attestor returns model-safe feedback
  -> wrapper prepares a changed request
  -> retryAttempt binding points back to the held admission
  -> retry budget closes
  -> retry attempt ledger records the attempt
  -> corrected admission is evaluated
```

## What It Proves

The wrapper does not ask the model to guess how to pass policy. It only uses model-safe correction fields returned by Attestor:

- missing fields
- required evidence kinds
- correction reason codes
- retry budget
- retry attempt binding fields

The example deliberately keeps the boundary strict:

- the first incomplete refund is held for review
- the wrapper creates one bound retry using a new request and idempotency key
- the retry budget allows the first correction
- the retry attempt ledger records it once
- duplicate delivery returns the existing ledger record
- an unsafe action does not get a retry attempt

That is correction, not probing.

## What The Output Shows

The output is grouped around the retry loop:

- **Initial attempt:** held admission, safe feedback, missing fields
- **Bound retry:** retry attempt ID, budget outcome, ledger outcome, final decision
- **Duplicate delivery:** duplicate ledger decision without appending a second record
- **Unsafe attempt:** no retry attempt is created

The demo output does not print raw idempotency keys, raw policy material, raw customer data, credentials, wallet material, or downstream execution payloads.

## Where This Fits

Use this pattern when an agent runtime, tool wrapper, MCP adapter, customer copilot, or workflow worker wants to react to an Attestor hold.

The wrapper should follow this rule:

```text
retry only when Attestor marks the feedback model-safe and the retry budget plus attempt ledger close
```

Do not use this pattern for:

- `policy-blocked`
- `feature-unsafe`
- adapter readiness gaps
- custom-domain review
- replay failures
- human rejection

Those route to customer review or operator control.

## Related Docs

- [Consequence Admission Quickstart](consequence-admission-quickstart.md)
- [Retry attempt ledger](../02-architecture/retry-attempt-ledger.md)
- [Non-bypassable gateway demo](non-bypassable-gateway-demo.md)
