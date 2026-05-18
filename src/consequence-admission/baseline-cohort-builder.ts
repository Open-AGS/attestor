import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  BASELINE_COHORT_CONTRACT_VERSION,
  type BaselineCohortCandidate,
} from './baseline-cohort-contract.js';
import {
  LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION,
  type LearnedArtifactReleaseBudgetRecord,
} from './learned-artifact-release-budget.js';
import {
  SHADOW_DATA_QUALITY_GATE_VERSION,
  type ShadowDataQualityGateRecord,
} from './shadow-data-quality-gate.js';

export const BASELINE_COHORT_BUILDER_VERSION =
  'attestor.baseline-cohort-builder.v1';

export const BASELINE_COHORT_BUILDER_SOURCE_ANCHORS = [
  'tensorflow-data-validation-anomaly-gate',
  'tfx-mlmd-artifact-execution-lineage',
  'google-data-cards-dataset-documentation',
  'datasheets-for-datasets',
  'dvc-data-versioning-metafiles',
  'lakefs-content-addressed-commits',
  'openlineage-run-job-dataset-facets',
  'assurance-case-evidence-node',
] as const;
export type BaselineCohortBuilderSourceAnchor =
  typeof BASELINE_COHORT_BUILDER_SOURCE_ANCHORS[number];

export const BASELINE_COHORT_BUILDER_OUTCOMES = [
  'cohort-evidence-ready-for-candidate-claim',
  'cohort-held-for-quality-defeaters',
  'cohort-held-for-budget',
  'cohort-held-for-assurance-case',
  'cohort-held-for-source-floor',
  'cohort-held-for-safety-label',
] as const;
export type BaselineCohortBuilderOutcome =
  typeof BASELINE_COHORT_BUILDER_OUTCOMES[number];

export const BASELINE_COHORT_BUILDER_DANGER_FLAGS = [
  'quality-gate-missing',
  'quality-defeater-present',
  'budget-not-ready',
  'assurance-case-unbound',
  'source-count-below-floor',
  'unsafe-baseline-cohort',
  'duplicate-quality-gate',
  'tenant-mismatch',
  'cohort-ref-mismatch',
  'artifact-ref-mismatch',
  'raw-material-present',
] as const;
export type BaselineCohortBuilderDangerFlag =
  typeof BASELINE_COHORT_BUILDER_DANGER_FLAGS[number];

export interface CreateBaselineCohortEvidenceInput {
  readonly candidate: BaselineCohortCandidate;
  readonly qualityGates: readonly ShadowDataQualityGateRecord[];
  readonly releaseBudget: LearnedArtifactReleaseBudgetRecord;
  readonly assuranceCaseRefDigest?: string | null;
  readonly createdByRefDigest: string;
  readonly createdAt: string;
  readonly evidenceNodeId?: string | null;
}

