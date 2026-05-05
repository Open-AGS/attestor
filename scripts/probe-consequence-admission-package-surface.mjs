import assert from 'node:assert/strict';

const root = await import('attestor');
const admission = await import('attestor/consequence-admission');

assert.equal(
  root.CONSEQUENCE_ADMISSION_FACADE_SPEC_VERSION,
  'attestor.consequence-admission-facade.v1',
);
assert.equal(
  root.consequenceAdmissionFacadeDescriptor().publicSubpath,
  'attestor/consequence-admission',
);
assert.equal(
  admission.CONSEQUENCE_ADMISSION_FACADE_SPEC_VERSION,
  'attestor.consequence-admission-facade.v1',
);
assert.equal(
  admission.consequenceAdmissionFacadeDescriptor().publicSubpath,
  'attestor/consequence-admission',
);
assert.equal(
  admission.consequenceAdmissionFacadeDescriptor().automaticPackDetection,
  false,
);
assert.equal(
  admission.consequenceAdmissionFacadeDescriptor().entryPoints.financePipelineRun.route,
  '/api/v1/pipeline/run',
);
assert.equal(
  admission.consequenceAdmissionFacadeDescriptor().entryPoints.cryptoExecutionPlan.route,
  null,
);
assert.equal(
  admission.consequenceAdmissionFacadeDescriptor().entryPoints.cryptoExecutionPlan.packageSubpath,
  'attestor/crypto-execution-admission',
);
assert.equal(
  admission.consequenceAdmissionDescriptor().consequenceDomains.includes('programmable-money'),
  true,
);
assert.equal(
  admission.consequenceAdmissionDomainProfile('money-movement').controlRequirements.includes(
    'non-bypassable-integration',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDownstreamContractDescriptor().bindingFields.includes(
    'idempotency-key',
  ),
  true,
);
assert.equal(
  typeof admission.evaluateConsequenceAdmissionDownstreamContract,
  'function',
);
assert.equal(
  admission.consequenceAdmissionVerifierHelperDescriptor().cryptographicTokenVerification,
  false,
);
assert.equal(
  typeof admission.createConsequenceAdmissionVerifier,
  'function',
);
assert.equal(
  admission.consequenceAdmissionAdapterFrameworkDescriptor().adapterKinds.includes(
    'mcp-tool-wrapper',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDescriptor().adapterKinds.includes('tool-wrapper'),
  true,
);
assert.equal(
  typeof admission.createConsequenceAdmissionProtectedAdapter,
  'function',
);
assert.equal(
  admission.consequenceAuditEvidenceExportDescriptor().artifactKinds.includes(
    'shadow-event-set',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDescriptor().auditEvidenceFindingKinds.includes(
    'raw-payload-present',
  ),
  true,
);
assert.equal(
  typeof admission.createConsequenceAuditEvidenceExport,
  'function',
);
assert.equal(
  admission.consequenceBusinessRiskDashboardDescriptor().widgets.includes(
    'consequence-domain-risk',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDescriptor().businessRiskSignals.includes(
    'policy-gap',
  ),
  true,
);
assert.equal(
  typeof admission.createConsequenceBusinessRiskDashboard,
  'function',
);
assert.equal(
  admission.consequenceExternalReviewPacketDescriptor().focusAreas.includes(
    'proof-integrity',
  ),
  true,
);
assert.equal(
  admission.consequenceExternalReviewPacketDescriptor().evidenceKinds.includes(
    'supply-chain-baseline',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDescriptor().externalReviewFindingKinds.includes(
    'external-review-required',
  ),
  true,
);
assert.equal(
  typeof admission.createConsequenceExternalReviewPacket,
  'function',
);
assert.equal(
  admission.consequenceDataMinimizationRedactionPolicyDescriptor().surfaceKinds.includes(
    'audit-evidence-export',
  ),
  true,
);
assert.equal(
  admission.consequenceDataMinimizationRedactionPolicyDescriptor().surfaceKinds.includes(
    'external-review-packet',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDescriptor().dataMinimizationForbiddenRawClasses.includes(
    'credential-or-secret',
  ),
  true,
);
assert.equal(
  typeof admission.evaluateConsequenceDataMinimizationArtifact,
  'function',
);
assert.equal(
  admission.consequenceAdmissionPolicyLimitDescriptor().limitKinds.includes('velocity'),
  true,
);
assert.equal(
  typeof admission.evaluateConsequenceAdmissionPolicyLimits,
  'function',
);
assert.equal(
  admission.consequenceAdmissionPresentationBindingDescriptor().bindingFields.includes(
    'body-digest',
  ),
  true,
);
assert.equal(
  typeof admission.evaluateConsequenceAdmissionPresentationBinding,
  'function',
);
assert.equal(
  admission.consequenceAdmissionPresentationReplayLedgerDescriptor().failureReasons.includes(
    'replay-key-already-consumed',
  ),
  true,
);
assert.equal(
  typeof admission.createConsequenceAdmissionPresentationReplayLedger,
  'function',
);
assert.equal(
  admission.consequenceAdmissionDownstreamExecutionReceiptDescriptor().statuses.includes(
    'succeeded',
  ),
  true,
);
assert.equal(
  typeof admission.recordConsequenceAdmissionDownstreamExecution,
  'function',
);
assert.equal(
  admission.consequenceAdmissionRetryAttemptLedgerDescriptor().failureReasons.includes(
    'idempotency-key-conflict',
  ),
  true,
);
assert.equal(
  typeof admission.createConsequenceAdmissionRetryAttemptLedger,
  'function',
);
assert.equal(
  typeof admission.createConsequenceAdmissionRetryAttemptBinding,
  'function',
);
assert.equal(
  admission.consequenceAdmissionAgentLoopAbuseGuardDescriptor().reasonCodes.includes(
    'agent-loop-policy-probing-risk',
  ),
  true,
);
assert.equal(
  admission.consequenceAdmissionDescriptor().agentLoopAbuseGuardOutcomes.includes('throttle'),
  true,
);
assert.equal(
  typeof admission.createConsequenceAdmissionAgentLoopAbuseGuard,
  'function',
);
assert.equal(
  admission.financePipelineAdmissionDescriptor().route,
  '/api/v1/pipeline/run',
);
assert.equal(
  admission.cryptoExecutionPlanAdmissionDescriptor().hostedRouteClaimed,
  false,
);
assert.equal(
  admission.isConsequenceAdmissionFacadeSurface('finance-pipeline-run'),
  true,
);
assert.equal(
  admission.isConsequenceAdmissionFacadeSurface('auto'),
  false,
);
assert.equal(
  admission.mapFinancePipelineDecisionToAdmission('pass').mappedDecision,
  'admit',
);
assert.equal(
  admission.mapCryptoAdmissionOutcomeToAdmission('needs-evidence').mappedDecision,
  'review',
);
assert.equal(
  admission.CONSEQUENCE_ADMISSION_CUSTOMER_GATE_VERSION,
  'attestor.consequence-admission-customer-gate.v1',
);
assert.equal(
  typeof admission.evaluateConsequenceAdmissionGate,
  'function',
);
assert.equal(
  typeof admission.assertConsequenceAdmissionGateAllows,
  'function',
);

let blockedInternalPath = false;
try {
  await import('attestor/consequence-admission/facade.js');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  blockedInternalPath =
    message.includes('Package subpath') ||
    message.includes('ERR_PACKAGE_PATH_NOT_EXPORTED');
}

assert.equal(
  blockedInternalPath,
  true,
  'internal consequence admission module paths should stay outside the public package surface',
);

console.log('consequence-admission package surface probe passed');
