import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPair } from '../src/signing/keys.js';
import { createReleaseDecisionSkeleton } from '../src/release-kernel/object-model.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import {
  createFileBackedReleaseTokenIntrospectionStore,
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
  resetFileBackedReleaseTokenIntrospectionStoreForTests,
  ReleaseTokenIntrospectionStoreError,
} from '../src/release-kernel/release-introspection.js';

let passed = 0;
const POLICY_HASH = 'sha256:policy-runtime-introspection';
const POLICY_IR_HASH = 'sha256:policy-ir-runtime-introspection';

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function makeDecision(id = 'decision-release-introspection') {
  return createReleaseDecisionSkeleton({
    id,
    createdAt: '2026-04-17T23:00:00.000Z',
    status: 'accepted',
    policyVersion: 'finance.structured-record-release.v1',
    policyHash: POLICY_HASH,
    policyProvenance: {
      source: 'compiled-admission-policy-index',
      policyId: 'finance.structured-record-release.v1',
      policySpecVersion: 'attestor.release-policy.v1',
      policyHash: POLICY_HASH,
      compiledPolicyHash: POLICY_HASH,
      compiledPolicyIrHash: POLICY_IR_HASH,
      compiledPolicyIndexVersion: 'attestor.compiled-admission-policy-index.v1',
      compiledPolicyIrVersion: 'attestor.compiled-admission-policy-ir.v1',
      verificationValid: true,
      verificationErrorCodes: [],
      verificationWarningCodes: [],
    },
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: 'financial-reporting.record-field',
      expectedShape: 'structured financial record payload',
      consequenceType: 'record',
      riskClass: 'R4',
    },
    capabilityBoundary: {
      allowedTools: ['xbrl-export'],
      allowedTargets: ['sec.edgar.filing.prepare'],
      allowedDataDomains: ['financial-reporting'],
    },
    requester: {
      id: 'svc.reporting-bot',
      type: 'service',
    },
    target: {
      kind: 'record-store',
      id: 'finance.reporting.record-store',
    },
  });
}

