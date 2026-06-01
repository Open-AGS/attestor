import {
  createHash,
} from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionConsequenceKind,
  ConsequenceAdmissionConstraint,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionProofRef,
  ConsequenceAdmissionProposedConsequence,
  ConsequenceAdmissionResponse,
} from './index.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
  consequenceAdmissionDomainsForKind,
  type ConsequenceAdmissionDomain,
} from './taxonomy.js';
import {
  CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS,
  type ConsequenceAdmissionConstraintKind,
} from './constraint-kinds.js';

export const CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION =
  'attestor.consequence-admission-downstream-contract.v1';

export const CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS = [
  'http-handler',
  'message-consumer',
  'record-writer',
  'communication-sender',
  'action-dispatcher',
  'wallet-adapter',
  'payment-adapter',
  'artifact-exporter',
  'custom',
] as const;
export type ConsequenceAdmissionDownstreamBoundaryKind =
  typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS[number];

export const CONSEQUENCE_ADMISSION_DOWNSTREAM_BINDING_FIELDS = [
  'admission-id',
  'admission-digest',
  'decision',
  'consequence-domain',
  'consequence-kind',
  'risk-class',
  'downstream-system',
  'policy-ref',
  'proof-ref',
  'idempotency-key',
  'constraint-acknowledgement',
] as const;
export type ConsequenceAdmissionDownstreamBindingField =
  typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_BINDING_FIELDS[number];

export const CONSEQUENCE_ADMISSION_DOWNSTREAM_FAILURE_REASONS = [
  'admission-not-allowed',
  'admission-fail-closed',
  'decision-not-executable',
  'proof-missing',
  'required-check-failed',
  'consequence-domain-mismatch',
  'consequence-kind-mismatch',
  'risk-class-mismatch',
  'downstream-system-mismatch',
  'policy-ref-mismatch',
  'idempotency-key-missing',
  'narrow-constraints-unacknowledged',
  'custom-domain-unscoped',
] as const;
export type ConsequenceAdmissionDownstreamFailureReason =
  typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_FAILURE_REASONS[number];

export type ConsequenceAdmissionDownstreamOutcome = 'allow' | 'hold';

export interface ConsequenceAdmissionDownstreamContract {
  readonly version: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION;
  readonly contractId: string;
  readonly enforcementPointId: string;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly consequenceDomain: ConsequenceAdmissionDomain;
  readonly downstreamSystems: readonly string[];
  readonly acceptedConsequenceKinds: readonly ConsequenceAdmissionConsequenceKind[];
  readonly acceptedRiskClasses: readonly ConsequenceAdmissionProposedConsequence['riskClass'][];
  readonly policyRefs: readonly string[];
  readonly environment: string | null;
  readonly requireProof: boolean;
  readonly requireIdempotencyKey: boolean;
  readonly requireConstraintAcknowledgement: boolean;
  readonly failClosed: true;
}

export interface CreateConsequenceAdmissionDownstreamContractInput {
  readonly contractId?: string | null;
  readonly enforcementPointId: string;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly consequenceDomain: ConsequenceAdmissionDomain;
  readonly downstreamSystems: readonly string[];
  readonly acceptedConsequenceKinds: readonly ConsequenceAdmissionConsequenceKind[];
  readonly acceptedRiskClasses?: readonly ConsequenceAdmissionProposedConsequence['riskClass'][];
  readonly policyRefs?: readonly string[];
  readonly environment?: string | null;
  readonly requireProof?: boolean | null;
  readonly requireIdempotencyKey?: boolean | null;
  readonly requireConstraintAcknowledgement?: boolean | null;
}

export interface ConsequenceAdmissionDownstreamObservation {
  readonly downstreamSystem?: string | null;
  readonly consequenceKind?: ConsequenceAdmissionConsequenceKind | null;
  readonly riskClass?: ConsequenceAdmissionProposedConsequence['riskClass'] | null;
  readonly policyRef?: string | null;
  readonly idempotencyKey?: string | null;
  readonly acceptedConstraintIds?: readonly string[];
}

