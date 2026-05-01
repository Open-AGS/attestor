import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowAdmissionEvent,
} from './shadow-events.js';

export const MONEY_MOVEMENT_SHADOW_PACK_VERSION =
  'attestor.money-movement-shadow-pack.v1';

export const MONEY_MOVEMENT_RECIPIENT_CLASSES = [
  'recurring',
  'new',
  'vendor',
  'customer',
  'internal',
  'external',
  'unknown',
] as const;
export type MoneyMovementRecipientClass =
  typeof MONEY_MOVEMENT_RECIPIENT_CLASSES[number];

export const MONEY_MOVEMENT_VALUE_DIRECTIONS = [
  'refund',
  'payout',
  'payment',
  'credit',
  'adjustment',
  'unknown',
] as const;
export type MoneyMovementValueDirection =
  typeof MONEY_MOVEMENT_VALUE_DIRECTIONS[number];

export const MONEY_MOVEMENT_RECOMMENDATION_KINDS = [
  'auto-admit-ceiling-candidate',
  'review-threshold-candidate',
  'block-threshold-candidate',
  'recipient-allowlist-candidate',
  'recipient-review-candidate',
  'stay-in-shadow',
] as const;
export type MoneyMovementRecommendationKind =
  typeof MONEY_MOVEMENT_RECOMMENDATION_KINDS[number];

export interface MoneyMovementAmountBucket {
  readonly label: string;
  readonly currency: string;
  readonly lowerInclusive: number | null;
  readonly upperExclusive: number | null;
}

export interface MoneyMovementShadowObservation {
  readonly event: ShadowAdmissionEvent;
  readonly amountBucket: MoneyMovementAmountBucket;
  readonly recipientDigest?: string | null;
  readonly recipientClass?: MoneyMovementRecipientClass | null;
  readonly valueDirection?: MoneyMovementValueDirection | null;
}

export interface CreateMoneyMovementShadowPackReportInput {
  readonly observations: readonly MoneyMovementShadowObservation[];
  readonly generatedAt?: string | null;
  readonly reportId?: string | null;
  readonly minimumBucketEvents?: number | null;
  readonly minimumRecipientEvents?: number | null;
}

export interface MoneyMovementBucketSummary {
  readonly actionSurface: string;
  readonly currency: string;
  readonly amountBucket: MoneyMovementAmountBucket;
  readonly eventCount: number;
  readonly admitCount: number;
  readonly reviewCount: number;
  readonly blockCount: number;
  readonly humanApprovedCount: number;
  readonly humanRejectedCount: number;
  readonly eventDigests: readonly string[];
}

export interface MoneyMovementRecipientCandidate {
  readonly recipientDigest: string;
  readonly recipientClass: MoneyMovementRecipientClass;
  readonly actionSurface: string;
  readonly eventCount: number;
  readonly reviewedCount: number;
  readonly blockedCount: number;
  readonly amountBucketLabels: readonly string[];
  readonly recommendation: 'allowlist-candidate' | 'review-candidate';
  readonly eventDigests: readonly string[];
}

export interface MoneyMovementThresholdCandidate {
  readonly actionSurface: string;
  readonly currency: string;
  readonly autoAdmitBelow: number | null;
  readonly reviewAtOrAbove: number | null;
  readonly blockAtOrAbove: number | null;
  readonly supportingEventCount: number;
  readonly reasonCodes: readonly string[];
}

export interface MoneyMovementShadowRecommendation {
  readonly kind: MoneyMovementRecommendationKind;
  readonly title: string;
  readonly summary: string;
  readonly actionSurface: string | null;
  readonly currency: string | null;
  readonly affectedEvents: number;
  readonly reasonCodes: readonly string[];
  readonly confidence: number;
}

export interface MoneyMovementShadowPackReport {
  readonly version: typeof MONEY_MOVEMENT_SHADOW_PACK_VERSION;
  readonly reportId: string;
  readonly generatedAt: string;
  readonly windowStart: string | null;
  readonly windowEnd: string | null;
  readonly observationCount: number;
  readonly eventDigests: readonly string[];
  readonly bucketSummaries: readonly MoneyMovementBucketSummary[];
  readonly recipientCandidates: readonly MoneyMovementRecipientCandidate[];
  readonly thresholdCandidates: readonly MoneyMovementThresholdCandidate[];
  readonly recommendations: readonly MoneyMovementShadowRecommendation[];
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Money movement shadow ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Money movement shadow ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Money movement shadow ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeEnumValue<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  fallback: T,
  fieldName: string,
): T {
  if (value === undefined || value === null) return fallback;
  const normalized = normalizeIdentifier(value, fieldName);
  if (!allowedValues.includes(normalized as T)) {
    throw new Error(
      `Money movement shadow ${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }
  return normalized as T;
}

function normalizeFiniteNumber(
  value: number | null | undefined,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Money movement shadow ${fieldName} must be a finite non-negative number.`);
  }
  return value;
}

