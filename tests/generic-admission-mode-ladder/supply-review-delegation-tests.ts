import {
  GENERIC_ADMISSION_MODES,
  assert,
  baseMoneyAdmission,
  cleanAuthorityCreepMetadata,
  consequenceAdmissionDescriptor,
  createGenericAdmissionEnvelope,
  digest,
  equal,
  markPassed,
  ok,
  throws,
} from './helpers.js';

function testUntrustedToolResultCannotAuthorizeEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    allowedToolResultEvidenceClasses: ['policy-record'],
    toolResults: [
      {
        toolResultRef: 'tool-result:private:refund-policy',
        toolKind: 'web-search',
        sourceTrustClass: 'untrusted-external',
        resultUse: 'authority',
        sourceRef: 'https://attacker.example/private-policy',
        sourceTimestamp: '2026-05-01T17:00:00.000Z',
        integrityDigest: digest('e'),
        evidenceDigest: digest('f'),
        evidenceClass: 'policy-record',
        toolRisk: 'high',
      },
    ],
  });
  const serialized = JSON.stringify(envelope);
  const evidenceCheck = envelope.admission.checks.find((check) => check.kind === 'evidence');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: untrusted tool authority shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: untrusted tool authority blocks enforce mode');
  equal(envelope.admission.allowed, false, 'Generic admission: blocked tool-result authority is not allowed');
  ok(
    envelope.admission.reasonCodes.includes('tool-result-untrusted-source'),
    'Generic admission: untrusted tool-result source reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('tool-result-authority-or-instruction'),
    'Generic admission: tool-result authority/instruction reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('tool-result-block'),
    'Generic admission: tool-result block reason is explicit',
  );
  ok(
    evidenceCheck?.reasonCodes.includes('tool-result-untrusted-source'),
    'Generic admission: tool-result guard attaches reasons to the evidence check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.toolResultGuardOutcome,
    'block',
    'Generic admission: tool-result guard block outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.untrustedToolResultSourceCount,
    1,
    'Generic admission: untrusted tool-result source count is carried without raw output',
  );
  assert.doesNotMatch(
    serialized,
    /tool-result:private:refund-policy|attacker\.example|private-policy/u,
    'Generic admission: serialized envelope does not leak raw tool-result refs or source URLs',
  );
  markPassed();
}

function testTrustedToolResultEvidenceCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    allowedToolResultEvidenceClasses: ['payment-record'],
    toolResults: [
      {
        toolResultRef: 'provider-result:payment-private-ref',
        toolKind: 'provider-api',
        sourceTrustClass: 'provider-authoritative',
        resultUse: 'evidence',
        sourceRef: 'provider.payment.private-ref',
        sourceTimestamp: '2026-05-01T17:00:00.000Z',
        integrityDigest: digest('e'),
        evidenceDigest: digest('f'),
        evidenceClass: 'payment-record',
        toolRisk: 'medium',
      },
    ],
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: trusted tool evidence keeps complete request admissible');
  equal(envelope.admission.decision, 'admit', 'Generic admission: trusted tool evidence admits');
  equal(
    envelope.admission.request.policyScope.dimensions.toolResultGuardOutcome,
    'pass',
    'Generic admission: tool-result guard pass outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.trustedToolResultEvidenceCount,
    1,
    'Generic admission: trusted tool-result evidence count is carried',
  );
  assert.doesNotMatch(
    serialized,
    /provider-result:payment-private-ref|provider\.payment\.private-ref/u,
    'Generic admission: serialized envelope does not leak raw trusted tool-result refs',
  );
  markPassed();
}

function testModelGeneratedToolResultEvidenceRequiresReview(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    allowedToolResultEvidenceClasses: ['ticket-record'],
    toolResults: [
      {
        toolResultRef: 'model-summary:ticket-private-ref',
        toolKind: 'mcp-tool',
        sourceTrustClass: 'model-generated',
        resultUse: 'evidence',
        sourceRef: 'agent.summary.private-ref',
        sourceTimestamp: '2026-05-01T17:00:00.000Z',
        integrityDigest: digest('e'),
        evidenceDigest: digest('f'),
        evidenceClass: 'ticket-record',
        toolRisk: 'medium',
      },
    ],
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_review', 'Generic admission: model-generated tool evidence shadows review');
  equal(envelope.admission.decision, 'review', 'Generic admission: model-generated tool evidence does not admit directly');
  ok(
    envelope.admission.reasonCodes.includes('tool-result-model-generated-source'),
    'Generic admission: model-generated tool-result source reason is explicit',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.toolResultGuardOutcome,
    'review',
    'Generic admission: tool-result guard review outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.modelGeneratedToolResultSourceCount,
    1,
    'Generic admission: model-generated tool-result source count is carried',
  );
  assert.doesNotMatch(
    serialized,
    /model-summary:ticket-private-ref|agent\.summary\.private-ref/u,
    'Generic admission: serialized envelope does not leak raw model-generated tool-result refs',
  );
  markPassed();
}

