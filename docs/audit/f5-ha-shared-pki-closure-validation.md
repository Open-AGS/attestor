# F5 HA Shared PKI Closure Validation

Status: F-5.7 partial closure; F5-NEW-2 fixed.

This note validates the scoped production-shared PKI hardening for the
project-owner supplied F5 signing-layer redo. It is not a certification and does
not claim KMS/HSM readiness or multi-host file-lock correctness.

## Finding

F5-NEW-2 identified that strict release-runtime PKI path enforcement was opt-in.
`production-shared` could reach the release-runtime bootstrap without an
explicit shared PKI path and without `ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH=true`.

F-5.7 remains broader: the file-backed PKI lock is still local/mkdir-style and
is not a distributed shared-filesystem lock.

## Resolution

`production-shared` now implicitly requires a shared release-runtime PKI path.

Runtime behavior:

- normal `production-shared` runtime requires an explicit
  `ATTESTOR_RELEASE_RUNTIME_PKI_PATH`
- the path must be attested with `ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH=true`
- production-shared preflight may still start for diagnostics, but it uses only
  ephemeral PKI, sets `pkiReady=false`, and does not create the default local
  `.attestor/release-runtime-pki.json`
- attested shared-path preflight uses file-backed PKI and records
  `sharedPathRequired=true` and `sharedPathAttested=true`

## Remaining Boundary

This does not implement a distributed PKI file lock and does not make local PEM
material production-grade. External KMS/HSM remains a separate production
promotion blocker. F-5.7 is therefore narrowed but not fully closed.

## Validation

- `npm run test:f5-ha-shared-pki-closure-validation`
- `npm run test:production-shared-preflight-bootstrap`
- `npm run test:production-release-signing-provider`
- `npm run test:audit-remediation-tracker`
