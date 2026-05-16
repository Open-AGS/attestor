import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS,
  CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
  CustomerPepAdoptionPackageError,
  assertCustomerPepAdoptionPackageReady,
  customerPepAdoptionPackageDescriptor,
  evaluateCustomerPepAdoptionPackage,
  evaluateCustomerPepRuntimeAdoption,
  evaluateProtectedAdmissionE2eProofPlan,
  resolveConsequenceAdmissionProtectedEnforcementProfile,
  type EvaluateCustomerPepAdoptionPackageInput,
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

function adoptionEvidenceRefs() {
  return CUSTOMER_PEP_ADOPTION_PACKAGE_REQUIRED_EVIDENCE_KINDS.map((kind) => ({
    id: `package-evidence:${kind}`,
    kind,
    digest: digest(`package-evidence:${kind}`),
    uri: `https://example.invalid/attestor/customer-pep-package/${kind}`,
  }));
}

function runtimeEvidenceRefs() {
  const kinds = [
    'gateway-config',
    'verifier-result',
    'sender-proof-verifier',
    'token-introspection-store',
    'replay-store',
    'route-coverage',
    'runtime-health',
    'rollback-plan',
    'kill-switch',
    'monitoring-slo',
    'audit-receipt',
    'customer-approval',
  ] as const;
  return kinds.map((kind) => ({
    id: `runtime-evidence:${kind}`,
    kind,
    digest: digest(`runtime-evidence:${kind}`),
    uri: `https://example.invalid/attestor/customer-pep-runtime/${kind}`,
  }));
}

function runtimeAdoptionProof() {
  return evaluateCustomerPepRuntimeAdoption({
    runtimeId: 'customer-runtime:refund-service:prod',
    tenantId: 'tenant_customer_pep_package',
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
    evidenceRefs: runtimeEvidenceRefs(),
    rawTokenStored: false,
    rawPayloadStored: false,
    providerBodyStored: false,
    lastVerifiedAt: '2026-05-16T08:00:00.000Z',
    generatedAt: '2026-05-16T08:01:00.000Z',
  });
}

function protectedE2eProof(
  overrides: Partial<Parameters<typeof evaluateProtectedAdmissionE2eProofPlan>[0]> = {},
) {
  return evaluateProtectedAdmissionE2eProofPlan({
    routeId: 'route:refund-service:write',
    runtimeProfileId: 'customer-runtime:refund-service:prod',
    riskClass: 'R3',
    admissionAllowed: true,
    admissionDecisionDigest: digest('admission-decision'),
    reviewerRefPresent: true,
    signerRefDistinct: false,
    dpopProofVerified: true,
    dpopConfirmationJktBound: true,
    dpopProofReplayConsumed: true,
    dpopProofReplayStoreDurability: 'shared',
    rawDpopProofStored: false,
    protectedReleaseTokenIssued: true,
    protectedReleaseTokenSenderConstrained: true,
    protectedReleaseTokenProofRefDigest: digest('release-token-proof-ref'),
    issuerBoundary: 'runtime-release-token-issuer',
    rawReleaseTokenStored: false,
    onlineIntrospectionRequired: true,
    introspectionAuthorityRegistered: true,
    onlineIntrospectionActive: true,
    introspectionStoreDurability: 'shared',
    tokenUseReplayConsumed: true,
    tokenUseReplayStoreDurability: 'shared',
    tokenUseReplaySeparatedFromDpopProofReplay: true,
    pepKind: 'envoy-ext-authz',
    pepRouteCoverageComplete: true,
    pepFailClosed: true,
    pepBypassRoutesPresent: false,
    pepVerifierIntegrated: true,
    customerApprovalDigest: digest('customer-approval'),
    downstreamReceiptDigest: digest('downstream-receipt'),
    downstreamReceiptBoundToAdmission: true,
    downstreamReceiptBoundToDecision: true,
    downstreamReceiptBoundToTokenUse: true,
    rawDownstreamPayloadStored: false,
    ...overrides,
  });
}

function completeInput(
  overrides: Partial<EvaluateCustomerPepAdoptionPackageInput> = {},
): EvaluateCustomerPepAdoptionPackageInput {
  return {
    packageId: 'customer-pep-package:refund-service:prod',
    tenantId: 'tenant_customer_pep_package',
    runtimeId: 'customer-runtime:refund-service:prod',
    environment: 'production',
    routeId: 'route:refund-service:write',
    claimScope: 'scoped-runtime-adoption',
    runtimeAdoptionProof: runtimeAdoptionProof(),
    protectedAdmissionE2eProof: protectedE2eProof(),
    evidenceRefs: adoptionEvidenceRefs(),
    rawTokenStored: false,
    rawSenderProofStored: false,
    rawPayloadStored: false,
    rawProviderBodyStored: false,
    generatedAt: '2026-05-16T08:02:00.000Z',
    ...overrides,
  };
}

