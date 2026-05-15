import assert from 'node:assert/strict';
import {
  CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
  GenericAdmissionProtectedReleaseTokenIssuanceError,
  createGenericAdmissionEnvelope,
  evaluateGenericAdmissionProtectedReleaseTokenRequirement,
  issueGenericAdmissionProtectedReleaseToken,
} from '../src/consequence-admission/index.js';
import { generateDpopKeyPair } from '../src/release-enforcement-plane/dpop.js';
import {
  createReleaseTokenIssuer,
  verifyIssuedReleaseToken,
} from '../src/release-kernel/release-token.js';
import {
  createInMemoryReleaseTokenIntrospectionStore,
} from '../src/release-kernel/release-introspection.js';
import { generateKeyPair } from '../src/signing/keys.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function highRiskPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'enforce',
    actor: 'support-ai-agent',
    actorRef: 'service:support-ai-agent',
    reviewerRef: 'reviewer:risk-owner',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T18:00:00.000Z',
    decidedAt: '2026-05-01T18:00:01.000Z',
    tenantId: 'tenant_route',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    ...overrides,
  };
}

function issuerFixture() {
  const keyPair = generateKeyPair();
  return createReleaseTokenIssuer({
    issuer: 'attestor.generic-admission.test',
    privateKeyPem: keyPair.privateKeyPem,
    publicKeyPem: keyPair.publicKeyPem,
  });
}

async function testHighRiskAdmissionIssuesSenderConstrainedReleaseToken(): Promise<void> {
  const envelope = createGenericAdmissionEnvelope(highRiskPayload());
  const dpop = await generateDpopKeyPair();
  const issuer = issuerFixture();
  const introspectionStore = createInMemoryReleaseTokenIntrospectionStore();
  const result = await issueGenericAdmissionProtectedReleaseToken({
    envelope,
    issuer,
    introspectionStore,
    confirmation: { jkt: dpop.publicKeyThumbprint },
    issuedAt: '2026-05-01T18:00:02.000Z',
  });
  const verificationKey = await issuer.exportVerificationKey();
  const verified = await verifyIssuedReleaseToken({
    token: result.authorization.token,
    verificationKey,
    audience: 'refund-service',
    expectedTenantId: 'tenant_route',
    currentDate: '2026-05-01T18:00:03.000Z',
  });
  const serializedAdmission = JSON.stringify(result.envelope.admission);

  equal(
    result.version,
    CONSEQUENCE_ADMISSION_PROTECTED_RELEASE_TOKEN_ISSUANCE_VERSION,
    'Generic protected release token: stable version is returned',
  );
  equal(result.envelope.admission.allowed, true, 'Generic protected release token: final admission remains allowed');
  equal(
    result.envelope.admission.proof.some((proof) =>
      proof.kind === 'release-token' &&
      proof.id === result.authorization.tokenId &&
      proof.digest === result.authorization.tokenDigest),
    true,
    'Generic protected release token: final admission proof binds token id and digest',
  );
  equal(result.envelope.protectedReleaseToken.senderConstrained, true, 'Generic protected release token: summary records sender constraint');
  equal(result.envelope.protectedReleaseToken.introspectionRequired, true, 'Generic protected release token: R3 token requires introspection');
  equal(result.envelope.protectedReleaseToken.replayConsumptionRequired, true, 'Generic protected release token: replay consumption is required');
  equal(result.envelope.protectedReleaseToken.introspectionAuthorityRegistered, true, 'Generic protected release token: issued token is registered for online introspection');
  equal(result.authorization.presentationRequired, 'sender-constrained', 'Generic protected release token: authorization requires sender-constrained presentation');
  equal(result.authorization.storeRawTokenInAdmissionOrShadow, false, 'Generic protected release token: authorization forbids raw-token storage');
  equal(serializedAdmission.includes(result.authorization.token), false, 'Generic protected release token: raw token is not stored in admission');
  equal(verified.claims.aud, 'refund-service', 'Generic protected release token: token audience scopes to downstream system');
  equal(verified.claims.tenant_id, 'tenant_route', 'Generic protected release token: token carries tenant binding');
  equal(verified.claims.risk_class, 'R3', 'Generic protected release token: token carries high-risk class');
  equal(verified.claims.cnf?.jkt, dpop.publicKeyThumbprint, 'Generic protected release token: token carries DPoP confirmation thumbprint');
  equal(
    introspectionStore.findToken(result.authorization.tokenId)?.status,
    'issued',
    'Generic protected release token: introspection store records issued token as active',
  );
  equal(
    verified.claims.policy_provenance_source,
    'compiled-admission-policy-index',
    'Generic protected release token: token carries compiled policy provenance source',
  );
  ok(
    typeof verified.claims.policy_ir_hash === 'string' && verified.claims.policy_ir_hash.startsWith('sha256:'),
    'Generic protected release token: token carries compiled policy IR digest',
  );
}