function cleanAgenticSupplyChainComponent(): Record<string, unknown> {
  return {
    componentRef: 'connector:refund-service-private',
    componentKind: 'connector',
    trustClass: 'first-party',
    criticality: 'medium',
    sourceRef: 'repo:private/refund-service-adapter',
    sourcePinned: true,
    version: '2026.05.01',
    integrityDigest: digest('e'),
    provenanceRef: 'slsa:private:refund-service-adapter',
    provenanceVerified: true,
    signatureVerified: true,
    sbomRef: 'sbom:private:refund-service-adapter',
    ownerAuthorityDigest: digest('a'),
    reviewDigest: digest('b'),
    permissionScopeDigest: digest('c'),
    declaredPermissions: ['refund:create'],
    allowedPermissions: ['refund:create'],
    installScriptsPresent: false,
    networkEgressDeclared: false,
    generatedArtifact: false,
    generatedArtifactReviewed: true,
    domainPackBoundaryVerified: true,
    adapterReadinessDigest: digest('d'),
  };
}

function testCleanAgenticSupplyChainCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    agenticSupplyChain: {
      components: [cleanAgenticSupplyChainComponent()],
    },
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: clean supply-chain metadata still admits');
  equal(envelope.admission.decision, 'admit', 'Generic admission: supply-chain guard pass admits complete request');
  equal(
    envelope.admission.request.policyScope.dimensions.agenticSupplyChainGuardOutcome,
    'pass',
    'Generic admission: supply-chain guard pass outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.agenticSupplyChainComponentCount,
    1,
    'Generic admission: supply-chain component count is carried',
  );
  ok(
    envelope.admission.checks.every((check) => check.outcome === 'pass'),
    'Generic admission: supply-chain pass reason does not create false failing checks',
  );
  assert.doesNotMatch(
    serialized,
    /refund-service-private|private\/refund-service-adapter|slsa:private/u,
    'Generic admission: serialized envelope does not leak raw supply-chain refs',
  );
  markPassed();
}

function testUnsafeAgenticSupplyChainBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    agenticSupplyChain: {
      components: [
        {
          componentRef: 'generated-adapter:private-high-risk',
          componentKind: 'generated-adapter',
          trustClass: 'unknown',
          criticality: 'critical',
          sourceRef: 'model-output:private-generated-code',
          sourcePinned: false,
          declaredPermissions: ['refund:create', 'refund:admin', 'secrets:read'],
          allowedPermissions: ['refund:create'],
          generatedArtifact: true,
          generatedArtifactReviewed: false,
          domainPackBoundaryVerified: false,
        },
      ],
    },
  });
  const serialized = JSON.stringify(envelope);
  const evidenceCheck = envelope.admission.checks.find((check) => check.kind === 'evidence');
  const enforcementCheck = envelope.admission.checks.find((check) => check.kind === 'enforcement');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: unsafe supply-chain metadata shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: unsafe supply-chain metadata blocks enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('supply-chain-permission-overbroad'),
    'Generic admission: overbroad supply-chain permission reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('supply-chain-critical-component-block'),
    'Generic admission: critical supply-chain block reason is explicit',
  );
  ok(
    evidenceCheck?.reasonCodes.includes('supply-chain-critical-component-block'),
    'Generic admission: supply-chain guard attaches block reason to evidence check',
  );
  ok(
    enforcementCheck?.reasonCodes.includes('supply-chain-permission-overbroad'),
    'Generic admission: supply-chain permission reason is attached to enforcement check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.agenticSupplyChainGuardOutcome,
    'block',
    'Generic admission: supply-chain guard block outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.agenticSupplyChainOverbroadPermissionCount,
    1,
    'Generic admission: overbroad supply-chain permission count is carried',
  );
  assert.doesNotMatch(
    serialized,
    /private-high-risk|private-generated-code|refund:admin|secrets:read/u,
    'Generic admission: serialized envelope does not leak raw unsafe supply-chain refs or permissions',
  );
  markPassed();
}

