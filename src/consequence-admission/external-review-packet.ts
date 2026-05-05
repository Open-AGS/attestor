import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAuditEvidenceExport,
  ConsequenceAuditEvidenceFindingSeverity,
} from './audit-evidence-export.js';
import type {
  ConsequenceBusinessRiskDashboard,
} from './business-risk-dashboard.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
} from './data-minimization-redaction-policy.js';

export const CONSEQUENCE_EXTERNAL_REVIEW_PACKET_VERSION =
  'attestor.consequence-external-review-packet.v1';

export const CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS = [
  'authorization-boundary',
  'data-minimization',
  'tenant-isolation',
  'proof-integrity',
  'production-storage',
  'downstream-enforcement',
  'safe-retry-loop',
  'supply-chain',
  'operations-readiness',
  'non-claims-boundary',
] as const;
export type ConsequenceExternalReviewFocusArea =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS[number];

export const CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS = [
  'audit-evidence-export',
  'business-risk-dashboard',
  'production-storage-path',
  'security-policy',
  'license',
  'release-notes',
  'openapi-contract',
  'ci-verify',
  'codeql',
  'dependency-review',
  'supply-chain-baseline',
  'architecture-doc',
  'external-reference',
  'custom-reference',
] as const;
export type ConsequenceExternalReviewEvidenceKind =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS[number];

export const CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES = [
  'present',
  'missing',
  'pending',
  'not-claimed',
] as const;
export type ConsequenceExternalReviewEvidenceStatus =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES[number];

export const CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS = [
  'audit-evidence-not-review-ready',
  'raw-payload-blocker',
  'business-risk-dashboard-missing',
  'production-storage-not-ready',
  'required-repository-evidence-missing',
  'external-review-required',
  'redacted-review-packet-ready',
] as const;
export type ConsequenceExternalReviewFindingKind =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS[number];

export const CONSEQUENCE_EXTERNAL_REVIEW_CHECK_STATUSES = [
  'ready',
  'needs-review',
  'blocked',
  'not-supplied',
] as const;
export type ConsequenceExternalReviewCheckStatus =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_CHECK_STATUSES[number];

export const CONSEQUENCE_EXTERNAL_REVIEW_ALIGNMENT_REFS = [
  'nist-ssdf-review-evidence',
  'owasp-asvs-verification-planning',
  'openssf-scorecard-oss-risk',
  'attestor-non-claims-boundary',
] as const;
export type ConsequenceExternalReviewAlignmentRef =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_ALIGNMENT_REFS[number];

export const CONSEQUENCE_EXTERNAL_REVIEW_NON_CLAIMS = [
  'not-a-security-audit',
  'not-a-compliance-certificate',
  'not-a-production-readiness-guarantee',
  'not-a-penetration-test',
  'not-customer-enforcement-proof-by-itself',
  'not-raw-data-export',
] as const;
export type ConsequenceExternalReviewNonClaim =
  typeof CONSEQUENCE_EXTERNAL_REVIEW_NON_CLAIMS[number];

export interface CreateConsequenceExternalReviewPacketInput {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly businessRiskDashboard?: ConsequenceBusinessRiskDashboard | null;
  readonly runtimeEvidence?: ConsequenceExternalReviewRuntimeEvidenceInput | null;
  readonly repositoryEvidence?: readonly ConsequenceExternalReviewEvidenceRefInput[] | null;
  readonly generatedAt?: string | null;
  readonly packetId?: string | null;
  readonly reviewerScope?: string | null;
}

export interface ConsequenceExternalReviewRuntimeEvidenceInput {
  readonly runtimeProfileId?: string | null;
  readonly productionStoragePathState?: string | null;
  readonly readyForSelectedProfile?: boolean | null;
  readonly productionReady?: boolean | null;
  readonly blockerCount?: number | null;
  readonly requiredProofs?: readonly string[] | null;
  readonly sourceDigest?: string | null;
}

export interface ConsequenceExternalReviewRuntimeEvidence {
  readonly runtimeProfileId: string | null;
  readonly productionStoragePathState: string | null;
  readonly readyForSelectedProfile: boolean | null;
  readonly productionReady: boolean | null;
  readonly blockerCount: number;
  readonly requiredProofs: readonly string[];
  readonly sourceDigest: string | null;
  readonly digest: string;
  readonly rawPayloadStored: false;
}

