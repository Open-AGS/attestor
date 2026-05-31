# External Review Packet

The external review packet is the reviewer handoff built from Attestor's audit evidence export, dashboard summary, runtime/storage evidence, and repository security references.

It is not a security audit.

It answers a narrow question:

```text
What should an outside reviewer inspect first, and which claims are explicitly not made?
```

The packet exists to make independent review easier without pretending that the review has already happened.

## Why It Exists

The audit evidence export is the canonical control evidence. The business risk dashboard makes that evidence readable for operators. Production storage and repository checks add context about whether the system is still evaluation-backed or ready for a stronger deployment claim.

An external reviewer should not need to hunt across all of those surfaces before knowing where to start.

The external review packet creates one digest-first orientation layer:

```text
audit evidence export
  -> dashboard digest
  -> runtime and storage evidence digest
  -> repository evidence references
  -> review checklist
  -> findings and non-claims
  -> canonical packet digest
```

It is a map over evidence, not a replacement for evidence.

## What It Includes

The packet can include:

- audit evidence export id and digest
- business risk dashboard digest
- runtime/storage evidence digest
- repository evidence references
- reviewer focus areas
- checklist items
- structured findings
- non-claims
- reviewer instructions
- alignment references

The focus areas are:

- authorization boundary
- data minimization
- tenant isolation
- proof integrity
- production storage
- downstream enforcement
- safe retry loop
- supply chain
- operations readiness
- non-claims boundary

## Repository Evidence

Repository evidence references are intentionally refs, not copied blobs.

Current kinds:

- `security-policy`
- `license`
- `release-notes`
- `openapi-contract`
- `ci-verify`
- `codeql`
- `dependency-review`
- `supply-chain-baseline`
- `architecture-doc`
- `external-reference`
- `custom-reference`

The required baseline refs for the packet are security policy, license, CI verify, CodeQL, dependency review, and supply-chain baseline. Missing refs become findings, not hidden assumptions.

## Data Posture

The packet is redacted by construction.

It may expose:

- reason codes
- counts
- digests
- timestamps
- tenant and environment scope
- consequence domain
- surface digest
- artifact references
- approval state
- status

It must not expose raw prompts, tool payloads, customer identifiers, payment data, wallet material, credentials, raw evidence documents, raw database rows, private policy thresholds, idempotency keys, replay keys, downstream responses, or provider error bodies.

This makes the packet safe to hand to a reviewer without turning the review process into a data leak.

## Non-Claims

Boundary: repository-side or evaluation evidence only: not production readiness,
customer deployment proof, customer no-bypass proof, native connector or live
integration coverage, compliance certification, or automatic policy activation.
Domain-specific authority still needs separate live proof.

Those are different review outcomes. The packet helps the reviewer reach them; it does not assert them.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceExternalReviewPacket(...)`
- `consequenceExternalReviewPacketDescriptor()`

The descriptor exposes focus areas, evidence kinds, evidence statuses, finding kinds, alignment refs, and non-claims. It also binds to the shared data minimization policy.

## Relationship To Audit Evidence

The packet requires an audit evidence export.

If a business risk dashboard is supplied, its `sourceAuditExportDigest` must match the audit evidence digest. This keeps the reviewer chain from drifting:

```text
audit export digest == dashboard source digest == external packet source digest
```

Repository and runtime evidence are attached as explicit references. If they are missing, pending, or not claimed, the packet says that directly.

## Findings

The packet currently emits these finding kinds:

- `audit-evidence-not-review-ready`
- `raw-payload-blocker`
- `business-risk-dashboard-missing`
- `production-storage-not-ready`
- `required-repository-evidence-missing`
- `external-review-required`
- `redacted-review-packet-ready`

`external-review-required` is always present because this is a handoff artifact. It is not the reviewer result.

## Research Posture

This shape follows current external-review and secure-development practice:

- NIST SSDF emphasizes producing and preserving evidence that secure development practices were followed.
- OWASP ASVS frames verification as scoped requirements that reviewers can assess against an application boundary.
- OpenSSF Scorecard treats repository health and supply-chain posture as reviewable project signals.

For Attestor, that means the packet should organize the review path, expose missing evidence, and avoid overstating maturity.

## Boundary

The packet does not approve policy, activate enforcement, sign releases, prove customer-side deployment, replace penetration testing, or satisfy a regulator on its own.

It is a reviewer-friendly map of what Attestor can prove today, what is missing, and what still needs independent review.
