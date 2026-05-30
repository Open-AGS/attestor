# Customer Admission Gate

Use this after [Try Attestor first](try-attestor-first.md) when you want to see how an application actually enforces an Attestor decision.

Part of: [How to integrate Attestor](how-to-integrate-attestor.md)

Use this page when the customer application is ready to turn an Attestor
admission response into a local `PROCEED` or `HOLD`. The deeper protected
enforcement paths are linked here, but they do not become live proof until a
customer-operated PEP/gate is actually proven.

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

## Release-enforcement proof path

For protected customer gateways, the customer gate can consume the result of a
customer-operated `attestor/release-enforcement-plane` verifier:

```ts
import {
  assertConsequenceAdmissionGateAllowsReleaseEnforcement,
} from 'attestor/consequence-admission';

assertConsequenceAdmissionGateAllowsReleaseEnforcement({
  admission,
  downstreamAction: 'customer_reporting_store.write',
  releaseEnforcement: verified,
  releaseTokenDigest,
});
```

This path does not reimplement DPoP, mTLS, SPIFFE, HTTP Message Signature,
online introspection, or replay consumption inside the customer-gate helper.
Instead, it requires the supplied release-enforcement verifier result to be
`valid`, sender-constrained, online-checked, replay-consumed, tenant/audience
matched, and bound to an admission `release-token` proof reference by token id
and digest. The gate records only digest/token/verifier metadata and does not
store the raw release token or sender proof.

## Protected customer enforcement profile

The customer gate is the smallest local helper. It is not the protected production path for high-risk consequences.

Use the protected customer enforcement profile when an integration needs to decide which enforcement path is required:

- `customer-gate` for low-risk, non-production-sensitive compatibility paths
- `downstream-contract` when the customer enforcement point must bind admission id, digest, downstream system, proof, policy, idempotency, and constraint acknowledgement
- `attestor/release-enforcement-plane` when production-sensitive, R3, or R4 execution requires sender-constrained presentation, online introspection, and replay consumption

For R3/R4 consequences, bearer-only or helper-only enforcement is not sufficient. The integration must use `attestor/release-enforcement-plane` or an equivalent customer-operated verifier that fails closed on missing sender constraint, stale introspection, replay, target mismatch, or authorization downgrade.

## Customer PEP Runtime Adoption Proof

Use `evaluateCustomerPepRuntimeAdoption(...)` after a customer has configured a real PEP path and wants a machine-readable adoption artifact for that scoped runtime.

The proof is held unless the runtime uses the release-enforcement-plane protected profile, covers all protected routes, is fail-closed, has no bypass routes, integrates the verifier, requires sender-constrained presentation, requires online introspection, requires replay consumption, binds proof/audience/tenant fields, uses durable replay and token-introspection stores, has health/rollback/kill-switch/monitoring/audit/customer-approval evidence, carries activation handoff and receipt digests, and stores no raw token, raw payload, or provider body.

This proof can support a scoped customer-runtime adoption claim. It does not deploy Envoy, Istio, OPA, Hono, or Node middleware; operate the customer PEP; migrate stores; or prove hosted production configuration.

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
- The release-enforcement proof helper consumes an already verified
  release-enforcement result; it does not operate the customer's PEP, replay
  store, token introspection authority, DPoP key, mTLS trust anchors, or SPIFFE
  bundle.
- The customer PEP runtime adoption proof records scoped customer runtime
  evidence; it does not deploy or operate that runtime.

Attestor supplies the decision and proof. The customer system enforces the final gate before consequence.

Back: [How to integrate Attestor](how-to-integrate-attestor.md). Next:
[Customer integration recipes](customer-integration-recipes.md) for placement,
or [Non-bypassable gateway demo](non-bypassable-gateway-demo.md) for the
protected-adapter shape.
