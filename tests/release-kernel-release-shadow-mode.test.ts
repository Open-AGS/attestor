import { strict as assert } from 'node:assert';
import { createReleasePolicyDefinition } from '../src/release-kernel/release-policy.js';
import { createReleaseDecisionEngine } from '../src/release-kernel/release-decision-engine.js';
import { createShadowModeReleaseEvaluator } from '../src/release-kernel/release-shadow-mode.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function makeRecordRequest() {
  return {
    id: 'shadow_record_001',
    createdAt: '2026-04-17T19:00:00.000Z',
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: 'financial-reporting.record-field',
      expectedShape: 'structured financial record payload',
      consequenceType: 'record' as const,
      riskClass: 'R4' as const,
    },
    capabilityBoundary: {
      allowedTools: ['xbrl-export'],
      allowedTargets: ['sec.edgar.filing.prepare'],
      allowedDataDomains: ['financial-reporting'],
    },
    requester: {
      id: 'svc.reporting-bot',
      type: 'service' as const,
    },
    target: {
      kind: 'record-store' as const,
      id: 'finance.reporting.record-store',
    },
  };
}

function makePassingObservation() {
  return {
    actualArtifactType: 'financial-reporting.record-field',
    actualShape: 'structured financial record payload',
    observedTargetId: 'finance.reporting.record-store',
    usedTools: ['xbrl-export'],
    usedDataDomains: ['financial-reporting'],
    observedOutputHash: 'sha256:output',
    observedConsequenceHash: 'sha256:consequence',
    policyRulesSatisfied: true,
    evidenceKinds: ['trace', 'finding-log', 'signature', 'provenance'],
    traceGradePassed: true,
    provenanceBound: true,
    downstreamReceiptConfirmed: true,
  };
}

