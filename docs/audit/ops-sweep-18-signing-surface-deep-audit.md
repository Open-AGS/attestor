# Ops Sweep 18 - Signing Surface Deep Audit

Status: read-only audit. No remediation was written in this sweep. No signing
primitive, KMS adapter, test file, workflow, live-proof gate, or source file was
changed by this report.

Remediation follow-up: OPS-141 and OPS-146 are now repo-side closed by
`src/signing/keyless-signer.ts` production-like runtime guards and
`tests/f5-keyless-ca-injection-boundary-validation.test.ts`. OPS-142 remains an
accepted Phase 2 limitation for external KMS/HSM runtime signing, and OPS-145
remains a low-priority signing test layout follow-up.

This is the first engine-substrate sweep after the route, ops, governance,
redaction, and meta-audit chain covered by Sweeps 01-17.

## 0. Recent Fixes Chain-Effect Check

One merge landed on `origin/master` after Sweep 17 was drafted:

- PR #524 / commit `5663147c` - "Add Sweep 17 test adequacy audit"
- merge head `1c6092332eb9bf98fc1c4eb4d5b9c3178a955db6`

Files changed by PR #524 were docs-only:

- `docs/audit/ops-sweep-17-test-adequacy-meta-audit.md`
- `docs/audit/control-map.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/finding-index.md`
- `docs/audit/report-index.md`

Chain-effect verdict: PR #524 does not touch `src/signing/**`,
`src/service/bootstrap/gcp-kms-release-signer.ts`,
`src/service/bootstrap/release-tenant-signer-boundary.ts`,
`src/service/bootstrap/release-signing-provider.ts`, signing-related tests, or
any signing source. No regression, config drift, defense-in-depth weakening, or
closed-finding reopening was found in Sweep 18 scope.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source of truth HEAD | `origin/master @ 1c6092332eb9bf98fc1c4eb4d5b9c3178a955db6` |
| Phase | Phase 1 - Live Shadow Readiness; intersects Phase 2 - Limited Live Enforcement |
| Baseline blocker in scope | P0 `External KMS/HSM runtime signing` and proof/signature/key authority posture |
| Protected principles | proof integrity; key authority; release provenance; auditability; fail-closed boundary; no overclaim |
| Audit driver | `current-posture-baseline.md` Phase 1/2 transition + signing layer dependency behind `/api/v1/verify`, release evidence, and KMS runtime proof |
| External anchors | RFC 8032; RFC 8410; RFC 8785; SLSA v1.0 Build track; Sigstore/Fulcio pattern; in-toto/DSSE vocabulary; CWE-321, CWE-345, CWE-296, CWE-298, CWE-322 |
| Scope | `src/signing/{keys,sign,certificate,pki-chain,keyless-signer,bundle,verification-trust-binding,reviewer-endorsement,multi-query-certificate,multi-query-reviewer,verify-cli,index}.ts`; `src/service/bootstrap/{gcp-kms-release-signer,release-tenant-signer-boundary,release-signing-provider}.ts`; signing-related tests |

External anchors are used as control vocabulary only. This report does not
claim RFC, SLSA, Sigstore, in-toto, DSSE, or CWE certification.

## 2. Inspected Files

| File / path | Depth | Why selected |
|---|---|---|
| `src/signing/keys.ts` | full | Ed25519 key generation and SPKI-DER fingerprinting |
| `src/signing/sign.ts` | full | Native Ed25519 sign/verify and strict canonical JSON |
| `src/signing/certificate.ts` | targeted full-path | Certificate schema, verification, legacy unbounded mode, sunset warning |
| `src/signing/pki-chain.ts` | targeted full-path | CA + leaf trust-chain verification |
| `src/signing/keyless-signer.ts` | full | Sigstore-inspired keyless signer and CA singleton |
| `src/signing/verification-trust-binding.ts` | full | PKI-bound certificate verifier |
| `src/service/bootstrap/gcp-kms-release-signer.ts` | targeted | GCP KMS adapter contract for the P0 KMS gap |
| `src/signing/signing.test.ts` | targeted | Primary signing primitive coverage |
| Signing-related tests under `tests/` | inventory | Additional KMS, release-signing, bundle-signing, and boundary coverage |

## 3. Skipped Files

| File / path | Why skipped | Risk |
|---|---|---|
| Full `src/signing/bundle.ts` body | Bundle composition is downstream of audited primitives; inventoried but not line-by-line audited here | low |
| Reviewer and multi-query signing variants | Reuse the same sign/cert/chain primitives | low |
| `src/signing/verify-cli.ts` body | CLI wrapper over `verifyPkiBoundCertificate` | low |
| Full `gcp-kms-release-signer.ts` body after the adapter contract | Actual KMS roundtrip should be a dedicated runtime-wiring audit before Phase 2 | medium |

No critical primitive-layer file was skipped.

## 4. Positive Observations

