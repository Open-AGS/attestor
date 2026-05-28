# Audit ID Alias Registry

Status: canonical mapping for legacy audit labels and repository remediation IDs.

This registry prevents historical labels such as `Round N` from becoming the
primary finding identity. Historical labels remain searchable, but new
remediation, verification, and closure records should use the canonical ID.

This is repository-side audit governance only. It is not an external audit, not
certification, and not production readiness.

## ID Pattern

| Type | Pattern | Meaning |
|---|---|---|
| Finding | `AUD-YYYY-AREA-SURFACE-NNN` | Canonical audit finding or accepted limitation |
| Remediation | `REM-YYYY-AREA-SURFACE-NNN` | Code, docs, config, or process remediation record |
| Verification | `VER-YYYY-AREA-SURFACE-NNN` | Re-audit or closure verification evidence |

## Area Codes

| Code | Scope |
|---|---|
| `GOV` | Governance, PR contract, branch, audit lifecycle |
| `SVC` | Hosted service layer |
| `ENF` | Release enforcement plane |
| `DEC` | Consequence-admission decision layer |
| `POL` | Release policy control plane |
| `REL` | Release provenance, package, CI, supply chain |
| `OPS` | Deployment, Kubernetes, runtime operations |

## Current Mappings

| Legacy label | Canonical ID | Type | Scope | Status | Evidence |
|---|---|---|---|---|---|
| R20 B-064 | `AUD-2026-SVC-MFA-001` | finding | MFA secret key separation | closed | PR #497, merge `fa19314b` |
| R20 B-064 remediation | `REM-2026-SVC-MFA-001` | remediation | MFA deployment-doc key-boundary correction | closed | `docs/08-deployment/deployment.md` |
| R21 B-074 | `AUD-2026-SVC-OIDC-001` | finding | Hosted OIDC discovery cache TTL | closed | PR #498, merge `a3fb83fb` |
| R21 B-074 remediation | `REM-2026-SVC-OIDC-001` | remediation | TTL-bounded hosted OIDC discovery cache | closed | `src/service/account/account-oidc.ts`; `tests/account-oidc-discovery-cache.test.ts` |
| R22 B-075 | `AUD-2026-SVC-USERSTORE-001` | accepted limitation | Hosted account user file-backed store | accepted-limitation | `src/service/account/account-user-store.ts`; `docs/audit/AUD-2026-SVC-USERSTORE-001.md` |
| R23 B-076 | `AUD-2026-POL-BUNDLESIGN-001` | accepted limitation | Policy bundle signer holds PEM private key in process memory | accepted-limitation | `src/release-policy-control-plane/bundle-signing.ts`; `docs/audit/AUD-2026-POL-BUNDLESIGN-001.md` |
| R24 B-077 | `AUD-2026-POL-APPROVALSTORE-001` | accepted limitation | Policy activation approval store path is operator-controlled | accepted-limitation | `src/release-policy-control-plane/activation-approvals.ts`; `docs/audit/AUD-2026-POL-APPROVALSTORE-001.md` |
| R24 B-078 | `AUD-2026-POL-APPROVALTTL-001` | finding | Approval default TTL not risk-class-aware | fixed | `src/release-policy-control-plane/activation-approvals.ts`; `docs/audit/REM-2026-POL-APPROVALTTL-001.md` |
| R24 B-078 remediation | `REM-2026-POL-APPROVALTTL-001` | remediation | Risk-class-aware default approval expiry | fixed | `tests/release-policy-control-plane-activation-approvals.test.ts` |
| R24 B-079 | `AUD-2026-POL-DIGEST-001` | finding | Locale-sensitive key sort in policy approval and audit digests | fixed | `src/release-policy-control-plane/activation-approvals.ts`; `src/release-policy-control-plane/audit-log.ts`; `docs/audit/REM-2026-POL-DIGEST-001.md` |
| R24 B-079 remediation | `REM-2026-POL-DIGEST-001` | remediation | Locale-independent policy control-plane digest ordering | fixed | `tests/release-policy-control-plane-activation-approvals.test.ts`; `tests/release-policy-control-plane-audit-log.test.ts` |
| R26 B-081 | `AUD-2026-POL-SCOPING-001` | finding | Locale-sensitive policy scope precedence tiebreak | fixed | `src/release-policy-control-plane/scoping.ts`; `docs/audit/REM-2026-POL-SCOPING-001.md` |
| R26 B-081 remediation | `REM-2026-POL-SCOPING-001` | remediation | Locale-independent policy scope precedence and fail-closed ambiguity | fixed | `tests/release-policy-control-plane-scoping.test.ts` |

## Rules

- Use canonical IDs in new PR titles, PR bodies, audit docs, test names, and
  remediation records.
- Use legacy labels only when mapping historical evidence.
- Do not rename merged historical PRs or commits solely to change legacy labels;
  preserve audit chain integrity through this registry instead.
- Do not include auditor or model names in PR titles or bodies. Refer to
  `external audit report`, `validated finding`, or the canonical ID.
