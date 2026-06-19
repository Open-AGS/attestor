import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
  type ReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import {
  ONLINE_RELEASE_VERIFIER_SPEC_VERSION,
  verifyOnlineReleaseAuthorization,
} from '../src/release-enforcement-plane/online-verifier.js';
import { createMtlsReleaseTokenConfirmation } from '../src/release-enforcement-plane/workload-binding.js';
import {
  COMPILED_POLICY_INDEX_VERSION,
  COMPILED_POLICY_IR_VERSION,
  POLICY_HASH,
  POLICY_IR_HASH,
  WORKLOAD_CERT_THUMBPRINT,
  WORKLOAD_SPIFFE_ID,
  activeIntrospectionFromIssued,
  bearerPresentation,
  deepEqual,
  equal,
  makeDecision,
  makeRequest,
  mtlsPresentation,
  ok,
  passedCount,
  setupIssuer,
  tokenPolicyFromIssued,
  trustedWorkloadBinding,
} from './release-enforcement-plane-online-verifier-fixtures.js';

async function testLowRiskCanRemainOfflineValid(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-low-risk-online',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'analytics.memo.preview',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_low_risk',
    tenantId: 'tenant-test',
  });
  const request = makeRequest({
    id: 'erq-online-low-risk',
    targetId: 'analytics.memo.preview',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: bearerPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
  });

  equal(verified.version, ONLINE_RELEASE_VERIFIER_SPEC_VERSION, 'Online verifier: result stamps stable spec version');
  equal(verified.status, 'valid', 'Online verifier: low-risk token can remain valid without online introspection');
  equal(verified.onlineChecked, false, 'Online verifier: low-risk path does not force online check');
  equal(verified.active, null, 'Online verifier: low-risk offline path has no active-state answer');
  deepEqual(verified.failureReasons, [], 'Online verifier: low-risk offline path has no failure reasons');
  equal(verified.verificationResult.mode, 'offline-signature', 'Online verifier: low-risk offline path keeps offline verification mode');
}

async function testHighRiskActiveIntrospectionAllows(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-r4-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_r4',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: issued, decision });
  const request = makeRequest({
    id: 'erq-online-r4',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
    resourceServerId: 'erq-online-r4-pep',
  });

  equal(verified.status, 'valid', 'Online verifier: active high-risk introspection upgrades offline indeterminate to valid');
  equal(verified.onlineChecked, true, 'Online verifier: high-risk path performs online check');
  equal(verified.active, true, 'Online verifier: active introspection state is retained');
  deepEqual(verified.failureReasons, [], 'Online verifier: active high-risk verification has no failure reasons');
  equal(verified.offline.status, 'indeterminate', 'Online verifier: offline component remains indeterminate before liveness');
  equal(verified.verificationResult.status, 'valid', 'Online verifier: final verification result is valid after liveness');
  equal(verified.verificationResult.mode, 'hybrid-required', 'Online verifier: high-risk result records hybrid verification');
  equal(verified.verificationResult.introspection?.active, true, 'Online verifier: verification result embeds active introspection snapshot');
  equal(verified.verificationResult.policyIrHash, POLICY_IR_HASH, 'Online verifier: final verification result carries policy IR hash');
  equal(verified.verificationResult.introspection?.policyIrHash, POLICY_IR_HASH, 'Online verifier: introspection snapshot carries policy IR hash');
  deepEqual(
    verified.verificationResult.policyContext,
    {
      policyHash: POLICY_HASH,
      policyVersion: 'policy.release-online-test.v1',
      policyIrHash: POLICY_IR_HASH,
      policyProvenanceSource: 'compiled-admission-policy-index',
      compiledPolicyIndexVersion: COMPILED_POLICY_INDEX_VERSION,
      compiledPolicyIrVersion: COMPILED_POLICY_IR_VERSION,
    },
    'Online verifier: final verification result exposes structured policy context',
  );
  deepEqual(
    verified.verificationResult.introspection?.policyContext,
    verified.verificationResult.policyContext,
    'Online verifier: introspection snapshot exposes the same structured policy context',
  );
  equal(verified.freshness?.introspectionCache.status, 'fresh', 'Online verifier: active live introspection creates fresh cache state');
}

