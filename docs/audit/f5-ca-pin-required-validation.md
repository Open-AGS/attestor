# F5 CA Pin Required Validation

Status: `fixed` for the scoped repository finding.

This note validates the F5-A1 finding from the project-owner supplied signing-layer redo:

```text
F5-A1 out-of-band trust root optional
```

## Result

The finding was valid. A kit-contained CA can prove internal chain consistency, but it is not an independent third-party trust root. Repository verification now makes that boundary explicit:

- `verifyPkiBoundCertificate(...)` fails by default when no trusted CA fingerprint is supplied.
- The helper returns `trusted-ca-fingerprint-required` when the CA pin is missing.
- The helper separately reports `independentTrustRootVerified`.
- CLI kit verification fails with `TRUST_ROOT_REQUIRED` unless `--trusted-ca-fingerprint` is supplied.
- CLI `--developer-mode` is the only kit-contained-root bypass and is documented as local chain-integrity only.
- `/api/v1/verify` rejects PKI material that omits `trustedCaFingerprint`.

## Repository Evidence

- `src/signing/verification-trust-binding.ts`
- `src/signing/verify-cli.ts`
- `src/service/http/routes/pipeline-verification-routes.ts`
- `tests/pki-trust-binding.test.ts`
- `tests/pipeline-verification-routes.test.ts`
- `tests/f5-ca-pin-required-validation.test.ts`
- `docs/06-signing/signing-verification.md`

## Control Boundary

This does not add TUF, Rekor, external KMS, or public transparency-log semantics. It closes the repository verifier footgun where a foreign verification kit could be treated as fully trusted using only the CA material shipped inside that same kit.

Legacy flat verification remains a separate F5-A2 item and is not closed by this validation.

## Sources

- Sigstore security architecture and trust-root model: https://docs.sigstore.dev/about/security/
- Sigstore threat model: https://docs.sigstore.dev/about/threat-model/
- SLSA artifact verification guidance: https://slsa.dev/spec/v1.0/verifying-artifacts