function normalizeRecipientDigest(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, 'recipientDigest');
  if (!/^sha256:[a-f0-9]{64}$/u.test(normalized)) {
    throw new Error('Money movement shadow recipientDigest must be a sha256 digest.');
  }
  return normalized;
}

function normalizeAmountBucket(input: MoneyMovementAmountBucket): MoneyMovementAmountBucket {
  const lowerInclusive = normalizeFiniteNumber(
    input.lowerInclusive,
    'amountBucket.lowerInclusive',
  );
  const upperExclusive = normalizeFiniteNumber(
    input.upperExclusive,
    'amountBucket.upperExclusive',
  );
  if (
    lowerInclusive !== null &&
    upperExclusive !== null &&
    upperExclusive <= lowerInclusive
  ) {
    throw new Error(
      'Money movement shadow amountBucket.upperExclusive must be greater than lowerInclusive.',
    );
  }
  return Object.freeze({
    label: normalizeIdentifier(input.label, 'amountBucket.label'),
    currency: normalizeIdentifier(input.currency, 'amountBucket.currency').toUpperCase(),
    lowerInclusive,
    upperExclusive,
  });
}

function normalizeObservation(
  input: MoneyMovementShadowObservation,
): MoneyMovementShadowObservation {
  if (input.event.domain !== 'money-movement') {
    throw new Error('Money movement shadow observations require money-movement events.');
  }
  return Object.freeze({
    event: input.event,
    amountBucket: normalizeAmountBucket(input.amountBucket),
    recipientDigest: normalizeRecipientDigest(input.recipientDigest),
    recipientClass: normalizeEnumValue(
      input.recipientClass,
      MONEY_MOVEMENT_RECIPIENT_CLASSES,
      'unknown',
      'recipientClass',
    ),
    valueDirection: normalizeEnumValue(
      input.valueDirection,
      MONEY_MOVEMENT_VALUE_DIRECTIONS,
      'unknown',
      'valueDirection',
    ),
  });
}

function actionSurfaceFor(observation: MoneyMovementShadowObservation): string {
  return observation.event.actionSurface ??
    `${observation.event.downstreamSystem}.${observation.event.action}`;
}

function bucketKey(observation: MoneyMovementShadowObservation): string {
  return [
    actionSurfaceFor(observation),
    observation.amountBucket.currency,
    observation.amountBucket.lowerInclusive ?? 'open',
    observation.amountBucket.upperExclusive ?? 'open',
    observation.amountBucket.label,
  ].join('\n');
}

function recipientKey(observation: MoneyMovementShadowObservation): string | null {
  if (!observation.recipientDigest) return null;
  return [
    actionSurfaceFor(observation),
    observation.recipientDigest,
    observation.recipientClass ?? 'unknown',
  ].join('\n');
}

function isReviewLike(event: ShadowAdmissionEvent): boolean {
  return (
    event.shadowDecision === 'would_review' ||
    event.effectiveDecision === 'review' ||
    event.downstreamOutcome === 'held' ||
    event.humanOutcome === 'modified'
  );
}

function isBlockLike(event: ShadowAdmissionEvent): boolean {
  return (
    event.shadowDecision === 'would_block' ||
    event.effectiveDecision === 'block' ||
    event.downstreamOutcome === 'blocked' ||
    event.downstreamOutcome === 'failed' ||
    event.humanOutcome === 'rejected'
  );
}

interface MutableBucketSummary {
  readonly actionSurface: string;
  readonly currency: string;
  readonly amountBucket: MoneyMovementAmountBucket;
  eventCount: number;
  admitCount: number;
  reviewCount: number;
  blockCount: number;
  humanApprovedCount: number;
  humanRejectedCount: number;
  eventDigests: string[];
}

