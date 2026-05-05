import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowAdmissionEvent,
  ShadowAdmissionEventSummary,
} from './shadow-events.js';
import {
  summarizeShadowAdmissionEvents,
} from './shadow-events.js';
import type {
  ShadowSummarySurface,
} from './shadow-summary.js';
import type {
  ShadowPolicySimulationReport,
} from './shadow-simulation.js';
import type {
  ShadowPolicyDiscoveryCandidates,
} from './policy-discovery-candidates.js';
import type {
  ShadowPolicyPromotionPacket,
} from './shadow-policy-promotion-packet.js';
import type {
  ShadowDownstreamIntegrationProof,
} from './shadow-downstream-integration-proof.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';
import type {
  ConsequenceTamperEvidentHistoryExport,
} from './tamper-evident-history.js';

export const CONSEQUENCE_AUDIT_EVIDENCE_EXPORT_VERSION =
  'attestor.consequence-audit-evidence-export.v1';

export const CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS = [
  'shadow-event-set',
  'shadow-summary',
  'shadow-simulation',
  'policy-discovery-candidates',
  'policy-promotion-packet',
  'downstream-integration-proof',
  'tamper-evident-history',
] as const;
export type ConsequenceAuditEvidenceArtifactKind =
  typeof CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS[number];

export const CONSEQUENCE_AUDIT_EVIDENCE_FINDING_SEVERITIES = [
  'info',
  'low',
  'medium',
  'high',
  'blocker',
] as const;
export type ConsequenceAuditEvidenceFindingSeverity =
  typeof CONSEQUENCE_AUDIT_EVIDENCE_FINDING_SEVERITIES[number];

export const CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS = [
  'no-shadow-events',
  'raw-payload-present',
  'policy-gaps-present',
  'review-load-present',
  'blocked-actions-present',
  'policy-candidates-require-approval',
  'promotion-not-activation-ready',
  'downstream-proof-missing',
  'downstream-integration-incomplete',
  'redacted-export-ready',
] as const;
export type ConsequenceAuditEvidenceFindingKind =
  typeof CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS[number];

export const CONSEQUENCE_AUDIT_EVIDENCE_ALIGNMENT_REFS = [
  'nist-ai-rmf-documentation-traceability',
  'eu-ai-act-logging-traceability-support',
  'soc2-system-generated-control-evidence',
  'owasp-security-logging-monitoring',
] as const;
export type ConsequenceAuditEvidenceAlignmentRef =
  typeof CONSEQUENCE_AUDIT_EVIDENCE_ALIGNMENT_REFS[number];

export interface CreateConsequenceAuditEvidenceExportInput {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly summarySurface?: ShadowSummarySurface | null;
  readonly simulations?: readonly ShadowPolicySimulationReport[] | null;
  readonly policyDiscovery?: ShadowPolicyDiscoveryCandidates | null;
  readonly promotionPackets?: readonly ShadowPolicyPromotionPacket[] | null;
  readonly downstreamProofs?: readonly ShadowDownstreamIntegrationProof[] | null;
  readonly tamperEvidentHistory?: ConsequenceTamperEvidentHistoryExport | null;
  readonly generatedAt?: string | null;
  readonly periodStart?: string | null;
  readonly periodEnd?: string | null;
  readonly tenantId?: string | null;
  readonly environment?: string | null;
  readonly exportId?: string | null;
  readonly includeSurfaceNames?: boolean | null;
}

export interface ConsequenceAuditEvidencePeriod {
  readonly start: string | null;
  readonly end: string | null;
}

export interface ConsequenceAuditEvidenceScope {
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly domains: readonly string[];
  readonly surfaceCount: number;
  readonly surfaceDigests: readonly string[];
  readonly includeSurfaceNames: boolean;
}

