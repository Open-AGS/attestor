# F5 Fingerprint Width Validation

Status: fixed.

This document validates the scoped F5-A3 remediation. It is not a certification,
not a production-readiness claim, and not a claim that every compact hash or
identifier in the repository was widened.

## Scope

F5-A3 applied to signing key identity fingerprints:

- `AttestorKeyPair.fingerprint`
- `derivePublicKeyIdentity(...).fingerprint`
- certificate signer fingerprints derived from those identities
- PKI CA and leaf fingerprints derived from those identities

It does not apply to compact evidence IDs, database schema fingerprints,
certificate IDs, audit-entry IDs, or UI/log display abbreviations that are not
used as signer identity trust anchors.

## Repository Change

`src/signing/keys.ts` now centralizes signing key fingerprint width:

```text
ATTESTOR_SIGNING_FINGERPRINT_HEX_LENGTH = 32
ATTESTOR_SIGNING_FINGERPRINT_SECURITY_BITS = 128
```

Generated and derived Ed25519 public-key identities now use a 128-bit truncated
SHA-256 fingerprint over the SPKI DER public key. In short:
128-bit truncated SHA-256 for signing identity. The prior 16 hex character
fingerprint was 64 bits.

## Validation

The targeted regression test checks:

- generated signing key fingerprints are 32 lowercase hex characters
- derived public-key identities match generated identities
- `src/signing/keys.ts` no longer truncates signing identity fingerprints with
  `.slice(0, 16)`
- the remediation tracker marks F5-A3 as fixed

Run:

```bash
npm run test:f5-fingerprint-width-validation
npm run test:signing
npm run test:pki-trust-binding
npm run test:pipeline-verification-routes
```

## Claim Boundary

This remediation widens signer identity fingerprints. It does not implement a
transparency log, external KMS/HSM signing, RFC 8785 canonicalization, or a
public migration process for already-issued historical artifacts.

Historical artifacts that carry 16 hex fingerprints remain historical evidence.
Newly generated signing identities use 32 hex fingerprints.

## Research Anchors

- NIST SP 800-107 Rev. 1: Recommendation for Applications Using Approved Hash
  Algorithms.
- NIST SP 800-57 Part 1 Rev. 5: Recommendation for Key Management.
