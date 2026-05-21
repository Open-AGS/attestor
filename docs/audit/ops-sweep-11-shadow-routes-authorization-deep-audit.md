# Ops Sweep 11 - Shadow Routes Authorization Deep Audit

Status: audit report plus narrow OPS-93 / OPS-94 repo-side remediation. No live
proof captured. No production-readiness claim.

## 0. Recent Fixes Chain-Effect Check

Source of truth before this branch:
`origin/master @ 765b2518257cdd69dc1293937588ba211cfb8b76`.

Two remediation PRs had landed since Sweep 10:

- PR #516 closed the Sweep 09 P1 account-route findings repo-side
  (`OPS-79`, `OPS-80`) and added account/federated live proof gates.
- PR #517 closed the Sweep 10 P1 pipeline idempotency finding repo-side
  (`OPS-86`) and added the pipeline idempotency live proof gate.

Chain-effect verdict: neither PR touched
`src/service/http/routes/shadow-routes.ts`, the shadow persistence stores, or
shadow route tests. Sweep 11 starts from a clean shadow-scope precondition.

## 1. Validation Frame

| Field | Value |
|---|---|
| Source HEAD | `origin/master @ 765b2518257cdd69dc1293937588ba211cfb8b76` |
| Branch evidence | `codex/ops-sweep-11-shadow-routes` |
| Phase | Phase 1 - Live Shadow Readiness |
| Protected principles | tenant isolation; data minimization and redaction; auditability; replay and idempotency safety; fail-closed boundary; operational boundedness; no overclaim |
| Audit driver | Phase 1 required tests: tenant mismatch, dashboard/proof artifact privacy review, replay |
| Scope | `src/service/http/routes/shadow-routes.ts`, shadow route deps/runtime wiring, hosted API authorization matrix, direct HTTP route tests, live proof register/gate |

External anchors used as implementation references:

- OWASP API Security Top 10 2023 API1/API3/API4 for object authorization,
  object property authorization, and resource consumption:
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>.
- OWASP Top 10 for LLM Applications 2025 LLM02 for sensitive information
  disclosure in LLM-enabled surfaces:
  <https://genai.owasp.org/llm-top-10/>.
- NIST SP 800-92 for log management planning and audit-trail discipline:
  <https://csrc.nist.gov/pubs/sp/800/92/final>.
- RFC 9457, which obsoletes RFC 7807, for problem-details error response
  shape: <https://www.rfc-editor.org/rfc/rfc9457>.

These anchors support the implementation shape only. They are not compliance,
production-readiness, or certification claims.

## 2. Inspected Files

| Path | Depth | Why |
|---|---|---|
| `src/service/http/routes/shadow-routes.ts` | full route inventory + remediation diff | 27 shadow routes, tenant binding, mutation audit, body validation |
| `src/service/bootstrap/routes.ts` | targeted | runtime `createShadowRouteDeps` wiring |
| `src/service/admin-audit-log.ts` | targeted | hash-linked ledger actor/action union |
| `src/service/hosted-api-authorization-matrix.ts` | targeted | shadow mutation rule evidence |
| `scripts/check-ops-live-shadow-readiness.mjs` | targeted | live proof gate alignment |
| `tests/service-shadow-routes-http.test.ts` | full | new direct HTTP route coverage |
| `tests/shadow-route-tenant-boundary.test.ts` | full existing coverage | tenant boundary regression guard |
| `docs/audit/{finding-index,report-index,control-map,live-proof-register,current-posture-baseline}.md` | targeted | index and no-overclaim alignment |

## 3. Finding Disposition

| ID | Intake state | Validation result | Remediation |
|---|---|---|---|
| OPS-93 shadow mutation audit chain gap | P1 open | repo-proven | Closed repo-side / live-proof-only. Shadow POST/PATCH routes now call a redacted mutation-audit hook, and runtime wiring writes `tenant_context` actor records through `appendAdminAuditRecordState`. Live shared-store chain proof remains required. |
| OPS-94 shadow route HTTP-layer test coverage gap | P1 open / partial-repo | repo-proven | Closed. `tests/service-shadow-routes-http.test.ts` exercises all 27 registered shadow routes, cache-control, successful mutation audit emission, missing-store fail-closed behavior, and JSON rejection paths. |
| OPS-95 shadow mutation idempotency | P2 open / partial-repo | still open | Not remediated. The matrix still declares `service_defined`; store-side dedupe needs a dedicated sub-sweep before replay-safety claims. |
| OPS-96 shadow POST/PATCH rate-limit gap | P2 open / partial-repo | still open | Not remediated. Heavy shadow POST/PATCH routes still need a per-tenant rate-limit primitive and live proof gate. |
| OPS-97 shadow GET listings lack pagination | P2 open / partial-repo | still open | Not remediated. List routes still need bounded `limit` / cursor contracts. |
| OPS-98 shadow content-type mismatch returns 400 instead of 415 | P3 open / partial-repo | still open | Not remediated. Existing behavior remains locked as fail-closed but not convention-aligned. |
| OPS-99 shadow error message redaction | P3 open / partial-repo | still open | Not remediated. Central problem-detail redaction remains paired with pipeline OPS-90. |