export interface ConsequenceAuditEvidenceSurfaceSummary {
  readonly surfaceDigest: string;
  readonly actionSurface: string | null;
  readonly domain: string;
  readonly eventCount: number;
  readonly allowedCount: number;
  readonly failClosedCount: number;
  readonly reviewLoadCount: number;
  readonly blockedCount: number;
}

export interface ConsequenceAuditEvidenceArtifactRef {
  readonly kind: ConsequenceAuditEvidenceArtifactKind;
  readonly id: string;
  readonly digest: string;
  readonly recordCount: number | null;
}

export interface ConsequenceAuditEvidenceControlSummary {
  readonly shadowEventCount: number;
  readonly simulationCount: number;
  readonly policyCandidateCount: number;
  readonly promotionPacketCount: number;
  readonly downstreamIntegrationProofCount: number;
  readonly readyDownstreamIntegrationProofCount: number;
  readonly tamperEvidentHistoryEntryCount: number;
  readonly policyGapCount: number;
  readonly reviewLoadCount: number;
  readonly blockedCount: number;
  readonly nonEnforcingEventCount: number;
  readonly rawPayloadEventCount: number;
}

export interface ConsequenceAuditEvidenceFinding {
  readonly findingId: string;
  readonly kind: ConsequenceAuditEvidenceFindingKind;
  readonly severity: ConsequenceAuditEvidenceFindingSeverity;
  readonly count: number;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
}

export interface ConsequenceAuditEvidenceControlPosture {
  readonly reviewReady: boolean;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly blockerCount: number;
  readonly findingCount: number;
}

