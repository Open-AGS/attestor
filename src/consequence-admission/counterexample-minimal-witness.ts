import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
  type CandidateInvariantSynthesizerRecord,
} from './candidate-invariant-synthesizer.js';

export const COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION =
  'attestor.counterexample-minimal-witness.v1';

export const COUNTEREXAMPLE_MINIMAL_WITNESS_SOURCE_ANCHORS = [
  'jepsen-elle-minimal-cycle-witness',
  'clusterfuzz-testcase-minimization',
  'quickcheck-shrinking',
  'zeller-delta-debugging',
  'foundationdb-deterministic-simulation-seed-replay',
  'assurance-case-rebutting-defeater',
] as const;
export type CounterexampleMinimalWitnessSourceAnchor =
  typeof COUNTEREXAMPLE_MINIMAL_WITNESS_SOURCE_ANCHORS[number];

export const COUNTEREXAMPLE_WITNESS_KINDS = [
  'event-sequence',
  'cycle-witness',
  'fixture-shrink',
  'seed-replay',
  'decision-delta',
  'boundary-violation',
] as const;
export type CounterexampleWitnessKind =
  typeof COUNTEREXAMPLE_WITNESS_KINDS[number];

export const COUNTEREXAMPLE_MINIMALITY_METHODS = [
  'already-minimal',
  'delta-debugging',
  'shrinking',
  'cycle-reduction',
  'corpus-pruning',
] as const;
export type CounterexampleMinimalityMethod =
  typeof COUNTEREXAMPLE_MINIMALITY_METHODS[number];

export const COUNTEREXAMPLE_MINIMAL_WITNESS_OUTCOMES = [
  'minimal-witness-ready-for-rebutting-defeater',
  'minimal-witness-held-for-synthesizer-readiness',
  'minimal-witness-held-for-assurance-case',
  'minimal-witness-held-for-minimality',
] as const;
export type CounterexampleMinimalWitnessOutcome =
  typeof COUNTEREXAMPLE_MINIMAL_WITNESS_OUTCOMES[number];

export const COUNTEREXAMPLE_MINIMAL_WITNESS_DANGER_FLAGS = [
  'synthesized-claim-not-ready',
  'assurance-case-unbound',
  'claim-node-missing',
  'violation-not-reproduced',
  'minimality-not-reduced',
] as const;
export type CounterexampleMinimalWitnessDangerFlag =
  typeof COUNTEREXAMPLE_MINIMAL_WITNESS_DANGER_FLAGS[number];

export interface CreateCounterexampleMinimalWitnessInput {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly witnessId: string;
  readonly witnessKind: CounterexampleWitnessKind;
  readonly observedAt: string;
  readonly createdByRefDigest: string;
  readonly sourceReplayDigest: string;
  readonly replaySeedDigest?: string | null;
  readonly candidateInvariantDigest: string;
  readonly invariantRefDigest: string;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly traceRefDigests: readonly string[];
  readonly eventRefDigests: readonly string[];
  readonly counterexampleRefDigests: readonly string[];
  readonly minimalityMethod: CounterexampleMinimalityMethod;
  readonly originalStepCount: number;
  readonly minimalStepCount: number;
  readonly removedStepCount: number;
  readonly reproducesViolation: boolean;
  readonly violatedClaimNodeId?: string | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
}

