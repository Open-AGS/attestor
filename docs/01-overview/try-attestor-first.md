# Try Attestor First

Use this when you want the shortest local run before reading deeper docs.

```bash
npm ci
npm run demo:golden-refund
```

This is the first run. It uses safe local refund examples and shows the basic
path:

```text
proposed refund -> Attestor decision -> proof refs -> downstream gate shape
```

This is a local safety example: no refund is executed and no external service
is called. Live deployment is separate.

The demo shows two refund outcomes:

- one is admitted and allowed to proceed
- one is blocked fail-closed before the downstream action happens

In both cases, the shape is the same:

```text
proposed consequence -> Attestor admission decision -> proof refs -> downstream gate
```

## What You Should See

The output is grouped into practical parts:

- **Decision trail:** what was proposed, what was checked, why it was allowed or held, and which proof references were used.
- **Scenario coverage:** local refund cases across normal, missing evidence, stale evidence, repeated refund, approval-required, instruction-like evidence text, external risk signal, and over-policy amount.
- **Checks and reasons:** gate order, derived metrics, reason codes, and digest stability.
- **Reviewer input:** one schema-bound local refund JSON input through the same shadow-only path.
- **Safety boundary:** no target-system call, policy activation, or auto-enforcement.
- **Pilot readiness:** whether the local path is ready for a shadow pilot.

This is the simplest way to see Attestor's role: proof first, action second.

## Optional Local Runs

Use these only after the first run makes sense:

| If you want to see... | Run |
|---|---|
| machine-readable output | `npm run demo:golden-refund -- --json` |
| digest stability | `npm run demo:golden-refund -- --determinism-check` |
| one strict reviewer-supplied input | `npm run demo:golden-refund -- --scenario fixtures/golden-refund-reviewer-sandbox.example.json` |
| the smaller admission example | `npm run example:admission` |
| a customer-side gate shape | `npm run example:non-bypassable-gateway` |

The metadata and review-package examples are useful later, but they are not the
first run. When you are ready for them, open the [Repository navigator](repository-navigator.md).

## Boundary

This page is for local examples. Hosted API calls, generated integration files,
crypto or wallet paths, and domain selection are covered by their own docs.
Customer systems still choose the relevant Attestor path explicitly.
Package and adapter boundaries are listed in the [Repository navigator](repository-navigator.md).

## Where To Go Next

Follow the same order as the README:

1. [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md) to observe one real action path before enforcement.
2. [How to integrate Attestor](how-to-integrate-attestor.md) to place the gate before the real side effect.
3. [Repository navigator](repository-navigator.md) when you need hosted, metadata, proof, support, or maintainer docs.
