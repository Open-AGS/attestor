import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAuditEvidenceExport,
  ConsequenceAuditEvidenceFindingSeverity,
} from './audit-evidence-export.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';

export const CONSEQUENCE_BUSINESS_RISK_DASHBOARD_VERSION =
  'attestor.consequence-business-risk-dashboard.v1';

export const CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS = [
  'action-volume',
  'decision-posture',
  'mode-ladder',
  'consequence-domain-risk',
  'control-gaps',
  'review-load',
  'blocked-actions',
  'downstream-integration',
  'operator-supplied-impact',
] as const;
export type ConsequenceBusinessRiskDashboardWidget =
  typeof CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS[number];

export const CONSEQUENCE_BUSINESS_RISK_SIGNALS = [
  'visibility-established',
  'policy-gap',
  'review-load',
  'blocked-action',
  'raw-payload-risk',
  'promotion-not-ready',
  'downstream-proof-missing',
  'impact-observed',
] as const;
export type ConsequenceBusinessRiskSignal =
  typeof CONSEQUENCE_BUSINESS_RISK_SIGNALS[number];

export const CONSEQUENCE_BUSINESS_IMPACT_KINDS = [
  'money-movement-held',
  'money-movement-reviewed',
  'data-records-held',
  'authority-changes-held',
  'external-communications-held',
  'operational-actions-held',
  'programmable-money-actions-held',
  'custom',
] as const;
export type ConsequenceBusinessImpactKind =
  typeof CONSEQUENCE_BUSINESS_IMPACT_KINDS[number];

export const CONSEQUENCE_BUSINESS_IMPACT_UNITS = [
  'actions',
  'minor-currency-units',
  'records',
  'requests',
  'custom',
] as const;
export type ConsequenceBusinessImpactUnit =
  typeof CONSEQUENCE_BUSINESS_IMPACT_UNITS[number];

export type ConsequenceBusinessRiskPosture =
  | 'visibility-only'
  | 'attention-needed'
  | 'blocked-for-review';

export interface CreateConsequenceBusinessRiskDashboardInput {
  readonly auditExport: ConsequenceAuditEvidenceExport;
  readonly generatedAt?: string | null;
  readonly dashboardId?: string | null;
  readonly impactObservations?: readonly ConsequenceBusinessImpactObservationInput[] | null;
}

export interface ConsequenceBusinessImpactObservationInput {
  readonly observationId?: string | null;
  readonly kind: ConsequenceBusinessImpactKind;
  readonly value: number;
  readonly unit: ConsequenceBusinessImpactUnit;
  readonly currency?: string | null;
  readonly domain?: string | null;
  readonly surfaceDigest?: string | null;
  readonly sourceDigest: string;
  readonly confidence?: number | null;
  readonly summary?: string | null;
  readonly rawValueStored?: boolean | null;
}

export interface ConsequenceBusinessImpactObservation {
  readonly observationId: string;
  readonly kind: ConsequenceBusinessImpactKind;
  readonly value: number;
  readonly unit: ConsequenceBusinessImpactUnit;
  readonly currency: string | null;
  readonly domain: string | null;
  readonly surfaceDigest: string | null;
  readonly sourceDigest: string;
  readonly confidence: number;
  readonly summary: string | null;
  readonly rawValueStored: false;
}

export interface ConsequenceBusinessRiskMetric {
  readonly metric: string;
  readonly value: number;
  readonly unit: 'count' | 'percent' | 'score';
  readonly signal: ConsequenceBusinessRiskSignal | null;
}

export interface ConsequenceBusinessRiskDomainRow {
  readonly domain: string;
  readonly actionCount: number;
  readonly reviewCount: number;
  readonly blockedCount: number;
  readonly failClosedCount: number;
  readonly riskScore: number;
  readonly posture: ConsequenceBusinessRiskPosture;
}

export interface ConsequenceBusinessRiskSignalRow {
  readonly signal: ConsequenceBusinessRiskSignal;
  readonly severity: ConsequenceAuditEvidenceFindingSeverity;
  readonly count: number;
  readonly summary: string;
}