export interface ConsequenceAuditEvidenceExport {
  readonly version: typeof CONSEQUENCE_AUDIT_EVIDENCE_EXPORT_VERSION;
  readonly exportId: string;
  readonly generatedAt: string;
  readonly period: ConsequenceAuditEvidencePeriod;
  readonly scope: ConsequenceAuditEvidenceScope;
  readonly summary: ShadowAdmissionEventSummary;
  readonly surfaceSummaries: readonly ConsequenceAuditEvidenceSurfaceSummary[];
  readonly artifactRefs: readonly ConsequenceAuditEvidenceArtifactRef[];
  readonly eventSetDigest: string;
  readonly sampleEventDigests: readonly string[];
  readonly omittedEventDigestCount: number;
  readonly controlSummary: ConsequenceAuditEvidenceControlSummary;
  readonly findings: readonly ConsequenceAuditEvidenceFinding[];
  readonly controlPosture: ConsequenceAuditEvidenceControlPosture;
  readonly alignmentRefs: readonly ConsequenceAuditEvidenceAlignmentRef[];
  readonly complianceClaimed: false;
  readonly rawPayloadStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAuditEvidenceExportDescriptor {
  readonly version: typeof CONSEQUENCE_AUDIT_EVIDENCE_EXPORT_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly artifactKinds: typeof CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS;
  readonly findingKinds: typeof CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS;
  readonly findingSeverities: typeof CONSEQUENCE_AUDIT_EVIDENCE_FINDING_SEVERITIES;
  readonly alignmentRefs: typeof CONSEQUENCE_AUDIT_EVIDENCE_ALIGNMENT_REFS;
  readonly rawPayloadStored: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly approvalRequired: true;
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
    throw new Error(`Consequence audit evidence export ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence audit evidence export ${fieldName} requires a non-empty value.`,
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
      `Consequence audit evidence export ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function normalizeOptionalIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIsoTimestamp(value, fieldName);
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function inferSingleValue(
  explicitValue: string | null | undefined,
  observedValues: readonly (string | null | undefined)[],
  fieldName: string,
): string | null {
  const explicit = normalizeOptionalIdentifier(explicitValue, fieldName);
  const observed = uniqueSorted(
    observedValues
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim()),
  );
  if (explicit !== null) {
    const mismatches = observed.filter((value) => value !== explicit);
    if (mismatches.length > 0) {
      throw new Error(
        `Consequence audit evidence export ${fieldName} does not match observed events.`,
      );
    }
    return explicit;
  }
  if (observed.length > 1) {
    throw new Error(
      `Consequence audit evidence export ${fieldName} must be scoped to one value.`,
    );
  }
  return observed[0] ?? null;
}

function periodFor(input: CreateConsequenceAuditEvidenceExportInput):
ConsequenceAuditEvidencePeriod {
  const eventTimes = input.events.map((event) => event.occurredAt).sort();
  const start = normalizeOptionalIsoTimestamp(
    input.periodStart ?? eventTimes[0] ?? null,
    'periodStart',
  );
  const end = normalizeOptionalIsoTimestamp(
    input.periodEnd ?? eventTimes[eventTimes.length - 1] ?? null,
    'periodEnd',
  );
  if (start !== null && end !== null && start > end) {
    throw new Error('Consequence audit evidence export periodStart must be before periodEnd.');
  }
  return Object.freeze({ start, end });
}

function eventSetDigestFor(events: readonly ShadowAdmissionEvent[]): string {
  return hashCanonical({
    eventDigests: events.map((event) => event.digest).sort(),
  } as unknown as CanonicalReleaseJsonValue);
}

function surfaceKey(event: ShadowAdmissionEvent): string {
  return `${event.domain}\n${event.actionSurface ?? event.downstreamSystem}.${event.action}`;
}

function surfaceDigestFor(input: {
  readonly domain: string;
  readonly actionSurface: string | null;
}): string {
  return hashCanonical(input as unknown as CanonicalReleaseJsonValue);
}

function surfaceSummariesFor(
  events: readonly ShadowAdmissionEvent[],
  includeSurfaceNames: boolean,
): readonly ConsequenceAuditEvidenceSurfaceSummary[] {
  const surfaces = new Map<string, {
    domain: string;
    actionSurface: string | null;
    eventCount: number;
    allowedCount: number;
    failClosedCount: number;
    reviewLoadCount: number;
    blockedCount: number;
  }>();

  for (const event of events) {
    const key = surfaceKey(event);
    const current = surfaces.get(key) ?? {
      domain: String(event.domain),
      actionSurface: event.actionSurface ?? `${event.downstreamSystem}.${event.action}`,
      eventCount: 0,
      allowedCount: 0,
      failClosedCount: 0,
      reviewLoadCount: 0,
      blockedCount: 0,
    };
    current.eventCount += 1;
    if (event.allowed) current.allowedCount += 1;
    if (event.failClosed) current.failClosedCount += 1;
    if (event.effectiveDecision === 'review') current.reviewLoadCount += 1;
    if (event.effectiveDecision === 'block') current.blockedCount += 1;
    surfaces.set(key, current);
  }

  return Object.freeze(
    [...surfaces.values()]
      .map((surface) => Object.freeze({
        surfaceDigest: surfaceDigestFor({
          domain: surface.domain,
          actionSurface: surface.actionSurface,
        }),
        actionSurface: includeSurfaceNames ? surface.actionSurface : null,
        domain: surface.domain,
        eventCount: surface.eventCount,
        allowedCount: surface.allowedCount,
        failClosedCount: surface.failClosedCount,
        reviewLoadCount: surface.reviewLoadCount,
        blockedCount: surface.blockedCount,
      }))
      .sort((left, right) => left.surfaceDigest.localeCompare(right.surfaceDigest)),
  );
}

function artifactRef(
  kind: ConsequenceAuditEvidenceArtifactKind,
  id: string,
  digest: string,
  recordCount: number | null,
): ConsequenceAuditEvidenceArtifactRef {
  return Object.freeze({
    kind,
    id,
    digest,
    recordCount,
  });
}

function artifactRefsFor(input: {
  readonly events: readonly ShadowAdmissionEvent[];
  readonly eventSetDigest: string;
  readonly summarySurface: ShadowSummarySurface | null;
  readonly simulations: readonly ShadowPolicySimulationReport[];
  readonly policyDiscovery: ShadowPolicyDiscoveryCandidates | null;
  readonly promotionPackets: readonly ShadowPolicyPromotionPacket[];
  readonly downstreamProofs: readonly ShadowDownstreamIntegrationProof[];
  readonly tamperEvidentHistory: ConsequenceTamperEvidentHistoryExport | null;
}): readonly ConsequenceAuditEvidenceArtifactRef[] {
  return Object.freeze([
    artifactRef('shadow-event-set', `shadow-events:${input.eventSetDigest}`, input.eventSetDigest, input.events.length),
    ...(
      input.summarySurface === null
        ? []
        : [artifactRef('shadow-summary', input.summarySurface.version, input.summarySurface.digest, input.summarySurface.eventCount)]
    ),
    ...input.simulations.map((report) =>
      artifactRef('shadow-simulation', report.reportId, report.digest, report.eventCount),
    ),
    ...(
      input.policyDiscovery === null
        ? []
        : [
            artifactRef(
              'policy-discovery-candidates',
              input.policyDiscovery.sourceReportId ?? input.policyDiscovery.digest,
              input.policyDiscovery.digest,
              input.policyDiscovery.candidateCount,
            ),
          ]
    ),
    ...input.promotionPackets.map((packet) =>
      artifactRef('policy-promotion-packet', packet.packetId, packet.digest, packet.bundleDraft.ruleCount),
    ),
    ...input.downstreamProofs.map((proof) =>
      artifactRef('downstream-integration-proof', proof.proofId, proof.digest, proof.observedCheckCount),
    ),
    ...(
      input.tamperEvidentHistory === null
        ? []
        : [
            artifactRef(
              'tamper-evident-history',
              input.tamperEvidentHistory.historyId,
              input.tamperEvidentHistory.digest,
              input.tamperEvidentHistory.entryCount,
            ),
          ]
    ),
  ].sort((left, right) =>
    `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
  ));
}

