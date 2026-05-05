# Tamper-Evident History

Tamper-evident history is the append-only proof trail for Attestor's action-authorization path.

It is an evaluation-grade linear hash chain, not a public transparency log, blockchain, WORM archive, external immutable store, or compliance certificate.

The history answers one control question:

```text
Can this reviewer packet prove that the evidence sequence was not modified, deleted, or reordered after it was recorded?
```

## Why It Exists

Shadow events, policy simulations, retry attempts, presentation replay consumption, downstream execution receipts, audit evidence exports, and dashboard summaries all carry useful digests. A reviewer still needs a single history shape that links those digests over time.

The history adds that link:

```text
source artifact digest
  -> entry payload digest
  -> entry digest
  -> root digest
  -> exported verification summary
```

Every new entry points to the previous entry digest and previous root digest. If a record is changed, removed, or moved, verification fails closed with a structured reason code.

## Entry Sources

Current history entry kinds:

- `shadow-admission-event`
- `shadow-simulation`
- `policy-discovery-candidates`
- `policy-promotion-packet`
- `downstream-integration-proof`
- `retry-attempt`
- `presentation-replay`
- `downstream-execution-receipt`
- `audit-evidence-export`
- `business-risk-dashboard`
- `custom-artifact`

The entry stores ids, digests, timestamps, tenant/environment scope, reason codes, and artifact refs. It does not store raw prompts, raw tool payloads, customer identifiers, bank/payment data, wallet material, private policy thresholds, raw replay keys, raw idempotency keys, downstream response bodies, or error bodies.

## Verification

Verification recomputes:

- sequence continuity
- previous entry digest
- previous root digest
- entry payload digest
- entry digest
- root digest
- tenant scope
- environment scope

Failures are explicit:

- `sequence-gap`
- `previous-entry-digest-mismatch`
- `previous-root-digest-mismatch`
- `entry-payload-digest-mismatch`
- `entry-digest-mismatch`
- `root-digest-mismatch`
- `tenant-scope-mismatch`
- `environment-scope-mismatch`

The verifier does not repair the chain. It returns a fail-closed verification result that can be handed to a reviewer.

## Package Surface

The package surface is exported through `attestor/consequence-admission`.

Core functions:

- `createConsequenceTamperEvidentHistoryLedger(...)`
- `verifyConsequenceTamperEvidentHistoryEntries(...)`
- `consequenceTamperEvidentHistoryDescriptor()`

The reference implementation is in-memory and evaluation-oriented. Production deployments should back the same entry contract with shared durable storage and operational controls.

## Audit Evidence Binding

`createConsequenceAuditEvidenceExport(...)` can carry a `tamperEvidentHistory` export. The audit packet then references the history artifact by digest and records the history entry count.

This makes the reviewer packet stronger without making a false claim:

- history exists
- history verifies
- root digest is exported
- raw payload storage is still false
- compliance is still not claimed
- external immutability is still not claimed

## Research Posture

This shape follows three constraints from the current research pass:

- NIST SP 800-92 frames log management as infrastructure and process, not just local file writes.
- OWASP logging guidance calls for tamper detection, restricted log access, safe export, and testing logging failures.
- RFC 9162 shows the value of append-only verification and consistency checks, but Attestor does not claim to implement Certificate Transparency or Merkle consistency proofs in this evaluation module.

## Boundary

Tamper-evident history does not:

- approve policy candidates
- activate enforcement
- replace a SIEM, WORM store, transparency log, or external archive
- prove compliance
- sign entries
- provide external anchoring
- make local in-memory state production durable

It gives Attestor a digest-first history layer that can show when the evidence trail was altered. The stronger production path is shared durable storage, access control, retention policy, external anchoring/signing where required, and reviewer-operable export.
