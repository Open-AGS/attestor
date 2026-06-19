import {
  ATTESTOR_RELEASE_TOKEN_TYPE,
  RELEASE_TOKEN_EXCHANGE_GRANT_TYPE,
  RELEASE_TOKEN_EXCHANGE_SPEC_VERSION,
  exchangeReleaseToken,
  type ReleaseTokenExchangePolicy,
} from '../src/release-enforcement-plane/token-exchange.js';
import { verifyOfflineReleaseAuthorization } from '../src/release-enforcement-plane/offline-verifier.js';
import {
  COMPILED_POLICY_INDEX_VERSION,
  COMPILED_POLICY_IR_VERSION,
  EXCHANGED_POLICY_VERSION,
  POLICY_HASH,
  POLICY_IR_HASH,
  bearerPresentation,
  deepEqual,
  equal,
  expectedExchangedPolicyContext,
  makeDecision,
  makeRequest,
  ok,
  passedCount,
  setupIssuer,
  trustedExchangeActor,
} from './release-enforcement-plane-token-exchange-fixtures.js';
import {
  testExchangeRejectsDuplicateChildTokenId,
  testExchangeRejectsInvalidResourceUri,
  testExchangeRejectsRevokedSubjectWhenIntrospectionIsRequired,
  testExchangeRequiresChildRegistrationStoreForHighRiskParents,
  testExchangeRequiresParentIntrospectionForHighRiskParents,
  testHighRiskExchangeRegistersForOnlineVerifier,
} from './release-enforcement-plane-token-exchange-high-risk-cases.js';

