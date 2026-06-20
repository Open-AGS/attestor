# Consequence Admission Quickstart

Use this when a customer-controlled system needs one shared admission shape before an AI action becomes a consequence:

Part of: [How to integrate Attestor](how-to-integrate-attestor.md)

Use this after you know where the gate sits and need the request, response, and
decision vocabulary. This page is deeper than the README on purpose; it is the
shared admission contract, not the first product pitch.

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
- Keep route and package selection explicit.
- Do not use the old placeholder `POST /api/v1/admit` route name.
- Use the generic route for generic admission, not for hidden pack selection.
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

Release-token enforcement is a token-state boundary, not a fresh upstream
approval oracle. Its practical authority window is `min(token TTL, revocation
propagation latency)`. If a decision or approval is withdrawn after admission,
the release-token introspection store exposes decision-level revocation so all
tokens for that decision become inactive before expiry.

For approval work that is not already fresh enough at admission time, use a
requestable denial instead of issuing a release token against the old decision.
A requestable denial stays a fail-closed `review` or `block` decision. It can
open an access-request task, but the task and the approval result are not
execution proof: they set `accessPermitted: false`,
`releaseTokenMayBeIssued: false`, and `requiresReevaluation: true`. After the
task is approved, the only next authorization step is a fresh admission
evaluation for the same digest-bound actor, action, downstream system, policy,
and tenant scope. Only that new admission may issue a short-lived protected
release token for downstream execution.

The package contract for this approval path is available through
`attestor/consequence-admission`. It is a digest-first contract surface: raw
approval refs, actor refs, policy refs, and downstream refs must not be stored
in the requestable-denial record, access-request task, or re-evaluation
context. The hosted runtime includes a local file-backed evaluation task store
and status routes for this metadata; a shared production approval workflow,
operator queue, and upstream approval connector are separate runtime wiring.

The hosted generic admission route can expose this boundary as optional
response metadata. A requestable denial may include `requestableDenial`; if the
runtime has an access-request task dependency configured, it also includes
`accessRequestTask`. The task can be read from
`GET /api/v1/admissions/access-requests/:id`, and the tenant-scoped list is at
`GET /api/v1/admissions/access-requests`. Neither field authorizes execution,
and neither field is a release token. The downstream gate still needs a later
post-approval admission with required release proof before it can proceed.

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

Generic admissions can also run the tool-result poisoning guard when the
request supplies structured `toolResults` metadata. Tool results must be
opaque references with source trust class, use kind, source timestamp,
integrity digest, evidence digest, and allowed evidence-class metadata.
Untrusted external tool results cannot authorize or instruct an action;
model-generated tool evidence is held for review; trusted provider or system
tool evidence can support the request only through digest-bound metadata. The
admission response carries tool-result guard outcome, counts, reason codes,
and a digest, not raw tool output, source URLs, provider bodies, or model
summaries. The generic hosted route does not expose signed-attestation PKI
verification input in this slice; signed tool-result attestation remains a
customer/operator provenance boundary.

Generic admissions can also run the agentic supply-chain guard when the
request supplies structured `agenticSupplyChain` metadata. This metadata binds
the proposed action to the tool, connector, plugin, workflow, generated
adapter, domain pack, or provider SDK that helped prepare or execute the
action. Components need pinned source, version, integrity digest, provenance,
review/owner authority evidence, least-privilege permission scope, adapter
readiness where relevant, and runtime replay evidence for high-impact
components. Missing provenance or integrity holds for review; overbroad
permissions, unreviewed generated artifacts, unverified domain-pack boundaries,
critical unsafe components, or untrusted publishers can fail closed. The
admission response carries only outcome, reason codes, counts, and a digest;
it must not return raw component refs, package names, permissions, source URLs,
generated code, or provider bodies. This does not prove third-party code
behavior, customer runtime execution, or production supply-chain provenance.

