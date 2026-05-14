# Recipient Tenant Boundary Replay

This document describes `attestor.consequence-recipient-tenant-boundary-replay.v1`
and its repository-side runtime bridge,
`attestor.consequence-recipient-tenant-boundary-runtime.v1`.

The replay contract turns the failure modes `cross-tenant-leakage`, `wrong-recipient-disclosure`, and `sensitive-data-disclosure` into deterministic synthetic cases for tenant, recipient, and redaction boundaries.

It is not a certification, not a full tenant-isolation proof, and not a claim of production readiness. It checks supplied metadata only; hosted routes, dashboards, exports, review packets, downstream senders, and customer gateways still need integration evidence.

## Research Anchors

- NIST SP 800-162 ABAC: authorization depends on subject, object, requested operation, and environment attributes.
- OWASP API Security Top 10 2023: object-level and property-level authorization must be checked where APIs access data by caller-controlled identifiers.
- Microsoft indirect prompt injection guidance: untrusted content should be isolated and downstream policy enforcement should contain impact.
- OWASP LLM Top 10 2025: sensitive information disclosure remains a core LLM application risk.

## Contract

Source file:

```text
src/consequence-admission/recipient-tenant-boundary-replay.ts
src/consequence-admission/recipient-tenant-boundary-runtime.ts
```

Test command:

```bash
npm run test:recipient-tenant-boundary-replay
npm run test:f6-recipient-tenant-runtime-boundary
```

The replay evaluates synthetic cases across:

- `shadow-summary`
- `audit-evidence-export`
- `business-risk-dashboard`
- `dashboard-api-summary`
- `external-review-packet`
- `support-communication`
- `downstream-send`

## Boundary Checks

Tenant checks:

- current tenant must be present
- every returned record must be tenant-bound
- foreign tenant records block
- raw tenant ids are never serialized

Recipient checks:

- target recipient must be present
- approved recipient scope must be present
- target recipient must be inside approved recipient scope
- communication context must be present
- content data class must be compatible with recipient scope
- raw recipient values are never serialized

Data minimization checks:

- redaction policy result must be present
- failed redaction blocks
- raw recipient exposure blocks
- raw payload storage blocks

## Decisions

Each case computes one of:

- `pass`: tenant, recipient, and redaction boundaries hold
- `review`: required boundary evidence is missing
- `block`: foreign tenant, wrong recipient, disallowed data class, failed redaction, or raw exposure is detected

The report passes only when computed outcomes match the expected replay outcomes. The replay never activates enforcement and never executes production traffic.

## Runtime Bridge

The runtime bridge reuses the replay evaluator against live route/export/send
metadata and returns a deterministic decision:

- `allowed: true` only when the outcome is `pass`
- `failClosed: true` when the outcome is `review` or `block`
- raw tenant ids, recipient ids, runtime surface refs, and communication
  contexts are represented only by digests

The bridge is intentionally not marked production-ready and does not mutate
downstream systems. It renders the central decision that route handlers,
gateways, dashboards, exports, review packets, and downstream senders must
enforce before releasing data or sending communication.

## Binding

The replay reuses the Control Binding Contract for:

```text
failureModeIds:
- cross-tenant-leakage
- wrong-recipient-disclosure
- sensitive-data-disclosure

invariants include:
- tenant-and-recipient-boundaries-must-hold
- sensitive-data-minimization-required
- scope-cannot-exceed-approved-boundary
- trusted-evidence-required
```

Required controls, evidence, authority, and audit records come from:

```text
src/consequence-admission/failure-mode-control-bindings.ts
```

## Limitations

This is a central replay contract plus a runtime decision bridge, not full route
or downstream coverage.

Remaining work:

- hosted dashboard/export/review routes must consume the runtime bridge or an
  equivalent tenant-boundary check
- downstream sender helpers must reject wrong-recipient and
  disallowed-data-class runtime decisions
- customer integrations must provide approved recipient scope and data-class metadata
- production stores still need tenant partitioning through the selected storage model
- README positioning is handled in the final docs alignment step
