# Admission Proof and RLS Boundary Validation - 2026-06-01

## Recent Fixes Chain-Effect Check

- Current source of truth: `origin/master` at
  `da306b5c8551d05c1e894e64e5b50faabaa582ba`.
- Recent relevant chain: customer middleware example gate hardening and finance
  admission trust-guard parity.
- Direct regression checked before implementation: the customer middleware gate
  already rejects receipt-only execution proof; this slice therefore targets the
  shared downstream contract and shared PostgreSQL store schemas.
- Cross-fix interaction checked: finance admission guard behavior remains in the
  admission projection, while this slice tightens execution proof and shared
  store tenant isolation depth.

## Validation Frame

Scope: downstream execution proof semantics, consequence shared atomic stores,
and consequence shared history/outbox stores.

Protected principles:

- fail-closed boundary
- customer authority
- proof integrity
- tenant isolation
- replay and idempotency safety
- auditability
- no overclaim

External anchors:

- PostgreSQL row security documentation: table owners normally bypass RLS unless
  `FORCE ROW LEVEL SECURITY` is set; superusers and roles with `BYPASSRLS`
  still bypass RLS:
  <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>.
- PostgreSQL `CREATE POLICY` documentation: RLS policies apply only when row
  security is enabled, and a missing applicable policy is default deny:
  <https://www.postgresql.org/docs/current/sql-createpolicy.html>.
- OWASP Authorization Cheat Sheet: deny by default and validate authorization on
  every request:
  <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>.

These anchors support the repository hardening direction. They are not
certifications and do not prove live deployment posture.

## Inspected Files

- `src/consequence-admission/customer-gate.ts`
- `src/consequence-admission/downstream-enforcement-contract.ts`
- `src/consequence-admission/generic-engine.ts`
- `src/service/consequence-shared-atomic-stores.ts`
- `src/service/consequence-shared-history-outbox-store.ts`
- `tests/consequence-admission-customer-gate.test.ts`
- `tests/downstream-enforcement-contract.test.ts`
- `tests/consequence-shared-atomic-stores.test.ts`
- `tests/consequence-shared-history-outbox-store.test.ts`
- `tests/consequence-admission-proof-discipline.test.ts`
- `tests/local-consequence-shared-store-rehearsal.test.ts`
- `docs/02-architecture/downstream-enforcement-contract.md`
- `docs/02-architecture/consequence-shared-atomic-stores.md`
- `docs/02-architecture/consequence-shared-history-outbox-store.md`
- `docs/audit/current-posture-baseline.md`
- `docs/audit/finding-index.md`
- `docs/audit/live-proof-register.md`
- `docs/audit/control-map.md`

## Findings

| Finding | State | Evidence | Remediation |
|---|---|---|---|
| OPS-215 downstream execution proof receipt-only gap | closed repo-side / live-proof-only | The base customer gate already excludes `admission-receipt` from execution proof, so that part of the incoming finding is contradicted by current repo evidence. The shared downstream enforcement contract still treated any non-empty proof array as proof-satisfied, so a receipt-only executable admission could pass the shared contract. | The downstream enforcement contract now filters out `admission-receipt` before satisfying execution proof. Receipt-only executable admissions hold with `proof-missing`; stronger proof refs still satisfy the contract when the other bindings match. |
| OPS-216 consequence shared-store table-owner RLS forcing | closed repo-side / live-proof-only | The shared atomic store and shared history/outbox store already used tenant-scope digests, tenant-scoped indexes, transaction-local tenant scope, and explicit tenant predicates, but `rlsForced` was false and the DDL did not force RLS for table owners. | Both shared store schemas now apply `FORCE ROW LEVEL SECURITY`, expose `rlsForced: true`, and keep the superuser/`BYPASSRLS` and live deployment no-claims explicit. |

## Chain Reactions

- The downstream contract now matches the customer gate: an Attestor-generated
  admission receipt can prove that Attestor produced a response, but it is not
  enough by itself to prove downstream execution authority.
- The shared store schemas now add database-level defense-in-depth for table
  owners while retaining explicit tenant predicates and tenant-scope indexes.
- This does not change the generic admission response `allowed` calculation.
  A response-level admission receipt can still exist; downstream execution must
  satisfy the separate execution-proof contract.
- This does not wire production runtime cutover to the shared stores and does
  not prove live database role posture.

## Verification

Passed locally before PR:

- `npm run test:downstream-enforcement-contract`
- `npm run test:consequence-shared-atomic-stores`
- `npm run test:consequence-shared-history-outbox-store`
- `npm run test:consequence-admission-proof-discipline`
- `npm run test:local-consequence-shared-store-rehearsal`
- `npm run test:security-evidence-system`
- `npm run test:audit-finding-evidence`
- `npm run test:audit-finding-test-coverage`
- `npm run test:baseline-alignment-contract`
- `npm run check:baseline-alignment`
- `npm run test:first-impression-path`
- `npm run test:product-positioning-docs`
- `npm run test:how-to-integrate-attestor-docs`
- `npm run test:repository-navigator-docs`
- `npm run typecheck`
- `npm run typecheck:hygiene`
- `git diff --check`

## Remaining Boundary

This is repo-side hardening only.

It does not prove live customer PEP no-bypass, release-token verification in a
customer deployment, sender-bound presentation in production, shared-store
runtime cutover, deployed non-superuser/non-`BYPASSRLS` app-role posture,
customer-operated PostgreSQL posture, backup/restore, production readiness, or
enterprise readiness.

## Verdict

The scoped repo-side proof/RLS findings are closed by this slice once the PR is
merged and checks are green.

Live proof still required: yes.

Production readiness proven: no.

Enterprise readiness proven: no.

Next target: capture live customer PEP no-bypass and shared-store deployment
proof before stronger enforcement or multi-instance claims.
