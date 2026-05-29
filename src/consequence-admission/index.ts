import {
  createHash,
} from 'node:crypto';
import type {
  CryptoExecutionAdmissionOutcome,
} from '../crypto-execution-admission/index.js';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES,
  evaluateConsequenceAgenticSupplyChain,
  type ConsequenceAgenticSupplyChainDecision,
} from './agentic-supply-chain-guard.js';
import {
  CONSEQUENCE_APPROVAL_SOURCE_KINDS,
  CONSEQUENCE_APPROVAL_STATES,
  CONSEQUENCE_APPROVAL_TRUST_CLASSES,
  evaluateConsequenceApprovalProvenance,
  type ConsequenceApprovalProvenanceDecision,
} from './approval-provenance-guard.js';
import type {
  AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import {
  AUTHORITY_CREEP_GUARD_VERSION,
  createAuthorityCreepGuard,
  type AuthorityCreepGuardRecord,
} from './authority-creep-guard.js';
import {
  CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS,
  CONSEQUENCE_ADMISSION_CONSTRAINT_PARAMETER_DIGEST_PATTERN,
  isConsequenceAdmissionConstraintKind,
  type ConsequenceAdmissionConstraintKind,
} from './constraint-kinds.js';
import type {
  ConsequenceAdmissionCheck,
  ConsequenceAdmissionCheckKind,
  ConsequenceAdmissionCheckOutcome,
  ConsequenceAdmissionConstraint,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionEvidenceRef,
  ConsequenceAdmissionNativeDecision,
  ConsequenceAdmissionProblem,
  ConsequenceAdmissionProofRef,
  ConsequenceAdmissionRequest,
  ConsequenceAdmissionResponse,
  ConsequenceAdmissionRetryAttemptBinding,
  CreateConsequenceAdmissionConstraintInput,
  CreateConsequenceAdmissionRequestInput,
  CreateConsequenceAdmissionResponseInput,
  CreateConsequenceAdmissionRetryAttemptBindingInput,
  CreateGenericAdmissionInput,
  GenericAdmissionAgenticSupplyChain,
  GenericAdmissionAgenticSupplyChainComponent,
  GenericAdmissionAmount,
  GenericAdmissionApproval,
  GenericAdmissionAuthorityCreep,
  GenericAdmissionAuthoritySource,
  GenericAdmissionDataScope,
  GenericAdmissionDecisionContextBindingContext,
  GenericAdmissionDecisionContextDrift,
  GenericAdmissionDownstreamPosture,
  GenericAdmissionEnvelope,
  GenericAdmissionFeatureValue,
  GenericAdmissionHumanReviewFatigue,
  GenericAdmissionMode,
  GenericAdmissionModeEvaluation,
  GenericAdmissionMultiAgentDelegation,
  GenericAdmissionMultiAgentDelegationPrincipal,
  GenericAdmissionNoGoCondition,
  GenericAdmissionObservedFeatureOrigin,
  GenericAdmissionScopeInput,
  GenericAdmissionShadowDecision,
  GenericAdmissionStaleAuthorityPolicy,
  GenericAdmissionToolResult,
} from './contracts.js';
import {
  CONSEQUENCE_ADMISSION_CHECK_KINDS,
  CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
  CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
  CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
  CONSEQUENCE_ADMISSION_DECISIONS,
  CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
  CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
  CONSEQUENCE_ADMISSION_PACK_FAMILIES,
  CONSEQUENCE_ADMISSION_PROOF_KINDS,
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
  CONSEQUENCE_ADMISSION_RISK_CLASSES,
  GENERIC_ADMISSION_AGENTIC_SUPPLY_CHAIN_REASON_CODES,
  GENERIC_ADMISSION_APPROVAL_GUARD_REASON_CODES,
  GENERIC_ADMISSION_AUTHORITY_GUARD_REASON_CODES,
  GENERIC_ADMISSION_DECISION_CONTEXT_DRIFT_REASON_CODES,
  GENERIC_ADMISSION_HUMAN_REVIEW_FATIGUE_REASON_CODES,
  GENERIC_ADMISSION_MODES,
  GENERIC_ADMISSION_MULTI_AGENT_DELEGATION_REASON_CODES,
  GENERIC_ADMISSION_NO_GO_REASON_CODES,
  GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS,
  GENERIC_ADMISSION_TOOL_RESULT_REASON_CODES,
  GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS,
} from './contracts.js';
import {
  evaluateConsequenceDecisionContextDrift,
  type ConsequenceDecisionContextDriftDecision,
} from './decision-context-drift-binding.js';
import type {
  DecisionLineageGraphRecord,
} from './decision-lineage-graph.js';
import {
  CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS,
  evaluateConsequenceHumanReviewFatigue,
  type ConsequenceHumanReviewFatigueDecision,
} from './human-review-fatigue-guard.js';
import {
  CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS,
  CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES,
  evaluateConsequenceMultiAgentDelegation,
  type ConsequenceMultiAgentDelegationDecision,
} from './multi-agent-delegation-guard.js';
import {
  CONSEQUENCE_NO_GO_CONDITION_KINDS,
  CONSEQUENCE_NO_GO_CONDITION_SOURCE_KINDS,
  CONSEQUENCE_NO_GO_CONDITION_STATES,
  evaluateConsequenceNoGoConditionLedger,
  type ConsequenceNoGoConditionLedgerDecision,
} from './no-go-condition-ledger.js';
import {
  CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
  CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
  CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
  evaluateConsequenceScopeExplosion,
  type ConsequenceScopeExplosionDecision,
} from './scope-explosion-guard.js';
import {
  CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES,
  evaluateConsequenceStaleAuthorityPolicy,
  type ConsequenceStaleAuthorityPolicyDecision,
} from './stale-authority-policy-guard.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
  consequenceAdmissionDomainProfile,
} from './taxonomy.js';
import {
  CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
  CONSEQUENCE_TOOL_RESULT_RISK_LEVELS,
  CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES,
  CONSEQUENCE_TOOL_RESULT_TOOL_KINDS,
  CONSEQUENCE_TOOL_RESULT_USE_KINDS,
  evaluateConsequenceToolResultPoisoning,
  type ConsequenceToolResultPoisoningDecision,
} from './tool-result-poisoning-guard.js';
import {
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS,
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS,
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES,
  evaluateConsequenceUntrustedContentAuthority,
  type ConsequenceUntrustedContentAuthorityDecision,
} from './untrusted-content-authority-guard.js';
export {
  CONSEQUENCE_ADMISSION_CHECK_KINDS,
  CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
  CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
  CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
  CONSEQUENCE_ADMISSION_CORRECTION_AUDIENCES,
  CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_VERSION,
  CONSEQUENCE_ADMISSION_DECISIONS,
  CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
  CONSEQUENCE_ADMISSION_FEEDBACK_DISCLOSURE_LEVELS,
  CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
  CONSEQUENCE_ADMISSION_PACK_FAMILIES,
  CONSEQUENCE_ADMISSION_PROOF_KINDS,
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
  CONSEQUENCE_ADMISSION_RETRY_BINDING_FIELDS,
  CONSEQUENCE_ADMISSION_RETRY_BUDGET_OUTCOMES,
  CONSEQUENCE_ADMISSION_RETRY_DEFAULT_MAX_ATTEMPTS,
  CONSEQUENCE_ADMISSION_RETRY_DEFAULT_WINDOW_SECONDS,
  CONSEQUENCE_ADMISSION_RETRY_RULE_VERSION,
  GENERIC_ADMISSION_DOWNSTREAM_POSTURES,
  GENERIC_ADMISSION_MODES,
  GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS,
  GENERIC_ADMISSION_SHADOW_DECISIONS,
} from './contracts.js';
export type {
  ConsequenceAdmissionAuthority,
  ConsequenceAdmissionCheck,
  ConsequenceAdmissionCheckKind,
  ConsequenceAdmissionCheckOutcome,
  ConsequenceAdmissionConsequenceKind,
  ConsequenceAdmissionConstraint,
  ConsequenceAdmissionCorrectionAudience,
  ConsequenceAdmissionCorrectionCatalog,
  ConsequenceAdmissionCorrectionCatalogEntry,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionDescriptor,
  ConsequenceAdmissionEntryPoint,
  ConsequenceAdmissionEntryPointKind,
  ConsequenceAdmissionEvidenceRef,
  ConsequenceAdmissionFeedback,
  ConsequenceAdmissionFeedbackDisclosureLevel,
  ConsequenceAdmissionNativeDecision,
  ConsequenceAdmissionNativeSurface,
  ConsequenceAdmissionPackFamily,
  ConsequenceAdmissionPolicyScope,
  ConsequenceAdmissionProblem,
  ConsequenceAdmissionProofKind,
  ConsequenceAdmissionProofRef,
  ConsequenceAdmissionProposedConsequence,
  ConsequenceAdmissionRequest,
  ConsequenceAdmissionResponse,
  ConsequenceAdmissionRetryAttemptBinding,
  ConsequenceAdmissionRetryBindingField,
  ConsequenceAdmissionRetryBudgetEvaluation,
  ConsequenceAdmissionRetryBudgetOutcome,
  ConsequenceAdmissionRetryGuidance,
  CreateConsequenceAdmissionConstraintInput,
  CreateConsequenceAdmissionRequestInput,
  CreateConsequenceAdmissionResponseInput,
  CreateConsequenceAdmissionRetryAttemptBindingInput,
  CreateGenericAdmissionInput,
  EvaluateConsequenceAdmissionRetryBudgetInput,
  GenericAdmissionAgenticSupplyChain,
  GenericAdmissionAgenticSupplyChainComponent,
  GenericAdmissionAmount,
  GenericAdmissionApproval,
  GenericAdmissionAuthorityCreep,
  GenericAdmissionAuthoritySource,
  GenericAdmissionDataScope,
  GenericAdmissionDecisionContextBindingContext,
  GenericAdmissionDecisionContextDrift,
  GenericAdmissionDownstreamPosture,
  GenericAdmissionEnvelope,
  GenericAdmissionFeatureValue,
  GenericAdmissionHumanReviewFatigue,
  GenericAdmissionMode,
  GenericAdmissionModeEvaluation,
  GenericAdmissionMultiAgentDelegation,
  GenericAdmissionMultiAgentDelegationPrincipal,
  GenericAdmissionNoGoCondition,
  GenericAdmissionObservedFeatureOrigin,
  GenericAdmissionScopeInput,
  GenericAdmissionShadowDecision,
  GenericAdmissionStaleAuthorityPolicy,
  GenericAdmissionToolResult,
} from './contracts.js';
export {
  CONSEQUENCE_ADMISSION_CORRECTION_CATALOG_ENTRIES,
  consequenceAdmissionCorrectionCatalog,
  consequenceAdmissionCorrectionForReason,
  evaluateConsequenceAdmissionRetryBudget,
} from './correction-catalog.js';

function normalizeIdentifier(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty string value.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function inferConstraintKind(id: string): ConsequenceAdmissionConstraintKind {
  const normalized = id.toLowerCase();
  if (normalized.includes('max-amount') || normalized.includes('amount')) {
    return 'max-amount';
  }
  if (normalized.includes('recipient')) {
    return 'recipient-allowlist';
  }
  if (normalized.includes('record') || normalized.includes('data-scope')) {
    return 'record-scope';
  }
  if (normalized.includes('time') || normalized.includes('window')) {
    return 'time-window';
  }
  if (normalized.includes('tool')) {
    return 'tool-allowlist';
  }
  if (normalized.includes('policy')) {
    return 'policy-ref';
  }
  if (normalized.includes('release-token') || normalized.startsWith('rt_')) {
    return 'release-token';
  }
  if (normalized.includes('generic-narrow') || normalized.includes('customer')) {
    return 'customer-approved-scope';
  }
  return 'custom';
}

function normalizeConstraintKind(
  kind: ConsequenceAdmissionConstraintKind | null | undefined,
  id: string,
): ConsequenceAdmissionConstraintKind {
  if (kind === undefined || kind === null) return inferConstraintKind(id);
  if (!isConsequenceAdmissionConstraintKind(kind)) {
    throw new Error(
      `Consequence admission constraint kind must be one of: ${CONSEQUENCE_ADMISSION_CONSTRAINT_KINDS.join(', ')}.`,
    );
  }
  return kind;
}

function normalizeConstraintParameterDigest(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeIdentifier(value, 'constraint.parameterDigest');
  if (!CONSEQUENCE_ADMISSION_CONSTRAINT_PARAMETER_DIGEST_PATTERN.test(normalized)) {
    throw new Error(
      'Consequence admission constraint parameterDigest must be a sha256 digest.',
    );
  }
  return normalized;
}

function normalizeConstraint(
  input: CreateConsequenceAdmissionConstraintInput,
): ConsequenceAdmissionConstraint {
  const id = normalizeIdentifier(input.id, 'constraint.id');
  return Object.freeze({
    id,
    kind: normalizeConstraintKind(input.kind, id),
    summary: normalizeIdentifier(input.summary, 'constraint.summary'),
    enforcedBy: normalizeIdentifier(input.enforcedBy, 'constraint.enforcedBy'),
    parameterDigest: normalizeConstraintParameterDigest(input.parameterDigest),
  });
}

function normalizeOptionalIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeIdentifier(value, fieldName);
}

function normalizeEnumValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string,
): T {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!allowedValues.includes(normalized as T)) {
    throw new Error(
      `Consequence admission ${fieldName} must be one of: ${allowedValues.join(', ')}.`,
    );
  }
  return normalized as T;
}

function normalizeEvidenceRef(
  input: ConsequenceAdmissionEvidenceRef,
): ConsequenceAdmissionEvidenceRef {
  return Object.freeze({
    id: normalizeIdentifier(input.id, 'evidence.id'),
    kind: normalizeIdentifier(input.kind, 'evidence.kind'),
    digest: normalizeOptionalIdentifier(input.digest, 'evidence.digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'evidence.uri'),
  });
}

function normalizeProofRef(input: ConsequenceAdmissionProofRef): ConsequenceAdmissionProofRef {
  return Object.freeze({
    kind: normalizeEnumValue(input.kind, CONSEQUENCE_ADMISSION_PROOF_KINDS, 'proof.kind'),
    id: normalizeIdentifier(input.id, 'proof.id'),
    digest: normalizeOptionalIdentifier(input.digest, 'proof.digest'),
    uri: normalizeOptionalIdentifier(input.uri, 'proof.uri'),
    verifyHint: normalizeIdentifier(input.verifyHint, 'proof.verifyHint'),
  });
}

function normalizeNativeDecision(
  input: ConsequenceAdmissionNativeDecision | null | undefined,
): ConsequenceAdmissionNativeDecision | null {
  if (!input) return null;
  return Object.freeze({
    surface: normalizeEnumValue(
      input.surface,
      CONSEQUENCE_ADMISSION_NATIVE_SURFACES,
      'nativeDecision.surface',
    ),
    value: normalizeIdentifier(input.value, 'nativeDecision.value'),
    mappedDecision: normalizeEnumValue(
      input.mappedDecision,
      CONSEQUENCE_ADMISSION_DECISIONS,
      'nativeDecision.mappedDecision',
    ),
    mappingReason: normalizeIdentifier(input.mappingReason, 'nativeDecision.mappingReason'),
  });
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Consequence admission ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
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

function requestIdFor(input: Omit<ConsequenceAdmissionRequest, 'requestId'>): string {
  return canonicalObject({
    version: input.version,
    requestedAt: input.requestedAt,
    packFamily: input.packFamily,
    entryPoint: input.entryPoint,
    proposedConsequence: input.proposedConsequence,
    policyScope: input.policyScope,
    authority: input.authority,
    evidence: input.evidence,
    nativeInputRefs: input.nativeInputRefs,
  } as unknown as CanonicalReleaseJsonValue).digest;
}

function admissionIdFor(input: {
  readonly decidedAt: string;
  readonly requestId: string;
  readonly decision: ConsequenceAdmissionDecision;
  readonly reasonCodes: readonly string[];
  readonly proofDigests: readonly string[];
}): string {
  return canonicalObject({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    decidedAt: input.decidedAt,
    requestId: input.requestId,
    decision: input.decision,
    reasonCodes: input.reasonCodes,
    proofDigests: input.proofDigests,
  }).digest;
}

function readonlyCopy<T>(items: readonly T[] | null | undefined): readonly T[] {
  return Object.freeze([...(items ?? [])]);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string {
  const value = record[fieldName];
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} requires a non-empty string value.`);
  }
  return normalizeIdentifier(value, fieldName);
}

function readOptionalString(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | null {
  const value = record[fieldName];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Consequence admission ${fieldName} must be a string when provided.`);
  }
  return normalizeOptionalIdentifier(value, fieldName);
}

function readOptionalBoolean(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): boolean | null {
  const value = record[fieldName];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') {
    throw new Error(`Consequence admission ${fieldName} must be a boolean when provided.`);
  }
  return value;
}

function readOptionalTimestamp(
  record: Readonly<Record<string, unknown>>,
  fieldName: string,
): string | null {
  const value = readOptionalString(record, fieldName);
  return value === null ? null : normalizeIsoTimestamp(value, fieldName);
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Consequence admission ${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeStringArray(value: unknown, fieldName: string): readonly string[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array when provided.`);
  }
  return Object.freeze(
    value.map((entry, index) => {
      if (typeof entry !== 'string') {
        throw new Error(
          `Consequence admission ${fieldName}[${index}] must be a string.`,
        );
      }
      return normalizeIdentifier(entry, `${fieldName}[${index}]`);
    }),
  );
}

function normalizeGenericAmount(value: unknown): GenericAdmissionAmount | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission amount must be an object when provided.');
  }
  const rawAmount = value.value;
  if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
    throw new Error('Consequence admission amount.value must be a string or number.');
  }
  if (typeof rawAmount === 'number' && !Number.isFinite(rawAmount)) {
    throw new Error('Consequence admission amount.value must be finite.');
  }
  const amountValue =
    typeof rawAmount === 'string'
      ? normalizeIdentifier(rawAmount, 'amount.value')
      : rawAmount;

  return Object.freeze({
    value: amountValue,
    currency: readOptionalString(value, 'currency'),
    asset: readOptionalString(value, 'asset'),
    chain: readOptionalString(value, 'chain'),
  });
}

function normalizeGenericDataScope(value: unknown): GenericAdmissionDataScope | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error('Consequence admission dataScope must be an object when provided.');
  }
  const rawRecords = value.records;
  if (
    rawRecords !== undefined &&
    rawRecords !== null &&
    (typeof rawRecords !== 'number' || !Number.isFinite(rawRecords) || rawRecords < 0)
  ) {
    throw new Error('Consequence admission dataScope.records must be a non-negative number.');
  }
  return Object.freeze({
    records: typeof rawRecords === 'number' ? rawRecords : null,
    classification: readOptionalString(value, 'classification'),
    fields: normalizeStringArray(value.fields, 'dataScope.fields'),
  });
}

function normalizeOptionalNonNegativeFiniteNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `Consequence admission ${fieldName} must be a non-negative finite number when provided.`,
    );
  }
  return value;
}

function normalizeOptionalPositiveInteger(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  return normalizePositiveInteger(value, fieldName);
}

function normalizeOptionalPositiveFiniteNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Consequence admission ${fieldName} must be a positive finite number when provided.`,
    );
  }
  return value;
}

function normalizeOptionalEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): readonly T[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array when provided.`);
  }
  return Object.freeze(
    value.map((entry, index) => normalizeEnumValue(
      typeof entry === 'string' ? entry : String(entry),
      allowed,
      `${fieldName}[${index}]`,
    )),
  );
}

function normalizeGenericScopeInput(
  value: unknown,
  fieldName: string,
): GenericAdmissionScopeInput | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an object when provided.`);
  }

  const operationType = readOptionalString(value, 'operationType');
  const dataClass = readOptionalString(value, 'dataClass');
  const reversibilityClass = readOptionalString(value, 'reversibilityClass');

  return Object.freeze({
    amountMinorUnits: normalizeOptionalNonNegativeFiniteNumber(
      value.amountMinorUnits,
      `${fieldName}.amountMinorUnits`,
    ),
    maxAmountMinorUnits: normalizeOptionalNonNegativeFiniteNumber(
      value.maxAmountMinorUnits,
      `${fieldName}.maxAmountMinorUnits`,
    ),
    currency: readOptionalString(value, 'currency'),
    recordCount: normalizeOptionalNonNegativeFiniteNumber(value.recordCount, `${fieldName}.recordCount`),
    maxRecordCount: normalizeOptionalNonNegativeFiniteNumber(
      value.maxRecordCount,
      `${fieldName}.maxRecordCount`,
    ),
    operationType: operationType === null
      ? null
      : normalizeEnumValue(
        operationType,
        CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
        `${fieldName}.operationType`,
      ),
    operationTypes: normalizeOptionalEnumArray(
      value.operationTypes,
      CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
      `${fieldName}.operationTypes`,
    ),
    recipientId: readOptionalString(value, 'recipientId'),
    recipientIds: value.recipientIds === undefined || value.recipientIds === null
      ? null
      : normalizeStringArray(value.recipientIds, `${fieldName}.recipientIds`),
    tenantId: readOptionalString(value, 'tenantId'),
    environment: readOptionalString(value, 'environment'),
    environments: value.environments === undefined || value.environments === null
      ? null
      : normalizeStringArray(value.environments, `${fieldName}.environments`),
    downstreamSystem: readOptionalString(value, 'downstreamSystem'),
    downstreamSystems:
      value.downstreamSystems === undefined || value.downstreamSystems === null
        ? null
        : normalizeStringArray(value.downstreamSystems, `${fieldName}.downstreamSystems`),
    dataClass: dataClass === null
      ? null
      : normalizeEnumValue(
        dataClass,
        CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
        `${fieldName}.dataClass`,
      ),
    dataClasses: normalizeOptionalEnumArray(
      value.dataClasses,
      CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
      `${fieldName}.dataClasses`,
    ),
    reversibilityClass: reversibilityClass === null
      ? null
      : normalizeEnumValue(
        reversibilityClass,
        CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
        `${fieldName}.reversibilityClass`,
      ),
    reversibilityClasses: normalizeOptionalEnumArray(
      value.reversibilityClasses,
      CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
      `${fieldName}.reversibilityClasses`,
    ),
  });
}

function normalizeGenericToolResults(
  value: unknown,
): readonly GenericAdmissionToolResult[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission toolResults must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `toolResults[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const sourceTimestamp = readOptionalTimestamp(entry, 'sourceTimestamp');
      const integrityDigest = readOptionalString(entry, 'integrityDigest');
      const evidenceDigest = readOptionalString(entry, 'evidenceDigest');
      const evidenceClass = readOptionalString(entry, 'evidenceClass');
      const allowedEvidenceClasses = normalizeOptionalEnumArray(
        entry.allowedEvidenceClasses,
        CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
        `${field}.allowedEvidenceClasses`,
      );
      const signatureVerified = readOptionalBoolean(entry, 'signatureVerified');
      const toolRisk = readOptionalString(entry, 'toolRisk');
      return Object.freeze({
        toolResultRef: readRequiredString(entry, 'toolResultRef'),
        toolKind: normalizeEnumValue(
          readRequiredString(entry, 'toolKind'),
          CONSEQUENCE_TOOL_RESULT_TOOL_KINDS,
          `${field}.toolKind`,
        ),
        sourceTrustClass: normalizeEnumValue(
          readRequiredString(entry, 'sourceTrustClass'),
          CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES,
          `${field}.sourceTrustClass`,
        ),
        resultUse: normalizeEnumValue(
          readRequiredString(entry, 'resultUse'),
          CONSEQUENCE_TOOL_RESULT_USE_KINDS,
          `${field}.resultUse`,
        ),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(sourceTimestamp === null ? {} : { sourceTimestamp }),
        ...(integrityDigest === null ? {} : { integrityDigest }),
        ...(evidenceDigest === null ? {} : { evidenceDigest }),
        ...(evidenceClass === null
          ? {}
          : {
              evidenceClass: normalizeEnumValue(
                evidenceClass,
                CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
                `${field}.evidenceClass`,
              ),
            }),
        ...(allowedEvidenceClasses === null ? {} : { allowedEvidenceClasses }),
        ...(signatureVerified === null ? {} : { signatureVerified }),
        ...(toolRisk === null
          ? {}
          : {
              toolRisk: normalizeEnumValue(
                toolRisk,
                CONSEQUENCE_TOOL_RESULT_RISK_LEVELS,
                `${field}.toolRisk`,
              ),
            }),
      });
    }),
  );
}

function normalizeGenericAgenticSupplyChainComponents(
  value: unknown,
): readonly GenericAdmissionAgenticSupplyChainComponent[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission agenticSupplyChain.components must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `agenticSupplyChain.components[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const componentKind = normalizeEnumValue(
        readRequiredString(entry, 'componentKind'),
        CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
        `${field}.componentKind`,
      );
      const trustClass = readOptionalString(entry, 'trustClass');
      const criticality = readOptionalString(entry, 'criticality');
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const sourcePinned = readOptionalBoolean(entry, 'sourcePinned');
      const version = readOptionalString(entry, 'version');
      const integrityDigest = readOptionalString(entry, 'integrityDigest');
      const provenanceRef = readOptionalString(entry, 'provenanceRef');
      const provenanceVerified = readOptionalBoolean(entry, 'provenanceVerified');
      const signatureVerified = readOptionalBoolean(entry, 'signatureVerified');
      const sbomRef = readOptionalString(entry, 'sbomRef');
      const ownerAuthorityDigest = readOptionalString(entry, 'ownerAuthorityDigest');
      const reviewDigest = readOptionalString(entry, 'reviewDigest');
      const permissionScopeDigest = readOptionalString(entry, 'permissionScopeDigest');
      const installScriptsPresent = readOptionalBoolean(entry, 'installScriptsPresent');
      const networkEgressDeclared = readOptionalBoolean(entry, 'networkEgressDeclared');
      const generatedArtifact = readOptionalBoolean(entry, 'generatedArtifact');
      const generatedArtifactReviewed = readOptionalBoolean(entry, 'generatedArtifactReviewed');
      const domainPackBoundaryVerified = readOptionalBoolean(entry, 'domainPackBoundaryVerified');
      const adapterReadinessDigest = readOptionalString(entry, 'adapterReadinessDigest');
      const runtimeReplayTestDigest = readOptionalString(entry, 'runtimeReplayTestDigest');

      return Object.freeze({
        componentRef: readRequiredString(entry, 'componentRef'),
        componentKind,
        ...(trustClass === null
          ? {}
          : {
              trustClass: normalizeEnumValue(
                trustClass,
                CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES,
                `${field}.trustClass`,
              ),
            }),
        ...(criticality === null
          ? {}
          : {
              criticality: normalizeEnumValue(
                criticality,
                CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY,
                `${field}.criticality`,
              ),
            }),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(sourcePinned === null ? {} : { sourcePinned }),
        ...(version === null ? {} : { version }),
        ...(integrityDigest === null ? {} : { integrityDigest }),
        ...(provenanceRef === null ? {} : { provenanceRef }),
        ...(provenanceVerified === null ? {} : { provenanceVerified }),
        ...(signatureVerified === null ? {} : { signatureVerified }),
        ...(sbomRef === null ? {} : { sbomRef }),
        ...(ownerAuthorityDigest === null ? {} : { ownerAuthorityDigest }),
        ...(reviewDigest === null ? {} : { reviewDigest }),
        ...(permissionScopeDigest === null ? {} : { permissionScopeDigest }),
        declaredPermissions: normalizeStringArray(
          entry.declaredPermissions,
          `${field}.declaredPermissions`,
        ),
        allowedPermissions: normalizeStringArray(
          entry.allowedPermissions,
          `${field}.allowedPermissions`,
        ),
        ...(installScriptsPresent === null ? {} : { installScriptsPresent }),
        ...(networkEgressDeclared === null ? {} : { networkEgressDeclared }),
        ...(generatedArtifact === null ? {} : { generatedArtifact }),
        ...(generatedArtifactReviewed === null ? {} : { generatedArtifactReviewed }),
        ...(domainPackBoundaryVerified === null ? {} : { domainPackBoundaryVerified }),
        ...(adapterReadinessDigest === null ? {} : { adapterReadinessDigest }),
        ...(runtimeReplayTestDigest === null ? {} : { runtimeReplayTestDigest }),
      });
    }),
  );
}

