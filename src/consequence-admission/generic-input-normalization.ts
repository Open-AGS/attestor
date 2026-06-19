import type { CanonicalReleaseJsonValue } from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
  GENERIC_ADMISSION_MODES,
  type ConsequenceAdmissionRetryAttemptBinding,
  type CreateConsequenceAdmissionRetryAttemptBindingInput,
  type CreateGenericAdmissionInput,
} from './contracts.js';
import { uniqueSortedStrings } from './correction-catalog.js';
import {
  canonicalObject,
  isRecord,
  normalizeEnumValue,
  normalizeIdentifier,
  normalizeIsoTimestamp,
  normalizeOptionalIdentifier,
  normalizePositiveInteger,
  normalizeStringArray,
  readOptionalBoolean,
  readOptionalString,
  readOptionalTimestamp,
  readRequiredString,
} from './normalization.js';
import { CONSEQUENCE_ADMISSION_DOMAINS } from './taxonomy.js';
import { CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES } from './tool-result-poisoning-guard.js';
import {
  normalizeGenericAmount,
  normalizeGenericDataScope,
  normalizeGenericScopeInput,
  normalizeGenericToolResults,
  normalizeOptionalEnumArray,
} from './generic-input-normalization-base.js';
import {
  normalizeGenericAgenticSupplyChain,
  normalizeGenericAuthorityCreep,
  normalizeGenericDecisionContextDrift,
  normalizeGenericHumanReviewFatigue,
  normalizeGenericMultiAgentDelegation,
  normalizeGenericStaleAuthorityPolicy,
} from './generic-input-normalization-supply-review.js';
import {
  normalizeGenericApprovals,
  normalizeGenericAuthoritySources,
  normalizeGenericGuardInputProvenance,
  normalizeGenericNoGoConditions,
  normalizeGenericObservedFeatureOrigins,
  normalizeGenericObservedFeatures,
  normalizeRequiredGuardInputProvenance,
} from './generic-input-normalization-provenance.js';