async function main(): Promise<void> {
  const keyPair = generateKeyPair();
  const issuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.local',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
  const verificationKey = await issuer.exportVerificationKey();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision();

  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-17T23:00:00.000Z',
  });
  store.registerIssuedToken({
    issuedToken: issued,
    decision,
  });

  const active = await introspector.introspect({
    token: issued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:01:00.000Z',
    tokenTypeHint: 'attestor_release_token',
    resourceServerId: 'attestor.tests.release-introspection',
  });

  ok(active.active, 'Release introspection: registered high-risk token is active');
  if (active.active) {
    equal(
      active.scope,
      'release:record',
      'Release introspection: active response carries a consequence-specific scope view',
    );
    equal(
      active.decision_id,
      decision.id,
      'Release introspection: active response preserves the decision id',
    );
    equal(
      active.output_hash,
      decision.outputHash,
      'Release introspection: active response preserves the bound output hash',
    );
    equal(
      active.policy_hash,
      POLICY_HASH,
      'Release introspection: active response preserves the policy hash',
    );
    equal(
      active.policy_ir_hash,
      POLICY_IR_HASH,
      'Release introspection: active response preserves the policy IR hash',
    );
    equal(
      active.token_policy.policy_hash,
      POLICY_HASH,
      'Release introspection: active response exposes structured token policy hash',
    );
    equal(
      active.token_policy.policy_version,
      'finance.structured-record-release.v1',
      'Release introspection: active response exposes structured token policy version',
    );
    equal(
      active.token_policy.policy_ir_hash,
      POLICY_IR_HASH,
      'Release introspection: active response exposes structured token policy IR hash',
    );
    equal(
      active.token_policy.policy_provenance_source,
      'compiled-admission-policy-index',
      'Release introspection: active response exposes structured token policy provenance source',
    );
    equal(
      active.token_policy.compiled_policy_index_version,
      'attestor.compiled-admission-policy-index.v1',
      'Release introspection: active response exposes structured compiled policy index version',
    );
    equal(
      active.token_policy.compiled_policy_ir_version,
      'attestor.compiled-admission-policy-ir.v1',
      'Release introspection: active response exposes structured compiled policy IR version',
    );
    equal(
      active.resource_server_id,
      'attestor.tests.release-introspection',
      'Release introspection: resource server id is echoed for audit correlation',
    );
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'attestor-release-token-introspection-'));
  const filePath = join(tempDir, 'release-token-introspection-store.json');
  try {
    const fileStore = createFileBackedReleaseTokenIntrospectionStore(filePath);
    fileStore.registerIssuedToken({
      issuedToken: issued,
      decision,
    });

    const reloadedStore = createFileBackedReleaseTokenIntrospectionStore(filePath);
    equal(
      reloadedStore.findToken(issued.tokenId)?.status ?? null,
      'issued',
      'Release introspection: file-backed store reloads issued token state after restart',
    );

    const fileBackedIntrospector = createReleaseTokenIntrospector(reloadedStore);
    const activeAfterRestart = await fileBackedIntrospector.introspect({
      token: issued.token,
      verificationKey,
      audience: 'finance.reporting.record-store',
      currentDate: '2026-04-17T23:01:00.000Z',
      resourceServerId: 'attestor.tests.release-introspection.file-backed',
    });
    ok(
      activeAfterRestart.active,
      'Release introspection: file-backed store keeps registered tokens active after restart',
    );

    reloadedStore.revokeToken({
      tokenId: issued.tokenId,
      revokedAt: '2026-04-17T23:01:20.000Z',
      reason: 'restart-safe revocation test',
      revokedBy: 'release-introspection-test',
    });
    const revokedReload = createFileBackedReleaseTokenIntrospectionStore(filePath);
    equal(
      revokedReload.findToken(issued.tokenId)?.status ?? null,
      'revoked',
      'Release introspection: file-backed store preserves revoked token state after restart',
    );
    assert.throws(
      () =>
        revokedReload.registerIssuedToken({
          issuedToken: issued,
          decision,
        }),
      ReleaseTokenIntrospectionStoreError,
      'Release introspection: duplicate registration cannot reactivate a revoked token id',
    );
    passed += 1;

    const durableSingleUse = await issuer.issue({
      decision,
      issuedAt: '2026-04-17T23:00:00.000Z',
      tokenId: 'rt_file_backed_single_use_introspection',
    });
    revokedReload.registerIssuedToken({
      issuedToken: durableSingleUse,
      decision,
    });
    revokedReload.recordTokenUse({
      tokenId: durableSingleUse.tokenId,
      usedAt: '2026-04-17T23:01:30.000Z',
      resourceServerId: 'attestor.tests.release-introspection.file-backed',
    });
    const consumedReload = createFileBackedReleaseTokenIntrospectionStore(filePath);
    equal(
      consumedReload.findToken(durableSingleUse.tokenId)?.status ?? null,
      'consumed',
      'Release introspection: file-backed store preserves consumed token state after restart',
    );
    assert.throws(
      () =>
        consumedReload.registerIssuedToken({
          issuedToken: durableSingleUse,
          decision,
        }),
      ReleaseTokenIntrospectionStoreError,
      'Release introspection: duplicate registration cannot reactivate a consumed token id',
    );
    passed += 1;

    writeFileSync(filePath, '{bad json', 'utf8');
    assert.throws(
      () => createFileBackedReleaseTokenIntrospectionStore(filePath),
      ReleaseTokenIntrospectionStoreError,
      'Release introspection: file-backed store fails closed on corrupt persisted token state',
    );
    passed += 1;
  } finally {
    resetFileBackedReleaseTokenIntrospectionStoreForTests(filePath);
    rmSync(tempDir, { recursive: true, force: true });
  }

  const unregistered = await issuer.issue({
    decision,
    issuedAt: '2026-04-17T23:00:00.000Z',
    tokenId: 'rt_unregistered_introspection',
  });
  const inactiveUnregistered = await introspector.introspect({
    token: unregistered.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:01:00.000Z',
  });
  ok(
    inactiveUnregistered.active === false,
    'Release introspection: cryptographically valid but unknown tokens are inactive',
  );

  const singleUseIssued = await issuer.issue({
    decision,
    issuedAt: '2026-04-17T23:00:00.000Z',
    tokenId: 'rt_single_use_introspection',
  });
  store.registerIssuedToken({
    issuedToken: singleUseIssued,
    decision,
  });
  const firstUse = store.recordTokenUse({
    tokenId: singleUseIssued.tokenId,
    usedAt: '2026-04-17T23:01:30.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    firstUse.accepted === true,
    'Release introspection: first token use is accepted into the replay ledger',
  );
  equal(
    firstUse.record?.status ?? null,
    'consumed',
    'Release introspection: single-use tokens become consumed after the first successful use',
  );
  const secondUse = store.recordTokenUse({
    tokenId: singleUseIssued.tokenId,
    usedAt: '2026-04-17T23:01:40.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    secondUse.accepted === false,
    'Release introspection: second use is rejected as replay instead of silently reauthorizing consequence',
  );
  equal(
    secondUse.inactiveReason,
    'usage_exhausted',
    'Release introspection: replay ledger reports usage exhaustion for already-consumed tokens',
  );
  const inactiveConsumed = await introspector.introspect({
    token: singleUseIssued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:01:45.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    inactiveConsumed.active === false,
    'Release introspection: already-consumed tokens are inactive before expiry',
  );
  if (!inactiveConsumed.active) {
    equal(
      inactiveConsumed.inactive_reason,
      'usage_exhausted',
      'Release introspection: consumed tokens report usage exhaustion as the inactive reason',
    );
  }

  const inactiveExpired = await introspector.introspect({
    token: issued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:10:00.000Z',
  });
  ok(
    inactiveExpired.active === false,
    'Release introspection: expired tokens are inactive even if they were once registered',
  );
  if (!inactiveExpired.active) {
    equal(
      inactiveExpired.inactive_reason,
      'expired',
      'Release introspection: expired inactive responses explain that expiry, not revocation, ended authorization',
    );
  }
  const expiredRecord = store.findToken(issued.tokenId);
  equal(
    expiredRecord?.status ?? null,
    'expired',
    'Release introspection: lifecycle sync persists an explicit expired registry status',
  );

  const revokedIssued = await issuer.issue({
    decision,
    issuedAt: '2026-04-17T23:00:00.000Z',
    tokenId: 'rt_revoked_introspection',
  });
  store.registerIssuedToken({
    issuedToken: revokedIssued,
    decision,
  });
  const revokedRecord = store.revokeToken({
    tokenId: revokedIssued.tokenId,
    revokedAt: '2026-04-17T23:02:00.000Z',
    reason: 'operator cancelled filing release',
    revokedBy: 'admin_api_key',
  });
  equal(
    revokedRecord?.status ?? null,
    'revoked',
    'Release introspection: explicit revoke transitions the registry record to revoked',
  );
  equal(
    revokedRecord?.revocationReason ?? null,
    'operator cancelled filing release',
    'Release introspection: revoke reason is preserved on the registry record',
  );
  const inactiveRevoked = await introspector.introspect({
    token: revokedIssued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:02:30.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    inactiveRevoked.active === false,
    'Release introspection: explicitly revoked tokens are inactive even before natural expiry',
  );
  if (!inactiveRevoked.active) {
    equal(
      inactiveRevoked.inactive_reason,
      'revoked',
      'Release introspection: revoked tokens report revocation as the inactive reason',
    );
  }

  const decisionRevoked = makeDecision('decision-release-introspection-decision-revoked');
  const decisionScopedIssued = await issuer.issue({
    decision: decisionRevoked,
    issuedAt: '2026-04-17T23:00:00.000Z',
    tokenId: 'rt_decision_revocation_primary',
  });
  const decisionScopedSecondIssued = await issuer.issue({
    decision: decisionRevoked,
    issuedAt: '2026-04-17T23:00:00.000Z',
    tokenId: 'rt_decision_revocation_secondary',
  });
  store.registerIssuedToken({
    issuedToken: decisionScopedIssued,
    decision: decisionRevoked,
  });
  store.registerIssuedToken({
    issuedToken: decisionScopedSecondIssued,
    decision: decisionRevoked,
  });
  const unaffectedDecision = makeDecision('decision-release-introspection-unaffected');
  const unaffectedIssued = await issuer.issue({
    decision: unaffectedDecision,
    issuedAt: '2026-04-17T23:00:00.000Z',
    tokenId: 'rt_decision_revocation_unaffected',
  });
  store.registerIssuedToken({
    issuedToken: unaffectedIssued,
    decision: unaffectedDecision,
  });

  const decisionRevocation = store.revokeTokensForDecision({
    decisionId: decisionRevoked.id,
    revokedAt: '2026-04-17T23:02:00.000Z',
    reason: 'upstream approval withdrawn',
    revokedBy: 'admin_api_key',
  });
  equal(
    decisionRevocation.revokedTokens.length,
    2,
    'Release introspection: decision-level revocation revokes all active tokens for the decision',
  );
  equal(
    decisionRevocation.decisionRevocation.reason,
    'upstream approval withdrawn',
    'Release introspection: decision-level revocation records the approval-change reason',
  );
  equal(
    store.findDecisionRevocation(decisionRevoked.id)?.revokedBy ?? null,
    'admin_api_key',
    'Release introspection: decision-level revocation is queryable by decision id',
  );
  const decisionRevokedIntrospection = await introspector.introspect({
    token: decisionScopedIssued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:02:30.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    decisionRevokedIntrospection.active === false,
    'Release introspection: tokens under a revoked decision are inactive before expiry',
  );
  if (!decisionRevokedIntrospection.active) {
    equal(
      decisionRevokedIntrospection.inactive_reason,
      'revoked',
      'Release introspection: decision-revoked tokens report revoked as the inactive reason',
    );
  }
  const decisionRevokedUse = store.recordTokenUse({
    tokenId: decisionScopedSecondIssued.tokenId,
    usedAt: '2026-04-17T23:02:40.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    decisionRevokedUse.accepted === false,
    'Release introspection: decision-revoked tokens cannot be consumed after revocation',
  );
  equal(
    decisionRevokedUse.inactiveReason,
    'revoked',
    'Release introspection: decision-revoked token use reports revocation',
  );
  const unaffectedIntrospection = await introspector.introspect({
    token: unaffectedIssued.token,
    verificationKey,
    audience: 'finance.reporting.record-store',
    currentDate: '2026-04-17T23:02:30.000Z',
    resourceServerId: 'attestor.tests.release-introspection',
  });
  ok(
    unaffectedIntrospection.active,
    'Release introspection: decision-level revocation does not affect other decisions',
  );
  const decisionRevocationReplay = store.revokeTokensForDecision({
    decisionId: decisionRevoked.id,
    revokedAt: '2026-04-17T23:02:50.000Z',
    reason: 'duplicate revoke',
    revokedBy: 'admin_api_key',
  });
  equal(
    decisionRevocationReplay.revokedTokens.length,
    0,
    'Release introspection: repeated decision-level revocation is idempotent',
  );
  equal(
    decisionRevocationReplay.alreadyInactiveTokens.length,
    2,
    'Release introspection: repeated decision-level revocation reports inactive decision tokens',
  );
  const lateDecisionToken = await issuer.issue({
    decision: decisionRevoked,
    issuedAt: '2026-04-17T23:02:50.000Z',
    tokenId: 'rt_decision_revocation_late',
  });
  assert.throws(
    () =>
      store.registerIssuedToken({
        issuedToken: lateDecisionToken,
        decision: decisionRevoked,
      }),
    ReleaseTokenIntrospectionStoreError,
    'Release introspection: revoked decisions cannot register newly issued release tokens',
  );
  passed += 1;

  const inactiveAudienceMismatch = await introspector.introspect({
    token: issued.token,
    verificationKey,
    audience: 'other.resource',
    currentDate: '2026-04-17T23:01:00.000Z',
    tokenTypeHint: 'access_token',
  });
  ok(
    inactiveAudienceMismatch.active === false,
    'Release introspection: audience mismatch is treated as inactive instead of reusable authorization',
  );

  console.log(`\nRelease kernel release-introspection tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel release-introspection tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
