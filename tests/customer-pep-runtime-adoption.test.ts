import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
  CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS,
  CustomerPepRuntimeAdoptionError,
  assertCustomerPepRuntimeAdoptionReady,
  customerPepRuntimeAdoptionDescriptor,
  evaluateCustomerPepRuntimeAdoption,
  resolveConsequenceAdmissionProtectedEnforcementProfile,
  type EvaluateCustomerPepRuntimeAdoptionInput,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function protectedProfile() {
  return resolveConsequenceAdmissionProtectedEnforcementProfile({
    riskClass: 'R3',
    boundaryKind: 'action-dispatcher',
    consequenceDomain: 'operations',
    consequenceKind: 'action',
  });
}

function requiredEvidenceRefs() {
  return CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS.map((kind) => ({
    id: `evidence:${kind}`,
    kind,
    digest: digest(`evidence:${kind}`),
    uri: `https://example.invalid/attestor/evidence/${kind}`,
  }));
}

function completeInput(
  overrides: Partial<EvaluateCustomerPepRuntimeAdoptionInput> = {},
): EvaluateCustomerPepRuntimeAdoptionInput {
  return {
    runtimeId: 'customer-runtime:refund-service:prod',
    tenantId: 'tenant_customer_pep_runtime',
    environment: 'production',
    runtimeKind: 'envoy-ext-authz',
    boundaryKind: 'action-dispatcher',
    downstreamSystem: 'refund-service',
    protectedProfile: protectedProfile(),
    releaseEnforcementPlaneVersion: 'attestor.release-enforcement-envoy-ext-authz.v1',
    routeCoverage: 'all-protected-routes',
    bypassRoutes: [],
    failClosed: true,
    verifierIntegrated: true,
    allowedPresentationModes: ['dpop-bound-token', 'mtls-bound-token', 'spiffe-bound-token'],
    senderConstraintRequired: true,
    onlineIntrospectionRequired: true,
    replayConsumeRequired: true,
    proofRefBindingRequired: true,
    audienceBindingRequired: true,
    tenantBindingRequired: true,
    tokenIntrospectionStore: 'shared-durable',
    replayStore: 'shared-durable',
    healthProbeStatus: 'verified',
    rollbackPlanStatus: 'verified',
    killSwitchStatus: 'verified',
    monitoringStatus: 'healthy',
    auditReceiptStatus: 'recorded',
    customerApprovalStatus: 'approved',
    sourceActivationHandoffDigest: digest('activation-handoff'),
    sourceActivationReceiptDigest: digest('activation-receipt'),
    evidenceRefs: requiredEvidenceRefs(),
    rawTokenStored: false,
    rawPayloadStored: false,
    providerBodyStored: false,
    lastVerifiedAt: '2026-05-15T09:00:00.000Z',
    generatedAt: '2026-05-15T09:01:00.000Z',
    ...overrides,
  };
}

function testDescriptorIsTruthful(): void {
  const descriptor = customerPepRuntimeAdoptionDescriptor();

  equal(
    descriptor.version,
    CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
    'Customer PEP runtime adoption: descriptor exposes stable version',
  );
  equal(
    descriptor.requiresReleaseEnforcementPlaneProfile,
    true,
    'Customer PEP runtime adoption: release enforcement plane profile is required',
  );
  equal(
    descriptor.requiresSharedDurableStores,
    true,
    'Customer PEP runtime adoption: durable replay/introspection stores are required',
  );
  equal(
    descriptor.productionReady,
    false,
    'Customer PEP runtime adoption: descriptor does not claim production readiness',
  );
  equal(
    descriptor.activatesEnforcement,
    false,
    'Customer PEP runtime adoption: descriptor does not activate enforcement',
  );
  ok(
    descriptor.requiredEvidenceKinds.includes('sender-proof-verifier'),
    'Customer PEP runtime adoption: sender proof verifier evidence is required',
  );
}