async function testHighRiskBearerFailsWhenSenderConstraintRequired(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-r4-online-bearer-sender-required',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_r4_bearer_sender_required',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: issued, decision });
  const request = makeRequest({
    id: 'erq-online-r4-bearer-sender-required',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: bearerPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    introspector,
    resourceServerId: 'erq-online-r4-bearer-sender-required-pep',
  });

  equal(verified.status, 'invalid', 'Online verifier: required sender constraint rejects bearer presentation');
  equal(verified.onlineChecked, false, 'Online verifier: sender-proof failure stops before active-state introspection');
  deepEqual(verified.failureReasons, ['binding-mismatch'], 'Online verifier: bearer sender-proof failure is explicit');
}

async function testHighRiskCanConsumeOnSuccess(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-consume-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_consume',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: issued, decision });
  const request = makeRequest({
    id: 'erq-online-consume',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
    usageStore: store,
    consumeOnSuccess: true,
    resourceServerId: 'erq-online-consume-pep',
  });

  equal(verified.status, 'valid', 'Online verifier: first consuming high-risk admission succeeds');
  equal(verified.consumed, true, 'Online verifier: successful consume-on-success records usage');
  equal(verified.useCount, 1, 'Online verifier: use count is surfaced');
  equal(verified.maxUses, 1, 'Online verifier: max uses is surfaced');
}

async function testRevokedTokenFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-revoked-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_revoked',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: issued, decision });
  store.revokeToken({
    tokenId: issued.tokenId,
    revokedAt: '2026-04-18T09:00:30.000Z',
    reason: 'operator cancelled release',
    revokedBy: 'admin',
  });
  const request = makeRequest({
    id: 'erq-online-revoked',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
  });

  equal(verified.status, 'invalid', 'Online verifier: revoked token fails closed');
  equal(verified.active, false, 'Online verifier: revoked token has inactive state');
  ok(verified.failureReasons.includes('revoked-authorization'), 'Online verifier: revoked reason is explicit');
  equal(verified.verificationResult.status, 'invalid', 'Online verifier: revoked token yields invalid verification result');
  equal(verified.verificationResult.introspection?.active, false, 'Online verifier: inactive introspection snapshot is attached');
}

async function testConsumedTokenFailsAsReplay(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-consumed-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_consumed',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: issued, decision });
  store.recordTokenUse({
    tokenId: issued.tokenId,
    usedAt: '2026-04-18T09:00:30.000Z',
    resourceServerId: 'previous-pep',
  });
  const request = makeRequest({
    id: 'erq-online-consumed',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
  });

  equal(verified.status, 'invalid', 'Online verifier: consumed token fails closed');
  ok(verified.failureReasons.includes('replayed-authorization'), 'Online verifier: consumed token maps to replayed authorization');
}

async function testUnknownTokenFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-unknown-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_unknown',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const request = makeRequest({
    id: 'erq-online-unknown',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
  });

  equal(verified.status, 'invalid', 'Online verifier: unknown authority-plane token fails closed');
  ok(verified.failureReasons.includes('unknown-authorization'), 'Online verifier: unknown token reason is explicit');
}

async function testUnsupportedTokenTypeFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-unsupported-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_unsupported',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: issued, decision });
  const request = makeRequest({
    id: 'erq-online-unsupported',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
    tokenTypeHint: 'not_supported',
  });

  equal(verified.status, 'invalid', 'Online verifier: unsupported token type fails closed');
  ok(verified.failureReasons.includes('unsupported-token-type'), 'Online verifier: unsupported token type reason is explicit');
}