export interface BaselineCohortBuilderRecord {
  readonly version: typeof BASELINE_COHORT_BUILDER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly baselineCohortContractVersion: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly shadowDataQualityGateVersion: typeof SHADOW_DATA_QUALITY_GATE_VERSION;
  readonly learnedArtifactReleaseBudgetVersion:
    typeof LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION;
  readonly cohortId: string;
  readonly cohortRefDigest: string;
  readonly candidateDigest: string;
  readonly tenantRefDigest: string;
  readonly sourceEventCount: number;
  readonly sourceEventDigests: readonly string[];
  readonly qualityGateCount: number;
  readonly qualityReadyCount: number;
  readonly qualityHeldCount: number;
  readonly releaseBudgetDigest: string;
  readonly releaseBudgetOutcome: LearnedArtifactReleaseBudgetRecord['outcome'];
  readonly assuranceCaseRefDigest: string | null;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly evidenceBodyDigest: string;
  readonly includedSourceEventDigests: readonly string[];
  readonly excludedSourceEventDigests: readonly string[];
  readonly dangerFlags: readonly BaselineCohortBuilderDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly outcome: BaselineCohortBuilderOutcome;
  readonly readyForCandidateClaim: boolean;
  readonly underminingDefeaterRequired: boolean;
  readonly failClosed: boolean;
  readonly assuranceEvidenceOnly: true;
  readonly digestOnlyEvidence: true;
  readonly noRawMaterial: true;
  readonly noTraining: true;
  readonly noLearning: true;
  readonly noCrossTenantAggregation: true;
  readonly noAutoPromotion: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface BaselineCohortBuilderDescriptor {
  readonly version: typeof BASELINE_COHORT_BUILDER_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly baselineCohortContractVersion: typeof BASELINE_COHORT_CONTRACT_VERSION;
  readonly shadowDataQualityGateVersion: typeof SHADOW_DATA_QUALITY_GATE_VERSION;
  readonly learnedArtifactReleaseBudgetVersion:
    typeof LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION;
  readonly sourceAnchors: readonly BaselineCohortBuilderSourceAnchor[];
  readonly outcomes: readonly BaselineCohortBuilderOutcome[];
  readonly dangerFlags: readonly BaselineCohortBuilderDangerFlag[];
  readonly createsAssuranceEvidenceNode: true;
  readonly requiresQualityGateForEverySourceEvent: true;
  readonly requiresReleaseBudget: true;
  readonly assuranceCaseContextRequired: true;
  readonly digestOnlyEvidence: true;
  readonly noRawMaterial: true;
  readonly noTraining: true;
  readonly noLearning: true;
  readonly noCrossTenantAggregation: true;
  readonly noAutoPromotion: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`Baseline cohort builder ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Baseline cohort builder ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Baseline cohort builder ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Baseline cohort builder ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function reasonDigest(reasonCodes: readonly string[]): string {
  return canonicalObject({
    kind: 'baseline-cohort-builder-reasons',
    reasonCodes,
  }).digest;
}

function assertNoRawMaterial(candidate: BaselineCohortCandidate): void {
  if (
    candidate.rawPayloadStored !== false ||
    candidate.rawPromptStored !== false ||
    candidate.rawProviderBodyStored !== false ||
    candidate.sourceEvents.some((event) =>
      event.rawPayloadStored !== false ||
      event.rawPromptStored !== false ||
      event.rawProviderBodyStored !== false)
  ) {
    throw new Error('Baseline cohort builder candidate must not contain raw material.');
  }
}

function qualityGateMapFor(
  candidate: BaselineCohortCandidate,
  qualityGates: readonly ShadowDataQualityGateRecord[],
): ReadonlyMap<string, ShadowDataQualityGateRecord> {
  const byDigest = new Map<string, ShadowDataQualityGateRecord>();
  const candidateDigests = new Set(candidate.sourceEventDigests);
  for (const gate of qualityGates) {
    if (gate.version !== SHADOW_DATA_QUALITY_GATE_VERSION) {
      throw new Error('Baseline cohort builder quality gate version mismatch.');
    }
    if (gate.tenantRefDigest !== candidate.tenantRefDigest) {
      throw new Error('Baseline cohort builder tenant mismatch in quality gate.');
    }
    if (!candidateDigests.has(gate.sourceEventDigest)) {
      throw new Error('Baseline cohort builder quality gate references a non-cohort source event.');
    }
    if (byDigest.has(gate.sourceEventDigest)) {
      throw new Error('Baseline cohort builder duplicate quality gate for source event.');
    }
    byDigest.set(gate.sourceEventDigest, gate);
  }
  return byDigest;
}

function assertReleaseBudgetMatches(
  candidate: BaselineCohortCandidate,
  releaseBudget: LearnedArtifactReleaseBudgetRecord,
): void {
  if (releaseBudget.version !== LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION) {
    throw new Error('Baseline cohort builder release budget version mismatch.');
  }
  if (releaseBudget.artifactKind !== 'baseline-cohort-summary') {
    throw new Error('Baseline cohort builder requires a baseline-cohort-summary budget.');
  }
  if (releaseBudget.tenantRefDigest !== candidate.tenantRefDigest) {
    throw new Error('Baseline cohort builder tenant mismatch in release budget.');
  }
  if (releaseBudget.cohortRefDigest !== candidate.cohortRefDigest) {
    throw new Error('Baseline cohort builder cohort ref mismatch in release budget.');
  }
  if (releaseBudget.artifactRefDigest !== candidate.digest) {
    throw new Error('Baseline cohort builder artifact ref mismatch in release budget.');
  }
}

function flagsFor(input: {
  readonly candidate: BaselineCohortCandidate;
  readonly qualityGatesByDigest: ReadonlyMap<string, ShadowDataQualityGateRecord>;
  readonly releaseBudget: LearnedArtifactReleaseBudgetRecord;
  readonly assuranceCaseRefDigest: string | null;
}): readonly BaselineCohortBuilderDangerFlag[] {
  const flags = new Set<BaselineCohortBuilderDangerFlag>();
  for (const digest of input.candidate.sourceEventDigests) {
    const gate = input.qualityGatesByDigest.get(digest);
    if (!gate) {
      flags.add('quality-gate-missing');
    } else if (!gate.readyForAssuranceEvidence) {
      flags.add('quality-defeater-present');
    }
  }
  if (!input.releaseBudget.releaseReadyForAssuranceReview) {
    flags.add('budget-not-ready');
  }
  if (input.assuranceCaseRefDigest === null) {
    flags.add('assurance-case-unbound');
  }
  if (
    input.candidate.sourceEventCount <
    input.candidate.promotionGate.minimumSourceEventCountForPromotion
  ) {
    flags.add('source-count-below-floor');
  }
  if (input.candidate.safetyLabel !== 'eligible') {
    flags.add('unsafe-baseline-cohort');
  }
  return uniqueSorted([...flags]);
}

function outcomeFromFlags(
  flags: readonly BaselineCohortBuilderDangerFlag[],
): BaselineCohortBuilderOutcome {
  if (flags.includes('raw-material-present')) return 'cohort-held-for-quality-defeaters';
  if (flags.includes('quality-gate-missing') || flags.includes('quality-defeater-present')) {
    return 'cohort-held-for-quality-defeaters';
  }
  if (flags.includes('budget-not-ready')) return 'cohort-held-for-budget';
  if (flags.includes('assurance-case-unbound')) return 'cohort-held-for-assurance-case';
  if (flags.includes('source-count-below-floor')) return 'cohort-held-for-source-floor';
  if (flags.includes('unsafe-baseline-cohort')) return 'cohort-held-for-safety-label';
  return 'cohort-evidence-ready-for-candidate-claim';
}

function reasonCodesFor(
  outcome: BaselineCohortBuilderOutcome,
  flags: readonly BaselineCohortBuilderDangerFlag[],
): readonly string[] {
  const reasons = new Set<string>([
    `outcome:${outcome}`,
    ...flags.map((flag) => `flag:${flag}`),
  ]);
  if (flags.length === 0) {
    reasons.add('baseline-cohort-evidence-ready-for-candidate-claim');
  }
  return uniqueSorted([...reasons]);
}

function evidenceBodyDigestFor(input: {
  readonly candidate: BaselineCohortCandidate;
  readonly qualityGates: readonly ShadowDataQualityGateRecord[];
  readonly releaseBudget: LearnedArtifactReleaseBudgetRecord;
  readonly reasonCodes: readonly string[];
}): string {
  return canonicalObject({
    kind: 'baseline-cohort-builder-evidence-body',
    version: BASELINE_COHORT_BUILDER_VERSION,
    cohortRefDigest: input.candidate.cohortRefDigest,
    candidateDigest: input.candidate.digest,
    sourceEventDigests: input.candidate.sourceEventDigests,
    qualityGateDigests: input.qualityGates.map((gate) => gate.digest).sort(),
    releaseBudgetDigest: input.releaseBudget.digest,
    reasonCodes: input.reasonCodes,
  } as CanonicalReleaseJsonValue).digest;
}

export function createBaselineCohortEvidence(
  input: CreateBaselineCohortEvidenceInput,
): BaselineCohortBuilderRecord {
  const candidate = input.candidate;
  assertNoRawMaterial(candidate);
  const createdAt = normalizeIsoTimestamp(input.createdAt, 'createdAt');
  const createdByRefDigest = normalizeDigest(input.createdByRefDigest, 'createdByRefDigest');
  const assuranceCaseRefDigest = normalizeOptionalDigest(
    input.assuranceCaseRefDigest,
    'assuranceCaseRefDigest',
  );
  const qualityGatesByDigest = qualityGateMapFor(candidate, input.qualityGates);
  assertReleaseBudgetMatches(candidate, input.releaseBudget);
  const flags = flagsFor({
    candidate,
    qualityGatesByDigest,
    releaseBudget: input.releaseBudget,
    assuranceCaseRefDigest,
  });
  const outcome = outcomeFromFlags(flags);
  const reasonCodes = reasonCodesFor(outcome, flags);
  const readyForCandidateClaim =
    outcome === 'cohort-evidence-ready-for-candidate-claim';
  const evidenceBodyDigest = evidenceBodyDigestFor({
    candidate,
    qualityGates: input.qualityGates,
    releaseBudget: input.releaseBudget,
    reasonCodes,
  });
  const evidenceNodeId = normalizeIdentifier(
    input.evidenceNodeId ??
      `evidence:baseline-cohort:${candidate.cohortRefDigest.slice('sha256:'.length, 23)}`,
    'evidenceNodeId',
  );
  const evidenceNode = assuranceCaseRefDigest === null
    ? null
    : createAssuranceCaseNode({
        nodeId: evidenceNodeId,
        kind: 'evidence',
        title: 'Baseline cohort evidence',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest: candidate.tenantRefDigest,
        scopeDigest: candidate.cohortRefDigest,
        createdByRefDigest,
        createdAt,
      });
  const evidenceTransition = evidenceNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${evidenceNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: createdByRefDigest,
        occurredAt: createdAt,
        reasonDigest: reasonDigest(reasonCodes),
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: evidenceNode.digest,
      });
  const includedSourceEventDigests = uniqueSorted(
    candidate.sourceEventDigests.filter((digest) =>
      qualityGatesByDigest.get(digest)?.readyForAssuranceEvidence === true),
  );
  const excludedSourceEventDigests = uniqueSorted(
    candidate.sourceEventDigests.filter((digest) =>
      qualityGatesByDigest.get(digest)?.readyForAssuranceEvidence !== true),
  );
  const qualityReadyCount = [...qualityGatesByDigest.values()].filter(
    (gate) => gate.readyForAssuranceEvidence,
  ).length;
  const core: Omit<BaselineCohortBuilderRecord, 'canonical' | 'digest'> = {
    version: BASELINE_COHORT_BUILDER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    baselineCohortContractVersion: BASELINE_COHORT_CONTRACT_VERSION,
    shadowDataQualityGateVersion: SHADOW_DATA_QUALITY_GATE_VERSION,
    learnedArtifactReleaseBudgetVersion: LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION,
    cohortId: candidate.cohortId,
    cohortRefDigest: candidate.cohortRefDigest,
    candidateDigest: candidate.digest,
    tenantRefDigest: candidate.tenantRefDigest,
    sourceEventCount: candidate.sourceEventCount,
    sourceEventDigests: candidate.sourceEventDigests,
    qualityGateCount: qualityGatesByDigest.size,
    qualityReadyCount,
    qualityHeldCount: candidate.sourceEventCount - qualityReadyCount,
    releaseBudgetDigest: input.releaseBudget.digest,
    releaseBudgetOutcome: input.releaseBudget.outcome,
    assuranceCaseRefDigest,
    evidenceNode,
    evidenceTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    evidenceBodyDigest,
    includedSourceEventDigests,
    excludedSourceEventDigests,
    dangerFlags: flags,
    reasonCodes,
    outcome,
    readyForCandidateClaim,
    underminingDefeaterRequired: !readyForCandidateClaim,
    failClosed: !readyForCandidateClaim,
    assuranceEvidenceOnly: true,
    digestOnlyEvidence: true,
    noRawMaterial: true,
    noTraining: true,
    noLearning: true,
    noCrossTenantAggregation: true,
    noAutoPromotion: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function baselineCohortBuilderDescriptor():
  BaselineCohortBuilderDescriptor {
  return Object.freeze({
    version: BASELINE_COHORT_BUILDER_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    baselineCohortContractVersion: BASELINE_COHORT_CONTRACT_VERSION,
    shadowDataQualityGateVersion: SHADOW_DATA_QUALITY_GATE_VERSION,
    learnedArtifactReleaseBudgetVersion: LEARNED_ARTIFACT_RELEASE_BUDGET_VERSION,
    sourceAnchors: BASELINE_COHORT_BUILDER_SOURCE_ANCHORS,
    outcomes: BASELINE_COHORT_BUILDER_OUTCOMES,
    dangerFlags: BASELINE_COHORT_BUILDER_DANGER_FLAGS,
    createsAssuranceEvidenceNode: true,
    requiresQualityGateForEverySourceEvent: true,
    requiresReleaseBudget: true,
    assuranceCaseContextRequired: true,
    digestOnlyEvidence: true,
    noRawMaterial: true,
    noTraining: true,
    noLearning: true,
    noCrossTenantAggregation: true,
    noAutoPromotion: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-baseline-mining-engine',
      'not-learned-invariant-synthesizer',
      'not-model-training',
      'not-live-enforcement',
      'not-policy-activation',
      'not-cross-tenant-aggregation',
      'not-production-ready',
    ]),
  });
}
