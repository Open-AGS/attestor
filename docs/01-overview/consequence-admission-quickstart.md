# Consequence Admission Quickstart

Use this when a customer-controlled system needs one shared admission shape before an AI action becomes a consequence:

```text
proposed consequence -> explicit surface -> admit | narrow | review | block -> proof -> downstream gate
```

There are now two first integration paths:

- `POST /api/v1/admissions` for generic AI action authorization across consequence domains.
- `attestor/consequence-admission` for wrapping existing shipped Attestor surfaces such as the finance pipeline run and crypto execution-admission package plan.

For the shortest first run, start with [Try Attestor first](try-attestor-first.md).
For the first customer-side enforcement step, see [Customer admission gate](customer-admission-gate.md).
For the protected adapter shape, see [Non-bypassable gateway demo](non-bypassable-gateway-demo.md).

## Run The Local Demo

Use the first useful admission demo when you want the shortest runnable version of the model:

```bash
npm run example:admission
```

The demo shows an allowed finance consequence and a blocked finance consequence. In both cases, the customer system proposes the consequence, Attestor returns a canonical admission decision, and the downstream gate proceeds only when the decision allows it.

Use the non-bypassable gateway demo when you want to see the next step:

```bash
npm run example:non-bypassable-gateway
```

That demo shows a payment adapter that cannot dispatch without verifier allow.

Use the agent retry wrapper demo when you want to see the bounded correction loop:

```bash
npm run example:agent-retry-wrapper
```

That demo shows an agent receiving model-safe feedback, creating a bound retry attempt, passing the retry budget, recording the attempt in the ledger, and stopping unsafe feedback before a retry is created.

## Rules

- Use `POST /api/v1/admissions` when the customer system already has a proposed AI action and needs a generic consequence authorization decision.
- Choose the consequence domain explicitly: `money-movement`, `programmable-money`, `data-disclosure`, `authority-change`, `external-communication`, `regulated-filing`, `system-operation`, `decision-support`, or `custom`.
- Choose the adoption mode explicitly: `observe`, `warn`, `review`, or `enforce`.
- Use the package facade when you already have a shipped Attestor surface result: `finance-pipeline-run` or `crypto-execution-plan`.
- Use finance when the source result came from `POST /api/v1/pipeline/run`.
- Use crypto when the source result is a `CryptoExecutionAdmissionPlan` from `attestor/crypto-execution-admission`.
- Do not auto-detect packs from payload shape.
- Do not use the old placeholder `POST /api/v1/admit` route name.
- Do not treat the generic route as a magic pack router.
- Do not treat crypto as generally available through a public hosted route.

## Generic Hosted Admission

The generic route is the first hosted action-authorization API:

```http
POST /api/v1/admissions
```

Example request:

```json
{
  "mode": "observe",
  "actor": "support-ai-agent",
  "action": "issue_refund",
  "domain": "money-movement",
  "downstreamSystem": "refund-service",
  "amount": {
    "value": 380,
    "currency": "USD"
  },
  "recipient": "customer_123",
  "evidenceRefs": [
    "order:987",
    "payment:456"
  ],
  "policyRef": "policy:refunds:v1"
}
```

The response carries both the effective admission decision and the shadow decision:

```json
{
  "mode": "observe",
  "shadowDecision": "would_admit",
  "downstreamPosture": "observe-only",
  "enforcementActive": false,
  "admission": {
    "decision": "admit",
    "allowed": true,
    "feedback": {
      "safeForModel": true,
      "disclosureLevel": "minimal"
    },
    "retry": {
      "retryAllowed": false,
      "retryCategory": "not-needed"
    },
    "request": {
      "entryPoint": {
        "route": "/api/v1/admissions"
      }
    }
  }
}
```

`observe` and `warn` are adoption modes. They let a team see what Attestor would have done before enforcing a block. `review` and `enforce` are control modes. In those modes, incomplete policy, authority, evidence, scope, or adapter readiness holds the consequence before downstream execution.

For high-risk `review` or `enforce` admissions that would execute downstream, the generic path now has a protected release-token issuance contract. When a customer-operated route dependency is configured, Attestor can bind the final admission to a sender-constrained release token:

```ts
import {
  issueGenericAdmissionProtectedReleaseToken,
} from 'attestor/consequence-admission';

const issued = await issueGenericAdmissionProtectedReleaseToken({
  envelope,
  issuer,
  confirmation: { jkt: dpopPublicKeyThumbprint },
});
```

The final admission receives a `release-token` proof reference by token id and digest. R3 issuance requires an explicit `reviewerRef`; R4 issuance requires distinct reviewer and signer references. The sanitized envelope records only token metadata; the raw token is returned only to the immediate caller as authorization material and must be presented through `attestor/release-enforcement-plane` with sender constraint, online introspection, and replay consumption before the protected consequence executes.