async function testAudienceScopedExchangeIssuesDownstreamToken(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-exchange-r1',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_exchange_r1',
    tenantId: 'tenant-test',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-r1-audience',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      requestedTokenType: ATTESTOR_RELEASE_TOKEN_TYPE,
      audience: 'analytics.memo.writer',
      resource: 'https://api.attestor.test/memo/',
      scope: ['release:decision-support', 'memo:write', 'memo:write'],
      ttlSeconds: 120,
      tokenId: 'rtx_memo_writer',
      actor: {
        id: 'svc.memo-gateway',
        type: 'service',
        displayName: 'Memo Gateway',
        role: 'downstream-writer',
      },
    },
    trustedActor: trustedExchangeActor({
      id: 'svc.memo-gateway',
      type: 'service',
      displayName: 'Memo Gateway',
      role: 'downstream-writer',
    }),
    issuer,
    verificationKey,
    sourceAudience: 'attestor.release.authority',
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedSourceAudiences: ['attestor.release.authority'],
      allowedScopes: ['release:decision-support', 'memo:write'],
      allowedResources: ['https://api.attestor.test/memo/'],
      maxTtlSeconds: 120,
      maxUses: 1,
      requireActor: true,
    },
  });

  equal(exchanged.version, RELEASE_TOKEN_EXCHANGE_SPEC_VERSION, 'Token exchange: result stamps stable spec version');
  equal(exchanged.grantType, RELEASE_TOKEN_EXCHANGE_GRANT_TYPE, 'Token exchange: result records token-exchange grant type');
  equal(exchanged.status, 'issued', 'Token exchange: allowed request issues a downstream token');
  equal(exchanged.requestedTokenType, ATTESTOR_RELEASE_TOKEN_TYPE, 'Token exchange: requested token type is explicit');
  equal(exchanged.issuedTokenType, ATTESTOR_RELEASE_TOKEN_TYPE, 'Token exchange: issued token type is explicit');
  equal(exchanged.actorTokenType, null, 'Token exchange: structured actor references are not raw actor tokens');
  equal(exchanged.audience, 'analytics.memo.writer', 'Token exchange: result is scoped to requested audience');
  deepEqual(exchanged.scope, ['memo:write', 'release:decision-support'], 'Token exchange: requested scope is normalized and narrowed');
  equal(exchanged.resource, 'https://api.attestor.test/memo/', 'Token exchange: resource URI is preserved');
  equal(exchanged.actorChain.length, 1, 'Token exchange: actor chain contains the current actor');

  if (exchanged.status !== 'issued') {
    throw new Error('Expected token exchange to issue.');
  }

  equal(exchanged.issuedToken.claims.aud, 'analytics.memo.writer', 'Token exchange: JWT audience is narrowed');
  equal(exchanged.issuedToken.claims.scope, 'memo:write release:decision-support', 'Token exchange: JWT scope is explicit');
  equal(exchanged.issuedToken.claims.resource, 'https://api.attestor.test/memo/', 'Token exchange: JWT resource is explicit');
  equal(exchanged.issuedToken.claims.parent_jti, 'rt_parent_exchange_r1', 'Token exchange: JWT links to parent token');
  equal(exchanged.issuedToken.claims.exchange_id, 'exchange-r1-audience', 'Token exchange: JWT carries exchange id');
  equal(exchanged.issuedToken.claims.source_aud, 'attestor.release.authority', 'Token exchange: JWT records source audience');
  equal(exchanged.issuedToken.claims.token_use, 'exchanged-release', 'Token exchange: JWT marks exchanged release use');
  equal(exchanged.issuedToken.claims.act?.sub, 'svc.memo-gateway', 'Token exchange: JWT carries actor claim');
  equal(exchanged.issuedToken.claims.policy_hash, POLICY_HASH, 'Token exchange: JWT preserves source policy hash');
  equal(exchanged.issuedToken.claims.policy_version, EXCHANGED_POLICY_VERSION, 'Token exchange: JWT marks derived exchange policy version');
  equal(exchanged.issuedToken.claims.policy_ir_hash, POLICY_IR_HASH, 'Token exchange: JWT preserves compiled policy IR hash');
  equal(
    exchanged.issuedToken.claims.policy_provenance_source,
    'compiled-admission-policy-index',
    'Token exchange: JWT preserves policy provenance source',
  );
  equal(
    exchanged.issuedToken.claims.compiled_policy_index_version,
    COMPILED_POLICY_INDEX_VERSION,
    'Token exchange: JWT preserves compiled policy index version',
  );
  equal(
    exchanged.issuedToken.claims.compiled_policy_ir_version,
    COMPILED_POLICY_IR_VERSION,
    'Token exchange: JWT preserves compiled policy IR version',
  );

  const request = makeRequest({
    id: 'erq-exchanged-r1',
    targetId: 'analytics.memo.writer',
    releaseTokenId: exchanged.issuedToken.tokenId,
    releaseDecisionId: decision.id,
  });
  const verified = await verifyOfflineReleaseAuthorization({
    request,
    presentation: bearerPresentation({ issued: exchanged.issuedToken }),
    verificationKey,
    replayLedgerEntry: null,
    now: '2026-04-18T10:01:30.000Z',
  });

  equal(verified.status, 'valid', 'Token exchange: downstream verifier accepts narrowed token for the target audience');
  equal(verified.claims?.aud, 'analytics.memo.writer', 'Token exchange: verifier sees downstream audience');
  deepEqual(
    verified.verificationResult.policyContext,
    expectedExchangedPolicyContext(),
    'Token exchange: offline verifier carries exchanged structured policy context',
  );
}

async function testExchangeDoesNotBroadenAudience(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-disallowed-audience',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_disallowed_audience',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-disallowed-audience',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'payments.writer',
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

  equal(exchanged.status, 'denied', 'Token exchange: disallowed audience is denied');
  ok(exchanged.failureReasons.includes('audience-not-allowed'), 'Token exchange: audience denial reason is explicit');
  equal(exchanged.issuedToken, null, 'Token exchange: denied exchange does not issue a token');
}

async function testExchangeRejectsUnsupportedRequestedTokenType(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-unsupported-requested-token-type',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_unsupported_requested_token_type',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-unsupported-requested-token-type',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      audience: 'analytics.memo.writer',
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

  equal(exchanged.status, 'denied', 'Token exchange: unsupported requested token type is denied');
  equal(
    exchanged.requestedTokenType,
    'urn:ietf:params:oauth:token-type:access_token',
    'Token exchange: denied result records the requested token type',
  );
  deepEqual(
    exchanged.failureReasons,
    ['unsupported-requested-token-type'],
    'Token exchange: requested-token-type denial reason is explicit',
  );
  equal(exchanged.issuedToken, null, 'Token exchange: unsupported requested token type does not issue a token');
}

