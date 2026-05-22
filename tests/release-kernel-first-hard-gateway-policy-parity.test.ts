import { strict as assert } from 'node:assert';
import { firstHardGatewayWedge } from '../src/release-kernel/first-hard-gateway-wedge.js';
import { createReleaseDecisionEngine } from '../src/release-kernel/release-decision-engine.js';
import { createFirstHardGatewayReleasePolicy } from '../src/release-kernel/release-policy.js';
import { riskControlProfile } from '../src/release-kernel/risk-controls.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

async function main(): Promise<void> {
  const wedge = firstHardGatewayWedge();
  const policy = createFirstHardGatewayReleasePolicy();
  const riskControls = riskControlProfile(wedge.defaultRiskClass);

  equal(policy.scope.wedgeId, wedge.id, 'First hard gateway parity: policy scope is anchored to the frozen wedge id');
  equal(
    policy.scope.consequenceType,
    wedge.consequenceType,
    'First hard gateway parity: policy consequence type matches the frozen wedge',
  );
  equal(
    policy.scope.riskClass,
    wedge.defaultRiskClass,
    'First hard gateway parity: policy risk class matches the frozen wedge default',
  );
  deepEqual(
    policy.scope.targetKinds,
    wedge.targetKinds,
    'First hard gateway parity: policy target kinds match the frozen wedge targets',
  );
  equal(
    policy.outputContract.consequenceType,
    wedge.consequenceType,
    'First hard gateway parity: output contract consequence type stays wedge-bound',
  );
  equal(
    policy.outputContract.riskClass,
    wedge.defaultRiskClass,
    'First hard gateway parity: output contract risk class stays wedge-bound',
  );
  equal(policy.rollout.mode, 'enforce', 'First hard gateway parity: first policy stays fail-closed in enforce mode');
  equal(
    policy.capabilityBoundary.requiresSingleTargetBinding,
    true,
    'First hard gateway parity: first policy requires a single target binding',
  );
  deepEqual(
    policy.acceptance.requiredChecks,
    riskControls.deterministicChecks,
    'First hard gateway parity: required deterministic checks come from the R4 risk-control profile',
  );
  deepEqual(
    policy.acceptance.requiredEvidenceKinds,
    ['trace', 'finding-log', 'signature', 'provenance'],
    'First hard gateway parity: first policy keeps trace, finding, signature, and provenance evidence requirements',
  );
  equal(
    policy.acceptance.failureDisposition,
    riskControls.review.failureDisposition,
    'First hard gateway parity: failure disposition matches the R4 risk-control profile',
  );
  equal(
    policy.release.reviewMode,
    riskControls.review.mode,
    'First hard gateway parity: review mode matches the R4 risk-control profile',
  );
  equal(
    policy.release.minimumReviewerCount,
    riskControls.review.minimumReviewerCount,
    'First hard gateway parity: reviewer count matches the R4 risk-control profile',
  );
  equal(
    policy.release.tokenEnforcement,
    riskControls.token.minimumEnforcement,
    'First hard gateway parity: token enforcement matches the R4 risk-control profile',
  );
  equal(
    policy.release.requireSignedEnvelope,
    true,
    'First hard gateway parity: first policy requires a signed release envelope',
  );
  equal(
    policy.release.requireDurableEvidencePack,
    riskControls.evidence.requiresDurableEvidencePack,
    'First hard gateway parity: durable evidence pack requirement matches R4 evidence controls',
  );
  equal(
    policy.release.requireDownstreamReceipt,
    riskControls.evidence.requiresDownstreamReceipt,
    'First hard gateway parity: downstream receipt requirement matches R4 evidence controls',
  );
  equal(
    policy.release.retentionClass,
    riskControls.evidence.retentionClass,
    'First hard gateway parity: retention class matches R4 evidence controls',
  );

  const engine = createReleaseDecisionEngine();
  const result = engine.evaluate({
    id: 'first-hard-gateway-policy-parity',
    createdAt: '2026-04-17T00:00:00.000Z',
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: policy.outputContract.allowedArtifactTypes[0] ?? '',
      expectedShape: policy.outputContract.expectedShape,
      consequenceType: wedge.consequenceType,
      riskClass: wedge.defaultRiskClass,
    },
    capabilityBoundary: {
      allowedTools: ['xbrl-export'],
      allowedTargets: ['finance.reporting.record-store'],
      allowedDataDomains: ['financial-reporting'],
    },
    requester: {
      id: 'svc.first-hard-gateway-policy-parity',
      type: 'service',
    },
    target: {
      kind: 'record-store',
      id: 'finance.reporting.record-store',
    },
  });

  equal(result.policyMatched, true, 'First hard gateway parity: default release engine matches the first policy');
  equal(result.matchedPolicyId, policy.id, 'First hard gateway parity: default engine resolves the first policy id');
  deepEqual(
    result.plan.pendingChecks,
    riskControls.deterministicChecks,
    'First hard gateway parity: default engine plan inherits the first policy deterministic checks',
  );
  deepEqual(
    result.plan.pendingEvidenceKinds,
    policy.acceptance.requiredEvidenceKinds,
    'First hard gateway parity: default engine plan inherits the first policy evidence kinds',
  );
  ok(result.plan.requiresReview, 'First hard gateway parity: default engine requires review for the R4 first policy');

  console.log(`\nRelease kernel first-hard-gateway policy parity tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel first-hard-gateway policy parity tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
