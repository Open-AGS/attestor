import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionConsequenceKind,
  ConsequenceAdmissionResponse,
} from './index.js';
import {
  createConsequenceAdmissionDownstreamContract,
  evaluateConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionDownstreamDecision,
  type CreateConsequenceAdmissionDownstreamContractInput,
} from './downstream-enforcement-contract.js';

export const CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION =
  'attestor.consequence-admission-presentation-binding.v1';

export const CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS = [
  'admission-id',
  'admission-digest',
  'contract-id',
  'enforcement-point-id',
  'downstream-system',
  'policy-ref',
  'consequence-kind',
  'target-uri',
  'target-ref',
  'method',
  'body-digest',
  'replay-key',
  'nonce',
  'proof-ref',
  'constraint-acknowledgement',
  'freshness-window',
] as const;
export type ConsequenceAdmissionPresentationBindingField =
  typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS[number];

export const CONSEQUENCE_ADMISSION_PRESENTATION_FAILURE_REASONS = [
  'admission-id-mismatch',
  'admission-digest-mismatch',
  'contract-id-mismatch',
  'enforcement-point-mismatch',
  'downstream-system-mismatch',
  'policy-ref-mismatch',
  'consequence-kind-mismatch',
  'target-uri-mismatch',
  'target-ref-mismatch',
  'method-mismatch',
  'body-digest-mismatch',
  'body-digest-missing',
  'replay-key-missing',
  'replay-key-reused',
  'nonce-missing',
  'nonce-mismatch',
  'presentation-not-yet-valid',
  'presentation-expired',
  'freshness-window-too-long',
  'proof-ref-missing',
  'constraint-acknowledgement-missing',
  'downstream-contract-held',
] as const;
export type ConsequenceAdmissionPresentationFailureReason =
  typeof CONSEQUENCE_ADMISSION_PRESENTATION_FAILURE_REASONS[number];

export type ConsequenceAdmissionPresentationOutcome = 'allow' | 'hold';

export interface ConsequenceAdmissionPresentationTarget {
  readonly uri: string | null;
  readonly targetRef: string | null;
  readonly method: string | null;
  readonly bodyDigest: string | null;
}

export interface ConsequenceAdmissionPresentationBinding {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION;
  readonly bindingId: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly contractId: string;
  readonly enforcementPointId: string;
  readonly downstreamSystem: string;
  readonly policyRef: string | null;
  readonly consequenceKind: ConsequenceAdmissionConsequenceKind;
  readonly target: ConsequenceAdmissionPresentationTarget;
  readonly replayKey: string | null;
  readonly nonce: string | null;
  readonly presentedAt: string;
  readonly expiresAt: string;
  readonly proofRefIds: readonly string[];
  readonly acceptedConstraintIds: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateConsequenceAdmissionPresentationBindingInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly downstreamSystem?: string | null;
  readonly policyRef?: string | null;
  readonly consequenceKind?: ConsequenceAdmissionConsequenceKind | null;
  readonly target: Partial<ConsequenceAdmissionPresentationTarget>;
  readonly replayKey?: string | null;
  readonly nonce?: string | null;
  readonly presentedAt: string;
  readonly expiresAt: string;
  readonly proofRefIds?: readonly string[];
  readonly acceptedConstraintIds?: readonly string[];
}

export interface ConsequenceAdmissionPresentationExpectation {
  readonly targetUri?: string | null;
  readonly targetRef?: string | null;
  readonly method?: string | null;
  readonly bodyDigest?: string | null;
  readonly nonce?: string | null;
  readonly requireBodyDigest?: boolean | null;
  readonly requireReplayKey?: boolean | null;
  readonly requireNonce?: boolean | null;
  readonly maxFreshnessSeconds?: number | null;
  readonly usedReplayKeys?: readonly string[];
}

export interface EvaluateConsequenceAdmissionPresentationBindingInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly presentation: ConsequenceAdmissionPresentationBinding;
  readonly expected?: ConsequenceAdmissionPresentationExpectation | null;
  readonly now?: string | null;
}

export interface ConsequenceAdmissionPresentationDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION;
  readonly outcome: ConsequenceAdmissionPresentationOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly bindingId: string;
  readonly bindingDigest: string;
  readonly contractId: string;
  readonly enforcementPointId: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
  readonly failureReasons: readonly ConsequenceAdmissionPresentationFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly reason: string;
  readonly instruction: string;
  readonly receiptDigest: string;
}

export interface ConsequenceAdmissionPresentationBindingDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION;
  readonly bindingFields: typeof CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS;
  readonly failureReasons: typeof CONSEQUENCE_ADMISSION_PRESENTATION_FAILURE_REASONS;
  readonly executableOutcomes: readonly ['allow'];
  readonly heldOutcomes: readonly ['hold'];
  readonly cryptographicPresentationVerification: false;
  readonly replayLedgerIncluded: false;
  readonly failClosed: true;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission presentation binding ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(
      `Consequence admission presentation binding ${fieldName} requires a non-empty value.`,
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

function normalizeOptionalMethod(value: string | null | undefined): string | null {
  const method = normalizeOptionalIdentifier(value, 'target.method');
  return method === null ? null : method.toUpperCase();
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(
      `Consequence admission presentation binding ${fieldName} must be an ISO timestamp.`,
    );
  }
  return timestamp.toISOString();
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Consequence admission presentation binding ${fieldName} must be a positive integer.`,
    );
  }
  return value;
}

function uniqueIdentifiers(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  return Object.freeze(
    Array.from(new Set(values.map((value) => normalizeIdentifier(value, fieldName)))).sort(),
  );
}

function resolveContract(
  value:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput,
): ConsequenceAdmissionDownstreamContract {
  return 'version' in value &&
    value.version === 'attestor.consequence-admission-downstream-contract.v1'
    ? value
    : createConsequenceAdmissionDownstreamContract(value);
}

function canonicalObject<T extends CanonicalReleaseJsonValue>(value: T): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function bindingCanonicalPayload(
  binding: Omit<ConsequenceAdmissionPresentationBinding, 'bindingId' | 'canonical' | 'digest'>,
): CanonicalReleaseJsonValue {
  return {
    version: binding.version,
    admissionId: binding.admissionId,
    admissionDigest: binding.admissionDigest,
    contractId: binding.contractId,
    enforcementPointId: binding.enforcementPointId,
    downstreamSystem: binding.downstreamSystem,
    policyRef: binding.policyRef,
    consequenceKind: binding.consequenceKind,
    target: binding.target,
    replayKey: binding.replayKey,
    nonce: binding.nonce,
    presentedAt: binding.presentedAt,
    expiresAt: binding.expiresAt,
    proofRefIds: binding.proofRefIds,
    acceptedConstraintIds: binding.acceptedConstraintIds,
  } as unknown as CanonicalReleaseJsonValue;
}

function presentationDecisionDigest(input: {
  readonly presentation: ConsequenceAdmissionPresentationBinding;
  readonly now: string;
  readonly outcome: ConsequenceAdmissionPresentationOutcome;
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
  readonly failureReasons: readonly ConsequenceAdmissionPresentationFailureReason[];
}): string {
  return canonicalObject({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
    bindingId: input.presentation.bindingId,
    bindingDigest: input.presentation.digest,
    admissionId: input.presentation.admissionId,
    admissionDigest: input.presentation.admissionDigest,
    contractId: input.presentation.contractId,
    enforcementPointId: input.presentation.enforcementPointId,
    now: input.now,
    outcome: input.outcome,
    downstreamOutcome: input.downstreamDecision.outcome,
    failureReasons: input.failureReasons,
  } as CanonicalReleaseJsonValue).digest;
}

function orderedFailureReasons(
  reasons: readonly ConsequenceAdmissionPresentationFailureReason[],
): readonly ConsequenceAdmissionPresentationFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_ADMISSION_PRESENTATION_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function reasonFor(
  outcome: ConsequenceAdmissionPresentationOutcome,
  failureReasons: readonly ConsequenceAdmissionPresentationFailureReason[],
): string {
  if (outcome === 'allow') {
    return 'Downstream presentation binding allowed the consequence because the admission, contract, target, replay, proof, constraints, and freshness bindings matched.';
  }
  if (failureReasons.includes('replay-key-reused')) {
    return 'Downstream presentation binding held the consequence because the replay key was already observed.';
  }
  if (failureReasons.includes('presentation-expired')) {
    return 'Downstream presentation binding held the consequence because the presentation is outside its freshness window.';
  }
  if (failureReasons.includes('target-uri-mismatch') || failureReasons.includes('target-ref-mismatch')) {
    return 'Downstream presentation binding held the consequence because the presented target does not match the enforcement point target.';
  }
  if (failureReasons.includes('body-digest-mismatch') || failureReasons.includes('body-digest-missing')) {
    return 'Downstream presentation binding held the consequence because the action body is not bound to the admitted consequence.';
  }
  if (failureReasons.includes('downstream-contract-held')) {
    return 'Downstream presentation binding held the consequence because the downstream enforcement contract did not allow it.';
  }
  return 'Downstream presentation binding held the consequence because required execution bindings were not satisfied.';
}

function defaultNow(): string {
  return new Date().toISOString();
}

function proofRefIdsFor(admission: ConsequenceAdmissionResponse): readonly string[] {
  return Object.freeze(admission.proof.map((proof) => proof.id).sort());
}

function requiredProofIdsMissing(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract: ConsequenceAdmissionDownstreamContract;
  readonly presentation: ConsequenceAdmissionPresentationBinding;
}): boolean {
  if (!input.contract.requireProof) return false;
  if (!input.admission.allowed) return false;
  const presented = new Set(input.presentation.proofRefIds);
  return input.admission.proof.some((proof) => !presented.has(proof.id));
}

function requiredConstraintIdsMissing(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract: ConsequenceAdmissionDownstreamContract;
  readonly presentation: ConsequenceAdmissionPresentationBinding;
}): boolean {
  if (!input.contract.requireConstraintAcknowledgement) return false;
  if (input.admission.decision !== 'narrow') return false;
  const accepted = new Set(input.presentation.acceptedConstraintIds);
  return input.admission.constraints.some((constraint) => !accepted.has(constraint.id));
}

export function createConsequenceAdmissionPresentationBinding(
  input: CreateConsequenceAdmissionPresentationBindingInput,
): ConsequenceAdmissionPresentationBinding {
  const contract = resolveContract(input.contract);
  const presentedAt = normalizeIsoTimestamp(input.presentedAt, 'presentedAt');
  const expiresAt = normalizeIsoTimestamp(input.expiresAt, 'expiresAt');
  if (new Date(expiresAt).getTime() <= new Date(presentedAt).getTime()) {
    throw new Error(
      'Consequence admission presentation binding expiresAt must be after presentedAt.',
    );
  }

  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
    admissionId: input.admission.admissionId,
    admissionDigest: input.admission.digest,
    contractId: contract.contractId,
    enforcementPointId: contract.enforcementPointId,
    downstreamSystem: normalizeOptionalIdentifier(input.downstreamSystem, 'downstreamSystem') ??
      input.admission.request.proposedConsequence.downstreamSystem,
    policyRef: normalizeOptionalIdentifier(input.policyRef, 'policyRef') ??
      input.admission.request.policyScope.policyRef,
    consequenceKind: input.consequenceKind ??
      input.admission.request.proposedConsequence.consequenceKind,
    target: Object.freeze({
      uri: normalizeOptionalIdentifier(input.target.uri, 'target.uri'),
      targetRef: normalizeOptionalIdentifier(input.target.targetRef, 'target.targetRef'),
      method: normalizeOptionalMethod(input.target.method),
      bodyDigest: normalizeOptionalIdentifier(input.target.bodyDigest, 'target.bodyDigest'),
    }),
    replayKey: normalizeOptionalIdentifier(input.replayKey, 'replayKey'),
    nonce: normalizeOptionalIdentifier(input.nonce, 'nonce'),
    presentedAt,
    expiresAt,
    proofRefIds: uniqueIdentifiers(
      input.proofRefIds ?? proofRefIdsFor(input.admission),
      'proofRefIds[]',
    ),
    acceptedConstraintIds: uniqueIdentifiers(
      input.acceptedConstraintIds ?? [],
      'acceptedConstraintIds[]',
    ),
  } satisfies Omit<
    ConsequenceAdmissionPresentationBinding,
    'bindingId' | 'canonical' | 'digest'
  >);
  const bindingId = canonicalObject({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
    admissionId: base.admissionId,
    admissionDigest: base.admissionDigest,
    contractId: base.contractId,
    enforcementPointId: base.enforcementPointId,
    downstreamSystem: base.downstreamSystem,
    replayKey: base.replayKey,
    nonce: base.nonce,
    target: base.target,
    presentedAt: base.presentedAt,
    expiresAt: base.expiresAt,
  } as CanonicalReleaseJsonValue).digest;
  const canonical = canonicalObject(bindingCanonicalPayload(base));

  return Object.freeze({
    ...base,
    bindingId,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function evaluateConsequenceAdmissionPresentationBinding(
  input: EvaluateConsequenceAdmissionPresentationBindingInput,
): ConsequenceAdmissionPresentationDecision {
  const contract = resolveContract(input.contract);
  const presentation = input.presentation;
  const expected = input.expected ?? null;
  const now = normalizeIsoTimestamp(input.now ?? defaultNow(), 'now');
  const downstreamDecision = evaluateConsequenceAdmissionDownstreamContract({
    admission: input.admission,
    contract,
    observation: {
      downstreamSystem: presentation.downstreamSystem,
      consequenceKind: presentation.consequenceKind,
      policyRef: presentation.policyRef,
      idempotencyKey: presentation.replayKey,
      acceptedConstraintIds: presentation.acceptedConstraintIds,
    },
  });
  const requireReplayKey = expected?.requireReplayKey ?? contract.requireIdempotencyKey;
  const requireBodyDigest = expected?.requireBodyDigest ?? false;
  const requireNonce = expected?.requireNonce ?? false;
  const maxFreshnessSeconds = normalizePositiveInteger(
    expected?.maxFreshnessSeconds,
    'expected.maxFreshnessSeconds',
  );
  const expectedMethod = normalizeOptionalMethod(expected?.method);
  const expectedTargetUri = normalizeOptionalIdentifier(
    expected?.targetUri,
    'expected.targetUri',
  );
  const expectedTargetRef = normalizeOptionalIdentifier(
    expected?.targetRef,
    'expected.targetRef',
  );
  const expectedBodyDigest = normalizeOptionalIdentifier(
    expected?.bodyDigest,
    'expected.bodyDigest',
  );
  const expectedNonce = normalizeOptionalIdentifier(expected?.nonce, 'expected.nonce');
  const presentedAtMs = new Date(presentation.presentedAt).getTime();
  const expiresAtMs = new Date(presentation.expiresAt).getTime();
  const nowMs = new Date(now).getTime();
  const freshnessSeconds = Math.ceil((expiresAtMs - presentedAtMs) / 1000);

  const failures = orderedFailureReasons([
    ...(presentation.admissionId !== input.admission.admissionId
      ? ['admission-id-mismatch' as const]
      : []),
    ...(presentation.admissionDigest !== input.admission.digest
      ? ['admission-digest-mismatch' as const]
      : []),
    ...(presentation.contractId !== contract.contractId ? ['contract-id-mismatch' as const] : []),
    ...(presentation.enforcementPointId !== contract.enforcementPointId
      ? ['enforcement-point-mismatch' as const]
      : []),
    ...(!contract.downstreamSystems.includes(presentation.downstreamSystem)
      ? ['downstream-system-mismatch' as const]
      : []),
    ...(contract.policyRefs.length > 0 &&
      (presentation.policyRef === null || !contract.policyRefs.includes(presentation.policyRef))
      ? ['policy-ref-mismatch' as const]
      : []),
    ...(!contract.acceptedConsequenceKinds.includes(presentation.consequenceKind)
      ? ['consequence-kind-mismatch' as const]
      : []),
    ...(expectedTargetUri !== null && presentation.target.uri !== expectedTargetUri
      ? ['target-uri-mismatch' as const]
      : []),
    ...(expectedTargetRef !== null && presentation.target.targetRef !== expectedTargetRef
      ? ['target-ref-mismatch' as const]
      : []),
    ...(expectedMethod !== null && presentation.target.method !== expectedMethod
      ? ['method-mismatch' as const]
      : []),
    ...(requireBodyDigest && presentation.target.bodyDigest === null
      ? ['body-digest-missing' as const]
      : []),
    ...(expectedBodyDigest !== null && presentation.target.bodyDigest !== expectedBodyDigest
      ? ['body-digest-mismatch' as const]
      : []),
    ...(requireReplayKey && presentation.replayKey === null
      ? ['replay-key-missing' as const]
      : []),
    ...(presentation.replayKey !== null &&
      (expected?.usedReplayKeys ?? []).includes(presentation.replayKey)
      ? ['replay-key-reused' as const]
      : []),
    ...(requireNonce && presentation.nonce === null ? ['nonce-missing' as const] : []),
    ...(expectedNonce !== null && presentation.nonce !== expectedNonce
      ? ['nonce-mismatch' as const]
      : []),
    ...(nowMs < presentedAtMs ? ['presentation-not-yet-valid' as const] : []),
    ...(nowMs > expiresAtMs ? ['presentation-expired' as const] : []),
    ...(maxFreshnessSeconds !== null && freshnessSeconds > maxFreshnessSeconds
      ? ['freshness-window-too-long' as const]
      : []),
    ...(requiredProofIdsMissing({
      admission: input.admission,
      contract,
      presentation,
    })
      ? ['proof-ref-missing' as const]
      : []),
    ...(requiredConstraintIdsMissing({
      admission: input.admission,
      contract,
      presentation,
    })
      ? ['constraint-acknowledgement-missing' as const]
      : []),
    ...(!downstreamDecision.allowed ? ['downstream-contract-held' as const] : []),
  ]);
  const outcome: ConsequenceAdmissionPresentationOutcome =
    failures.length === 0 ? 'allow' : 'hold';
  const receiptDigest = presentationDecisionDigest({
    presentation,
    now,
    outcome,
    downstreamDecision,
    failureReasons: failures,
  });

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
    outcome,
    allowed: outcome === 'allow',
    failClosed: outcome !== 'allow',
    bindingId: presentation.bindingId,
    bindingDigest: presentation.digest,
    contractId: contract.contractId,
    enforcementPointId: contract.enforcementPointId,
    admissionId: input.admission.admissionId,
    admissionDigest: input.admission.digest,
    downstreamDecision,
    failureReasons: failures,
    reasonCodes: Object.freeze([
      ...downstreamDecision.reasonCodes,
      ...failures.map((reason) => `presentation-binding-${reason}`),
      `presentation-binding-${outcome}`,
    ]),
    reason: reasonFor(outcome, failures),
    instruction: outcome === 'allow'
      ? `Present consequence to enforcement point: ${contract.enforcementPointId}`
      : `Do not present consequence to enforcement point: ${contract.enforcementPointId}`,
    receiptDigest,
  });
}

export function consequenceAdmissionPresentationBindingDescriptor():
ConsequenceAdmissionPresentationBindingDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_VERSION,
    bindingFields: CONSEQUENCE_ADMISSION_PRESENTATION_BINDING_FIELDS,
    failureReasons: CONSEQUENCE_ADMISSION_PRESENTATION_FAILURE_REASONS,
    executableOutcomes: ['allow'] as const,
    heldOutcomes: ['hold'] as const,
    cryptographicPresentationVerification: false,
    replayLedgerIncluded: false,
    failClosed: true,
  });
}
