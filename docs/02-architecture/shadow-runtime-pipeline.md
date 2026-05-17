# Shadow Runtime Pipeline

Status: W05 implementation contract for Runtime Assurance Wiring v1. This is a
shadow-only dry-run pipeline, not live enforcement, not policy activation, not
learning, and not production readiness.

Version: `attestor.shadow-runtime-pipeline.v1`

## Decision

The Shadow Runtime Pipeline connects the completed W01-W04 runtime wiring
contracts to the existing assurance components:

```text
CanonicalShadowEvent
  -> Shadow Event -> Consequence Envelope projector
  -> built-in signal adapter registry
  -> typed signal extraction batches
  -> Relationship Detector Contract
  -> LayerOpinion projection
  -> envelope context modulators
  -> Relationship-Aware Hazard Fusion
  -> Conflict / Abstention Gate
  -> Human Comprehension Gate
  -> unsigned Signed Assurance Packet
```

The runner is a pure deterministic shadow function. It may create review
pressure, reason lines, questions, and an unsigned assurance packet. It cannot
admit, narrow, execute, activate policy, call downstream systems, learn from
traffic, aggregate cross-tenant data, or grant authority.

## Files

```text
src/consequence-admission/shadow-runtime-pipeline.ts
tests/shadow-runtime-pipeline.test.ts
docs/02-architecture/shadow-runtime-pipeline.md
```

## Boundaries

The pipeline preserves these invariants:

```text
executionMode = shadow-only
packetSigningIncluded = false
noLiveEnforcement = true
canAdmit = false
grantsAuthority = false
activatesEnforcement = false
autoEnforce = false
learnsFromTraffic = false
crossTenantAggregation = false
rawPayloadRead = false
rawPayloadStored = false
productionReady = false
```

The generated assurance packet is intentionally unsigned. That keeps the
result useful for replay, review, and debugging while preserving activation
blockers until a later signing and production-boundary step exists.

## Why This Shape

NASA Runtime Assurance uses a runtime safety monitor and decision logic around
an operating function, with an alternate or backup function in the architecture
pattern. W05 follows the same separation at Attestor's consequence boundary:
the shadow runner observes and evaluates, but it does not become the authority
that executes the consequence.

NVIDIA Safety Force Field is a useful control-layer analogy because it checks a
desired control against safety constraints rather than combining constraints in
an ad hoc way. W05 keeps relationship evaluation before fusion and preserves
monotone no-loosening so a single strong hazard, conflict, or gap cannot be
averaged away.

OPA Decision Logs are the auditability anchor: policy decisions should be
debuggable from structured events, and sensitive fields need masking or erasure
before upload. W05 uses digest-only refs and does not forward raw prompt, raw
payload, raw provider body, wallet material, payment detail, tenant identifier,
or downstream body.

OpenTelemetry GenAI semantic conventions are the observability anchor for AI
systems because they separate spans, events, metrics, exceptions, model spans,
and agent spans. W05 keeps its output structured enough for a later trace
logger without writing raw agent content.

## Non-Claims

W05 is:

```text
not live enforcement
not policy activation
not downstream execution
not packet signing
not TLA+ validated
not Alloy validated
not learning
not baseline extraction
not cross-tenant aggregation
not production readiness
```

W05 does not replace W06 Decision Trace Logger, W07 TLA+ Admission State
Machine Skeleton, W08 Alloy Tenant Isolation Model, or W09-W12 baseline and
invariant promotion work.

## Verification

Targeted verification:

```bash
npm run test:shadow-runtime-pipeline
npm run test:consequence-runtime-assurance-overview
npm run typecheck
```

Broader confidence should include the W01-W04 tests plus fusion, gate, packet,
package-surface, hygiene, build, and `npm run verify` before merging.

## Sources

- NASA, [Runtime Assurance of Aeronautical Products](https://ntrs.nasa.gov/api/citations/20220015734/downloads/tm-rta-guidance.pdf)
- NVIDIA, [The Safety Force Field](https://www.nvidia.com/content/dam/en-zz/Solutions/self-driving-cars/safety-force-field/the-safety-force-field.pdf)
- OPA, [Decision Logs](https://www.openpolicyagent.org/docs/management-decision-logs)
- OpenTelemetry, [Semantic conventions for generative AI systems](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- ACM Queue, [Systems Correctness Practices at AWS](https://queue.acm.org/detail.cfm?id=3712057)
