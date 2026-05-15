# Customer Admission Gate

Use this after [Try Attestor first](try-attestor-first.md) when you want to see how an application actually enforces an Attestor decision.

```bash
npm run example:customer-gate
```

For concrete application placements, see [Customer integration recipes](customer-integration-recipes.md).
For the stronger protected-adapter shape, see [Non-bypassable gateway demo](non-bypassable-gateway-demo.md).

The example shows the customer-side step:

```text
Attestor admission response -> customer gate -> downstream write/send/file/execute
```

## What The Gate Does

The customer system passes an Attestor admission response and a downstream action label to the gate.

The gate returns:

- `PROCEED` when Attestor returned `admit` or `narrow`, the response is not fail-closed, and required proof is present
- `HOLD` when Attestor returned `review` or `block`, the response is fail-closed, or required proof is missing

If a caller explicitly sets `requireProof: false` and no proof is present, the
gate records `proofSkippedByCaller` and the reason code
`customer-gate-proof-skipped-by-caller`. That is an escape hatch, not a normal
success path.

The downstream system should only write, send, file, execute, broadcast, sign, or settle after the customer gate returns `PROCEED`.

## Signed bearer compatibility path

For low-risk compatibility integrations, the customer gate can also verify a
signed bearer release token:

```ts
import {
  assertConsequenceAdmissionGateAllowsSignedBearerToken,
} from 'attestor/consequence-admission';

await assertConsequenceAdmissionGateAllowsSignedBearerToken({
  admission,
  downstreamAction: 'customer_reporting_store.write',
  authorizationHeader: request.headers.authorization,
  verificationKey,
  currentDate: new Date().toISOString(),
});
```

This path verifies the release-token signature, audience, tenant binding, and
the admission `release-token` proof reference by token id and token digest. The
gate records only digest/token metadata and does not store the raw bearer token.

It is still bearer-only compatibility, not protected production enforcement. If
the token requires online introspection, replay consumption, DPoP, mTLS,
SPIFFE, or HTTP Message Signature binding, the helper holds the consequence and
the integration must use `attestor/release-enforcement-plane` or an equivalent
customer-operated verifier.

## Protected customer enforcement profile

The customer gate is the smallest local helper. It is not the protected production path for high-risk consequences.

Use the protected customer enforcement profile when an integration needs to decide which enforcement path is required:

- `customer-gate` for low-risk, non-production-sensitive compatibility paths
- `downstream-contract` when the customer enforcement point must bind admission id, digest, downstream system, proof, policy, idempotency, and constraint acknowledgement
- `attestor/release-enforcement-plane` when production-sensitive, R3, or R4 execution requires sender-constrained presentation, online introspection, and replay consumption

For R3/R4 consequences, bearer-only or helper-only enforcement is not sufficient. The integration must use `attestor/release-enforcement-plane` or an equivalent customer-operated verifier that fails closed on missing sender constraint, stale introspection, replay, target mismatch, or authorization downgrade.

## Minimal Shape

```ts
import {
  assertConsequenceAdmissionGateAllows,
  createConsequenceAdmissionFacadeResponse,
} from 'attestor/consequence-admission';

const admission = createConsequenceAdmissionFacadeResponse({
  surface: 'finance-pipeline-run',
  run,
  decidedAt: new Date().toISOString(),
});

assertConsequenceAdmissionGateAllows({
  admission,
  downstreamAction: 'customer_reporting_store.write',
  requireProof: true,
});

// Only now may the customer system run the downstream action.
```

## Boundary

- This helper is not the hosted admission API. Use `POST /api/v1/admissions` when a customer system needs the generic route.
- This does not add a public hosted crypto route.
- This does not auto-detect packs from payload shape.
- This does not make Attestor the downstream system.
- The signed-bearer helper verifies compact signed release tokens for
  compatibility paths, but it does not perform sender-constrained presentation
  checks, online introspection, or replay consumption.

Attestor supplies the decision and proof. The customer system enforces the final gate before consequence.
