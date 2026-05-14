# F5 File Durability And Key Atomicity Validation

Status: partial.

This document validates the scoped F-5.2 / F5-A5 remediation. It is not a
certification, not a cross-host filesystem safety claim, and not a production
HA claim.

## Scope

This slice covers local filesystem durability for repository-managed file
stores and signing key persistence:

- `writeTextFileAtomic(...)`
- target-scoped atomic-write orphan cleanup
- parent-directory fsync best-effort reporting
- `saveKeyPair(...)`

It does not close the F-5.7 multi-host/shared-filesystem lock finding.

## Repository Change

`src/platform/file-store.ts` now:

- writes through exclusive temp files inside a target-directory-local
  `mkdtempSync(...)` temp directory
- fsyncs the temp file before rename
- renames into place
- reports `directoryFsynced: false` instead of claiming parent-directory fsync
- removes prior matching atomic-write temp files for the same target before a
  new write

`src/signing/keys.ts` now routes `saveKeyPair(...)` through
`writeTextFileAtomic(...)` instead of direct `writeFileSync(...)` calls. Private
keys request `0600` and public keys request `0644` where POSIX file modes are
enforceable.

## Claim Boundary

Parent-directory fsync is best-effort because platform behavior differs,
especially on Windows and some network filesystems. This slice does not
implement parent-directory fsync because the portable Node path conflicts with
the repository's required CodeQL temporary-file gate when file-store tests use
OS temp directories. Attestor therefore keeps parent-directory fsync as an
explicit limitation instead of silently claiming it.

This does not make local mkdir locks safe across NFS, SMB, FUSE, EFS, or
multi-host shared filesystems. That remains F-5.7.

## Validation

Run:

```bash
npm run test:f5-file-store-key-atomicity-validation
npm run test:file-store-race-hardening
npm run test:signing
```

The targeted test proves:

- orphan temp files matching the target path are swept
- unrelated temp-like files are not removed
- parent-directory fsync is not claimed
- signing key material is persisted through the atomic helper
- `saveKeyPair(...)` no longer writes key PEMs through direct `writeFileSync`

## Research Anchors

- Node.js `fs` documentation for `openSync`, `fsyncSync`, and `renameSync`.
- POSIX-style durability guidance: durable rename requires both file fsync and
  parent-directory persistence where supported by the filesystem.
