# Shadow Envelope Projector

Status: Runtime Assurance Wiring v1 Step W01. This is a shadow-only projection
builder, not an enforcement path and not a production readiness claim.

## Decision

The Shadow Envelope Projector converts an already canonical
`CanonicalShadowEvent` into a digest-only `ConsequenceEnvelopeContract`
projection artifact:

```text
CanonicalShadowEvent
  -> pure deterministic projection builder
  -> ConsequenceEnvelopeContract projection artifact
```

The implementation lives in:

```text
src/consequence-admission/shadow-envelope-projector.ts
tests/shadow-envelope-projector.test.ts
```

Version:

```text
attestor.shadow-envelope-projector.v1
```

## Contract

The projector accepts:

```text
attestor.canonical-shadow-event.v1
```

It produces an envelope-compatible projection bound to:

```text
attestor.consequence-envelope-contract.v1
```

The projection records:

- source event digest
- envelope digest
- tenant binding digest
- idempotency key digest
- redaction preservation summary
- shadow-only posture
- no-authority flags

The envelope itself contains only digest references for tenant, actor, target
system, evidence, authority, policy, resource, replay, and source event
bindings.

## Invariants

The Step W01 invariant set is:

```text
no source event mutation
no raw payload read
no raw payload forwarding
tenant binding preserved
projection is deterministic by source event digest
projection mode is shadow-only
no authority granted
no admission decision emitted
no enforcement activation
no production readiness claim
```

The projector is allowed to construct conservative defaults when the canonical
event lacks information:

```text
reversibilityClass = irreversible
blastRadiusEstimate = tenant
tenantMaturityClass = shadow-observed
historyDepthClass = low
freshnessPosture = unknown
```

Those defaults are not safety proof. They are conservative shape values so the
next wiring steps can run typed signal extraction without reading raw payloads.

## Redaction Boundary

The canonical shadow event already carries a raw material boundary. The
projector preserves it into the envelope:

```text
digest-only    -> digest-only
forbidden      -> digest-only
metadata-only  -> redacted-summary
```

It never stores or forwards:

```text
raw prompts
raw tool payloads
raw provider bodies
raw customer identifiers
raw tenant identifiers
raw wallet material
raw payment details
raw downstream bodies
private thresholds
```

## Authority Boundary

The projector is not a policy decision point. Its exported descriptor and every
projection instance keep these flags false:

```text
grantsAuthority = false
canAdmit = false
activatesEnforcement = false
autoEnforce = false
productionReady = false
```

## Runtime Wiring Position

Runtime Assurance Wiring v1 is sequenced as:

```text
W01 Shadow Envelope Projector
W02 Signal Extractor Contract
W03 Existing Checks To Signal Adapter Registry
W04 Relationship Detector Contract
W05 Shadow Runtime Pipeline Dry Run
W06 Decision Trace Logger
W07 TLA+ Admission State Machine Skeleton
W08 Alloy Tenant Isolation Model
W09 Baseline Cohort Contract
W10 Candidate Invariants Catalog
W11 Invariant Calibration Contract
W12 Invariant Promotion Gate
```

Step W01 only builds the first projection artifact. It does not emit signals,
detect relationships, run fusion, sign packets, update feedback, or write the
measurement plane.

## Primary Source Anchors

Reviewed on 2026-05-17:

- [CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) - event context and event data separation.
- [OpenTelemetry generative AI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) - structured AI operation telemetry as a source, not authority.
- [AWS Systems Correctness Practices](https://queue.acm.org/detail.cfm?id=3712057) - production trace evidence checked against specifications.
- [AWS CloudTrail log file validation](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html) - digest-bound log integrity pattern.

These anchors justify typed event projection and digest-bound trace evidence.
They do not prove Attestor production readiness, formal correctness, or
customer deployment readiness.

## Non-Claims

This projector is:

- not live enforcement
- not signal extraction
- not fusion
- not packet signing
- not TLA+-checked
- not a learned invariant engine
- not cross-tenant aggregation
- not production readiness

It never mutates the `CanonicalShadowEvent`, never reads raw payload, and never
grants authority. In short: never grants authority.
