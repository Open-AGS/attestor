import type {
  CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES,
} from './agentic-supply-chain-guard.js';
import {
  CONSEQUENCE_APPROVAL_SOURCE_KINDS,
  CONSEQUENCE_APPROVAL_STATES,
  CONSEQUENCE_APPROVAL_TRUST_CLASSES,
} from './approval-provenance-guard.js';
import type {
  AssuranceMeasurementPlane,
} from './assurance-measurement-plane.js';
import {
  GENERIC_ADMISSION_MODES,
  GENERIC_ADMISSION_OBSERVED_FEATURE_ORIGINS,
  GENERIC_ADMISSION_GUARD_INPUT_ASSERTION_KINDS,
  GENERIC_ADMISSION_GUARD_INPUT_KINDS,
  GENERIC_ADMISSION_GUARD_INPUT_SOURCE_CLASSES,
  CONSEQUENCE_ADMISSION_RETRY_ATTEMPT_VERSION,
  type ConsequenceAdmissionRetryAttemptBinding,
  type CreateConsequenceAdmissionRetryAttemptBindingInput,
  type CreateGenericAdmissionInput,
  type GenericAdmissionAgenticSupplyChain,
  type GenericAdmissionAgenticSupplyChainComponent,
  type GenericAdmissionAmount,
  type GenericAdmissionApproval,
  type GenericAdmissionAuthorityCreep,
  type GenericAdmissionAuthoritySource,
  type GenericAdmissionDataScope,
  type GenericAdmissionDecisionContextBindingContext,
  type GenericAdmissionDecisionContextDrift,
  type GenericAdmissionFeatureValue,
  type GenericAdmissionGuardInputAssertionKind,
  type GenericAdmissionGuardInputKind,
  type GenericAdmissionGuardInputProvenanceRecord,
  type GenericAdmissionGuardInputSourceClass,
  type GenericAdmissionHumanReviewFatigue,
  type GenericAdmissionMultiAgentDelegation,
  type GenericAdmissionMultiAgentDelegationPrincipal,
  type GenericAdmissionNoGoCondition,
  type GenericAdmissionObservedFeatureOrigin,
  type GenericAdmissionScopeInput,
  type GenericAdmissionStaleAuthorityPolicy,
  type GenericAdmissionToolResult,
} from './contracts.js';
import {
  uniqueSortedStrings,
} from './correction-catalog.js';
import type {
  DecisionLineageGraphRecord,
} from './decision-lineage-graph.js';
import {
  CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS,
} from './human-review-fatigue-guard.js';
import {
  CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS,
  CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES,
} from './multi-agent-delegation-guard.js';
import {
  CONSEQUENCE_NO_GO_CONDITION_KINDS,
  CONSEQUENCE_NO_GO_CONDITION_SOURCE_KINDS,
  CONSEQUENCE_NO_GO_CONDITION_STATES,
} from './no-go-condition-ledger.js';
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
import {
  CONSEQUENCE_SCOPE_EXPLOSION_DATA_CLASSES,
  CONSEQUENCE_SCOPE_EXPLOSION_OPERATION_TYPES,
  CONSEQUENCE_SCOPE_EXPLOSION_REVERSIBILITY_CLASSES,
} from './scope-explosion-guard.js';
import {
  CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES,
} from './stale-authority-policy-guard.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
} from './taxonomy.js';
import {
  CONSEQUENCE_TOOL_RESULT_EVIDENCE_CLASSES,
  CONSEQUENCE_TOOL_RESULT_RISK_LEVELS,
  CONSEQUENCE_TOOL_RESULT_SOURCE_TRUST_CLASSES,
  CONSEQUENCE_TOOL_RESULT_TOOL_KINDS,
  CONSEQUENCE_TOOL_RESULT_USE_KINDS,
} from './tool-result-poisoning-guard.js';
import {
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_CLAIM_KINDS,
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_SOURCE_KINDS,
  CONSEQUENCE_UNTRUSTED_CONTENT_AUTHORITY_TRUST_CLASSES,
} from './untrusted-content-authority-guard.js';

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

function normalizeGenericGuardInputAssertionKinds(
  value: unknown,
  fieldName: string,
): readonly GenericAdmissionGuardInputAssertionKind[] {
  if (!Array.isArray(value)) {
    throw new Error(`Consequence admission ${fieldName} must be an array.`);
  }
  const normalized = value.map((entry, index) => normalizeEnumValue(
    typeof entry === 'string' ? entry : String(entry),
    GENERIC_ADMISSION_GUARD_INPUT_ASSERTION_KINDS,
    `${fieldName}[${index}]`,
  ));
  const unique = [...new Set(normalized)].sort() as GenericAdmissionGuardInputAssertionKind[];
  if (unique.length === 0) {
    throw new Error(`Consequence admission ${fieldName} must not be empty.`);
  }
  return Object.freeze(unique);
}

function normalizeGenericGuardInputProvenance(
  value: unknown,
): readonly GenericAdmissionGuardInputProvenanceRecord[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error('Consequence admission guardInputProvenance must be an array when provided.');
  }
  return Object.freeze(
    value.map((entry, index) => {
      const field = `guardInputProvenance[${index}]`;
      if (!isRecord(entry)) {
        throw new Error(`Consequence admission ${field} must be an object.`);
      }
      const sourceRef = readOptionalString(entry, 'sourceRef');
      const sourceDigest = readOptionalString(entry, 'sourceDigest');
      const evidenceDigest = readOptionalString(entry, 'evidenceDigest');
      const tenantId = readOptionalString(entry, 'tenantId');
      const recordedAt = readOptionalTimestamp(entry, 'recordedAt');
      const trustedBoundary = readOptionalBoolean(entry, 'trustedBoundary');

      return Object.freeze({
        guardKind: normalizeEnumValue(
          readRequiredString(entry, 'guardKind'),
          GENERIC_ADMISSION_GUARD_INPUT_KINDS,
          `${field}.guardKind`,
        ) as GenericAdmissionGuardInputKind,
        sourceClass: normalizeEnumValue(
          readRequiredString(entry, 'sourceClass'),
          GENERIC_ADMISSION_GUARD_INPUT_SOURCE_CLASSES,
          `${field}.sourceClass`,
        ) as GenericAdmissionGuardInputSourceClass,
        assertionKinds: normalizeGenericGuardInputAssertionKinds(
          entry.assertionKinds,
          `${field}.assertionKinds`,
        ),
        ...(sourceRef === null ? {} : { sourceRef }),
        ...(sourceDigest === null ? {} : { sourceDigest }),
        ...(evidenceDigest === null ? {} : { evidenceDigest }),
        ...(tenantId === null ? {} : { tenantId }),
        ...(recordedAt === null ? {} : { recordedAt }),
        ...(trustedBoundary === null ? {} : { trustedBoundary }),
      });
    }),
  );
}

function normalizeRequiredGuardInputProvenance(
  value: unknown,
): readonly GenericAdmissionGuardInputKind[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new Error(
      'Consequence admission requiredGuardInputProvenance must be an array when provided.',
    );
  }
  const normalized = value.map((entry, index) => normalizeEnumValue(
    typeof entry === 'string' ? entry : String(entry),
    GENERIC_ADMISSION_GUARD_INPUT_KINDS,
    `requiredGuardInputProvenance[${index}]`,
  ));
  return Object.freeze([...new Set(normalized)].sort() as GenericAdmissionGuardInputKind[]);
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
