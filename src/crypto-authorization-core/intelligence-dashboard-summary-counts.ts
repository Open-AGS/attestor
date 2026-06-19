import type {
  CryptoIntelligenceSignalDisposition,
  CryptoIntelligenceSignalSeverity,
} from './intelligence-risk-signals.js';
import type {
  CryptoIntelligenceDashboardFailureReasonRow,
  CryptoIntelligenceDashboardMissingEvidenceRow,
  CryptoIntelligenceDashboardSourceKind,
  CryptoIntelligenceDashboardSurfaceRow,
} from './intelligence-dashboard-summary-types.js';
import {
  DISPOSITION_RANK,
  MAP_KEY_SEPARATOR,
  MAX_TOP_ROWS,
  SEVERITY_RANK,
  normalizeCompactRef,
  normalizeDigest,
  normalizeReasonCode,
  strongerDisposition,
  strongerSeverity,
  uniqueSorted,
} from './intelligence-dashboard-summary-utils.js';

export type CountedSource = {
  count: number;
  criticalCount: number;
  blockCount: number;
  missingEvidenceClasses: Set<string>;
  sourceDigests: Set<string>;
};

export type CountedReason = {
  sourceKind: CryptoIntelligenceDashboardSourceKind;
  count: number;
  severity: CryptoIntelligenceSignalSeverity;
  disposition: CryptoIntelligenceSignalDisposition;
  missingEvidenceClasses: Set<string>;
  sourceDigests: Set<string>;
};

export type CountedEvidence = {
  count: number;
  sourceKinds: Set<CryptoIntelligenceDashboardSourceKind>;
  sourceDigests: Set<string>;
};

export function addSurface(
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

export function addReason(
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

export function addEvidence(
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

export function surfaceRows(
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

export function failureReasonRows(
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

export function missingEvidenceRows(
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