function retryAttemptIdFor(
  input: Omit<ConsequenceAdmissionRetryAttemptBinding, 'attemptId'>,
): string {
  return `retry-attempt:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

export function normalizeRetryAttemptBinding(
  value: unknown,
): ConsequenceAdmissionRetryAttemptBinding | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission retryAttempt must be an object when provided.');
  }

  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
    previousAdmissionId: normalizeIdentifier(
      value.previousAdmissionId as string | null | undefined,
      'retryAttempt.previousAdmissionId',
    ),
    previousAdmissionDigest: normalizeIdentifier(
      value.previousAdmissionDigest as string | null | undefined,
      'retryAttempt.previousAdmissionDigest',
    ),
    previousRequestId: normalizeIdentifier(
      value.previousRequestId as string | null | undefined,
      'retryAttempt.previousRequestId',
    ),
    attemptNumber: normalizePositiveInteger(value.attemptNumber, 'retryAttempt.attemptNumber'),
    attemptedAt: normalizeIsoTimestamp(
      normalizeIdentifier(value.attemptedAt as string | null | undefined, 'retryAttempt.attemptedAt'),
      'retryAttempt.attemptedAt',
    ),
    correctionReasonCodes: uniqueSortedStrings(
      normalizeStringArray(value.correctionReasonCodes, 'retryAttempt.correctionReasonCodes'),
    ),
    correctionFields: uniqueSortedStrings(
      normalizeStringArray(value.correctionFields, 'retryAttempt.correctionFields'),
    ),
    idempotencyKey: normalizeOptionalIdentifier(
      value.idempotencyKey as string | null | undefined,
      'retryAttempt.idempotencyKey',
    ),
  } satisfies Omit<ConsequenceAdmissionRetryAttemptBinding, 'attemptId'>);
  const expectedAttemptId = retryAttemptIdFor(base);
  const suppliedAttemptId = normalizeOptionalIdentifier(
    value.attemptId as string | null | undefined,
    'retryAttempt.attemptId',
  );

  if (suppliedAttemptId !== null && suppliedAttemptId !== expectedAttemptId) {
    throw new Error('Consequence admission retryAttempt.attemptId does not match the binding.');
  }

  return Object.freeze({
    ...base,
    attemptId: expectedAttemptId,
  });
}

export function createConsequenceAdmissionRetryAttemptBinding(
  input: CreateConsequenceAdmissionRetryAttemptBindingInput | ConsequenceAdmissionRetryAttemptBinding,
): ConsequenceAdmissionRetryAttemptBinding {
  const binding = normalizeRetryAttemptBinding(input);
  if (binding === null) {
    throw new Error('Consequence admission retry attempt binding requires an input object.');
  }
  return binding;
}

export function normalizeCreateGenericAdmissionInput(input: unknown): CreateGenericAdmissionInput {
  if (!isRecord(input)) {
    throw new Error('Consequence admission input must be a JSON object.');
  }
  const mode = normalizeEnumValue(
    readRequiredString(input, 'mode'),
    GENERIC_ADMISSION_MODES,
    'mode',
  );
  const domain = normalizeEnumValue(
    readRequiredString(input, 'domain'),
    CONSEQUENCE_ADMISSION_DOMAINS,
    'domain',
  );

  return Object.freeze({
    mode,
    actor: readRequiredString(input, 'actor'),
    action: readRequiredString(input, 'action'),
    domain,
    downstreamSystem: readRequiredString(input, 'downstreamSystem'),
    requestedAt: readOptionalTimestamp(input, 'requestedAt'),
    decidedAt: readOptionalTimestamp(input, 'decidedAt'),
    requestId: readOptionalString(input, 'requestId'),
    tenantId: readOptionalString(input, 'tenantId'),
    environment: readOptionalString(input, 'environment'),
    policyRef: readOptionalString(input, 'policyRef'),
    actorRef: readOptionalString(input, 'actorRef'),
    reviewerRef: readOptionalString(input, 'reviewerRef'),
    signerRef: readOptionalString(input, 'signerRef'),
    delegationRef: readOptionalString(input, 'delegationRef'),
    authorityMode: readOptionalString(input, 'authorityMode'),
    amount: normalizeGenericAmount(input.amount),
    recipient: readOptionalString(input, 'recipient'),
    dataScope: normalizeGenericDataScope(input.dataScope),
    evidenceRefs: normalizeStringArray(input.evidenceRefs, 'evidenceRefs'),
    authoritySources: normalizeGenericAuthoritySources(input.authoritySources),
    approvals: normalizeGenericApprovals(input.approvals),
    scopeOwnerPolicyRef: readOptionalString(input, 'scopeOwnerPolicyRef'),
    requestedScope: normalizeGenericScopeInput(input.requestedScope, 'requestedScope'),
    approvedScope: normalizeGenericScopeInput(input.approvedScope, 'approvedScope'),
    allowedToolResultEvidenceClasses: normalizeOptionalEnumArray(
      input.allowedToolResultEvidenceClasses,
      CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
      'allowedToolResultEvidenceClasses',
    ),
    toolResults: normalizeGenericToolResults(input.toolResults),
    agenticSupplyChain: normalizeGenericAgenticSupplyChain(input.agenticSupplyChain),
    humanReviewFatigue: normalizeGenericHumanReviewFatigue(input.humanReviewFatigue),
    multiAgentDelegation: normalizeGenericMultiAgentDelegation(input.multiAgentDelegation),
    staleAuthorityPolicy: normalizeGenericStaleAuthorityPolicy(input.staleAuthorityPolicy),
    decisionContextDrift: normalizeGenericDecisionContextDrift(input.decisionContextDrift),
    authorityCreep: normalizeGenericAuthorityCreep(input.authorityCreep),
    guardInputProvenance: normalizeGenericGuardInputProvenance(input.guardInputProvenance),
    requiredGuardInputProvenance: normalizeRequiredGuardInputProvenance(
      input.requiredGuardInputProvenance,
    ),
    noGoLedgerRef: readOptionalString(input, 'noGoLedgerRef'),
    noGoConditions: normalizeGenericNoGoConditions(input.noGoConditions),
    noGoNaturalLanguageBypassAttempted: readOptionalBoolean(
      input,
      'noGoNaturalLanguageBypassAttempted',
    ),
    noGoNaturalLanguageSignals: normalizeStringArray(
      input.noGoNaturalLanguageSignals,
      'noGoNaturalLanguageSignals',
    ),
    noGoBypassAttemptRef: readOptionalString(input, 'noGoBypassAttemptRef'),
    nativeInputRefs: normalizeStringArray(input.nativeInputRefs, 'nativeInputRefs'),
    observedFeatures: normalizeGenericObservedFeatures(input.observedFeatures),
    observedFeatureOrigins: normalizeGenericObservedFeatureOrigins(input.observedFeatureOrigins),
    retryAttempt: normalizeRetryAttemptBinding(input.retryAttempt),
    summary: readOptionalString(input, 'summary'),
  });
}
