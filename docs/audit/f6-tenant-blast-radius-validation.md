# F6 Tenant Blast Radius Validation

Status: validation slice for the project-owner supplied F6 report, updated as
subsequent F6 remediation slices land.

This document classifies the F6 report against current `origin/master` before
implementation. It is not a production-readiness claim, not a SOC 2 / ISO
evidence packet, and not a statement that every multi-tenant control is active.

## Scope

F6 covers request-level tenant identity, database isolation claims, shared
runtime signing material, tenant API key handling, quota storage, bypass-route
tenant context, anonymous fallback behavior, and recipient/tenant boundary
coverage.

Repository baseline inspected:

- `src/service/tenant-isolation.ts`
- `src/service/tenant-rls.ts`
- `src/service/control-plane-store.ts`
- `src/service/usage-meter.ts`
- `src/service/bootstrap/production-storage-path.ts`
- `src/service/bootstrap/runtime-profile.ts`
- `src/service/bootstrap/release-runtime.ts`
- `src/release-kernel/object-model.ts`
- `src/service/http/routes/generic-admission-routes.ts`
- `src/consequence-admission/recipient-tenant-boundary-replay.ts`
- `src/consequence-admission/recipient-tenant-boundary-runtime.ts`
- relevant tests and deployment docs listed below

Primary research anchors:

- OWASP API Security Top 10 2023: BOLA, broken authentication, unrestricted
  resource consumption, and security misconfiguration.
- PostgreSQL Row-Level Security documentation: row policies are enforced by the
  database only for queries run under an active role/session context.
- NIST SP 800-53 Rev. 5: access enforcement and information-flow enforcement
  are control objectives, not claims satisfied by an unused helper.
- NIST SP 800-57 Part 1 Rev. 5: key compromise blast radius and rotation scope
  matter for key-management architecture.

## Validation Summary

| F6 ID | Report claim | Current classification | Evidence | Remaining work |
|---|---|---|---|---|
| F6-T1 | Shared PKI means `tenantId` is not cryptographically bound. | `partial` | Runtime PKI and release-token issuer are runtime-wide in `src/service/bootstrap/release-runtime.ts`. Release-token claims now carry first-class `tenant_id` and verification can compare expected tenant. Generic admission tenant spoofing is stale: `src/service/http/routes/generic-admission-routes.ts` overwrites or rejects mismatched `tenantId`. A tenant signer boundary contract now defines the per-tenant external KMS/HSM shape, fake adapter, no-raw-material evidence, structured digest-only live provider proof gate, and provider-native algorithm/input-mode capability checks. | Wire a live per-tenant leaf signer or KMS/HSM tenant-scoped signer adapter before claiming cryptographic signer isolation. |
| F6-T2 | RLS infrastructure is declared but not wired into data paths. | `accepted-limitation` | `src/service/tenant-rls.ts` defines `withTenantTransaction` and sample/probe RLS tables. `src/service/runtime/rls-runtime.ts` only auto-activates that helper path. Main control-plane stores use `src/service/control-plane-store.ts`, not `withTenantTransaction`. Deployment docs now avoid claiming that `ATTESTOR_PG_URL` moves main stores onto RLS. | Real store RLS integration remains a future storage-isolation project. |
| F6-T3 | Env tenant key registry is per-pod in-memory and can go stale. | `partial` | `src/service/tenant-isolation.ts` keeps env keys as hashed lookup material, tracks cache age/expiry, and refuses env tenant keys in `production-shared`. Shared file/PG-backed tenant-key lookup exists through `findActiveTenantKeyState`. | Env keys remain per-pod outside production-shared; shared deployments must use shared control-plane tenant key state. |
| F6-T4 | Usage-meter quota enforcement is single-node/per-pod. | `partial` | `src/service/usage-meter.ts` is explicitly single-node and now exposes `usageMeterStorageDescriptor()`. Current API runtime uses `getUsageContextState` and `consumePipelineRunState`; `src/service/control-plane-store.ts` switches those to PostgreSQL when `ATTESTOR_CONTROL_PLANE_PG_URL` is configured. The claim boundary now distinguishes the single-node file ledger from the shared PostgreSQL control-plane usage ledger. | External production PostgreSQL deployment, migration, backup/restore, and live quota behavior remain deployment proof, not repository proof. |
| F6-T5 | Bypass routes can accept client-supplied tenant headers. | `fixed` | Non-bypass tenant middleware overwrites `x-attestor-tenant-id`. Admin routes use `currentAdminAuthorized` and do not depend on `currentTenant`. F6 Bypass Route Tenant Context Invariant now also clears spoofed internal tenant/account headers on bypass routes and makes request-context helpers require a middleware-written verified marker. | No remaining repository action for this scoped finding. |
| F6-T6 | Compromise of runtime signer affects all tenants. | `partial` | Tenant-bound release-token claims narrow token reuse, but runtime signer and release-token verification key are still shared runtime material. Revoking that signer is runtime-wide. The tenant signer boundary contract proves the desired external signer contract, fake KMS mismatch behavior, structured proof gate that refuses bare `liveProviderVerified` booleans, and provider capability mapping that fails closed for unsupported provider/algorithm pairs. It does not replace the runtime signer. | Wire a live per-tenant leaf signer or KMS/HSM tenant-scoped signer adapter before claiming signer-compromise blast-radius isolation. |
| F6-T7 | Anonymous fallback is env-gated, not profile-gated. | `invalid-as-stated` | `tenant-isolation-production-guard.test.ts` proves anonymous fallback is rejected for `NODE_ENV=production`, `ATTESTOR_HA_MODE`, and public-hosted flags. `runtime-profile.ts` requires explicit `ATTESTOR_RUNTIME_PROFILE` for production-like envs. | Sentinel naming is closed under F6-T10. |
| F6-T8 | Recipient/tenant boundary replay is not runtime enforcement. | `partial` | F6 Recipient/Tenant Runtime Boundary Bridge; `evaluateConsequenceRecipientTenantRuntimeBoundary`; `failure-mode-guard-coverage.ts`; `test:f6-recipient-tenant-runtime-boundary`. Replay-only coverage is now bridged into a deterministic runtime decision surface. | Wire hosted dashboards, exports, review packets, downstream senders, and customer gateways to the runtime bridge or equivalent checks before claiming universal output enforcement. |
| F6-T9 | Env tenant API keys are stored plaintext in memory. | `fixed` | `tenant-isolation.ts` stores env-loaded API keys by `tenant.api-key` lookup hash and stores only a secret-derived config digest for reload detection. File/PG-backed tenant keys are also hashed via `tenant-key-store.ts` / control-plane store. | No remaining repository action for this scoped finding. |
| F6-T10 | `default` tenant fallback can collide with real tenants. | `fixed` | `tenant-isolation.ts` exports `ANONYMOUS_TENANT_ID = "__attestor_anonymous__"` and `isAnonymousTenantContext`. Anonymous fallback and missing headers use the reserved sentinel. Legacy anonymous `default` headers normalize to the sentinel, while `api_key` tenant id `default` remains a real tenant. | No remaining repository action for this scoped finding. |

