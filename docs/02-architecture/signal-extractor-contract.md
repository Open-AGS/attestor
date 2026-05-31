# Signal Extractor Contract

Status: Runtime Assurance Wiring v1 Step W02. This is a contract for typed
signal extraction output. It is not an adapter registry, not relationship
detection, not fusion, not live enforcement, and not production readiness.

## Decision

The Signal Extractor Contract defines the boundary between a shadow envelope
projection and typed signals:

```text
ShadowEnvelopeProjection
  -> extractor declaration
  -> SignalExtractionBatch
  -> later relationship detector
```

Version:

```text
attestor.signal-extractor-contract.v1
```

Package exports:

```text
SignalExtractorDeclaration
SignalExtractionBatch
createSignalExtractorDeclaration()
createSignalExtractionBatch()
signalExtractorContractDescriptor()
```

## Contract

An extractor declaration must state:

```text
extractorId
sourcePlane
category
authorityMode
allowedKinds
executionMode
outputMode
```

The declaration is category-bound. One extractor declaration emits one signal
category. A `gap` extractor may emit `evidence_gap` and `policy_gap`; it may not
also emit `anomaly` or `hard_floor`.

The batch records:

```text
projectionDigest
envelopeRefDigest
sourceEventDigest
tenantBindingDigest
signals
sourceEvidenceDigests
readModelDigests
```

Every signal must preserve:

```text
category
kind
sourcePlane
authorityMode
envelopeRefDigest
evidenceRefs
readModelRefs
appliesToConsequenceClasses
```

## Authority Boundary

The extractor cannot upgrade authority. Advisory extractors cannot emit
`hard_floor`. A `hard_floor` signal is only representable when the declaration
is:

```text
sourcePlane = tier-1-hard-gate
authorityMode = hard-floor
allowedKinds includes hard_floor
```

Every descriptor, declaration, and batch keeps:

```text
grantsAuthority = false
canAdmit = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

The output may later raise review or block pressure through relationship and
fusion layers, but this contract itself never grants authority and never emits
an admission decision.

## Redaction Boundary

The extractor contract follows digest-only evidence discipline. It never reads
raw payload and never forwards raw prompt, provider body, wallet material,
customer identifier, tenant identifier, payment detail, downstream body, or
private threshold.

Required evidence discipline:

```text
source evidence refs are digest-only
read model refs are digest-only
signals must include at least one evidence ref
raw payload access is false
```

This keeps extraction compatible with the `ShadowEnvelopeProjection` redaction
boundary and with later duplicate-evidence detection.

## Runtime Wiring Position

Runtime Assurance Wiring v1:

```text
W01 Shadow Envelope Projector          complete
W02 Signal Extractor Contract          complete
W03 Existing Checks To Signal Adapter  planned
W04 Relationship Detector Contract     planned
W05 Shadow Runtime Pipeline Dry Run    planned
```

W02 defines the contract that W03 adapters must satisfy. It does not implement
those adapters.

## Primary Source Anchors

Reviewed on 2026-05-17:

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) - AI spans and tool-call telemetry should avoid recording sensitive instructions, inputs, and outputs by default.
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) - tool metadata can describe tool behavior, but tool metadata is not Attestor authority.
- [Open Policy Agent decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) - structured decision events can be emitted with masking for sensitive input/result fields.
- [NASA Runtime Assurance](https://ntrs.nasa.gov/citations/20240006522) - advanced or advisory components must remain separated from the trusted assurance boundary.

These anchors justify a typed monitor/extractor boundary with digest-only
evidence refs. They do not prove production readiness or formal correctness.

## Non-Claims

Boundary: signal extraction contract only: not adapter registry,
not relationship detection, not fusion, not live enforcement, and not production
readiness. It never reads raw payload and never grants authority.

It never reads raw payload, never grants authority, and never makes an action
safe.