Hosted bootstrap now requires the protected release-token route for high-risk generic admissions. The hosted route validates a token-request DPoP proof from the `DPoP` header, derives the `cnf.jkt` sender confirmation, consumes the proof `jti` in a raw-proof-free DPoP proof replay store, and uses the runtime release-token issuer to return caller-only protected authorization material. Local and single-node profiles use the in-memory replay store; `production-shared` switches to the PostgreSQL shared replay store only after the shared authority request path is active. When the hosted runtime provides the release-token introspection authority, issued protected tokens are registered there by token id and metadata so downstream online verification can consume the same authority without storing the raw token in admission or shadow records. Missing, invalid, or replayed DPoP proof fails closed instead of falling back to a compatibility admission. `/api/v1/health` and `/api/v1/ready` expose `genericAdmissionProtectedRoute`; `production-shared` remains blocked until the issuer boundary is external KMS/HSM-backed with structured live provider proof, token introspection and token-use replay-consumption stores are shared, the DPoP sender-proof replay store is shared, and the rest of the customer enforcement path is proven.

This is still not customer PEP activation by itself. A production integration must configure the external issuer boundary, token-introspection authority, token-use replay store, DPoP proof replay store, sender-proof verifier, and non-bypassable downstream enforcement point.

When an action is held for missing policy, evidence, amount, recipient, data scope, or authority shape, the admission response includes model-safe feedback. The feedback names fields and evidence kinds, not raw customer data or private policy internals. A safe retry must send a changed request; replaying the same request is not treated as model repair.

Correction reason codes are cataloged. The catalog marks which codes are model-retryable and which must route to customer review or operator control. Model-retryable examples include `policy-ref-missing`, `evidence-ref-missing`, `amount-scope-missing`, `recipient-scope-missing`, `data-scope-missing`, `authority-mode-missing`, and `narrow-required`. Operator or customer-control examples include `adapter-readiness-missing`, `custom-domain-review-required`, `policy-blocked`, `feature-blocked`, and `feature-unsafe`.

Generic admissions now run the untrusted-content authority guard when the
domain profile requires the authority check, or when the request supplies
authority-source metadata. Authority must arrive as structured `authoritySources`
references. A customer email, ticket comment, web page, retrieved content, tool
output, or model summary cannot become approval, policy, or authorization just
because it appears in the request. Trusted authority sources such as
`verified-approval`, `approval-workflow`, `customer-policy`, `idp-directory`,
`authority-record`, or `manual-review` must carry digest evidence. Missing
authority metadata holds the action for operator/customer control with
`authority-source-missing`; untrusted authority claims fail closed with
`untrusted-content-authority-source` and `authority-block`.

When an authority source claims `approval`, the generic admission path also
runs the approval-provenance guard. Approval must arrive as structured
`approvals` metadata: an opaque approval reference, trusted workflow/reviewer
or system source, approved state, reviewer identity, reviewer-authority digest,
approval digest, scope digest, and issued-at timestamp. Chat messages, customer
emails, ticket comments, tool output, and model summaries cannot become
approval. Missing approval provenance holds with `approval-missing`; untrusted
or model-generated approval fails closed with `approval-source-untrusted`,
`approval-model-generated`, and `approval-block`.

Generic admissions can also run the no-go condition ledger guard when the
request supplies `noGoLedgerRef`, `noGoConditions`, or no-go bypass signals.
No-go records must be structured hold metadata such as fraud, legal,
compliance, security, privacy, risk, production-freeze, or customer-defined
holds. Active holds block with `active-no-go-condition-present` and
`no-go-condition-block`; pending or incomplete hold records route to review.
Natural-language attempts to ignore or bypass a hold block with
`natural-language-bypass-attempted`. The admission response carries only
safe counts and ledger digests such as `noGoConditionDigest`; it must not return
raw case references, private hold owners, customer messages, or bypass text.

`observedFeatures` are upstream/operator-derived evidence only. They can
support restrictive checks such as `feature-blocked` or `feature-unsafe` when
the integration can stand behind the observation, but they cannot grant
authority, reduce evidence requirements, bypass review, or activate downstream
execution.

Positive readiness signals that can reduce review pressure must also carry an
`observedFeatureOrigins` marker. For example, `observedFeatures.adapterReady:
true` satisfies `adapter-readiness` only when
`observedFeatureOrigins.adapterReady` is one of `operator-attested`,
`customer-gateway`, `attestor-runtime`, or `trusted-adapter`. Missing,
`caller-supplied`, or unknown origins keep the admission held for operator
control with `adapter-readiness-origin-untrusted`.

Example held response excerpt:

```json
{
  "admission": {
    "decision": "review",
    "allowed": false,
    "feedback": {
      "disclosureLevel": "actionable",
      "safeForModel": true,
      "missingFields": [
        "evidenceRefs"
      ],
      "requiredEvidenceKinds": [
        "evidence_ref"
      ]
    },
    "retry": {
      "retryAllowed": true,
      "retryCategory": "safe-correction",
      "maxAttempts": 2,
      "requiresChangedRequest": true,
      "sameRequestReplayAllowed": false,
      "retryBindingRequired": true,
      "retryBindingFields": [
        "previousAdmissionId",
        "previousAdmissionDigest",
        "previousRequestId",
        "attemptNumber",
        "correctionReasonCodes"
      ]
    }
  }
}
```

The corrected request must include a `retryAttempt` binding. The binding points at the held admission and records the attempt number and correction reasons:

