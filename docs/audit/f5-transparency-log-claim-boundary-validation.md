# F5 Transparency Log Claim Boundary Validation

Status: F5-A6 accepted limitation.

This note validates the scoped F5-A6 decision from the project-owner supplied
signing-layer redo. It is not a certification and does not implement a public
transparency log.

## Research Basis

- [Sigstore Rekor](https://docs.sigstore.dev/logging/overview/) provides the
  signature-transparency role in Sigstore and is a queryable transparency log
  for signed supply-chain metadata.
- [Sigstore security model](https://docs.sigstore.dev/about/security/) ties
  short-lived Fulcio certificates and Rekor transparency-log checks to the
  verifier's ability to confirm that an artifact was signed while the
  certificate was valid.
- [Sigstore threat model](https://docs.sigstore.dev/about/threat-model/)
  explicitly treats Rekor monitoring and consistency checks as part of the
  public witness model.
- [SLSA v1.2 artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts)
  treats provenance verification as a verifier-side responsibility against
  expectations and roots of trust.

## Repository Reality

Current Attestor signing provides:

- Ed25519 certificate signatures
- PKI chain binding
- out-of-band CA pinning for third-party trust
- revocation input support
- local/internal release-enforcement transparency receipts

Current Attestor signing does not provide:

- Rekor integration
- TUF root distribution
- public append-only witness log
- external timestamp authority
- public monitor/auditor inclusion proofs

## Decision

F5-A6 is not fixed by pretending the internal receipt layer is a public
transparency log. It is closed as an accepted limitation and claim boundary:

- do not claim Rekor-equivalent witness semantics
- do not claim public transparency-log immutability
- do not claim external timestamp authority coverage
- keep internal transparency receipts described as internal receipts
- track any actual public witness / SCITT / Rekor-like implementation as a
  separate future architecture item

## Validation

- `npm run test:f5-transparency-log-claim-boundary-validation`
- `npm run test:audit-remediation-tracker`