export interface ConsequenceExternalReviewEvidenceRefInput {
  readonly kind: ConsequenceExternalReviewEvidenceKind;
  readonly id: string;
  readonly digest?: string | null;
  readonly uri?: string | null;
  readonly status?: ConsequenceExternalReviewEvidenceStatus | null;
  readonly summary?: string | null;
}

export interface ConsequenceExternalReviewEvidenceRef {
  readonly kind: ConsequenceExternalReviewEvidenceKind;
  readonly id: string;
  readonly digest: string | null;
  readonly uri: string | null;
  readonly status: ConsequenceExternalReviewEvidenceStatus;
  readonly summary: string | null;
}

export interface ConsequenceExternalReviewChecklistItem {
  readonly itemId: string;
  readonly focusArea: ConsequenceExternalReviewFocusArea;
  readonly status: ConsequenceExternalReviewCheckStatus;
  readonly question: string;
  readonly evidenceKinds: readonly ConsequenceExternalReviewEvidenceKind[];
  readonly reasonCodes: readonly string[];
}

export interface ConsequenceExternalReviewFinding {
  readonly findingId: string;
  readonly kind: ConsequenceExternalReviewFindingKind;
  readonly severity: ConsequenceAuditEvidenceFindingSeverity;
  readonly count: number;
  readonly summary: string;
  readonly reasonCodes: readonly string[];
}

export interface ConsequenceExternalReviewControlPosture {
  readonly reviewReady: boolean;
  readonly approvalRequired: true;
  readonly securityAuditClaimed: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly autoEnforce: false;
  readonly blockerCount: number;
  readonly findingCount: number;
}

export interface ConsequenceExternalReviewPacket {
  readonly version: typeof CONSEQUENCE_EXTERNAL_REVIEW_PACKET_VERSION;
  readonly packetId: string;
  readonly generatedAt: string;
  readonly reviewerScope: string;
  readonly tenantId: string | null;
  readonly environment: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly domains: readonly string[];
  readonly auditEvidenceExportId: string;
  readonly auditEvidenceDigest: string;
  readonly businessRiskDashboardDigest: string | null;
  readonly runtimeEvidence: ConsequenceExternalReviewRuntimeEvidence | null;
  readonly evidenceRefs: readonly ConsequenceExternalReviewEvidenceRef[];
  readonly focusAreas: typeof CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS;
  readonly checklist: readonly ConsequenceExternalReviewChecklistItem[];
  readonly findings: readonly ConsequenceExternalReviewFinding[];
  readonly controlPosture: ConsequenceExternalReviewControlPosture;
  readonly alignmentRefs: typeof CONSEQUENCE_EXTERNAL_REVIEW_ALIGNMENT_REFS;
  readonly nonClaims: typeof CONSEQUENCE_EXTERNAL_REVIEW_NON_CLAIMS;
  readonly reviewerInstructions: readonly string[];
  readonly rawPayloadStored: false;
  readonly securityAuditClaimed: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
  readonly autoEnforce: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceExternalReviewPacketDescriptor {
  readonly version: typeof CONSEQUENCE_EXTERNAL_REVIEW_PACKET_VERSION;
  readonly dataMinimizationPolicyVersion: typeof CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION;
  readonly focusAreas: typeof CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS;
  readonly evidenceKinds: typeof CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS;
  readonly evidenceStatuses: typeof CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES;
  readonly findingKinds: typeof CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS;
  readonly alignmentRefs: typeof CONSEQUENCE_EXTERNAL_REVIEW_ALIGNMENT_REFS;
  readonly nonClaims: typeof CONSEQUENCE_EXTERNAL_REVIEW_NON_CLAIMS;
  readonly rawPayloadStored: false;
  readonly securityAuditClaimed: false;
  readonly complianceClaimed: false;
  readonly productionReady: false;
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
    throw new Error(`Consequence external review packet ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence external review packet ${fieldName} requires a non-empty value.`,
    );
  }
  if (normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(
      `Consequence external review packet ${fieldName} must be bounded and control-free.`,
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
      `Consequence external review packet ${fieldName} must be a sha256 digest.`,
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
      `Consequence external review packet ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function normalizeNonNegativeInteger(value: number | null | undefined, fieldName: string):
number {
  if (value === undefined || value === null) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Consequence external review packet ${fieldName} must be a non-negative integer.`,
    );
  }
  return value;
}

