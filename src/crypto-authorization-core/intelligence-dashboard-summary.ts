import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  assertCryptoIntelligencePrivacyMinimized,
} from './intelligence-privacy-minimization.js';
import type {
  CryptoIntelligenceRiskSignalAssessment,
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import type {
  CryptoNarrowingCandidateKind,
  CryptoPolicyGapClass,
  CryptoPolicyGapNarrowingAssessment,
} from './policy-gap-narrowing.js';
import type {
  CryptoOperatorRiskInputBundle,
  CryptoOperatorRiskInputClass,
  CryptoOperatorRiskMissingEvidenceClass,
} from './operator-risk-input-contract.js';
import type {
  CryptoExecutionAdapterKind,
} from './types.js';

/**
 * Operator-facing crypto intelligence dashboard summary.
 *
 * This is a data-minimized aggregation contract, not a raw payload drilldown
 * and not a compliance or financial-impact surface.
 */

export const CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION =
  'attestor.crypto-intelligence-dashboard-summary.v1';

export const CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES = [
  'ready-for-review',
  'attention-needed',
  'blocked-for-review',
] as const;
export type CryptoIntelligenceDashboardPosture =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS = [
  'risk-posture',
  'adapter-readiness',
  'missing-evidence',
  'policy-gaps',
  'operator-risk-inputs',
  'proof-links',
  'privacy-posture',
] as const;
export type CryptoIntelligenceDashboardWidget =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS = [
  'signals',
  'critical-signals',
  'review-signals',
  'block-signals',
  'policy-gaps',
  'readiness-coverage',
  'operator-risk-inputs',
  'proof-links',
] as const;
export type CryptoIntelligenceDashboardTileKind =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS = [
  'risk-signal-blocker',
  'policy-gap-blocker',
  'adapter-readiness-gap',
  'operator-risk-input-gap',
  'missing-evidence',
  'risk-signal-assessment-missing',
] as const;
export type CryptoIntelligenceDashboardAttentionKind =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS = [
  'risk-signal-assessment',
  'policy-gap-narrowing',
  'operator-risk-input',
  'adapter-readiness-manifest',
  'negative-conformance-fixtures',
  'privacy-minimization',
] as const;
export type CryptoIntelligenceDashboardProofLinkKind =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS[number];

export const CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES = [
  'ready',
  'needs-evidence',
  'blocked',
  'not-observed',
] as const;
export type CryptoIntelligenceDashboardReadinessStatus =
  typeof CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES[number];

export type CryptoIntelligenceDashboardSourceKind =
  | 'risk-signal'
  | 'policy-gap'
  | 'operator-risk-input'
  | 'adapter-readiness'
  | 'dashboard';

export interface CryptoIntelligenceDashboardReadinessInput {
  readonly surface: string;
  readonly adapterKind?: CryptoExecutionAdapterKind | null;
  readonly status: CryptoIntelligenceDashboardReadinessStatus;
  readonly sourceDigest?: string | null;
  readonly reasonCodes?: readonly string[] | null;
  readonly missingEvidenceClasses?: readonly string[] | null;
}

export interface CreateCryptoIntelligenceDashboardProofLinkInput {
  readonly kind: CryptoIntelligenceDashboardProofLinkKind;
  readonly label: string;
  readonly digest: string;
  readonly route?: string | null;
}

export interface CreateCryptoIntelligenceDashboardSummaryInput {
  readonly generatedAt: string;
  readonly summaryId?: string | null;
  readonly scopeRef: string;
  readonly signalAssessments?: readonly CryptoIntelligenceRiskSignalAssessment[] | null;
  readonly policyGapAssessments?: readonly CryptoPolicyGapNarrowingAssessment[] | null;
  readonly operatorRiskInputBundles?: readonly CryptoOperatorRiskInputBundle[] | null;
  readonly readiness?: readonly CryptoIntelligenceDashboardReadinessInput[] | null;
  readonly proofLinks?: readonly CreateCryptoIntelligenceDashboardProofLinkInput[] | null;
  readonly routeBase?: string | null;
}

export interface CryptoIntelligenceDashboardTile {
  readonly kind: CryptoIntelligenceDashboardTileKind;
  readonly label: string;
  readonly value: number;
  readonly status: CryptoIntelligenceDashboardPosture;
}

export interface CryptoIntelligenceDashboardSurfaceRow {
  readonly surface: string;
  readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
  readonly count: number;
  readonly criticalCount: number;
  readonly blockCount: number;
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardFailureReasonRow {
  readonly reasonCode: string;
  readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
  readonly count: number;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardMissingEvidenceRow {
  readonly evidenceClass: string;
  readonly count: number;
  readonly sourceKinds: readonly CryptoIntelligenceDashboardSourceKind[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardReadinessEntry {
  readonly surface: string;
  readonly adapterKind: CryptoExecutionAdapterKind | null;
  readonly status: CryptoIntelligenceDashboardReadinessStatus;
  readonly sourceDigest: string | null;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly string[];
}

export interface CryptoIntelligenceDashboardReadinessCoverage {
  readonly totalEntries: number;
  readonly readyCount: number;
  readonly needsEvidenceCount: number;
  readonly blockedCount: number;
  readonly notObservedCount: number;
  readonly readyCoveragePercent: number;
  readonly entries: readonly CryptoIntelligenceDashboardReadinessEntry[];
}

export interface CryptoIntelligenceDashboardAttentionItem {
  readonly kind: CryptoIntelligenceDashboardAttentionKind;
  readonly severity: CryptoIntelligenceSignalSeverity;
  readonly disposition: CryptoIntelligenceSignalDisposition;
  readonly count: number;
  readonly title: string;
  readonly nextStep: string;
  readonly reasonCodes: readonly string[];
  readonly missingEvidenceClasses: readonly string[];
  readonly sourceDigests: readonly string[];
}

export interface CryptoIntelligenceDashboardProofLink {
  readonly kind: CryptoIntelligenceDashboardProofLinkKind;
  readonly label: string;
  readonly digest: string;
  readonly route: string | null;
}

export interface CryptoIntelligenceDashboardOverview {
  readonly signalAssessmentCount: number;
  readonly riskSignalCount: number;
  readonly criticalSignalCount: number;
  readonly reviewSignalCount: number;
  readonly blockSignalCount: number;
  readonly policyGapAssessmentCount: number;
  readonly policyGapCount: number;
  readonly blockedPolicyGapCount: number;
  readonly narrowingCandidateCount: number;
  readonly operatorRiskInputBundleCount: number;
  readonly operatorRiskInputCount: number;
  readonly acceptedOperatorRiskInputCount: number;
  readonly staleOperatorRiskInputCount: number;
  readonly rejectedOperatorRiskInputCount: number;
  readonly readinessEntryCount: number;
  readonly readyReadinessCount: number;
  readonly blockedReadinessCount: number;
  readonly proofLinkCount: number;
}

export interface CryptoIntelligenceDashboardSummary {
  readonly version: typeof CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION;
  readonly summaryId: string;
  readonly generatedAt: string;
  readonly scopeRef: string;
  readonly posture: CryptoIntelligenceDashboardPosture;
  readonly headline: string;
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly tiles: readonly CryptoIntelligenceDashboardTile[];
  readonly topSurfaces: readonly CryptoIntelligenceDashboardSurfaceRow[];
  readonly topFailureReasons: readonly CryptoIntelligenceDashboardFailureReasonRow[];
  readonly missingEvidenceClasses: readonly CryptoIntelligenceDashboardMissingEvidenceRow[];
  readonly readinessCoverage: CryptoIntelligenceDashboardReadinessCoverage;
  readonly attentionItems: readonly CryptoIntelligenceDashboardAttentionItem[];
  readonly proofLinks: readonly CryptoIntelligenceDashboardProofLink[];
  readonly widgets: typeof CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly financialImpactClaimed: false;
  readonly rawPayloadStored: false;
  readonly rawPayloadDrilldownEnabled: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CryptoIntelligenceDashboardSummaryDescriptor {
  readonly version: typeof CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION;
  readonly postures: typeof CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES;
  readonly widgets: typeof CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS;
  readonly tileKinds: typeof CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS;
  readonly attentionKinds: typeof CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS;
  readonly proofLinkKinds: typeof CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS;
  readonly readinessStatuses: typeof CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES;
  readonly proofLinksAreDigestFirst: true;
  readonly decisionSupportOnly: true;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly complianceClaimed: false;
  readonly financialImpactClaimed: false;
  readonly rawPayloadStored: false;
  readonly rawPayloadDrilldownEnabled: false;
  readonly rawProviderResponseStored: false;
  readonly customerIdentifiersStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly solverRouteSecretsStored: false;
}

type CountedSource = {
  count: number;
  criticalCount: number;
  blockCount: number;
  missingEvidenceClasses: Set<string>;
  sourceDigests: Set<string>;
};

type CountedReason = {
  sourceKind: CryptoIntelligenceDashboardSourceKind;
  count: number;
  severity: CryptoIntelligenceSignalSeverity;
  disposition: CryptoIntelligenceSignalDisposition;
  missingEvidenceClasses: Set<string>;
  sourceDigests: Set<string>;
};

type CountedEvidence = {
  count: number;
  sourceKinds: Set<CryptoIntelligenceDashboardSourceKind>;
  sourceDigests: Set<string>;
};

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const MAP_KEY_SEPARATOR = '\u0000';
const MAX_LABEL_LENGTH = 120;
const MAX_TOP_ROWS = 8;

const SEVERITY_RANK: Record<CryptoIntelligenceSignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const DISPOSITION_RANK: Record<CryptoIntelligenceSignalDisposition, number> = {
  admit: 0,
  review: 1,
  block: 2,
};

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

function includesValue<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeCompactRef(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} requires a non-empty value.`);
  }
  if (/\s/u.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be a compact reference.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not contain control characters.`);
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeCompactRef(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be a sha256 digest.`);
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

function normalizeLabel(value: string | null | undefined, fieldName: string): string {
  const normalized = value?.trim().replaceAll(/\s+/gu, ' ') ?? '';
  if (normalized.length === 0) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} requires a non-empty label.`);
  }
  if (normalized.length > MAX_LABEL_LENGTH) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} is too long.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not contain control characters.`);
  }
  return normalized;
}

function normalizeProofRoute(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeCompactRef(value, fieldName).replaceAll(/\/+$/gu, '');
  if (!normalized.startsWith('/')) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must be a local route path.`);
  }
  if (normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not include query or fragment material.`);
  }
  if (/(?:raw|payload|secret|customer|provider-response|wallet-metadata)/iu.test(normalized)) {
    throw new Error(`Crypto intelligence dashboard summary ${fieldName} must not expose raw-data drilldown routes.`);
  }
  return normalized === '' ? '/' : normalized;
}

function normalizeReasonCode(value: string): string {
  return normalizeCompactRef(value, 'reasonCode');
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function strongerSeverity(
  left: CryptoIntelligenceSignalSeverity,
  right: CryptoIntelligenceSignalSeverity,
): CryptoIntelligenceSignalSeverity {
  return SEVERITY_RANK[right] > SEVERITY_RANK[left] ? right : left;
}

function strongerDisposition(
  left: CryptoIntelligenceSignalDisposition,
  right: CryptoIntelligenceSignalDisposition,
): CryptoIntelligenceSignalDisposition {
  return DISPOSITION_RANK[right] > DISPOSITION_RANK[left] ? right : left;
}

function addSurface(
  surfaces: Map<string, CountedSource>,
  input: {
    readonly surface: string;
    readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
    readonly severity?: CryptoIntelligenceSignalSeverity;
    readonly disposition?: CryptoIntelligenceSignalDisposition;
    readonly missingEvidenceClasses?: readonly string[];
    readonly sourceDigest?: string | null;
  },
): void {
  const surface = normalizeCompactRef(input.surface, 'surface');
  const key = `${input.sourceKind}${MAP_KEY_SEPARATOR}${surface}`;
  const current = surfaces.get(key) ?? {
    count: 0,
    criticalCount: 0,
    blockCount: 0,
    missingEvidenceClasses: new Set<string>(),
    sourceDigests: new Set<string>(),
  };

  current.count += 1;
  if (input.severity === 'critical') current.criticalCount += 1;
  if (input.disposition === 'block') current.blockCount += 1;
  for (const evidenceClass of input.missingEvidenceClasses ?? []) {
    current.missingEvidenceClasses.add(normalizeCompactRef(evidenceClass, 'missingEvidenceClass'));
  }
  if (input.sourceDigest) current.sourceDigests.add(normalizeDigest(input.sourceDigest, 'sourceDigest'));
  surfaces.set(key, current);
}

function addReason(
  reasons: Map<string, CountedReason>,
  input: {
    readonly reasonCode: string;
    readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
    readonly severity?: CryptoIntelligenceSignalSeverity;
    readonly disposition?: CryptoIntelligenceSignalDisposition;
    readonly missingEvidenceClasses?: readonly string[];
    readonly sourceDigest?: string | null;
  },
): void {
  const reasonCode = normalizeReasonCode(input.reasonCode);
  const key = `${input.sourceKind}${MAP_KEY_SEPARATOR}${reasonCode}`;
  const current = reasons.get(key) ?? {
    sourceKind: input.sourceKind,
    count: 0,
    severity: 'info' as CryptoIntelligenceSignalSeverity,
    disposition: 'admit' as CryptoIntelligenceSignalDisposition,
    missingEvidenceClasses: new Set<string>(),
    sourceDigests: new Set<string>(),
  };

  current.count += 1;
  current.severity = strongerSeverity(current.severity, input.severity ?? 'info');
  current.disposition = strongerDisposition(current.disposition, input.disposition ?? 'admit');
  for (const evidenceClass of input.missingEvidenceClasses ?? []) {
    current.missingEvidenceClasses.add(normalizeCompactRef(evidenceClass, 'missingEvidenceClass'));
  }
  if (input.sourceDigest) current.sourceDigests.add(normalizeDigest(input.sourceDigest, 'sourceDigest'));
  reasons.set(key, current);
}

function addEvidence(
  evidence: Map<string, CountedEvidence>,
  input: {
    readonly evidenceClass: string;
    readonly sourceKind: CryptoIntelligenceDashboardSourceKind;
    readonly sourceDigest?: string | null;
  },
): void {
  const evidenceClass = normalizeCompactRef(input.evidenceClass, 'evidenceClass');
  const current = evidence.get(evidenceClass) ?? {
    count: 0,
    sourceKinds: new Set<CryptoIntelligenceDashboardSourceKind>(),
    sourceDigests: new Set<string>(),
  };

  current.count += 1;
  current.sourceKinds.add(input.sourceKind);
  if (input.sourceDigest) current.sourceDigests.add(normalizeDigest(input.sourceDigest, 'sourceDigest'));
  evidence.set(evidenceClass, current);
}

function normalizeReadinessEntry(
  entry: CryptoIntelligenceDashboardReadinessInput,
): CryptoIntelligenceDashboardReadinessEntry {
  if (!includesValue(CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES, entry.status)) {
    throw new Error(`Crypto intelligence dashboard summary readiness status is unsupported: ${entry.status}.`);
  }
  return Object.freeze({
    surface: normalizeCompactRef(entry.surface, 'readiness.surface'),
    adapterKind: entry.adapterKind ?? null,
    status: entry.status,
    sourceDigest: normalizeOptionalDigest(entry.sourceDigest, 'readiness.sourceDigest'),
    reasonCodes: uniqueSorted((entry.reasonCodes ?? []).map(normalizeReasonCode)),
    missingEvidenceClasses: uniqueSorted(
      (entry.missingEvidenceClasses ?? []).map((evidenceClass) =>
        normalizeCompactRef(evidenceClass, 'readiness.missingEvidenceClass'),
      ),
    ),
  });
}

function normalizeProofLink(
  link: CreateCryptoIntelligenceDashboardProofLinkInput,
): CryptoIntelligenceDashboardProofLink {
  if (!includesValue(CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS, link.kind)) {
    throw new Error(`Crypto intelligence dashboard summary proof link kind is unsupported: ${link.kind}.`);
  }
  return Object.freeze({
    kind: link.kind,
    label: normalizeLabel(link.label, 'proofLink.label'),
    digest: normalizeDigest(link.digest, 'proofLink.digest'),
    route: normalizeProofRoute(link.route, 'proofLink.route'),
  });
}

function routeFor(routeBase: string | null, segment: string): string | null {
  return routeBase === null ? null : `${routeBase}/${segment}`;
}

function derivedProofLinks(input: {
  readonly routeBase: string | null;
  readonly signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[];
  readonly policyGapAssessments: readonly CryptoPolicyGapNarrowingAssessment[];
  readonly operatorRiskInputBundles: readonly CryptoOperatorRiskInputBundle[];
  readonly readinessEntries: readonly CryptoIntelligenceDashboardReadinessEntry[];
}): readonly CryptoIntelligenceDashboardProofLink[] {
  const links: CryptoIntelligenceDashboardProofLink[] = [];
  for (const assessment of input.signalAssessments) {
    links.push(
      normalizeProofLink({
        kind: 'risk-signal-assessment',
        label: `risk signals ${assessment.consequenceKind}`,
        digest: assessment.digest,
        route: routeFor(input.routeBase, 'risk-signals'),
      }),
    );
  }
  for (const assessment of input.policyGapAssessments) {
    links.push(
      normalizeProofLink({
        kind: 'policy-gap-narrowing',
        label: 'policy gap narrowing',
        digest: assessment.digest,
        route: routeFor(input.routeBase, 'policy-gaps'),
      }),
    );
  }
  for (const bundle of input.operatorRiskInputBundles) {
    links.push(
      normalizeProofLink({
        kind: 'operator-risk-input',
        label: 'operator risk input',
        digest: bundle.digest,
        route: routeFor(input.routeBase, 'operator-risk-inputs'),
      }),
    );
  }
  for (const entry of input.readinessEntries) {
    if (entry.sourceDigest === null) continue;
    links.push(
      normalizeProofLink({
        kind: 'adapter-readiness-manifest',
        label: `adapter readiness ${entry.surface}`,
        digest: entry.sourceDigest,
        route: routeFor(input.routeBase, 'adapter-readiness'),
      }),
    );
  }

  return Object.freeze(links);
}

function dedupeProofLinks(
  links: readonly CryptoIntelligenceDashboardProofLink[],
): readonly CryptoIntelligenceDashboardProofLink[] {
  const byKey = new Map<string, CryptoIntelligenceDashboardProofLink>();
  for (const link of links) {
    byKey.set(`${link.kind}:${link.digest}:${link.route ?? ''}:${link.label}`, link);
  }
  return Object.freeze(
    [...byKey.values()].sort((left, right) =>
      `${left.kind}:${left.label}:${left.digest}`.localeCompare(
        `${right.kind}:${right.label}:${right.digest}`,
      ),
    ),
  );
}

function surfaceRows(
  surfaces: Map<string, CountedSource>,
): readonly CryptoIntelligenceDashboardSurfaceRow[] {
  return Object.freeze(
    [...surfaces.entries()]
      .map(([key, value]) => {
        const [sourceKind, surface] = key.split(MAP_KEY_SEPARATOR, 2) as [
          CryptoIntelligenceDashboardSourceKind,
          string,
        ];
        return Object.freeze({
          surface,
          sourceKind,
          count: value.count,
          criticalCount: value.criticalCount,
          blockCount: value.blockCount,
          missingEvidenceClasses: uniqueSorted([...value.missingEvidenceClasses]),
          sourceDigests: uniqueSorted([...value.sourceDigests]),
        });
      })
      .sort((left, right) => {
        if (right.blockCount !== left.blockCount) return right.blockCount - left.blockCount;
        if (right.criticalCount !== left.criticalCount) return right.criticalCount - left.criticalCount;
        if (right.count !== left.count) return right.count - left.count;
        return `${left.sourceKind}:${left.surface}`.localeCompare(`${right.sourceKind}:${right.surface}`);
      })
      .slice(0, MAX_TOP_ROWS),
  );
}

function failureReasonRows(
  reasons: Map<string, CountedReason>,
): readonly CryptoIntelligenceDashboardFailureReasonRow[] {
  return Object.freeze(
    [...reasons.entries()]
      .map(([key, value]) => {
        const [, reasonCode] = key.split(MAP_KEY_SEPARATOR, 2);
        return Object.freeze({
          reasonCode,
          sourceKind: value.sourceKind,
          count: value.count,
          severity: value.severity,
          disposition: value.disposition,
          missingEvidenceClasses: uniqueSorted([...value.missingEvidenceClasses]),
          sourceDigests: uniqueSorted([...value.sourceDigests]),
        });
      })
      .sort((left, right) => {
        const dispositionDelta =
          DISPOSITION_RANK[right.disposition] - DISPOSITION_RANK[left.disposition];
        if (dispositionDelta !== 0) return dispositionDelta;
        const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
        if (severityDelta !== 0) return severityDelta;
        if (right.count !== left.count) return right.count - left.count;
        return `${left.sourceKind}:${left.reasonCode}`.localeCompare(`${right.sourceKind}:${right.reasonCode}`);
      })
      .slice(0, MAX_TOP_ROWS),
  );
}

function missingEvidenceRows(
  evidence: Map<string, CountedEvidence>,
): readonly CryptoIntelligenceDashboardMissingEvidenceRow[] {
  return Object.freeze(
    [...evidence.entries()]
      .map(([evidenceClass, value]) =>
        Object.freeze({
          evidenceClass,
          count: value.count,
          sourceKinds: Object.freeze([...value.sourceKinds].sort()),
          sourceDigests: uniqueSorted([...value.sourceDigests]),
        }),
      )
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.evidenceClass.localeCompare(right.evidenceClass);
      }),
  );
}

function readinessCoverage(
  entries: readonly CryptoIntelligenceDashboardReadinessEntry[],
): CryptoIntelligenceDashboardReadinessCoverage {
  const readyCount = entries.filter((entry) => entry.status === 'ready').length;
  const needsEvidenceCount = entries.filter((entry) => entry.status === 'needs-evidence').length;
  const blockedCount = entries.filter((entry) => entry.status === 'blocked').length;
  const notObservedCount = entries.filter((entry) => entry.status === 'not-observed').length;
  const readyCoveragePercent =
    entries.length === 0 ? 0 : Math.round((readyCount / entries.length) * 100);

  return Object.freeze({
    totalEntries: entries.length,
    readyCount,
    needsEvidenceCount,
    blockedCount,
    notObservedCount,
    readyCoveragePercent,
    entries: Object.freeze(
      [...entries].sort((left, right) =>
        `${left.status}:${left.surface}`.localeCompare(`${right.status}:${right.surface}`),
      ),
    ),
  });
}

function dashboardOverview(input: {
  readonly signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[];
  readonly policyGapAssessments: readonly CryptoPolicyGapNarrowingAssessment[];
  readonly operatorRiskInputBundles: readonly CryptoOperatorRiskInputBundle[];
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
  readonly proofLinks: readonly CryptoIntelligenceDashboardProofLink[];
}): CryptoIntelligenceDashboardOverview {
  return Object.freeze({
    signalAssessmentCount: input.signalAssessments.length,
    riskSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.signalCount, 0),
    criticalSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.criticalSignalCount, 0),
    reviewSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.reviewSignalCount, 0),
    blockSignalCount: input.signalAssessments.reduce((sum, entry) => sum + entry.blockSignalCount, 0),
    policyGapAssessmentCount: input.policyGapAssessments.length,
    policyGapCount: input.policyGapAssessments.reduce((sum, entry) => sum + entry.gapCount, 0),
    blockedPolicyGapCount: input.policyGapAssessments.reduce((sum, entry) => sum + entry.blockedGapCount, 0),
    narrowingCandidateCount: input.policyGapAssessments.reduce((sum, entry) => sum + entry.candidateCount, 0),
    operatorRiskInputBundleCount: input.operatorRiskInputBundles.length,
    operatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.inputCount, 0),
    acceptedOperatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.acceptedCount, 0),
    staleOperatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.staleCount, 0),
    rejectedOperatorRiskInputCount: input.operatorRiskInputBundles.reduce((sum, entry) => sum + entry.rejectedCount, 0),
    readinessEntryCount: input.readiness.totalEntries,
    readyReadinessCount: input.readiness.readyCount,
    blockedReadinessCount: input.readiness.blockedCount,
    proofLinkCount: input.proofLinks.length,
  });
}

function dashboardPosture(input: {
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
  readonly operatorRiskInputBundles: readonly CryptoOperatorRiskInputBundle[];
  readonly signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[];
}): CryptoIntelligenceDashboardPosture {
  if (
    input.overview.blockSignalCount > 0 ||
    input.overview.blockedPolicyGapCount > 0 ||
    input.readiness.blockedCount > 0 ||
    input.operatorRiskInputBundles.some((bundle) => bundle.recommendedDisposition === 'block')
  ) {
    return 'blocked-for-review';
  }
  if (
    input.signalAssessments.length === 0 ||
    input.overview.reviewSignalCount > 0 ||
    input.overview.policyGapCount > 0 ||
    input.readiness.needsEvidenceCount > 0 ||
    input.readiness.notObservedCount > 0 ||
    input.operatorRiskInputBundles.some((bundle) => bundle.recommendedDisposition !== 'admit')
  ) {
    return 'attention-needed';
  }
  return 'ready-for-review';
}

function headlineForPosture(posture: CryptoIntelligenceDashboardPosture): string {
  if (posture === 'blocked-for-review') {
    return 'Crypto intelligence found blockers that require operator review before downstream execution.';
  }
  if (posture === 'attention-needed') {
    return 'Crypto intelligence needs more evidence or review before this path is ready.';
  }
  return 'Crypto intelligence inputs are present and ready for operator review.';
}

function tileStatus(value: number, postureWhenNonZero: CryptoIntelligenceDashboardPosture):
CryptoIntelligenceDashboardPosture {
  return value > 0 ? postureWhenNonZero : 'ready-for-review';
}

function dashboardTiles(input: {
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
}): readonly CryptoIntelligenceDashboardTile[] {
  return Object.freeze([
    Object.freeze({
      kind: 'signals',
      label: 'risk signals',
      value: input.overview.riskSignalCount,
      status: input.overview.riskSignalCount === 0 ? 'attention-needed' : 'ready-for-review',
    }),
    Object.freeze({
      kind: 'critical-signals',
      label: 'critical signals',
      value: input.overview.criticalSignalCount,
      status: tileStatus(input.overview.criticalSignalCount, 'blocked-for-review'),
    }),
    Object.freeze({
      kind: 'review-signals',
      label: 'review signals',
      value: input.overview.reviewSignalCount,
      status: tileStatus(input.overview.reviewSignalCount, 'attention-needed'),
    }),
    Object.freeze({
      kind: 'block-signals',
      label: 'block signals',
      value: input.overview.blockSignalCount,
      status: tileStatus(input.overview.blockSignalCount, 'blocked-for-review'),
    }),
    Object.freeze({
      kind: 'policy-gaps',
      label: 'policy gaps',
      value: input.overview.policyGapCount,
      status: tileStatus(input.overview.policyGapCount, 'attention-needed'),
    }),
    Object.freeze({
      kind: 'readiness-coverage',
      label: 'readiness coverage',
      value: input.readiness.readyCoveragePercent,
      status: input.readiness.blockedCount > 0
        ? 'blocked-for-review'
        : tileStatus(input.readiness.needsEvidenceCount + input.readiness.notObservedCount, 'attention-needed'),
    }),
    Object.freeze({
      kind: 'operator-risk-inputs',
      label: 'operator risk inputs',
      value: input.overview.operatorRiskInputCount,
      status: tileStatus(
        input.overview.staleOperatorRiskInputCount + input.overview.rejectedOperatorRiskInputCount,
        'blocked-for-review',
      ),
    }),
    Object.freeze({
      kind: 'proof-links',
      label: 'proof links',
      value: input.overview.proofLinkCount,
      status: 'ready-for-review',
    }),
  ]);
}

function attentionItems(input: {
  readonly overview: CryptoIntelligenceDashboardOverview;
  readonly readiness: CryptoIntelligenceDashboardReadinessCoverage;
  readonly topFailureReasons: readonly CryptoIntelligenceDashboardFailureReasonRow[];
  readonly missingEvidence: readonly CryptoIntelligenceDashboardMissingEvidenceRow[];
}): readonly CryptoIntelligenceDashboardAttentionItem[] {
  const items: CryptoIntelligenceDashboardAttentionItem[] = [];

  if (input.overview.signalAssessmentCount === 0) {
    items.push({
      kind: 'risk-signal-assessment-missing',
      severity: 'warning',
      disposition: 'review',
      count: 1,
      title: 'Risk signal assessment is missing.',
      nextStep: 'Run crypto intelligence risk-signal assessment before relying on this dashboard.',
      reasonCodes: ['risk-signal-assessment-missing'],
      missingEvidenceClasses: [],
      sourceDigests: [],
    });
  }
  if (input.overview.blockSignalCount > 0) {
    items.push({
      kind: 'risk-signal-blocker',
      severity: 'critical',
      disposition: 'block',
      count: input.overview.blockSignalCount,
      title: 'Risk signals contain blockers.',
      nextStep: 'Resolve or route block-grade risk signals to operator review before downstream execution.',
      reasonCodes: input.topFailureReasons
        .filter((reason) => reason.sourceKind === 'risk-signal' && reason.disposition === 'block')
        .map((reason) => reason.reasonCode),
      missingEvidenceClasses: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'risk-signal')
          .flatMap((reason) => reason.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'risk-signal')
          .flatMap((reason) => reason.sourceDigests),
      ),
    });
  }
  if (input.overview.blockedPolicyGapCount > 0) {
    items.push({
      kind: 'policy-gap-blocker',
      severity: 'critical',
      disposition: 'block',
      count: input.overview.blockedPolicyGapCount,
      title: 'Policy gaps block admission.',
      nextStep: 'Bind missing policy dimensions or approval-required narrowing candidates.',
      reasonCodes: input.topFailureReasons
        .filter((reason) => reason.sourceKind === 'policy-gap')
        .map((reason) => reason.reasonCode),
      missingEvidenceClasses: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'policy-gap')
          .flatMap((reason) => reason.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.topFailureReasons
          .filter((reason) => reason.sourceKind === 'policy-gap')
          .flatMap((reason) => reason.sourceDigests),
      ),
    });
  }
  if (input.readiness.blockedCount + input.readiness.needsEvidenceCount + input.readiness.notObservedCount > 0) {
    items.push({
      kind: 'adapter-readiness-gap',
      severity: input.readiness.blockedCount > 0 ? 'critical' : 'warning',
      disposition: input.readiness.blockedCount > 0 ? 'block' : 'review',
      count: input.readiness.blockedCount + input.readiness.needsEvidenceCount + input.readiness.notObservedCount,
      title: 'Adapter readiness is incomplete.',
      nextStep: 'Run adapter readiness checks and attach digest-only evidence for incomplete surfaces.',
      reasonCodes: uniqueSorted(input.readiness.entries.flatMap((entry) => entry.reasonCodes)),
      missingEvidenceClasses: uniqueSorted(
        input.readiness.entries.flatMap((entry) => entry.missingEvidenceClasses),
      ),
      sourceDigests: uniqueSorted(
        input.readiness.entries.flatMap((entry) => entry.sourceDigest === null ? [] : [entry.sourceDigest]),
      ),
    });
  }
  if (input.missingEvidence.length > 0) {
    items.push({
      kind: 'missing-evidence',
      severity: 'warning',
      disposition: 'review',
      count: input.missingEvidence.reduce((sum, entry) => sum + entry.count, 0),
      title: 'Evidence classes are missing.',
      nextStep: 'Collect the named evidence classes by digest or scoped reference; do not attach raw payload material.',
      reasonCodes: [],
      missingEvidenceClasses: input.missingEvidence.map((entry) => entry.evidenceClass),
      sourceDigests: uniqueSorted(input.missingEvidence.flatMap((entry) => entry.sourceDigests)),
    });
  }

  return Object.freeze(items.slice(0, MAX_TOP_ROWS).map((item) => Object.freeze(item)));
}

function collectFromRiskSignals(
  signalAssessments: readonly CryptoIntelligenceRiskSignalAssessment[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const assessment of signalAssessments) {
    addSurface(surfaces, {
      surface: assessment.consequenceKind,
      sourceKind: 'risk-signal',
      severity: assessment.overallSeverity,
      disposition: assessment.recommendedDisposition,
      missingEvidenceClasses: assessment.missingEvidenceClasses,
      sourceDigest: assessment.digest,
    });
    for (const signal of assessment.signals) {
      addSurface(surfaces, {
        surface: signal.category,
        sourceKind: 'risk-signal',
        severity: signal.severity,
        disposition: signal.disposition,
        missingEvidenceClasses: signal.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
      if (signal.disposition !== 'admit' || signal.missingEvidenceClasses.length > 0) {
        addReason(reasons, {
          reasonCode: signal.code,
          sourceKind: 'risk-signal',
          severity: signal.severity,
          disposition: signal.disposition,
          missingEvidenceClasses: signal.missingEvidenceClasses,
          sourceDigest: assessment.digest,
        });
      }
      for (const evidenceClass of signal.missingEvidenceClasses) {
        addEvidence(evidence, {
          evidenceClass,
          sourceKind: 'risk-signal',
          sourceDigest: assessment.digest,
        });
      }
    }
  }
}

function collectFromPolicyGaps(
  assessments: readonly CryptoPolicyGapNarrowingAssessment[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const assessment of assessments) {
    for (const gap of assessment.gaps) {
      addSurface(surfaces, {
        surface: gap.gapClass satisfies CryptoPolicyGapClass,
        sourceKind: 'policy-gap',
        severity: gap.severity,
        disposition: gap.disposition,
        missingEvidenceClasses: gap.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
      addReason(reasons, {
        reasonCode: gap.gapClass,
        sourceKind: 'policy-gap',
        severity: gap.severity,
        disposition: gap.disposition,
        missingEvidenceClasses: gap.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
      for (const code of gap.sourceSignalCodes) {
        addReason(reasons, {
          reasonCode: code,
          sourceKind: 'policy-gap',
          severity: gap.severity,
          disposition: gap.disposition,
          missingEvidenceClasses: gap.missingEvidenceClasses,
          sourceDigest: assessment.digest,
        });
      }
      for (const evidenceClass of gap.missingEvidenceClasses) {
        addEvidence(evidence, {
          evidenceClass,
          sourceKind: 'policy-gap',
          sourceDigest: assessment.digest,
        });
      }
    }
    for (const candidate of assessment.candidates) {
      addSurface(surfaces, {
        surface: candidate.kind satisfies CryptoNarrowingCandidateKind,
        sourceKind: 'policy-gap',
        missingEvidenceClasses: candidate.missingEvidenceClasses,
        sourceDigest: assessment.digest,
      });
    }
  }
}

function collectFromOperatorRiskInputs(
  bundles: readonly CryptoOperatorRiskInputBundle[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const bundle of bundles) {
    for (const entry of bundle.entries) {
      addSurface(surfaces, {
        surface: entry.inputClass satisfies CryptoOperatorRiskInputClass,
        sourceKind: 'operator-risk-input',
        severity: entry.severity,
        disposition: entry.disposition,
        missingEvidenceClasses: entry.missingEvidenceClasses,
        sourceDigest: bundle.digest,
      });
      for (const reasonCode of entry.reasonCodes) {
        addReason(reasons, {
          reasonCode,
          sourceKind: 'operator-risk-input',
          severity: entry.severity,
          disposition: entry.disposition,
          missingEvidenceClasses: entry.missingEvidenceClasses,
          sourceDigest: bundle.digest,
        });
      }
      for (const evidenceClass of entry.missingEvidenceClasses) {
        addEvidence(evidence, {
          evidenceClass: evidenceClass satisfies CryptoOperatorRiskMissingEvidenceClass,
          sourceKind: 'operator-risk-input',
          sourceDigest: bundle.digest,
        });
      }
    }
    if (bundle.entries.length === 0) {
      for (const reasonCode of bundle.reasonCodes) {
        addReason(reasons, {
          reasonCode,
          sourceKind: 'operator-risk-input',
          severity: 'warning',
          disposition: bundle.recommendedDisposition,
          missingEvidenceClasses: bundle.missingEvidenceClasses,
          sourceDigest: bundle.digest,
        });
      }
    }
  }
}

function collectFromReadiness(
  entries: readonly CryptoIntelligenceDashboardReadinessEntry[],
  surfaces: Map<string, CountedSource>,
  reasons: Map<string, CountedReason>,
  evidence: Map<string, CountedEvidence>,
): void {
  for (const entry of entries) {
    const disposition: CryptoIntelligenceSignalDisposition =
      entry.status === 'blocked' ? 'block' : entry.status === 'ready' ? 'admit' : 'review';
    const severity: CryptoIntelligenceSignalSeverity =
      entry.status === 'blocked' ? 'critical' : entry.status === 'ready' ? 'info' : 'warning';

    addSurface(surfaces, {
      surface: entry.surface,
      sourceKind: 'adapter-readiness',
      severity,
      disposition,
      missingEvidenceClasses: entry.missingEvidenceClasses,
      sourceDigest: entry.sourceDigest,
    });
    if (entry.adapterKind !== null) {
      addSurface(surfaces, {
        surface: entry.adapterKind,
        sourceKind: 'adapter-readiness',
        severity,
        disposition,
        missingEvidenceClasses: entry.missingEvidenceClasses,
        sourceDigest: entry.sourceDigest,
      });
    }
    for (const reasonCode of entry.reasonCodes) {
      addReason(reasons, {
        reasonCode,
        sourceKind: 'adapter-readiness',
        severity,
        disposition,
        missingEvidenceClasses: entry.missingEvidenceClasses,
        sourceDigest: entry.sourceDigest,
      });
    }
    for (const evidenceClass of entry.missingEvidenceClasses) {
      addEvidence(evidence, {
        evidenceClass,
        sourceKind: 'adapter-readiness',
        sourceDigest: entry.sourceDigest,
      });
    }
  }
}

function payloadForSummary(input: Omit<CryptoIntelligenceDashboardSummary, 'canonical' | 'digest'>):
CanonicalReleaseJsonValue {
  return input as unknown as CanonicalReleaseJsonValue;
}

export function cryptoIntelligenceDashboardSummaryDescriptor():
CryptoIntelligenceDashboardSummaryDescriptor {
  return Object.freeze({
    version: CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
    postures: CRYPTO_INTELLIGENCE_DASHBOARD_POSTURES,
    widgets: CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
    tileKinds: CRYPTO_INTELLIGENCE_DASHBOARD_TILE_KINDS,
    attentionKinds: CRYPTO_INTELLIGENCE_DASHBOARD_ATTENTION_KINDS,
    proofLinkKinds: CRYPTO_INTELLIGENCE_DASHBOARD_PROOF_LINK_KINDS,
    readinessStatuses: CRYPTO_INTELLIGENCE_DASHBOARD_READINESS_STATUSES,
    proofLinksAreDigestFirst: true,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    financialImpactClaimed: false,
    rawPayloadStored: false,
    rawPayloadDrilldownEnabled: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  });
}

export function createCryptoIntelligenceDashboardSummary(
  input: CreateCryptoIntelligenceDashboardSummaryInput,
): CryptoIntelligenceDashboardSummary {
  const generatedAt = normalizeIsoTimestamp(input.generatedAt, 'generatedAt');
  const scopeRef = normalizeCompactRef(input.scopeRef, 'scopeRef');
  const summaryId = normalizeCompactRef(
    input.summaryId ?? `crypto-intelligence-dashboard:${scopeRef}`,
    'summaryId',
  );
  const signalAssessments = Object.freeze([...(input.signalAssessments ?? [])]);
  const policyGapAssessments = Object.freeze([...(input.policyGapAssessments ?? [])]);
  const operatorRiskInputBundles = Object.freeze([...(input.operatorRiskInputBundles ?? [])]);
  const readinessEntries = Object.freeze(
    (input.readiness ?? []).map((entry) => normalizeReadinessEntry(entry)),
  );
  const routeBase = normalizeProofRoute(input.routeBase, 'routeBase');
  const proofLinks = dedupeProofLinks([
    ...derivedProofLinks({
      routeBase,
      signalAssessments,
      policyGapAssessments,
      operatorRiskInputBundles,
      readinessEntries,
    }),
    ...(input.proofLinks ?? []).map((link) => normalizeProofLink(link)),
  ]);

  const surfaces = new Map<string, CountedSource>();
  const reasons = new Map<string, CountedReason>();
  const evidence = new Map<string, CountedEvidence>();

  collectFromRiskSignals(signalAssessments, surfaces, reasons, evidence);
  collectFromPolicyGaps(policyGapAssessments, surfaces, reasons, evidence);
  collectFromOperatorRiskInputs(operatorRiskInputBundles, surfaces, reasons, evidence);
  collectFromReadiness(readinessEntries, surfaces, reasons, evidence);

  if (signalAssessments.length === 0) {
    addReason(reasons, {
      reasonCode: 'risk-signal-assessment-missing',
      sourceKind: 'dashboard',
      severity: 'warning',
      disposition: 'review',
    });
  }

  const readiness = readinessCoverage(readinessEntries);
  const topSurfaces = surfaceRows(surfaces);
  const topFailureReasons = failureReasonRows(reasons);
  const missingEvidenceClasses = missingEvidenceRows(evidence);
  const overview = dashboardOverview({
    signalAssessments,
    policyGapAssessments,
    operatorRiskInputBundles,
    readiness,
    proofLinks,
  });
  const posture = dashboardPosture({
    overview,
    readiness,
    operatorRiskInputBundles,
    signalAssessments,
  });
  const payload = Object.freeze({
    version: CRYPTO_INTELLIGENCE_DASHBOARD_SUMMARY_SPEC_VERSION,
    summaryId,
    generatedAt,
    scopeRef,
    posture,
    headline: headlineForPosture(posture),
    overview,
    tiles: dashboardTiles({ overview, readiness }),
    topSurfaces,
    topFailureReasons,
    missingEvidenceClasses,
    readinessCoverage: readiness,
    attentionItems: attentionItems({
      overview,
      readiness,
      topFailureReasons,
      missingEvidence: missingEvidenceClasses,
    }),
    proofLinks,
    widgets: CRYPTO_INTELLIGENCE_DASHBOARD_WIDGETS,
    decisionSupportOnly: true,
    autoEnforce: false,
    productionReady: false,
    complianceClaimed: false,
    financialImpactClaimed: false,
    rawPayloadStored: false,
    rawPayloadDrilldownEnabled: false,
    rawProviderResponseStored: false,
    customerIdentifiersStored: false,
    privatePolicyThresholdsStored: false,
    solverRouteSecretsStored: false,
  } satisfies Omit<CryptoIntelligenceDashboardSummary, 'canonical' | 'digest'>);

  assertCryptoIntelligencePrivacyMinimized({
    surfaceKind: 'intelligence-dashboard-summary',
    artifact: payload,
  });
  const canonical = canonicalObject(payloadForSummary(payload));

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function cryptoIntelligenceDashboardSummaryLabel(
  summary: CryptoIntelligenceDashboardSummary,
): string {
  return [
    'crypto-intelligence-dashboard',
    `posture:${summary.posture}`,
    `signals:${summary.overview.riskSignalCount}`,
    `gaps:${summary.overview.policyGapCount}`,
    `readiness:${summary.readinessCoverage.readyCoveragePercent}`,
  ].join(' / ');
}