function testCompleteRuntimeAdoptionProofCanBecomeReady(): void {
  const proof = assertCustomerPepRuntimeAdoptionReady(completeInput());
  const serialized = JSON.stringify(proof);

  equal(
    proof.version,
    CUSTOMER_PEP_RUNTIME_ADOPTION_VERSION,
    'Customer PEP runtime adoption: proof version is stable',
  );
  ok(
    proof.proofId.startsWith('customer-pep-runtime-adoption:sha256:'),
    'Customer PEP runtime adoption: proof id is digest-bound',
  );
  equal(proof.pepRuntimeAdoptionReady, true, 'Customer PEP runtime adoption: complete evidence is ready');
  equal(
    proof.nonBypassableRuntimeClaimAllowed,
    true,
    'Customer PEP runtime adoption: scoped non-bypassable runtime claim can be made',
  );
  equal(proof.productionReady, false, 'Customer PEP runtime adoption: proof still avoids production readiness');
  equal(proof.activatesEnforcement, false, 'Customer PEP runtime adoption: proof does not execute activation');
  equal(proof.dataMinimized, true, 'Customer PEP runtime adoption: proof is data-minimized');
  equal(proof.failureReasons.length, 0, 'Customer PEP runtime adoption: complete proof has no failures');
  ok(
    proof.reasonCodes.includes('customer-pep-runtime-adoption-ready'),
    'Customer PEP runtime adoption: ready reason code is explicit',
  );
  ok(proof.digest.startsWith('sha256:'), 'Customer PEP runtime adoption: digest is present');
  ok(!serialized.includes('raw_private_token'), 'Customer PEP runtime adoption: raw token material is not present');
}

function testFailOpenOrBypassRoutesBlockAdoption(): void {
  const proof = evaluateCustomerPepRuntimeAdoption(
    completeInput({
      routeCoverage: 'partial',
      bypassRoutes: ['/refunds/manual-override'],
      failClosed: false,
    }),
  );

  equal(proof.pepRuntimeAdoptionReady, false, 'Customer PEP runtime adoption: unsafe route posture is held');
  equal(
    proof.nonBypassableRuntimeClaimAllowed,
    false,
    'Customer PEP runtime adoption: bypass routes prevent scoped non-bypassable claim',
  );
  ok(
    proof.failureReasons.includes('route-coverage-incomplete'),
    'Customer PEP runtime adoption: route coverage blocker is explicit',
  );
  ok(
    proof.failureReasons.includes('bypass-routes-present'),
    'Customer PEP runtime adoption: bypass route blocker is explicit',
  );
  ok(
    proof.failureReasons.includes('fail-closed-not-configured'),
    'Customer PEP runtime adoption: fail-open blocker is explicit',
  );
}

function testBearerOnlyAndNonDurableStoresBlockProtectedAdoption(): void {
  const proof = evaluateCustomerPepRuntimeAdoption(
    completeInput({
      allowedPresentationModes: ['bearer-release-token'],
      senderConstraintRequired: false,
      onlineIntrospectionRequired: false,
      replayConsumeRequired: false,
      tokenIntrospectionStore: 'memory-reference',
      replayStore: 'file-backed-evaluation',
    }),
  );

  equal(proof.pepRuntimeAdoptionReady, false, 'Customer PEP runtime adoption: bearer-only runtime is held');
  ok(
    proof.failureReasons.includes('bearer-only-mode-present'),
    'Customer PEP runtime adoption: bearer-only mode is forbidden',
  );
  ok(
    proof.failureReasons.includes('presentation-mode-not-profile-compatible'),
    'Customer PEP runtime adoption: presentation modes must match protected profile',
  );
  ok(
    proof.failureReasons.includes('sender-constraint-not-required'),
    'Customer PEP runtime adoption: sender constraint must be required',
  );
  ok(
    proof.failureReasons.includes('online-introspection-not-required'),
    'Customer PEP runtime adoption: online introspection must be required',
  );
  ok(
    proof.failureReasons.includes('replay-consume-not-required'),
    'Customer PEP runtime adoption: replay consumption must be required',
  );
  ok(
    proof.failureReasons.includes('token-introspection-store-not-durable'),
    'Customer PEP runtime adoption: token introspection store must be durable',
  );
  ok(
    proof.failureReasons.includes('replay-store-not-durable'),
    'Customer PEP runtime adoption: replay store must be durable',
  );
}