| ID | Observation | Why it matters |
|---|---|---|
| OPS18-POS-01 | Ed25519 signing uses Node native `crypto.sign(null, ...)`; `null` is the correct no-extra-hash mode for Ed25519 in Node. | No external crypto dependency or unintended hash layer. |
| OPS18-POS-02 | `verifySignature` catches malformed signatures, invalid hex, and key-shape errors and returns `false`. | Verification fails closed. |
| OPS18-POS-03 | Canonical JSON is strict and Attestor-specific: it rejects undefined, functions, symbols, bigint, custom objects, NaN, and Infinity before signing. | Deterministic bytes without lossy `JSON.stringify` behavior. |
| OPS18-POS-04 | Fingerprint derives from SPKI DER and is truncated to 128-bit / 32 hex chars. | Fingerprint material is canonicalized before hashing. |
| OPS18-POS-05 | Private key save uses `0o600`, public key save uses `0o644`. | File-mode defaults respect private key material. |
| OPS18-POS-06 | Certificate verification rejects schema mismatch, unsupported algorithm, missing identity, missing signature, and missing bounded validity unless explicit legacy mode is enabled. | Schema gates run before successful verification. |
| OPS18-POS-07 | `verifyCertificate` requires `publicKeyPem` from the caller and explicitly warns not to derive trust from `certificate.signing.publicKey`. | Certificates cannot self-vouch. |
| OPS18-POS-08 | Certificate verification handles clock skew, `notBefore`, `notAfter`, certificate ID revocation, and fingerprint revocation. | Expiry and revocation surfaces are first-class. |
| OPS18-POS-09 | Legacy unbounded certificate support is opt-in, emits a structured warning, and carries a sunset timestamp. | Backward compatibility is visible rather than silent. |
| OPS18-POS-10 | Trust-chain verification performs CA self-signature, CA fingerprint, CA expiry, leaf signature, issuer-fingerprint link, and leaf expiry checks. | Chain validation is not collapsed into a single signature check. |
| OPS18-POS-11 | `verifyPkiBoundCertificate` enforces signer key, certificate fingerprint, trust-chain leaf, and trusted CA pin binding. | The `/api/v1/verify` route depends on a real composite trust check. |
| OPS18-POS-12 | `configureReleaseRuntimeKeylessCa` validates CA certificate type, `isCA`, public key, and fingerprint against the supplied key pair. | Runtime CA injection has structural validation. |
| OPS18-POS-13 | CA replacement requires both `allowReplace: true` and a non-empty `replacementReason`. | CA rotation cannot silently swap trust roots. |
| OPS18-POS-14 | `resetKeylessCaForTesting` requires a non-empty reason. | Test escape hatch is at least intentional at call site. |
| OPS18-POS-15 | GCP KMS adapter contract declares `activatesRuntimeSigning: false`, no raw provider response storage, no raw payload storage, no raw access token storage, and native `EC_SIGN_ED25519`. | External KMS is contract-ready but not runtime-claimed. |
| OPS18-POS-16 | `src/signing/signing.test.ts` covers sign/verify, tamper rejection, canonicalization rejection cases, certificate verification, PKI chain tamper cases, OIDC identity, and domain-pack certificate paths. | Primitive regression coverage includes adversarial cases. |
| OPS18-POS-17 | Additional tests cover KMS/HSM provider decisions, GCP KMS adapter contract, production release signing provider behavior, release-policy bundle signing, and F7 signing-boundary validation. | Signing behavior is covered beyond one primitive file. |

## 5. Findings

| ID | Severity | State | Title | Evidence | Recommended next action |
|---|---:|---|---|---|---|
| OPS-141 | P1 | `open` | Keyless CA lazily auto-generates when no release-runtime CA has been configured. In production-like runtime, this can silently create a new trust root per process/restart if bootstrap misses `configureReleaseRuntimeKeylessCa`. | `src/signing/keyless-signer.ts` `getOrCreateCa` creates a CA when `cachedCa` is null; no production-like fail-closed gate is present. | Make CA auto-generation fail closed in production-like runtime, with an explicit dev/test override if needed. |
| OPS-142 | P2 | `accepted limitation` | GCP KMS adapter is contract-ready but not runtime-wired. | `GcpKmsReleaseTenantSignerConfig.activatesRuntimeSigning` is literally `false`; tests cover the adapter contract, not an end-to-end KMS-issued artifact reaching downstream verification. | Keep as Phase 1 limitation; close during Phase 2 with operator opt-in, live KMS roundtrip, and verifier acceptance proof. |
| OPS-143 | P2 | `open / partial-repo` | Signing evidence wording is too broad and can blur two different surfaces: DSSE/in-toto-shaped release evidence exists elsewhere, while the `src/signing/*` certificate/trust-chain primitive is Attestor-specific canonical JSON and not DSSE/in-toto interoperable. | `src/release-kernel/release-evidence-pack.ts`, `src/release-policy-control-plane/bundle-signing.ts`, and tests use DSSE/in-toto shapes; `src/signing/sign.ts` and `certificate.ts` explicitly use Attestor-specific canonical JSON and describe SLSA/in-toto/Sigstore as inspiration. | Tighten docs to distinguish release evidence bundles from the signing primitive; avoid implying `src/signing/*` is a DSSE/in-toto signer. |
| OPS-144 | P2 | `accepted limitation` | Legacy unbounded certificate sunset is declared but not CI-asserted. | `LEGACY_UNBOUNDED_CERTIFICATE_SUNSET_AT = '2026-12-31T23:59:59.999Z'`; current tests validate the warning, not a future sunset fail/warn policy. | Add a sunset-window test before Phase 2 or before the sunset approaches. |
| OPS-145 | P3 | `open / partial-repo` | Primary signing test is co-located under `src/signing/signing.test.ts` while most suite tests live in `tests/`. | Test exists and passes by package script convention, but layout is inconsistent for a critical primitive. | Move/rename to `tests/signing-primitives.test.ts` when touching signing tests next. |
| OPS-146 | P3 | `open / partial-repo` | `resetKeylessCaForTesting` is reason-gated but not production-runtime-gated. | Function only requires a non-empty `testOnlyReason`; a buggy production bootstrap could call it with a string. | Add a production-like runtime check mirroring existing fail-closed patterns. |

