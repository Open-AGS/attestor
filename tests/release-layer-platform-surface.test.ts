import assert from 'node:assert/strict';
import {
  RELEASE_LAYER_EXTRACTION_CRITERIA,
  RELEASE_LAYER_FINANCE_PUBLIC_SUBPATH,
  RELEASE_LAYER_PLATFORM_SURFACE_SPEC_VERSION,
  RELEASE_LAYER_PUBLIC_SUBPATH,
  releaseLayer,
  releaseLayerPublicSurface,
  type ReleaseEvidencePackVerificationResult,
  type ReleaseVerificationPolicyContext,
  type ReleaseVerificationInput,
} from '../src/release-layer/index.js';
import {
  RELEASE_LAYER_FINANCE_SURFACE_SPEC_VERSION,
  financeReleaseLayer,
  financeReleaseLayerPublicSurface,
} from '../src/release-layer/finance.js';

function testReleaseLayerPublicSurfaceDescriptor(): void {
  const descriptor = releaseLayerPublicSurface();

  assert.equal(descriptor.version, RELEASE_LAYER_PLATFORM_SURFACE_SPEC_VERSION);
  assert.equal(descriptor.packageName, 'attestor');
  assert.equal(descriptor.subpaths.core, RELEASE_LAYER_PUBLIC_SUBPATH);
  assert.equal(descriptor.subpaths.finance, RELEASE_LAYER_FINANCE_PUBLIC_SUBPATH);
  assert.deepEqual(descriptor.namespaceExports, [
    'vocabulary',
    'model',
    'consequences',
    'risk',
    'wedge',
    'policyRollout',
    'policy',
    'decision',
    'decisionLog',
    'deterministicChecks',
    'compiledPolicyIr',
    'compiledPolicyIndex',
    'shadow',
    'canonicalization',
    'token',
    'verification',
    'introspection',
    'evidence',
    'review',
  ]);
  assert.ok(
    descriptor.extractionCriteria.some((criterion) => criterion.status === 'pending'),
    'expected at least one extraction criterion to remain pending',
  );
  assert.equal(
    RELEASE_LAYER_EXTRACTION_CRITERIA.filter((criterion) => criterion.status === 'ready').length,
    4,
  );
}

