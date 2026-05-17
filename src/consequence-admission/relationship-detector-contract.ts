import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  type SignalDirectedRelationship,
  type SignalEvidenceRef,
  type SignalInteractionEffect,
  type SignalInteractionRule,
  type SignalRelationship,
  type SignalRelationshipKind,
  type SignalRelationshipShape,
  type SignalRelationshipSignal,
  type SignalSymmetricRelationship,
  type SignalUnaryRelationship,
} from './signal-relationship-contract.js';

export const RELATIONSHIP_DETECTOR_CONTRACT_VERSION =
  'attestor.relationship-detector-contract.v1';

export const RELATIONSHIP_DETECTOR_EXECUTION_MODES = [
  'shadow-only',
  'offline-replay',
] as const;
export type RelationshipDetectorExecutionMode =
  typeof RELATIONSHIP_DETECTOR_EXECUTION_MODES[number];

export const RELATIONSHIP_DETECTOR_OUTPUT_MODES = [
  'relationships-and-interaction-rules',
] as const;
export type RelationshipDetectorOutputMode =
  typeof RELATIONSHIP_DETECTOR_OUTPUT_MODES[number];

export const RELATIONSHIP_DETECTOR_RULE_MODES = [
  'duplicate-evidence',
  'same-kind-independent-confirmation',
  'confirmation-contradiction-conflict',
  'hard-floor-overrides-advisory',
  'context-modulates-advisory',
  'boundary-escalates-gap',
  'gap-requires-review',
  'measurement-degraded-requires-review',
] as const;
export type RelationshipDetectorRuleMode =
  typeof RELATIONSHIP_DETECTOR_RULE_MODES[number];