function createBucketSummary(
  observation: MoneyMovementShadowObservation,
): MutableBucketSummary {
  return {
    actionSurface: actionSurfaceFor(observation),
    currency: observation.amountBucket.currency,
    amountBucket: observation.amountBucket,
    eventCount: 0,
    admitCount: 0,
    reviewCount: 0,
    blockCount: 0,
    humanApprovedCount: 0,
    humanRejectedCount: 0,
    eventDigests: [],
  };
}

function freezeBucketSummary(summary: MutableBucketSummary): MoneyMovementBucketSummary {
  return Object.freeze({
    actionSurface: summary.actionSurface,
    currency: summary.currency,
    amountBucket: summary.amountBucket,
    eventCount: summary.eventCount,
    admitCount: summary.admitCount,
    reviewCount: summary.reviewCount,
    blockCount: summary.blockCount,
    humanApprovedCount: summary.humanApprovedCount,
    humanRejectedCount: summary.humanRejectedCount,
    eventDigests: Object.freeze([...summary.eventDigests].sort()),
  });
}

interface MutableRecipientCandidate {
  readonly recipientDigest: string;
  readonly recipientClass: MoneyMovementRecipientClass;
  readonly actionSurface: string;
  eventCount: number;
  reviewedCount: number;
  blockedCount: number;
  amountBucketLabels: Set<string>;
  eventDigests: string[];
}

function createRecipientCandidate(
  observation: MoneyMovementShadowObservation,
): MutableRecipientCandidate {
  return {
    recipientDigest: observation.recipientDigest ?? '',
    recipientClass: observation.recipientClass ?? 'unknown',
    actionSurface: actionSurfaceFor(observation),
    eventCount: 0,
    reviewedCount: 0,
    blockedCount: 0,
    amountBucketLabels: new Set<string>(),
    eventDigests: [],
  };
}

function freezeRecipientCandidate(
  candidate: MutableRecipientCandidate,
  minimumRecipientEvents: number,
): MoneyMovementRecipientCandidate | null {
  if (candidate.eventCount < minimumRecipientEvents) return null;
  const recommendation =
    candidate.blockedCount === 0 && candidate.reviewedCount === 0
      ? 'allowlist-candidate'
      : 'review-candidate';
  return Object.freeze({
    recipientDigest: candidate.recipientDigest,
    recipientClass: candidate.recipientClass,
    actionSurface: candidate.actionSurface,
    eventCount: candidate.eventCount,
    reviewedCount: candidate.reviewedCount,
    blockedCount: candidate.blockedCount,
    amountBucketLabels: Object.freeze([...candidate.amountBucketLabels].sort()),
    recommendation,
    eventDigests: Object.freeze([...candidate.eventDigests].sort()),
  });
}

function sortBuckets(
  buckets: readonly MoneyMovementBucketSummary[],
): readonly MoneyMovementBucketSummary[] {
  return Object.freeze(
    [...buckets].sort((left, right) => {
      const leftLower = left.amountBucket.lowerInclusive ?? Number.NEGATIVE_INFINITY;
      const rightLower = right.amountBucket.lowerInclusive ?? Number.NEGATIVE_INFINITY;
      if (leftLower !== rightLower) return leftLower - rightLower;
      const leftUpper = left.amountBucket.upperExclusive ?? Number.POSITIVE_INFINITY;
      const rightUpper = right.amountBucket.upperExclusive ?? Number.POSITIVE_INFINITY;
      return leftUpper - rightUpper;
    }),
  );
}