export interface ConsequenceAdmissionDownstreamConstraintRef {
  readonly kind: ConsequenceAdmissionConstraintKind;
  readonly parameterDigest: string | null;
  readonly idDigest: string;
  readonly constraintDigest: string;
}

export interface EvaluateConsequenceAdmissionDownstreamContractInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract: ConsequenceAdmissionDownstreamContract;
  readonly observation?: ConsequenceAdmissionDownstreamObservation | null;
}

export interface ConsequenceAdmissionDownstreamDecision {
  readonly version: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION;
  readonly outcome: ConsequenceAdmissionDownstreamOutcome;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly contractId: string;
  readonly enforcementPointId: string;
  readonly boundaryKind: ConsequenceAdmissionDownstreamBoundaryKind;
  readonly consequenceDomain: ConsequenceAdmissionDomain;
  readonly downstreamSystem: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly proofRequired: boolean;
  readonly proofSatisfied: boolean;
  readonly idempotencyRequired: boolean;
  readonly idempotencySatisfied: boolean;
  readonly constraintsRequired: boolean;
  readonly constraintsSatisfied: boolean;
  readonly proofRefs: readonly ConsequenceAdmissionProofRef[];
  readonly constraintRefs: readonly ConsequenceAdmissionDownstreamConstraintRef[];
  readonly failureReasons: readonly ConsequenceAdmissionDownstreamFailureReason[];
  readonly reasonCodes: readonly string[];
  readonly reason: string;
  readonly instruction: string;
}