async function testExchangeRejectsUnsupportedSubjectTokenType(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-unsupported-subject-token-type',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_unsupported_subject_token_type',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-unsupported-subject-token-type',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      audience: 'analytics.memo.writer',
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

  equal(exchanged.status, 'denied', 'Token exchange: unsupported subject token type is denied');
  equal(
    exchanged.subjectTokenType,
    'urn:ietf:params:oauth:token-type:access_token',
    'Token exchange: denied result records the subject token type',
  );
  deepEqual(
    exchanged.failureReasons,
    ['unsupported-subject-token-type'],
    'Token exchange: subject-token-type denial reason is explicit',
  );
}

async function testExchangeRejectsRawActorTokenInputs(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-unsupported-actor-token-type',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_unsupported_actor_token_type',
  });

  const rawActorToken = await exchangeReleaseToken({
    request: {
      id: 'exchange-raw-actor-token',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      actorToken: 'opaque-actor-token',
      actorTokenType: ATTESTOR_RELEASE_TOKEN_TYPE,
      audience: 'analytics.memo.writer',
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

  equal(rawActorToken.status, 'denied', 'Token exchange: raw actor-token inputs are denied until validation exists');
  deepEqual(
    rawActorToken.failureReasons,
    ['actor-token-not-supported'],
    'Token exchange: raw actor-token no-support reason is explicit',
  );
  equal(rawActorToken.issuedToken, null, 'Token exchange: raw actor-token input does not issue a token');

  const actorTokenTypeOnly = await exchangeReleaseToken({
    request: {
      id: 'exchange-actor-token-type-only',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      actorTokenType: ATTESTOR_RELEASE_TOKEN_TYPE,
      audience: 'analytics.memo.writer',
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

  equal(actorTokenTypeOnly.status, 'denied', 'Token exchange: actor token type without actor token is denied');
  deepEqual(
    actorTokenTypeOnly.failureReasons,
    ['unsupported-actor-token-type'],
    'Token exchange: orphan actor-token-type denial reason is explicit',
  );
}

async function testExchangeRejectsDisallowedScopeAndResource(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-disallowed-scope',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_disallowed_scope',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-disallowed-scope',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
      resource: 'https://evil.example/api/',
      scope: 'admin:write',
    },
    issuer,
    verificationKey,
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedScopes: ['release:decision-support', 'memo:write'],
      allowedResources: ['https://api.attestor.test/memo/'],
      maxTtlSeconds: 120,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: disallowed scope/resource is denied');
  ok(exchanged.failureReasons.includes('scope-not-allowed'), 'Token exchange: disallowed scope is explicit');
  ok(exchanged.failureReasons.includes('resource-not-allowed'), 'Token exchange: disallowed resource is explicit');
}

async function testExchangeCapsTtlToSubjectTokenLifetime(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-ttl-cap',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_ttl_cap',
    ttlSeconds: 90,
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-ttl-cap',
      requestedAt: '2026-04-18T10:00:10.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
      scope: 'release:decision-support',
      ttlSeconds: 300,
      tokenId: 'rtx_ttl_cap',
    },
    issuer,
    verificationKey,
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedScopes: ['release:decision-support'],
      maxTtlSeconds: 600,
    },
  });

  equal(exchanged.status, 'issued', 'Token exchange: subject-lifetime-capped exchange succeeds');
  if (exchanged.status !== 'issued') {
    throw new Error('Expected token exchange to issue.');
  }
  equal(exchanged.ttlSeconds, 80, 'Token exchange: child TTL is capped by parent token remaining lifetime');
  equal(exchanged.issuedToken.claims.exp - exchanged.issuedToken.claims.iat, 80, 'Token exchange: JWT TTL matches cap');
}

async function testExchangeRejectsExpiredSubject(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-expired-subject',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_expired',
    ttlSeconds: 30,
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-expired-subject',
      requestedAt: '2026-04-18T10:02:00.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
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

  equal(exchanged.status, 'denied', 'Token exchange: expired subject token is denied');
  deepEqual(exchanged.failureReasons, ['expired-subject-token'], 'Token exchange: expired subject reason is explicit');
}

