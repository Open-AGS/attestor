import type { AssuranceMeasurementPlane } from './assurance-measurement-plane.js';
import {
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_COMPONENT_KINDS,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_CRITICALITY,
  CONSEQUENCE_AGENTIC_SUPPLY_CHAIN_TRUST_CLASSES,
} from './agentic-supply-chain-guard.js';
import type {
  GenericAdmissionAgenticSupplyChain,
  GenericAdmissionAgenticSupplyChainComponent,
  GenericAdmissionAuthorityCreep,
  GenericAdmissionDecisionContextBindingContext,
  GenericAdmissionDecisionContextDrift,
  GenericAdmissionHumanReviewFatigue,
  GenericAdmissionMultiAgentDelegation,
  GenericAdmissionMultiAgentDelegationPrincipal,
  GenericAdmissionStaleAuthorityPolicy,
} from './contracts.js';
import type { DecisionLineageGraphRecord } from './decision-lineage-graph.js';
import { CONSEQUENCE_HUMAN_REVIEW_SURFACE_KINDS } from './human-review-fatigue-guard.js';
import {
  CONSEQUENCE_MULTI_AGENT_DELEGATION_PRINCIPAL_KINDS,
  CONSEQUENCE_MULTI_AGENT_DELEGATION_ROLES,
} from './multi-agent-delegation-guard.js';
import {
  isRecord,
  normalizeEnumValue,
  normalizeStringArray,
  readOptionalBoolean,
  readOptionalString,
  readOptionalTimestamp,
  readRequiredString,
} from './normalization.js';
import { CONSEQUENCE_STALE_AUTHORITY_POLICY_DRIFT_STATES } from './stale-authority-policy-guard.js';
import {
  normalizeOptionalNonNegativeFiniteNumber,
  normalizeOptionalPositiveFiniteNumber,
  normalizeOptionalPositiveInteger,
} from './generic-input-normalization-base.js';

export function normalizeGenericAgenticSupplyChainComponents(
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

export function normalizeGenericAgenticSupplyChain(
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

export function normalizeGenericHumanReviewFatigueMetrics(
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

export function normalizeGenericHumanReviewFatigueThresholds(
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

export function normalizeGenericHumanReviewFatigue(
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

export function normalizeGenericMultiAgentDelegationPrincipals(
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

export function normalizeGenericMultiAgentDelegation(
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

export function normalizeGenericStaleAuthorityPolicy(
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

export function normalizeGenericDecisionContextBindingContext(
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

export function normalizeGenericDecisionContextDrift(
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

export function normalizeGenericAuthorityCreep(
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
