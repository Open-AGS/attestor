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
| F-5.2 file persistence durability | partial | medium | `writeTextFileAtomic` uses target-local secure temp directories, exclusive open, file fsync, rename, and matching orphan-temp cleanup. Parent-directory fsync remains an explicit limitation; multi-host shared-filesystem locking remains tracked separately under F-5.7. |
| F-5.7 HA shared PKI | accepted limitation | high | File-backed PKI and local lock are documented as not production-ready when external KMS/HSM is required. External KMS still fails closed as not implemented. |
| F5-A1 out-of-band trust root | remediated in follow-up | high | Kit-contained CA material proves chain integrity only. Follow-up validation now requires an out-of-band trusted CA fingerprint by default and reserves kit-contained-root checks for explicit developer mode. |
| F5-A2 legacy flat verify escape | remediated in follow-up | medium | Env-var legacy downgrades were removed. CLI legacy flat verification remains only as explicit `--allow-legacy-verify`. |
| F5-A3 truncated fingerprint length | remediated in follow-up | medium | Signing key identity fingerprints now use 32 hex chars / 128-bit truncated SHA-256. Historical compact evidence IDs and already-issued artifacts are not widened by this scoped fix. |
| F5-A4 homegrown canonicalization | accepted limitation | medium | Signing uses versioned, strict Attestor-specific canonical JSON, not RFC 8785 JCS. Interop with external sigstore/in-toto/JCS verifiers is not claimed. |
| F5-A5 non-atomic key persistence | remediated in follow-up | medium | `saveKeyPair` now persists private and public key PEM files through the same atomic file helper, including temp-file writes, fsync before rename, and best-effort parent-directory fsync. |
| F5-A8 numeric canonicalization edge cases | remediated in follow-up | low | Signing canonicalization now rejects `NaN`, `Infinity`, and other lossy JSON values before signing. |
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
Remaining limitation: legacy flat verification remains only as an explicit CLI flag for intentionally checking legacy kits.
```

## Remaining Backlog

- External KMS/HSM signer implementation remains not implemented and must continue to fail closed.
- Parent-directory fsync remains a documented limitation for file-backed critical stores.
- Multi-host/shared-filesystem locking remains separate F-5.7 hardening.
- Full transparency-log or witness model is not implemented.
- Signing key fingerprint width is remediated in follow-up; historical artifacts with older compact fingerprints remain historical evidence.
- RFC 8785/JCS interoperability is formally documented as not claimed; signing canonicalization is Attestor-specific and fail-fast for lossy JSON values.
