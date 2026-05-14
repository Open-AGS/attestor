# F5 Signing Layer Validation

This document validates the project-owner supplied F5 signing-layer audit excerpt against current repository evidence. It is not a certification, not an independent external audit, and not a claim of full production readiness.

## Audit Run Header

```text
Audit ID: F5-signing-layer-validation
Audit title: Cryptographic signing, PKI trust binding, and verification surface validation
Mode: remediation
Target ref: origin/master at branch creation
Date: 2026-05-13
Reviewer: Codex
Threat model / framework: Sigstore-inspired trust-root review, SLSA verification expectations, NIST key-management anchors, RFC 8785 canonicalization comparison
Research anchors: Sigstore threat model; Sigstore security/architecture docs; SLSA v1.0 verifying artifacts; NIST SP 800-57 Part 1 Rev. 5; RFC 8785
Scope: src/signing, /api/v1/verify, release-signing provider diagnostics, file-backed PKI persistence notes
Out of scope: external KMS/HSM implementation, public transparency log implementation, full RFC 8785 migration
Known limitations: repository evidence only; no live HSM, TUF, Rekor, or multi-region deployment probe was run
```

## Validated Finding Status

| ID | Status | Severity | Validation result |
|---|---|---:|---|
| F-5.1 leaf validity rounding | disputed as stated | high | Current `src/signing/keyless-signer.ts` uses `issueLeafCertificateForDuration(... leafValidityMinutes * 60 * 1000)`, and `src/signing/signing.test.ts` asserts sub-day validity. |
| F-5.3 attestation certificate validity | disputed as stated | medium-high | Current `AttestationCertificate` includes `notBefore` and `notAfter`; `verifyCertificate` checks validity with clock skew. |
| F-5.4 certificate revocation inputs | disputed as stated | medium | Current `verifyCertificate` and `verifyTrustChain` accept revoked certificate IDs and fingerprints. |
| F-5.5 trust-chain clock skew | disputed as stated | low-medium | Current `verifyTrustChain` uses `clockSkewMs` with 60s default. |
| F-5.6 anti-self-attest primitive | refined | high | Low-level `verifyCertificate` has `expectedFingerprint`, but the CLI and `/api/v1/verify` needed stronger PKI-bound overall semantics. This PR fixes that slice. |
| F-5.2 file persistence durability | accepted limitation | medium | `writeTextFileAtomic` uses temp file, exclusive open, file fsync, and rename. Parent-directory fsync and startup orphan sweep remain backlog. |
| F-5.7 HA shared PKI | accepted limitation | high | File-backed PKI and local lock are documented as not production-ready when external KMS/HSM is required. External KMS still fails closed as not implemented. |
| F5-A1 out-of-band trust root | remediated in follow-up | high | Kit-contained CA material proves chain integrity only. Follow-up validation now requires an out-of-band trusted CA fingerprint by default and reserves kit-contained-root checks for explicit developer mode. |
| F5-A2 legacy flat verify escape | accepted limitation | medium | Legacy CLI/API escape hatches remain for compatibility and are explicitly deprecated. |
| F5-A3 truncated fingerprint length | accepted limitation | medium | Fingerprints remain 16 hex chars; widening is backlog because it affects public identifiers and fixtures. |
| F5-A4 homegrown canonicalization | accepted limitation | medium | Signing uses repository canonical JSON, not RFC 8785 JCS. Interop with external sigstore/in-toto verifiers is not claimed. |
| F5-A6 transparency log missing | accepted limitation | medium | No transparency log exists yet. Do not claim Rekor-equivalent witness semantics. |

## Remediation Slice In This PR

### F5-R1 - PKI Bound Verification Controls Overall

```text
ID: F5-R1
Title: PKI-bound verification must control CLI/API overall success
Audit run: F5-signing-layer-validation
Status: fixed in this branch, pending merge verification
Severity: high
Protected principle: proof integrity; release provenance; no overclaim
Trust surface: signing verification CLI and /api/v1/verify
Source: project-owner supplied F5 audit excerpt, validated against current code
Exact file/path: src/signing/verification-trust-binding.ts; src/signing/verify-cli.ts; src/service/http/routes/pipeline-verification-routes.ts
Observed behavior: PKI details were returned, but successful certificate signature verification could still surface as overall valid even when PKI binding failed.
Expected behavior: PKI verification path must mark the result invalid unless certificate signature, chain validity, leaf binding, and optional CA pin all match.
Risk: a verifier can over-read a flat valid signature as fully PKI verified when the chain binding is broken.
Validation evidence: targeted tests in tests/pipeline-verification-routes.test.ts and src/signing/signing.test.ts.
Research anchors for fix: Sigstore trust-root model; SLSA artifact verification guidance; NIST SP 800-57 key lifecycle guidance.
Smallest safe fix: central PKI trust-binding helper and route/CLI use of the helper for overall decisions.
Regression test or probe: npm run test:pipeline-verification-routes; npm run test:signing
Remaining limitation: legacy flat verification remains a separate deprecated escape hatch tracked under F5-A2.
```

## Remaining Backlog

- External KMS/HSM signer implementation remains not implemented and must continue to fail closed.
- Parent-directory fsync and startup orphan sweep for file-backed critical stores remain durability hardening.
- Full transparency-log or witness model is not implemented.
- Fingerprint width migration is backlog because it is a compatibility-affecting identity change.
- RFC 8785/JCS interoperability is not claimed until signing canonicalization is migrated or formally documented as Attestor-specific.