async function main(): Promise<void> {
  const defaultEvaluator = createShadowModeReleaseEvaluator();
  const defaultResult = defaultEvaluator.evaluate(makeRecordRequest(), makePassingObservation());

  equal(
    defaultResult.mode,
    'shadow',
    'Release shadow mode: evaluations are explicitly tagged as shadow-mode decisions',
  );
  ok(
    defaultResult.passThrough,
    'Release shadow mode: shadow evaluation never blocks the downstream path directly',
  );
  equal(
    defaultResult.enforcementReadiness,
    'hard-gate-eligible',
    'Release shadow mode: the finance record wedge is recognized as hard-gate-eligible',
  );
  equal(
    defaultResult.policyRolloutMode,
    'enforce',
    'Release shadow mode: the default finance record policy reports enforce rollout state explicitly',
  );
  equal(
    defaultResult.policyEvaluationMode,
    'enforce',
    'Release shadow mode: the default finance record policy is actively enforced rather than only shadowed',
  );
  equal(
    defaultResult.wouldDecisionStatus,
    'review-required',
    'Release shadow mode: the shadow verdict still preserves the underlying would-decision status',
  );
  ok(
    defaultResult.wouldRequireReview,
    'Release shadow mode: shadow evaluation surfaces that R4 structured record release still needs human review',
  );
  ok(
    defaultResult.wouldRequireToken,
    'Release shadow mode: shadow evaluation surfaces that a downstream release token would be required at enforcement time',
  );
  ok(
    defaultResult.wouldBlockIfEnforced,
    'Release shadow mode: review-required outcomes are marked as would-block under hard enforcement',
  );
  ok(
    defaultResult.policyWouldBlock,
    'Release shadow mode: policy would-block state is visible independently from rollout readiness',
  );
  equal(
    defaultResult.outcome,
    'pass-through-with-warning',
    'Release shadow mode: non-ready release outcomes still pass through, but only with warning semantics',
  );
  equal(
    defaultResult.auditAnnotations['attestor.io/shadow-mode'],
    'true',
    'Release shadow mode: audit annotations explicitly mark shadow-mode execution',
  );

  const lowRiskPolicy = createReleasePolicyDefinition({
    id: 'ops.record-release.r1.v1',
    name: 'Low-risk operational record shadow policy',
    scope: {
      wedgeId: 'ops.record-release',
      consequenceType: 'record',
      riskClass: 'R1',
      targetKinds: ['record-store'],
      dataDomains: ['ops'],
    },
    outputContract: {
      allowedArtifactTypes: ['ops.record'],
      expectedShape: 'structured ops record payload',
      consequenceType: 'record',
      riskClass: 'R1',
    },
    capabilityBoundary: {
      allowedTools: ['ops-write'],
      allowedTargets: ['ops.record-store'],
      allowedDataDomains: ['ops'],
      requiresSingleTargetBinding: true,
    },
    acceptance: {
      strategy: 'all-required',
      requiredChecks: ['contract-shape', 'target-binding'],
      requiredEvidenceKinds: ['trace'],
      maxWarnings: 0,
      failureDisposition: 'deny',
    },
    release: {
      reviewMode: 'auto',
      minimumReviewerCount: 0,
      tokenEnforcement: 'optional',
      requireSignedEnvelope: false,
      requireDurableEvidencePack: false,
      requireDownstreamReceipt: false,
      retentionClass: 'standard',
    },
    notes: ['Low-risk shadow calibration path.'],
  });

  const lowRiskEngine = createReleaseDecisionEngine({ policies: [lowRiskPolicy] });
  const lowRiskEvaluator = createShadowModeReleaseEvaluator({ engine: lowRiskEngine });
  const lowRiskResult = lowRiskEvaluator.evaluate(
    {
      id: 'shadow_low_risk_001',
      createdAt: '2026-04-17T19:05:00.000Z',
      outputHash: 'sha256:output-low-risk',
      consequenceHash: 'sha256:consequence-low-risk',
      outputContract: {
        artifactType: 'ops.record',
        expectedShape: 'structured ops record payload',
        consequenceType: 'record',
        riskClass: 'R1',
      },
      capabilityBoundary: {
        allowedTools: ['ops-write'],
        allowedTargets: ['ops.record-store'],
        allowedDataDomains: ['ops'],
      },
      requester: {
        id: 'svc.ops-bot',
        type: 'service',
      },
      target: {
        kind: 'record-store',
        id: 'ops.record-store',
      },
    },
    {
      actualArtifactType: 'ops.record',
      actualShape: 'structured ops record payload',
      observedTargetId: 'ops.record-store',
      usedTools: ['ops-write'],
      usedDataDomains: ['ops'],
      observedOutputHash: 'sha256:output-low-risk',
      observedConsequenceHash: 'sha256:consequence-low-risk',
      policyRulesSatisfied: true,
      evidenceKinds: ['trace'],
    },
  );

  equal(
    lowRiskResult.wouldDecisionStatus,
    'accepted',
    'Release shadow mode: low-risk auto-release paths still show accepted as the underlying would-decision',
  );
  ok(
    !lowRiskResult.wouldBlockIfEnforced,
    'Release shadow mode: accepted low-risk paths are not treated as would-block under hard enforcement',
  );
  ok(
    !lowRiskResult.policyWouldBlock,
    'Release shadow mode: accepted low-risk paths do not report policy would-block',
  );
  ok(
    !lowRiskResult.wouldRequireReview,
    'Release shadow mode: auto-release paths do not claim human review is required',
  );
  ok(
    !lowRiskResult.wouldRequireToken,
    'Release shadow mode: low-risk auto-release paths do not overstate token requirements when the active control profile keeps tokens optional',
  );

  const advisoryPolicy = createReleasePolicyDefinition({
    id: 'support.decision-advisory.v1',
    name: 'Decision support advisory policy',
    scope: {
      wedgeId: 'support-decision-advisory',
      consequenceType: 'decision-support',
      riskClass: 'R2',
      targetKinds: ['queue'],
      dataDomains: ['support'],
    },
    outputContract: {
      allowedArtifactTypes: ['support.advisory'],
      expectedShape: 'advisory memo',
      consequenceType: 'decision-support',
      riskClass: 'R2',
    },
    capabilityBoundary: {
      allowedTools: ['assist'],
      allowedTargets: ['support.review.queue'],
      allowedDataDomains: ['support'],
      requiresSingleTargetBinding: true,
    },
    acceptance: {
      strategy: 'all-required',
      requiredChecks: [
        'contract-shape',
        'target-binding',
        'capability-boundary',
        'consequence-hash-integrity',
        'policy-rule-validation',
      ],
      requiredEvidenceKinds: ['trace'],
      maxWarnings: 0,
      failureDisposition: 'deny',
    },
    release: {
      reviewMode: 'auto',
      minimumReviewerCount: 0,
      tokenEnforcement: 'required',
      requireSignedEnvelope: false,
      requireDurableEvidencePack: false,
      requireDownstreamReceipt: false,
      retentionClass: 'standard',
    },
  });
  const advisoryEvaluator = createShadowModeReleaseEvaluator({
    engine: createReleaseDecisionEngine({ policies: [advisoryPolicy] }),
  });
  const advisoryResult = advisoryEvaluator.evaluate(
    {
      id: 'shadow_advisory_denied_001',
      createdAt: '2026-04-17T19:07:00.000Z',
      outputHash: 'sha256:advisory-output',
      consequenceHash: 'sha256:advisory-consequence',
      outputContract: {
        artifactType: 'support.advisory',
        expectedShape: 'advisory memo',
        consequenceType: 'decision-support',
        riskClass: 'R2',
      },
      capabilityBoundary: {
        allowedTools: ['assist'],
        allowedTargets: ['support.review.queue'],
        allowedDataDomains: ['support'],
      },
      requester: {
        id: 'svc.support-bot',
        type: 'service',
      },
      target: {
        kind: 'queue',
        id: 'support.review.queue',
      },
    },
    {
      actualArtifactType: 'support.freeform-note',
      actualShape: 'free-form note',
      observedTargetId: 'support.review.queue',
      usedTools: ['assist'],
      usedDataDomains: ['support'],
      observedOutputHash: 'sha256:advisory-output',
      observedConsequenceHash: 'sha256:advisory-consequence',
      policyRulesSatisfied: true,
      evidenceKinds: ['trace'],
    },
  );
  equal(
    advisoryResult.enforcementReadiness,
    'advisory-only',
    'Release shadow mode: decision-support remains advisory-only without a downstream release boundary',
  );
  ok(
    !advisoryResult.wouldBlockIfEnforced,
    'Release shadow mode: advisory-only readiness does not claim current hard enforcement',
  );
  ok(
    advisoryResult.policyWouldBlock,
    'Release shadow mode: advisory-only readiness still preserves computed policy would-block risk',
  );
  equal(
    advisoryResult.auditAnnotations['attestor.io/policy-would-block'],
    'true',
    'Release shadow mode: audit annotations preserve policy would-block separately',
  );

  const dryRunPolicy = createReleasePolicyDefinition({
    id: 'ops.record-release.r2.dry-run.v1',
    name: 'Ops structured record dry-run shadow policy',
    rollout: {
      mode: 'dry-run',
      activatedAt: '2026-04-17T20:25:00.000Z',
    },
    scope: {
      wedgeId: 'ops.record-release',
      consequenceType: 'record',
      riskClass: 'R2',
      targetKinds: ['record-store'],
      dataDomains: ['ops'],
    },
    outputContract: {
      allowedArtifactTypes: ['ops.record'],
      expectedShape: 'structured ops record payload',
      consequenceType: 'record',
      riskClass: 'R2',
    },
    capabilityBoundary: {
      allowedTools: ['ops-write'],
      allowedTargets: ['ops.record-store'],
      allowedDataDomains: ['ops'],
      requiresSingleTargetBinding: true,
    },
    acceptance: {
      strategy: 'all-required',
      requiredChecks: [
        'contract-shape',
        'target-binding',
        'capability-boundary',
        'consequence-hash-integrity',
        'policy-rule-validation',
      ],
      requiredEvidenceKinds: ['trace'],
      maxWarnings: 0,
      failureDisposition: 'hold',
    },
    release: {
      reviewMode: 'auto',
      minimumReviewerCount: 0,
      tokenEnforcement: 'required',
      requireSignedEnvelope: false,
      requireDurableEvidencePack: false,
      requireDownstreamReceipt: false,
      retentionClass: 'standard',
    },
    notes: ['Dry-run rollout proof path.'],
  });

  const dryRunEngine = createReleaseDecisionEngine({ policies: [dryRunPolicy] });
  const dryRunEvaluator = createShadowModeReleaseEvaluator({ engine: dryRunEngine });
  const dryRunResult = dryRunEvaluator.evaluate(
    {
      id: 'shadow_dry_run_001',
      createdAt: '2026-04-17T19:10:00.000Z',
      outputHash: 'sha256:output-dry-run',
      consequenceHash: 'sha256:consequence-dry-run',
      outputContract: {
        artifactType: 'ops.record',
        expectedShape: 'structured ops record payload',
        consequenceType: 'record',
        riskClass: 'R2',
      },
      capabilityBoundary: {
        allowedTools: ['ops-write'],
        allowedTargets: ['ops.record-store'],
        allowedDataDomains: ['ops'],
      },
      requester: {
        id: 'svc.ops-bot',
        type: 'service',
      },
      target: {
        kind: 'record-store',
        id: 'ops.record-store',
      },
    },
    {
      actualArtifactType: 'ops.record',
      actualShape: 'structured ops record payload',
      observedTargetId: 'ops.record-store',
      usedTools: ['ops-write'],
      usedDataDomains: ['ops'],
      observedOutputHash: 'sha256:output-dry-run',
      observedConsequenceHash: 'sha256:consequence-dry-run',
      policyRulesSatisfied: true,
      evidenceKinds: ['trace'],
    },
  );

  equal(
    dryRunResult.policyRolloutMode,
    'dry-run',
    'Release shadow mode: shadow surface carries the matched policy rollout mode',
  );
  equal(
    dryRunResult.policyEvaluationMode,
    'shadow',
    'Release shadow mode: dry-run rollout keeps the current request in shadow evaluation mode',
  );
  equal(
    dryRunResult.auditAnnotations['attestor.io/policy-rollout-mode'],
    'dry-run',
    'Release shadow mode: audit annotations capture the rollout mode for later analysis',
  );
  ok(
    dryRunResult.signals.some((signal) => signal.code === 'shadow_rollout_dry_run'),
    'Release shadow mode: dry-run rollout surfaces an explicit rollout warning signal',
  );

  console.log(`\nRelease kernel release-shadow-mode tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel release-shadow-mode tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