function testIncompleteAgenticSupplyChainRequiresReview(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    agenticSupplyChain: {
      components: [
        {
          componentRef: 'npm:@private/refund-helper',
          componentKind: 'npm-package',
          trustClass: 'third-party',
          criticality: 'low',
          sourcePinned: true,
          declaredPermissions: ['refund:read'],
          allowedPermissions: ['refund:read'],
        },
      ],
    },
  });

  equal(envelope.shadowDecision, 'would_review', 'Generic admission: incomplete supply-chain metadata shadows review');
  equal(envelope.admission.decision, 'review', 'Generic admission: incomplete supply-chain metadata holds enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('supply-chain-provenance-missing'),
    'Generic admission: missing supply-chain provenance reason is explicit',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.agenticSupplyChainGuardOutcome,
    'review',
    'Generic admission: supply-chain guard review outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.agenticSupplyChainMissingProvenanceCount,
    1,
    'Generic admission: missing supply-chain provenance count is carried',
  );
}

function cleanHumanReviewFatigue(): Record<string, unknown> {
  return {
    reviewSurfaceKind: 'external-review-packet',
    reviewPacketRef: 'review-packet:private-refund-987',
    metrics: {
      totalReviewItems: 3,
      lowPriorityItems: 0,
      blockerItems: 1,
      noGoItems: 0,
      missingEvidenceItems: 0,
      focusAreaCount: 2,
      evidenceDigestCardCount: 2,
      reviewerInstructionCount: 2,
      estimatedReviewMinutes: 8,
      blockersFirst: true,
      hasNoGoSummary: true,
      hasMissingEvidenceSummary: true,
      hasReviewerFocusAreas: true,
      hasNextSafeStep: true,
      approvalRequired: true,
      rawPayloadStored: false,
      autoEnforceRequested: false,
    },
  };
}

function testCleanHumanReviewFatigueCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    humanReviewFatigue: cleanHumanReviewFatigue(),
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: clean human-review packet still admits');
  equal(envelope.admission.decision, 'admit', 'Generic admission: human-review guard pass admits complete request');
  equal(
    envelope.admission.request.policyScope.dimensions.humanReviewFatigueGuardOutcome,
    'pass',
    'Generic admission: human-review guard pass outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.humanReviewTotalReviewItems,
    3,
    'Generic admission: human-review item count is carried',
  );
  ok(
    envelope.admission.checks.every((check) => check.outcome === 'pass'),
    'Generic admission: human-review pass reason does not create false failing checks',
  );
  assert.doesNotMatch(
    serialized,
    /review-packet:private-refund-987/u,
    'Generic admission: serialized envelope does not leak raw human-review packet refs',
  );
  markPassed();
}

function testUnsafeHumanReviewFatigueBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    humanReviewFatigue: {
      reviewSurfaceKind: 'external-review-packet',
      reviewPacketRef: 'review-packet:private-fatigue-risk',
      metrics: {
        totalReviewItems: 8,
        lowPriorityItems: 7,
        blockerItems: 1,
        noGoItems: 1,
        missingEvidenceItems: 1,
        focusAreaCount: 1,
        evidenceDigestCardCount: 1,
        reviewerInstructionCount: 24,
        estimatedReviewMinutes: 120,
        blockersFirst: false,
        hasNoGoSummary: false,
        hasMissingEvidenceSummary: true,
        hasReviewerFocusAreas: true,
        hasNextSafeStep: true,
        approvalRequired: true,
        rawPayloadStored: true,
        autoEnforceRequested: true,
      },
    },
  });
  const serialized = JSON.stringify(envelope);
  const evidenceCheck = envelope.admission.checks.find((check) => check.kind === 'evidence');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: unsafe human-review packet shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: unsafe human-review packet blocks enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('raw-payload-stored'),
    'Generic admission: raw human-review payload storage reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('auto-enforce-requested'),
    'Generic admission: auto-enforce review bypass reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('review-fatigue-block'),
    'Generic admission: human-review fatigue block reason is explicit',
  );
  ok(
    evidenceCheck?.reasonCodes.includes('raw-payload-stored'),
    'Generic admission: human-review guard attaches raw payload reason to evidence check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.humanReviewFatigueGuardOutcome,
    'block',
    'Generic admission: human-review guard block outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.humanReviewNoGoItems,
    1,
    'Generic admission: human-review no-go item count is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.humanReviewRawPayloadStored,
    true,
    'Generic admission: human-review raw payload dimension is carried as a boolean only',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.humanReviewAutoEnforceRequested,
    true,
    'Generic admission: human-review auto-enforce dimension is carried as a boolean only',
  );
  assert.doesNotMatch(
    serialized,
    /review-packet:private-fatigue-risk/u,
    'Generic admission: serialized envelope does not leak raw unsafe human-review packet refs',
  );
  markPassed();
}