Generic admissions can also run the human-review fatigue guard when the
request supplies structured `humanReviewFatigue` metadata. This metadata binds
the proposed action to digest-first review packet state: review surface kind,
opaque review packet reference, counts, timings, boolean posture, and optional
thresholds. Missing no-go summaries, missing evidence summaries, missing focus
areas, missing next safe step, excessive review load, unprioritized blockers,
raw payload storage, or auto-enforce requests can hold or block before
downstream execution. The admission response carries only outcome, reason
codes, counts, booleans, and a digest; it must not return raw review packets,
reviewer notes, customer payloads, or private case text. This does not prove
live reviewer staffing, reviewer behavior, or customer review workflow
operation.

Generic admissions can also run the multi-agent delegation guard when the
request supplies structured `multiAgentDelegation` metadata. This metadata
binds the proposed action to a digest-first chain of agent, service-account,
workflow, tool, human, and approver principals. Missing agent identity,
missing authority, missing scope, unapproved delegated scope, delegation
cycles, self-approval, cross-tenant unscoped delegation, or over-depth chains
can hold or block before downstream execution. The admission response carries
only outcome, reason codes, counts, and a digest; it must not return raw
principal refs, raw delegation traces, private tenant identifiers, customer
prompts, or tool payloads. This does not prove live IAM, customer agent
runtime binding, transport authentication, or customer PEP no-bypass.

Generic admissions can also run the stale authority/policy guard when the
request supplies structured `staleAuthorityPolicy` metadata. This metadata
binds the proposed action to a policy version, the current policy version,
optional policy digests, approval issue and validity times, authority
freshness and expiry times, drift state, and no-go reason labels. Policy
mismatch, superseded policy, policy update after approval, expired approval,
expired authority, drift `no-go`, or no-go reasons block. Missing policy or
freshness metadata holds for review. The admission response carries only
reason codes, counts, and digests; it must not return raw policy text, raw
approval records, private IdP records, or raw no-go case text. This does not
prove the customer policy store, IdP, approval workflow, or downstream verifier
is live-wired to the latest source-of-truth state.

Generic admissions can also run the decision-context drift binding when the
request supplies structured `decisionContextDrift` metadata. This metadata
binds the evaluated context to the current model version, tool schema digest,
policy version, config digest, optional prompt/verifier/simulation digests,
and freshness window. Missing bound or current context blocks; model,
tool-schema, policy, config, prompt, verifier, or simulation drift holds for
review; expired or over-age context holds for review. The admission response
carries only outcome, reason codes, counts, age, and digest evidence; it must
not return raw model versions, policy versions, prompt text, config values,
tool definitions, verifier identifiers, or simulation bodies. This does not
prove the customer runtime inventory, change-management source, or live
simulation runner.

Generic admissions can also run the authority-creep guard when the request
supplies structured `authorityCreep` metadata. This metadata binds the proposed
action to digest-first assurance lineage and optional measurement-plane
evidence. Clean lineage can add evidence-ready proof. Measurement artifacts
that try to support a claim or strategy, blocked metric uses, missing lineage
binding, or attempts to use measurement as authority hold for review. Direct
requests to write audit state, activate policy, activate live enforcement,
grant authority, or return raw payload/evidence fail closed. The guard cannot
grant authority, write policy, activate enforcement, reduce evidence
requirements, or admit an action by itself. Put plainly: it cannot grant
authority, write policy, activate enforcement, reduce review, or lower proof
requirements. The admission response carries only outcome, reason codes,
counts, booleans, and digests; it must not return raw
lineage graphs, raw measurement windows, raw assurance packets, customer
payloads, or private reviewer material. This does not prove live assurance
operations, live reviewer behavior, live policy activation, or customer PEP
no-bypass.

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

Back: [How to integrate Attestor](how-to-integrate-attestor.md). Next:
[Customer admission gate](customer-admission-gate.md) for the downstream stop
point, or [Run Attestor in shadow pilot mode](shadow-event-payload-examples.md)
when you want observe-mode examples first.