function normalizeEvidenceKind(
  value: ConsequenceExternalReviewEvidenceKind,
): ConsequenceExternalReviewEvidenceKind {
  if (!CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS.includes(value)) {
    throw new Error(
      `Consequence external review packet evidence kind must be one of: ${CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS.join(', ')}.`,
    );
  }
  return value;
}

function normalizeEvidenceStatus(
  value: ConsequenceExternalReviewEvidenceStatus | null | undefined,
): ConsequenceExternalReviewEvidenceStatus {
  const normalized = value ?? 'present';
  if (!CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES.includes(normalized)) {
    throw new Error(
      `Consequence external review packet evidence status must be one of: ${CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES.join(', ')}.`,
    );
  }
  return normalized;
}

function normalizeEvidenceRef(
  input: ConsequenceExternalReviewEvidenceRefInput,
): ConsequenceExternalReviewEvidenceRef {
  return Object.freeze({
    kind: normalizeEvidenceKind(input.kind),
    id: normalizeIdentifier(input.id, 'evidenceRefs[].id'),
    digest: normalizeOptionalDigest(input.digest, 'evidenceRefs[].digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'evidenceRefs[].uri'),
    status: normalizeEvidenceStatus(input.status),
    summary: normalizeOptionalIdentifier(input.summary, 'evidenceRefs[].summary'),
  });
}

function normalizeEvidenceRefs(
  auditEvidence: ConsequenceAuditEvidenceExport,
  businessRiskDashboard: ConsequenceBusinessRiskDashboard | null,
  repositoryEvidence: readonly ConsequenceExternalReviewEvidenceRefInput[] | null | undefined,
): readonly ConsequenceExternalReviewEvidenceRef[] {
  const refs = [
    normalizeEvidenceRef({
      kind: 'audit-evidence-export',
      id: auditEvidence.exportId,
      digest: auditEvidence.digest,
      status: 'present',
      summary: 'Canonical digest-first audit evidence export.',
    }),
    ...(
      businessRiskDashboard === null
        ? []
        : [
            normalizeEvidenceRef({
              kind: 'business-risk-dashboard',
              id: businessRiskDashboard.dashboardId,
              digest: businessRiskDashboard.digest,
              status: 'present',
              summary: 'Operator-facing dashboard bound to the audit evidence digest.',
            }),
          ]
    ),
    ...(repositoryEvidence ?? []).map(normalizeEvidenceRef),
  ];
  const seen = new Set<string>();
  return Object.freeze(
    refs
      .filter((ref) => {
        const key = `${ref.kind}:${ref.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) =>
        `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
      ),
  );
}

function normalizeRuntimeEvidence(
  input: ConsequenceExternalReviewRuntimeEvidenceInput | null | undefined,
): ConsequenceExternalReviewRuntimeEvidence | null {
  if (input === undefined || input === null) return null;
  const normalized = {
    runtimeProfileId: normalizeOptionalIdentifier(input.runtimeProfileId, 'runtimeProfileId'),
    productionStoragePathState:
      normalizeOptionalIdentifier(input.productionStoragePathState, 'productionStoragePathState'),
    readyForSelectedProfile: input.readyForSelectedProfile ?? null,
    productionReady: input.productionReady ?? null,
    blockerCount: normalizeNonNegativeInteger(input.blockerCount, 'runtimeEvidence.blockerCount'),
    requiredProofs: Object.freeze(
      [...(input.requiredProofs ?? [])]
        .map((proof) => normalizeIdentifier(proof, 'runtimeEvidence.requiredProofs[]'))
        .sort(),
    ),
    sourceDigest: normalizeOptionalDigest(input.sourceDigest, 'runtimeEvidence.sourceDigest'),
    rawPayloadStored: false,
  } as const;
  return Object.freeze({
    ...normalized,
    digest: hashCanonical(normalized as unknown as CanonicalReleaseJsonValue),
  });
}

function evidencePresent(
  refs: readonly ConsequenceExternalReviewEvidenceRef[],
  kind: ConsequenceExternalReviewEvidenceKind,
): boolean {
  return refs.some((ref) => ref.kind === kind && ref.status === 'present');
}

function finding(
  kind: ConsequenceExternalReviewFindingKind,
  severity: ConsequenceAuditEvidenceFindingSeverity,
  count: number,
  summary: string,
  reasonCodes: readonly string[],
): ConsequenceExternalReviewFinding {
  const sortedReasonCodes = Object.freeze([...new Set(reasonCodes)].sort());
  return Object.freeze({
    findingId: `external-review-finding:${hashCanonical({
      kind,
      count,
      reasonCodes: sortedReasonCodes,
    } as unknown as CanonicalReleaseJsonValue)}`,
    kind,
    severity,
    count,
    summary,
    reasonCodes: sortedReasonCodes,
  });
}

function findingsFor(input: {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly dashboard: ConsequenceBusinessRiskDashboard | null;
  readonly runtimeEvidence: ConsequenceExternalReviewRuntimeEvidence | null;
  readonly evidenceRefs: readonly ConsequenceExternalReviewEvidenceRef[];
}): readonly ConsequenceExternalReviewFinding[] {
  const findings: ConsequenceExternalReviewFinding[] = [];
  if (!input.auditEvidence.controlPosture.reviewReady) {
    findings.push(finding(
      'audit-evidence-not-review-ready',
      'high',
      1,
      'The audit evidence export is not review-ready; inspect blocker findings before relying on this packet.',
      ['external-review-audit-evidence-not-ready'],
    ));
  }
  if (input.auditEvidence.controlSummary.rawPayloadEventCount > 0) {
    findings.push(finding(
      'raw-payload-blocker',
      'blocker',
      input.auditEvidence.controlSummary.rawPayloadEventCount,
      'One or more source events claim raw payload storage; do not hand this packet to an external reviewer until remediated.',
      ['external-review-raw-payload-blocker'],
    ));
  }
  if (input.dashboard === null) {
    findings.push(finding(
      'business-risk-dashboard-missing',
      'low',
      1,
      'No business risk dashboard was attached; reviewer context is evidence-only.',
      ['external-review-dashboard-missing'],
    ));
  }
  if (
    input.runtimeEvidence !== null &&
    (
      input.runtimeEvidence.productionReady === false ||
      input.runtimeEvidence.readyForSelectedProfile === false ||
      input.runtimeEvidence.blockerCount > 0
    )
  ) {
    findings.push(finding(
      'production-storage-not-ready',
      'high',
      Math.max(1, input.runtimeEvidence.blockerCount),
      'Runtime or production storage evidence indicates remaining blockers.',
      ['external-review-production-storage-not-ready'],
    ));
  }
  const requiredRepositoryEvidence: ConsequenceExternalReviewEvidenceKind[] = [
    'security-policy',
    'license',
    'ci-verify',
    'codeql',
    'dependency-review',
    'supply-chain-baseline',
  ];
  const missing = requiredRepositoryEvidence.filter((kind) =>
    !evidencePresent(input.evidenceRefs, kind)
  );
  if (missing.length > 0) {
    findings.push(finding(
      'required-repository-evidence-missing',
      'medium',
      missing.length,
      'One or more reviewer-facing repository evidence refs are missing.',
      missing.map((kind) => `external-review-missing:${kind}`),
    ));
  }
  findings.push(finding(
    'external-review-required',
    'info',
    1,
    'This packet is designed to support external review; it is not the review result.',
    ['external-review-required'],
  ));
  if (input.auditEvidence.rawPayloadStored === false) {
    findings.push(finding(
      'redacted-review-packet-ready',
      'info',
      1,
      'The review packet is digest-first and does not claim raw payload storage.',
      ['external-review-redacted-packet-ready'],
    ));
  }
  return Object.freeze(findings);
}

function checklistItem(
  itemId: string,
  focusArea: ConsequenceExternalReviewFocusArea,
  status: ConsequenceExternalReviewCheckStatus,
  question: string,
  evidenceKinds: readonly ConsequenceExternalReviewEvidenceKind[],
  reasonCodes: readonly string[],
): ConsequenceExternalReviewChecklistItem {
  return Object.freeze({
    itemId,
    focusArea,
    status,
    question,
    evidenceKinds: Object.freeze([...evidenceKinds]),
    reasonCodes: Object.freeze([...reasonCodes].sort()),
  });
}

function checklistFor(input: {
  readonly auditEvidence: ConsequenceAuditEvidenceExport;
  readonly dashboard: ConsequenceBusinessRiskDashboard | null;
  readonly runtimeEvidence: ConsequenceExternalReviewRuntimeEvidence | null;
  readonly evidenceRefs: readonly ConsequenceExternalReviewEvidenceRef[];
}): readonly ConsequenceExternalReviewChecklistItem[] {
  return Object.freeze([
    checklistItem(
      'review-admission-boundary',
      'authorization-boundary',
      input.auditEvidence.controlSummary.shadowEventCount > 0 ? 'needs-review' : 'blocked',
      'Confirm that important AI actions are represented as admissions before downstream consequences.',
      ['audit-evidence-export'],
      ['review-admission-boundary'],
    ),
    checklistItem(
      'review-redaction-boundary',
      'data-minimization',
      input.auditEvidence.controlSummary.rawPayloadEventCount === 0 ? 'ready' : 'blocked',
      'Confirm reviewer artifacts contain digests, counts, refs, and statuses rather than raw sensitive payloads.',
      ['audit-evidence-export'],
      ['review-redaction-boundary'],
    ),
    checklistItem(
      'review-tenant-scope',
      'tenant-isolation',
      input.auditEvidence.scope.tenantId === null ? 'needs-review' : 'ready',
      'Confirm the packet is tenant-scoped and does not mix evidence windows.',
      ['audit-evidence-export'],
      ['review-tenant-scope'],
    ),
    checklistItem(
      'review-proof-integrity',
      'proof-integrity',
      input.auditEvidence.digest.startsWith('sha256:') ? 'ready' : 'blocked',
      'Verify audit evidence digests and artifact references before trusting the packet.',
      ['audit-evidence-export'],
      ['review-proof-integrity'],
    ),
    checklistItem(
      'review-production-storage',
      'production-storage',
      input.runtimeEvidence === null
        ? 'not-supplied'
        : input.runtimeEvidence.readyForSelectedProfile === true
          ? 'ready'
          : 'blocked',
      'Inspect runtime storage evidence and blockers before accepting production-shared claims.',
      ['production-storage-path'],
      ['review-production-storage'],
    ),
    checklistItem(
      'review-downstream-enforcement',
      'downstream-enforcement',
      input.auditEvidence.controlSummary.readyDownstreamIntegrationProofCount > 0
        ? 'ready'
        : 'needs-review',
      'Confirm customer enforcement points verify admissions before writes, sends, executions, or settlements.',
      ['audit-evidence-export'],
      ['review-downstream-enforcement'],
    ),
    checklistItem(
      'review-supply-chain',
      'supply-chain',
      (
        evidencePresent(input.evidenceRefs, 'codeql') &&
        evidencePresent(input.evidenceRefs, 'dependency-review') &&
        evidencePresent(input.evidenceRefs, 'supply-chain-baseline')
      )
        ? 'ready'
        : 'needs-review',
      'Inspect repository security and supply-chain checks before relying on the evaluation packet.',
      ['codeql', 'dependency-review', 'supply-chain-baseline'],
      ['review-supply-chain'],
    ),
    checklistItem(
      'review-operator-context',
      'operations-readiness',
      input.dashboard === null ? 'not-supplied' : 'needs-review',
      'Use the dashboard only as operator context; it must not authorize consequences or infer business impact.',
      ['business-risk-dashboard'],
      ['review-operator-context'],
    ),
  ]);
}

function packetIdFor(input: {
  readonly generatedAt: string;
  readonly auditEvidenceDigest: string;
  readonly dashboardDigest: string | null;
  readonly runtimeDigest: string | null;
  readonly evidenceDigests: readonly string[];
}): string {
  return `external-review-packet:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function controlPostureFor(
  checklist: readonly ConsequenceExternalReviewChecklistItem[],
  findings: readonly ConsequenceExternalReviewFinding[],
): ConsequenceExternalReviewControlPosture {
  const blockerCount = findings.filter((finding) => finding.severity === 'blocker').length +
    checklist.filter((item) => item.status === 'blocked').length;
  return Object.freeze({
    reviewReady: blockerCount === 0,
    approvalRequired: true,
    securityAuditClaimed: false,
    complianceClaimed: false,
    productionReady: false,
    rawPayloadStored: false,
    autoEnforce: false,
    blockerCount,
    findingCount: findings.length,
  });
}

export function createConsequenceExternalReviewPacket(
  input: CreateConsequenceExternalReviewPacketInput,
): ConsequenceExternalReviewPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt ?? new Date().toISOString(),
    'generatedAt',
  );
  const dashboard = input.businessRiskDashboard ?? null;
  if (dashboard !== null && dashboard.sourceAuditExportDigest !== input.auditEvidence.digest) {
    throw new Error(
      'Consequence external review packet businessRiskDashboard must be bound to the auditEvidence digest.',
    );
  }
  const runtimeEvidence = normalizeRuntimeEvidence(input.runtimeEvidence);
  const evidenceRefs = normalizeEvidenceRefs(
    input.auditEvidence,
    dashboard,
    input.repositoryEvidence,
  );
  const checklist = checklistFor({
    auditEvidence: input.auditEvidence,
    dashboard,
    runtimeEvidence,
    evidenceRefs,
  });
  const findings = findingsFor({
    auditEvidence: input.auditEvidence,
    dashboard,
    runtimeEvidence,
    evidenceRefs,
  });
  const dashboardDigest = dashboard?.digest ?? null;
  const payload = {
    version: CONSEQUENCE_EXTERNAL_REVIEW_PACKET_VERSION,
    packetId: normalizeOptionalIdentifier(input.packetId, 'packetId') ??
      packetIdFor({
        generatedAt,
        auditEvidenceDigest: input.auditEvidence.digest,
        dashboardDigest,
        runtimeDigest: runtimeEvidence?.digest ?? null,
        evidenceDigests: evidenceRefs.map((ref) => ref.digest).filter((digest): digest is string =>
          digest !== null
        ),
      }),
    generatedAt,
    reviewerScope: normalizeOptionalIdentifier(input.reviewerScope, 'reviewerScope') ??
      'external-review',
    tenantId: input.auditEvidence.scope.tenantId,
    environment: input.auditEvidence.scope.environment,
    periodStart: input.auditEvidence.period.start,
    periodEnd: input.auditEvidence.period.end,
    domains: input.auditEvidence.scope.domains,
    auditEvidenceExportId: input.auditEvidence.exportId,
    auditEvidenceDigest: input.auditEvidence.digest,
    businessRiskDashboardDigest: dashboardDigest,
    runtimeEvidence,
    evidenceRefs,
    focusAreas: CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS,
    checklist,
    findings,
    controlPosture: controlPostureFor(checklist, findings),
    alignmentRefs: CONSEQUENCE_EXTERNAL_REVIEW_ALIGNMENT_REFS,
    nonClaims: CONSEQUENCE_EXTERNAL_REVIEW_NON_CLAIMS,
    reviewerInstructions: Object.freeze([
      'Verify the packet digest and source audit evidence digest before reviewing conclusions.',
      'Treat findings and checklist items as review prompts, not as compliance or production-readiness claims.',
      'Do not request or attach raw customer payloads unless a separate approved secure review process exists.',
      'Confirm customer-side enforcement and production storage independently before relying on any high-risk flow.',
    ]),
    rawPayloadStored: false,
    securityAuditClaimed: false,
    complianceClaimed: false,
    productionReady: false,
    autoEnforce: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceExternalReviewPacketDescriptor():
ConsequenceExternalReviewPacketDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_EXTERNAL_REVIEW_PACKET_VERSION,
    dataMinimizationPolicyVersion: CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    focusAreas: CONSEQUENCE_EXTERNAL_REVIEW_FOCUS_AREAS,
    evidenceKinds: CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_KINDS,
    evidenceStatuses: CONSEQUENCE_EXTERNAL_REVIEW_EVIDENCE_STATUSES,
    findingKinds: CONSEQUENCE_EXTERNAL_REVIEW_FINDING_KINDS,
    alignmentRefs: CONSEQUENCE_EXTERNAL_REVIEW_ALIGNMENT_REFS,
    nonClaims: CONSEQUENCE_EXTERNAL_REVIEW_NON_CLAIMS,
    rawPayloadStored: false,
    securityAuditClaimed: false,
    complianceClaimed: false,
    productionReady: false,
    autoEnforce: false,
  });
}
