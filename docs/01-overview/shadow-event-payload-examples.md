# Run Attestor In Shadow Pilot Mode

Run Attestor in shadow pilot mode - and map what your AI agents are trying to
do in the shadow of your systems.

Most organisations don't have a clear picture of what their AI agents are
actually attempting inside their systems. Shadow pilot mode gives you that
picture before you enforce anything.

Part of: [How to integrate Attestor](how-to-integrate-attestor.md)

Use this when you want to learn from real AI workflow attempts before a full SDK
or enforcement integration. Start with one operation class and one downstream
system.

The pilot path is:

1. send proposed consequences in `observe` mode;
2. keep raw prompts and customer records out;
3. compare `admit`, `narrow`, `review`, and `block` decisions with real
   workflow expectations;
4. decide where the customer-owned gate belongs.

This is observation and decision evidence. Enforcement starts only when that
gate is placed before the real side effect.

## Minimal First Payload

Start with one proposed consequence in observe mode. Keep raw prompts and
customer data out of Attestor; send references, digests, and enough structure
to explain what would have reached the downstream system.

```jsonc
{
  "mode": "observe",
  "actor": "support-ai-agent",
  "action": "issue_refund",
  "domain": "money-movement",
  "downstreamSystem": "refund-service",
  "policyRef": "policy:refunds:v1",
  "evidenceRefs": [
    "evidence:order-owned:sha256:<digest>",
    "evidence:payment-captured:sha256:<digest>"
  ],
  "summary": "Support AI prepared a refund request; the refund service has not run."
}
```

Then choose the closest validated example below and add the fields your gate
actually needs.

## Start Here

