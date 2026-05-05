import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAuditEvidenceExport,
  ConsequenceAuditEvidenceFinding,
  ConsequenceAuditEvidenceFindingSeverity,
} from './audit-evidence-export.js';
import type {
  ConsequenceBusinessRiskDashboard,
  ConsequenceBusinessRiskPosture,
} from './business-risk-dashboard.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';

export const CONSEQUENCE_DASHBOARD_API_SUMMARY_VERSION =
  'attestor.consequence-dashboard-api-summary.v1';

export const CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS = [
  'actions-observed',
  'would-review',
  'would-block',
  'policy-gaps',
  'downstream-proof-coverage',
  'domains-needing-attention',
] as const;
export type ConsequenceDashboardApiSummaryTileKind =
  typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS[number];

export const CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS = [
  'start-shadow-mode',
  'define-policy',
  'review-load',
  'blocked-action',
  'downstream-proof-missing',
  'raw-payload-risk',
  'approve-candidates',
  'promotion-not-ready',
  'redacted-evidence-ready',
] as const;
export type ConsequenceDashboardApiSummaryAttentionKind =
  typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS[number];

export const CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS = [
  'shadow-summary',
  'action-risk-inventory',
  'audit-evidence',
  'business-risk-dashboard',
  'policy-candidates',
  'simulations',
] as const;
export type ConsequenceDashboardApiSummaryLinkKind =
  typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS[number];

export interface CreateConsequenceDashboardApiSummaryInput {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly dashboard: ConsequenceBusinessRiskDashboard;
  readonly generatedAt?: string | null;
  readonly summaryId?: string | null;
  readonly routeBase?: string | null;
}

export interface ConsequenceDashboardApiSummaryOverview {
  readonly observedActionCount: number;
  readonly wouldReviewCount: number;
  readonly wouldBlockCount: number;
  readonly policyGapCount: number;
  readonly nonEnforcingEventCount: number;
  readonly downstreamProofCount: number;
  readonly readyDownstreamProofCount: number;
  readonly downstreamProofCoveragePercent: number;
  readonly domainCount: number;
  readonly domainsNeedingAttentionCount: number;
}

export interface ConsequenceDashboardApiSummaryTile {
  readonly kind: ConsequenceDashboardApiSummaryTileKind;
  readonly label: string;
  readonly value: number;
  readonly unit: 'count' | 'percent';
  readonly severity: ConsequenceAuditEvidenceFindingSeverity;
  readonly route: string;
  readonly sourceDigest: string;
}

export interface ConsequenceDashboardApiSummaryAttentionItem {
  readonly itemId: string;
  readonly kind: ConsequenceDashboardApiSummaryAttentionKind;
  readonly severity: ConsequenceAuditEvidenceFindingSeverity;
  readonly count: number;
  readonly title: string;
  readonly nextStep: string;
  readonly route: string;
  readonly reasonCodes: readonly string[];
}

export interface ConsequenceDashboardApiSummaryDomainRow {
  readonly domain: string;
  readonly actionCount: number;
  readonly reviewCount: number;
  readonly blockedCount: number;
  readonly riskScore: number;
  readonly posture: ConsequenceBusinessRiskPosture;
  readonly recommendedNextStep: string;
}

export interface ConsequenceDashboardApiSummaryLink {
  readonly kind: ConsequenceDashboardApiSummaryLinkKind;
  readonly route: string;
  readonly method: 'GET';
  readonly summary: string;
}