function testDescriptorIsTruthful(): void {
  const descriptor = customerPepAdoptionPackageDescriptor();

  equal(
    descriptor.version,
    CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
    'Customer PEP adoption package: descriptor exposes stable version',
  );
  equal(
    descriptor.requiresRuntimeAdoptionProof,
    true,
    'Customer PEP adoption package: runtime adoption proof is required',
  );
  equal(
    descriptor.requiresProtectedAdmissionE2eProof,
    true,
    'Customer PEP adoption package: protected E2E proof is required',
  );
  equal(
    descriptor.productionReady,
    false,
    'Customer PEP adoption package: descriptor does not claim production readiness',
  );
  ok(
    descriptor.primaryAnchors.includes('Envoy ext_authz'),
    'Customer PEP adoption package: Envoy primary anchor is recorded',
  );
}

function testCompletePackageAllowsScopedClaimOnly(): void {
  const proof = assertCustomerPepAdoptionPackageReady(completeInput());
  const serialized = JSON.stringify(proof);

  equal(
    proof.version,
    CUSTOMER_PEP_ADOPTION_PACKAGE_VERSION,
    'Customer PEP adoption package: proof version is stable',
  );
  equal(proof.packageReady, true, 'Customer PEP adoption package: complete package is ready');
  equal(
    proof.scopedCustomerPepAdoptionClaimAllowed,
    true,
    'Customer PEP adoption package: scoped adoption claim is allowed',
  );
  equal(
    proof.liveCustomerEnforcementClaimAllowed,
    false,
    'Customer PEP adoption package: live enforcement claim remains disallowed',
  );
  equal(proof.productionReady, false, 'Customer PEP adoption package: production readiness is false');
  equal(proof.activatesRuntime, false, 'Customer PEP adoption package: runtime activation is false');
  equal(proof.deploysInfrastructure, false, 'Customer PEP adoption package: deployment is false');
  equal(proof.dataMinimized, true, 'Customer PEP adoption package: proof is data-minimized');
  equal(proof.failureReasons.length, 0, 'Customer PEP adoption package: complete proof has no failures');
  ok(proof.digest.startsWith('sha256:'), 'Customer PEP adoption package: digest is present');
  ok(
    proof.reasonCodes.includes('customer-pep-adoption-ready'),
    'Customer PEP adoption package: ready reason code is explicit',
  );
  ok(
    !serialized.includes('raw_private_token'),
    'Customer PEP adoption package: raw token material is not serialized',
  );
}

function testMissingEvidenceBlocksPackage(): void {
  const proof = evaluateCustomerPepAdoptionPackage(
    completeInput({
      evidenceRefs: adoptionEvidenceRefs().filter((ref) =>
        ref.kind !== 'customer-approval' &&
        ref.kind !== 'activation-handoff' &&
        ref.kind !== 'downstream-receipt',
      ),
    }),
  );

  equal(proof.packageReady, false, 'Customer PEP adoption package: evidence gaps hold package');
  ok(
    proof.failureReasons.includes('package-evidence-incomplete'),
    'Customer PEP adoption package: incomplete evidence is explicit',
  );
  ok(
    proof.failureReasons.includes('customer-approval-evidence-missing'),
    'Customer PEP adoption package: missing customer approval is explicit',
  );
  ok(
    proof.failureReasons.includes('activation-evidence-missing'),
    'Customer PEP adoption package: missing activation evidence is explicit',
  );
  ok(
    proof.failureReasons.includes('downstream-receipt-evidence-missing'),
    'Customer PEP adoption package: missing downstream receipt is explicit',
  );
}

function testRuntimeAndRouteMismatchBlockPackage(): void {
  const proof = evaluateCustomerPepAdoptionPackage(
    completeInput({
      runtimeId: 'customer-runtime:other-service:prod',
      routeId: 'route:other-service:write',
      protectedAdmissionE2eProof: protectedE2eProof({ runtimeProfileId: null }),
    }),
  );

  equal(proof.packageReady, false, 'Customer PEP adoption package: identity mismatch holds package');
  ok(
    proof.failureReasons.includes('runtime-id-mismatch'),
    'Customer PEP adoption package: runtime mismatch is explicit',
  );
  ok(
    proof.failureReasons.includes('route-id-mismatch'),
    'Customer PEP adoption package: route mismatch is explicit',
  );
  ok(
    proof.failureReasons.includes('runtime-profile-id-missing'),
    'Customer PEP adoption package: runtime profile id is required',
  );
}

