# F5 Canonicalization Validation

Status: F5-A8 fixed; F5-A4 accepted limitation.

This document validates the scoped F5-A4 / F5-A8 remediation. It is not a
certification, not a claim of RFC 8785 interoperability, and not a production
readiness claim.

## Scope

This slice covers the signing canonicalizer used by:

- attestation certificates
- PKI CA and leaf certificates
- reviewer endorsements
- multi-query certificates and reviewer endorsements

## Repository Change

`src/signing/sign.ts` now exposes:

```text
ATTESTOR_SIGNING_CANONICALIZATION_SPEC_VERSION = attestor.signing-canonical-json.v1
```

The signing canonicalizer now:

- sorts object keys recursively
- emits compact JSON without whitespace
- rejects non-finite numbers (`NaN`, `Infinity`, `-Infinity`)
- rejects `undefined`, functions, symbols, bigint values, and custom object
  instances before signing

This closes the lossy JSON behavior where `JSON.stringify` can convert
non-finite numbers to `null` or silently drop unsupported object values.

## Claim Boundary

Attestor signing canonicalization is intentionally documented as
Attestor-specific canonical JSON. It follows the same fail-fast principle as the
release-kernel canonicalization layer, but it does not claim full RFC 8785/JCS
interoperability with external sigstore, in-toto, or JCS verifiers.

F5-A4 is therefore resolved as an accepted limitation: interoperability is not
claimed. F5-A8 is fixed: lossy numeric canonicalization is rejected.

## Validation

Run:

```bash
npm run test:f5-canonicalization-validation
npm run test:signing
```

The targeted test proves:

- semantically equivalent key orderings produce identical signed bytes
- signatures verify across reordered but equivalent objects
- `NaN` and `Infinity` are rejected
- `undefined`, `bigint`, and custom objects are rejected
- tracker status distinguishes F5-A4 accepted limitation from F5-A8 fixed

## Research Anchors

- RFC 8785: JSON Canonicalization Scheme.
- RFC 7493: I-JSON constraints for interoperable JSON, including avoiding
  non-finite numeric values.

