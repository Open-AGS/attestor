import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
  evaluateProtectedAdmissionE2eProofPlan,
  protectedAdmissionE2eProofPlanDescriptor,
  consequenceAdmissionDescriptor,
  type ProtectedAdmissionE2eProofPlanInput,
} from '../src/consequence-admission/index.js';

let passed = 0;

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}`,
  );
  passed += 1;
}

function baseInput(
  overrides: Partial<ProtectedAdmissionE2eProofPlanInput> = {},
): ProtectedAdmissionE2eProofPlanInput {
  return {
    routeId: 'POST /api/v1/admissions -> refund-service.issue_refund',
    riskClass: 'R3',
    admissionAllowed: true,
    admissionDecisionDigest: digest('admission-decision'),
    reviewerRefPresent: true,
    signerRefDistinct: false,
    dpopProofVerified: true,
    dpopConfirmationJktBound: true,
    dpopProofReplayConsumed: true,
    dpopProofReplayStoreDurability: 'local',
    rawDpopProofStored: false,
    protectedReleaseTokenIssued: true,
    protectedReleaseTokenSenderConstrained: true,
    protectedReleaseTokenProofRefDigest: digest('release-token-proof-ref'),
    issuerBoundary: 'runtime-release-token-issuer',
    externalIssuerProofValid: false,
    rawReleaseTokenStored: false,
    onlineIntrospectionRequired: true,
    introspectionAuthorityRegistered: true,
    onlineIntrospectionActive: true,
    introspectionStoreDurability: 'local',
    tokenUseReplayConsumed: true,
    tokenUseReplayStoreDurability: 'local',
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
  };
}

function testDescriptorDefinesOrderedProofChain(): void {
  const descriptor = protectedAdmissionE2eProofPlanDescriptor();
  const consequenceDescriptor = consequenceAdmissionDescriptor();

  equal(
    descriptor.version,
    PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
    'Protected admission E2E proof: descriptor exposes stable version',
  );
  equal(
    descriptor.stages.map((stage) => stage.id).join(' -> '),
    'admission-decision -> sender-confirmed-token-request -> protected-release-token-issuance -> online-introspection -> token-use-replay-consumption -> customer-pep-enforcement -> downstream-receipt',
    'Protected admission E2E proof: descriptor freezes the protected consequence chain',
  );
  ok(
    descriptor.primaryAnchors.includes('OAuth DPoP RFC 9449'),
    'Protected admission E2E proof: DPoP anchor is recorded',
  );
  ok(
    descriptor.primaryAnchors.includes('OAuth Token Introspection RFC 7662'),
    'Protected admission E2E proof: introspection anchor is recorded',
  );
  equal(
    descriptor.productionReady,
    false,
    'Protected admission E2E proof: descriptor does not claim production readiness',
  );
  equal(
    descriptor.activatesRuntime,
    false,
    'Protected admission E2E proof: descriptor does not activate runtime',
  );
  equal(
    consequenceDescriptor.protectedAdmissionE2eProofPlanVersion,
    PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
    'Protected admission E2E proof: consequence descriptor exposes the plan version',
  );
}

function testCompleteNarrowFixtureSatisfiesRepositoryPlan(): void {
  const result = evaluateProtectedAdmissionE2eProofPlan(baseInput());

  equal(
    result.version,
    PROTECTED_ADMISSION_E2E_PROOF_PLAN_VERSION,
    'Protected admission E2E proof: evaluation exposes stable version',
  );
  equal(
    result.proofPlanSatisfied,
    true,
    'Protected admission E2E proof: complete narrow fixture satisfies the route contract',
  );
  equal(
    result.firstNarrowFixtureReady,
    true,
    'Protected admission E2E proof: first narrow fixture is ready',
  );
  equal(
    result.nextUnlock,
    'customer-pep-adoption-package',
    'Protected admission E2E proof: next unlock moves to customer PEP adoption package',
  );
  equal(
    result.productionReady,
    false,
    'Protected admission E2E proof: complete fixture still avoids production readiness',
  );
  equal(
    result.signedBearerHelperSufficient,
    false,
    'Protected admission E2E proof: signed bearer helper is never sufficient for the chain',
  );
  ok(result.digest.startsWith('sha256:'), 'Protected admission E2E proof: evaluation digest is present');
}

function testSignedBearerOnlyPathFailsClosed(): void {
  const result = evaluateProtectedAdmissionE2eProofPlan(
    baseInput({
      dpopProofVerified: false,
      dpopConfirmationJktBound: false,
      dpopProofReplayConsumed: false,
      protectedReleaseTokenSenderConstrained: false,
      onlineIntrospectionRequired: false,
      tokenUseReplayConsumed: false,
      pepVerifierIntegrated: false,
    }),
  );

  equal(
    result.proofPlanSatisfied,
    false,
    'Protected admission E2E proof: signed bearer only path does not satisfy the plan',
  );
  ok(
    result.blockers.includes('signed-bearer-helper-insufficient'),
    'Protected admission E2E proof: signed bearer insufficiency is explicit',
  );
  ok(
    result.noGoConditions.includes('signed-bearer-only'),
    'Protected admission E2E proof: signed bearer only no-go is recorded',
  );
  ok(
    result.noGoConditions.includes('sender-proof-replay-not-proven'),
    'Protected admission E2E proof: sender proof replay no-go is recorded',
  );
}

function testProductionSharedRequiresExternalIssuerAndSharedStores(): void {
  const result = evaluateProtectedAdmissionE2eProofPlan(
    baseInput({
      runtimeProfileId: 'production-shared',
      issuerBoundary: 'runtime-release-token-issuer',
      dpopProofReplayStoreDurability: 'local',
      introspectionStoreDurability: 'local',
      tokenUseReplayStoreDurability: 'local',
    }),
  );

  equal(
    result.proofPlanSatisfied,
    false,
    'Protected admission E2E proof: production-shared does not clear with local stores',
  );
  for (const blocker of [
    'production-issuer-boundary-not-external',
    'production-dpop-proof-replay-store-not-shared',
    'production-introspection-store-not-shared',
    'production-token-use-replay-store-not-shared',
  ] as const) {
    ok(
      result.blockers.includes(blocker),
      `Protected admission E2E proof: production-shared blocker ${blocker} is explicit`,
    );
  }
  ok(
    result.noGoConditions.includes('production-shared-not-proven'),
    'Protected admission E2E proof: production-shared no-go is explicit',
  );

  const shared = evaluateProtectedAdmissionE2eProofPlan(
    baseInput({
      runtimeProfileId: 'production-shared',
      issuerBoundary: 'external-kms-hsm',
      externalIssuerProofValid: true,
      dpopProofReplayStoreDurability: 'shared',
      introspectionStoreDurability: 'shared',
      tokenUseReplayStoreDurability: 'shared',
    }),
  );
  equal(
    shared.proofPlanSatisfied,
    true,
    'Protected admission E2E proof: production-shared route contract can clear only with shared stores and external issuer proof',
  );
  equal(
    shared.productionReady,
    false,
    'Protected admission E2E proof: production-shared route contract still avoids production readiness claim',
  );
}

function testR4AndRawMaterialGapsBlockPlan(): void {
  const result = evaluateProtectedAdmissionE2eProofPlan(
    baseInput({
      riskClass: 'R4',
      signerRefDistinct: false,
      rawDpopProofStored: true,
      rawReleaseTokenStored: true,
      rawDownstreamPayloadStored: true,
    }),
  );

  ok(
    result.blockers.includes('r4-distinct-signer-missing'),
    'Protected admission E2E proof: R4 distinct signer blocker is explicit',
  );
  ok(
    result.blockers.includes('raw-dpop-proof-storage-risk'),
    'Protected admission E2E proof: raw DPoP proof storage blocker is explicit',
  );
  ok(
    result.blockers.includes('raw-release-token-storage-risk'),
    'Protected admission E2E proof: raw token storage blocker is explicit',
  );
  ok(
    result.blockers.includes('raw-downstream-payload-storage-risk'),
    'Protected admission E2E proof: raw downstream payload storage blocker is explicit',
  );
  ok(
    result.noGoConditions.includes('raw-material-storage-risk'),
    'Protected admission E2E proof: raw material no-go is explicit',
  );
}

function testDocsPackageAndTrackerStayAligned(): void {
  const planDoc = readProjectFile(
    'docs',
    '02-architecture',
    'protected-admission-e2e-proof-plan.md',
  );
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const researchLedger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    planDoc,
    'admission -> DPoP-bound release token -> introspection -> token-use replay -> customer PEP -> downstream receipt',
    'Protected admission E2E proof: plan doc records the chain',
  );
  includes(
    planDoc,
    'signed bearer helper is not sufficient',
    'Protected admission E2E proof: plan doc rejects signed bearer sufficiency',
  );
  includes(
    tracker,
    '| 05 | complete | Protected admission end-to-end proof plan |',
    'Protected admission E2E proof: unlock tracker marks step 05 complete',
  );
  includes(
    researchLedger,
    '### 46. Protected Admission End-To-End Proof Plan',
    'Protected admission E2E proof: research ledger entry exists',
  );
  equal(
    packageJson.scripts['test:protected-admission-e2e-proof-plan'],
    'tsx tests/protected-admission-e2e-proof-plan.test.ts',
    'Protected admission E2E proof: package script is registered',
  );
}

testDescriptorDefinesOrderedProofChain();
testCompleteNarrowFixtureSatisfiesRepositoryPlan();
testSignedBearerOnlyPathFailsClosed();
testProductionSharedRequiresExternalIssuerAndSharedStores();
testR4AndRawMaterialGapsBlockPlan();
testDocsPackageAndTrackerStayAligned();

console.log(`Protected admission E2E proof-plan tests: ${passed} passed, 0 failed`);
