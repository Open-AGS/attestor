import type {
  ConsequenceAdmissionCheckKind,
  ConsequenceAdmissionCheckOutcome,
} from './index.js';
import {
  SIGNAL_EXTRACTOR_CONTRACT_VERSION,
  createSignalExtractorDeclaration,
  type SignalExtractorDeclaration,
} from './signal-extractor-contract.js';
import {
  SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
  type SignalCategory,
  type SignalAuthorityMode,
  type SignalEvidenceReferenceKind,
  type SignalKindForCategory,
  type SignalReadModelRef,
  type SignalSourcePlane,
} from './signal-relationship-contract.js';

export const SIGNAL_ADAPTER_REGISTRY_VERSION =
  'attestor.signal-adapter-registry.v1';

export const SIGNAL_ADAPTER_SOURCE_CHECK_KINDS = [
  'policy',
  'authority',
  'evidence',
  'freshness',
  'enforcement',
  'adapter-readiness',
] as const satisfies readonly ConsequenceAdmissionCheckKind[];
export type SignalAdapterSourceCheckKind =
  typeof SIGNAL_ADAPTER_SOURCE_CHECK_KINDS[number];

export const SIGNAL_ADAPTER_TRIGGER_OUTCOMES = [
  'warn',
  'fail',
  'not-applicable',
] as const satisfies readonly Exclude<ConsequenceAdmissionCheckOutcome, 'pass'>[];
export type SignalAdapterTriggerOutcome =
  typeof SIGNAL_ADAPTER_TRIGGER_OUTCOMES[number];

export const SIGNAL_ADAPTER_DEDUPE_KEY_FIELDS = [
  'sourceCheckKind',
  'sourceEvidenceDigest',
  'envelopeRefDigest',
] as const;
export type SignalAdapterDedupeKeyField =
  typeof SIGNAL_ADAPTER_DEDUPE_KEY_FIELDS[number];

export interface SignalAdapterRegistration<
  Category extends SignalCategory = SignalCategory,