async function testActiveClaimMismatchFails(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-mismatch-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_mismatch',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const introspector: ReleaseTokenIntrospector = {
    async introspect() {
      return activeIntrospectionFromIssued(issued, {
        output_hash: 'sha256:wrong-output',
      });
    },
  };
  const request = makeRequest({
    id: 'erq-mismatch',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
  });

  equal(verified.status, 'invalid', 'Online verifier: active introspection claim mismatch fails closed');
  ok(verified.failureReasons.includes('introspection-claim-mismatch'), 'Online verifier: claim mismatch reason is explicit');
  ok(verified.failureReasons.includes('binding-mismatch'), 'Online verifier: claim mismatch also marks binding mismatch');
}

async function testActivePolicyClaimMismatchFailsAsStalePolicy(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-policy-mismatch-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_policy_mismatch',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const introspector: ReleaseTokenIntrospector = {
    async introspect() {
      return activeIntrospectionFromIssued(issued, {
        policy_ir_hash: 'sha256:wrong-policy-ir',
      });
    },
  };
  const request = makeRequest({
    id: 'erq-policy-mismatch',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
  });

  equal(verified.status, 'invalid', 'Online verifier: active policy claim mismatch fails closed');
  ok(verified.failureReasons.includes('introspection-claim-mismatch'), 'Online verifier: policy mismatch is still a claim mismatch');
  ok(verified.failureReasons.includes('stale-policy'), 'Online verifier: policy mismatch is marked as stale policy');

  const tokenPolicyMismatchIntrospector: ReleaseTokenIntrospector = {
    async introspect() {
      return activeIntrospectionFromIssued(issued, {
        token_policy: {
          ...tokenPolicyFromIssued(issued),
          policy_ir_hash: 'sha256:wrong-token-policy-ir',
        },
      });
    },
  };
  const tokenPolicyMismatch = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector: tokenPolicyMismatchIntrospector,
  });

  equal(tokenPolicyMismatch.status, 'invalid', 'Online verifier: structured token policy mismatch fails closed');
  ok(
    tokenPolicyMismatch.failureReasons.includes('introspection-claim-mismatch'),
    'Online verifier: token policy mismatch is a claim mismatch',
  );
  ok(
    tokenPolicyMismatch.failureReasons.includes('stale-policy'),
    'Online verifier: token policy mismatch is marked as stale policy',
  );
}

async function testIntrospectionUnavailableFailsClosed(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-unavailable-online',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'finance.reporting.record-store',
  });
  const issued = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T09:00:00.000Z',
    tokenId: 'rt_online_unavailable',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const introspector: ReleaseTokenIntrospector = {
    async introspect() {
      throw new Error('introspection service unavailable');
    },
  };
  const request = makeRequest({
    id: 'erq-online-unavailable',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: issued.tokenId,
    releaseDecisionId: decision.id,
  });

  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued, decisionId: decision.id }),
    verificationKey,
    now: '2026-04-18T09:01:00.000Z',
    replayLedgerEntry: null,
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
  });

  equal(verified.status, 'invalid', 'Online verifier: introspection outage fails closed for high-risk path');
  equal(verified.onlineChecked, true, 'Online verifier: outage is recorded as attempted online check');
  deepEqual(verified.failureReasons, ['introspection-unavailable'], 'Online verifier: outage reason is explicit');
  equal(verified.verificationResult.degradedState, 'fail-closed', 'Online verifier: outage preserves fail-closed degraded state');
}

async function main(): Promise<void> {
  await testLowRiskCanRemainOfflineValid();
  await testHighRiskActiveIntrospectionAllows();
  await testHighRiskBearerFailsWhenSenderConstraintRequired();
  await testHighRiskCanConsumeOnSuccess();
  await testRevokedTokenFails();
  await testConsumedTokenFailsAsReplay();
  await testUnknownTokenFails();
  await testUnsupportedTokenTypeFails();
  await testActiveClaimMismatchFails();
  await testActivePolicyClaimMismatchFailsAsStalePolicy();
  await testIntrospectionUnavailableFailsClosed();

  console.log(`Release enforcement-plane online-verifier tests: ${passedCount()} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease enforcement-plane online-verifier tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