export interface RelationshipDetectorRule {
  readonly version: typeof RELATIONSHIP_DETECTOR_CONTRACT_VERSION;
  readonly ruleId: string;
  readonly mode: RelationshipDetectorRuleMode;
  readonly relationshipKind: SignalRelationshipKind;
  readonly shape: SignalRelationshipShape;
  readonly effect: SignalInteractionEffect;
  readonly reasonCodes: readonly string[];
  readonly ruleBasedOnly: true;
  readonly learnedInferenceIncluded: false;
  readonly correlationLearningIncluded: false;
  readonly grantsAuthority: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface CreateRelationshipDetectorRuleInput {
  readonly ruleId: string;
  readonly mode: RelationshipDetectorRuleMode;
  readonly relationshipKind: SignalRelationshipKind;
  readonly shape: SignalRelationshipShape;
  readonly effect: SignalInteractionEffect;
  readonly reasonCodes: readonly string[];
}

export interface RelationshipDetectionBatch {
  readonly version: typeof RELATIONSHIP_DETECTOR_CONTRACT_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly envelopeRefDigest: string;
  readonly executionMode: RelationshipDetectorExecutionMode;
  readonly outputMode: RelationshipDetectorOutputMode;
  readonly signals: readonly SignalRelationshipSignal[];
  readonly rules: readonly RelationshipDetectorRule[];
  readonly relationships: readonly SignalRelationship[];
  readonly interactionRules: readonly SignalInteractionRule[];
  readonly signalCount: number;
  readonly relationshipCount: number;
  readonly interactionRuleCount: number;
  readonly ruleIdsApplied: readonly string[];
  readonly duplicateEvidenceDigests: readonly string[];
  readonly sameEnvelopeOnly: true;
  readonly relationshipEvaluationBeforeFusion: true;
  readonly ruleBasedOnly: true;
  readonly learnedInferenceIncluded: false;
  readonly correlationLearningIncluded: false;
  readonly fusionIncluded: false;
  readonly packetSigningIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface RelationshipDetectorDescriptor {
  readonly version: typeof RELATIONSHIP_DETECTOR_CONTRACT_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly executionModes: readonly RelationshipDetectorExecutionMode[];
  readonly outputModes: readonly RelationshipDetectorOutputMode[];
  readonly ruleModes: readonly RelationshipDetectorRuleMode[];
  readonly builtInRuleCount: number;
  readonly sameEnvelopeOnly: true;
  readonly relationshipEvaluationBeforeFusion: true;
  readonly ruleBasedOnly: true;
  readonly learnedInferenceIncluded: false;
  readonly correlationLearningIncluded: false;
  readonly fusionIncluded: false;
  readonly packetSigningIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawProviderBodyStored: false;
  readonly nonClaims: readonly string[];
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

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Relationship detector ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function normalizeId(value: string, fieldName: string): string {
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/u.test(value)) {
    throw new Error(`Relationship detector ${fieldName} must be a stable lowercase id.`);
  }
  return value;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function sortedPair(left: string, right: string): readonly [string, string] {
  return left < right ? [left, right] : [right, left];
}

function shortDigest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function assertShapeMatchesKind(
  kind: SignalRelationshipKind,
  shape: SignalRelationshipShape,
): void {
  if (
    (kind === 'confirms' || kind === 'contradicts' || kind === 'duplicates') &&
    shape !== 'symmetric'
  ) {
    throw new Error('Relationship detector symmetric relationship kinds require symmetric shape.');
  }
  if (
    (
      kind === 'overrides' ||
      kind === 'depends_on' ||
      kind === 'modulates' ||
      kind === 'escalates' ||
      kind === 'suppresses'
    ) &&
    shape !== 'directed'
  ) {
    throw new Error('Relationship detector directed relationship kinds require directed shape.');
  }
  if (kind === 'requires_review' && shape !== 'unary') {
    throw new Error('Relationship detector unary relationship kinds require unary shape.');
  }
}

function assertEffectMatchesKind(
  kind: SignalRelationshipKind,
  effect: SignalInteractionEffect,
): void {
  const expected = effectForRelationshipKind(kind);
  if (effect !== expected) {
    throw new Error('Relationship detector interaction effect must match relationship kind.');
  }
}

function effectForRelationshipKind(
  kind: SignalRelationshipKind,
): SignalInteractionEffect {
  if (kind === 'duplicates') return 'discount-duplicate-evidence';
  if (kind === 'contradicts') return 'mark-conflict';
  if (kind === 'overrides' || kind === 'suppresses') return 'preserve-hard-floor';
  if (kind === 'depends_on') return 'mark-dependency-missing';
  if (kind === 'modulates') return 'raise-review-pressure';
  if (kind === 'escalates') return 'raise-block-pressure';
  return 'raise-review-pressure';
}

export function createRelationshipDetectorRule(
  input: CreateRelationshipDetectorRuleInput,
): RelationshipDetectorRule {
  assertShapeMatchesKind(input.relationshipKind, input.shape);
  assertEffectMatchesKind(input.relationshipKind, input.effect);
  if (input.reasonCodes.length === 0) {
    throw new Error('Relationship detector rule must include at least one reason code.');
  }
  return Object.freeze({
    version: RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
    ruleId: normalizeId(input.ruleId, 'ruleId'),
    mode: input.mode,
    relationshipKind: input.relationshipKind,
    shape: input.shape,
    effect: input.effect,
    reasonCodes: uniqueStrings(input.reasonCodes),
    ruleBasedOnly: true,
    learnedInferenceIncluded: false,
    correlationLearningIncluded: false,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

export const BUILTIN_RELATIONSHIP_DETECTOR_RULES = Object.freeze([
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.duplicate-evidence',
    mode: 'duplicate-evidence',
    relationshipKind: 'duplicates',
    shape: 'symmetric',
    effect: 'discount-duplicate-evidence',
    reasonCodes: ['same-evidence-digest'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.same-kind-independent-confirmation',
    mode: 'same-kind-independent-confirmation',
    relationshipKind: 'confirms',
    shape: 'symmetric',
    effect: 'raise-review-pressure',
    reasonCodes: ['same-kind-independent-sources'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.confirmation-contradiction-conflict',
    mode: 'confirmation-contradiction-conflict',
    relationshipKind: 'contradicts',
    shape: 'symmetric',
    effect: 'mark-conflict',
    reasonCodes: ['confirmation-contradiction-pair'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.hard-floor-overrides-advisory',
    mode: 'hard-floor-overrides-advisory',
    relationshipKind: 'overrides',
    shape: 'directed',
    effect: 'preserve-hard-floor',
    reasonCodes: ['hard-floor-overrides-advisory'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.context-modulates-advisory',
    mode: 'context-modulates-advisory',
    relationshipKind: 'modulates',
    shape: 'directed',
    effect: 'raise-review-pressure',
    reasonCodes: ['context-modulates-advisory'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.boundary-escalates-gap',
    mode: 'boundary-escalates-gap',
    relationshipKind: 'escalates',
    shape: 'directed',
    effect: 'raise-block-pressure',
    reasonCodes: ['boundary-escalates-gap'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.gap-requires-review',
    mode: 'gap-requires-review',
    relationshipKind: 'requires_review',
    shape: 'unary',
    effect: 'raise-review-pressure',
    reasonCodes: ['gap-requires-review'],
  }),
  createRelationshipDetectorRule({
    ruleId: 'relationship-detector.measurement-degraded-requires-review',
    mode: 'measurement-degraded-requires-review',
    relationshipKind: 'requires_review',
    shape: 'unary',
    effect: 'raise-review-pressure',
    reasonCodes: ['measurement-degraded-requires-review'],
  }),
]);

function assertSignal(signal: SignalRelationshipSignal, envelopeRefDigest: string): void {
  normalizeId(signal.signalId, 'signalId');
  if (signal.envelopeRefDigest !== envelopeRefDigest) {
    throw new Error('Relationship detector signals must belong to the same envelope.');
  }
  if (signal.evidenceRefs.length === 0) {
    throw new Error('Relationship detector signals must include evidence refs.');
  }
  signal.evidenceRefs.forEach((ref, index) =>
    normalizeDigest(ref.digest, `signal ${signal.signalId} evidenceRefs[${index}].digest`)
  );
  signal.readModelRefs.forEach((ref, index) =>
    normalizeDigest(ref.digest, `signal ${signal.signalId} readModelRefs[${index}].digest`)
  );
  if (
    signal.grantsAuthority !== false ||
    signal.activatesEnforcement !== false ||
    signal.autoEnforce !== false ||
    signal.productionReady !== false ||
    signal.rawPayloadStored !== false ||
    signal.rawPromptStored !== false ||
    signal.rawProviderBodyStored !== false
  ) {
    throw new Error('Relationship detector signals must preserve no-authority and no-raw-material invariants.');
  }
}

function sharedEvidenceRefs(
  left: SignalRelationshipSignal,
  right: SignalRelationshipSignal,
): readonly SignalEvidenceRef[] {
  const rightDigests = new Set(right.evidenceRefs.map((ref) => ref.digest));
  return Object.freeze(left.evidenceRefs.filter((ref) => rightDigests.has(ref.digest)));
}

function mergedEvidenceRefs(
  signals: readonly SignalRelationshipSignal[],
): readonly SignalEvidenceRef[] {
  const refs = new Map<string, SignalEvidenceRef>();
  for (const signal of signals) {
    for (const ref of signal.evidenceRefs) {
      refs.set(`${ref.kind}:${ref.digest}`, ref);
    }
  }
  return Object.freeze([...refs.values()].sort((left, right) =>
    `${left.kind}:${left.digest}`.localeCompare(`${right.kind}:${right.digest}`)
  ));
}

function symmetricRelationship(
  rule: RelationshipDetectorRule,
  left: SignalRelationshipSignal,
  right: SignalRelationshipSignal,
  evidenceRefs: readonly SignalEvidenceRef[],
  extraReasonCodes: readonly string[] = [],
): SignalSymmetricRelationship {
  const [leftSignalId, rightSignalId] = sortedPair(left.signalId, right.signalId);
  return Object.freeze({
    relationshipId: `rel.${rule.relationshipKind}.${shortDigest([
      rule.ruleId,
      leftSignalId,
      rightSignalId,
      ...evidenceRefs.map((ref) => ref.digest),
    ])}`,
    kind: rule.relationshipKind as SignalSymmetricRelationship['kind'],
    shape: 'symmetric',
    leftSignalId,
    rightSignalId,
    evidenceRefs: Object.freeze([...evidenceRefs]),
    reasonCodes: uniqueStrings([...rule.reasonCodes, ...extraReasonCodes]),
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

function directedRelationship(
  rule: RelationshipDetectorRule,
  source: SignalRelationshipSignal,
  target: SignalRelationshipSignal,
  extraReasonCodes: readonly string[] = [],
): SignalDirectedRelationship {
  const evidenceRefs = mergedEvidenceRefs([source, target]);
  return Object.freeze({
    relationshipId: `rel.${rule.relationshipKind}.${shortDigest([
      rule.ruleId,
      source.signalId,
      target.signalId,
      ...evidenceRefs.map((ref) => ref.digest),
    ])}`,
    kind: rule.relationshipKind as SignalDirectedRelationship['kind'],
    shape: 'directed',
    sourceSignalId: source.signalId,
    targetSignalId: target.signalId,
    evidenceRefs,
    reasonCodes: uniqueStrings([...rule.reasonCodes, ...extraReasonCodes]),
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

function unaryRelationship(
  rule: RelationshipDetectorRule,
  signal: SignalRelationshipSignal,
): SignalUnaryRelationship {
  return Object.freeze({
    relationshipId: `rel.${rule.relationshipKind}.${shortDigest([
      rule.ruleId,
      signal.signalId,
      ...signal.evidenceRefs.map((ref) => ref.digest),
    ])}`,
    kind: rule.relationshipKind as SignalUnaryRelationship['kind'],
    shape: 'unary',
    signalId: signal.signalId,
    evidenceRefs: Object.freeze([...signal.evidenceRefs]),
    reasonCodes: rule.reasonCodes,
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

function detectWithRule(
  rule: RelationshipDetectorRule,
  signals: readonly SignalRelationshipSignal[],
): readonly SignalRelationship[] {
  const relationships: SignalRelationship[] = [];

  if (rule.mode === 'gap-requires-review') {
    return Object.freeze(signals
      .filter((signal) => signal.category === 'gap')
      .map((signal) => unaryRelationship(rule, signal)));
  }

  if (rule.mode === 'measurement-degraded-requires-review') {
    return Object.freeze(signals
      .filter((signal) =>
        signal.category === 'measurement' &&
        signal.kind === 'measurement_degraded_signal'
      )
      .map((signal) => unaryRelationship(rule, signal)));
  }

  for (let leftIndex = 0; leftIndex < signals.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < signals.length; rightIndex += 1) {
      const left = signals[leftIndex];
      const right = signals[rightIndex];
      if (!left || !right) continue;

      if (rule.mode === 'duplicate-evidence') {
        const shared = sharedEvidenceRefs(left, right);
        if (shared.length > 0) {
          relationships.push(symmetricRelationship(rule, left, right, shared));
        }
      } else if (
        rule.mode === 'same-kind-independent-confirmation' &&
        left.category === right.category &&
        left.kind === right.kind &&
        left.sourcePlane !== right.sourcePlane &&
        sharedEvidenceRefs(left, right).length === 0
      ) {
        relationships.push(symmetricRelationship(
          rule,
          left,
          right,
          mergedEvidenceRefs([left, right]),
        ));
      } else if (
        rule.mode === 'confirmation-contradiction-conflict' &&
        left.category === 'observation' &&
        right.category === 'observation' &&
        (
          (left.kind === 'confirmation' && right.kind === 'contradiction') ||
          (left.kind === 'contradiction' && right.kind === 'confirmation')
        )
      ) {
        relationships.push(symmetricRelationship(
          rule,
          left,
          right,
          mergedEvidenceRefs([left, right]),
        ));
      }
    }
  }

  if (rule.mode === 'hard-floor-overrides-advisory') {
    for (const source of signals.filter((signal) =>
      signal.category === 'verdict' &&
      signal.kind === 'hard_floor' &&
      signal.sourcePlane === 'tier-1-hard-gate' &&
      signal.authorityMode === 'hard-floor'
    )) {
      for (const target of signals.filter((signal) =>
        signal.signalId !== source.signalId &&
        signal.authorityMode !== 'hard-floor'
      )) {
        relationships.push(directedRelationship(rule, source, target));
      }
    }
  }

  if (rule.mode === 'context-modulates-advisory') {
    for (const source of signals.filter((signal) =>
      signal.category === 'context' &&
      signal.authorityMode === 'context-modulator'
    )) {
      for (const target of signals.filter((signal) =>
        signal.signalId !== source.signalId &&
        signal.authorityMode === 'advisory'
      )) {
        relationships.push(directedRelationship(rule, source, target));
      }
    }
  }

  if (rule.mode === 'boundary-escalates-gap') {
    for (const source of signals.filter((signal) => signal.category === 'boundary')) {
      for (const target of signals.filter((signal) => signal.category === 'gap')) {
        relationships.push(directedRelationship(rule, source, target));
      }
    }
  }

  return Object.freeze(relationships);
}

function interactionRuleForRelationship(
  relationship: SignalRelationship,
): SignalInteractionRule {
  const effect = effectForRelationshipKind(relationship.kind);
  return Object.freeze({
    ruleId: `interaction.${relationship.relationshipId}`,
    relationshipKind: relationship.kind,
    effect,
    evidenceRefs: relationship.evidenceRefs,
    reasonCodes: relationship.reasonCodes,
    noLoosening: true,
    mayGrantAuthority: false,
    mayActivateEnforcement: false,
    mayLowerRequiredReview: false,
    mayStoreRawMaterial: false,
    productionReady: false,
  });
}

export function detectSignalRelationships(input: {
  readonly envelopeRefDigest: string;
  readonly signals: readonly SignalRelationshipSignal[];
  readonly rules?: readonly RelationshipDetectorRule[];
  readonly executionMode?: RelationshipDetectorExecutionMode;
}): RelationshipDetectionBatch {
  normalizeDigest(input.envelopeRefDigest, 'envelopeRefDigest');
  if (input.signals.length === 0) {
    throw new Error('Relationship detector requires at least one signal.');
  }
  input.signals.forEach((signal) => assertSignal(signal, input.envelopeRefDigest));
  const signalIds = new Set<string>();
  for (const signal of input.signals) {
    if (signalIds.has(signal.signalId)) {
      throw new Error('Relationship detector signalId values must be unique.');
    }
    signalIds.add(signal.signalId);
  }

  const rules = input.rules ?? BUILTIN_RELATIONSHIP_DETECTOR_RULES;
  if (rules.length === 0) {
    throw new Error('Relationship detector requires at least one rule.');
  }

  const relationships = Object.freeze(rules.flatMap((rule) =>
    detectWithRule(rule, input.signals)
  ));
  const uniqueRelationships = Object.freeze(
    [...new Map(relationships.map((relationship) => [
      relationship.relationshipId,
      relationship,
    ])).values()],
  );
  const interactionRules = Object.freeze(uniqueRelationships.map(interactionRuleForRelationship));
  const duplicateEvidenceDigests = uniqueStrings(
    uniqueRelationships
      .filter((relationship) => relationship.kind === 'duplicates')
      .flatMap((relationship) => relationship.evidenceRefs.map((ref) => ref.digest)),
  );
  const payload = {
    version: RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    envelopeRefDigest: input.envelopeRefDigest,
    executionMode: input.executionMode ?? 'shadow-only',
    outputMode: 'relationships-and-interaction-rules',
    signals: Object.freeze([...input.signals]),
    rules: Object.freeze([...rules]),
    relationships: uniqueRelationships,
    interactionRules,
    signalCount: input.signals.length,
    relationshipCount: uniqueRelationships.length,
    interactionRuleCount: interactionRules.length,
    ruleIdsApplied: uniqueStrings(rules.map((rule) => rule.ruleId)),
    duplicateEvidenceDigests,
    sameEnvelopeOnly: true,
    relationshipEvaluationBeforeFusion: true,
    ruleBasedOnly: true,
    learnedInferenceIncluded: false,
    correlationLearningIncluded: false,
    fusionIncluded: false,
    packetSigningIncluded: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function relationshipDetectorDescriptor(): RelationshipDetectorDescriptor {
  return Object.freeze({
    version: RELATIONSHIP_DETECTOR_CONTRACT_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    executionModes: RELATIONSHIP_DETECTOR_EXECUTION_MODES,
    outputModes: RELATIONSHIP_DETECTOR_OUTPUT_MODES,
    ruleModes: RELATIONSHIP_DETECTOR_RULE_MODES,
    builtInRuleCount: BUILTIN_RELATIONSHIP_DETECTOR_RULES.length,
    sameEnvelopeOnly: true,
    relationshipEvaluationBeforeFusion: true,
    ruleBasedOnly: true,
    learnedInferenceIncluded: false,
    correlationLearningIncluded: false,
    fusionIncluded: false,
    packetSigningIncluded: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawProviderBodyStored: false,
    nonClaims: Object.freeze([
      'not-learned-inference',
      'not-correlation-learning',
      'not-fusion',
      'not-packet-signing',
      'not-live-enforcement',
      'not-authority-upgrade',
      'not-production-ready',
    ]),
  });
}