async function testRequirementDetectsProtectedHighRiskAdmission(): Promise<void> {
  const envelope = createGenericAdmissionEnvelope(highRiskPayload());
  const requirement = evaluateGenericAdmissionProtectedReleaseTokenRequirement({ envelope });

  equal(requirement.required, true, 'Generic protected release token: high-risk enforce admission requires token');
  equal(
    requirement.profile?.minimumPath,
    'release-enforcement-plane',
    'Generic protected release token: requirement selects release-enforcement plane',
  );
  ok(
    requirement.reasonCodes.includes('protected-release-token-required'),
    'Generic protected release token: requirement reason code is explicit',
  );
}

async function testMissingSenderConfirmationFailsClosed(): Promise<void> {
  const envelope = createGenericAdmissionEnvelope(highRiskPayload());
  const issuer = issuerFixture();

  await assert.rejects(
    () =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        issuedAt: '2026-05-01T18:00:02.000Z',
      }),
    (error: unknown) => {
      assert.ok(error instanceof GenericAdmissionProtectedReleaseTokenIssuanceError);
      assert.ok(error.failureReasons.includes('sender-confirmation-required'));
      return true;
    },
  );
  passed += 1;
}

async function testMissingReviewerFailsClosedForHighRiskTokenIssuance(): Promise<void> {
  const envelope = createGenericAdmissionEnvelope(highRiskPayload({ reviewerRef: undefined }));
  const dpop = await generateDpopKeyPair();
  const issuer = issuerFixture();

  await assert.rejects(
    () =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        confirmation: { jkt: dpop.publicKeyThumbprint },
        issuedAt: '2026-05-01T18:00:02.000Z',
      }),
    (error: unknown) => {
      assert.ok(error instanceof GenericAdmissionProtectedReleaseTokenIssuanceError);
      assert.ok(error.failureReasons.includes('review-authority-required'));
      return true;
    },
  );
  passed += 1;
}

async function testR4RequiresDistinctSignerBeforeTokenIssuance(): Promise<void> {
  const envelope = createGenericAdmissionEnvelope(highRiskPayload({
    action: 'release_filing_packet',
    domain: 'regulated-filing',
    downstreamSystem: 'filing-system',
    signerRef: undefined,
  }));
  const dpop = await generateDpopKeyPair();
  const issuer = issuerFixture();

  await assert.rejects(
    () =>
      issueGenericAdmissionProtectedReleaseToken({
        envelope,
        issuer,
        confirmation: { jkt: dpop.publicKeyThumbprint },
        issuedAt: '2026-05-01T18:00:02.000Z',
      }),
    (error: unknown) => {
      assert.ok(error instanceof GenericAdmissionProtectedReleaseTokenIssuanceError);
      assert.ok(error.failureReasons.includes('review-authority-required'));
      return true;
    },
  );
  passed += 1;
}

function testObserveModeDoesNotIssueProtectedToken(): void {
  const envelope = createGenericAdmissionEnvelope(highRiskPayload({ mode: 'observe' }));
  const requirement = evaluateGenericAdmissionProtectedReleaseTokenRequirement({ envelope });

  equal(requirement.required, false, 'Generic protected release token: observe mode does not require token issuance');
  ok(
    requirement.failureReasons.includes('non-enforcing-mode'),
    'Generic protected release token: non-enforcing mode reason is explicit',
  );
}

await testHighRiskAdmissionIssuesSenderConstrainedReleaseToken();
await testRequirementDetectsProtectedHighRiskAdmission();
await testMissingSenderConfirmationFailsClosed();
await testMissingReviewerFailsClosedForHighRiskTokenIssuance();
await testR4RequiresDistinctSignerBeforeTokenIssuance();
testObserveModeDoesNotIssueProtectedToken();

console.log(`Generic admission protected release-token tests: ${passed} passed, 0 failed`);