| If you want to see... | Start with | Then read |
|---|---|---|
| money movement risk | [Refund example](#refund) | [Reason codes](../05-proof/reason-codes.md) |
| data export risk | [Customer export example](#customer-export) | [Data minimization and redaction](../02-architecture/data-minimization-redaction-policy.md) |
| deploy risk | [Deploy example](#deploy) | [Failure modes and controls](../05-proof/failure-modes-and-controls.md) |
| customer-message risk | [Customer message example](#customer-message) | [How to integrate Attestor](how-to-integrate-attestor.md) |
| wallet-action risk | [Wallet action example](#wallet-action) | [Programmable Money golden path](../02-architecture/golden-programmable-money-shadow-pilot.md) |

## Send The First Payload

Send them to the generic admission route:

```http
POST /api/v1/admissions
Content-Type: application/json
Authorization: Bearer <redacted>
```

Use `mode: "observe"` first. Attestor evaluates the proposed action, records
shadow evidence, and can project that evidence into the canonical shadow event
schema. This page does not define a separate public `/shadow-events` ingest
route.

Do not send raw prompts, raw customer records, message bodies, SQL result rows,
payment details, wallet material, secrets, downstream error bodies, or private
thresholds. Send opaque references and digests.

The event shape follows the shipped generic admission route and the canonical
shadow-event contract. The contract is aligned with common event and audit
shapes such as [CloudEvents](https://github.com/cloudevents/spec),
[OpenTelemetry logs](https://opentelemetry.io/docs/specs/otel/logs/data-model/),
[W3C PROV](https://www.w3.org/TR/prov-dm/), and
[OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs).

## Refund

Actor: support AI agent.

Action: refund money.

Risk: the refund is larger than the manager-free limit.

```json
{
  "mode": "observe",
  "requestId": "shadow-refund-001",
  "requestedAt": "2026-05-28T08:00:00.000Z",
  "actor": "support-ai-agent",
  "actorRef": "agent:support-ai:v3",
  "action": "issue_refund",
  "domain": "money-movement",
  "downstreamSystem": "refund-service",
  "environment": "production",
  "policyRef": "policy:refunds:v1",
  "amount": {
    "value": 380,
    "currency": "USD",
    "asset": null,
    "chain": null
  },
  "recipient": "customer-account-refund-target",
  "evidenceRefs": [
    "evidence:order-ownership:sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "evidence:payment-captured:sha256:2222222222222222222222222222222222222222222222222222222222222222"
  ],
  "authoritySources": [
    {
      "sourceKind": "customer-policy",
      "claimKind": "policy",
      "sourceRef": "policy:refunds:v1",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
    },
    {
      "sourceKind": "approval-workflow",
      "claimKind": "approval",
      "sourceRef": "approval:refund-manager-review:pending",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:4444444444444444444444444444444444444444444444444444444444444444"
    }
  ],
  "approvals": [
    {
      "approvalRef": "approval:refund-manager-review:pending",
      "sourceKind": "approval-workflow",
      "state": "pending",
      "sourceRef": "workflow:refund-manager-approval",
      "reviewerRef": "role:refund-manager",
      "reviewerAuthorityDigest": "sha256:5555555555555555555555555555555555555555555555555555555555555555",
      "approvalDigest": null,
      "scopeDigest": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
      "issuedAt": "2026-05-28T07:58:00.000Z",
      "expiresAt": "2026-05-28T09:00:00.000Z",
      "trustClass": "verified-workflow",
      "signatureVerified": false,
      "stepUpVerified": false
    }
  ],
  "scopeOwnerPolicyRef": "policy:refunds:v1",
  "requestedScope": {
    "amountMinorUnits": 38000,
    "currency": "USD",
    "operationType": "refund",
    "recipientId": "customer-account-refund-target",
    "environment": "production",
    "downstreamSystem": "refund-service",
    "reversibilityClass": "compensating-action-available"
  },
  "approvedScope": {
    "maxAmountMinorUnits": 10000,
    "currency": "USD",
    "operationTypes": [
      "refund"
    ],
    "recipientIds": [
      "customer-account-refund-target"
    ],
    "environments": [
      "production"
    ],
    "downstreamSystems": [
      "refund-service"
    ],
    "reversibilityClasses": [
      "compensating-action-available"
    ]
  },
  "summary": "Support AI prepared a refund above the approved manager-free limit."
}
```

What the reviewer should understand: money should not move until approval and
scope are bound.

## Customer Export

Actor: analytics agent.

Action: export customer records.

Risk: the requested export exceeds the approved record count and data class.

```json
{
  "mode": "observe",
  "requestId": "shadow-export-001",
  "requestedAt": "2026-05-28T08:05:00.000Z",
  "actor": "analytics-ai-agent",
  "actorRef": "agent:analytics-ai:v2",
  "action": "export_customer_segment",
  "domain": "data-disclosure",
  "downstreamSystem": "customer-export-service",
  "environment": "production",
  "policyRef": "policy:customer-exports:v3",
  "dataScope": {
    "records": 1200,
    "classification": "customer-personal-data",
    "fields": [
      "account_summary",
      "billing_status",
      "support_case_refs"
    ]
  },
  "evidenceRefs": [
    "evidence:export-ticket:sha256:7777777777777777777777777777777777777777777777777777777777777777",
    "evidence:data-owner-purpose:sha256:8888888888888888888888888888888888888888888888888888888888888888"
  ],
  "authoritySources": [
    {
      "sourceKind": "customer-policy",
      "claimKind": "policy",
      "sourceRef": "policy:customer-exports:v3",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    }
  ],
  "scopeOwnerPolicyRef": "policy:customer-exports:v3",
  "requestedScope": {
    "recordCount": 1200,
    "operationType": "read",
    "dataClass": "regulated",
    "environment": "production",
    "downstreamSystem": "customer-export-service",
    "reversibilityClass": "partially-reversible"
  },
  "approvedScope": {
    "maxRecordCount": 500,
    "operationTypes": [
      "read"
    ],
    "dataClasses": [
      "internal",
      "customer-visible"
    ],
    "environments": [
      "production"
    ],
    "downstreamSystems": [
      "customer-export-service"
    ],
    "reversibilityClasses": [
      "partially-reversible"
    ]
  },
  "nativeInputRefs": [
    "warehouse-query:digest:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  ],
  "summary": "Analytics AI prepared a customer export; raw rows stay in the customer warehouse."
}
```

What the reviewer should understand: the row set and purpose are referenced,
not copied into Attestor.

## Deploy

Actor: operations agent.

Action: canary deploy.

Risk: production infrastructure changes need declared rollback and approval.

```json
{
  "mode": "observe",
  "requestId": "shadow-deploy-001",
  "requestedAt": "2026-05-28T08:10:00.000Z",
  "actor": "ops-ai-agent",
  "actorRef": "agent:ops-ai:v4",
  "action": "apply_canary_deploy",
  "domain": "system-operation",
  "downstreamSystem": "deployment-pipeline",
  "environment": "production",
  "policyRef": "policy:production-deploys:v2",
  "evidenceRefs": [
    "evidence:change-ticket:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "evidence:rollback-plan:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "evidence:dry-run-result:sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
  ],
  "authoritySources": [
    {
      "sourceKind": "approval-workflow",
      "claimKind": "approval",
      "sourceRef": "approval:production-change-window",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    }
  ],
  "approvals": [
    {
      "approvalRef": "approval:production-change-window",
      "sourceKind": "reviewer-queue",
      "state": "approved",
      "sourceRef": "workflow:production-change-review",
      "reviewerRef": "role:release-manager",
      "reviewerAuthorityDigest": "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      "approvalDigest": "sha256:abababababababababababababababababababababababababababababababab",
      "scopeDigest": "sha256:bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc",
      "issuedAt": "2026-05-28T07:50:00.000Z",
      "expiresAt": "2026-05-28T09:30:00.000Z",
      "trustClass": "verified-reviewer",
      "signatureVerified": true,
      "stepUpVerified": true
    }
  ],
  "scopeOwnerPolicyRef": "policy:production-deploys:v2",
  "requestedScope": {
    "operationType": "deploy",
    "environment": "production",
    "downstreamSystem": "deployment-pipeline",
    "reversibilityClass": "compensating-action-available"
  },
  "approvedScope": {
    "operationTypes": [
      "deploy"
    ],
    "environments": [
      "staging"
    ],
    "downstreamSystems": [
      "deployment-pipeline"
    ],
    "reversibilityClasses": [
      "compensating-action-available"
    ]
  },
  "observedFeatures": {
    "adapterReady": true
  },
  "observedFeatureOrigins": {
    "adapterReady": "trusted-adapter"
  },
  "summary": "Ops AI prepared a production canary deploy with rollback evidence refs."
}
```

What the reviewer should understand: production and staging scope are different
boundaries.

## Customer Message

Actor: support or lifecycle agent.

Action: send an outbound message.

Risk: customer-facing text should not be sent from model output alone.

```json
{
  "mode": "observe",
  "requestId": "shadow-message-001",
  "requestedAt": "2026-05-28T08:15:00.000Z",
  "actor": "support-ai-agent",
  "actorRef": "agent:support-ai:v3",
  "action": "send_customer_message",
  "domain": "external-communication",
  "downstreamSystem": "customer-messaging-service",
  "environment": "production",
  "policyRef": "policy:customer-messages:v2",
  "recipient": "contact:account-owner-ref",
  "evidenceRefs": [
    "evidence:message-template:sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
    "evidence:case-context:sha256:dededededededededededededededededededededededededededededededede"
  ],
  "authoritySources": [
    {
      "sourceKind": "customer-policy",
      "claimKind": "policy",
      "sourceRef": "policy:customer-messages:v2",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef"
    },
    {
      "sourceKind": "manual-review",
      "claimKind": "approval",
      "sourceRef": "approval:message-review:approved",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:fafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa"
    }
  ],
  "approvals": [
    {
      "approvalRef": "approval:message-review:approved",
      "sourceKind": "manual-review",
      "state": "approved",
      "sourceRef": "workflow:customer-message-review",
      "reviewerRef": "role:support-lead",
      "reviewerAuthorityDigest": "sha256:1212121212121212121212121212121212121212121212121212121212121212",
      "approvalDigest": "sha256:3434343434343434343434343434343434343434343434343434343434343434",
      "scopeDigest": "sha256:5656565656565656565656565656565656565656565656565656565656565656",
      "issuedAt": "2026-05-28T08:00:00.000Z",
      "expiresAt": "2026-05-28T10:00:00.000Z",
      "trustClass": "verified-reviewer",
      "signatureVerified": true,
      "stepUpVerified": true
    }
  ],
  "nativeInputRefs": [
    "message-body:digest:sha256:7878787878787878787878787878787878787878787878787878787878787878"
  ],
  "summary": "Support AI prepared a customer-facing message; the message body stays in the customer system."
}
```

What the reviewer should understand: Attestor can evaluate the send decision
without storing the message body.

## Wallet Action

Actor: treasury or crypto agent.

Action: propose a wallet-facing transfer.

Risk: Attestor is not a wallet, signer, custodian, bundler, broadcaster, or
settlement oracle.

```json
{
  "mode": "observe",
  "requestId": "shadow-wallet-001",
  "requestedAt": "2026-05-28T08:20:00.000Z",
  "actor": "treasury-ai-agent",
  "actorRef": "agent:treasury-ai:v1",
  "action": "propose_safe_transfer",
  "domain": "programmable-money",
  "downstreamSystem": "safe-guard-adapter",
  "environment": "production",
  "policyRef": "policy:programmable-money:v1",
  "amount": {
    "value": "5000",
    "currency": null,
    "asset": "USDC",
    "chain": "eip155:1"
  },
  "recipient": "wallet:allowlisted-recipient-ref",
  "evidenceRefs": [
    "evidence:treasury-request:sha256:9090909090909090909090909090909090909090909090909090909090909090",
    "evidence:recipient-allowlist:sha256:1313131313131313131313131313131313131313131313131313131313131313"
  ],
  "authoritySources": [
    {
      "sourceKind": "customer-policy",
      "claimKind": "policy",
      "sourceRef": "policy:programmable-money:v1",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:2424242424242424242424242424242424242424242424242424242424242424"
    },
    {
      "sourceKind": "approval-workflow",
      "claimKind": "approval",
      "sourceRef": "approval:treasury-dual-control:approved",
      "trustClass": "trusted-authority",
      "evidenceDigest": "sha256:3535353535353535353535353535353535353535353535353535353535353535"
    }
  ],
  "approvals": [
    {
      "approvalRef": "approval:treasury-dual-control:approved",
      "sourceKind": "signed-approval",
      "state": "approved",
      "sourceRef": "workflow:treasury-dual-control",
      "reviewerRef": "role:treasury-controller",
      "reviewerAuthorityDigest": "sha256:4646464646464646464646464646464646464646464646464646464646464646",
      "approvalDigest": "sha256:5757575757575757575757575757575757575757575757575757575757575757",
      "scopeDigest": "sha256:6868686868686868686868686868686868686868686868686868686868686868",
      "issuedAt": "2026-05-28T08:02:00.000Z",
      "expiresAt": "2026-05-28T08:45:00.000Z",
      "trustClass": "signed-authority",
      "signatureVerified": true,
      "stepUpVerified": true
    }
  ],
  "scopeOwnerPolicyRef": "policy:programmable-money:v1",
  "requestedScope": {
    "amountMinorUnits": 5000000000,
    "currency": "USDC",
    "operationType": "pay",
    "recipientId": "wallet:allowlisted-recipient-ref",
    "environment": "production",
    "downstreamSystem": "safe-guard-adapter",
    "reversibilityClass": "irreversible"
  },
  "approvedScope": {
    "maxAmountMinorUnits": 10000000000,
    "currency": "USDC",
    "operationTypes": [
      "pay"
    ],
    "recipientIds": [
      "wallet:allowlisted-recipient-ref"
    ],
    "environments": [
      "production"
    ],
    "downstreamSystems": [
      "safe-guard-adapter"
    ],
    "reversibilityClasses": [
      "irreversible"
    ]
  },
  "observedFeatures": {
    "adapterReady": true
  },
  "observedFeatureOrigins": {
    "adapterReady": "trusted-adapter"
  },
  "toolResults": [
    {
      "toolResultRef": "safe-preflight:digest:sha256:7979797979797979797979797979797979797979797979797979797979797979",
      "toolKind": "provider-api",
      "sourceTrustClass": "provider-authoritative",
      "resultUse": "evidence",
      "sourceRef": "safe-guard-adapter:preflight",
      "sourceTimestamp": "2026-05-28T08:19:30.000Z",
      "integrityDigest": "sha256:8080808080808080808080808080808080808080808080808080808080808080",
      "evidenceDigest": "sha256:8181818181818181818181818181818181818181818181818181818181818181",
      "evidenceClass": "security-state",
      "signatureVerified": true,
      "toolRisk": "high"
    }
  ],
  "allowedToolResultEvidenceClasses": [
    "security-state"
  ],
  "summary": "Treasury AI prepared a Safe-facing transfer; signing and broadcast stay outside Attestor."
}
```

What the reviewer should understand: the action can be evaluated before it
reaches a wallet path, but Attestor does not sign or broadcast.

## How To Read The Result

The first question is not "did the model sound confident?"

The first question is:

```text
Should this proposed action reach the downstream system?
```

Useful result fields:

- `admission.decision`: `admit`, `narrow`, `review`, or `block`
- `admission.reasonCodes`: machine-readable reason codes
- `admission.checks`: what ran
- `admission.proof`: proof references
- `operationalContext.nonEnforcingMode`: true for `observe` and `warn`

For support triage, keep [reason codes](../05-proof/reason-codes.md) and
[failure modes and controls](../05-proof/failure-modes-and-controls.md) close
by.

## Boundaries

These examples are synthetic and repo-side only.

They do not prove live customer PEP no-bypass, KMS-backed signing,
multi-instance replay safety, wallet settlement, customer deployment, external
security certification, production readiness, or compliance.

For the canonical shadow-event projection contract, see
[Shadow Event Canonical Schema](../02-architecture/shadow-event-canonical-schema.md).

Back: [How to integrate Attestor](how-to-integrate-attestor.md). Next:
[Consequence admission quickstart](consequence-admission-quickstart.md) when
you are ready to send the shared admission shape, or
[Customer admission gate](customer-admission-gate.md) when the downstream stop
point is ready.