function normalizeGenericAgenticSupplyChain(
  value: unknown,
): GenericAdmissionAgenticSupplyChain | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission agenticSupplyChain must be an object when provided.',
    );
  }
  return Object.freeze({
    components: normalizeGenericAgenticSupplyChainComponents(value.components),
  });
}

function normalizeGenericHumanReviewFatigueMetrics(
  value: unknown,
): GenericAdmissionHumanReviewFatigue['metrics'] {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission humanReviewFatigue.metrics must be an object when provided.',
    );
  }
  return Object.freeze({
    totalReviewItems: normalizeOptionalNonNegativeFiniteNumber(
      value.totalReviewItems,
      'humanReviewFatigue.metrics.totalReviewItems',
    ),
    lowPriorityItems: normalizeOptionalNonNegativeFiniteNumber(
      value.lowPriorityItems,
      'humanReviewFatigue.metrics.lowPriorityItems',
    ),
    blockerItems: normalizeOptionalNonNegativeFiniteNumber(
      value.blockerItems,
      'humanReviewFatigue.metrics.blockerItems',
    ),
    noGoItems: normalizeOptionalNonNegativeFiniteNumber(
      value.noGoItems,
      'humanReviewFatigue.metrics.noGoItems',
    ),
    missingEvidenceItems: normalizeOptionalNonNegativeFiniteNumber(
      value.missingEvidenceItems,
      'humanReviewFatigue.metrics.missingEvidenceItems',
    ),
    focusAreaCount: normalizeOptionalNonNegativeFiniteNumber(
      value.focusAreaCount,
      'humanReviewFatigue.metrics.focusAreaCount',
    ),
    evidenceDigestCardCount: normalizeOptionalNonNegativeFiniteNumber(
      value.evidenceDigestCardCount,
      'humanReviewFatigue.metrics.evidenceDigestCardCount',
    ),
    taskCount: normalizeOptionalNonNegativeFiniteNumber(
      value.taskCount,
      'humanReviewFatigue.metrics.taskCount',
    ),
    findingCount: normalizeOptionalNonNegativeFiniteNumber(
      value.findingCount,
      'humanReviewFatigue.metrics.findingCount',
    ),
    reviewerInstructionCount: normalizeOptionalNonNegativeFiniteNumber(
      value.reviewerInstructionCount,
      'humanReviewFatigue.metrics.reviewerInstructionCount',
    ),
    estimatedReviewMinutes: normalizeOptionalNonNegativeFiniteNumber(
      value.estimatedReviewMinutes,
      'humanReviewFatigue.metrics.estimatedReviewMinutes',
    ),
    blockersFirst: readOptionalBoolean(value, 'blockersFirst'),
    hasNoGoSummary: readOptionalBoolean(value, 'hasNoGoSummary'),
    hasMissingEvidenceSummary: readOptionalBoolean(value, 'hasMissingEvidenceSummary'),
    hasReviewerFocusAreas: readOptionalBoolean(value, 'hasReviewerFocusAreas'),
    hasNextSafeStep: readOptionalBoolean(value, 'hasNextSafeStep'),
    approvalRequired: readOptionalBoolean(value, 'approvalRequired'),
    rawPayloadStored: readOptionalBoolean(value, 'rawPayloadStored'),
    autoEnforceRequested: readOptionalBoolean(value, 'autoEnforceRequested'),
    reviewDecisionCount: normalizeOptionalNonNegativeFiniteNumber(
      value.reviewDecisionCount,
      'humanReviewFatigue.metrics.reviewDecisionCount',
    ),
    approvedDecisionCount: normalizeOptionalNonNegativeFiniteNumber(
      value.approvedDecisionCount,
      'humanReviewFatigue.metrics.approvedDecisionCount',
    ),
    distinctReviewerCount: normalizeOptionalNonNegativeFiniteNumber(
      value.distinctReviewerCount,
      'humanReviewFatigue.metrics.distinctReviewerCount',
    ),
    medianDecisionSeconds: normalizeOptionalNonNegativeFiniteNumber(
      value.medianDecisionSeconds,
      'humanReviewFatigue.metrics.medianDecisionSeconds',
    ),
    minimumDecisionSeconds: normalizeOptionalNonNegativeFiniteNumber(
      value.minimumDecisionSeconds,
      'humanReviewFatigue.metrics.minimumDecisionSeconds',
    ),
    consecutiveApprovalCount: normalizeOptionalNonNegativeFiniteNumber(
      value.consecutiveApprovalCount,
      'humanReviewFatigue.metrics.consecutiveApprovalCount',
    ),
    reviewerBehaviorTelemetryPresent:
      readOptionalBoolean(value, 'reviewerBehaviorTelemetryPresent'),
  });
}

function normalizeGenericHumanReviewFatigueThresholds(
  value: unknown,
): GenericAdmissionHumanReviewFatigue['thresholds'] {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission humanReviewFatigue.thresholds must be an object when provided.',
    );
  }
  return Object.freeze({
    maxReviewItems: normalizeOptionalNonNegativeFiniteNumber(
      value.maxReviewItems,
      'humanReviewFatigue.thresholds.maxReviewItems',
    ),
    maxLowPriorityRatio: normalizeOptionalNonNegativeFiniteNumber(
      value.maxLowPriorityRatio,
      'humanReviewFatigue.thresholds.maxLowPriorityRatio',
    ),
    maxReviewerInstructionCount: normalizeOptionalNonNegativeFiniteNumber(
      value.maxReviewerInstructionCount,
      'humanReviewFatigue.thresholds.maxReviewerInstructionCount',
    ),
    maxEstimatedReviewMinutes: normalizeOptionalNonNegativeFiniteNumber(
      value.maxEstimatedReviewMinutes,
      'humanReviewFatigue.thresholds.maxEstimatedReviewMinutes',
    ),
    minReviewDecisionCountForBehaviorSignals: normalizeOptionalNonNegativeFiniteNumber(
      value.minReviewDecisionCountForBehaviorSignals,
      'humanReviewFatigue.thresholds.minReviewDecisionCountForBehaviorSignals',
    ),
    maxApprovalRatio: normalizeOptionalNonNegativeFiniteNumber(
      value.maxApprovalRatio,
      'humanReviewFatigue.thresholds.maxApprovalRatio',
    ),
    minMedianDecisionSeconds: normalizeOptionalNonNegativeFiniteNumber(
      value.minMedianDecisionSeconds,
      'humanReviewFatigue.thresholds.minMedianDecisionSeconds',
    ),
    minDistinctReviewers: normalizeOptionalNonNegativeFiniteNumber(
      value.minDistinctReviewers,
      'humanReviewFatigue.thresholds.minDistinctReviewers',
    ),
    maxConsecutiveApprovals: normalizeOptionalNonNegativeFiniteNumber(
      value.maxConsecutiveApprovals,
      'humanReviewFatigue.thresholds.maxConsecutiveApprovals',
    ),
  });
}

function normalizeGenericHumanReviewFatigue(
  value: unknown,
): GenericAdmissionHumanReviewFatigue | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission humanReviewFatigue must be an object when provided.',
    );
  }
  const reviewSurfaceKind = readOptionalString(value, 'reviewSurfaceKind');
  return Object.freeze({
    reviewSurfaceKind: reviewSurfaceKind === null
      ? null
      : normalizeEnumValue(
          reviewSurfaceKind,
          CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS,
          'humanReviewFatigue.reviewSurfaceKind',
        ),
    reviewPacketRef: readOptionalString(value, 'reviewPacketRef'),
    metrics: normalizeGenericHumanReviewFatigueMetrics(value.metrics),
    thresholds: normalizeGenericHumanReviewFatigueThresholds(value.thresholds),
  });
}

function normalizeGenericMultiAgentDelegationPrincipals(
  value: unknown,
): readonly GenericAdmissionMultiAgentDelegationPrincipal[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error(
      'Consequence admission multiAgentDelegation.principalChain must be an array when provided.',
    );
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `multiAgentDelegation.principalChain[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      return Object.freeze({
        principalRef: readRequiredString(entry, 'principalRef'),
        principalKind: normalizeEnumValue(
          readRequiredString(entry, 'principalKind'),
          CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS,
          `${field}.principalKind`,
        ),
        role: normalizeEnumValue(
          readRequiredString(entry, 'role'),
          CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES,
          `${field}.role`,
        ),
        tenantId: readOptionalString(entry, 'tenantId'),
        identityDigest: readOptionalString(entry, 'identityDigest'),
        authorityDigest: readOptionalString(entry, 'authorityDigest'),
        scopeDigest: readOptionalString(entry, 'scopeDigest'),
        transportBindingDigest: readOptionalString(entry, 'transportBindingDigest'),
      });
    }),
  );
}

function normalizeGenericMultiAgentDelegation(
  value: unknown,
): GenericAdmissionMultiAgentDelegation | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission multiAgentDelegation must be an object when provided.',
    );
  }
  return Object.freeze({
    principalChain: normalizeGenericMultiAgentDelegationPrincipals(value.principalChain),
    maxDelegationDepth: normalizeOptionalPositiveInteger(
      value.maxDelegationDepth,
      'multiAgentDelegation.maxDelegationDepth',
    ),
    requestedDelegatedScopeDigest: readOptionalString(value, 'requestedDelegatedScopeDigest'),
    approvedDelegatedScopeDigest: readOptionalString(value, 'approvedDelegatedScopeDigest'),
    delegatingAuthorityDigest: readOptionalString(value, 'delegatingAuthorityDigest'),
  });
}

function normalizeGenericStaleAuthorityPolicy(
  value: unknown,
): GenericAdmissionStaleAuthorityPolicy | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission staleAuthorityPolicy must be an object when provided.',
    );
  }
  const driftState = readOptionalString(value, 'driftState');

  return Object.freeze({
    policyVersion: readOptionalString(value, 'policyVersion'),
    currentPolicyVersion: readOptionalString(value, 'currentPolicyVersion'),
    policyDigest: readOptionalString(value, 'policyDigest'),
    currentPolicyDigest: readOptionalString(value, 'currentPolicyDigest'),
    policyUpdatedAt: readOptionalTimestamp(value, 'policyUpdatedAt'),
    policySupersededAt: readOptionalTimestamp(value, 'policySupersededAt'),
    approvalIssuedAt: readOptionalTimestamp(value, 'approvalIssuedAt'),
    approvalValidFrom: readOptionalTimestamp(value, 'approvalValidFrom'),
    approvalValidUntil: readOptionalTimestamp(value, 'approvalValidUntil'),
    authorityCheckedAt: readOptionalTimestamp(value, 'authorityCheckedAt'),
    authorityExpiresAt: readOptionalTimestamp(value, 'authorityExpiresAt'),
    maxAuthorityAgeSeconds: normalizeOptionalPositiveInteger(
      value.maxAuthorityAgeSeconds,
      'staleAuthorityPolicy.maxAuthorityAgeSeconds',
    ),
    driftState: driftState === null
      ? null
      : normalizeEnumValue(
        driftState,
        CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES,
        'staleAuthorityPolicy.driftState',
      ),
    noGoReasons: normalizeStringArray(value.noGoReasons, 'staleAuthorityPolicy.noGoReasons'),
  });
}

function normalizeGenericDecisionContextBindingContext(
  value: unknown,
  fieldName: string,
): GenericAdmissionDecisionContextBindingContext | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an object when provided.`);
  }
  return Object.freeze({
    modelVersion: readOptionalString(value, 'modelVersion'),
    toolSchemaDigest: readOptionalString(value, 'toolSchemaDigest'),
    toolManifestDigest: readOptionalString(value, 'toolManifestDigest'),
    policyVersion: readOptionalString(value, 'policyVersion'),
    policyDigest: readOptionalString(value, 'policyDigest'),
    configDigest: readOptionalString(value, 'configDigest'),
    promptDigest: readOptionalString(value, 'promptDigest'),
    verifierDigest: readOptionalString(value, 'verifierDigest'),
    simulationDigest: readOptionalString(value, 'simulationDigest'),
    evaluatedAt: readOptionalTimestamp(value, 'evaluatedAt'),
    expiresAt: readOptionalTimestamp(value, 'expiresAt'),
  });
}

