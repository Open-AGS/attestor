import assert from 'node:assert/strict';
import {
  createGenericAdmissionEnvelope,
  createMoneyMovementShadowPackReport,
  createShadowAdmissionEvent,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const vendorDigest = `sha256:${'a'.repeat(64)}`;
const reviewDigest = `sha256:${'b'.repeat(64)}`;

function createMoneyEvent(input: {
  readonly index: number;
  readonly amountValue?: number;
  readonly mode?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly observedFeatureOrigins?: Readonly<Record<string, 'caller-supplied' | 'operator-attested' | 'customer-gateway' | 'attestor-runtime' | 'trusted-adapter'>>;
  readonly downstreamOutcome?: 'not-observed' | 'proceeded' | 'held' | 'blocked' | 'failed' | 'unknown';
  readonly humanOutcome?: 'not-reviewed' | 'approved' | 'rejected' | 'modified' | 'unknown';
}) {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input.mode ?? 'observe',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: `2026-05-01T21:${String(input.index).padStart(2, '0')}:00.000Z`,
      decidedAt: `2026-05-01T21:${String(input.index).padStart(2, '0')}:01.000Z`,
      amount: {
        value: input.amountValue ?? 38000,
        currency: 'HUF',
      },
      recipient: 'customer_raw_value_must_not_escape',
      policyRef: input.policyRef ?? 'policy:refunds:v1',
      evidenceRefs: input.evidenceRefs ?? ['order:987', 'payment:456'],
      authoritySources: [
        {
          sourceKind: 'customer-policy',
          claimKind: 'authorization',
          sourceRef: 'policy:refunds:v1',
          trustClass: 'trusted-authority',
          evidenceDigest: vendorDigest,
        },
      ],
      observedFeatures: {
        adapterReady: true,
        ...(input.observedFeatures ?? {}),
      },
      observedFeatureOrigins: {
        adapterReady: 'trusted-adapter',
        ...(input.observedFeatureOrigins ?? {}),
      },
    }),
    occurredAt: `2026-05-01T21:${String(input.index).padStart(2, '0')}:02.000Z`,
    downstreamOutcome: input.downstreamOutcome ?? 'proceeded',
    humanOutcome: input.humanOutcome ?? 'approved',
  });
}

