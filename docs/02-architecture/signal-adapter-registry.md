# Signal Adapter Registry

Status: Runtime Assurance Wiring v1 Step W03. This is a registry contract that
maps existing admission checks into typed signal extractor declarations. It is
not runtime adaptation, not relationship detection, not fusion, not live
enforcement, and not production readiness.

## Decision

The registry binds the current `CONSEQUENCE_ADMISSION_CHECK_KINDS` surface to
the signal extractor contract:

```text
ConsequenceAdmissionCheck kind
  -> SignalAdapterRegistration
  -> SignalExtractorDeclaration
  -> later signal batch creation
```

Version:

```text
attestor.signal-adapter-registry.v1
```

Package exports:

```text
createSignalAdapterRegistration()
createSignalAdapterRegistry()
createBuiltinSignalAdapterRegistry()
signalAdapterRegistryDescriptor()
```

## Built-In Mapping

The W03 registry covers all six existing admission checks:

| Existing check | Signal category | Signal kind | Source plane | Authority mode |
|---|---|---|---|---|
| `policy` | gap | `policy_gap` | policy-foundry | advisory |
| `authority` | gap | `authority_gap` | policy-foundry | advisory |
| `evidence` | gap | `evidence_gap` | policy-foundry | advisory |
| `freshness` | gap | `freshness_gap` | temporal-trajectory | advisory |
| `enforcement` | verdict | `hazard` | tier-1-hard-gate | advisory |
| `adapter-readiness` | measurement | `measurement_degraded_signal` | assurance-measurement | measurement-only |

The enforcement adapter is explicitly not a `hard_floor` adapter. It can only
emit a `hazard` signal shape for later review/block pressure. A `hard_floor`
registration is only representable with `sourcePlane = tier-1-hard-gate` and
`authorityMode = hard-floor`.

## Duplicate Evidence Boundary

The registry records a dedupe key shape:

```text
sourceCheckKind
sourceEvidenceDigest
envelopeRefDigest
```

W03 does not detect duplicates. It only makes duplicate handling explicit for
W04:

```text
duplicateEvidenceRelationshipCandidate = duplicates
relationshipDetectionIncluded = false
fusionIncluded = false
```

This prevents the registry from double-counting the same evidence while still
leaving actual relationship construction to the next step.

## Pass Outcome Boundary

Adapters trigger only on:

```text
warn
fail
not-applicable
```

`pass` is deliberately excluded. A passed existing check does not become a
"safe" signal and cannot lower review requirements.

## Authority Boundary

Every registry object keeps:

```text
grantsAuthority = false
canAdmit = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

The registry never grants authority. It describes how existing checks can be
observed as typed signals for later fabric processing.

## Runtime Wiring Position

Runtime Assurance Wiring v1:

```text
W01 Shadow Envelope Projector                 complete
W02 Signal Extractor Contract                 complete
W03 Existing Checks To Signal Adapter Registry complete
W04 Relationship Detector Contract            planned
W05 Shadow Runtime Pipeline Dry Run           planned
```

W03 registers how existing checks map into typed signal declarations. It does
not execute those adapters against live requests.

## Primary Source Anchors

Reviewed on 2026-05-17:

- [Open Policy Agent decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) - decision events keep policy path, input/result traceability, and masked/erased sensitive fields explicit.
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) - AI/tool telemetry is useful as structured source data, but sensitive prompts and payloads should not become raw evidence.
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) - tool annotations can describe behavior, but metadata is not an authority grant.
- [Accellera UVM](https://www.accellera.org/downloads/standards/uvm) - verification environments separate monitors, scoreboards, and coverage instead of mixing observation with final decision authority.

These anchors justify a monitor-style adapter registry with digest-only
evidence refs and no authority upgrade. They do not prove production readiness
or formal correctness.

## Non-Claims

Boundary: adapter declaration registry only: not runtime adaptation, not
relationship detection, not fusion, not live enforcement, and not production
readiness. Registrations never grant authority.

It never grants authority and never converts a passing check into a safe
signal.