## Corrected F6 Queue

The F6 report remains important, but it must be remediated in smaller,
verified slices. The current queue is eight PR-sized units:

1. F6 validation and tracker sync. Done.
2. Tenant-bound release-token/admission semantics for F6-T1/F6-T6. Done for token semantics, tenant signer boundary contract, structured live-proof gate, and provider-native algorithm/input-mode capability checks; live per-tenant signer isolation remains partial until a real provider adapter is wired.
3. Env tenant API key cache hardening for F6-T3/F6-T9. Done for hashed lookup and production-shared env-key refusal; cross-pod env revocation remains partial.
4. Anonymous tenant sentinel and fallback hardening for F6-T7/F6-T10. Done.
5. Bypass-route tenant-context invariant for F6-T5. Done.
6. RLS/data-path claim alignment or real store integration for F6-T2. Done as claim alignment; real store wiring remains future work.
7. Usage-meter shared-store claim boundary for F6-T4. Done as claim boundary; live shared quota proof remains deployment work.
8. Recipient/tenant runtime boundary bridge for F6-T8. Done as repository bridge; surface-by-surface enforcement adoption remains integration work.

F6-T9 and F6-T10 are fixed by later remediation slices. Other F6 items remain
fixed, invalid-as-stated, or partial as shown in the tracker.

## Go / No-Go

Go for remediation: yes.

Do not claim:

- Attestor is cryptographically tenant-isolated end to end.
- The sample RLS helper protects the main control-plane data path.
- File-backed usage metering is multi-node safe.
- Recipient/tenant runtime bridge adoption is universal across all hosted and
  downstream output surfaces.

Allowed claim:

- Current master has request-level tenant identity, generic-admission tenant
  mismatch rejection, shared control-plane store support, production-shared
  storage diagnostics, concrete route-level tenant tests, and a central
  recipient/tenant runtime boundary bridge.