function testActivationAndEvidenceGapsBlockAdoption(): void {
  const proof = evaluateCustomerPepRuntimeAdoption(
    completeInput({
      sourceActivationHandoffDigest: null,
      sourceActivationReceiptDigest: null,
      evidenceRefs: [],
      customerApprovalStatus: 'missing',
    }),
  );

  equal(proof.pepRuntimeAdoptionReady, false, 'Customer PEP runtime adoption: evidence gaps are held');
  ok(
    proof.failureReasons.includes('activation-handoff-digest-missing'),
    'Customer PEP runtime adoption: activation handoff digest is required',
  );
  ok(
    proof.failureReasons.includes('activation-receipt-digest-missing'),
    'Customer PEP runtime adoption: activation receipt digest is required',
  );
  ok(
    proof.failureReasons.includes('runtime-evidence-incomplete'),
    'Customer PEP runtime adoption: required evidence refs are checked',
  );
  ok(
    proof.failureReasons.includes('customer-approval-missing'),
    'Customer PEP runtime adoption: customer approval is required',
  );
  equal(
    proof.missingEvidenceKinds.length,
    CUSTOMER_PEP_RUNTIME_REQUIRED_EVIDENCE_KINDS.length,
    'Customer PEP runtime adoption: every required evidence kind is reported missing',
  );
}

function testDataMinimizationGapsBlockAdoption(): void {
  const proof = evaluateCustomerPepRuntimeAdoption(
    completeInput({
      rawTokenStored: true,
      rawPayloadStored: true,
      providerBodyStored: true,
    }),
  );

  equal(proof.dataMinimized, false, 'Customer PEP runtime adoption: raw storage disables data minimization');
  ok(
    proof.failureReasons.includes('raw-token-storage-enabled'),
    'Customer PEP runtime adoption: raw-token storage blocks adoption',
  );
  ok(
    proof.failureReasons.includes('raw-payload-storage-enabled'),
    'Customer PEP runtime adoption: raw-payload storage blocks adoption',
  );
  ok(
    proof.failureReasons.includes('provider-body-storage-enabled'),
    'Customer PEP runtime adoption: provider-body storage blocks adoption',
  );
}

function testInvalidDigestIsRejected(): void {
  assert.throws(
    () =>
      evaluateCustomerPepRuntimeAdoption(
        completeInput({
          sourceActivationHandoffDigest: 'sha256:not-a-digest',
        }),
      ),
    /sourceActivationHandoffDigest must be a sha256 digest/u,
    'Customer PEP runtime adoption: invalid digest is rejected',
  );
  passed += 1;
}

function testAssertHelperThrowsWithProof(): void {
  assert.throws(
    () =>
      assertCustomerPepRuntimeAdoptionReady(
        completeInput({
          verifierIntegrated: false,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof CustomerPepRuntimeAdoptionError);
      assert.ok(error.failureReasons.includes('verifier-not-integrated'));
      assert.equal(error.proof.pepRuntimeAdoptionReady, false);
      return true;
    },
    'Customer PEP runtime adoption: assert helper throws typed failure',
  );
  passed += 1;
}

function testDocsAndPackageExposeAdoptionProof(): void {
  const validationDoc = readProjectFile(
    'docs',
    'audit',
    'f2-customer-gate-enforcement-validation.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    validationDoc,
    'customer PEP runtime adoption proof',
    'Customer PEP runtime adoption: F2 validation names runtime adoption proof',
  );
  equal(
    packageJson.scripts['test:customer-pep-runtime-adoption'],
    'tsx tests/customer-pep-runtime-adoption.test.ts',
    'Customer PEP runtime adoption: focused package script is exposed',
  );
}

testDescriptorIsTruthful();
testCompleteRuntimeAdoptionProofCanBecomeReady();
testFailOpenOrBypassRoutesBlockAdoption();
testBearerOnlyAndNonDurableStoresBlockProtectedAdoption();
testActivationAndEvidenceGapsBlockAdoption();
testDataMinimizationGapsBlockAdoption();
testInvalidDigestIsRejected();
testAssertHelperThrowsWithProof();
testDocsAndPackageExposeAdoptionProof();

console.log(`Customer PEP runtime adoption tests: ${passed} passed, 0 failed`);