function testMoneyMovementReportProducesThresholdAndRecipientCandidates(): void {
  const lowBucket = {
    label: '0-10k',
    currency: 'HUF',
    lowerInclusive: 0,
    upperExclusive: 10000,
  };
  const midBucket = {
    label: '10k-50k',
    currency: 'HUF',
    lowerInclusive: 10000,
    upperExclusive: 50000,
  };
  const highBucket = {
    label: '50k+',
    currency: 'HUF',
    lowerInclusive: 50000,
    upperExclusive: null,
  };
  const report = createMoneyMovementShadowPackReport({
    generatedAt: '2026-05-01T21:30:00.000Z',
    minimumBucketEvents: 3,
    minimumRecipientEvents: 3,
    observations: [
      {
        event: createMoneyEvent({ index: 1, amountValue: 9000 }),
        amountBucket: lowBucket,
        recipientDigest: vendorDigest,
        recipientClass: 'vendor',
        valueDirection: 'refund',
      },
      {
        event: createMoneyEvent({ index: 2, amountValue: 9000 }),
        amountBucket: lowBucket,
        recipientDigest: vendorDigest,
        recipientClass: 'vendor',
        valueDirection: 'refund',
      },
      {
        event: createMoneyEvent({ index: 3, amountValue: 9000 }),
        amountBucket: lowBucket,
        recipientDigest: vendorDigest,
        recipientClass: 'vendor',
        valueDirection: 'refund',
      },
      {
        event: createMoneyEvent({
          index: 4,
          evidenceRefs: [],
          downstreamOutcome: 'held',
          humanOutcome: 'modified',
        }),
        amountBucket: midBucket,
        recipientDigest: reviewDigest,
        recipientClass: 'customer',
        valueDirection: 'refund',
      },
      {
        event: createMoneyEvent({
          index: 5,
          evidenceRefs: [],
          downstreamOutcome: 'held',
        }),
        amountBucket: midBucket,
        recipientDigest: reviewDigest,
        recipientClass: 'customer',
        valueDirection: 'refund',
      },
      {
        event: createMoneyEvent({
          index: 6,
          amountValue: 75000,
          observedFeatures: {
            policyBlocked: true,
          },
          downstreamOutcome: 'blocked',
          humanOutcome: 'rejected',
        }),
        amountBucket: highBucket,
        recipientDigest: reviewDigest,
        recipientClass: 'customer',
        valueDirection: 'refund',
      },
    ],
  });
  const serialized = JSON.stringify(report);
  const threshold = report.thresholdCandidates[0];
  const allowlistCandidate = report.recipientCandidates.find((candidate) =>
    candidate.recipientDigest === vendorDigest
  );
  const reviewCandidate = report.recipientCandidates.find((candidate) =>
    candidate.recipientDigest === reviewDigest
  );

  equal(report.version, 'attestor.money-movement-shadow-pack.v1', 'Money shadow: version is explicit');
  equal(report.observationCount, 6, 'Money shadow: observation count is retained');
  equal(report.rawPayloadStored, false, 'Money shadow: raw payload storage is explicitly false');
  ok(report.digest.startsWith('sha256:'), 'Money shadow: digest is generated');
  equal(threshold?.autoAdmitBelow, 10000, 'Money shadow: auto-admit ceiling candidate is derived from clean low bucket');
  equal(threshold?.reviewAtOrAbove, 10000, 'Money shadow: review threshold candidate is derived from held bucket');
  equal(threshold?.blockAtOrAbove, 50000, 'Money shadow: block threshold candidate is derived from blocked bucket');
  equal(allowlistCandidate?.recommendation, 'allowlist-candidate', 'Money shadow: clean recurring digest becomes allowlist candidate');
  equal(reviewCandidate?.recommendation, 'review-candidate', 'Money shadow: reviewed/blocked digest stays review candidate');
  ok(
    report.recommendations.some((item) => item.kind === 'auto-admit-ceiling-candidate'),
    'Money shadow: threshold recommendation is emitted',
  );
  ok(
    report.recommendations.some((item) => item.kind === 'recipient-allowlist-candidate'),
    'Money shadow: recipient allowlist recommendation is emitted',
  );
  ok(!serialized.includes('customer_raw_value_must_not_escape'), 'Money shadow: raw recipient is not serialized');
  ok(!serialized.includes('order:987'), 'Money shadow: raw evidence refs are not serialized');
}

function testMoneyMovementRejectsUnsafeInputs(): void {
  const dataEvent = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      actor: 'analytics-ai-agent',
      action: 'export_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-delivery',
      requestedAt: '2026-05-01T21:40:00.000Z',
      decidedAt: '2026-05-01T21:40:01.000Z',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:1'],
      dataScope: {
        records: 10,
        classification: 'internal',
        fields: ['id'],
      },
    }),
  });

  throws(
    () =>
      createMoneyMovementShadowPackReport({
        observations: [{
          event: dataEvent,
          amountBucket: {
            label: '0-10k',
            currency: 'HUF',
            lowerInclusive: 0,
            upperExclusive: 10000,
          },
        }],
      }),
    /require money-movement events/u,
    'Money shadow: non-money events fail closed',
  );

  throws(
    () =>
      createMoneyMovementShadowPackReport({
        observations: [{
          event: createMoneyEvent({ index: 7 }),
          amountBucket: {
            label: '0-10k',
            currency: 'HUF',
            lowerInclusive: 0,
            upperExclusive: 10000,
          },
          recipientDigest: 'customer@example.com',
        }],
      }),
    /recipientDigest must be a sha256 digest/u,
    'Money shadow: raw recipient-looking values are rejected',
  );
}

testMoneyMovementReportProducesThresholdAndRecipientCandidates();
testMoneyMovementRejectsUnsafeInputs();

console.log(`Money movement shadow pack tests: ${passed} passed, 0 failed`);