function testE2eStageBlockersHoldPackage(): void {
  const proof = evaluateCustomerPepAdoptionPackage(
    completeInput({
      protectedAdmissionE2eProof: protectedE2eProof({
        pepRouteCoverageComplete: false,
        downstreamReceiptDigest: null,
      }),
    }),
  );

  equal(proof.packageReady, false, 'Customer PEP adoption package: E2E blockers hold package');
  ok(
    proof.failureReasons.includes('protected-e2e-proof-plan-not-satisfied'),
    'Customer PEP adoption package: unsatisfied E2E proof is explicit',
  );
  ok(
    proof.failureReasons.includes('e2e-customer-pep-stage-blocked'),
    'Customer PEP adoption package: customer PEP stage blocker is explicit',
  );
  ok(
    proof.failureReasons.includes('e2e-downstream-receipt-stage-blocked'),
    'Customer PEP adoption package: downstream receipt stage blocker is explicit',
  );
}

function testLiveOrProductionClaimsAreHeld(): void {
  const liveClaim = evaluateCustomerPepAdoptionPackage(
    completeInput({ claimScope: 'live-customer-enforcement' }),
  );
  const productionClaim = evaluateCustomerPepAdoptionPackage(
    completeInput({ claimScope: 'production-readiness' }),
  );

  equal(liveClaim.packageReady, false, 'Customer PEP adoption package: live claim is held');
  ok(
    liveClaim.failureReasons.includes('live-enforcement-claim-requested'),
    'Customer PEP adoption package: live enforcement claim blocker is explicit',
  );
  equal(productionClaim.packageReady, false, 'Customer PEP adoption package: production claim is held');
  ok(
    productionClaim.failureReasons.includes('production-readiness-claim-requested'),
    'Customer PEP adoption package: production readiness claim blocker is explicit',
  );
}

function testRawMaterialBlocksPackage(): void {
  const proof = evaluateCustomerPepAdoptionPackage(
    completeInput({
      rawTokenStored: true,
      rawSenderProofStored: true,
      rawPayloadStored: true,
      rawProviderBodyStored: true,
    }),
  );

  equal(proof.dataMinimized, false, 'Customer PEP adoption package: raw storage disables data minimization');
  ok(
    proof.failureReasons.includes('raw-token-storage-enabled'),
    'Customer PEP adoption package: raw-token storage is blocked',
  );
  ok(
    proof.failureReasons.includes('raw-sender-proof-storage-enabled'),
    'Customer PEP adoption package: raw sender-proof storage is blocked',
  );
  ok(
    proof.failureReasons.includes('raw-payload-storage-enabled'),
    'Customer PEP adoption package: raw-payload storage is blocked',
  );
  ok(
    proof.failureReasons.includes('raw-provider-body-storage-enabled'),
    'Customer PEP adoption package: raw provider-body storage is blocked',
  );
}

function testAssertHelperThrowsWithProof(): void {
  assert.throws(
    () =>
      assertCustomerPepAdoptionPackageReady(
        completeInput({
          protectedAdmissionE2eProof: protectedE2eProof({ pepFailClosed: false }),
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof CustomerPepAdoptionPackageError);
      assert.ok(error.failureReasons.includes('protected-e2e-proof-plan-not-satisfied'));
      assert.equal(error.proof.packageReady, false);
      return true;
    },
    'Customer PEP adoption package: assert helper throws typed failure',
  );
  passed += 1;
}

function testDocsTrackerAndPackageExposeStep(): void {
  const packageDoc = readProjectFile(
    'docs',
    '02-architecture',
    'customer-pep-adoption-package.md',
  );
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const ledger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    packageDoc,
    'Status: repository-side adoption package for Attestor unlock step 06.',
    'Customer PEP adoption package: doc records step status',
  );
  includes(
    tracker,
    '| 06 | complete | Customer PEP adoption package |',
    'Customer PEP adoption package: tracker marks step 06 complete',
  );
  includes(
    ledger,
    '### 47. Customer PEP Adoption Package',
    'Customer PEP adoption package: research ledger indexes step',
  );
  equal(
    packageJson.scripts['test:customer-pep-adoption-package'],
    'tsx tests/customer-pep-adoption-package.test.ts',
    'Customer PEP adoption package: focused package script is exposed',
  );
}

testDescriptorIsTruthful();
testCompletePackageAllowsScopedClaimOnly();
testMissingEvidenceBlocksPackage();
testRuntimeAndRouteMismatchBlockPackage();
testE2eStageBlockersHoldPackage();
testLiveOrProductionClaimsAreHeld();
testRawMaterialBlocksPackage();
testAssertHelperThrowsWithProof();
testDocsTrackerAndPackageExposeStep();

console.log(`Customer PEP adoption package tests: ${passed} passed, 0 failed`);
