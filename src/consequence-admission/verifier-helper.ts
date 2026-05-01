import {
  createHash,
} from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionResponse,
} from './index.js';
import {
  createConsequenceAdmissionDownstreamContract,
  evaluateConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionDownstreamContract,
  type ConsequenceAdmissionDownstreamDecision,
  type ConsequenceAdmissionDownstreamObservation,
  type CreateConsequenceAdmissionDownstreamContractInput,
} from './downstream-enforcement-contract.js';

export const CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION =
  'attestor.consequence-admission-verifier-helper.v1';

export interface ConsequenceAdmissionVerifierHelperDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION;
  readonly verifies: 'downstream-contract-binding';
  readonly executableOutcomes: readonly ['allow'];
  readonly heldOutcomes: readonly ['hold'];
  readonly cryptographicTokenVerification: false;
  readonly failClosed: true;
}

export interface ConsequenceAdmissionVerifierHelperConfig {
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly verifierRef?: string | null;
  readonly now?: (() => string) | null;
}

export interface VerifyConsequenceAdmissionInput {
  readonly admission: ConsequenceAdmissionResponse;
  readonly observation?: ConsequenceAdmissionDownstreamObservation | null;
  readonly verifiedAt?: string | null;
  readonly verifierRef?: string | null;
}

export interface ConsequenceAdmissionVerification {
  readonly version: typeof CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION;
  readonly verifiedAt: string;
  readonly verifierRef: string | null;
  readonly verified: boolean;
  readonly failClosed: boolean;
  readonly contractId: string;
  readonly enforcementPointId: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
  readonly receiptDigest: string;
  readonly reason: string;
  readonly reasonCodes: readonly string[];
  readonly instruction: string;
}

export interface ConsequenceAdmissionVerifierHelper {
  readonly version: typeof CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION;
  readonly contract: ConsequenceAdmissionDownstreamContract;
  readonly verifierRef: string | null;
  readonly verify: (
    input: VerifyConsequenceAdmissionInput,
  ) => ConsequenceAdmissionVerification;
  readonly assert: (
    input: VerifyConsequenceAdmissionInput,
  ) => ConsequenceAdmissionVerification;
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Consequence admission verifier helper ${fieldName} cannot be blank.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Consequence admission verifier helper ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function isExistingContract(
  value:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput,
): value is ConsequenceAdmissionDownstreamContract {
  return (
    'version' in value &&
    value.version === 'attestor.consequence-admission-downstream-contract.v1' &&
    'contractId' in value
  );
}

function resolveContract(
  value:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput,
): ConsequenceAdmissionDownstreamContract {
  return isExistingContract(value)
    ? value
    : createConsequenceAdmissionDownstreamContract(value);
}

function defaultNow(): string {
  return new Date().toISOString();
}

function verificationDigest(input: {
  readonly verifiedAt: string;
  readonly verifierRef: string | null;
  readonly downstreamDecision: ConsequenceAdmissionDownstreamDecision;
}): string {
  const canonical = canonicalizeReleaseJson({
    version: CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
    verifiedAt: input.verifiedAt,
    verifierRef: input.verifierRef,
    contractId: input.downstreamDecision.contractId,
    enforcementPointId: input.downstreamDecision.enforcementPointId,
    admissionId: input.downstreamDecision.admissionId,
    admissionDigest: input.downstreamDecision.admissionDigest,
    outcome: input.downstreamDecision.outcome,
    allowed: input.downstreamDecision.allowed,
    failureReasons: input.downstreamDecision.failureReasons,
  } as CanonicalReleaseJsonValue);
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export class ConsequenceAdmissionVerificationHeldError extends Error {
  readonly verification: ConsequenceAdmissionVerification;

  constructor(verification: ConsequenceAdmissionVerification) {
    super(verification.reason);
    this.name = 'ConsequenceAdmissionVerificationHeldError';
    this.verification = verification;
  }
}

export function consequenceAdmissionVerifierHelperDescriptor():
ConsequenceAdmissionVerifierHelperDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
    verifies: 'downstream-contract-binding',
    executableOutcomes: ['allow'] as const,
    heldOutcomes: ['hold'] as const,
    cryptographicTokenVerification: false,
    failClosed: true,
  });
}

export function verifyConsequenceAdmissionForDownstream(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly observation?: ConsequenceAdmissionDownstreamObservation | null;
  readonly verifiedAt?: string | null;
  readonly verifierRef?: string | null;
  readonly now?: (() => string) | null;
}): ConsequenceAdmissionVerification {
  const contract = resolveContract(input.contract);
  const verifiedAt = normalizeIsoTimestamp(
    input.verifiedAt ?? input.now?.() ?? defaultNow(),
    'verifiedAt',
  );
  const verifierRef = normalizeOptionalIdentifier(input.verifierRef, 'verifierRef');
  const downstreamDecision = evaluateConsequenceAdmissionDownstreamContract({
    admission: input.admission,
    contract,
    observation: input.observation,
  });
  const receiptDigest = verificationDigest({
    verifiedAt,
    verifierRef,
    downstreamDecision,
  });

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
    verifiedAt,
    verifierRef,
    verified: downstreamDecision.allowed,
    failClosed: downstreamDecision.failClosed,
    contractId: contract.contractId,
    enforcementPointId: contract.enforcementPointId,
    admissionId: input.admission.admissionId,
    admissionDigest: input.admission.digest,
    downstreamDecision,
    receiptDigest,
    reason: downstreamDecision.reason,
    reasonCodes: Object.freeze([
      ...downstreamDecision.reasonCodes,
      downstreamDecision.allowed
        ? 'verifier-helper-verified'
        : 'verifier-helper-held',
    ]),
    instruction: downstreamDecision.instruction,
  });
}

export function assertConsequenceAdmissionVerifiedForDownstream(input: {
  readonly admission: ConsequenceAdmissionResponse;
  readonly contract:
    | ConsequenceAdmissionDownstreamContract
    | CreateConsequenceAdmissionDownstreamContractInput;
  readonly observation?: ConsequenceAdmissionDownstreamObservation | null;
  readonly verifiedAt?: string | null;
  readonly verifierRef?: string | null;
  readonly now?: (() => string) | null;
}): ConsequenceAdmissionVerification {
  const verification = verifyConsequenceAdmissionForDownstream(input);
  if (!verification.verified) {
    throw new ConsequenceAdmissionVerificationHeldError(verification);
  }
  return verification;
}

export function createConsequenceAdmissionVerifier(
  config: ConsequenceAdmissionVerifierHelperConfig,
): ConsequenceAdmissionVerifierHelper {
  const contract = resolveContract(config.contract);
  const defaultVerifierRef = normalizeOptionalIdentifier(
    config.verifierRef,
    'verifierRef',
  );
  const now = config.now ?? null;

  const verify = (
    input: VerifyConsequenceAdmissionInput,
  ): ConsequenceAdmissionVerification =>
    verifyConsequenceAdmissionForDownstream({
      admission: input.admission,
      contract,
      observation: input.observation,
      verifiedAt: input.verifiedAt,
      verifierRef: input.verifierRef ?? defaultVerifierRef,
      now,
    });

  const assert = (
    input: VerifyConsequenceAdmissionInput,
  ): ConsequenceAdmissionVerification => {
    const verification = verify(input);
    if (!verification.verified) {
      throw new ConsequenceAdmissionVerificationHeldError(verification);
    }
    return verification;
  };

  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_VERIFIER_HELPER_VERSION,
    contract,
    verifierRef: defaultVerifierRef,
    verify,
    assert,
  });
}
