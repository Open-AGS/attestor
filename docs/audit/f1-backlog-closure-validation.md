# F1 Backlog Closure Validation

Status: repository-side closure pass for F1-CC-3, F1-CC-4, and F1-CC-6.

This validation closes the remaining F1 backlog rows as explicit repository
posture. It does not claim production replay protection across every customer
workflow, mandatory conformance for every future output surface, external WORM
storage, SIEM retention, or independent compliance evidence.

## Scope

The closure pass covers three F1 cross-cutting findings:

| ID | Final tracker posture | Why |
|---|---|---|
| F1-CC-3 cross-vector replay correlation | `backlog` | Attestor has replay placement, retry-attempt ledger, presentation replay ledger, release-enforcement replay semantics, admin idempotency, and webhook dedupe patterns. It does not yet have one cross-vector replay correlation bus across every replay/idempotency vector. |
| F1-CC-4 data-minimization fan-out | `backlog` | Attestor has a central data-minimization redaction policy, material scanner, prompt-leakage markers, and many surface tests. It does not yet enforce a mandatory conformance gate over every declared and future output constructor. |
| F1-CC-6 cross-log integrity anchor | `accepted-limitation` | Attestor has evaluation-grade tamper-evident history that links digest-first entries over time. It is not an external transparency log, WORM archive, SIEM, or cross-store meta-anchor for every store. |

## Repository Evidence

### Replay Correlation

Current repo evidence:

- `docs/02-architecture/replay-layer-placement.md` defines replay surfaces and
  explicitly avoids production-readiness claims.
- `docs/02-architecture/retry-attempt-ledger.md` defines idempotent retry
  recording and a shared-store contract.
- `docs/02-architecture/presentation-replay-ledger.md` defines single-use
  replay consumption at the customer enforcement boundary and a shared-store
  contract.
- Release-enforcement, admin mutation, Stripe webhook, account MFA, and crypto
  execution surfaces have their own replay/idempotency controls.

Remaining backlog:

Attestor still needs a common digest-only replay correlation event if the
project wants one view across webhook dedupe, admin idempotency, retry attempts,
presentation replay, release-token consumption, crypto nonce/freshness, and
downstream receipts. Until that exists, do not claim universal cross-vector
replay correlation.

### Data-Minimization Fan-Out

Current repo evidence:

- `CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS` declares 34 surface kinds.
- `evaluateConsequenceDataMinimizationArtifact(...)` can run the central
  material scanner when material is supplied.
- The scanner covers runtime secret markers and prompt-leakage markers.
- Existing validation docs close F4-LLM02-A and F4-LLM07-A for the central
  scanner and prompt-leakage marker coverage.

Remaining backlog:

Future surface constructors can still drift unless every new surface must prove
data-minimization conformance in a shared test. The next deeper fix would be an
`assertDataMinimizedSurface(...)` helper plus a generated coverage test over
all declared surface kinds and exported surface constructors.

### Cross-Log Integrity

Current repo evidence:

- `docs/02-architecture/tamper-evident-history.md` documents an
  evaluation-grade linear hash chain.
- `consequenceTamperEvidentHistoryDescriptor()` reports raw-payload-free
  digest-first entries, no Merkle transparency log, and no external
  immutability claim.
- `createConsequenceAuditEvidenceExport(...)` can bind a tamper-evident history
  export into audit evidence.

Accepted limitation:

The current history layer detects modification, deletion, reordering, tenant
scope mismatch, and environment scope mismatch inside the history contract. It
does not replace external anchoring, WORM storage, SIEM retention, signed
append-only infrastructure, or production log-management operations.

## Research Anchors

- NIST SP 800-92 frames log management as infrastructure plus operational
  process, not only local log writes:
  <https://csrc.nist.gov/pubs/sp/800/92/final>
- OWASP Logging Cheat Sheet covers log integrity, monitoring, safe content,
  testing, and protection of logs:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Stripe idempotency guidance is the practical retry/idempotency model for
  preventing duplicate side effects:
  <https://docs.stripe.com/api/idempotent_requests>
- RFC 9162 Certificate Transparency Version 2 is a public append-only log model.
  Attestor does not claim this model for consequence tamper-evident history:
  <https://datatracker.ietf.org/doc/html/rfc9162>

## Validation

Run:

```bash
npm run test:f1-backlog-closure-validation
npm run test:audit-remediation-tracker
```

The tests verify that the tracker no longer leaves these items as unqualified
stale backlog, that current replay/data-minimization/tamper-history evidence is
present, and that no production or external-audit overclaim is introduced.