```json
{
  "mode": "review",
  "actor": "support-ai-agent",
  "action": "issue_refund",
  "domain": "money-movement",
  "downstreamSystem": "refund-service",
  "policyRef": "policy:refunds:v1",
  "evidenceRefs": [
    "order:987",
    "payment:456"
  ],
  "amount": {
    "value": 380,
    "currency": "USD"
  },
  "recipient": "customer_123",
  "retryAttempt": {
    "previousAdmissionId": "sha256:...",
    "previousAdmissionDigest": "sha256:...",
    "previousRequestId": "sha256:...",
    "attemptNumber": 1,
    "attemptedAt": "2026-05-01T18:11:00.000Z",
    "correctionReasonCodes": [
      "policy-ref-missing",
      "evidence-ref-missing"
    ],
    "correctionFields": [
      "policyRef",
      "evidenceRefs"
    ],
    "idempotencyKey": "retry:refund:1"
  }
}
```

A bound retry creates a new request ID while preserving a canonical pointer to the earlier admission.

The retry budget contract then evaluates the binding:

- the previous admission must have allowed a safe correction retry
- the previous admission ID, digest, and request ID must match
- the attempt number must stay within the current max-attempt budget
- the attempt must arrive inside the retry window
- correction reason codes must come from the previous model-safe feedback

The current default is two model correction attempts within a 300-second window. The retry attempt ledger records each bound retry attempt after budget evaluation, deduplicates repeated attempts by retry attempt ID, binds idempotency key reuse by digest, and keeps held retry attempts as review evidence without storing raw retry payloads.

Policy-blocked, unsafe, adapter-readiness, custom-domain review, replay, and human-rejection signals are not automatic model-retry paths. They must route to customer review or operator control.

## Import The Facade

```ts
import {
  createConsequenceAdmissionFacadeResponse,
  consequenceAdmissionFacadeDescriptor,
} from 'attestor/consequence-admission';

const descriptor = consequenceAdmissionFacadeDescriptor();

if (!descriptor.explicitSurfaceRequired || descriptor.automaticPackDetection) {
  throw new Error('Unsafe admission facade configuration.');
}
```

## Finance: Wrap The Hosted Route Result

First call the hosted finance route as shown in [First hosted API call](hosted-first-api-call.md). Then wrap the returned run object:

```ts
import { createConsequenceAdmissionFacadeResponse } from 'attestor/consequence-admission';

const admission = createConsequenceAdmissionFacadeResponse({
  surface: 'finance-pipeline-run',
  run,
  decidedAt: new Date().toISOString(),
  requestInput: {
    actorRef: 'actor:finance-workflow',
    authorityMode: 'tenant-api-key',
  },
});

if (admission.decision !== 'admit' && admission.decision !== 'narrow') {
  throw new Error(`Attestor held the consequence: ${admission.decision}`);
}

// Only now may the customer system write, send, file, export, or route onward.
```

The finance facade preserves `/api/v1/pipeline/run` as the hosted route and maps the domain-native finance allow value `pass` to canonical `admit`.

## Crypto: Wrap The Package Plan

The current crypto path is a package integration boundary. Build or receive a `CryptoExecutionAdmissionPlan`, then wrap it:

```ts
import { createCryptoExecutionAdmissionPlan } from 'attestor/crypto-execution-admission';
import { createConsequenceAdmissionFacadeResponse } from 'attestor/consequence-admission';

const plan = createCryptoExecutionAdmissionPlan({
  simulation,
  createdAt: new Date().toISOString(),
  integrationRef: 'integration:erc4337:bundler',
});

const admission = createConsequenceAdmissionFacadeResponse({
  surface: 'crypto-execution-plan',
  plan,
  decidedAt: new Date().toISOString(),
});

if (admission.decision !== 'admit') {
  throw new Error(`Attestor blocked automatic execution: ${admission.decision}`);
}

// Only now may the customer-operated wallet, guard, bundler, payment server, or solver continue.
```

The crypto facade keeps `route: null` and `packageSubpath: attestor/crypto-execution-admission`. It does not claim a hosted crypto route.

## Readiness Gates

Run these before changing the public admission story:

```bash
npm run test:consequence-admission-readiness
npm run test:generic-admission-mode-ladder
npm run test:generic-admission-routes
npm run test:consequence-admission-package-surface
npm run verify
```

These gates prove that:

- README and overview docs point to the same admission story.
- `POST /api/v1/admissions` exists as the generic hosted admission route.
- Generic admissions require explicit consequence domain and mode.
- The first hosted finance call still maps to canonical `admit`.
- The first crypto integration still maps `needs-evidence` to fail-closed `review` and `deny` to fail-closed `block`.
- `attestor/consequence-admission` is the public package facade.
- Internal facade module paths stay outside the public package surface.
- The facade requires an explicit surface and does not claim automatic routing.

## Keep The Boundary Honest

The generic hosted route is not a hosted crypto route and not automatic pack detection. If a future step adds a hosted crypto route or automatic routing, it needs its own route contract, implementation, tests, package/readiness evidence, and tracker update first.