export interface CounterexampleMinimalWitnessRecord {
  readonly version: typeof COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly synthesizedClaimDigest: string;
  readonly claimNodeDigest: string | null;
  readonly invariantRefDigest: string;
  readonly candidateInvariantDigest: string;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly assuranceCaseRefDigest: string | null;
  readonly witnessId: string;
  readonly witnessRefDigest: string;
  readonly witnessKind: CounterexampleWitnessKind;
  readonly sourceReplayDigest: string;
  readonly replaySeedDigest: string | null;
  readonly traceRefDigests: readonly string[];
  readonly eventRefDigests: readonly string[];
  readonly counterexampleRefDigests: readonly string[];
  readonly minimalityMethod: CounterexampleMinimalityMethod;
  readonly originalStepCount: number;
  readonly minimalStepCount: number;
  readonly removedStepCount: number;
  readonly reproducesViolation: boolean;
  readonly violatedClaimNodeId: string | null;
  readonly evidenceBodyDigest: string;
  readonly transitionReasonDigest: string;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly rebuttingDefeater: AssuranceCaseDefeater | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly defeaterTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly rebuttingDefeaterDigest: string | null;
  readonly outcome: CounterexampleMinimalWitnessOutcome;
  readonly dangerFlags: readonly CounterexampleMinimalWitnessDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly readyForReviewer: boolean;
  readonly opensRebuttingDefeater: boolean;
  readonly minimalWitnessEvidenceOnly: true;
  readonly digestOnlyEvidence: true;
  readonly noReplayExecution: true;
  readonly noProductionTraffic: true;
  readonly noCredentialUse: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly noAutoClaimRejection: true;
  readonly noAutoPromotion: true;
  readonly noPolicyActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CounterexampleMinimalWitnessDescriptor {
  readonly version: typeof COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly candidateInvariantSynthesizerVersion:
    typeof CANDIDATE_INVARIANT_SYNTHESIZER_VERSION;
  readonly sourceAnchors: readonly CounterexampleMinimalWitnessSourceAnchor[];
  readonly witnessKinds: readonly CounterexampleWitnessKind[];
  readonly minimalityMethods: readonly CounterexampleMinimalityMethod[];
  readonly outcomes: readonly CounterexampleMinimalWitnessOutcome[];
  readonly dangerFlags: readonly CounterexampleMinimalWitnessDangerFlag[];
  readonly createsEvidenceNode: true;
  readonly opensRebuttingDefeater: true;
  readonly requiresSynthesizedClaimReady: true;
  readonly requiresMinimalReproducingWitness: true;
  readonly digestOnlyEvidence: true;
  readonly noReplayExecution: true;
  readonly noProductionTraffic: true;
  readonly noCredentialUse: true;
  readonly noLearning: true;
  readonly noTraining: true;
  readonly noAutoClaimRejection: true;
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
    throw new Error(`Counterexample minimal witness ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `Counterexample minimal witness ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`Counterexample minimal witness ${fieldName} must be a sha256 digest.`);
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
    throw new Error(`Counterexample minimal witness ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeEnumValue<const Values extends readonly string[]>(
  value: string | null | undefined,
  values: Values,
  fieldName: string,
): Values[number] {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!values.includes(normalized)) {
    throw new Error(`Counterexample minimal witness ${fieldName} is not supported.`);
  }
  return normalized as Values[number];
}

function normalizeDigestList(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Counterexample minimal witness ${fieldName} must not be empty.`);
  }
  const normalized = values.map((value, index) =>
    normalizeDigest(value, `${fieldName}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Counterexample minimal witness ${fieldName} must not contain duplicates.`);
  }
  return Object.freeze(normalized);
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function shortDigest(digest: string): string {
  return digest.slice('sha256:'.length, 'sha256:'.length + 16);
}

function normalizeStepCount(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error(
      `Counterexample minimal witness ${fieldName} must be a bounded non-negative integer.`,
    );
  }
  return value;
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    value,
  }).digest;
}

function flagsFor(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly assuranceCaseRefDigest: string | null;
  readonly claimNodeDigest: string | null;
  readonly reproducesViolation: boolean;
  readonly minimalityMethod: CounterexampleMinimalityMethod;
  readonly originalStepCount: number;
  readonly minimalStepCount: number;
}): readonly CounterexampleMinimalWitnessDangerFlag[] {
  const flags = new Set<CounterexampleMinimalWitnessDangerFlag>();
  if (!input.synthesizedClaim.readyForOpenDefeaterReview) {
    flags.add('synthesized-claim-not-ready');
  }
  if (input.assuranceCaseRefDigest === null) {
    flags.add('assurance-case-unbound');
  }
  if (
    input.synthesizedClaim.readyForOpenDefeaterReview &&
    input.claimNodeDigest === null
  ) {
    flags.add('claim-node-missing');
  }
  if (!input.reproducesViolation) {
    flags.add('violation-not-reproduced');
  }
  if (
    input.minimalityMethod !== 'already-minimal' &&
    input.minimalStepCount === input.originalStepCount
  ) {
    flags.add('minimality-not-reduced');
  }
  return uniqueSorted([...flags]);
}