export interface ConsequenceBusinessRiskDashboard {
  readonly version: typeof CONSEQUENCE_BUSINESS_RISK_DASHBOARD_VERSION;
  readonly dashboardId: string;
  readonly generatedAt: string;
  readonly sourceAuditExportId: string;
  readonly sourceAuditExportDigest: string;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly widgets: typeof CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS;
  readonly posture: ConsequenceBusinessRiskPosture;
  readonly operatorSummary: string;
  readonly metrics: readonly ConsequenceBusinessRiskMetric[];
  readonly domainRows: readonly ConsequenceBusinessRiskDomainRow[];
  readonly signalRows: readonly ConsequenceBusinessRiskSignalRow[];
  readonly impactMode: 'not-supplied' | 'operator-supplied';
  readonly impactObservations: readonly ConsequenceBusinessImpactObservation[];
  readonly impactDigest: string | null;
  readonly rawPayloadStored: false;
  readonly rawImpactValueStored: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceBusinessRiskDashboardDescriptor {
  readonly version: typeof CONSEQUENCE_BUSINESS_RISK_DASHBOARD_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly widgets: typeof CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS;
  readonly signals: typeof CONSEQUENCE_BUSINESS_RISK_SIGNALS;
  readonly impactKinds: typeof CONSEQUENCE_BUSINESS_IMPACT_KINDS;
  readonly impactUnits: typeof CONSEQUENCE_BUSINESS_IMPACT_UNITS;
  readonly impactMode: 'operator-supplied-only';
  readonly rawPayloadStored: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
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

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence business risk dashboard ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence business risk dashboard ${fieldName} requires a non-empty value.`,
    );
  }
  return normalized;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(
      `Consequence business risk dashboard ${fieldName} must be a sha256 digest.`,
    );
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence business risk dashboard ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function normalizeEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fieldName: string,
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(
      `Consequence business risk dashboard ${fieldName} must be one of: ${allowed.join(', ')}.`,
    );
  }
  return value as T;
}

function normalizeNonNegativeNumber(value: number, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `Consequence business risk dashboard ${fieldName} must be a non-negative finite number.`,
    );
  }
  return Number(value.toFixed(4));
}

function normalizeConfidence(value: number | null | undefined): number {
  if (value === undefined || value === null) return 1;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(
      'Consequence business risk dashboard confidence must be between 0 and 1.',
    );
  }
  return Number(value.toFixed(4));
}

function normalizeImpactObservation(
  input: ConsequenceBusinessImpactObservationInput,
): ConsequenceBusinessImpactObservation {
  if (input.rawValueStored === true) {
    throw new Error(
      'Consequence business risk dashboard impact observations must not store raw values.',
    );
  }
  const kind = normalizeEnum(input.kind, CONSEQUENCE_BUSINESS_IMPACT_KINDS, 'impact kind');
  const unit = normalizeEnum(input.unit, CONSEQUENCE_BUSINESS_IMPACT_UNITS, 'impact unit');
  const sourceDigest = normalizeDigest(input.sourceDigest, 'impact sourceDigest');
  const payload = {
    kind,
    value: normalizeNonNegativeNumber(input.value, 'impact value'),
    unit,
    currency: normalizeOptionalIdentifier(input.currency, 'impact currency'),
    domain: normalizeOptionalIdentifier(input.domain, 'impact domain'),
    surfaceDigest: normalizeOptionalDigest(input.surfaceDigest, 'impact surfaceDigest'),
    sourceDigest,
    confidence: normalizeConfidence(input.confidence),
    summary: normalizeOptionalIdentifier(input.summary, 'impact summary'),
  } as const;

  return Object.freeze({
    observationId: normalizeOptionalIdentifier(input.observationId, 'impact observationId') ??
      `business-impact:${hashCanonical(payload as unknown as CanonicalReleaseJsonValue)}`,
    ...payload,
    rawValueStored: false,
  });
}

function severityRank(severity: ConsequenceAuditEvidenceFindingSeverity): number {
  if (severity === 'blocker') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  if (severity === 'low') return 1;
  return 0;
}

function postureFor(input: {
  readonly blockerCount: number;
  readonly highFindingCount: number;
  readonly policyGapCount: number;
  readonly blockedCount: number;
  readonly reviewLoadCount: number;
}): ConsequenceBusinessRiskPosture {
  if (input.blockerCount > 0 || input.highFindingCount > 0) return 'blocked-for-review';
  if (
    input.policyGapCount > 0 ||
    input.blockedCount > 0 ||
    input.reviewLoadCount > 0
  ) {
    return 'attention-needed';
  }
  return 'visibility-only';
}

function metric(
  name: string,
  value: number,
  unit: ConsequenceBusinessRiskMetric['unit'],
  signal: ConsequenceBusinessRiskSignal | null,
): ConsequenceBusinessRiskMetric {
  return Object.freeze({
    metric: name,
    value,
    unit,
    signal,
  });
}

function metricsFor(auditExport: ConsequenceAuditEvidenceExport): readonly ConsequenceBusinessRiskMetric[] {
  const total = auditExport.controlSummary.shadowEventCount;
  const percent = (value: number): number =>
    total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));

  return Object.freeze([
    metric('ai-actions-observed', total, 'count', 'visibility-established'),
    metric('actions-reviewed', auditExport.controlSummary.reviewLoadCount, 'count', 'review-load'),
    metric('actions-blocked', auditExport.controlSummary.blockedCount, 'count', 'blocked-action'),
    metric('fail-closed-events', auditExport.summary.byShadowDecision.would_block ?? 0, 'count', 'blocked-action'),
    metric('policy-gap-events', auditExport.controlSummary.policyGapCount, 'count', 'policy-gap'),
    metric('non-enforcing-events', auditExport.controlSummary.nonEnforcingEventCount, 'count', null),
    metric('review-rate', percent(auditExport.controlSummary.reviewLoadCount), 'percent', 'review-load'),
    metric('block-rate', percent(auditExport.controlSummary.blockedCount), 'percent', 'blocked-action'),
    metric(
      'downstream-integration-proof-coverage',
      auditExport.controlSummary.downstreamIntegrationProofCount === 0
        ? 0
        : Number((
            (
              auditExport.controlSummary.readyDownstreamIntegrationProofCount /
              auditExport.controlSummary.downstreamIntegrationProofCount
            ) * 100
          ).toFixed(2)),
      'percent',
      auditExport.controlSummary.downstreamIntegrationProofCount === 0
        ? 'downstream-proof-missing'
        : null,
    ),
  ]);
}

function domainRowsFor(auditExport: ConsequenceAuditEvidenceExport):
readonly ConsequenceBusinessRiskDomainRow[] {
  const rows = new Map<string, {
    actionCount: number;
    reviewCount: number;
    blockedCount: number;
    failClosedCount: number;
  }>();

  for (const [domain, count] of Object.entries(auditExport.summary.byDomain)) {
    rows.set(domain, {
      actionCount: count,
      reviewCount: 0,
      blockedCount: 0,
      failClosedCount: 0,
    });
  }

  for (const surface of auditExport.surfaceSummaries) {
    const current = rows.get(surface.domain) ?? {
      actionCount: 0,
      reviewCount: 0,
      blockedCount: 0,
      failClosedCount: 0,
    };
    current.reviewCount += surface.reviewLoadCount;
    current.blockedCount += surface.blockedCount;
    current.failClosedCount += surface.failClosedCount;
    rows.set(surface.domain, current);
  }

  return Object.freeze(
    [...rows.entries()]
      .map(([domain, row]) => {
        const riskScore = Math.min(
          100,
          row.blockedCount * 25 + row.reviewCount * 12 + row.failClosedCount * 10,
        );
        return Object.freeze({
          domain,
          actionCount: row.actionCount,
          reviewCount: row.reviewCount,
          blockedCount: row.blockedCount,
          failClosedCount: row.failClosedCount,
          riskScore,
          posture: riskScore >= 50
            ? 'blocked-for-review'
            : riskScore > 0
              ? 'attention-needed'
              : 'visibility-only',
        });
      })
      .sort((left, right) => {
        if (right.riskScore !== left.riskScore) return right.riskScore - left.riskScore;
        return left.domain.localeCompare(right.domain);
      }),
  );
}

function signalForFinding(kind: string): ConsequenceBusinessRiskSignal {
  if (kind === 'policy-gaps-present') return 'policy-gap';
  if (kind === 'review-load-present') return 'review-load';
  if (kind === 'blocked-actions-present') return 'blocked-action';
  if (kind === 'raw-payload-present') return 'raw-payload-risk';
  if (kind === 'promotion-not-activation-ready') return 'promotion-not-ready';
  if (kind === 'downstream-proof-missing' || kind === 'downstream-integration-incomplete') {
    return 'downstream-proof-missing';
  }
  return 'visibility-established';
}

function signalRowsFor(auditExport: ConsequenceAuditEvidenceExport):
readonly ConsequenceBusinessRiskSignalRow[] {
  return Object.freeze(
    auditExport.findings
      .map((finding) => Object.freeze({
        signal: signalForFinding(finding.kind),
        severity: finding.severity,
        count: finding.count,
        summary: finding.summary,
      }))
      .sort((left, right) => {
        const severityDelta = severityRank(right.severity) - severityRank(left.severity);
        if (severityDelta !== 0) return severityDelta;
        return left.signal.localeCompare(right.signal);
      }),
  );
}

function operatorSummaryFor(input: {
  readonly posture: ConsequenceBusinessRiskPosture;
  readonly actionCount: number;
  readonly reviewCount: number;
  readonly blockedCount: number;
  readonly policyGapCount: number;
  readonly impactObservationCount: number;
}): string {
  if (input.actionCount === 0) {
    return 'No AI action evidence is available for this dashboard window.';
  }
  if (input.posture === 'blocked-for-review') {
    return `Review required: ${input.actionCount} AI actions observed, ${input.blockedCount} blocked, ${input.reviewCount} routed to review, and ${input.policyGapCount} policy gaps detected.`;
  }
  if (input.posture === 'attention-needed') {
    return `Attention needed: ${input.actionCount} AI actions observed with ${input.reviewCount} review events, ${input.blockedCount} blocked events, and ${input.policyGapCount} policy gaps.`;
  }
  if (input.impactObservationCount > 0) {
    return `Visibility established: ${input.actionCount} AI actions observed with operator-supplied impact evidence attached.`;
  }
  return `Visibility established: ${input.actionCount} AI actions observed with no high-severity dashboard blockers.`;
}

function dashboardIdFor(input: {
  readonly generatedAt: string;
  readonly sourceAuditExportDigest: string;
  readonly impactDigest: string | null;
}): string {
  return `business-risk-dashboard:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

export function createConsequenceBusinessRiskDashboard(
  input: CreateConsequenceBusinessRiskDashboardInput,
): ConsequenceBusinessRiskDashboard {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? new Date().toISOString(),
    'generatedAt',
  );
  const impactObservations = Object.freeze(
    [...(input.impactObservations ?? [])]
      .map(normalizeImpactObservation)
      .sort((left, right) => left.observationId.localeCompare(right.observationId)),
  );
  const impactDigest = impactObservations.length === 0
    ? null
    : hashCanonical({ impactObservations } as unknown as CanonicalReleaseJsonValue);
  const highFindingCount = input.auditExport.findings
    .filter((finding) => finding.severity === 'high')
    .length;
  const posture = postureFor({
    blockerCount: input.auditExport.controlPosture.blockerCount,
    highFindingCount,
    policyGapCount: input.auditExport.controlSummary.policyGapCount,
    blockedCount: input.auditExport.controlSummary.blockedCount,
    reviewLoadCount: input.auditExport.controlSummary.reviewLoadCount,
  });
  const payload = {
    version: CONSEQUENCE_BUSINESS_RISK_DASHBOARD_VERSION,
    dashboardId: normalizeOptionalIdentifier(input.dashboardId, 'dashboardId') ??
      dashboardIdFor({
        generatedAt,
        sourceAuditExportDigest: input.auditExport.digest,
        impactDigest,
      }),
    generatedAt,
    sourceAuditExportId: input.auditExport.exportId,
    sourceAuditExportDigest: input.auditExport.digest,
    tenantId: input.auditExport.scope.tenantId,
    environment: input.auditExport.scope.environment,
    periodStart: input.auditExport.period.start,
    periodEnd: input.auditExport.period.end,
    widgets: CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS,
    posture,
    operatorSummary: operatorSummaryFor({
      posture,
      actionCount: input.auditExport.controlSummary.shadowEventCount,
      reviewCount: input.auditExport.controlSummary.reviewLoadCount,
      blockedCount: input.auditExport.controlSummary.blockedCount,
      policyGapCount: input.auditExport.controlSummary.policyGapCount,
      impactObservationCount: impactObservations.length,
    }),
    metrics: metricsFor(input.auditExport),
    domainRows: domainRowsFor(input.auditExport),
    signalRows: signalRowsFor(input.auditExport),
    impactMode: impactObservations.length === 0 ? 'not-supplied' : 'operator-supplied',
    impactObservations,
    impactDigest,
    rawPayloadStored: false,
    rawImpactValueStored: false,
    complianceClaimed: false,
    productionReady: false,
    decisionSupportOnly: true,
    autoEnforce: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceBusinessRiskDashboardDescriptor():
ConsequenceBusinessRiskDashboardDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_BUSINESS_RISK_DASHBOARD_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    widgets: CONSEQUENCE_BUSINESS_RISK_DASHBOARD_WIDGETS,
    signals: CONSEQUENCE_BUSINESS_RISK_SIGNALS,
    impactKinds: CONSEQUENCE_BUSINESS_IMPACT_KINDS,
    impactUnits: CONSEQUENCE_BUSINESS_IMPACT_UNITS,
    impactMode: 'operator-supplied-only',
    rawPayloadStored: false,
    complianceClaimed: false,
    productionReady: false,
    decisionSupportOnly: true,
    autoEnforce: false,
  });
}