export interface ConsequenceDashboardApiSummary {
  readonly version: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_VERSION;
  readonly summaryId: string;
  readonly generatedAt: string;
  readonly sourceAuditExportId: string;
  readonly sourceAuditExportDigest: string;
  readonly sourceDashboardId: string;
  readonly sourceDashboardDigest: string;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly posture: ConsequenceBusinessRiskPosture;
  readonly headline: string;
  readonly overview: ConsequenceDashboardApiSummaryOverview;
  readonly tiles: readonly ConsequenceDashboardApiSummaryTile[];
  readonly attentionItems: readonly ConsequenceDashboardApiSummaryAttentionItem[];
  readonly topDomains: readonly ConsequenceDashboardApiSummaryDomainRow[];
  readonly omittedDomainCount: number;
  readonly apiLinks: readonly ConsequenceDashboardApiSummaryLink[];
  readonly rawPayloadStored: false;
  readonly rawImpactValueStored: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceDashboardApiSummaryDescriptor {
  readonly version: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly tileKinds: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS;
  readonly attentionKinds: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS;
  readonly linkKinds: typeof CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS;
  readonly rawPayloadStored: false;
  readonly rawImpactValueStored: false;
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
    throw new Error(`Consequence dashboard API summary ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence dashboard API summary ${fieldName} requires a non-empty value.`,
    );
  }
  if (normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(
      `Consequence dashboard API summary ${fieldName} must be bounded and control-free.`,
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

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence dashboard API summary ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function routeBase(value: string | null | undefined): string {
  const normalized = normalizeOptionalIdentifier(value, 'routeBase') ?? '/api/v1/shadow';
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function route(base: string, path: string): string {
  return `${base}${path}`;
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function severityForValue(
  value: number,
  warningSeverity: ConsequenceAuditEvidenceFindingSeverity,
): ConsequenceAuditEvidenceFindingSeverity {
  return value > 0 ? warningSeverity : 'info';
}

function tile(
  kind: ConsequenceDashboardApiSummaryTileKind,
  label: string,
  value: number,
  unit: 'count' | 'percent',
  severity: ConsequenceAuditEvidenceFindingSeverity,
  route: string,
  sourceDigest: string,
): ConsequenceDashboardApiSummaryTile {
  return Object.freeze({
    kind,
    label,
    value,
    unit,
    severity,
    route,
    sourceDigest,
  });
}

function tilesFor(input: {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly dashboard: ConsequenceBusinessRiskDashboard;
  readonly base: string;
}): readonly ConsequenceDashboardApiSummaryTile[] {
  const overview = overviewFor(input.auditEvidence, input.dashboard);
  return Object.freeze([
    tile(
      'actions-observed',
      'AI actions observed',
      overview.observedActionCount,
      'count',
      overview.observedActionCount > 0 ? 'info' : 'medium',
      route(input.base, '/summary'),
      input.auditEvidence.digest,
    ),
    tile(
      'would-review',
      'Actions needing review',
      overview.wouldReviewCount,
      'count',
      severityForValue(overview.wouldReviewCount, 'medium'),
      route(input.base, '/business-risk-dashboard'),
      input.dashboard.digest,
    ),
    tile(
      'would-block',
      'Actions blocked',
      overview.wouldBlockCount,
      'count',
      severityForValue(overview.wouldBlockCount, 'medium'),
      route(input.base, '/business-risk-dashboard'),
      input.dashboard.digest,
    ),
    tile(
      'policy-gaps',
      'Policy gaps',
      overview.policyGapCount,
      'count',
      severityForValue(overview.policyGapCount, 'high'),
      route(input.base, '/policy-candidates'),
      input.auditEvidence.digest,
    ),
    tile(
      'downstream-proof-coverage',
      'Downstream proof coverage',
      overview.downstreamProofCoveragePercent,
      'percent',
      overview.downstreamProofCount === 0 ? 'medium' : 'info',
      route(input.base, '/audit-evidence'),
      input.auditEvidence.digest,
    ),
    tile(
      'domains-needing-attention',
      'Domains needing attention',
      overview.domainsNeedingAttentionCount,
      'count',
      severityForValue(overview.domainsNeedingAttentionCount, 'medium'),
      route(input.base, '/action-risk-inventory'),
      input.dashboard.digest,
    ),
  ]);
}

function overviewFor(
  auditEvidence: ConsequenceAuditEvidenceExport,
  dashboard: ConsequenceBusinessRiskDashboard,
): ConsequenceDashboardApiSummaryOverview {
  const downstreamProofCount = auditEvidence.controlSummary.downstreamIntegrationProofCount;
  const readyDownstreamProofCount =
    auditEvidence.controlSummary.readyDownstreamIntegrationProofCount;
  const domainCount = dashboard.domainRows.length;
  const domainsNeedingAttentionCount =
    dashboard.domainRows.filter((row) => row.posture !== 'visibility-only').length;
  return Object.freeze({
    observedActionCount: auditEvidence.controlSummary.shadowEventCount,
    wouldReviewCount: auditEvidence.controlSummary.reviewLoadCount,
    wouldBlockCount: auditEvidence.controlSummary.blockedCount,
    policyGapCount: auditEvidence.controlSummary.policyGapCount,
    nonEnforcingEventCount: auditEvidence.controlSummary.nonEnforcingEventCount,
    downstreamProofCount,
    readyDownstreamProofCount,
    downstreamProofCoveragePercent: percent(readyDownstreamProofCount, downstreamProofCount),
    domainCount,
    domainsNeedingAttentionCount,
  });
}

function attentionKindFor(
  finding: ConsequenceAuditEvidenceFinding,
): ConsequenceDashboardApiSummaryAttentionKind {
  if (finding.kind === 'no-shadow-events') return 'start-shadow-mode';
  if (finding.kind === 'policy-gaps-present') return 'define-policy';
  if (finding.kind === 'review-load-present') return 'review-load';
  if (finding.kind === 'blocked-actions-present') return 'blocked-action';
  if (
    finding.kind === 'downstream-proof-missing' ||
    finding.kind === 'downstream-integration-incomplete'
  ) {
    return 'downstream-proof-missing';
  }
  if (finding.kind === 'raw-payload-present') return 'raw-payload-risk';
  if (finding.kind === 'policy-candidates-require-approval') return 'approve-candidates';
  if (finding.kind === 'promotion-not-activation-ready') return 'promotion-not-ready';
  return 'redacted-evidence-ready';
}

function routeForAttention(
  kind: ConsequenceDashboardApiSummaryAttentionKind,
  base: string,
): string {
  if (kind === 'start-shadow-mode') return route(base, '/summary');
  if (kind === 'define-policy' || kind === 'approve-candidates') {
    return route(base, '/policy-candidates');
  }
  if (kind === 'review-load' || kind === 'blocked-action') {
    return route(base, '/business-risk-dashboard');
  }
  if (kind === 'downstream-proof-missing' || kind === 'promotion-not-ready') {
    return route(base, '/audit-evidence');
  }
  if (kind === 'raw-payload-risk') return route(base, '/audit-evidence');
  return route(base, '/audit-evidence');
}

function nextStepFor(kind: ConsequenceDashboardApiSummaryAttentionKind): string {
  if (kind === 'start-shadow-mode') {
    return 'Record shadow admissions before drawing dashboard conclusions.';
  }
  if (kind === 'define-policy') {
    return 'Review policy candidates and close the missing policy boundary before enforcement.';
  }
  if (kind === 'review-load') {
    return 'Estimate reviewer capacity before moving the affected actions toward review or enforce mode.';
  }
  if (kind === 'blocked-action') {
    return 'Inspect blocked actions as control evidence before relaxing policy.';
  }
  if (kind === 'downstream-proof-missing') {
    return 'Attach downstream integration proof so admitted actions cannot bypass the customer enforcement point.';
  }
  if (kind === 'raw-payload-risk') {
    return 'Stop external sharing until raw payload exposure is removed from the source window.';
  }
  if (kind === 'approve-candidates') {
    return 'Keep candidates in an explicit approval workflow; do not auto-activate from recommendations.';
  }
  if (kind === 'promotion-not-ready') {
    return 'Finish activation readiness, replay, receipt, rollback, and monitoring evidence first.';
  }
  return 'Use this as review context; it is not a compliance or production-readiness claim.';
}

function attentionItemsFor(input: {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly base: string;
}): readonly ConsequenceDashboardApiSummaryAttentionItem[] {
  return Object.freeze(
    input.auditEvidence.findings
      .map((finding) => {
        const kind = attentionKindFor(finding);
        const payload = {
          kind,
          severity: finding.severity,
          count: finding.count,
          route: routeForAttention(kind, input.base),
          reasonCodes: Object.freeze([...finding.reasonCodes].sort()),
        } as const;
        return Object.freeze({
          itemId: `dashboard-attention:${hashCanonical(
            payload as unknown as CanonicalReleaseJsonValue,
          )}`,
          ...payload,
          title: finding.summary,
          nextStep: nextStepFor(kind),
        });
      })
      .sort((left, right) => {
        const severityDelta = severityRank(right.severity) - severityRank(left.severity);
        if (severityDelta !== 0) return severityDelta;
        return left.kind.localeCompare(right.kind);
      }),
  );
}

function severityRank(severity: ConsequenceAuditEvidenceFindingSeverity): number {
  if (severity === 'blocker') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  if (severity === 'low') return 1;
  return 0;
}

function domainNextStep(row: ConsequenceBusinessRiskDashboard['domainRows'][number]): string {
  if (row.posture === 'visibility-only') {
    return 'Keep observing before changing enforcement posture.';
  }
  if (row.blockedCount > 0) {
    return 'Review blocked actions and downstream proof before relaxing policy.';
  }
  if (row.reviewCount > 0) {
    return 'Check reviewer capacity and policy thresholds for this consequence domain.';
  }
  return 'Inspect policy coverage for this consequence domain.';
}

function topDomainsFor(
  dashboard: ConsequenceBusinessRiskDashboard,
): readonly ConsequenceDashboardApiSummaryDomainRow[] {
  return Object.freeze(
    dashboard.domainRows.slice(0, 5).map((row) =>
      Object.freeze({
        domain: row.domain,
        actionCount: row.actionCount,
        reviewCount: row.reviewCount,
        blockedCount: row.blockedCount,
        riskScore: row.riskScore,
        posture: row.posture,
        recommendedNextStep: domainNextStep(row),
      })
    ),
  );
}

function apiLinksFor(base: string): readonly ConsequenceDashboardApiSummaryLink[] {
  const link = (
    kind: ConsequenceDashboardApiSummaryLinkKind,
    path: string,
    summary: string,
  ): ConsequenceDashboardApiSummaryLink => Object.freeze({
    kind,
    route: route(base, path),
    method: 'GET',
    summary,
  });
  return Object.freeze([
    link('shadow-summary', '/summary', 'Raw-payload-free shadow mode control summary.'),
    link('action-risk-inventory', '/action-risk-inventory', 'Detected AI action surfaces by consequence risk.'),
    link('audit-evidence', '/audit-evidence', 'Canonical audit evidence export behind this summary.'),
    link('business-risk-dashboard', '/business-risk-dashboard', 'Full operator-facing dashboard model.'),
    link('policy-candidates', '/policy-candidates', 'Draft policy candidates that still require approval.'),
    link('simulations', '/simulations', 'Persisted shadow policy simulation reports.'),
  ]);
}

function headlineFor(input: {
  readonly dashboard: ConsequenceBusinessRiskDashboard;
  readonly overview: ConsequenceDashboardApiSummaryOverview;
}): string {
  if (input.overview.observedActionCount === 0) {
    return 'No AI action evidence has been recorded for this dashboard window.';
  }
  if (input.overview.policyGapCount > 0) {
    return `${input.overview.policyGapCount} AI actions need policy coverage before enforcement.`;
  }
  if (input.overview.wouldBlockCount > 0 || input.overview.wouldReviewCount > 0) {
    return `${input.overview.wouldReviewCount} actions need review and ${input.overview.wouldBlockCount} actions are blocked in this window.`;
  }
  if (input.dashboard.posture === 'attention-needed') {
    return 'AI action visibility is established, with control items still needing attention.';
  }
  return 'AI action visibility is established with no dashboard blockers in this window.';
}

function summaryIdFor(input: {
  readonly generatedAt: string;
  readonly auditDigest: string;
  readonly dashboardDigest: string;
}): string {
  return `dashboard-api-summary:${hashCanonical(
    input as unknown as CanonicalReleaseJsonValue,
  )}`;
}

export function createConsequenceDashboardApiSummary(
  input: CreateConsequenceDashboardApiSummaryInput,
): ConsequenceDashboardApiSummary {
  if (input.dashboard.sourceAuditExportDigest !== input.auditEvidence.digest) {
    throw new Error(
      'Consequence dashboard API summary dashboard must be bound to the auditEvidence digest.',
    );
  }
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? new Date().toISOString(),
    'generatedAt',
  );
  const base = routeBase(input.routeBase);
  const overview = overviewFor(input.auditEvidence, input.dashboard);
  const topDomains = topDomainsFor(input.dashboard);
  const payload = {
    version: CONSEQUENCE_DASHBOARD_API_SUMMARY_VERSION,
    summaryId: normalizeOptionalIdentifier(input.summaryId, 'summaryId') ??
      summaryIdFor({
        generatedAt,
        auditDigest: input.auditEvidence.digest,
        dashboardDigest: input.dashboard.digest,
      }),
    generatedAt,
    sourceAuditExportId: input.auditEvidence.exportId,
    sourceAuditExportDigest: input.auditEvidence.digest,
    sourceDashboardId: input.dashboard.dashboardId,
    sourceDashboardDigest: input.dashboard.digest,
    tenantId: input.auditEvidence.scope.tenantId,
    environment: input.auditEvidence.scope.environment,
    periodStart: input.auditEvidence.period.start,
    periodEnd: input.auditEvidence.period.end,
    posture: input.dashboard.posture,
    headline: headlineFor({ dashboard: input.dashboard, overview }),
    overview,
    tiles: tilesFor({
      auditEvidence: input.auditEvidence,
      dashboard: input.dashboard,
      base,
    }),
    attentionItems: attentionItemsFor({
      auditEvidence: input.auditEvidence,
      base,
    }),
    topDomains,
    omittedDomainCount: Math.max(0, input.dashboard.domainRows.length - topDomains.length),
    apiLinks: apiLinksFor(base),
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

export function consequenceDashboardApiSummaryDescriptor(): ConsequenceDashboardApiSummaryDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_DASHBOARD_API_SUMMARY_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    tileKinds: CONSEQUENCE_DASHBOARD_API_SUMMARY_TILE_KINDS,
    attentionKinds: CONSEQUENCE_DASHBOARD_API_SUMMARY_ATTENTION_KINDS,
    linkKinds: CONSEQUENCE_DASHBOARD_API_SUMMARY_LINK_KINDS,
    rawPayloadStored: false,
    rawImpactValueStored: false,
    complianceClaimed: false,
    productionReady: false,
    decisionSupportOnly: true,
    autoEnforce: false,
  });
}