async function testExchangePreservesActorChain(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-actor-chain',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_actor_chain',
    actor: {
      sub: 'svc.orchestrator',
      actor_type: 'service',
      role: 'agent-orchestrator',
    },
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-actor-chain',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
      scope: 'release:decision-support',
      actor: {
        id: 'svc.memo-gateway',
        type: 'service',
        role: 'downstream-writer',
      },
    },
    trustedActor: trustedExchangeActor({
      id: 'svc.memo-gateway',
      type: 'service',
      role: 'downstream-writer',
    }),
    issuer,
    verificationKey,
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedScopes: ['release:decision-support'],
      requireActor: true,
      maxTtlSeconds: 120,
    },
  });

  equal(exchanged.status, 'issued', 'Token exchange: actor-chain exchange succeeds');
  if (exchanged.status !== 'issued') {
    throw new Error('Expected token exchange to issue.');
  }
  equal(exchanged.actorChain.length, 2, 'Token exchange: actor chain keeps current and previous actors');
  equal(exchanged.issuedToken.claims.act?.sub, 'svc.memo-gateway', 'Token exchange: current actor is first in JWT actor chain');
  equal(exchanged.issuedToken.claims.act?.act?.sub, 'svc.orchestrator', 'Token exchange: parent actor is nested in JWT actor chain');
}

async function testExchangeRequiresTrustedActorProofForRequestActor(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-actor-proof-required',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_actor_proof_required',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-actor-proof-required',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
      scope: 'release:decision-support',
      actor: {
        id: 'svc.memo-gateway',
        type: 'service',
        role: 'downstream-writer',
      },
    },
    issuer,
    verificationKey,
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedScopes: ['release:decision-support'],
      requireActor: true,
      maxTtlSeconds: 120,
    },
  });

  equal(exchanged.status, 'denied', 'Token exchange: request-body actor does not satisfy requireActor without trusted proof');
  deepEqual(
    exchanged.failureReasons,
    ['actor-proof-required'],
    'Token exchange: actor proof requirement is explicit',
  );
  equal(exchanged.issuedToken, null, 'Token exchange: proofless actor request does not issue a child token');
}

async function testExchangeRequiresExplicitMaxTtlPolicy(): Promise<void> {
  const { issuer, verificationKey } = await setupIssuer();
  const decision = makeDecision({
    id: 'decision-missing-ttl-policy',
    consequenceType: 'decision-support',
    riskClass: 'R1',
    targetId: 'attestor.release.authority',
  });
  const parent = await issuer.issue({
    decision,
    issuedAt: '2026-04-18T10:00:00.000Z',
    tokenId: 'rt_parent_missing_ttl_policy',
  });

  const exchanged = await exchangeReleaseToken({
    request: {
      id: 'exchange-missing-ttl-policy',
      requestedAt: '2026-04-18T10:01:00.000Z',
      subjectToken: parent.token,
      audience: 'analytics.memo.writer',
      scope: 'release:decision-support',
      ttlSeconds: 120,
      tokenId: 'rtx_missing_ttl_policy',
    },
    issuer,
    verificationKey,
    policy: {
      allowedAudiences: ['analytics.memo.writer'],
      allowedScopes: ['release:decision-support'],
    } as unknown as ReleaseTokenExchangePolicy,
  });

  equal(exchanged.status, 'denied', 'Token exchange: missing max TTL policy is denied');
  deepEqual(exchanged.failureReasons, ['ttl-policy-required'], 'Token exchange: implicit 300s TTL fallback is not allowed');
  equal(exchanged.issuedToken, null, 'Token exchange: missing max TTL policy does not issue a token');
}

async function main(): Promise<void> {
  await testAudienceScopedExchangeIssuesDownstreamToken();
  await testExchangeDoesNotBroadenAudience();
  await testExchangeRejectsUnsupportedRequestedTokenType();
  await testExchangeRejectsUnsupportedSubjectTokenType();
  await testExchangeRejectsRawActorTokenInputs();
  await testExchangeRejectsDisallowedScopeAndResource();
  await testExchangeCapsTtlToSubjectTokenLifetime();
  await testExchangeRejectsExpiredSubject();
  await testExchangePreservesActorChain();
  await testExchangeRequiresTrustedActorProofForRequestActor();
  await testExchangeRequiresExplicitMaxTtlPolicy();
  await testHighRiskExchangeRegistersForOnlineVerifier();
  await testExchangeRejectsDuplicateChildTokenId();
  await testExchangeRejectsRevokedSubjectWhenIntrospectionIsRequired();
  await testExchangeRequiresParentIntrospectionForHighRiskParents();
  await testExchangeRequiresChildRegistrationStoreForHighRiskParents();
  await testExchangeRejectsInvalidResourceUri();

  console.log(`Release enforcement-plane token-exchange tests: ${passedCount()} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease enforcement-plane token-exchange tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
