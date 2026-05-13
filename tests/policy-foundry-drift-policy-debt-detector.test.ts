import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPolicyFoundryDriftPolicyDebtDetector,
  policyFoundryDriftPolicyDebtDetectorDescriptor,
  type PolicyFoundryCandidateRegistry,
  type PolicyFoundryCounterexampleLedger,
  type PolicyFoundryCoverageScore,
  type PolicyFoundryGatePlanner,
  type PolicyFoundryOutcomeFeedbackLoop,
  type PolicyFoundryPolicyTwinSummary,
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

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function coverage(input?: {
  readonly status?: 'review-ready' | 'needs-shadow-traffic' | 'needs-controls';
  readonly blockedDimensions?: readonly string[];
  readonly eventCount?: number;
}): PolicyFoundryCoverageScore {
  return {
    digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    blockedDimensions: input?.blockedDimensions ?? [],
    surfaces: [
      {
        actionSurface: 'refunds.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        status: input?.status ?? 'review-ready',
        eventCount: input?.eventCount ?? 24,
        missingDimensions: input?.blockedDimensions ?? [],
        partialDimensions: [],
      },
    ],
  } as unknown as PolicyFoundryCoverageScore;
}

function registry(input?: {
  readonly missing?: boolean;
}): PolicyFoundryCandidateRegistry {
  return {
    digest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    candidateCount: 1,
    schemaBoundCount: input?.missing ? 0 : 1,
    needsTemplateCount: input?.missing ? 1 : 0,
    blockedCount: 0,
    candidates: [
      {
        actionSurface: input?.missing ? 'custom.unknown_action' : 'refunds.issue_refund',
        schemaStatus: input?.missing ? 'needs-template' : 'schema-bound',
      },
    ],
  } as unknown as PolicyFoundryCandidateRegistry;
}

function gatePlanner(input?: {
  readonly verifierBlocked?: boolean;
}): PolicyFoundryGatePlanner {
  return {
    digest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    plans: [
      {
        actionSurface: 'refunds.issue_refund',
        blockingDimensions: input?.verifierBlocked ? ['verifier-or-gateway'] : [],
      },
    ],
  } as unknown as PolicyFoundryGatePlanner;
}

function ledger(input?: {
  readonly concentrated?: boolean;
  readonly promotionBlocked?: boolean;
  readonly replayDuplicateRate?: number;
}): PolicyFoundryCounterexampleLedger {
  return {
    digest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    actionSurface: 'refunds.issue_refund',
    matchingEventCount: 24,
    counterexampleCount: input?.promotionBlocked ? 2 : 0,
    promotionBlocked: input?.promotionBlocked ?? false,
    singleActorConcentration: input?.concentrated ? 0.95 : 0.25,
    replayDuplicateRate: input?.replayDuplicateRate ?? 0,
    noGoReasons: input?.concentrated ? ['single-actor-concentration'] : [],
  } as unknown as PolicyFoundryCounterexampleLedger;
}

function twin(input?: {
  readonly stale?: boolean;
  readonly promotionBlocked?: boolean;
}): PolicyFoundryPolicyTwinSummary {
  return {
    digest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    actionSurface: 'refunds.issue_refund',
    windowEnd: input?.stale ? '2026-03-01T00:00:00.000Z' : '2026-05-12T00:00:00.000Z',
    promotionBlocked: input?.promotionBlocked ?? false,
    highRiskAutoAdmitCount: input?.promotionBlocked ? 1 : 0,
  } as unknown as PolicyFoundryPolicyTwinSummary;
}

function feedback(input?: {
  readonly negative?: boolean;
}): PolicyFoundryOutcomeFeedbackLoop {
  return {
    digest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    actionSurface: 'refunds.issue_refund',
    noGoReasons: input?.negative ? ['failed-downstream-receipts'] : [],
  } as unknown as PolicyFoundryOutcomeFeedbackLoop;
}

function testCleanDetectorIsReviewMaterialOnly(): void {
  const detector = createPolicyFoundryDriftPolicyDebtDetector({
    generatedAt: '2026-05-13T11:00:00.000Z',
    coverage: coverage(),
    gatePlanner: gatePlanner(),
    candidateRegistry: registry(),
    counterexampleLedger: ledger(),
    policyTwinSummary: twin(),
    outcomeFeedback: feedback(),
  });

  equal(detector.version, 'attestor.policy-foundry-drift-policy-debt-detector.v1', 'Drift detector: version is explicit');
  equal(detector.status, 'clean', 'Drift detector: aligned evidence is clean');
  equal(detector.entryCount, 8, 'Drift detector: all drift/debt entry kinds are evaluated');
  equal(detector.noGoReasons.length, 0, 'Drift detector: clean evidence has no no-go reasons');
  equal(detector.approvalRequired, true, 'Drift detector: approval remains required');
  equal(detector.autoEnforce, false, 'Drift detector: auto enforcement is false');
  equal(detector.productionReady, false, 'Drift detector: production readiness is not claimed');
  equal(detector.reviewMaterialOnly, true, 'Drift detector: output is review material only');
  equal(detector.automaticRemediationAllowed, false, 'Drift detector: automatic remediation is blocked');
  equal(detector.policyMutationAllowed, false, 'Drift detector: policy mutation is blocked');
  equal(detector.deploysInfrastructure, false, 'Drift detector: infrastructure deployment is blocked');
  ok(detector.digest.startsWith('sha256:'), 'Drift detector: digest is generated');
}