function outcomeFor(
  flags: readonly CounterexampleMinimalWitnessDangerFlag[],
): CounterexampleMinimalWitnessOutcome {
  if (
    flags.includes('assurance-case-unbound') ||
    flags.includes('claim-node-missing')
  ) {
    return 'minimal-witness-held-for-assurance-case';
  }
  if (flags.includes('synthesized-claim-not-ready')) {
    return 'minimal-witness-held-for-synthesizer-readiness';
  }
  if (
    flags.includes('violation-not-reproduced') ||
    flags.includes('minimality-not-reduced')
  ) {
    return 'minimal-witness-held-for-minimality';
  }
  return 'minimal-witness-ready-for-rebutting-defeater';
}

function reasonCodesFor(input: {
  readonly outcome: CounterexampleMinimalWitnessOutcome;
  readonly flags: readonly CounterexampleMinimalWitnessDangerFlag[];
  readonly witnessKind: CounterexampleWitnessKind;
  readonly minimalityMethod: CounterexampleMinimalityMethod;
}): readonly string[] {
  const reasons = new Set<string>([
    `outcome:${input.outcome}`,
    `witness-kind:${input.witnessKind}`,
    `minimality-method:${input.minimalityMethod}`,
    ...input.flags.map((flag) => `flag:${flag}`),
  ]);
  if (input.flags.length === 0) {
    reasons.add('counterexample-minimal-witness-ready-for-rebutting-defeater');
  }
  return uniqueSorted([...reasons]);
}

function assertScopeMatches(input: {
  readonly synthesizedClaim: CandidateInvariantSynthesizerRecord;
  readonly candidateInvariantDigest: string;
  readonly invariantRefDigest: string;
  readonly tenantRefDigest: string;
  readonly cohortRefDigest: string;
  readonly violatedClaimNodeId: string | null;
}): void {
  if (input.synthesizedClaim.version !== CANDIDATE_INVARIANT_SYNTHESIZER_VERSION) {
    throw new Error('Counterexample minimal witness synthesized claim version mismatch.');
  }
  if (input.synthesizedClaim.candidateInvariantDigest !== input.candidateInvariantDigest) {
    throw new Error('Counterexample minimal witness candidate invariant digest mismatch.');
  }
  if (input.synthesizedClaim.invariantRefDigest !== input.invariantRefDigest) {
    throw new Error('Counterexample minimal witness invariant ref mismatch.');
  }
  if (input.synthesizedClaim.tenantRefDigest !== input.tenantRefDigest) {
    throw new Error('Counterexample minimal witness tenant mismatch.');
  }
  if (input.synthesizedClaim.cohortRefDigest !== input.cohortRefDigest) {
    throw new Error('Counterexample minimal witness cohort ref mismatch.');
  }
  if (
    input.violatedClaimNodeId !== null &&
    input.synthesizedClaim.claimNode !== null &&
    input.violatedClaimNodeId !== input.synthesizedClaim.claimNode.nodeId
  ) {
    throw new Error('Counterexample minimal witness violated claim node mismatch.');
  }
}

function assertStepCounts(input: {
  readonly originalStepCount: number;
  readonly minimalStepCount: number;
  readonly removedStepCount: number;
}): void {
  if (input.originalStepCount <= 0) {
    throw new Error('Counterexample minimal witness originalStepCount must be positive.');
  }
  if (input.minimalStepCount <= 0) {
    throw new Error('Counterexample minimal witness minimalStepCount must be positive.');
  }
  if (input.minimalStepCount > input.originalStepCount) {
    throw new Error('Counterexample minimal witness minimalStepCount must not exceed originalStepCount.');
  }
  if (input.removedStepCount !== input.originalStepCount - input.minimalStepCount) {
    throw new Error('Counterexample minimal witness removedStepCount must equal originalStepCount - minimalStepCount.');
  }
}