## 4. Remediation Summary

Repository changes:

- Extended `AdminAuditRecord.actorType` with `tenant_context`.
- Added shadow-specific `AdminAuditAction` values for simulation recording,
  policy-candidate materialization/status transitions, downstream proof,
  activation readiness, customer activation handoff, and receipt recording.
- Added `ShadowMutationAuditInput` and a route-level audit hook in
  `shadow-routes.ts`.
- Wired `createShadowRouteDeps` to write redacted hash-linked audit records via
  `appendAdminAuditRecordState`.
- Added `ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF` to the live-shadow gate
  and `LP-SHADOW-MUTATION-AUDIT-CHAIN` to the live proof register.
- Added direct HTTP route coverage for all 27 shadow routes.

Audit records keep tenant actor/source, route id, request hash, bounded ids,
digests, counts, statuses, and storage mode. They do not store raw customer
markers, raw feature markers, raw payloads, prompts, provider bodies, or
private thresholds.

## 5. Shadow Route Coverage

| Route family | Count | Repo-side state after this sweep |
|---|---:|---|
| Shadow read/dashboard/proof artifact routes | 18 | Tenant-bound via `assertTenantBoundRecord(s)`, `cache-control: no-store`, no production readiness claim. |
| Shadow simulation, policy-candidate, downstream proof, activation, handoff, receipt, and status mutations | 8 | Tenant-bound, fail-closed on missing stores or invalid JSON, and now audited when successful. |
| Receipt lookup/list routes | 2 | Tenant-bound, direct HTTP route coverage added. |

The direct test file exercises 27 / 27 registered routes. This is repository
HTTP-layer evidence, not live deployment proof.

## 6. Authority Boundary

How this strengthens the single Attestor consequence boundary:

- It adds a forensic trail to shadow mutations that can influence operator
  readiness packets and customer activation evidence.
- It keeps tenant identity bound to the upstream tenant middleware and the
  route-layer `assertTenantBoundRecord(s)` invariant.
- It improves regression coverage on the dashboard/proof-artifact surface
  without granting any new authority.

What it does not have authority to do:

- The audit record cannot approve, activate, or enforce a policy.
- The audit record cannot weaken tenant checks, evidence requirements, or
  human approval requirements.
- The audit hook is evidence only; it does not become a policy writer or a
  second consequence engine.

## 7. Chain Effects

| Surface | Effect |
|---|---|
| Direct regression | Successful shadow POST/PATCH routes now await audit emission when the hook is configured. Runtime wiring configures the hook. |
| Audit ledger schema | `AdminAuditRecord.actorType` now includes `tenant_context`; existing admin, account, and Stripe webhook actors remain valid. |
| Privacy / redaction | Audit metadata is bounded to ids, digests, statuses, counts, and storage mode; request payloads are hashed by runtime wiring. |
| Live proof | New live proof flag is required before claiming deployed shared-store shadow mutation audit-chain integrity. |
| Remaining gaps | Rate limiting, pagination, service-defined idempotency verification, and generic problem-detail redaction remain open follow-ups. |

## 8. Verification

Local checks run for this branch:

- `npm run test:service-shadow-routes-http`
- `npm run test:shadow-route-tenant-boundary`
- `npm run typecheck`

Broader checks are tracked in the PR/merge checkpoint. Tier 4 `npm run verify`
is not claimed by this report.

## 9. Remaining No-Claims

- No live proof was captured.
- No production, limited-enforcement, enterprise-readiness, compliance, or
  full security posture claim is made.
- No claim that shadow mutation idempotency is closed; OPS-95 remains open.
- No claim that shadow POST/PATCH rate limiting is closed; OPS-96 remains open.
- No claim that shadow list pagination is closed; OPS-97 remains open.
- No claim that all shadow problem details are redacted; OPS-99 remains open.
- No claim that the deployed audit chain is cross-instance verified until
  `ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF` is captured.

## 10. Verdict

- OPS-93: closed repo-side / live-proof-only.
- OPS-94: closed.
- OPS-95: open / partial-repo.
- OPS-96: open / partial-repo.
- OPS-97: open / partial-repo.
- OPS-98: open / partial-repo.
- OPS-99: open / partial-repo.

Recommended next target: Sweep 12 on `release-review-routes.ts` plus
`release-policy-control-routes.ts`, the release-decision-side counterpart to
the shadow consequence-observation surface.
