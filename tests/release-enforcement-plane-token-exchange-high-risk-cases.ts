import {
  createInMemoryReleaseTokenIntrospectionStore,
  createReleaseTokenIntrospector,
} from '../src/release-kernel/release-introspection.js';
import { verifyOnlineReleaseAuthorization } from '../src/release-enforcement-plane/online-verifier.js';
import { exchangeReleaseToken } from '../src/release-enforcement-plane/token-exchange.js';
import { createMtlsReleaseTokenConfirmation } from '../src/release-enforcement-plane/workload-binding.js';
import {
  WORKLOAD_CERT_THUMBPRINT,
  WORKLOAD_SPIFFE_ID,
  deepEqual,
  equal,
  expectedExchangedPolicyContext,
  expectedExchangedTokenPolicy,
  makeDecision,
  makeRequest,
  mtlsPresentation,
  setupIssuer,
  trustedExchangeActor,
  trustedWorkloadBinding,
} from './release-enforcement-plane-token-exchange-fixtures.js';

export async function testHighRiskExchangeRegistersForOnlineVerifier(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-r4-exchange',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_r4_exchange',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: parent, decision });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-r4-record',
      requestedAt: '2026-04-18T10:00:30.000Z',
      subjectToken: parent.token,
      audience: 'finance.reporting.record-store',
      resource: 'https://records.attestor.test/finance/',
      scope: 'record:write',
      actor: {
        id: 'svc.finance-writer',
        type: 'service',
        role: 'record-writer',
      },
      tokenId: 'rtx_finance_record',
    },
    trustedActor: trustedExchangeActor({
      id: 'svc.finance-writer',
      type: 'service',
      role: 'record-writer',
    }),
    issuer,
    verificationKey,
    sourceAudience: 'attestor.release.authority',
    subjectIntrospector: introspector,
    store,
    policy: {
      allowedAudiences: ['finance.reporting.record-store'],
      allowedSourceAudiences: ['attestor.release.authority'],
      allowedScopes: ['record:write'],
      allowedResources: ['https://records.attestor.test/finance/'],
      maxTtlSeconds: 60,
      maxUses: 1,
      requireActor: true,
    },
  });

  equal(exchanged.status, 'issued', 'Token exchange: high-risk exchange issues registered child token');
  if (exchanged.status !== 'issued') {
    throw new Error('Expected token exchange to issue.');
  }

  const request = makeRequest({
    id: 'erq-exchanged-r4',
    targetId: 'finance.reporting.record-store',
    consequenceType: 'record',
    riskClass: 'R4',
    boundaryKind: 'record-write',
    pointKind: 'record-write-gateway',
    releaseTokenId: exchanged.issuedToken.tokenId,
    releaseDecisionId: decision.id,
  });
  const verified = await verifyOnlineReleaseAuthorization({
    request,
    presentation: mtlsPresentation({ issued: exchanged.issuedToken }),
    verificationKey,
    replayLedgerEntry: null,
    now: '2026-04-18T10:01:00.000Z',
    trustedWorkloadBinding: trustedWorkloadBinding(),
    introspector,
    resourceServerId: 'erq-exchanged-r4-pep',
  });

  equal(verified.status, 'valid', 'Token exchange: registered high-risk child token passes online enforcement');
  equal(verified.active, true, 'Token exchange: online verifier sees child token active');
  equal(verified.introspection?.scope, 'record:write', 'Token exchange: introspection exposes narrowed scope');
  deepEqual(
    verified.introspection?.active === true ? verified.introspection.token_policy : null,
    expectedExchangedTokenPolicy(),
    'Token exchange: online introspection exposes exchanged structured token policy',
  );
  deepEqual(
    verified.verificationResult.policyContext,
    expectedExchangedPolicyContext(),
    'Token exchange: online verifier carries exchanged structured policy context',
  );
  deepEqual(
    verified.verificationResult.introspection?.policyContext,
    expectedExchangedPolicyContext(),
    'Token exchange: online verifier snapshots exchanged structured policy context',
  );
  equal(verified.freshness?.introspectionCache.status, 'fresh', 'Token exchange: online freshness is fresh');
}

export async function testExchangeRejectsDuplicateChildTokenId(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-r4-exchange-duplicate-child',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_r4_duplicate_child',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  const existingChild = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:05.000Z',
    tokenId: 'rtx_duplicate_child',
    audience: 'finance.reporting.record-store',
    tenantId: 'tenant-test',
    confirmation: createMtlsReleaseTokenConfirmation({
      certificateThumbprint: WORKLOAD_CERT_THUMBPRINT,
      spiffeId: WORKLOAD_SPIFFE_ID,
    }),
  });
  store.registerIssuedToken({ issuedToken: parent, decision });
  store.registerIssuedToken({ issuedToken: existingChild, decision });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-r4-duplicate-child',
      requestedAt: '2026-04-18T10:00:30.000Z',
      subjectToken: parent.token,
      audience: 'finance.reporting.record-store',
      resource: 'https://records.attestor.test/finance/',
      scope: 'record:write',
      actor: {
        id: 'svc.finance-writer',
        type: 'service',
        role: 'record-writer',
      },
      tokenId: existingChild.tokenId,
    },
    trustedActor: trustedExchangeActor({
      id: 'svc.finance-writer',
      type: 'service',
      role: 'record-writer',
    }),
    issuer,
    verificationKey,
    sourceAudience: 'attestor.release.authority',
    subjectIntrospector: introspector,
    store,
    policy: {
      allowedAudiences: ['finance.reporting.record-store'],
      allowedSourceAudiences: ['attestor.release.authority'],
      allowedScopes: ['record:write'],
      allowedResources: ['https://records.attestor.test/finance/'],
      maxTtlSeconds: 60,
      maxUses: 1,
      requireActor: true,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: duplicate child token id is denied');
  deepEqual(
    exchanged.failureReasons,
    ['child-token-id-conflict'],
    'Token exchange: duplicate child token id denial reason is explicit',
  );
  equal(exchanged.issuedToken, null, 'Token exchange: duplicate child token id does not return a minted child token');
}