> {
  readonly version: typeof SIGNAL_ADAPTER_REGISTRY_VERSION;
  readonly adapterId: string;
  readonly sourceCheckKind: SignalAdapterSourceCheckKind;
  readonly extractor: SignalExtractorDeclaration<Category>;
  readonly signalCategory: Category;
  readonly signalKind: SignalKindForCategory<Category>;
  readonly triggerOutcomes: readonly SignalAdapterTriggerOutcome[];
  readonly evidenceRefKind: SignalEvidenceReferenceKind;
  readonly readModelKind: SignalReadModelRef['modelKind'];
  readonly dedupeKeyFields: readonly SignalAdapterDedupeKeyField[];
  readonly duplicateEvidenceRelationshipCandidate: 'duplicates';
  readonly passOutcomeMayMarkSafe: false;
  readonly relationshipDetectionIncluded: false;
  readonly fusionIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface CreateSignalAdapterRegistrationInput<
  Category extends SignalCategory = SignalCategory,
> {
  readonly adapterId: string;
  readonly sourceCheckKind: SignalAdapterSourceCheckKind;
  readonly extractor: SignalExtractorDeclaration<Category>;
  readonly signalKind: SignalKindForCategory<Category>;
  readonly triggerOutcomes?: readonly SignalAdapterTriggerOutcome[];
  readonly evidenceRefKind: SignalEvidenceReferenceKind;
  readonly readModelKind: SignalReadModelRef['modelKind'];
}

export interface SignalAdapterRegistry {
  readonly version: typeof SIGNAL_ADAPTER_REGISTRY_VERSION;
  readonly signalExtractorContractVersion:
    typeof SIGNAL_EXTRACTOR_CONTRACT_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly registrations: readonly SignalAdapterRegistration[];
  readonly sourceCheckKindsCovered: readonly SignalAdapterSourceCheckKind[];
  readonly triggerOutcomes: readonly SignalAdapterTriggerOutcome[];
  readonly dedupeKeyFields: readonly SignalAdapterDedupeKeyField[];
  readonly coverageComplete: boolean;
  readonly duplicateEvidencePolicy: 'dedupe-by-check-evidence-envelope';
  readonly duplicateRelationshipCandidateOnly: true;
  readonly passOutcomeMayMarkSafe: false;
  readonly relationshipDetectionIncluded: false;
  readonly fusionIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
}

export interface SignalAdapterRegistryDescriptor {
  readonly version: typeof SIGNAL_ADAPTER_REGISTRY_VERSION;
  readonly signalExtractorContractVersion:
    typeof SIGNAL_EXTRACTOR_CONTRACT_VERSION;
  readonly signalRelationshipContractVersion:
    typeof SIGNAL_RELATIONSHIP_CONTRACT_VERSION;
  readonly sourceCheckKinds: readonly SignalAdapterSourceCheckKind[];
  readonly triggerOutcomes: readonly SignalAdapterTriggerOutcome[];
  readonly dedupeKeyFields: readonly SignalAdapterDedupeKeyField[];
  readonly builtInAdapterCount: number;
  readonly coverageComplete: true;
  readonly passOutcomeMayMarkSafe: false;
  readonly duplicateEvidencePolicy:
    'dedupe-by-check-evidence-envelope';
  readonly duplicateRelationshipCandidateOnly: true;
  readonly relationshipDetectionIncluded: false;
  readonly fusionIncluded: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

function normalizeId(value: string, fieldName: string): string {
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/u.test(value)) {
    throw new Error(`Signal adapter registry ${fieldName} must be a stable lowercase id.`);
  }
  return value;
}

function normalizeSourceCheckKind(
  value: SignalAdapterSourceCheckKind,
): SignalAdapterSourceCheckKind {
  if (!SIGNAL_ADAPTER_SOURCE_CHECK_KINDS.includes(value)) {
    throw new Error('Signal adapter registry sourceCheckKind must be a known admission check kind.');
  }
  return value;
}

function normalizeTriggerOutcomes(
  values: readonly SignalAdapterTriggerOutcome[] | undefined,
): readonly SignalAdapterTriggerOutcome[] {
  const outcomes = values ?? SIGNAL_ADAPTER_TRIGGER_OUTCOMES;
  if (outcomes.length === 0) {
    throw new Error('Signal adapter registry triggerOutcomes must not be empty.');
  }
  for (const outcome of outcomes) {
    if ((outcome as ConsequenceAdmissionCheckOutcome) === 'pass') {
      throw new Error('Signal adapter registry pass outcome must not emit a safe signal.');
    }
    if (!SIGNAL_ADAPTER_TRIGGER_OUTCOMES.includes(outcome)) {
      throw new Error('Signal adapter registry triggerOutcomes must be warn, fail, or not-applicable.');
    }
  }
  return Object.freeze([...new Set(outcomes)].sort());
}

function assertExtractorMatchesRegistration<Category extends SignalCategory>(
  input: CreateSignalAdapterRegistrationInput<Category>,
): void {
  if (!input.extractor.allowedKinds.includes(input.signalKind)) {
    throw new Error('Signal adapter registry signalKind must be declared by extractor.allowedKinds.');
  }
  if (input.signalKind === 'hard_floor' && !input.extractor.canEmitHardFloor) {
    throw new Error('Signal adapter registry hard_floor adapters require tier-1 hard-floor extractors.');
  }
  if (
    input.extractor.grantsAuthority !== false ||
    input.extractor.activatesEnforcement !== false ||
    input.extractor.autoEnforce !== false ||
    input.extractor.productionReady !== false ||
    input.extractor.readsRawPayload !== false
  ) {
    throw new Error('Signal adapter registry extractor must preserve no-authority and no-raw-payload invariants.');
  }
}

export function createSignalAdapterRegistration<
  Category extends SignalCategory,
>(
  input: CreateSignalAdapterRegistrationInput<Category>,
): SignalAdapterRegistration<Category> {
  assertExtractorMatchesRegistration(input);
  return Object.freeze({
    version: SIGNAL_ADAPTER_REGISTRY_VERSION,
    adapterId: normalizeId(input.adapterId, 'adapterId'),
    sourceCheckKind: normalizeSourceCheckKind(input.sourceCheckKind),
    extractor: input.extractor,
    signalCategory: input.extractor.category,
    signalKind: input.signalKind,
    triggerOutcomes: normalizeTriggerOutcomes(input.triggerOutcomes),
    evidenceRefKind: input.evidenceRefKind,
    readModelKind: input.readModelKind,
    dedupeKeyFields: SIGNAL_ADAPTER_DEDUPE_KEY_FIELDS,
    duplicateEvidenceRelationshipCandidate: 'duplicates',
    passOutcomeMayMarkSafe: false,
    relationshipDetectionIncluded: false,
    fusionIncluded: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

function registrationSignature(registration: SignalAdapterRegistration): string {
  return [
    registration.signalCategory,
    registration.signalKind,
    registration.evidenceRefKind,
    registration.readModelKind,
  ].join(':');
}

export function createSignalAdapterRegistry(
  registrations: readonly SignalAdapterRegistration[],
): SignalAdapterRegistry {
  if (registrations.length === 0) {
    throw new Error('Signal adapter registry must include at least one registration.');
  }
  const adapterIds = new Set<string>();
  const checkKinds = new Set<SignalAdapterSourceCheckKind>();
  const signatures = new Set<string>();

  for (const registration of registrations) {
    if (adapterIds.has(registration.adapterId)) {
      throw new Error('Signal adapter registry adapterId values must be unique.');
    }
    adapterIds.add(registration.adapterId);
    if (checkKinds.has(registration.sourceCheckKind)) {
      throw new Error('Signal adapter registry v1 allows one registration per source check kind.');
    }
    checkKinds.add(registration.sourceCheckKind);
    const signature = registrationSignature(registration);
    if (signatures.has(signature)) {
      throw new Error('Signal adapter registry duplicate adapter signatures would double-count evidence.');
    }
    signatures.add(signature);
  }

  const sourceCheckKindsCovered = Object.freeze(
    [...checkKinds].sort(),
  ) as readonly SignalAdapterSourceCheckKind[];
  const coverageComplete = SIGNAL_ADAPTER_SOURCE_CHECK_KINDS.every((kind) =>
    checkKinds.has(kind)
  );

  return Object.freeze({
    version: SIGNAL_ADAPTER_REGISTRY_VERSION,
    signalExtractorContractVersion: SIGNAL_EXTRACTOR_CONTRACT_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    registrations: Object.freeze([...registrations]),
    sourceCheckKindsCovered,
    triggerOutcomes: SIGNAL_ADAPTER_TRIGGER_OUTCOMES,
    dedupeKeyFields: SIGNAL_ADAPTER_DEDUPE_KEY_FIELDS,
    coverageComplete,
    duplicateEvidencePolicy: 'dedupe-by-check-evidence-envelope',
    duplicateRelationshipCandidateOnly: true,
    passOutcomeMayMarkSafe: false,
    relationshipDetectionIncluded: false,
    fusionIncluded: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

function builtinRegistration<Category extends SignalCategory>(
  input: Omit<CreateSignalAdapterRegistrationInput<Category>, 'extractor'> & {
    readonly extractorId: string;
    readonly sourcePlane: SignalSourcePlane;
    readonly category: Category;
    readonly authorityMode: SignalAuthorityMode;
    readonly allowedKinds: readonly SignalKindForCategory<Category>[];
    readonly readsReadModelRefs?: boolean;
  },
): SignalAdapterRegistration<Category> {
  return createSignalAdapterRegistration({
    adapterId: input.adapterId,
    sourceCheckKind: input.sourceCheckKind,
    extractor: createSignalExtractorDeclaration({
      extractorId: input.extractorId,
      sourcePlane: input.sourcePlane,
      category: input.category,
      authorityMode: input.authorityMode,
      allowedKinds: input.allowedKinds,
      readsReadModelRefs: input.readsReadModelRefs ?? true,
    }),
    signalKind: input.signalKind,
    triggerOutcomes: input.triggerOutcomes,
    evidenceRefKind: input.evidenceRefKind,
    readModelKind: input.readModelKind,
  });
}

export const BUILTIN_SIGNAL_ADAPTER_REGISTRATIONS = Object.freeze([
  builtinRegistration({
    adapterId: 'consequence-admission.policy-check.adapter',
    extractorId: 'consequence-admission.policy-check.extractor',
    sourceCheckKind: 'policy',
    sourcePlane: 'policy-foundry',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['policy_gap'],
    signalKind: 'policy_gap',
    evidenceRefKind: 'evidence',
    readModelKind: 'policy',
  }),
  builtinRegistration({
    adapterId: 'consequence-admission.authority-check.adapter',
    extractorId: 'consequence-admission.authority-check.extractor',
    sourceCheckKind: 'authority',
    sourcePlane: 'policy-foundry',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['authority_gap'],
    signalKind: 'authority_gap',
    evidenceRefKind: 'authority',
    readModelKind: 'policy',
  }),
  builtinRegistration({
    adapterId: 'consequence-admission.evidence-check.adapter',
    extractorId: 'consequence-admission.evidence-check.extractor',
    sourceCheckKind: 'evidence',
    sourcePlane: 'policy-foundry',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['evidence_gap'],
    signalKind: 'evidence_gap',
    evidenceRefKind: 'evidence',
    readModelKind: 'policy',
  }),
  builtinRegistration({
    adapterId: 'consequence-admission.freshness-check.adapter',
    extractorId: 'consequence-admission.freshness-check.extractor',
    sourceCheckKind: 'freshness',
    sourcePlane: 'temporal-trajectory',
    category: 'gap',
    authorityMode: 'advisory',
    allowedKinds: ['freshness_gap'],
    signalKind: 'freshness_gap',
    evidenceRefKind: 'trace',
    readModelKind: 'trajectory',
  }),
  builtinRegistration({
    adapterId: 'consequence-admission.enforcement-check.adapter',
    extractorId: 'consequence-admission.enforcement-check.extractor',
    sourceCheckKind: 'enforcement',
    sourcePlane: 'tier-1-hard-gate',
    category: 'verdict',
    authorityMode: 'advisory',
    allowedKinds: ['hazard'],
    signalKind: 'hazard',
    evidenceRefKind: 'trace',
    readModelKind: 'policy',
  }),
  builtinRegistration({
    adapterId: 'consequence-admission.adapter-readiness-check.adapter',
    extractorId: 'consequence-admission.adapter-readiness-check.extractor',
    sourceCheckKind: 'adapter-readiness',
    sourcePlane: 'assurance-measurement',
    category: 'measurement',
    authorityMode: 'measurement-only',
    allowedKinds: ['measurement_degraded_signal'],
    signalKind: 'measurement_degraded_signal',
    evidenceRefKind: 'trace',
    readModelKind: 'measurement',
  }),
]);

export function createBuiltinSignalAdapterRegistry(): SignalAdapterRegistry {
  return createSignalAdapterRegistry(BUILTIN_SIGNAL_ADAPTER_REGISTRATIONS);
}

export function signalAdapterRegistryDescriptor(): SignalAdapterRegistryDescriptor {
  const registry = createBuiltinSignalAdapterRegistry();
  return Object.freeze({
    version: SIGNAL_ADAPTER_REGISTRY_VERSION,
    signalExtractorContractVersion: SIGNAL_EXTRACTOR_CONTRACT_VERSION,
    signalRelationshipContractVersion: SIGNAL_RELATIONSHIP_CONTRACT_VERSION,
    sourceCheckKinds: SIGNAL_ADAPTER_SOURCE_CHECK_KINDS,
    triggerOutcomes: SIGNAL_ADAPTER_TRIGGER_OUTCOMES,
    dedupeKeyFields: SIGNAL_ADAPTER_DEDUPE_KEY_FIELDS,
    builtInAdapterCount: registry.registrations.length,
    coverageComplete: true,
    passOutcomeMayMarkSafe: false,
    duplicateEvidencePolicy: 'dedupe-by-check-evidence-envelope',
    duplicateRelationshipCandidateOnly: true,
    relationshipDetectionIncluded: false,
    fusionIncluded: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-runtime-adaptation',
      'not-relationship-detection',
      'not-fusion',
      'not-live-enforcement',
      'not-safe-signal-from-pass',
      'not-production-ready',
    ]),
  });
}