function normalizeGenericDecisionContextDrift(
  value: unknown,
): GenericAdmissionDecisionContextDrift | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission decisionContextDrift must be an object when provided.',
    );
  }
  return Object.freeze({
    boundContext: normalizeGenericDecisionContextBindingContext(
      value.boundContext,
      'decisionContextDrift.boundContext',
    ),
    currentContext: normalizeGenericDecisionContextBindingContext(
      value.currentContext,
      'decisionContextDrift.currentContext',
    ),
    requireSimulationRefresh: readOptionalBoolean(value, 'requireSimulationRefresh'),
    maxContextAgeHours: normalizeOptionalPositiveFiniteNumber(
      value.maxContextAgeHours,
      'decisionContextDrift.maxContextAgeHours',
    ),
  });
}

function normalizeGenericAuthorityCreep(
  value: unknown,
): GenericAdmissionAuthorityCreep | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    throw new Error(
      'Consequence admission authorityCreep must be an object when provided.',
    );
  }
  const lineageGraph = value.lineageGraph;
  if (!isRecord(lineageGraph)) {
    throw new Error(
      'Consequence admission authorityCreep.lineageGraph must be an object when provided.',
    );
  }
  const measurementPlane = value.measurementPlane;
  if (
    measurementPlane !== undefined &&
    measurementPlane !== null &&
    !isRecord(measurementPlane)
  ) {
    throw new Error(
      'Consequence admission authorityCreep.measurementPlane must be an object when provided.',
    );
  }

  return Object.freeze({
    lineageGraph: lineageGraph as unknown as DecisionLineageGraphRecord,
    evaluatorRefDigest: readRequiredString(value, 'evaluatorRefDigest'),
    guardId: readOptionalString(value, 'guardId'),
    targetClaimNodeId: readOptionalString(value, 'targetClaimNodeId'),
    measurementPlane: measurementPlane === undefined || measurementPlane === null
      ? null
      : measurementPlane as unknown as AssuranceMeasurementPlane,
    evidenceNodeId: readOptionalString(value, 'evidenceNodeId'),
    defeaterId: readOptionalString(value, 'defeaterId'),
    rawPayloadRequested: readOptionalBoolean(value, 'rawPayloadRequested'),
    rawEvidenceRequested: readOptionalBoolean(value, 'rawEvidenceRequested'),
    auditWriteRequested: readOptionalBoolean(value, 'auditWriteRequested'),
    policyActivationRequested:
      readOptionalBoolean(value, 'policyActivationRequested'),
    liveEnforcementRequested:
      readOptionalBoolean(value, 'liveEnforcementRequested'),
    authorityActionRequested:
      readOptionalBoolean(value, 'authorityActionRequested'),
  });
}

function normalizeGenericObservedFeatures(
  value: unknown,
): Readonly<Record<string, GenericAdmissionFeatureValue>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('Consequence admission observedFeatures must be an object when provided.');
  }
  const normalized: Record<string, GenericAdmissionFeatureValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatures key');
    if (
      entry !== null &&
      typeof entry !== 'string' &&
      typeof entry !== 'number' &&
      typeof entry !== 'boolean'
    ) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be scalar or null.`,
      );
    }
    if (typeof entry === 'number' && !Number.isFinite(entry)) {
      throw new Error(
        `Consequence admission observedFeatures.${normalizedKey} must be finite.`,
      );
    }
    normalized[normalizedKey] = entry;
  }
  return Object.freeze(normalized);
}

function normalizeGenericObservedFeatureOrigins(
  value: unknown,
): Readonly<Record<string, GenericAdmissionObservedFeatureOrigin>> {
  if (value === undefined || value === null) return Object.freeze({});
  if (!isRecord(value)) {
    throw new Error('Consequence admission observedFeatureOrigins must be an object when provided.');
  }
  const normalized: Record<string, GenericAdmissionObservedFeatureOrigin> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeIdentifier(key, 'observedFeatureOrigins key');
    if (typeof entry !== 'string') {
      throw new Error(
        `Consequence admission observedFeatureOrigins.${normalizedKey} must be a string.`,
      );
    }
    normalized[normalizedKey] = normalizeEnumValue(
      entry,
      GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS,
      `observedFeatureOrigins.${normalizedKey}`,
    );
  }
  return Object.freeze(normalized);
}

function normalizeGenericAuthoritySources(
  value: unknown,
): readonly GenericAdmissionAuthoritySource[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission authoritySources must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `authoritySources[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceKind = normalizeEnumValue(
        readRequiredString(entry, 'sourceKind'),
        CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS,
        `${field}.sourceKind`,
      );
      const claimKind = normalizeEnumValue(
        readRequiredString(entry, 'claimKind'),
        CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS,
        `${field}.claimKind`,
      );
      const trustClassValue = readOptionalString(entry, 'trustClass');
      const evidenceDigest = readOptionalString(entry, 'evidenceDigest');
      return Object.freeze({
        sourceKind,
        claimKind,
        sourceRef: readRequiredString(entry, 'sourceRef'),
        ...(trustClassValue === null
          ? {}
          : {
              trustClass: normalizeEnumValue(
                trustClassValue,
                CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES,
                `${field}.trustClass`,
              ),
            }),
        ...(evidenceDigest === null ? {} : { evidenceDigest }),
      });
    }),
  );
}

function normalizeGenericApprovals(
  value: unknown,
): readonly GenericAdmissionApproval[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission approvals must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `approvals[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceKind = normalizeEnumValue(
        readRequiredString(entry, 'sourceKind'),
        CONSEQUENCE_APPROVAL_SOURCE_KINDS,
        `${field}.sourceKind`,
      );
      const stateValue = readOptionalString(entry, 'state');
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const reviewerRef = readOptionalString(entry, 'reviewerRef');
      const reviewerAuthorityDigest = readOptionalString(entry, 'reviewerAuthorityDigest');
      const approvalDigest = readOptionalString(entry, 'approvalDigest');
      const scopeDigest = readOptionalString(entry, 'scopeDigest');
      const issuedAt = readOptionalTimestamp(entry, 'issuedAt');
      const expiresAt = readOptionalTimestamp(entry, 'expiresAt');
      const trustClassValue = readOptionalString(entry, 'trustClass');
      const signatureVerified = readOptionalBoolean(entry, 'signatureVerified');
      const stepUpVerified = readOptionalBoolean(entry, 'stepUpVerified');
      return Object.freeze({
        approvalRef: readRequiredString(entry, 'approvalRef'),
        sourceKind,
        ...(stateValue === null
          ? {}
          : {
              state: normalizeEnumValue(
                stateValue,
                CONSEQUENCE_APPROVAL_STATES,
                `${field}.state`,
              ),
            }),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(reviewerRef === null ? {} : { reviewerRef }),
        ...(reviewerAuthorityDigest === null ? {} : { reviewerAuthorityDigest }),
        ...(approvalDigest === null ? {} : { approvalDigest }),
        ...(scopeDigest === null ? {} : { scopeDigest }),
        ...(issuedAt === null ? {} : { issuedAt }),
        ...(expiresAt === null ? {} : { expiresAt }),
        ...(trustClassValue === null
          ? {}
          : {
              trustClass: normalizeEnumValue(
                trustClassValue,
                CONSEQUENCE_APPROVAL_TRUST_CLASSES,
                `${field}.trustClass`,
              ),
            }),
        ...(signatureVerified === null ? {} : { signatureVerified }),
        ...(stepUpVerified === null ? {} : { stepUpVerified }),
      });
    }),
  );
}

function normalizeGenericNoGoConditions(
  value: unknown,
): readonly GenericAdmissionNoGoCondition[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission noGoConditions must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `noGoConditions[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceRef = normalizeOptionalIdentifier(
        entry.sourceRef as string | null | undefined,
        `${field}.sourceRef`,
      );
      const ownerRef = normalizeOptionalIdentifier(
        entry.ownerRef as string | null | undefined,
        `${field}.ownerRef`,
      );
      const ownerAuthorityDigest = normalizeOptionalIdentifier(
        entry.ownerAuthorityDigest as string | null | undefined,
        `${field}.ownerAuthorityDigest`,
      );
      const scopeDigest = normalizeOptionalIdentifier(
        entry.scopeDigest as string | null | undefined,
        `${field}.scopeDigest`,
      );
      const issuedAt = normalizeOptionalIdentifier(
        entry.issuedAt as string | null | undefined,
        `${field}.issuedAt`,
      );
      const expiresAt = normalizeOptionalIdentifier(
        entry.expiresAt as string | null | undefined,
        `${field}.expiresAt`,
      );
      const releaseDigest = normalizeOptionalIdentifier(
        entry.releaseDigest as string | null | undefined,
        `${field}.releaseDigest`,
      );
      return Object.freeze({
        conditionRef: normalizeIdentifier(
          entry.conditionRef as string | null | undefined,
          `${field}.conditionRef`,
        ),
        kind: normalizeEnumValue(
          normalizeIdentifier(entry.kind as string | null | undefined, `${field}.kind`),
          CONSEQUENCE_NO_GO_CONDITION_KINDS,
          `${field}.kind`,
        ),
        state: normalizeEnumValue(
          normalizeIdentifier(entry.state as string | null | undefined, `${field}.state`),
          CONSEQUENCE_NO_GO_CONDITION_STATES,
          `${field}.state`,
        ),
        sourceKind: normalizeEnumValue(
          normalizeIdentifier(
            entry.sourceKind as string | null | undefined,
            `${field}.sourceKind`,
          ),
          CONSEQUENCE_NO_GO_CONDITION_SOURCE_KINDS,
          `${field}.sourceKind`,
        ),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(ownerRef === null ? {} : { ownerRef }),
        ...(ownerAuthorityDigest === null ? {} : { ownerAuthorityDigest }),
        ...(scopeDigest === null ? {} : { scopeDigest }),
        ...(issuedAt === null ? {} : { issuedAt }),
        ...(expiresAt === null ? {} : { expiresAt }),
        ...(releaseDigest === null ? {} : { releaseDigest }),
      });
    }),
  );
}

function retryAttemptIdFor(
  input: Omit<ConsequenceAdmissionRetryAttemptBinding, 'attemptId'>,
): string {
  return `retry-attempt:${canonicalObject(input as unknown as CanonicalReleaseJsonValue).digest}`;
}