export async function testExchangeRejectsRevokedSubjectWhenIntrospectionIsRequired(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-revoked-subject',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_revoked_subject',
  });
  store.registerIssuedToken({ issuedToken: parent, decision });
  store.revokeToken({
    tokenId: parent.tokenId,
    revokedAt: '2026-04-18T10:00:20.000Z',
    reason: 'release withdrawn before exchange',
    revokedBy: 'risk-admin',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-revoked-subject',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'finance.reporting.record-store',
      scope: 'record:write',
      actor: {
        id: 'svc.finance-writer',
        type: 'service',
      },
    },
    issuer,
    verificationKey,
    sourceAudience: 'attestor.release.authority',
    subjectIntrospector: introspector,
    store,
    policy: {
      allowedAudiences: ['finance.reporting.record-store'],
      allowedSourceAudiences: ['attestor.release.authority'],
      allowedScopes: ['record:write'],
      maxTtlSeconds: 60,
      requireActor: true,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: revoked subject token cannot be exchanged');
  deepEqual(exchanged.failureReasons, ['inactive-subject-token'], 'Token exchange: inactive subject reason is explicit');
  equal(exchanged.parentIntrospectionChecked, true, 'Token exchange: revoked-subject denial records parent introspection evidence');
}

export async function testExchangeRequiresParentIntrospectionForHighRiskParents(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const decision = makeDecision({
    id: 'decision-r4-exchange-missing-introspection',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_r4_missing_introspection',
  });
  store.registerIssuedToken({ issuedToken: parent, decision });
  store.revokeToken({
    tokenId: parent.tokenId,
    revokedAt: '2026-04-18T10:00:20.000Z',
    reason: 'release withdrawn before exchange',
    revokedBy: 'risk-admin',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-r4-missing-introspection',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'finance.reporting.record-store',
      scope: 'record:write',
      actor: {
        id: 'svc.finance-writer',
        type: 'service',
      },
    },
    trustedActor: trustedExchangeActor({
      id: 'svc.finance-writer',
      type: 'service',
    }),
    issuer,
    verificationKey,
    sourceAudience: 'attestor.release.authority',
    store,
    policy: {
      allowedAudiences: ['finance.reporting.record-store'],
      allowedSourceAudiences: ['attestor.release.authority'],
      allowedScopes: ['record:write'],
      maxTtlSeconds: 60,
      requireActor: true,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: high-risk parent requires active-state introspection');
  deepEqual(
    exchanged.failureReasons,
    ['subject-introspection-unavailable'],
    'Token exchange: missing high-risk parent introspection is explicit',
  );
  equal(exchanged.parentIntrospectionChecked, false, 'Token exchange: missing introspector records no parent active-state check');
  equal(exchanged.issuedToken, null, 'Token exchange: missing parent introspection does not issue a child token');
}

export async function testExchangeRequiresChildRegistrationStoreForHighRiskParents(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const store = createInMemoryReleaseTokenIntrospectionStore();
  const introspector = createReleaseTokenIntrospector(store);
  const decision = makeDecision({
    id: 'decision-r4-exchange-missing-child-store',
    consequenceType: 'record',
    riskClass: 'R4',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_r4_missing_child_store',
  });
  store.registerIssuedToken({ issuedToken: parent, decision });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-r4-missing-child-store',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'finance.reporting.record-store',
      scope: 'record:write',
      actor: {
        id: 'svc.finance-writer',
        type: 'service',
      },
    },
    issuer,
    verificationKey,
    sourceAudience: 'attestor.release.authority',
    subjectIntrospector: introspector,
    policy: {
      allowedAudiences: ['finance.reporting.record-store'],
      allowedSourceAudiences: ['attestor.release.authority'],
      allowedScopes: ['record:write'],
      maxTtlSeconds: 60,
      requireActor: true,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: high-risk child tokens require registration store');
  deepEqual(
    exchanged.failureReasons,
    ['child-registration-store-required'],
    'Token exchange: missing high-risk child registration store is explicit',
  );
  equal(exchanged.parentIntrospectionChecked, false, 'Token exchange: missing child store fails before minting child authority');
  equal(exchanged.issuedToken, null, 'Token exchange: missing child registration store does not issue a token');
}

export async function testExchangeRejectsInvalidResourceUri(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-invalid-resource',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_invalid_resource',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-invalid-resource',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
      resource: 'not a uri',
      scope: 'release:decision-support',
    },
    issuer,
    verificationKey,
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedScopes: ['release:decision-support'],
      maxTtlSeconds: 120,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: invalid resource URI is denied');
  deepEqual(exchanged.failureReasons, ['invalid-target'], 'Token exchange: invalid target reason is explicit');
}