function testReleaseLayerNamespaceBindings(): void {
  assert.equal(
    releaseLayer.compiledPolicyIr.COMPILED_ADMISSION_POLICY_IR_VERSION,
    'attestor.compiled-admission-policy-ir.v1',
  );
  assert.equal(
    releaseLayer.compiledPolicyIndex.COMPILED_ADMISSION_POLICY_INDEX_VERSION,
    'attestor.compiled-admission-policy-index.v1',
  );
  assert.equal(
    releaseLayer.token.RELEASE_TOKEN_ISSUANCE_SPEC_VERSION,
    'attestor.release-token-issuance.v1',
  );
  assert.equal(
    releaseLayer.verification.RELEASE_VERIFICATION_SPEC_VERSION,
    'attestor.release-verification.v1',
  );
  const provenanceBoundVerification = {
    token: 'release-token',
    verificationKey: {} as ReleaseVerificationInput['verificationKey'],
    expectedPolicyHash: 'sha256:policy',
    expectedPolicyVersion: 'policy.release-layer-surface.v1',
    expectedPolicyIrHash: 'sha256:policy-ir',
    expectedPolicyProvenanceSource: 'compiled-admission-policy-index',
    expectedCompiledPolicyIndexVersion: 'attestor.compiled-admission-policy-index.v1',
    expectedCompiledPolicyIrVersion: 'attestor.compiled-admission-policy-ir.v1',
  } satisfies ReleaseVerificationInput;
  assert.equal(
    provenanceBoundVerification.expectedPolicyProvenanceSource,
    'compiled-admission-policy-index',
    'release-layer surface exposes full policy-provenance-bound verification input',
  );
  const verifiedPolicyContext = {
    policyVersion: 'policy.release-layer-surface.v1',
    policyHash: 'sha256:policy',
    policyIrHash: 'sha256:policy-ir',
    policyProvenanceSource: 'compiled-admission-policy-index',
    compiledPolicyIndexVersion: 'attestor.compiled-admission-policy-index.v1',
    compiledPolicyIrVersion: 'attestor.compiled-admission-policy-ir.v1',
  } satisfies ReleaseVerificationPolicyContext;
  assert.equal(
    verifiedPolicyContext.compiledPolicyIndexVersion,
    'attestor.compiled-admission-policy-index.v1',
    'release-layer surface exposes direct verified token policy provenance context',
  );
  assert.equal(
    typeof releaseLayer.verification.createReleaseVerificationMiddleware,
    'function',
    'release-layer surface exposes downstream verification middleware through the verification namespace',
  );
  assert.equal(
    releaseLayer.evidence.RELEASE_EVIDENCE_PACK_ISSUANCE_SPEC_VERSION,
    'attestor.release-evidence-pack-issuance.v1',
  );
  const evidenceVerification = {
    version: 'attestor.release-evidence-pack-verification.v1',
    valid: true,
    evidencePackId: 'ep_release_layer_surface',
    decisionId: 'rd_release_layer_surface',
    decisionStatus: 'accepted',
    consequenceType: 'record',
    riskClass: 'R4',
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    policyVersion: 'policy.release-layer-surface.v1',
    policyHash: 'sha256:policy',
    policyIrHash: 'sha256:policy-ir',
    policyProvenanceSource: 'compiled-admission-policy-index',
    compiledPolicyIndexVersion: 'attestor.compiled-admission-policy-index.v1',
    compiledPolicyIrVersion: 'attestor.compiled-admission-policy-ir.v1',
    releaseTokenId: 'rt_release_layer_surface',
    reviewId: 'rq_release_layer_surface',
    keyId: 'key_release_layer_surface',
    predicateType: 'https://attestor.ai/attestation/release-evidence/v1',
    subjectCount: 2,
    bundleDigest: 'sha256:bundle',
  } satisfies ReleaseEvidencePackVerificationResult;
  assert.equal(
    evidenceVerification.policyProvenanceSource,
    'compiled-admission-policy-index',
    'release-layer surface exposes policy-provenance-bound evidence verification result',
  );
  assert.equal(
    releaseLayer.review.RELEASE_REVIEWER_QUEUE_SPEC_VERSION,
    'attestor.release-reviewer-queue.v2',
  );
}

function testFinanceReleaseLayerSurface(): void {
  const descriptor = financeReleaseLayerPublicSurface();

  assert.equal(descriptor.version, RELEASE_LAYER_FINANCE_SURFACE_SPEC_VERSION);
  assert.equal(descriptor.subpath, RELEASE_LAYER_FINANCE_PUBLIC_SUBPATH);
  assert.deepEqual(descriptor.wedges, ['record', 'communication', 'action']);
  assert.equal(
    financeReleaseLayer.record.FINANCE_RECORD_RELEASE_SPEC_VERSION,
    'attestor.finance-record-release.v1',
  );
  assert.equal(
    financeReleaseLayer.communication.FINANCE_COMMUNICATION_RELEASE_SPEC_VERSION,
    'attestor.finance-communication-release.v1',
  );
  assert.equal(
    financeReleaseLayer.action.FINANCE_ACTION_RELEASE_SPEC_VERSION,
    'attestor.finance-action-release.v1',
  );
  assert.equal(
    financeReleaseLayer.policies
      .createRecordReleasePolicy()
      .capabilityBoundary.allowedTargets.includes(
        financeReleaseLayer.record.FINANCE_FILING_PREPARE_TARGET_ID,
      ),
    true,
  );
}

testReleaseLayerPublicSurfaceDescriptor();
testReleaseLayerNamespaceBindings();
testFinanceReleaseLayerSurface();

console.log('Release layer platform surface tests: 21 passed, 0 failed');
