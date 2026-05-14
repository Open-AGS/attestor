# F6 Tenant Key Cache Hardening

Status: repository-side remediation slice for F6-T3 and F6-T9.

This validation hardens the environment-variable tenant API key path. It does
not make environment variables a shared multi-node identity store. Production
shared deployments must use shared control-plane tenant key state.

## Source Finding

F6-T3 identified that the env tenant key registry was module-local and could be
stale across pods. F6-T9 identified that env tenant API keys were stored as raw
`Map` keys in memory.

## Repository Changes

- Env tenant API keys are stored in memory by `tenant.api-key` lookup hash, not
  as plaintext `Map` keys.
- The raw `ATTESTOR_TENANT_KEYS` config is not retained in the cache state; the
  cache keeps a secret-derived config digest for change detection.
- Env tenant key cache state exposes non-secret metadata:
  - key count;
  - lookup material type;
  - loaded and expiry timestamps;
  - cache age;
  - disabled reason.
- The env key cache has a bounded TTL via
  `ATTESTOR_TENANT_KEY_ENV_CACHE_TTL_MS`, defaulting to 30 seconds.
- `ATTESTOR_RUNTIME_PROFILE=production-shared` refuses to load env tenant keys,
  because env keys are per-pod identity state.

## Validation

`npm run test:f6-tenant-key-cache-hardening` verifies:

1. Env keys still resolve valid tenant context.
2. Cache metadata reports hashed lookup material and no plaintext key storage.
3. Manual `registerTenantKey` also resolves through hashed lookup.
4. Production-shared profile does not load env-only tenant keys.
5. Production-shared disabled status is visible without exposing secrets.

## Remaining Boundary

F6-T9 is fixed for the env cache path: raw tenant API keys are no longer used as
in-memory map keys or retained as raw loaded config state.

F6-T3 remains partial. A local env cache can be aged and can fail closed in
production-shared profile, but it is still not a cross-pod revocation fabric.
Shared deployments must use the shared control-plane tenant key store.