function thresholdCandidatesFor(
  buckets: readonly MoneyMovementBucketSummary[],
  minimumBucketEvents: number,
): readonly MoneyMovementThresholdCandidate[] {
  const grouped = new Map<string, MoneyMovementBucketSummary[]>();
  for (const bucket of buckets) {
    const key = `${bucket.actionSurface}\n${bucket.currency}`;
    grouped.set(key, [...(grouped.get(key) ?? []), bucket]);
  }

  return Object.freeze(
    [...grouped.values()].map((group) => {
      const sorted = sortBuckets(group);
      const safeBuckets = sorted.filter((bucket) =>
        bucket.eventCount >= minimumBucketEvents &&
        bucket.reviewCount === 0 &&
        bucket.blockCount === 0 &&
        bucket.humanRejectedCount === 0,
      );
      const reviewBucket = sorted.find((bucket) => bucket.reviewCount > 0);
      const blockBucket = sorted.find((bucket) => bucket.blockCount > 0);
      const autoAdmitBelow =
        safeBuckets
          .map((bucket) => bucket.amountBucket.upperExclusive)
          .filter((value): value is number => value !== null)
          .at(-1) ?? null;
      const reviewAtOrAbove = reviewBucket?.amountBucket.lowerInclusive ?? null;
      const blockAtOrAbove = blockBucket?.amountBucket.lowerInclusive ?? null;
      const reasonCodes = [
        autoAdmitBelow === null ? 'auto-admit-ceiling-insufficient-data' : 'auto-admit-ceiling-candidate',
        reviewAtOrAbove === null ? 'review-floor-not-observed' : 'review-threshold-candidate',
        blockAtOrAbove === null ? 'block-floor-not-observed' : 'block-threshold-candidate',
      ];

      return Object.freeze({
        actionSurface: sorted[0]?.actionSurface ?? 'unknown',
        currency: sorted[0]?.currency ?? 'UNKNOWN',
        autoAdmitBelow,
        reviewAtOrAbove,
        blockAtOrAbove,
        supportingEventCount: sorted.reduce((total, bucket) => total + bucket.eventCount, 0),
        reasonCodes: Object.freeze(reasonCodes),
      });
    }),
  );
}

function recommendationsFor(input: {
  readonly observationCount: number;
  readonly recipientCandidates: readonly MoneyMovementRecipientCandidate[];
  readonly thresholdCandidates: readonly MoneyMovementThresholdCandidate[];
  readonly minimumBucketEvents: number;
}): readonly MoneyMovementShadowRecommendation[] {
  const recommendations: MoneyMovementShadowRecommendation[] = [];

  for (const threshold of input.thresholdCandidates) {
    if (threshold.autoAdmitBelow !== null) {
      recommendations.push(Object.freeze({
        kind: 'auto-admit-ceiling-candidate',
        title: 'Candidate auto-admit ceiling observed',
        summary:
          'Shadow traffic contains a lower-value band with no review, block, or rejection outcomes. Treat it as a candidate only after customer approval.',
        actionSurface: threshold.actionSurface,
        currency: threshold.currency,
        affectedEvents: threshold.supportingEventCount,
        reasonCodes: Object.freeze(['auto-admit-ceiling-candidate']),
        confidence: 0.7,
      }));
    }
    if (threshold.reviewAtOrAbove !== null) {
      recommendations.push(Object.freeze({
        kind: 'review-threshold-candidate',
        title: 'Candidate review threshold observed',
        summary:
          'Shadow traffic shows a value band where actions started needing review. Use this as a review-threshold candidate, not as an automatic rule.',
        actionSurface: threshold.actionSurface,
        currency: threshold.currency,
        affectedEvents: threshold.supportingEventCount,
        reasonCodes: Object.freeze(['review-threshold-candidate']),
        confidence: 0.75,
      }));
    }
    if (threshold.blockAtOrAbove !== null) {
      recommendations.push(Object.freeze({
        kind: 'block-threshold-candidate',
        title: 'Candidate block threshold observed',
        summary:
          'Shadow traffic shows a value band where actions blocked or were rejected. Keep this surface in shadow or review until the cause is understood.',
        actionSurface: threshold.actionSurface,
        currency: threshold.currency,
        affectedEvents: threshold.supportingEventCount,
        reasonCodes: Object.freeze(['block-threshold-candidate']),
        confidence: 0.8,
      }));
    }
  }

  for (const recipient of input.recipientCandidates) {
    recommendations.push(Object.freeze({
      kind: recipient.recommendation === 'allowlist-candidate'
        ? 'recipient-allowlist-candidate'
        : 'recipient-review-candidate',
      title: recipient.recommendation === 'allowlist-candidate'
        ? 'Candidate recurring recipient allowlist entry'
        : 'Candidate recipient review rule',
      summary: recipient.recommendation === 'allowlist-candidate'
        ? 'A recurring recipient digest appeared without review or block outcomes. Promote only after the customer confirms the recipient mapping.'
        : 'A recipient digest appeared with review or block outcomes. Keep this recipient class in review until the customer resolves the pattern.',
      actionSurface: recipient.actionSurface,
      currency: null,
      affectedEvents: recipient.eventCount,
      reasonCodes: Object.freeze([recipient.recommendation]),
      confidence: recipient.recommendation === 'allowlist-candidate' ? 0.65 : 0.8,
    }));
  }

  if (input.observationCount < input.minimumBucketEvents) {
    recommendations.push(Object.freeze({
      kind: 'stay-in-shadow',
      title: 'Stay in shadow mode until more money movement traffic is observed',
      summary:
        'The money movement pack needs more redacted observations before recommending threshold candidates.',
      actionSurface: null,
      currency: null,
      affectedEvents: input.observationCount,
      reasonCodes: Object.freeze(['insufficient-shadow-traffic']),
      confidence: 0.9,
    }));
  }

  return Object.freeze(recommendations);
}