export interface ConsequenceAdmissionDownstreamContractDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION;
  readonly boundaryKinds: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS;
  readonly bindingFields: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_BINDING_FIELDS;
  readonly executableDecisions: readonly ['admit', 'narrow'];
  readonly holdDecisions: readonly ['review', 'block'];
  readonly consequenceDomains: typeof CONSEQUENCE_ADMISSION_DOMAINS;
  readonly failureReasons: typeof CONSEQUENCE_ADMISSION_DOWNSTREAM_FAILURE_REASONS;
  readonly decisionExposesRawConstraints: false;
  readonly decisionConstraintReferenceMode: 'digests-only';
  readonly executionProofExcludesAdmissionReceipt: true;
  readonly constraintKinds: typeof CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS;
  readonly failClosed: true;
}

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission downstream contract ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Consequence admission downstream contract ${fieldName} requires a non-empty value.`);
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

function uniqueIdentifiers(
  values: readonly string[],
  fieldName: string,
): readonly string[] {
  const normalized = values.map((value) => normalizeIdentifier(value, fieldName));
  return Object.freeze(Array.from(new Set(normalized)).sort());
}

function uniqueValues<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze(Array.from(new Set(values)).sort());
}

function includesValue<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function assertBoundaryKind(value: ConsequenceAdmissionDownstreamBoundaryKind): void {
  if (!includesValue(CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS, value)) {
    throw new Error(
      `Consequence admission downstream contract boundaryKind must be one of: ${CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS.join(', ')}.`,
    );
  }
}

function assertDomain(value: ConsequenceAdmissionDomain): void {
  if (!includesValue(CONSEQUENCE_ADMISSION_DOMAINS, value)) {
    throw new Error(
      `Consequence admission downstream contract consequenceDomain must be one of: ${CONSEQUENCE_ADMISSION_DOMAINS.join(', ')}.`,
    );
  }
}

function contractIdFor(
  input: Omit<ConsequenceAdmissionDownstreamContract, 'contractId'>,
): string {
  const payload = JSON.stringify({
    version: input.version,
    enforcementPointId: input.enforcementPointId,
    boundaryKind: input.boundaryKind,
    consequenceDomain: input.consequenceDomain,
    downstreamSystems: input.downstreamSystems,
    acceptedConsequenceKinds: input.acceptedConsequenceKinds,
    acceptedRiskClasses: input.acceptedRiskClasses,
    policyRefs: input.policyRefs,
    environment: input.environment,
    requireProof: input.requireProof,
    requireIdempotencyKey: input.requireIdempotencyKey,
    requireConstraintAcknowledgement: input.requireConstraintAcknowledgement,
    failClosed: input.failClosed,
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

function digestCanonical(value: CanonicalReleaseJsonValue): string {
  return `sha256:${createHash('sha256').update(canonicalizeReleaseJson(value)).digest('hex')}`;
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function constraintRef(
  constraint: ConsequenceAdmissionConstraint,
): ConsequenceAdmissionDownstreamConstraintRef {
  return Object.freeze({
    kind: constraint.kind,
    parameterDigest: constraint.parameterDigest,
    idDigest: digestText(constraint.id),
    constraintDigest: digestCanonical({
      version: CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
      kind: 'constraint-reference',
      constraint: {
        id: constraint.id,
        kind: constraint.kind,
        summary: constraint.summary,
        enforcedBy: constraint.enforcedBy,
        parameterDigest: constraint.parameterDigest,
      },
    } as unknown as CanonicalReleaseJsonValue),
  });
}

function executableDecision(decision: ConsequenceAdmissionDecision): boolean {
  return decision === 'admit' || decision === 'narrow';
}

function proposedDomainMatches(input: {
  readonly domain: ConsequenceAdmissionDomain;
  readonly consequenceKind: ConsequenceAdmissionConsequenceKind;
}): boolean {
  if (input.domain === 'custom') {
    return true;
  }
  return consequenceAdmissionDomainsForKind(input.consequenceKind).includes(input.domain);
}

function failedRequiredCheckReasons(
  admission: ConsequenceAdmissionResponse,
): readonly ConsequenceAdmissionDownstreamFailureReason[] {
  return admission.checks.some((check) => check.required && check.outcome === 'fail')
    ? ['required-check-failed']
    : [];
}

function executionProofRefs(
  proofRefs: readonly ConsequenceAdmissionProofRef[],
): readonly ConsequenceAdmissionProofRef[] {
  return Object.freeze(
    proofRefs.filter((proofRef) => proofRef.kind !== 'admission-receipt'),
  );
}

function allConstraintsAccepted(input: {
  readonly constraints: readonly ConsequenceAdmissionConstraint[];
  readonly acceptedConstraintIds: readonly string[];
}): boolean {
  const accepted = new Set(input.acceptedConstraintIds);
  return input.constraints.every((constraint) => accepted.has(constraint.id));
}

function uniqueFailureReasons(
  reasons: readonly ConsequenceAdmissionDownstreamFailureReason[],
): readonly ConsequenceAdmissionDownstreamFailureReason[] {
  const present = new Set(reasons);
  return Object.freeze(
    CONSEQUENCE_ADMISSION_DOWNSTREAM_FAILURE_REASONS.filter((reason) =>
      present.has(reason),
    ),
  );
}

function reasonFor(
  outcome: ConsequenceAdmissionDownstreamOutcome,
  failureReasons: readonly ConsequenceAdmissionDownstreamFailureReason[],
): string {
  if (outcome === 'allow') {
    return 'Downstream enforcement contract allowed the consequence because admission, binding, proof, replay, and constraint requirements were satisfied.';
  }

  if (failureReasons.includes('admission-not-allowed')) {
    return 'Downstream enforcement contract held the consequence because Attestor did not mark the admission as allowed.';
  }
  if (failureReasons.includes('decision-not-executable')) {
    return 'Downstream enforcement contract held the consequence because only admit and narrow decisions may execute downstream.';
  }
  if (failureReasons.includes('consequence-domain-mismatch')) {
    return 'Downstream enforcement contract held the consequence because the proposed consequence does not match the contract domain.';
  }
  if (failureReasons.includes('downstream-system-mismatch')) {
    return 'Downstream enforcement contract held the consequence because the downstream system binding did not match.';
  }
  if (failureReasons.includes('idempotency-key-missing')) {
    return 'Downstream enforcement contract held the consequence because the enforcement point did not provide an idempotency key.';
  }
  if (failureReasons.includes('narrow-constraints-unacknowledged')) {
    return 'Downstream enforcement contract held the consequence because a narrow decision requires downstream constraint acknowledgement.';
  }
  return 'Downstream enforcement contract held the consequence because required enforcement bindings were not satisfied.';
}

export function createConsequenceAdmissionDownstreamContract(
  input: CreateConsequenceAdmissionDownstreamContractInput,
): ConsequenceAdmissionDownstreamContract {
  assertBoundaryKind(input.boundaryKind);
  assertDomain(input.consequenceDomain);
  if (input.downstreamSystems.length === 0) {
    throw new Error(
      'Consequence admission downstream contract requires at least one downstream system.',
    );
  }
  if (input.acceptedConsequenceKinds.length === 0) {
    throw new Error(
      'Consequence admission downstream contract requires at least one accepted consequence kind.',
    );
  }

  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
    enforcementPointId: normalizeIdentifier(input.enforcementPointId, 'enforcementPointId'),
    boundaryKind: input.boundaryKind,
    consequenceDomain: input.consequenceDomain,
    downstreamSystems: uniqueIdentifiers(input.downstreamSystems, 'downstreamSystems[]'),
    acceptedConsequenceKinds: uniqueValues(input.acceptedConsequenceKinds),
    acceptedRiskClasses: uniqueValues(input.acceptedRiskClasses ?? []),
    policyRefs: uniqueIdentifiers(input.policyRefs ?? [], 'policyRefs[]'),
    environment: normalizeOptionalIdentifier(input.environment, 'environment'),
    requireProof: input.requireProof ?? true,
    requireIdempotencyKey: input.requireIdempotencyKey ?? true,
    requireConstraintAcknowledgement: input.requireConstraintAcknowledgement ?? true,
    failClosed: true as const,
  } satisfies Omit<ConsequenceAdmissionDownstreamContract, 'contractId'>);

  return Object.freeze({
    ...base,
    contractId: normalizeOptionalIdentifier(input.contractId, 'contractId') ?? contractIdFor(base),
  });
}

export function evaluateConsequenceAdmissionDownstreamContract(
  input: EvaluateConsequenceAdmissionDownstreamContractInput,
): ConsequenceAdmissionDownstreamDecision {
  const { admission, contract } = input;
  const observation = input.observation ?? null;
  const proposed = admission.request.proposedConsequence;
  const observedDownstreamSystem =
    normalizeOptionalIdentifier(observation?.downstreamSystem, 'observation.downstreamSystem') ??
    proposed.downstreamSystem;
  const observedConsequenceKind = observation?.consequenceKind ?? proposed.consequenceKind;
  const observedRiskClass = observation?.riskClass ?? proposed.riskClass;
  const observedPolicyRef =
    normalizeOptionalIdentifier(observation?.policyRef, 'observation.policyRef') ??
    admission.request.policyScope.policyRef;
  const idempotencyKey = normalizeOptionalIdentifier(
    observation?.idempotencyKey,
    'observation.idempotencyKey',
  );
  const acceptedConstraintIds = uniqueIdentifiers(
    observation?.acceptedConstraintIds ?? [],
    'acceptedConstraintIds[]',
  );
  const proofRequired = contract.requireProof && executableDecision(admission.decision);
  const executableProofRefs = executionProofRefs(admission.proof);
  const proofSatisfied = !proofRequired || executableProofRefs.length > 0;
  const idempotencySatisfied = !contract.requireIdempotencyKey || idempotencyKey !== null;
  const constraintsRequired =
    contract.requireConstraintAcknowledgement &&
    admission.decision === 'narrow' &&
    admission.constraints.length > 0;
  const constraintsSatisfied =
    !constraintsRequired ||
    allConstraintsAccepted({
      constraints: admission.constraints,
      acceptedConstraintIds,
    });
  const customDomainScoped = contract.consequenceDomain !== 'custom' || contract.policyRefs.length > 0;

  const failures = uniqueFailureReasons([
    ...(!admission.allowed ? ['admission-not-allowed' as const] : []),
    ...(admission.failClosed ? ['admission-fail-closed' as const] : []),
    ...(!executableDecision(admission.decision) ? ['decision-not-executable' as const] : []),
    ...(!proofSatisfied ? ['proof-missing' as const] : []),
    ...failedRequiredCheckReasons(admission),
    ...(!proposedDomainMatches({
      domain: contract.consequenceDomain,
      consequenceKind: proposed.consequenceKind,
    })
      ? ['consequence-domain-mismatch' as const]
      : []),
    ...(!contract.acceptedConsequenceKinds.includes(observedConsequenceKind)
      ? ['consequence-kind-mismatch' as const]
      : []),
    ...(contract.acceptedRiskClasses.length > 0 &&
      !contract.acceptedRiskClasses.includes(observedRiskClass)
      ? ['risk-class-mismatch' as const]
      : []),
    ...(!contract.downstreamSystems.includes(observedDownstreamSystem)
      ? ['downstream-system-mismatch' as const]
      : []),
    ...(contract.policyRefs.length > 0 &&
      (observedPolicyRef === null || !contract.policyRefs.includes(observedPolicyRef))
      ? ['policy-ref-mismatch' as const]
      : []),
    ...(!idempotencySatisfied ? ['idempotency-key-missing' as const] : []),
    ...(!constraintsSatisfied ? ['narrow-constraints-unacknowledged' as const] : []),
    ...(!customDomainScoped ? ['custom-domain-unscoped' as const] : []),
  ]);
  const outcome: ConsequenceAdmissionDownstreamOutcome =
    failures.length === 0 ? 'allow' : 'hold';

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
    outcome,
    allowed: outcome === 'allow',
    failClosed: outcome !== 'allow',
    contractId: contract.contractId,
    enforcementPointId: contract.enforcementPointId,
    boundaryKind: contract.boundaryKind,
    consequenceDomain: contract.consequenceDomain,
    downstreamSystem: observedDownstreamSystem,
    admissionId: admission.admissionId,
    admissionDigest: admission.digest,
    decision: admission.decision,
    proofRequired,
    proofSatisfied,
    idempotencyRequired: contract.requireIdempotencyKey,
    idempotencySatisfied,
    constraintsRequired,
    constraintsSatisfied,
    proofRefs: Object.freeze([...admission.proof]),
    constraintRefs: Object.freeze(admission.constraints.map(constraintRef)),
    failureReasons: failures,
    reasonCodes: Object.freeze([
      ...admission.reasonCodes,
      ...failures.map((reason) => `downstream-contract-${reason}`),
      `downstream-contract-${outcome}`,
    ]),
    reason: reasonFor(outcome, failures),
    instruction: outcome === 'allow'
      ? `Run downstream enforcement point: ${contract.enforcementPointId}`
      : `Do not run downstream enforcement point: ${contract.enforcementPointId}`,
  });
}

export function consequenceAdmissionDownstreamContractDescriptor():
ConsequenceAdmissionDownstreamContractDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_DOWNSTREAM_CONTRACT_VERSION,
    boundaryKinds: CONSEQUENCE_ADMISSION_DOWNSTREAM_BOUNDARY_KINDS,
    bindingFields: CONSEQUENCE_ADMISSION_DOWNSTREAM_BINDING_FIELDS,
    executableDecisions: ['admit', 'narrow'] as const,
    holdDecisions: ['review', 'block'] as const,
    consequenceDomains: CONSEQUENCE_ADMISSION_DOMAINS,
    failureReasons: CONSEQUENCE_ADMISSION_DOWNSTREAM_FAILURE_REASONS,
    decisionExposesRawConstraints: false,
    decisionConstraintReferenceMode: 'digests-only',
    executionProofExcludesAdmissionReceipt: true,
    constraintKinds: CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS,
    failClosed: true,
  });
}