## 6. Signing Surface Matrix

| # | Artifact | Kind | Entry point / role | Finding |
|---:|---|---|---|---|
| 1 | `src/signing/keys.ts` | primitive | `generateKeyPair`, `derivePublicKeyIdentity` | none new |
| 2 | `src/signing/sign.ts` | primitive | `signPayload`, `verifySignature`, `canonicalize` | OPS-143 wording boundary |
| 3 | `src/signing/certificate.ts` | certificate | `issueCertificate`, `verifyCertificate` | OPS-143, OPS-144 |
| 4 | `src/signing/pki-chain.ts` | trust chain | `verifyTrustChain`, `generatePkiHierarchy` | OPS-144 |
| 5 | `src/signing/keyless-signer.ts` | signer | `createKeylessSigner`, `configureReleaseRuntimeKeylessCa` | OPS-141, OPS-146 |
| 6 | `src/signing/verification-trust-binding.ts` | binding verifier | `verifyPkiBoundCertificate` | none new |
| 7 | `src/signing/bundle.ts` | bundle | authority bundle / verification kit builders | inventoried |
| 8 | reviewer and multi-query signing files | cert variants | reviewer + multi-query paths | inventoried |
| 9 | `src/signing/verify-cli.ts` | CLI | wrapper over PKI-bound verifier | none new |
| 10 | `src/service/bootstrap/gcp-kms-release-signer.ts` | adapter | GCP KMS signer probe contract | OPS-142 |
| 11 | `src/signing/signing.test.ts` | test | primitive test suite | OPS-145 |
| 12 | signing-related `tests/*.test.ts` files | tests | KMS, release signing, bundle signing, boundary validation | none new |

Coverage: the primitive layer was line-verified. Downstream release evidence
and policy bundle DSSE paths were inventoried to avoid an overbroad OPS-143
claim, but they are not fully audited in this sweep.

## 7. Signing Surface Verification

| Question | Verdict |
|---|---|
| Is Ed25519 native and fail-closed on verifier errors? | repo-proven |
| Is canonicalization strict and explicitly not RFC 8785/JCS interoperable? | repo-proven |
| Is the fingerprint over SPKI DER? | repo-proven |
| Does certificate verification use caller-supplied trusted public key material instead of self-asserted certificate key material? | repo-proven |
| Does trust-chain verification check CA, leaf, issuer link, expiry, and revocation? | repo-proven |
| Does PKI-bound certificate verification require trusted CA pinning or explicit developer-mode kit-contained CA? | repo-proven |
| Does keyless CA auto-generation fail closed in production-like runtime? | gap - OPS-141 |
| Is `resetKeylessCaForTesting` blocked in production-like runtime? | gap - OPS-146 |
| Is GCP KMS runtime signing actually activated? | accepted limitation - OPS-142 |
| Are release evidence DSSE/in-toto paths present elsewhere in the repo? | repo-proven, but outside primitive-layer deep audit |

## 8. Index Integration Notes

This PR integrates report and index state only. It intentionally does not add
`LP-KEYLESS-CA-CONFIGURED` or modify `LP-KMS-RUNTIME-SIGNING`; those live-proof
changes should land with OPS-141/142 remediation once a repo gate or runtime
path exists.

Index updates in this PR:

- add OPS-141 through OPS-146 to `finding-index.md`;
- add the OPS-SWEEP-18 row to `report-index.md`;
- update `control-map.md` proof/signing authority wording;
- refresh `current-posture-baseline.md` for the new HEAD and signing-surface
  state.

## 9. Verdict

- Sweep 18 report completeness: complete for a read-only signing-surface audit.
- Repo-proven P0 surfaced: no.
- Repo-proven P1 surfaced: yes, OPS-141.
- Remediation required: yes for OPS-141 before stronger live-shadow/keyless CA
  claims; OPS-142 remains the Phase 2 KMS runtime-signing path.
- Next locked target: small OPS-141/143/146 remediation PR, or a larger
  Phase 2 KMS runtime-signing PR if the operator is ready to wire live KMS.

No production signing claim: Ed25519/PKI primitives are repo-proven; external
KMS/HSM runtime signing remains `needs ops proof`.
