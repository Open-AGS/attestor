# Consequence Core Validation

Status: repository-side validation intake for consequence-core hardening.

Source HEAD: `8cd3b642df08e138556a90507253152dbe3ea66d`.

This report validates consequence-core claims against current repository
evidence and primary sources. Unsupported claims remain labeled as
`not proven`, `contradicted`, or `design-hypothesis`.

## Validation Frame

Protected principles: tenant isolation, proof integrity, replay and idempotency
safety, customer authority, no overclaim.

Primary external anchor: [PostgreSQL row-security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
states that table owners normally bypass row security unless the table is
forced with `ALTER TABLE ... FORCE ROW LEVEL SECURITY`; superusers and
`BYPASSRLS` roles still bypass RLS.

## Finding Validation

### 1. Lower-Risk Enforcement Authenticity

Validation: `partial-repo`.

Repository evidence:
`customer-gate.ts` and `downstream-enforcement-contract.ts` use
presence-based proof checks on the base helper/contract path.
`protected-enforcement-profile.ts` sends high-risk or production-sensitive paths
to the release-enforcement plane. Existing docs state that the
release-enforcement plane is the cryptographic path.

Action: no broad contract rewrite in this slice. Keep the base helper as
non-cryptographic; do not claim production enforcement without
release-enforcement/customer PEP proof.

### 2. Null-Tenant Shadow Dashboard Events

Validation: `partial-repo`, remediated in this slice.

Repository evidence:
`safeShadowSummary` passed `allowNullTenantId: true`, so a miswired dependency
could feed `tenantId: null` events into tenant dashboard/review artifacts. The
file-backed store itself still filters by store record tenant.

Action: removed the dashboard/review allowance and added a route regression test
for missing tenant events.

### 3. Explicit Tenant Binding In Handoff Layers

Validation: `partial-repo`.

Repository evidence:
Admission digests include `request.policyScope.tenantId`, so tenant scope is
indirectly bound when callers use the canonical admission object. The in-memory
presentation replay ledger indexes by replay-key digest only, while the
service-layer shared atomic store uses `tenant_scope_digest + replay_key_digest`.

Action: no broad v1 contract break in this slice. Keep shared-store and
release-enforcement tenant proof gaps visible.

### 4. Presentation Replay Retention

Validation: `repo-proven / live-proof-only`.

Repository evidence:
The descriptor says default store is `in-memory-reference` and
`productionSharedStoreRuntimeWired: false`; the ledger prunes entries after
`retainedUntil`. The live proof register already tracks shared replay/store
proof gaps.

Action: clarified replay single-use wording as retention-window scoped. Live
shared replay proof remains required.

### 5. Sample RLS Owner Bypass

Validation: `repo-proven` and `source-backed`.

Repository evidence:
`tenant-rls.ts` is documented as sample/probe substrate, not main control-plane
RLS. The sample tables used `ENABLE ROW LEVEL SECURITY`; PostgreSQL docs
confirm owner bypass without `FORCE`.

Action: added `FORCE ROW LEVEL SECURITY`, force-on-existing-policy activation,
explicit tenant predicate, and locking test coverage.

### 6. Base Customer Gate `requireProof: false`

Validation: `repo-proven / accepted boundary`.

Repository evidence:
The base helper records `customer-gate-proof-skipped-by-caller`; tracker F10-E2
marks that telemetry gap fixed while downstream enforcement remains
customer-owned unless protected wrappers are used.

Action: no behavior change in this slice. Do not use this helper as a production
enforcement proof.

### 7. Raw Tenant Header Parser

Validation: `contradicted` as an exploit claim.

Repository evidence:
`currentTenant` and `currentAccountAccess` check `hasVerifiedTenantContext`
before parsing. Existing F6 bypass tests cover spoofed bypass-route headers and
sanitized protected-route headers. The raw parser is a lower-level helper.

Action: no code change. Keep callers on `currentTenant` / `currentAccountAccess`
for authority.

## Remaining Boundaries

- Customer PEP no-bypass proof remains live-proof-only.
- Shared replay/introspection store behavior remains live-proof-only.
- Live tenant shared-store/RLS isolation remains live-proof-only.
- The RLS helper remains sample/probe substrate; this slice does not wire the
  main control-plane stores through PostgreSQL RLS.
- Production readiness is not proven.

## Checks

Run the targeted checks listed in the PR body for the remediation slice. Full
`npm run verify` is not required for this narrow docs/route/RLS-helper slice.
