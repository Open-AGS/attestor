# Shadow Event Canonical Schema

Status: repository-side Step 14 contract for the unified Shadow-to-Policy plan.
This is not a production event store, not a SIEM export format, not live
target-system integration proof, and not automatic enforcement.

## Decision

The canonical shadow event is the vendor-neutral record that every target
adapter should converge on before Attestor builds action graphs, policy
candidates, replays, review packets, or rollout decisions.

```text
target action / admission shadow event
  -> canonical shadow event
  -> action surface graph
  -> evidence state model
  -> policy candidate
  -> replay / review / approval
```

The schema deliberately follows common event-system patterns without becoming a
raw-data lake:

- CloudEvents-style envelope identity and source fields.
- OpenTelemetry Logs Data Model style event name and observed timestamp.
- OCSF-style vendor-neutral event normalization.
- W3C PROV-style provenance references.
- Attestor-specific fail-closed, no-auto-enforce, and data-minimization rules.

## Runtime Contract

The machine-readable contract lives in
`src/consequence-admission/canonical-shadow-event-schema.ts`.

| Field group | Purpose | Boundary |
|---|---|---|
| Envelope | `version`, CloudEvents `specversion`, OpenTelemetry event name, `eventId`, `occurredAt`, `observedAt`, `sourceKind`, `producer`. | The event id is digest-backed; no raw target payload is used as identity. |
| Tenant / actor | `tenantRefDigest`, `actorRefDigest`. | Raw tenant ids, user ids, emails, account ids, API keys, and wallet material are not stored. |
| Observed facts | Facts directly observed from the route, target wrapper, manifest, or admission event. | Observed facts must not contain inferred policy conclusions. |
| Inferred facts | Consequence class, authority delta, or other classification derived from observed facts. | Inference is stored separately so downstream policy work can mark uncertainty. |
| Decision | Admission digest, mode, shadow decision, effective decision, allowed/fail-closed flags, reason codes. | This records what Attestor saw or decided; it does not activate policy. |
| Outcome | Downstream and human outcome labels when available. | Outcome labels are not proof of downstream completion unless a receipt ref exists. |
| References | Evidence, simulation, approval, receipt, policy, idempotency, replay, trace, schema, provenance, authority, and outbox refs. | References must be `sha256:` digest refs, never raw ids or payloads. |
| Raw material boundary | Redaction policy version and false flags for raw payload, prompt, provider body, wallet material, and customer identifier storage. | Any raw-material storage requirement belongs outside this schema and blocks promotion. |

## Required Shape

The canonical event uses this minimum field vocabulary:

```text
version = attestor.canonical-shadow-event.v1
cloudEventsSpecversion = 1.0
otelEventName = attestor.shadow_event
eventId = canonical-shadow:sha256:...
occurredAt
observedAt
sourceKind
producer
tenantRefDigest
actorRefDigest
observed.targetSystem
observed.targetAccountRefDigest
observed.actionName
observed.actionKind
observed.resourceRefDigest
observed.dataClass
inferred.consequenceClass
inferred.authorityDelta
evidenceRefs[]
simulationRefs[]
approvalRefs[]
receiptRefs[]
policyRefs[]
idempotencyRefDigest
replayRefDigest
traceRefDigest
schemaRefDigest
rawMaterialBoundary
autoEnforce = false
approvalRequiredForPromotion = true
```

Some fields may be `null` when the event source cannot truthfully provide them.
They still remain present so the [Action Surface Graph](action-surface-graph.md)
can distinguish "not observed" from "forgotten by the adapter."

## Observed Versus Inferred

The most important rule is separation:

```text
observed = directly observed target/action/resource/data facts
inferred = classification, consequence class, authority delta, or risk meaning
```

Examples:

| Case | Observed | Inferred |
|---|---|---|
| Salesforce case refund | target system, action name, case/customer resource digest | financial consequence class |
| ServiceNow change execute | flow/action, CI resource digest, change ticket digest | operational-execution class, rollback relevance |
| Okta group membership update | principal/resource digests, action name | authority-change class |
| Safe transaction proposal | safe digest, chain digest, calldata digest, transaction-proposal kind | programmable-money class, owner/module authority delta |
| Snowflake export | account/database/schema digest, action name, data class | data-movement class |

Do not place model guesses, policy recommendations, or risk labels in
`observed`. The [Evidence State Model](evidence-state-model.md) adds the richer
state vocabulary: `observed`, `inferred`, `missing`, `conflicting`, `stale`,
`untrusted`, `approved`, and `enforceable`.

## Source Kinds

Allowed source kinds:

```text
admission-shadow
target-system-shadow
integration-declaration
crypto-execution-admission
manual-import
```

`admission-shadow` is the current repository bridge from existing
`ShadowAdmissionEvent` records. `target-system-shadow` is the future adapter
shape for customer-controlled Salesforce, Microsoft, ServiceNow, workflow,
data/IAM, spend, health, and crypto surfaces. `manual-import` is allowed only as
review support; it is not enough for enforcement.

## Action And Consequence Vocabulary

Allowed action kinds:

```text
api-operation
workflow-step
tool-call
mcp-tool
webhook-callback
transaction-proposal
approval-step
sql-execution
identity-operation
manual-import
```

Allowed consequence classes:

```text
financial
data-movement
authority-change
external-communication
operational-execution
programmable-money
health-claims
unknown
```

These are intentionally broad. Vendor-specific actions stay in `actionName`;
the canonical class should remain stable across Salesforce, ServiceNow,
Snowflake, Databricks, Okta, Entra, Fireblocks, BitGo, Coinbase CDP, Safe,
OpenZeppelin Defender, Coupa, SAP, and FHIR-style workflows.

## Raw Data Prohibitions

Canonical shadow events must not store:

- raw prompts
- raw tool payloads
- raw provider bodies
- raw customer identifiers
- raw tenant ids
- raw actor ids
- raw payment details
- raw wallet material
- raw private keys or signing material
- raw database URLs
- raw idempotency keys
- raw replay keys
- downstream error bodies

References use `sha256:` digests. If an operator needs to preserve raw material
for legal, support, or incident reasons, that material must live in a separate
customer-controlled system with its own access controls and retention policy.
The canonical shadow event may only carry a digest reference to it.

## Current Bridge

`createCanonicalShadowEventFromAdmissionEvent()` projects the existing
`ShadowAdmissionEvent` into the new canonical shape:

```text
ShadowAdmissionEvent
  -> tenant/actor digest refs
  -> observed target/action/resource facts
  -> inferred consequence class
  -> admission/provenance/redaction evidence refs
  -> digest-only raw material boundary
```

This bridge is deliberately conservative. It does not invent target-specific
receipts, resource ids, customer approvals, or live integration proof. Future
target adapters must provide those refs directly.

## Primary Research Anchors

Reviewed on 2026-05-17:

- [CloudEvents specification](https://github.com/cloudevents/spec) for common event envelope concepts such as event id, source, type, subject, and time.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/) for observed timestamp, event name, attributes, severity, and trace correlation shape.
- [Open Cybersecurity Schema Framework](https://schema.ocsf.io/) for vendor-neutral event-class normalization.
- [W3C PROV Data Model](https://www.w3.org/TR/prov-dm/) for entities, activities, agents, and provenance relations.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) for masking and audit-safe decision logging.

These sources are engineering anchors only. They do not certify Attestor
interop, storage security, telemetry compliance, SIEM compatibility, or live
production operation.

## Non-Claims

This schema does not claim:

- production event-store readiness
- SIEM/export integration
- native target-system connector coverage
- customer deployment
- compliance certification
- automatic policy activation
- raw-payload retention safety
- live downstream receipt reconciliation
- completion of Step 17 Policy Candidate PR contract

It is the canonical event input for graph, evidence, candidate, replay, and
review-by-exception work.