function testDebtDetectorFindsNoGoChains(): void {
  const detector = createPolicyFoundryDriftPolicyDebtDetector({
    generatedAt: '2026-05-13T11:00:00.000Z',
    coverage: coverage({
      status: 'needs-shadow-traffic',
      blockedDimensions: ['verifier-or-gateway', 'replay-idempotency'],
      eventCount: 0,
    }),
    gatePlanner: gatePlanner({ verifierBlocked: true }),
    candidateRegistry: registry({ missing: true }),
    counterexampleLedger: ledger({
      concentrated: true,
      promotionBlocked: true,
      replayDuplicateRate: 0.25,
    }),
    policyTwinSummary: twin({ stale: true, promotionBlocked: true }),
    outcomeFeedback: feedback({ negative: true }),
  });
  const serialized = JSON.stringify(detector);

  equal(detector.status, 'no-go', 'Drift detector: blocker chains produce no-go status');
  ok(detector.noGoReasons.includes('unreviewed-new-action-surface'), 'Drift detector: new surface no-go is mapped');
  ok(detector.noGoReasons.includes('missing-verifier-or-gateway'), 'Drift detector: verifier drift no-go is mapped');
  ok(detector.noGoReasons.includes('single-actor-concentration'), 'Drift detector: actor concentration no-go is mapped');
  ok(detector.noGoReasons.includes('policy-shadow-mismatch'), 'Drift detector: policy/shadow mismatch no-go is mapped');
  ok(detector.noGoReasons.includes('negative-outcome-feedback'), 'Drift detector: outcome feedback no-go is mapped');
  ok(detector.noGoReasons.includes('schema-template-unbound'), 'Drift detector: schema/template no-go is mapped');
  ok(detector.noGoReasons.includes('replay-idempotency-drift'), 'Drift detector: replay/idempotency no-go is mapped');
  ok(detector.blockerCount > 0, 'Drift detector: blocker count is retained');
  ok(detector.affectedSurfaceCount > 0, 'Drift detector: affected surfaces are counted');
  excludes(serialized, /raw_prompt|secret=|customer@example\.com/iu, 'Drift detector: serialized output excludes raw markers');
}

function testMissingEvidenceStaysWatchNotReady(): void {
  const detector = createPolicyFoundryDriftPolicyDebtDetector({
    generatedAt: '2026-05-13T11:00:00.000Z',
  });

  equal(detector.status, 'watch', 'Drift detector: missing evidence stays watch');
  ok(detector.watchCount > 0, 'Drift detector: watch entries are counted');
  equal(detector.productionReady, false, 'Drift detector: missing evidence does not claim production readiness');
}

function testDescriptorDocsAndPackageSurfaceStayAligned(): void {
  const descriptor = policyFoundryDriftPolicyDebtDetectorDescriptor();
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const tracker = readProjectFile('docs', '02-architecture', 'policy-foundry-self-onboarding-deepening.md');
  const dataMinDoc = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.version, 'attestor.policy-foundry-drift-policy-debt-detector.v1', 'Drift detector descriptor: version is explicit');
  equal(descriptor.dataMinimizationSurfaceKind, 'policy-foundry-drift-policy-debt-detector', 'Drift detector descriptor: data minimization surface is explicit');
  equal(descriptor.automaticRemediationAllowed, false, 'Drift detector descriptor: automatic remediation is blocked');
  equal(descriptor.policyMutationAllowed, false, 'Drift detector descriptor: policy mutation is blocked');
  equal(descriptor.deploysInfrastructure, false, 'Drift detector descriptor: deploys infrastructure is false');
  includes(doc, 'src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts', 'Policy Foundry docs: drift detector contract is named');
  includes(doc, 'test:policy-foundry-drift-policy-debt-detector', 'Policy Foundry docs: drift detector test command is named');
  includes(dataMinDoc, 'policy-foundry-drift-policy-debt-detector', 'Data minimization docs: drift detector surface is named');
  includes(tracker, 'complete | Add Drift And Policy Debt Detector', 'Deepening tracker: Step 11 is complete');
  includes(tracker, 'attestor.policy-foundry-drift-policy-debt-detector.v1', 'Deepening tracker: drift detector version is named');
  includes(tracker, 'Step 12 is the next implementation step', 'Deepening tracker: Step 12 is next');
  equal(
    pkg.scripts['test:policy-foundry-drift-policy-debt-detector'],
    'tsx tests/policy-foundry-drift-policy-debt-detector.test.ts',
    'Package: drift detector test is exposed',
  );
}

try {
  testCleanDetectorIsReviewMaterialOnly();
  testDebtDetectorFindsNoGoChains();
  testMissingEvidenceStaysWatchNotReady();
  testDescriptorDocsAndPackageSurfaceStayAligned();
  ok(passed > 0, 'Policy Foundry drift/policy debt detector tests executed');
  console.log(`Policy Foundry drift/policy debt detector tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry drift/policy debt detector tests failed:', error);
  process.exitCode = 1;
}
