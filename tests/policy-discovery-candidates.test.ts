import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  type ShadowAdmissionEvent,
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

function event(input: {
  readonly action: string;
  readonly domain: string;
  readonly downstreamSystem: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'support-ai-agent',
      action: input.action,
      domain: input.domain,
      downstreamSystem: input.downstreamSystem,
      requestedAt: '2026-05-01T22:40:00.000Z',
      decidedAt: '2026-05-01T22:40:01.000Z',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      recipient: 'raw_recipient_must_not_escape',
      authoritySources: [
        {
          sourceKind: 'authority-record',
          claimKind: 'authorization',
          sourceRef: `authority:${input.action}`,
          trustClass: 'trusted-authority',
          evidenceDigest: `sha256:authority-${input.action}`,
        },
      ],
      observedFeatures: input.observedFeatures ?? {},
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
    observedFeatures: {
      secretMarker: 'raw_feature_must_not_escape',
    },
  });
}

function testDiscoveryCandidatesRequireApprovalAndDoNotEnforce(): void {
  const report = createShadowPolicySimulationReport({
    events: [
      event({
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        occurredAt: '2026-05-01T22:40:02.000Z',
      }),
      event({
        action: 'submit_transaction',
        domain: 'programmable-money',
        downstreamSystem: 'wallet-rpc',
        policyRef: 'policy:wallet:v1',
        evidenceRefs: ['intent:123'],
        observedFeatures: {
          policyBlocked: true,
          adapterReady: true,
        },
        occurredAt: '2026-05-01T22:41:02.000Z',
        humanOutcome: 'rejected',
      }),
      ...Array.from({ length: 5 }, (_, index) =>
        event({
          action: 'rotate_secret',
          domain: 'system-operation',
          downstreamSystem: 'secret-manager',
          policyRef: 'policy:ops:v1',
          evidenceRefs: [`change:${index}`],
          occurredAt: `2026-05-01T22:5${index}:02.000Z`,
        }),
      ),
    ],
    proposedMode: 'review',
    generatedAt: '2026-05-01T23:00:00.000Z',
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-01T23:01:00.000Z',
  });
  const serialized = JSON.stringify(bundle);
  const policyCandidate = bundle.candidates.find((candidate) =>
    candidate.actionSurface === 'refund-service.issue_refund'
  );
  const blockCandidate = bundle.candidates.find((candidate) =>
    candidate.actionSurface === 'wallet-rpc.submit_transaction'
  );
  const promotionCandidate = bundle.candidates.find((candidate) =>
    candidate.actionSurface === 'secret-manager.rotate_secret'
  );

  equal(bundle.version, 'attestor.shadow-policy-discovery-candidates.v1', 'Policy discovery: version is explicit');
  equal(bundle.sourceReportId, report.reportId, 'Policy discovery: source report id is retained');
  equal(bundle.sourceReportDigest, report.digest, 'Policy discovery: source report digest is retained');
  equal(bundle.approvalRequired, true, 'Policy discovery: approval is required at bundle level');
  equal(bundle.autoEnforce, false, 'Policy discovery: bundle never auto-enforces');
  equal(bundle.rawPayloadStored, false, 'Policy discovery: raw payload boundary is explicit');
  ok(bundle.candidateCount >= 3, 'Policy discovery: candidates are generated');
  equal(policyCandidate?.action, 'draft-policy', 'Policy discovery: policy gap becomes draft-policy candidate');
  equal(policyCandidate?.proposedMode, 'observe', 'Policy discovery: missing policy stays in observe mode');
  equal(policyCandidate?.approvalRequired, true, 'Policy discovery: candidate requires approval');
  equal(policyCandidate?.autoEnforce, false, 'Policy discovery: candidate does not enforce');
  ok(policyCandidate?.requiredControls.includes('policy'), 'Policy discovery: policy closure is required');
  ok(policyCandidate?.requiredControls.includes('customer-approval'), 'Policy discovery: customer approval is required');
  equal(blockCandidate?.action, 'investigate-blocks', 'Policy discovery: rejected/block traffic requires investigation');
  equal(blockCandidate?.highestSeverity, 'blocker', 'Policy discovery: block candidate is blocker severity');
  equal(promotionCandidate?.action, 'enforce-mode-rehearsal', 'Policy discovery: clean traffic can become rehearsal candidate');
  equal(promotionCandidate?.proposedMode, 'enforce', 'Policy discovery: clean traffic proposes enforce rehearsal');
  ok(bundle.digest.startsWith('sha256:'), 'Policy discovery: digest is generated');
  ok(!serialized.includes('raw_recipient_must_not_escape'), 'Policy discovery: raw recipient is not serialized');
  ok(!serialized.includes('raw_feature_must_not_escape'), 'Policy discovery: raw feature value is not serialized');
  ok(!serialized.includes('intent:123'), 'Policy discovery: raw evidence id is not serialized');
}

function testEmptyDiscoveryBundleIsExplicit(): void {
  const bundle = createShadowPolicyDiscoveryCandidates({
    report: null,
    generatedAt: '2026-05-01T23:02:00.000Z',
  });

  equal(bundle.sourceReportId, null, 'Policy discovery: empty bundle has no source report id');
  equal(bundle.sourceReportDigest, null, 'Policy discovery: empty bundle has no source digest');
  equal(bundle.candidateCount, 0, 'Policy discovery: empty bundle has zero candidates');
  equal(bundle.candidates.length, 0, 'Policy discovery: empty candidate list is explicit');
  equal(bundle.approvalRequired, true, 'Policy discovery: approval boundary remains explicit when empty');
  equal(bundle.autoEnforce, false, 'Policy discovery: empty bundle still never auto-enforces');
}

function testCandidateSummaryTracksWinningAction(): void {
  const report = createShadowPolicySimulationReport({
    events: [
      event({
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        occurredAt: '2026-05-01T22:42:02.000Z',
      }),
      event({
        action: 'issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        policyRef: 'policy:refunds:v1',
        evidenceRefs: ['ticket:block'],
        observedFeatures: {
          policyBlocked: true,
        },
        occurredAt: '2026-05-01T22:43:02.000Z',
        humanOutcome: 'rejected',
      }),
    ],
    proposedMode: 'review',
    generatedAt: '2026-05-01T23:03:00.000Z',
  });
  const bundle = createShadowPolicyDiscoveryCandidates({
    report,
    generatedAt: '2026-05-01T23:04:00.000Z',
  });
  const candidate = bundle.candidates.find((item) =>
    item.actionSurface === 'refund-service.issue_refund'
  );

  equal(candidate?.action, 'investigate-blocks', 'Policy discovery: highest-priority action wins');
  ok(
    candidate?.summary.includes('would block or were rejected by humans'),
    'Policy discovery: candidate summary describes the winning action',
  );
  ok(
    candidate?.sourceRecommendationKinds.includes('define-policy') &&
      candidate.sourceRecommendationKinds.includes('investigate-blocks'),
    'Policy discovery: source recommendation kinds retain all contributing signals',
  );
}

testDiscoveryCandidatesRequireApprovalAndDoNotEnforce();
testEmptyDiscoveryBundleIsExplicit();
testCandidateSummaryTracksWinningAction();

console.log(`Policy discovery candidate tests: ${passed} passed, 0 failed`);