function normalizeRetryAttemptBinding(
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

function normalizeCreateGenericAdmissionInput(input: unknown): CreateGenericAdmissionInput {
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

function observedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return input.observedFeatures?.[key] === true;
}

function observedFeatureOriginFor(
  input: CreateGenericAdmissionInput,
  key: string,
): GenericAdmissionObservedFeatureOrigin | null {
  return input.observedFeatureOrigins?.[key] ?? null;
}

function observedFeatureHasTrustedOrigin(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  const origin = observedFeatureOriginFor(input, key);
  return origin !== null && GENERIC_ADMISSION_TRUSTED_OBSERVED_FEATURE_ORIGINS.has(origin);
}

function trustedObservedFeatureTrue(
  input: CreateGenericAdmissionInput,
  key: string,
): boolean {
  return observedFeatureTrue(input, key) && observedFeatureHasTrustedOrigin(input, key);
}

function genericAdmissionAuthorityGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceUntrustedContentAuthorityDecision | null {
  const profile = consequenceAdmissionDomainProfile(input.domain);
  const authorityRequired = profile.requiredChecks.includes('authority');
  const authoritySources = input.authoritySources ?? [];
  if (!authorityRequired && authoritySources.length === 0) return null;
  return evaluateConsequenceUntrustedContentAuthority({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    requiredAuthority: authorityRequired,
    sources: authoritySources,
  });
}

function authorityGuardReviewReasonCodes(
  decision: ConsequenceUntrustedContentAuthorityDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionRequiresApprovalProvenance(
  input: CreateGenericAdmissionInput,
): boolean {
  return (input.approvals ?? []).length > 0 ||
    (input.authoritySources ?? []).some((source) => source.claimKind === 'approval');
}

function genericAdmissionApprovalGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceApprovalProvenanceDecision | null {
  if (!genericAdmissionRequiresApprovalProvenance(input)) return null;
  return evaluateConsequenceApprovalProvenance({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    approvals: input.approvals ?? [],
  });
}

function approvalGuardReviewReasonCodes(
  decision: ConsequenceApprovalProvenanceDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHasScopeExplosionInput(
  input: CreateGenericAdmissionInput,
): boolean {
  return (input.scopeOwnerPolicyRef !== null && input.scopeOwnerPolicyRef !== undefined) ||
    (input.requestedScope !== null && input.requestedScope !== undefined) ||
    (input.approvedScope !== null && input.approvedScope !== undefined);
}

function genericAdmissionScopeExplosionGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceScopeExplosionDecision | null {
  if (!genericAdmissionHasScopeExplosionInput(input)) return null;
  return evaluateConsequenceScopeExplosion({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    scopeOwnerPolicyRef: input.scopeOwnerPolicyRef ?? null,
    requestedScope: input.requestedScope ?? null,
    approvedScope: input.approvedScope ?? null,
  });
}

function scopeExplosionReviewReasonCodes(
  decision: ConsequenceScopeExplosionDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass' || decision.outcome === 'narrow') {
    return Object.freeze([]);
  }
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHasToolResultInput(
  input: CreateGenericAdmissionInput,
): boolean {
  return (input.allowedToolResultEvidenceClasses !== null &&
    input.allowedToolResultEvidenceClasses !== undefined) ||
    (input.toolResults !== null && input.toolResults !== undefined);
}

function genericAdmissionToolResultGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceToolResultPoisoningDecision | null {
  if (!genericAdmissionHasToolResultInput(input)) return null;
  return evaluateConsequenceToolResultPoisoning({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    allowedEvidenceClasses: input.allowedToolResultEvidenceClasses ?? null,
    toolResults: input.toolResults ?? null,
  });
}

function toolResultGuardReviewReasonCodes(
  decision: ConsequenceToolResultPoisoningDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionAgenticSupplyChainGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceAgenticSupplyChainDecision | null {
  if (input.agenticSupplyChain === null || input.agenticSupplyChain === undefined) {
    return null;
  }
  return evaluateConsequenceAgenticSupplyChain({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    components: input.agenticSupplyChain.components,
  });
}

function agenticSupplyChainReviewReasonCodes(
  decision: ConsequenceAgenticSupplyChainDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHumanReviewFatigueGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceHumanReviewFatigueDecision | null {
  if (input.humanReviewFatigue === null || input.humanReviewFatigue === undefined) {
    return null;
  }
  return evaluateConsequenceHumanReviewFatigue({
    ...input.humanReviewFatigue,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function humanReviewFatigueReviewReasonCodes(
  decision: ConsequenceHumanReviewFatigueDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionMultiAgentDelegationGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceMultiAgentDelegationDecision | null {
  if (input.multiAgentDelegation === null || input.multiAgentDelegation === undefined) {
    return null;
  }
  return evaluateConsequenceMultiAgentDelegation({
    ...input.multiAgentDelegation,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function multiAgentDelegationReviewReasonCodes(
  decision: ConsequenceMultiAgentDelegationDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionStaleAuthorityPolicyGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceStaleAuthorityPolicyDecision | null {
  if (input.staleAuthorityPolicy === null || input.staleAuthorityPolicy === undefined) {
    return null;
  }
  return evaluateConsequenceStaleAuthorityPolicy({
    ...input.staleAuthorityPolicy,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function staleAuthorityPolicyReviewReasonCodes(
  decision: ConsequenceStaleAuthorityPolicyDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionDecisionContextDriftDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceDecisionContextDriftDecision | null {
  if (input.decisionContextDrift === null || input.decisionContextDrift === undefined) {
    return null;
  }
  return evaluateConsequenceDecisionContextDrift({
    ...input.decisionContextDrift,
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
  });
}

function decisionContextDriftReviewReasonCodes(
  decision: ConsequenceDecisionContextDriftDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function authorityCreepFallbackGuardId(input: CreateGenericAdmissionInput): string {
  const authorityCreep = input.authorityCreep;
  const digest = canonicalObject({
    version: AUTHORITY_CREEP_GUARD_VERSION,
    domain: input.domain,
    action: input.action,
    requestedAt: input.requestedAt ?? null,
    decidedAt: input.decidedAt ?? null,
    lineageDigest: authorityCreep?.lineageGraph.digest ?? null,
    measurementPlaneDigest: authorityCreep?.measurementPlane?.digest ?? null,
  } as unknown as CanonicalReleaseJsonValue).digest;
  return `guard:generic-admission:authority-creep:${digest}`;
}

function genericAdmissionAuthorityCreepGuardDecisionFor(
  input: CreateGenericAdmissionInput,
): AuthorityCreepGuardRecord | null {
  if (input.authorityCreep === null || input.authorityCreep === undefined) {
    return null;
  }
  return createAuthorityCreepGuard({
    lineageGraph: input.authorityCreep.lineageGraph,
    guardId: input.authorityCreep.guardId ?? authorityCreepFallbackGuardId(input),
    evaluatedAt:
      input.decidedAt ??
      input.requestedAt ??
      input.authorityCreep.lineageGraph.generatedAt,
    evaluatorRefDigest: input.authorityCreep.evaluatorRefDigest,
    targetClaimNodeId: input.authorityCreep.targetClaimNodeId ?? null,
    measurementPlane: input.authorityCreep.measurementPlane ?? null,
    evidenceNodeId: input.authorityCreep.evidenceNodeId ?? null,
    defeaterId: input.authorityCreep.defeaterId ?? null,
    rawPayloadRequested: input.authorityCreep.rawPayloadRequested ?? null,
    rawEvidenceRequested: input.authorityCreep.rawEvidenceRequested ?? null,
    auditWriteRequested: input.authorityCreep.auditWriteRequested ?? null,
    policyActivationRequested: input.authorityCreep.policyActivationRequested ?? null,
    liveEnforcementRequested: input.authorityCreep.liveEnforcementRequested ?? null,
    authorityActionRequested: input.authorityCreep.authorityActionRequested ?? null,
  });
}

function authorityCreepReviewReasonCodes(
  decision: AuthorityCreepGuardRecord | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'authority-creep-evidence-ready') {
    return Object.freeze([]);
  }
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionHasNoGoConditionInput(
  input: CreateGenericAdmissionInput,
): boolean {
  return input.noGoLedgerRef !== null && input.noGoLedgerRef !== undefined ||
    input.noGoConditions !== null && input.noGoConditions !== undefined ||
    input.noGoNaturalLanguageBypassAttempted === true ||
    (input.noGoNaturalLanguageSignals ?? []).length > 0 ||
    input.noGoBypassAttemptRef !== null && input.noGoBypassAttemptRef !== undefined;
}

function genericAdmissionNoGoConditionLedgerDecisionFor(
  input: CreateGenericAdmissionInput,
): ConsequenceNoGoConditionLedgerDecision | null {
  if (!genericAdmissionHasNoGoConditionInput(input)) return null;
  return evaluateConsequenceNoGoConditionLedger({
    generatedAt: input.decidedAt ?? input.requestedAt ?? null,
    actionSurface: input.domain,
    action: input.action,
    ledgerRef: input.noGoLedgerRef ?? null,
    conditions: input.noGoConditions ?? null,
    naturalLanguageBypassAttempted: input.noGoNaturalLanguageBypassAttempted ?? null,
    naturalLanguageSignals: input.noGoNaturalLanguageSignals ?? [],
    bypassAttemptRef: input.noGoBypassAttemptRef ?? null,
  });
}

function noGoConditionLedgerReviewReasonCodes(
  decision: ConsequenceNoGoConditionLedgerDecision | null,
): readonly string[] {
  if (decision === null || decision.outcome === 'pass') return Object.freeze([]);
  return Object.freeze([...decision.reasonCodes]);
}

function genericAdmissionReviewReasons(
  input: CreateGenericAdmissionInput,
  authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null,
  approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null,
  scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null,
  toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null,
  agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null,
  humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null,
  multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null,
  staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null,
  decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null,
  authorityCreepGuardDecision: AuthorityCreepGuardRecord | null,
  noGoConditionLedgerDecision: ConsequenceNoGoConditionLedgerDecision | null,
): readonly string[] {
  const reasons: string[] = [];
  const profile = consequenceAdmissionDomainProfile(input.domain);

  if (!input.policyRef) reasons.push('policy-ref-missing');
  if ((input.evidenceRefs ?? []).length === 0) reasons.push('evidence-ref-missing');

  if (
    input.domain === 'money-movement' ||
    input.domain === 'programmable-money'
  ) {
    if (!input.amount) reasons.push('amount-scope-missing');
    if (!input.recipient) reasons.push('recipient-scope-missing');
  }

  if (input.domain === 'data-disclosure' && !input.dataScope) {
    reasons.push('data-scope-missing');
  }

  if (input.domain === 'authority-change' && !input.authorityMode) {
    reasons.push('authority-mode-missing');
  }
  reasons.push(...authorityGuardReviewReasonCodes(authorityGuardDecision));
  reasons.push(...approvalGuardReviewReasonCodes(approvalGuardDecision));
  reasons.push(...scopeExplosionReviewReasonCodes(scopeExplosionGuardDecision));
  reasons.push(...toolResultGuardReviewReasonCodes(toolResultGuardDecision));
  reasons.push(...agenticSupplyChainReviewReasonCodes(agenticSupplyChainGuardDecision));
  reasons.push(...humanReviewFatigueReviewReasonCodes(humanReviewFatigueGuardDecision));
  reasons.push(...multiAgentDelegationReviewReasonCodes(multiAgentDelegationGuardDecision));
  reasons.push(...staleAuthorityPolicyReviewReasonCodes(staleAuthorityPolicyGuardDecision));
  reasons.push(...decisionContextDriftReviewReasonCodes(decisionContextDriftDecision));
  reasons.push(...authorityCreepReviewReasonCodes(authorityCreepGuardDecision));
  reasons.push(...noGoConditionLedgerReviewReasonCodes(noGoConditionLedgerDecision));

  if (profile.requiredChecks.includes('adapter-readiness')) {
    if (!observedFeatureTrue(input, 'adapterReady')) {
      reasons.push('adapter-readiness-missing');
    } else if (!trustedObservedFeatureTrue(input, 'adapterReady')) {
      reasons.push('adapter-readiness-origin-untrusted');
    }
  }

  if (input.domain === 'custom') {
    reasons.push('custom-domain-review-required');
  }

  return Object.freeze(reasons);
}

function genericAdmissionShadowDecisionFor(
  input: CreateGenericAdmissionInput,
  reviewReasons: readonly string[],
  authorityGuardDecision: ConsequenceUntrustedContentAuthorityDecision | null,
  approvalGuardDecision: ConsequenceApprovalProvenanceDecision | null,
  scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null,
  toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null,
  agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null,
  humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null,
  multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null,
  staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null,
  decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null,
  authorityCreepGuardDecision: AuthorityCreepGuardRecord | null,
  noGoConditionLedgerDecision: ConsequenceNoGoConditionLedgerDecision | null,
): GenericAdmissionShadowDecision {
  if (authorityGuardDecision?.outcome === 'block') return 'would_block';
  if (approvalGuardDecision?.outcome === 'block') return 'would_block';
  if (scopeExplosionGuardDecision?.outcome === 'block') return 'would_block';
  if (toolResultGuardDecision?.outcome === 'block') return 'would_block';
  if (agenticSupplyChainGuardDecision?.outcome === 'block') return 'would_block';
  if (humanReviewFatigueGuardDecision?.outcome === 'block') return 'would_block';
  if (multiAgentDelegationGuardDecision?.outcome === 'block') return 'would_block';
  if (staleAuthorityPolicyGuardDecision?.outcome === 'block') return 'would_block';
  if (decisionContextDriftDecision?.outcome === 'block') return 'would_block';
  if (authorityCreepGuardDecision?.outcome === 'authority-creep-rejected-boundary') {
    return 'would_block';
  }
  if (noGoConditionLedgerDecision?.outcome === 'block') return 'would_block';
  if (
    observedFeatureTrue(input, 'policyBlocked') ||
    observedFeatureTrue(input, 'blocked') ||
    observedFeatureTrue(input, 'unsafe')
  ) {
    return 'would_block';
  }
  if (reviewReasons.length > 0) return 'would_review';
  if (scopeExplosionGuardDecision?.outcome === 'narrow') return 'would_narrow';
  if (observedFeatureTrue(input, 'narrowRequired')) return 'would_narrow';
  return 'would_admit';
}

function effectiveDecisionForGenericMode(
  mode: GenericAdmissionMode,
  shadowDecision: GenericAdmissionShadowDecision,
): ConsequenceAdmissionDecision {
  if (mode === 'observe' || mode === 'warn') return 'admit';
  if (mode === 'review') {
    return shadowDecision === 'would_admit' ? 'admit' : 'review';
  }
  if (shadowDecision === 'would_block') return 'block';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_narrow') return 'narrow';
  return 'admit';
}

function downstreamPostureForGenericMode(
  mode: GenericAdmissionMode,
  effectiveDecision: ConsequenceAdmissionDecision,
): GenericAdmissionDownstreamPosture {
  if (mode === 'observe') return 'observe-only';
  if (mode === 'warn') return 'warn-only';
  if (effectiveDecision === 'review') return 'hold-for-review';
  return 'enforce-decision';
}

function genericReasonCodes(
  input: CreateGenericAdmissionInput,
  shadowDecision: GenericAdmissionShadowDecision,
  reviewReasons: readonly string[],
  scopeExplosionGuardDecision: ConsequenceScopeExplosionDecision | null,
  toolResultGuardDecision: ConsequenceToolResultPoisoningDecision | null,
  agenticSupplyChainGuardDecision: ConsequenceAgenticSupplyChainDecision | null,
  humanReviewFatigueGuardDecision: ConsequenceHumanReviewFatigueDecision | null,
  multiAgentDelegationGuardDecision: ConsequenceMultiAgentDelegationDecision | null,
  staleAuthorityPolicyGuardDecision: ConsequenceStaleAuthorityPolicyDecision | null,
  decisionContextDriftDecision: ConsequenceDecisionContextDriftDecision | null,
  authorityCreepGuardDecision: AuthorityCreepGuardRecord | null,
): readonly string[] {
  const reasons = [
    `mode-${input.mode}`,
    `shadow-${shadowDecision}`,
    ...reviewReasons,
    ...(scopeExplosionGuardDecision?.reasonCodes ?? []),
    ...(toolResultGuardDecision?.reasonCodes ?? []),
    ...(agenticSupplyChainGuardDecision?.reasonCodes ?? []),
    ...(humanReviewFatigueGuardDecision?.reasonCodes ?? []),
    ...(multiAgentDelegationGuardDecision?.reasonCodes ?? []),
    ...(staleAuthorityPolicyGuardDecision?.reasonCodes ?? []),
    ...(decisionContextDriftDecision?.reasonCodes ?? []),
    ...(authorityCreepGuardDecision?.reasonCodes ?? []),
  ];
  if (input.mode === 'observe' || input.mode === 'warn') {
    reasons.push('non-enforcing-mode');
  }
  if (observedFeatureTrue(input, 'policyBlocked')) reasons.push('policy-blocked');
  if (observedFeatureTrue(input, 'blocked')) reasons.push('feature-blocked');
  if (observedFeatureTrue(input, 'unsafe')) reasons.push('feature-unsafe');
  if (observedFeatureTrue(input, 'narrowRequired')) reasons.push('narrow-required');
  if (input.retryAttempt !== null && input.retryAttempt !== undefined) {
    reasons.push('retry-attempt-bound');
  }
  return Object.freeze([...new Set(reasons)]);
}

function createGenericAdmissionEvaluation(
  input: CreateGenericAdmissionInput,
): GenericAdmissionModeEvaluation {
  const authorityGuardDecision = genericAdmissionAuthorityGuardDecisionFor(input);
  const approvalGuardDecision = genericAdmissionApprovalGuardDecisionFor(input);
  const scopeExplosionGuardDecision = genericAdmissionScopeExplosionGuardDecisionFor(input);
  const toolResultGuardDecision = genericAdmissionToolResultGuardDecisionFor(input);
  const agenticSupplyChainGuardDecision =
    genericAdmissionAgenticSupplyChainGuardDecisionFor(input);
  const humanReviewFatigueGuardDecision =
    genericAdmissionHumanReviewFatigueGuardDecisionFor(input);
  const multiAgentDelegationGuardDecision =
    genericAdmissionMultiAgentDelegationGuardDecisionFor(input);
  const staleAuthorityPolicyGuardDecision =
    genericAdmissionStaleAuthorityPolicyGuardDecisionFor(input);
  const decisionContextDriftDecision =
    genericAdmissionDecisionContextDriftDecisionFor(input);
  const authorityCreepGuardDecision =
    genericAdmissionAuthorityCreepGuardDecisionFor(input);
  const noGoConditionLedgerDecision = genericAdmissionNoGoConditionLedgerDecisionFor(input);
  const reviewReasons = genericAdmissionReviewReasons(
    input,
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    authorityCreepGuardDecision,
    noGoConditionLedgerDecision,
  );
  const shadowDecision = genericAdmissionShadowDecisionFor(
    input,
    reviewReasons,
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    authorityCreepGuardDecision,
    noGoConditionLedgerDecision,
  );
  const effectiveDecision = effectiveDecisionForGenericMode(input.mode, shadowDecision);
  const downstreamPosture = downstreamPostureForGenericMode(input.mode, effectiveDecision);

  return Object.freeze({
    mode: input.mode,
    shadowDecision,
    effectiveDecision,
    downstreamPosture,
    enforcementActive: input.mode === 'review' || input.mode === 'enforce',
    reasonCodes: genericReasonCodes(
      input,
      shadowDecision,
      reviewReasons,
      scopeExplosionGuardDecision,
      toolResultGuardDecision,
      agenticSupplyChainGuardDecision,
      humanReviewFatigueGuardDecision,
      multiAgentDelegationGuardDecision,
      staleAuthorityPolicyGuardDecision,
      decisionContextDriftDecision,
      authorityCreepGuardDecision,
    ),
    authorityGuardDecision,
    approvalGuardDecision,
    scopeExplosionGuardDecision,
    toolResultGuardDecision,
    agenticSupplyChainGuardDecision,
    humanReviewFatigueGuardDecision,
    multiAgentDelegationGuardDecision,
    staleAuthorityPolicyGuardDecision,
    decisionContextDriftDecision,
    authorityCreepGuardDecision,
    noGoConditionLedgerDecision,
  });
}

function reasonCodesForCheck(
  kind: ConsequenceAdmissionCheckKind,
  reasonCodes: readonly string[],
): readonly string[] {
  const matches = reasonCodes.filter((reason) => {
    if (reason.endsWith('-pass')) return false;
    if (kind === 'policy') {
      return reason.startsWith('policy-') ||
        reason.startsWith('current-policy-') ||
        reason === 'stale-policy-review' ||
        reason === 'stale-policy-block' ||
        reason.startsWith('drift-state-') ||
        reason === 'no-go-reason-present' ||
        reason === 'supply-chain-domain-pack-boundary-unverified' ||
        reason === 'policy-version-drift' ||
        reason === 'policy-digest-drift' ||
        reason === 'authority-creep-finding:policy-activation-requested' ||
        reason === 'authority-creep-finding:lineage-policy-activation-requested' ||
        GENERIC_ADMISSION_NO_GO_REASON_CODES.has(reason);
    }
    if (kind === 'authority') {
      return (reason.startsWith('authority-') &&
          !reason.startsWith('authority-creep-')) ||
        reason.startsWith('approval-') ||
        reason === 'authority-creep-finding:authority-action-requested' ||
        reason === 'authority-creep-finding:lineage-authority-action-requested' ||
        reason === 'supply-chain-owner-authority-missing' ||
        reason === 'supply-chain-review-missing' ||
        GENERIC_ADMISSION_MULTI_AGENT_DELEGATION_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_AUTHORITY_GUARD_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_APPROVAL_GUARD_REASON_CODES.has(reason);
    }
    if (kind === 'evidence') {
      return reason.startsWith('evidence-') ||
        reason.startsWith('authority-creep-finding:') ||
        reason.startsWith('authority-creep-blocked-metric-use:') ||
        reason === 'authority-creep-outcome:authority-creep-open-undercutting-defeater' ||
        reason === 'authority-creep-outcome:authority-creep-held-for-lineage-binding' ||
        reason === 'authority-creep-outcome:authority-creep-rejected-boundary' ||
        GENERIC_ADMISSION_TOOL_RESULT_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_AGENTIC_SUPPLY_CHAIN_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_HUMAN_REVIEW_FATIGUE_REASON_CODES.has(reason) ||
        GENERIC_ADMISSION_DECISION_CONTEXT_DRIFT_REASON_CODES.has(reason);
    }
    if (kind === 'enforcement') {
      return reason === 'non-enforcing-mode' ||
        reason === 'supply-chain-permission-scope-missing' ||
        reason === 'supply-chain-permission-overbroad' ||
        reason === 'supply-chain-install-scripts-present' ||
        reason === 'supply-chain-network-egress-unreviewed' ||
        reason === 'supply-chain-runtime-replay-missing' ||
        reason === 'authority-creep-finding:live-enforcement-requested' ||
        reason === 'authority-creep-finding:lineage-live-enforcement-requested' ||
        reason === 'authority-creep-outcome:authority-creep-rejected-boundary';
    }
    if (kind === 'adapter-readiness') {
      return reason.startsWith('adapter-') ||
        reason === 'supply-chain-adapter-readiness-missing';
    }
    if (kind === 'freshness') {
      return reason.startsWith('freshness-') ||
        reason.includes('freshness') ||
        reason === 'approval-validity-window-missing' ||
        reason === 'approval-not-yet-valid' ||
        reason === 'approval-expired' ||
        reason === 'authority-expired' ||
        reason === 'authority-expires-at-invalid' ||
        reason === 'decision-context-expired' ||
        reason === 'decision-context-age-exceeded' ||
        reason === 'simulation-refresh-required' ||
        reason === 'simulation-digest-missing';
    }
    return false;
  });
  return Object.freeze(matches);
}

function checkOutcomeForGenericMode(
  mode: GenericAdmissionMode,
  checkReasons: readonly string[],
): ConsequenceAdmissionCheckOutcome {
  if (checkReasons.length === 0) return 'pass';
  return mode === 'observe' || mode === 'warn' ? 'warn' : 'fail';
}

function createGenericAdmissionChecks(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionCheck[] {
  const profile = consequenceAdmissionDomainProfile(input.domain);
  return Object.freeze(
    profile.requiredChecks.map((kind) => {
      const checkReasons = reasonCodesForCheck(kind, evaluation.reasonCodes);
      const outcome = checkOutcomeForGenericMode(input.mode, checkReasons);
      const evidenceRefs =
        kind === 'authority'
          ? [
              ...(input.evidenceRefs ?? []),
              ...(evaluation.authorityGuardDecision !== null
                ? [evaluation.authorityGuardDecision.digest]
                : []),
              ...(evaluation.approvalGuardDecision !== null
                ? [evaluation.approvalGuardDecision.digest]
                : []),
              ...(evaluation.multiAgentDelegationGuardDecision !== null
                ? [evaluation.multiAgentDelegationGuardDecision.digest]
                : []),
              ...(evaluation.authorityCreepGuardDecision !== null &&
              evaluation.authorityCreepGuardDecision.findings.some((finding) =>
                finding.includes('authority-action'))
                ? [evaluation.authorityCreepGuardDecision.digest]
                : []),
            ]
          : kind === 'policy'
            ? [
                ...(input.evidenceRefs ?? []),
                ...(evaluation.noGoConditionLedgerDecision !== null
                  ? [evaluation.noGoConditionLedgerDecision.digest]
                  : []),
                ...(evaluation.decisionContextDriftDecision !== null
                  ? [evaluation.decisionContextDriftDecision.digest]
                  : []),
                ...(evaluation.authorityCreepGuardDecision !== null &&
                evaluation.authorityCreepGuardDecision.findings.some((finding) =>
                  finding.includes('policy-activation'))
                  ? [evaluation.authorityCreepGuardDecision.digest]
                  : []),
              ]
          : [
              ...(input.evidenceRefs ?? []),
              ...(evaluation.decisionContextDriftDecision !== null &&
              (kind === 'evidence' || kind === 'freshness')
                ? [evaluation.decisionContextDriftDecision.digest]
                : []),
              ...(evaluation.humanReviewFatigueGuardDecision !== null && kind === 'evidence'
                ? [evaluation.humanReviewFatigueGuardDecision.digest]
                : []),
              ...(evaluation.authorityCreepGuardDecision !== null && kind === 'evidence'
                ? [evaluation.authorityCreepGuardDecision.digest]
                : []),
            ];
      return createConsequenceAdmissionCheck({
        kind,
        label: `${kind} check`,
        outcome,
        required: input.mode === 'review' || input.mode === 'enforce',
        summary:
          outcome === 'pass'
            ? `${kind} closure is present for the proposed consequence.`
            : `${kind} closure is incomplete for the proposed consequence.`,
        reasonCodes: checkReasons,
        evidenceRefs,
      });
    }),
  );
}

function genericAdmissionReason(
  evaluation: GenericAdmissionModeEvaluation,
): string {
  if (evaluation.mode === 'observe') {
    return 'Observe mode recorded the shadow admission decision without blocking downstream execution.';
  }
  if (evaluation.mode === 'warn') {
    return 'Warn mode allowed the request while returning the shadow admission decision and warning checks.';
  }
  if (evaluation.effectiveDecision === 'review') {
    return 'The proposed consequence is held for review before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'block') {
    return 'The proposed consequence is blocked before downstream execution.';
  }
  if (evaluation.effectiveDecision === 'narrow') {
    return 'The proposed consequence may proceed only through the returned constraints.';
  }
  return 'The proposed consequence passed the generic admission mode ladder.';
}

function genericAdmissionConstraints(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionConstraint[] {
  if (evaluation.effectiveDecision !== 'narrow') return Object.freeze([]);
  const scopeConstraints =
    evaluation.scopeExplosionGuardDecision?.constraints.map((constraint) => Object.freeze({
      id: `constraint:${input.domain}:scope:${constraint.dimension}`,
      kind: inferConstraintKind(`${constraint.dimension}:${constraint.reasonCode}`),
      summary: constraint.safeSummary,
      enforcedBy: input.downstreamSystem,
      parameterDigest: constraint.constraintDigest,
    })) ?? [];
  if (scopeConstraints.length > 0) return Object.freeze(scopeConstraints);
  return Object.freeze([
    {
      id: `constraint:${input.domain}:generic-narrow`,
      kind: 'customer-approved-scope',
      summary: 'Proceed only with the customer-approved narrowed scope.',
      enforcedBy: input.downstreamSystem,
      parameterDigest: null,
    },
  ]);
}

function genericAdmissionProof(
  request: ConsequenceAdmissionRequest,
  evaluation: GenericAdmissionModeEvaluation,
): readonly ConsequenceAdmissionProofRef[] {
  if (evaluation.effectiveDecision !== 'admit' && evaluation.effectiveDecision !== 'narrow') {
    return Object.freeze([]);
  }
  return Object.freeze([
    {
      kind: 'admission-receipt',
      id: `generic-admission:${request.requestId}`,
      digest: request.requestId,
      uri: null,
      verifyHint:
        evaluation.mode === 'observe' || evaluation.mode === 'warn'
          ? 'Observe and warn modes are adoption modes; inspect shadowDecision before promoting to review or enforce.'
          : 'Verify the admission digest and downstream enforcement contract before execution.',
    },
  ]);
}

function genericAdmissionSummary(input: CreateGenericAdmissionInput): string {
  return input.summary ?? `${input.actor} proposes ${input.action} on ${input.downstreamSystem}.`;
}

function genericAdmissionDimensions(
  input: CreateGenericAdmissionInput,
  evaluation: GenericAdmissionModeEvaluation,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({
    domain: input.domain,
    mode: input.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    hasAmount: input.amount !== null && input.amount !== undefined,
    hasRecipient: input.recipient !== null && input.recipient !== undefined,
    hasDataScope: input.dataScope !== null && input.dataScope !== undefined,
    adapterReady: trustedObservedFeatureTrue(input, 'adapterReady'),
    adapterReadyObserved: observedFeatureTrue(input, 'adapterReady'),
    adapterReadyOrigin: observedFeatureOriginFor(input, 'adapterReady'),
    authorityGuardOutcome: evaluation.authorityGuardDecision?.outcome ?? null,
    authorityGuardDigest: evaluation.authorityGuardDecision?.digest ?? null,
    authoritySourceCount: evaluation.authorityGuardDecision?.counts.sourceCount ?? 0,
    trustedAuthoritySourceCount:
      evaluation.authorityGuardDecision?.counts.trustedAuthoritySourceCount ?? 0,
    untrustedAuthoritySourceCount:
      evaluation.authorityGuardDecision?.counts.untrustedAuthoritySourceCount ?? 0,
    approvalGuardOutcome: evaluation.approvalGuardDecision?.outcome ?? null,
    approvalGuardDigest: evaluation.approvalGuardDecision?.digest ?? null,
    approvalCount: evaluation.approvalGuardDecision?.counts.approvalCount ?? 0,
    validApprovalCount: evaluation.approvalGuardDecision?.counts.validApprovalCount ?? 0,
    untrustedApprovalCount:
      evaluation.approvalGuardDecision?.counts.untrustedApprovalCount ?? 0,
    noGoConditionOutcome: evaluation.noGoConditionLedgerDecision?.outcome ?? null,
    noGoConditionDigest: evaluation.noGoConditionLedgerDecision?.digest ?? null,
    noGoConditionCount:
      evaluation.noGoConditionLedgerDecision?.observed.conditionCount ?? 0,
    noGoActiveConditionCount:
      evaluation.noGoConditionLedgerDecision?.observed.activeCount ?? 0,
    noGoPendingReviewCount:
      evaluation.noGoConditionLedgerDecision?.observed.pendingReviewCount ?? 0,
    noGoUntrustedSourceCount:
      evaluation.noGoConditionLedgerDecision?.observed.untrustedSourceCount ?? 0,
    noGoNaturalLanguageBypassAttempted:
      evaluation.noGoConditionLedgerDecision?.observed.naturalLanguageBypassAttempted ?? false,
    noGoNaturalLanguageBypassSignalCount:
      evaluation.noGoConditionLedgerDecision?.observed.naturalLanguageBypassSignalCount ?? 0,
    scopeExplosionGuardOutcome: evaluation.scopeExplosionGuardDecision?.outcome ?? null,
    scopeExplosionGuardDigest: evaluation.scopeExplosionGuardDecision?.digest ?? null,
    scopeExceededDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.exceededDimensions.length ?? 0,
    scopeNarrowingDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.narrowingDimensions.length ?? 0,
    scopeBlockingDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.blockingDimensions.length ?? 0,
    scopeReviewDimensionCount:
      evaluation.scopeExplosionGuardDecision?.observed.reviewDimensions.length ?? 0,
    toolResultGuardOutcome: evaluation.toolResultGuardDecision?.outcome ?? null,
    toolResultGuardDigest: evaluation.toolResultGuardDecision?.digest ?? null,
    toolResultCount: evaluation.toolResultGuardDecision?.counts.toolResultCount ?? 0,
    trustedToolResultEvidenceCount:
      evaluation.toolResultGuardDecision?.counts.trustedEvidenceCount ?? 0,
    toolResultReviewCount: evaluation.toolResultGuardDecision?.counts.reviewCount ?? 0,
    toolResultBlockCount: evaluation.toolResultGuardDecision?.counts.blockCount ?? 0,
    untrustedToolResultSourceCount:
      evaluation.toolResultGuardDecision?.counts.untrustedSourceCount ?? 0,
    modelGeneratedToolResultSourceCount:
      evaluation.toolResultGuardDecision?.counts.modelGeneratedSourceCount ?? 0,
    toolResultMissingIntegrityCount:
      evaluation.toolResultGuardDecision?.counts.missingIntegrityCount ?? 0,
    toolResultMissingTimestampCount:
      evaluation.toolResultGuardDecision?.counts.missingTimestampCount ?? 0,
    toolResultEvidenceClassMismatchCount:
      evaluation.toolResultGuardDecision?.counts.evidenceClassMismatchCount ?? 0,
    agenticSupplyChainGuardOutcome:
      evaluation.agenticSupplyChainGuardDecision?.outcome ?? null,
    agenticSupplyChainGuardDigest:
      evaluation.agenticSupplyChainGuardDecision?.digest ?? null,
    agenticSupplyChainComponentCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.componentCount ?? 0,
    agenticSupplyChainBlockCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.blockCount ?? 0,
    agenticSupplyChainReviewCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.reviewCount ?? 0,
    agenticSupplyChainUnpinnedCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.unpinnedCount ?? 0,
    agenticSupplyChainMissingProvenanceCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.missingProvenanceCount ?? 0,
    agenticSupplyChainUnverifiedProvenanceCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.unverifiedProvenanceCount ?? 0,
    agenticSupplyChainOverbroadPermissionCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.overbroadPermissionCount ?? 0,
    agenticSupplyChainUnreviewedGeneratedArtifactCount:
      evaluation.agenticSupplyChainGuardDecision?.counts.unreviewedGeneratedArtifactCount ?? 0,
    humanReviewFatigueGuardOutcome:
      evaluation.humanReviewFatigueGuardDecision?.outcome ?? null,
    humanReviewFatigueGuardDigest:
      evaluation.humanReviewFatigueGuardDecision?.digest ?? null,
    humanReviewTotalReviewItems:
      evaluation.humanReviewFatigueGuardDecision?.observed.totalReviewItems ?? 0,
    humanReviewLowPriorityRatio:
      evaluation.humanReviewFatigueGuardDecision?.observed.lowPriorityRatio ?? 0,
    humanReviewNoGoItems:
      evaluation.humanReviewFatigueGuardDecision?.observed.noGoItems ?? 0,
    humanReviewMissingEvidenceItems:
      evaluation.humanReviewFatigueGuardDecision?.observed.missingEvidenceItems ?? 0,
    humanReviewApprovalRatio:
      evaluation.humanReviewFatigueGuardDecision?.observed.approvalRatio ?? 0,
    humanReviewRawPayloadStored:
      evaluation.humanReviewFatigueGuardDecision?.observed.rawPayloadStored ?? false,
    humanReviewAutoEnforceRequested:
      evaluation.humanReviewFatigueGuardDecision?.observed.autoEnforceRequested ?? false,
    multiAgentDelegationGuardOutcome:
      evaluation.multiAgentDelegationGuardDecision?.outcome ?? null,
    multiAgentDelegationGuardDigest:
      evaluation.multiAgentDelegationGuardDecision?.digest ?? null,
    multiAgentDelegationPrincipalCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.principalCount ?? 0,
    multiAgentDelegationAgentPrincipalCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.agentPrincipalCount ?? 0,
    multiAgentDelegationMissingIdentityCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.missingIdentityCount ?? 0,
    multiAgentDelegationMissingAuthorityCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.missingAuthorityCount ?? 0,
    multiAgentDelegationMissingScopeCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.missingScopeCount ?? 0,
    multiAgentDelegationDistinctTenantCount:
      evaluation.multiAgentDelegationGuardDecision?.counts.distinctTenantCount ?? 0,
    staleAuthorityPolicyGuardOutcome:
      evaluation.staleAuthorityPolicyGuardDecision?.outcome ?? null,
    staleAuthorityPolicyGuardDigest:
      evaluation.staleAuthorityPolicyGuardDecision?.digest ?? null,
    staleAuthorityPolicyNoGoReasonCount:
      evaluation.staleAuthorityPolicyGuardDecision?.counts.noGoReasonCount ?? 0,
    staleAuthorityPolicyBlockReasonCount:
      evaluation.staleAuthorityPolicyGuardDecision?.counts.blockReasonCount ?? 0,
    staleAuthorityPolicyReviewReasonCount:
      evaluation.staleAuthorityPolicyGuardDecision?.counts.reviewReasonCount ?? 0,
    staleAuthorityPolicyDriftState:
      evaluation.staleAuthorityPolicyGuardDecision?.observed.driftState ?? null,
    decisionContextDriftOutcome:
      evaluation.decisionContextDriftDecision?.outcome ?? null,
    decisionContextDriftDigest:
      evaluation.decisionContextDriftDecision?.digest ?? null,
    decisionContextDriftDimensionCount:
      evaluation.decisionContextDriftDecision?.counts.driftDimensionCount ?? 0,
    decisionContextMissingDimensionCount:
      evaluation.decisionContextDriftDecision?.counts.missingDimensionCount ?? 0,
    decisionContextBlockReasonCount:
      evaluation.decisionContextDriftDecision?.counts.blockReasonCount ?? 0,
    decisionContextReviewReasonCount:
      evaluation.decisionContextDriftDecision?.counts.reviewReasonCount ?? 0,
    decisionContextAgeHours:
      evaluation.decisionContextDriftDecision?.observed.contextAgeHours ?? null,
    authorityCreepGuardOutcome:
      evaluation.authorityCreepGuardDecision?.outcome ?? null,
    authorityCreepGuardDigest:
      evaluation.authorityCreepGuardDecision?.digest ?? null,
    authorityCreepFindingCount:
      evaluation.authorityCreepGuardDecision?.findings.length ?? 0,
    authorityCreepBlockedMetricUseCount:
      evaluation.authorityCreepGuardDecision?.blockedMetricUses.length ?? 0,
    authorityCreepArtifactFindingCount:
      evaluation.authorityCreepGuardDecision?.artifactFindings.length ?? 0,
    authorityCreepOpensUndercuttingDefeater:
      evaluation.authorityCreepGuardDecision?.opensUndercuttingDefeater ?? false,
    authorityCreepRejectedBoundary:
      evaluation.authorityCreepGuardDecision?.outcome === 'authority-creep-rejected-boundary',
  });
}

export function isConsequenceAdmissionDecision(
  value: string,
): value is ConsequenceAdmissionDecision {
  return CONSEQUENCE_ADMISSION_DECISIONS.includes(
    value as ConsequenceAdmissionDecision,
  );
}

export function consequenceAdmissionAllowsConsequence(
  decision: ConsequenceAdmissionDecision,
): boolean {
  return decision === 'admit' || decision === 'narrow';
}

export function mapFinancePipelineDecisionToAdmission(
  value: string,
): ConsequenceAdmissionNativeDecision {
  const normalized = value.trim().toLowerCase();
  let mappedDecision: ConsequenceAdmissionDecision = 'block';
  let mappingReason = 'Unknown finance decision values fail closed.';

  if (['pass', 'accepted', 'allow', 'allowed'].includes(normalized)) {
    mappedDecision = 'admit';
    mappingReason = 'Finance allow branch maps to canonical admit.';
  } else if (
    ['narrow', 'constrained', 'scope-reduced', 'limited'].includes(normalized)
  ) {
    mappedDecision = 'narrow';
    mappingReason = 'Finance constrained allow branch maps to canonical narrow.';
  } else if (
    ['hold', 'review', 'review-required', 'needs-review', 'pending-review'].includes(normalized)
  ) {
    mappedDecision = 'review';
    mappingReason = 'Finance hold/review branch maps to canonical review.';
  } else if (
    ['fail', 'block', 'blocked', 'deny', 'denied', 'expired', 'revoked'].includes(normalized)
  ) {
    mappedDecision = 'block';
    mappingReason = 'Finance denial or invalid release state maps to canonical block.';
  }

  return Object.freeze({
    surface: 'finance-pipeline',
    value,
    mappedDecision,
    mappingReason,
  });
}

export function mapCryptoAdmissionOutcomeToAdmission(
  value: CryptoExecutionAdmissionOutcome | string,
): ConsequenceAdmissionNativeDecision {
  const normalized = value.trim().toLowerCase();
  let mappedDecision: ConsequenceAdmissionDecision = 'block';
  let mappingReason = 'Unknown crypto admission outcomes fail closed.';

  if (normalized === 'admit') {
    mappedDecision = 'admit';
    mappingReason = 'Crypto execution-admission admit maps to canonical admit.';
  } else if (normalized === 'needs-evidence') {
    mappedDecision = 'review';
    mappingReason = 'Crypto needs-evidence maps to canonical review.';
  } else if (normalized === 'deny') {
    mappedDecision = 'block';
    mappingReason = 'Crypto deny maps to canonical block.';
  }

  return Object.freeze({
    surface: 'crypto-execution-admission',
    value,
    mappedDecision,
    mappingReason,
  });
}

export function createConsequenceAdmissionCheck(
  input: ConsequenceAdmissionCheck,
): ConsequenceAdmissionCheck {
  return Object.freeze({
    kind: normalizeEnumValue(input.kind, CONSEQUENCE_ADMISSION_CHECK_KINDS, 'check.kind'),
    label: normalizeIdentifier(input.label, 'check.label'),
    outcome: normalizeEnumValue(
      input.outcome,
      CONSEQUENCE_ADMISSION_CHECK_OUTCOMES,
      'check.outcome',
    ),
    required: input.required,
    summary: normalizeIdentifier(input.summary, 'check.summary'),
    reasonCodes: readonlyCopy(input.reasonCodes),
    evidenceRefs: readonlyCopy(input.evidenceRefs),
  });
}

import {
  createAdmissionFeedback,
  createAdmissionRetryGuidance,
  uniqueSortedStrings,
} from './correction-catalog.js';

export function createConsequenceAdmissionRequest(
  input: CreateConsequenceAdmissionRequestInput,
): ConsequenceAdmissionRequest {
  const requestedAt = normalizeIsoTimestamp(input.requestedAt, 'requestedAt');
  const base = Object.freeze({
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    requestedAt,
    packFamily: normalizeEnumValue(
      input.packFamily,
      CONSEQUENCE_ADMISSION_PACK_FAMILIES,
      'packFamily',
    ),
    entryPoint: Object.freeze({
      kind: normalizeEnumValue(
        input.entryPoint.kind,
        CONSEQUENCE_ADMISSION_ENTRY_POINT_KINDS,
        'entryPoint.kind',
      ),
      id: normalizeIdentifier(input.entryPoint.id, 'entryPoint.id'),
      route: normalizeOptionalIdentifier(input.entryPoint.route, 'entryPoint.route'),
      packageSubpath: normalizeOptionalIdentifier(
        input.entryPoint.packageSubpath,
        'entryPoint.packageSubpath',
      ),
      sourceRef: normalizeOptionalIdentifier(input.entryPoint.sourceRef, 'entryPoint.sourceRef'),
    }),
    proposedConsequence: Object.freeze({
      actor: normalizeIdentifier(input.proposedConsequence.actor, 'proposedConsequence.actor'),
      action: normalizeIdentifier(input.proposedConsequence.action, 'proposedConsequence.action'),
      downstreamSystem: normalizeIdentifier(
        input.proposedConsequence.downstreamSystem,
        'proposedConsequence.downstreamSystem',
      ),
      consequenceKind: normalizeEnumValue(
        input.proposedConsequence.consequenceKind,
        CONSEQUENCE_ADMISSION_CONSEQUENCE_KINDS,
        'proposedConsequence.consequenceKind',
      ),
      riskClass: normalizeEnumValue(
        input.proposedConsequence.riskClass,
        CONSEQUENCE_ADMISSION_RISK_CLASSES,
        'proposedConsequence.riskClass',
      ),
      summary: normalizeIdentifier(
        input.proposedConsequence.summary,
        'proposedConsequence.summary',
      ),
    }),
    policyScope: Object.freeze({
      policyRef: input.policyScope?.policyRef ?? null,
      tenantId: input.policyScope?.tenantId ?? null,
      environment: input.policyScope?.environment ?? null,
      dimensions: Object.freeze(input.policyScope?.dimensions ?? {}),
    }),
    authority: Object.freeze({
      actorRef: input.authority?.actorRef ?? null,
      reviewerRef: input.authority?.reviewerRef ?? null,
      signerRef: input.authority?.signerRef ?? null,
      delegationRef: input.authority?.delegationRef ?? null,
      authorityMode: input.authority?.authorityMode ?? null,
    }),
    evidence: Object.freeze((input.evidence ?? []).map(normalizeEvidenceRef)),
    nativeInputRefs: Object.freeze(
      (input.nativeInputRefs ?? []).map((entry) =>
        normalizeIdentifier(entry, 'nativeInputRefs[]'),
      ),
    ),
    retryAttempt: normalizeRetryAttemptBinding(input.retryAttempt),
  } satisfies Omit<ConsequenceAdmissionRequest, 'requestId'>);
  const requestId = normalizeOptionalIdentifier(input.requestId, 'requestId');

  if (base.retryAttempt !== null && requestId === base.retryAttempt.previousRequestId) {
    throw new Error(
      'Consequence admission retry attempts must not reuse the previous requestId.',
    );
  }

  return Object.freeze({
    ...base,
    requestId: requestId ?? requestIdFor(base),
  });
}

export function createConsequenceAdmissionResponse(
  input: CreateConsequenceAdmissionResponseInput,
): ConsequenceAdmissionResponse {
  const decidedAt = normalizeIsoTimestamp(input.decidedAt, 'decidedAt');
  const decision = normalizeEnumValue(input.decision, CONSEQUENCE_ADMISSION_DECISIONS, 'decision');
  const reason = normalizeIdentifier(input.reason, 'reason');
  const reasonCodes = readonlyCopy(input.reasonCodes);
  const constraints = Object.freeze((input.constraints ?? []).map(normalizeConstraint));

  if (decision === 'narrow' && constraints.length === 0) {
    throw new Error(
      'Consequence admission narrow decisions require at least one explicit constraint.',
    );
  }

  const nativeDecision = normalizeNativeDecision(input.nativeDecision);
  if (nativeDecision && nativeDecision.mappedDecision !== decision) {
    throw new Error(
      'Consequence admission native decision mapping must match the canonical decision.',
    );
  }

  const checks = Object.freeze((input.checks ?? []).map(createConsequenceAdmissionCheck));
  const proof = Object.freeze((input.proof ?? []).map(normalizeProofRef));
  const decisionAllows = consequenceAdmissionAllowsConsequence(decision);
  const requiredChecksSatisfied = !checks.some(
    (check) => check.required && check.outcome === 'fail',
  );
  const proofSatisfied = !decisionAllows || proof.length > 0;
  const decisionFailClosed = decision === 'review' || decision === 'block';
  const requestedFailClosed = input.failClosed ?? false;
  const allowed =
    decisionAllows &&
    proofSatisfied &&
    requiredChecksSatisfied &&
    !requestedFailClosed &&
    !decisionFailClosed;
  const failClosed = decisionFailClosed || requestedFailClosed || (decisionAllows && !allowed);
  const operationalContext = Object.freeze(input.operationalContext ?? {});
  const retry = createAdmissionRetryGuidance({
    decision,
    allowed,
    reasonCodes,
    operationalContext,
  });
  const feedback = createAdmissionFeedback({
    allowed,
    reasonCodes,
    retryAllowed: retry.retryAllowed,
  });
  const admissionId = admissionIdFor({
    decidedAt,
    requestId: input.request.requestId,
    decision,
    reasonCodes,
    proofDigests: proof.map((entry) => entry.digest ?? entry.id),
  });
  const canonicalPayload = {
    version: CONSEQUENCE_ADMISSION_CONTRACT_VERSION,
    admissionId,
    decidedAt,
    request: input.request,
    decision,
    allowed,
    failClosed,
    reason,
    reasonCodes,
    checks,
    constraints,
    nativeDecision,
    proof,
    feedback,
    retry,
    operationalContext,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createConsequenceAdmissionProblem(input: {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string | null;
  readonly reasonCodes?: readonly string[];
}): ConsequenceAdmissionProblem {
  return Object.freeze({
    type: normalizeIdentifier(input.type, 'problem.type'),
    title: normalizeIdentifier(input.title, 'problem.title'),
    status: input.status,
    detail: normalizeIdentifier(input.detail, 'problem.detail'),
    instance: input.instance ?? null,
    decision: 'block',
    failClosed: true,
    reasonCodes: readonlyCopy(input.reasonCodes),
  });
}

export function createGenericAdmissionEnvelope(input: unknown): GenericAdmissionEnvelope {
  const normalized = normalizeCreateGenericAdmissionInput(input);
  const evaluation = createGenericAdmissionEvaluation(normalized);
  const profile = consequenceAdmissionDomainProfile(normalized.domain);
  const requestedAt = normalized.requestedAt ?? new Date().toISOString();
  const decidedAt = normalized.decidedAt ?? requestedAt;
  const request = createConsequenceAdmissionRequest({
    requestedAt,
    requestId: normalized.requestId,
    packFamily: 'general',
    entryPoint: {
      kind: 'hosted-route',
      id: 'generic-admission-api',
      route: '/api/v1/admissions',
      packageSubpath: null,
      sourceRef: 'src/service/http/routes/generic-admission-routes.ts',
    },
    proposedConsequence: {
      actor: normalized.actor,
      action: normalized.action,
      downstreamSystem: normalized.downstreamSystem,
      consequenceKind: profile.defaultConsequenceKinds[0] ?? 'custom',
      riskClass: profile.minimumRiskClass,
      summary: genericAdmissionSummary(normalized),
    },
    policyScope: {
      policyRef: normalized.policyRef,
      tenantId: normalized.tenantId,
      environment: normalized.environment,
      dimensions: genericAdmissionDimensions(normalized, evaluation),
    },
    authority: {
      actorRef: normalized.actorRef ?? normalized.actor,
      reviewerRef: normalized.reviewerRef,
      signerRef: normalized.signerRef,
      delegationRef: normalized.delegationRef,
      authorityMode: normalized.authorityMode,
    },
    evidence: (normalized.evidenceRefs ?? []).map((ref) => ({
      id: ref,
      kind: 'reference',
      digest: null,
      uri: null,
    })),
    nativeInputRefs: normalized.nativeInputRefs,
    retryAttempt: normalized.retryAttempt,
  });
  const response = createConsequenceAdmissionResponse({
    request,
    decidedAt,
    decision: evaluation.effectiveDecision,
    reason: genericAdmissionReason(evaluation),
    reasonCodes: evaluation.reasonCodes,
    checks: createGenericAdmissionChecks(normalized, evaluation),
    constraints: genericAdmissionConstraints(normalized, evaluation),
    proof: genericAdmissionProof(request, evaluation),
    operationalContext: {
      mode: evaluation.mode,
      shadowDecision: evaluation.shadowDecision,
      downstreamPosture: evaluation.downstreamPosture,
      enforcementActive: evaluation.enforcementActive,
      modeBlocksDownstream:
        evaluation.downstreamPosture === 'hold-for-review' ||
        evaluation.effectiveDecision === 'block',
      consequenceDomain: normalized.domain,
      taxonomyRiskClass: profile.minimumRiskClass,
      nonEnforcingMode: normalized.mode === 'observe' || normalized.mode === 'warn',
    },
  });

  return Object.freeze({
    mode: evaluation.mode,
    shadowDecision: evaluation.shadowDecision,
    downstreamPosture: evaluation.downstreamPosture,
    enforcementActive: evaluation.enforcementActive,
    admission: response,
  });
}

export {
  consequenceAdmissionDescriptor,
} from './descriptor.js';

export * from './public-surface.js';
