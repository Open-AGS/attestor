# Customer Admission Gate

Use this after [Try Attestor first](try-attestor-first.md) when you want to see how an application actually enforces an Attestor decision.

Part of: [How to integrate Attestor](how-to-integrate-attestor.md)

Use this page when the customer application is ready to turn an Attestor
admission response into a local `PROCEED` or `HOLD`. The stronger enforcement
paths are linked here, but live proof still requires a customer-operated gate.

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

- `PROCEED` when Attestor returned `admit` or `narrow`, the response is not fail-closed, the response is not from `observe` or `warn`, and required execution proof is present
- `HOLD` when Attestor returned `review` or `block`, the response is fail-closed, or required proof is missing

An `admission-receipt` proves that Attestor produced an admission response. It
is not execution proof by itself. Use a release-token proof or stronger
customer-operated enforcement path when a real consequence will run.

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

This is a bearer-token compatibility path. If the token needs live checking,
single-use replay protection, or sender binding such as DPoP, mTLS, SPIFFE, or
HTTP Message Signatures, the helper holds the consequence. Use
`attestor/release-enforcement-plane` or an equivalent customer-operated verifier
for that stronger path.

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

Release enforcement validates the issued release token and the Attestor release
authority state. It does not re-query every upstream approval source at
execution time. The authority freshness window is therefore bounded by the
shorter of the token TTL and the time it takes an upstream approval/authority
change to reach the release-token introspection authority. When an approval or
decision is withdrawn, operators or integrations should call the decision-level
revocation helper on the release-token introspection store. That helper records
the decision as revoked and makes every release token for that decision
inactive, without storing the raw token or sender proof.

When an approval is missing or stale before execution, the stronger low-friction
pattern is to keep the first admission as a requestable denial. The access
request and approval task may collect the missing authority, but they are still
not execution proof and must not be accepted by this gate as a substitute for a
release token. After approval, the customer system asks Attestor for a fresh
admission evaluation over the same digest-bound scope. This gate should accept
execution only from that post-approval admission plus its required release
proof.

For hosted generic admissions, `requestableDenial` and `accessRequestTask` are
response metadata for that approval workflow. They can help route the missing
approval work, but this gate treats them as `HOLD` material until a fresh
post-approval admission carries the required execution proof.
The hosted status routes expose the task state for coordination only; they do
not make a pending or approved task acceptable execution proof.

## Choose The Right Gate

The customer gate is the smallest local helper. High-risk consequences need a
stronger customer-operated verifier.

Use this table to choose the path:

| Need | Use |
|---|---|
| Local app gate | `customer-gate` |
| Downstream binding | `downstream-contract` |
| High-risk execution | `attestor/release-enforcement-plane` or an equivalent verifier |

Bearer-only or helper-only enforcement is not enough for high-risk execution.
The verifier must fail closed on missing sender binding, stale live checks,
replay, target mismatch, or authorization downgrade.

## Customer Gate Adoption Evidence

Use `evaluateCustomerPepRuntimeAdoption(...)` after a customer has configured a
real gate path and wants a machine-readable adoption artifact for that scoped
runtime.

The artifact is held unless the configured gate proves the protected routes are
covered, the path fails closed, bypass routes are absent, verifier and replay
checks are in place, operational evidence is present, and raw tokens or payloads
are not stored.

This artifact records adoption evidence only. Deploying or operating the
customer runtime is separate.

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

This page shows customer-side gate helpers. The hosted admission API, crypto
routes, domain selection, customer gate operation, replay store, token
authority, and production runtime remain separate responsibilities.

Attestor supplies the decision and proof. The customer system enforces the final gate before consequence.

Back: [How to integrate Attestor](how-to-integrate-attestor.md). Next:
[Customer integration recipes](customer-integration-recipes.md) for placement,
or [Non-bypassable gateway demo](non-bypassable-gateway-demo.md) for the
protected-adapter shape.