function windowStartFor(observations: readonly MoneyMovementShadowObservation[]): string | null {
  if (observations.length === 0) return null;
  return observations
    .map((observation) => observation.event.occurredAt)
    .sort()[0] ?? null;
}

function windowEndFor(observations: readonly MoneyMovementShadowObservation[]): string | null {
  if (observations.length === 0) return null;
  return observations
    .map((observation) => observation.event.occurredAt)
    .sort()
    .at(-1) ?? null;
}

function reportIdFor(input: {
  readonly generatedAt: string;
  readonly eventDigests: readonly string[];
}): string {
  return `money-movement-shadow:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

export function createMoneyMovementShadowPackReport(
  input: CreateMoneyMovementShadowPackReportInput,
): MoneyMovementShadowPackReport {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const minimumBucketEvents = Math.max(1, input.minimumBucketEvents ?? 3);
  const minimumRecipientEvents = Math.max(1, input.minimumRecipientEvents ?? 3);
  const observations = Object.freeze(input.observations.map(normalizeObservation));
  const eventDigests = Object.freeze(
    observations.map((observation) => observation.event.digest).sort(),
  );
  const reportId = input.reportId
    ? normalizeIdentifier(input.reportId, 'reportId')
    : reportIdFor({ generatedAt, eventDigests });

  const buckets = new Map<string, MutableBucketSummary>();
  const recipients = new Map<string, MutableRecipientCandidate>();
  for (const observation of observations) {
    const bucket = buckets.get(bucketKey(observation)) ?? createBucketSummary(observation);
    buckets.set(bucketKey(observation), bucket);
    bucket.eventCount += 1;
    if (isBlockLike(observation.event)) {
      bucket.blockCount += 1;
    } else if (isReviewLike(observation.event)) {
      bucket.reviewCount += 1;
    } else {
      bucket.admitCount += 1;
    }
    if (observation.event.humanOutcome === 'approved') bucket.humanApprovedCount += 1;
    if (observation.event.humanOutcome === 'rejected') bucket.humanRejectedCount += 1;
    bucket.eventDigests.push(observation.event.digest);

    const key = recipientKey(observation);
    if (key !== null) {
      const recipient = recipients.get(key) ?? createRecipientCandidate(observation);
      recipients.set(key, recipient);
      recipient.eventCount += 1;
      if (isReviewLike(observation.event)) recipient.reviewedCount += 1;
      if (isBlockLike(observation.event)) recipient.blockedCount += 1;
      recipient.amountBucketLabels.add(observation.amountBucket.label);
      recipient.eventDigests.push(observation.event.digest);
    }
  }

  const bucketSummaries = Object.freeze(
    [...buckets.values()]
      .map(freezeBucketSummary)
      .sort((left, right) =>
        `${left.actionSurface}\n${left.currency}\n${left.amountBucket.label}`.localeCompare(
          `${right.actionSurface}\n${right.currency}\n${right.amountBucket.label}`,
        ),
      ),
  );
  const recipientCandidates = Object.freeze(
    [...recipients.values()]
      .map((candidate) => freezeRecipientCandidate(candidate, minimumRecipientEvents))
      .filter((candidate): candidate is MoneyMovementRecipientCandidate => candidate !== null)
      .sort((left, right) => left.recipientDigest.localeCompare(right.recipientDigest)),
  );
  const thresholdCandidates = thresholdCandidatesFor(bucketSummaries, minimumBucketEvents);
  const recommendations = recommendationsFor({
    observationCount: observations.length,
    recipientCandidates,
    thresholdCandidates,
    minimumBucketEvents,
  });
  const payload = {
    version: MONEY_MOVEMENT_SHADOW_PACK_VERSION,
    reportId,
    generatedAt,
    windowStart: windowStartFor(observations),
    windowEnd: windowEndFor(observations),
    observationCount: observations.length,
    eventDigests,
    bucketSummaries,
    recipientCandidates,
    thresholdCandidates,
    recommendations,
    rawPayloadStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