function findingIdFor(input: {
  readonly kind: ConsequenceAuditEvidenceFindingKind;
  readonly count: number;
  readonly reasonCodes: readonly string[];
}): string {
  return `audit-finding:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function finding(
  kind: ConsequenceAuditEvidenceFindingKind,
  severity: ConsequenceAuditEvidenceFindingSeverity,
  count: number,
  summary: string,
  reasonCodes: readonly string[],
): ConsequenceAuditEvidenceFinding {
  const sortedReasonCodes = uniqueSorted(reasonCodes);
  return Object.freeze({
    findingId: findingIdFor({
      kind,
      count,
      reasonCodes: sortedReasonCodes,
    }),
    kind,
    severity,
    count,
    summary,
    reasonCodes: sortedReasonCodes,
  });
}

function findingsFor(input: {
  readonly summary: ShadowAdmissionEventSummary;
  readonly policyDiscovery: ShadowPolicyDiscoveryCandidates | null;
  readonly promotionPackets: readonly ShadowPolicyPromotionPacket[];
  readonly downstreamProofs: readonly ShadowDownstreamIntegrationProof[];
}): readonly ConsequenceAuditEvidenceFinding[] {
  const findings: ConsequenceAuditEvidenceFinding[] = [];
  if (input.summary.totalEvents === 0) {
    findings.push(finding(
      'no-shadow-events',
      'blocker',
      0,
      'No shadow admission events are present for this audit evidence export.',
      ['audit-no-shadow-events'],
    ));
  }
  if (input.summary.rawPayloadEventCount > 0) {
    findings.push(finding(
      'raw-payload-present',
      'blocker',
      input.summary.rawPayloadEventCount,
      'One or more source events claim raw payload storage; do not hand this export to an external reviewer until the source window is redacted.',
      ['audit-raw-payload-present'],
    ));
  }
  if (input.summary.policyGapCount > 0) {
    findings.push(finding(
      'policy-gaps-present',
      'high',
      input.summary.policyGapCount,
      'The source window contains AI actions without closed policy coverage.',
      ['audit-policy-gaps-present'],
    ));
  }
  if (input.summary.reviewLoadCount > 0) {
    findings.push(finding(
      'review-load-present',
      'medium',
      input.summary.reviewLoadCount,
      'The source window contains actions that would create review load.',
      ['audit-review-load-present'],
    ));
  }
  if (input.summary.blockedCount > 0) {
    findings.push(finding(
      'blocked-actions-present',
      'medium',
      input.summary.blockedCount,
      'The source window contains blocked actions that should be reviewable as control evidence.',
      ['audit-blocked-actions-present'],
    ));
  }
  if ((input.policyDiscovery?.candidateCount ?? 0) > 0) {
    findings.push(finding(
      'policy-candidates-require-approval',
      'medium',
      input.policyDiscovery?.candidateCount ?? 0,
      'Policy discovery produced candidates; each candidate still requires customer approval before enforcement.',
      ['audit-policy-candidates-require-approval'],
    ));
  }
  const blockedPromotionPackets = input.promotionPackets.filter((packet) => !packet.activationReady);
  if (blockedPromotionPackets.length > 0) {
    findings.push(finding(
      'promotion-not-activation-ready',
      'medium',
      blockedPromotionPackets.length,
      'One or more promotion packets are review evidence only and are not activation-ready.',
      ['audit-promotion-not-activation-ready'],
    ));
  }
  if (input.promotionPackets.length > 0 && input.downstreamProofs.length === 0) {
    findings.push(finding(
      'downstream-proof-missing',
      'high',
      input.promotionPackets.length,
      'Promotion evidence exists without downstream integration proof for this export window.',
      ['audit-downstream-proof-missing'],
    ));
  }
  const incompleteProofs = input.downstreamProofs.filter((proof) => !proof.integrationProofReady);
  if (incompleteProofs.length > 0) {
    findings.push(finding(
      'downstream-integration-incomplete',
      'high',
      incompleteProofs.length,
      'One or more downstream integration proofs are incomplete.',
      ['audit-downstream-integration-incomplete'],
    ));
  }
  if (
    input.summary.totalEvents > 0 &&
    input.summary.rawPayloadEventCount === 0
  ) {
    findings.push(finding(
      'redacted-export-ready',
      'info',
      input.summary.totalEvents,
      'The audit evidence export is digest-first and does not claim raw payload storage.',
      ['audit-redacted-export-ready'],
    ));
  }

  return Object.freeze(findings);
}

function exportIdFor(input: {
  readonly generatedAt: string;
  readonly period: ConsequenceAuditEvidencePeriod;
  readonly tenantId: string | null;
  readonly eventSetDigest: string;
  readonly artifactDigests: readonly string[];
}): string {
  return `audit-evidence-export:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function controlPostureFor(
  events: readonly ShadowAdmissionEvent[],
  findings: readonly ConsequenceAuditEvidenceFinding[],
): ConsequenceAuditEvidenceControlPosture {
  const blockerCount = findings.filter((item) => item.severity === 'blocker').length;
  return Object.freeze({
    reviewReady: events.length > 0 && blockerCount === 0,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    blockerCount,
    findingCount: findings.length,
  });
}

export function createConsequenceAuditEvidenceExport(
  input: CreateConsequenceAuditEvidenceExportInput,
): ConsequenceAuditEvidenceExport {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? new Date().toISOString(),
    'generatedAt',
  );
  const period = periodFor(input);
  const tenantId = inferSingleValue(
    input.tenantId,
    input.events.map((event) => event.tenantId),
    'tenantId',
  );
  const environment = inferSingleValue(
    input.environment,
    input.events.map((event) => event.environment),
    'environment',
  );
  const includeSurfaceNames = input.includeSurfaceNames === true;
  const summary = summarizeShadowAdmissionEvents(input.events);
  const surfaceSummaries = surfaceSummariesFor(input.events, includeSurfaceNames);
  const eventSetDigest = eventSetDigestFor(input.events);
  const simulations = Object.freeze([...(input.simulations ?? [])]);
  const promotionPackets = Object.freeze([...(input.promotionPackets ?? [])]);
  const downstreamProofs = Object.freeze([...(input.downstreamProofs ?? [])]);
  const tamperEvidentHistory = input.tamperEvidentHistory ?? null;
  const artifactRefs = artifactRefsFor({
    events: input.events,
    eventSetDigest,
    summarySurface: input.summarySurface ?? null,
    simulations,
    policyDiscovery: input.policyDiscovery ?? null,
    promotionPackets,
    downstreamProofs,
    tamperEvidentHistory,
  });
  const findings = findingsFor({
    summary,
    policyDiscovery: input.policyDiscovery ?? null,
    promotionPackets,
    downstreamProofs,
  });
  const sampleEventDigests = Object.freeze(
    input.events.map((event) => event.digest).sort().slice(0, 50),
  );
  const payload = {
    version: CONSEQUENCE_AUDIT_EVIDENCE_EXPORT_VERSION,
    exportId: normalizeOptionalIdentifier(input.exportId, 'exportId') ??
      exportIdFor({
        generatedAt,
        period,
        tenantId,
        eventSetDigest,
        artifactDigests: artifactRefs.map((artifact) => artifact.digest),
      }),
    generatedAt,
    period,
    scope: {
      tenantId,
      environment,
      domains: uniqueSorted(input.events.map((event) => String(event.domain))),
      surfaceCount: surfaceSummaries.length,
      surfaceDigests: Object.freeze(surfaceSummaries.map((surface) => surface.surfaceDigest)),
      includeSurfaceNames,
    },
    summary,
    surfaceSummaries,
    artifactRefs,
    eventSetDigest,
    sampleEventDigests,
    omittedEventDigestCount: Math.max(0, input.events.length - sampleEventDigests.length),
    controlSummary: {
      shadowEventCount: input.events.length,
      simulationCount: simulations.length,
      policyCandidateCount: input.policyDiscovery?.candidateCount ?? 0,
      promotionPacketCount: promotionPackets.length,
      downstreamIntegrationProofCount: downstreamProofs.length,
      readyDownstreamIntegrationProofCount:
        downstreamProofs.filter((proof) => proof.integrationProofReady).length,
      tamperEvidentHistoryEntryCount: tamperEvidentHistory?.entryCount ?? 0,
      policyGapCount: summary.policyGapCount,
      reviewLoadCount: summary.reviewLoadCount,
      blockedCount: summary.blockedCount,
      nonEnforcingEventCount: summary.nonEnforcingEventCount,
      rawPayloadEventCount: summary.rawPayloadEventCount,
    },
    findings,
    controlPosture: controlPostureFor(input.events, findings),
    alignmentRefs: CONSEQUENCE_AUDIT_EVIDENCE_ALIGNMENT_REFS,
    complianceClaimed: false,
    rawPayloadStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceAuditEvidenceExportDescriptor():
ConsequenceAuditEvidenceExportDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_AUDIT_EVIDENCE_EXPORT_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    artifactKinds: CONSEQUENCE_AUDIT_EVIDENCE_ARTIFACT_KINDS,
    findingKinds: CONSEQUENCE_AUDIT_EVIDENCE_FINDING_KINDS,
    findingSeverities: CONSEQUENCE_AUDIT_EVIDENCE_FINDING_SEVERITIES,
    alignmentRefs: CONSEQUENCE_AUDIT_EVIDENCE_ALIGNMENT_REFS,
    rawPayloadStored: false,
    complianceClaimed: false,
    productionReady: false,
    approvalRequired: true,
    autoEnforce: false,
  });
}