export function createCounterexampleMinimalWitness(
  input: CreateCounterexampleMinimalWitnessInput,
): CounterexampleMinimalWitnessRecord {
  const witnessId = normalizeIdentifier(input.witnessId, 'witnessId');
  const witnessKind = normalizeEnumValue(
    input.witnessKind,
    COUNTEREXAMPLE_WITNESS_KINDS,
    'witnessKind',
  ) as CounterexampleWitnessKind;
  const observedAt = normalizeIsoTimestamp(input.observedAt, 'observedAt');
  const createdByRefDigest = normalizeDigest(input.createdByRefDigest, 'createdByRefDigest');
  const sourceReplayDigest = normalizeDigest(input.sourceReplayDigest, 'sourceReplayDigest');
  const replaySeedDigest = normalizeOptionalDigest(
    input.replaySeedDigest,
    'replaySeedDigest',
  );
  const candidateInvariantDigest = normalizeDigest(
    input.candidateInvariantDigest,
    'candidateInvariantDigest',
  );
  const invariantRefDigest = normalizeDigest(input.invariantRefDigest, 'invariantRefDigest');
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const cohortRefDigest = normalizeDigest(input.cohortRefDigest, 'cohortRefDigest');
  const traceRefDigests = normalizeDigestList(input.traceRefDigests, 'traceRefDigests');
  const eventRefDigests = normalizeDigestList(input.eventRefDigests, 'eventRefDigests');
  const counterexampleRefDigests = normalizeDigestList(
    input.counterexampleRefDigests,
    'counterexampleRefDigests',
  );
  const minimalityMethod = normalizeEnumValue(
    input.minimalityMethod,
    COUNTEREXAMPLE_MINIMALITY_METHODS,
    'minimalityMethod',
  ) as CounterexampleMinimalityMethod;
  const originalStepCount = normalizeStepCount(input.originalStepCount, 'originalStepCount');
  const minimalStepCount = normalizeStepCount(input.minimalStepCount, 'minimalStepCount');
  const removedStepCount = normalizeStepCount(input.removedStepCount, 'removedStepCount');
  const violatedClaimNodeId = input.violatedClaimNodeId === null ||
    input.violatedClaimNodeId === undefined
    ? input.synthesizedClaim.claimNode?.nodeId ?? null
    : normalizeIdentifier(input.violatedClaimNodeId, 'violatedClaimNodeId');
  assertStepCounts({ originalStepCount, minimalStepCount, removedStepCount });
  assertScopeMatches({
    synthesizedClaim: input.synthesizedClaim,
    candidateInvariantDigest,
    invariantRefDigest,
    tenantRefDigest,
    cohortRefDigest,
    violatedClaimNodeId,
  });
  const assuranceCaseRefDigest = input.synthesizedClaim.assuranceCaseRefDigest;
  const claimNodeDigest = input.synthesizedClaim.claimNodeDigest;
  const flags = flagsFor({
    synthesizedClaim: input.synthesizedClaim,
    assuranceCaseRefDigest,
    claimNodeDigest,
    reproducesViolation: input.reproducesViolation,
    minimalityMethod,
    originalStepCount,
    minimalStepCount,
  });
  const outcome = outcomeFor(flags);
  const readyForReviewer = outcome === 'minimal-witness-ready-for-rebutting-defeater';
  const reasonCodes = reasonCodesFor({ outcome, flags, witnessKind, minimalityMethod });
  const witnessRefDigest = bodyDigest('counterexample-minimal-witness-ref', {
    witnessId,
    witnessKind,
    sourceReplayDigest,
    replaySeedDigest,
    candidateInvariantDigest,
    invariantRefDigest,
    tenantRefDigest,
    cohortRefDigest,
  } as CanonicalReleaseJsonValue);
  const evidenceBodyDigest = bodyDigest('counterexample-minimal-witness-evidence-body', {
    witnessId,
    witnessRefDigest,
    witnessKind,
    sourceReplayDigest,
    replaySeedDigest,
    traceRefDigests,
    eventRefDigests,
    counterexampleRefDigests,
    minimalityMethod,
    originalStepCount,
    minimalStepCount,
    removedStepCount,
    reproducesViolation: input.reproducesViolation,
    violatedClaimNodeId,
    reasonCodes,
  } as unknown as CanonicalReleaseJsonValue);
  const transitionReasonDigest = bodyDigest('counterexample-minimal-witness-transition-reason', {
    reasonCodes,
  } as CanonicalReleaseJsonValue);
  const evidenceNode = readyForReviewer
    ? createAssuranceCaseNode({
        nodeId: normalizeIdentifier(
          input.evidenceNodeId ??
            `evidence:counterexample-minimal-witness:${shortDigest(witnessRefDigest)}`,
          'evidenceNodeId',
        ),
        kind: 'evidence',
        title: 'Minimal counterexample witness',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest,
        scopeDigest: invariantRefDigest,
        createdByRefDigest,
        createdAt: observedAt,
      })
    : null;
  const rebuttingDefeater = readyForReviewer && violatedClaimNodeId !== null
    ? createAssuranceCaseDefeater({
        defeaterId: normalizeIdentifier(
          input.defeaterId ??
            `defeater:rebutting-counterexample:${shortDigest(witnessRefDigest)}`,
          'defeaterId',
        ),
        kind: 'rebutting',
        state: 'open',
        attacksNodeId: violatedClaimNodeId,
        reasonDigest: evidenceBodyDigest,
        tenantRefDigest,
        openedByRefDigest: createdByRefDigest,
        openedAt: observedAt,
      })
    : null;
  const evidenceTransition = evidenceNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${evidenceNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: createdByRefDigest,
        occurredAt: observedAt,
        reasonDigest: transitionReasonDigest,
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: witnessRefDigest,
      });
  const defeaterTransition = rebuttingDefeater === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:open:${rebuttingDefeater.defeaterId}`,
        transitionKind: 'open-defeater',
        actorRefDigest: createdByRefDigest,
        occurredAt: observedAt,
        reasonDigest: transitionReasonDigest,
        defeaterId: rebuttingDefeater.defeaterId,
        fromState: null,
        toState: 'open',
        evidenceRefDigest: evidenceNode?.digest ?? witnessRefDigest,
      });
  const core: Omit<CounterexampleMinimalWitnessRecord, 'canonical' | 'digest'> = {
    version: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    synthesizedClaimDigest: input.synthesizedClaim.digest,
    claimNodeDigest,
    invariantRefDigest,
    candidateInvariantDigest,
    tenantRefDigest,
    cohortRefDigest,
    assuranceCaseRefDigest,
    witnessId,
    witnessRefDigest,
    witnessKind,
    sourceReplayDigest,
    replaySeedDigest,
    traceRefDigests,
    eventRefDigests,
    counterexampleRefDigests,
    minimalityMethod,
    originalStepCount,
    minimalStepCount,
    removedStepCount,
    reproducesViolation: input.reproducesViolation,
    violatedClaimNodeId,
    evidenceBodyDigest,
    transitionReasonDigest,
    evidenceNode,
    rebuttingDefeater,
    evidenceTransition,
    defeaterTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    rebuttingDefeaterDigest: rebuttingDefeater?.digest ?? null,
    outcome,
    dangerFlags: flags,
    reasonCodes,
    readyForReviewer,
    opensRebuttingDefeater: rebuttingDefeater !== null,
    minimalWitnessEvidenceOnly: true,
    digestOnlyEvidence: true,
    noReplayExecution: true,
    noProductionTraffic: true,
    noCredentialUse: true,
    noLearning: true,
    noTraining: true,
    noAutoClaimRejection: true,
    noAutoPromotion: true,
    noPolicyActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function counterexampleMinimalWitnessDescriptor():
  CounterexampleMinimalWitnessDescriptor {
  return Object.freeze({
    version: COUNTEREXAMPLE_MINIMAL_WITNESS_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    candidateInvariantSynthesizerVersion: CANDIDATE_INVARIANT_SYNTHESIZER_VERSION,
    sourceAnchors: COUNTEREXAMPLE_MINIMAL_WITNESS_SOURCE_ANCHORS,
    witnessKinds: COUNTEREXAMPLE_WITNESS_KINDS,
    minimalityMethods: COUNTEREXAMPLE_MINIMALITY_METHODS,
    outcomes: COUNTEREXAMPLE_MINIMAL_WITNESS_OUTCOMES,
    dangerFlags: COUNTEREXAMPLE_MINIMAL_WITNESS_DANGER_FLAGS,
    createsEvidenceNode: true,
    opensRebuttingDefeater: true,
    requiresSynthesizedClaimReady: true,
    requiresMinimalReproducingWitness: true,
    digestOnlyEvidence: true,
    noReplayExecution: true,
    noProductionTraffic: true,
    noCredentialUse: true,
    noLearning: true,
    noTraining: true,
    noAutoClaimRejection: true,
    noAutoPromotion: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-replay-execution-engine',
      'not-policy-correctness-proof',
      'not-target-system-integration',
      'not-production-traffic',
      'not-credential-use',
      'not-model-training',
      'not-automatic-claim-rejection',
      'not-policy-activation',
      'not-production-ready',
    ]),
  });
}