function cleanMultiAgentDelegation(): Record<string, unknown> {
  return {
    principalChain: [
      {
        principalRef: 'agent:private-originator',
        principalKind: 'ai-agent',
        role: 'originator',
        tenantId: 'tenant:private',
        identityDigest: digest('1'),
        authorityDigest: digest('2'),
        scopeDigest: digest('3'),
        transportBindingDigest: digest('4'),
      },
      {
        principalRef: 'service:private-refund-adapter',
        principalKind: 'service-account',
        role: 'executor',
        tenantId: 'tenant:private',
        identityDigest: digest('5'),
        authorityDigest: digest('6'),
        scopeDigest: digest('7'),
        transportBindingDigest: digest('8'),
      },
    ],
    maxDelegationDepth: 4,
    requestedDelegatedScopeDigest: digest('9'),
    approvedDelegatedScopeDigest: digest('9'),
    delegatingAuthorityDigest: digest('a'),
  };
}

function testCleanMultiAgentDelegationCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    multiAgentDelegation: cleanMultiAgentDelegation(),
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: clean delegation chain still admits');
  equal(envelope.admission.decision, 'admit', 'Generic admission: delegation guard pass admits complete request');
  equal(
    envelope.admission.request.policyScope.dimensions.multiAgentDelegationGuardOutcome,
    'pass',
    'Generic admission: delegation guard pass outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.multiAgentDelegationPrincipalCount,
    2,
    'Generic admission: delegation principal count is carried',
  );
  ok(
    envelope.admission.checks.every((check) => check.outcome === 'pass'),
    'Generic admission: delegation pass reason does not create false failing checks',
  );
  assert.doesNotMatch(
    serialized,
    /private-originator|private-refund-adapter|tenant:private/u,
    'Generic admission: serialized envelope does not leak raw delegation refs or tenant ids',
  );
  markPassed();
}

function testUnsafeMultiAgentDelegationBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    multiAgentDelegation: {
      principalChain: [
        {
          principalRef: 'agent:private-originator',
          principalKind: 'ai-agent',
          role: 'originator',
          tenantId: 'tenant:private',
          identityDigest: digest('1'),
          authorityDigest: digest('2'),
          scopeDigest: digest('3'),
        },
        {
          principalRef: 'agent:private-executor',
          principalKind: 'ai-agent',
          role: 'executor',
          tenantId: 'tenant:private',
          identityDigest: digest('4'),
          authorityDigest: digest('5'),
          scopeDigest: digest('6'),
        },
        {
          principalRef: 'agent:private-executor',
          principalKind: 'ai-agent',
          role: 'approver',
          tenantId: 'tenant:private',
          identityDigest: digest('4'),
          authorityDigest: digest('5'),
          scopeDigest: digest('6'),
        },
      ],
      maxDelegationDepth: 5,
      requestedDelegatedScopeDigest: digest('7'),
      approvedDelegatedScopeDigest: digest('8'),
      delegatingAuthorityDigest: digest('9'),
    },
  });
  const serialized = JSON.stringify(envelope);
  const authorityCheck = envelope.admission.checks.find((check) => check.kind === 'authority');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: unsafe delegation chain shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: unsafe delegation chain blocks enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('delegation-scope-unapproved'),
    'Generic admission: unapproved delegated scope reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('delegation-actor-self-approved'),
    'Generic admission: self-approved delegation reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('delegation-block'),
    'Generic admission: delegation block reason is explicit',
  );
  ok(
    authorityCheck?.reasonCodes.includes('delegation-actor-self-approved'),
    'Generic admission: delegation guard attaches self-approval reason to authority check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.multiAgentDelegationGuardOutcome,
    'block',
    'Generic admission: delegation guard block outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.multiAgentDelegationAgentPrincipalCount,
    3,
    'Generic admission: delegation agent principal count is carried',
  );
  assert.doesNotMatch(
    serialized,
    /private-originator|private-executor|tenant:private/u,
    'Generic admission: serialized envelope does not leak raw unsafe delegation refs or tenant ids',
  );
  markPassed();
}

export function runSupplyReviewDelegationTests(): void {
  testUntrustedToolResultCannotAuthorizeEnforceMode();
  testTrustedToolResultEvidenceCanAdmitCompleteRequest();
  testModelGeneratedToolResultEvidenceRequiresReview();
  testCleanAgenticSupplyChainCanAdmitCompleteRequest();
  testUnsafeAgenticSupplyChainBlocksEnforceMode();
  testIncompleteAgenticSupplyChainRequiresReview();
  testCleanHumanReviewFatigueCanAdmitCompleteRequest();
  testUnsafeHumanReviewFatigueBlocksEnforceMode();
  testCleanMultiAgentDelegationCanAdmitCompleteRequest();
  testUnsafeMultiAgentDelegationBlocksEnforceMode();
}
