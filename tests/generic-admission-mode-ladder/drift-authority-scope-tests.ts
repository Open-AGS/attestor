import { readFileSync } from 'node:fs';

import {
  GENERIC_ADMISSION_MODES,
  assert,
  authorityCreepActorDigest,
  authorityCreepLineageGraph,
  authorityCreepMeasurementArtifact,
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

function readProjectFile(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/gu, '\n');
}

function scopedMoneyAdmission() {
  return {
    ...baseMoneyAdmission('enforce'),
    scopeOwnerPolicyRef: 'policy:refund-scope-private',
    requestedScope: {
      amountMinorUnits: 9000,
      currency: 'usd',
      recordCount: 12,
      operationType: 'refund',
      recipientId: 'recipient_other_private',
      tenantId: 'tenant_current_private',
      environment: 'production',
      downstreamSystem: 'refund-service-private',
      dataClass: 'customer-visible',
      reversibilityClass: 'compensating-action-available',
    },
    approvedScope: {
      maxAmountMinorUnits: 5000,
      currency: 'usd',
      maxRecordCount: 1,
      operationTypes: ['refund'],
      recipientIds: ['recipient_customer_private'],
      tenantId: 'tenant_current_private',
      environments: ['production'],
      downstreamSystems: ['refund-service-private'],
      dataClasses: ['customer-visible'],
      reversibilityClasses: ['reversible', 'compensating-action-available'],
    },
  };
}

function currentStaleAuthorityPolicy() {
  return {
    policyVersion: 'policy.refunds.v4',
    currentPolicyVersion: 'policy.refunds.v4',
    policyDigest: digest('p'),
    currentPolicyDigest: digest('p'),
    policyUpdatedAt: '2026-05-01T16:00:00.000Z',
    approvalIssuedAt: '2026-05-01T17:00:00.000Z',
    approvalValidFrom: '2026-05-01T17:00:00.000Z',
    approvalValidUntil: '2026-05-01T18:00:00.000Z',
    authorityCheckedAt: '2026-05-01T17:00:00.000Z',
    authorityExpiresAt: '2026-05-01T18:00:00.000Z',
    maxAuthorityAgeSeconds: 300,
    driftState: 'clean',
  };
}

function cleanDecisionContext(overrides: Record<string, unknown> = {}) {
  return {
    modelVersion: 'model:private-refund-agent:2026-05-01',
    toolSchemaDigest: digest('1'),
    toolManifestDigest: digest('2'),
    policyVersion: 'policy:refunds:v4-private',
    policyDigest: digest('3'),
    configDigest: digest('4'),
    promptDigest: digest('5'),
    verifierDigest: digest('6'),
    simulationDigest: digest('7'),
    evaluatedAt: '2026-05-01T16:00:00.000Z',
    expiresAt: '2026-05-02T16:00:00.000Z',
    ...overrides,
  };
}

function cleanDecisionContextDrift(overrides: Record<string, unknown> = {}) {
  return {
    boundContext: cleanDecisionContext(),
    currentContext: cleanDecisionContext(),
    requireSimulationRefresh: true,
    maxContextAgeHours: 24,
    ...overrides,
  };
}

function testCurrentStaleAuthorityPolicyCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    staleAuthorityPolicy: currentStaleAuthorityPolicy(),
  });

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: current policy and fresh authority admit');
  equal(envelope.admission.decision, 'admit', 'Generic admission: stale guard pass does not hold complete request');
  equal(envelope.admission.allowed, true, 'Generic admission: stale guard pass remains allowed');
  equal(
    envelope.admission.request.policyScope.dimensions.staleAuthorityPolicyGuardOutcome,
    'pass',
    'Generic admission: stale guard pass outcome is carried',
  );
}

function testMatchingDecisionContextCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    decisionContextDrift: cleanDecisionContextDrift(),
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: matching decision context still admits');
  equal(envelope.admission.decision, 'admit', 'Generic admission: decision context pass does not hold complete request');
  equal(
    envelope.admission.request.policyScope.dimensions.decisionContextDriftOutcome,
    'pass',
    'Generic admission: decision context pass outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.decisionContextDriftDimensionCount,
    0,
    'Generic admission: decision context pass carries zero drift dimensions',
  );
  assert.doesNotMatch(
    serialized,
    /private-refund-agent|policy:refunds:v4-private/u,
    'Generic admission: serialized envelope does not leak raw decision context values',
  );
  markPassed();
}

function testMissingDecisionContextBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    decisionContextDrift: {
      boundContext: cleanDecisionContext({
        modelVersion: null,
        toolSchemaDigest: null,
        policyVersion: null,
        configDigest: null,
      }),
      currentContext: null,
    },
  });
  const evidenceCheck = envelope.admission.checks.find((check) => check.kind === 'evidence');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: missing decision context shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: missing decision context blocks enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('current-context-missing'),
    'Generic admission: missing current context reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('decision-context-block'),
    'Generic admission: decision-context block reason is explicit',
  );
  ok(
    evidenceCheck?.reasonCodes.includes('current-context-missing'),
    'Generic admission: decision-context guard attaches missing context to evidence check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.decisionContextDriftOutcome,
    'block',
    'Generic admission: decision context block outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.decisionContextMissingDimensionCount,
    4,
    'Generic admission: missing decision context dimension count is carried',
  );
}

function testDecisionContextDriftRequiresReview(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    decisionContextDrift: cleanDecisionContextDrift({
      currentContext: cleanDecisionContext({
        modelVersion: 'model:private-refund-agent:2026-05-02',
        toolSchemaDigest: digest('8'),
        policyVersion: 'policy:refunds:v5-private',
        simulationDigest: digest('9'),
      }),
    }),
  });
  const freshnessCheck = envelope.admission.checks.find((check) => check.kind === 'freshness');
  const policyCheck = envelope.admission.checks.find((check) => check.kind === 'policy');

  equal(envelope.shadowDecision, 'would_review', 'Generic admission: decision context drift shadows review');
  equal(envelope.admission.decision, 'review', 'Generic admission: decision context drift holds enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('model-version-drift'),
    'Generic admission: model version drift is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('simulation-refresh-required'),
    'Generic admission: simulation refresh reason is explicit',
  );
  ok(
    freshnessCheck?.reasonCodes.includes('simulation-refresh-required'),
    'Generic admission: simulation refresh attaches to freshness check',
  );
  ok(
    policyCheck?.reasonCodes.includes('policy-version-drift'),
    'Generic admission: policy version drift attaches to policy check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.decisionContextDriftOutcome,
    'review',
    'Generic admission: decision context review outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.decisionContextDriftDimensionCount,
    4,
    'Generic admission: decision context drift dimension count is carried',
  );
}

function testCleanAuthorityCreepCanAdmitCompleteRequest(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    authorityCreep: cleanAuthorityCreepMetadata(),
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_admit', 'Generic admission: clean authority-creep lineage still admits');
  equal(envelope.admission.decision, 'admit', 'Generic admission: authority-creep evidence-ready does not hold complete request');
  equal(
    envelope.admission.request.policyScope.dimensions.authorityCreepGuardOutcome,
    'authority-creep-evidence-ready',
    'Generic admission: authority-creep evidence-ready outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.authorityCreepFindingCount,
    0,
    'Generic admission: clean authority-creep lineage carries zero findings',
  );
  ok(
    typeof envelope.admission.request.policyScope.dimensions.authorityCreepGuardDigest === 'string',
    'Generic admission: authority-creep digest is carried without raw lineage material',
  );
  ok(
    envelope.admission.checks.every((check) => check.outcome === 'pass'),
    'Generic admission: authority-creep pass reason does not create false failing checks',
  );
  assert.doesNotMatch(
    serialized,
    /case:generic-authority-creep|claim:generic-authority-bounded/u,
    'Generic admission: serialized envelope does not leak raw authority-creep lineage ids',
  );
  markPassed();
}

function testAuthorityCreepMeasurementAsAuthorityRequiresReview(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    authorityCreep: {
      lineageGraph: authorityCreepLineageGraph([
        authorityCreepMeasurementArtifact('claim:generic-authority-bounded'),
      ]),
      evaluatorRefDigest: authorityCreepActorDigest,
    },
  });
  const evidenceCheck = envelope.admission.checks.find((check) => check.kind === 'evidence');

  equal(envelope.shadowDecision, 'would_review', 'Generic admission: authority-creep finding shadows review');
  equal(envelope.admission.decision, 'review', 'Generic admission: authority-creep finding holds enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('authority-creep-finding:measurement-artifact-targets-claim'),
    'Generic admission: authority-creep claim-target finding is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('authority-creep-outcome:authority-creep-open-undercutting-defeater'),
    'Generic admission: authority-creep undercutting outcome is explicit',
  );
  ok(
    evidenceCheck?.reasonCodes.includes('authority-creep-finding:measurement-artifact-targets-claim'),
    'Generic admission: authority-creep finding attaches to the evidence check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.authorityCreepGuardOutcome,
    'authority-creep-open-undercutting-defeater',
    'Generic admission: authority-creep review outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.authorityCreepOpensUndercuttingDefeater,
    true,
    'Generic admission: authority-creep undercutting flag is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.authorityCreepArtifactFindingCount,
    1,
    'Generic admission: authority-creep artifact finding count is carried',
  );
}

function testAuthorityCreepBoundaryRequestBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    authorityCreep: {
      ...cleanAuthorityCreepMetadata(),
      policyActivationRequested: true,
      authorityActionRequested: true,
    },
  });
  const evidenceCheck = envelope.admission.checks.find((check) => check.kind === 'evidence');
  const policyCheck = envelope.admission.checks.find((check) => check.kind === 'policy');
  const authorityCheck = envelope.admission.checks.find((check) => check.kind === 'authority');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: authority-creep boundary request shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: authority-creep boundary request blocks enforce mode');
  ok(
    envelope.admission.reasonCodes.includes('authority-creep-finding:policy-activation-requested'),
    'Generic admission: authority-creep policy activation finding is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('authority-creep-finding:authority-action-requested'),
    'Generic admission: authority-creep authority action finding is explicit',
  );
  ok(
    evidenceCheck?.reasonCodes.includes('authority-creep-outcome:authority-creep-rejected-boundary'),
    'Generic admission: authority-creep rejected boundary attaches to evidence check',
  );
  ok(
    policyCheck?.reasonCodes.includes('authority-creep-finding:policy-activation-requested'),
    'Generic admission: authority-creep policy activation attaches to policy check',
  );
  ok(
    authorityCheck?.reasonCodes.includes('authority-creep-finding:authority-action-requested'),
    'Generic admission: authority-creep authority action attaches to authority check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.authorityCreepRejectedBoundary,
    true,
    'Generic admission: authority-creep rejected boundary flag is carried',
  );
}

function testStalePolicyMismatchBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    staleAuthorityPolicy: {
      ...currentStaleAuthorityPolicy(),
      policyVersion: 'policy.refunds.v3-private',
      currentPolicyVersion: 'policy.refunds.v4-private',
      noGoReasons: ['private-fraud-hold-ticket-123'],
    },
  });
  const serialized = JSON.stringify(envelope);

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: stale policy mismatch shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: stale policy mismatch blocks enforce mode');
  equal(envelope.admission.allowed, false, 'Generic admission: stale policy mismatch is not allowed');
  equal(envelope.admission.failClosed, true, 'Generic admission: stale policy mismatch fails closed');
  ok(
    envelope.admission.reasonCodes.includes('policy-version-mismatch'),
    'Generic admission: stale policy mismatch reason is present',
  );
  ok(
    envelope.admission.reasonCodes.includes('stale-policy-block'),
    'Generic admission: stale policy block reason is present',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.staleAuthorityPolicyGuardOutcome,
    'block',
    'Generic admission: stale policy block outcome is carried',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.staleAuthorityPolicyNoGoReasonCount,
    1,
    'Generic admission: stale no-go reason count is carried',
  );
  assert.doesNotMatch(
    serialized,
    /policy\.refunds\.v3-private|policy\.refunds\.v4-private|private-fraud-hold-ticket-123/u,
    'Generic admission: serialized envelope does not leak raw stale policy/no-go text',
  );
  markPassed();
}

function testMissingAuthorityFreshnessRequiresReview(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    staleAuthorityPolicy: {
      ...currentStaleAuthorityPolicy(),
      authorityCheckedAt: null,
    },
  });

  equal(envelope.shadowDecision, 'would_review', 'Generic admission: missing authority freshness shadows review');
  equal(envelope.admission.decision, 'review', 'Generic admission: missing authority freshness holds enforce mode');
  equal(envelope.admission.allowed, false, 'Generic admission: missing authority freshness is not allowed');
  ok(
    envelope.admission.reasonCodes.includes('authority-freshness-missing'),
    'Generic admission: missing authority freshness reason is present',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.staleAuthorityPolicyGuardOutcome,
    'review',
    'Generic admission: stale guard review outcome is carried',
  );
}

function testScopeExpansionNarrowsEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope(scopedMoneyAdmission());
  const serialized = JSON.stringify(envelope);
  const policyCheck = envelope.admission.checks.find((check) => check.kind === 'policy');

  equal(envelope.shadowDecision, 'would_narrow', 'Generic admission: scope expansion shadows narrow');
  equal(envelope.admission.decision, 'narrow', 'Generic admission: enforce mode applies scope narrowing');
  equal(envelope.admission.allowed, true, 'Generic admission: narrowed scope is allowed with constraints');
  ok(
    envelope.admission.reasonCodes.includes('amount-exceeds-approved-scope'),
    'Generic admission: amount scope explosion reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('recipient-out-of-scope'),
    'Generic admission: recipient scope explosion reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('record-count-exceeds-approved-scope'),
    'Generic admission: record-count scope explosion reason is explicit',
  );
  equal(policyCheck?.outcome, 'warn', 'Generic admission: scope narrow warns the policy check without blocking the narrowed action');
  ok(
    policyCheck?.reasonCodes.includes('amount-exceeds-approved-scope'),
    'Generic admission: scope narrow amount reason attaches to the policy check',
  );
  ok(
    policyCheck?.reasonCodes.includes('recipient-out-of-scope'),
    'Generic admission: scope narrow recipient reason attaches to the policy check',
  );
  equal(
    envelope.admission.constraints.length,
    3,
    'Generic admission: scope guard emits one digest-bound constraint per narrowed dimension',
  );
  ok(
    envelope.admission.constraints.some((constraint) => constraint.kind === 'max-amount'),
    'Generic admission: scope guard emits an amount constraint',
  );
  ok(
    envelope.admission.constraints.some((constraint) => constraint.kind === 'record-scope'),
    'Generic admission: scope guard emits a record-scope constraint',
  );
  ok(
    envelope.admission.constraints.every((constraint) =>
      typeof constraint.parameterDigest === 'string' &&
      /^sha256:[a-f0-9]{64}$/u.test(constraint.parameterDigest)
    ),
    'Generic admission: scope constraints are digest-bound without raw scope values',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.scopeExplosionGuardOutcome,
    'narrow',
    'Generic admission: scope guard outcome is carried as a safe dimension',
  );
  assert.doesNotMatch(
    serialized,
    /recipient_other_private|recipient_customer_private|tenant_current_private|refund-service-private|policy:refund-scope-private/u,
    'Generic admission: serialized envelope does not leak raw scope policy, tenant, recipient, or downstream refs',
  );
  markPassed();
}

function testScopeEscalationBlocksEnforceMode(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...scopedMoneyAdmission(),
    requestedScope: {
      ...scopedMoneyAdmission().requestedScope,
      operationType: 'delete',
      dataClass: 'credential',
      reversibilityClass: 'irreversible',
    },
  });
  const policyCheck = envelope.admission.checks.find((check) => check.kind === 'policy');

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: scope escalation shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: enforce mode blocks scope escalation');
  equal(envelope.admission.allowed, false, 'Generic admission: blocked scope escalation is not allowed');
  ok(
    envelope.admission.reasonCodes.includes('scope-blocked'),
    'Generic admission: scope-blocked reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('operation-out-of-scope'),
    'Generic admission: operation out-of-scope reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('data-class-out-of-scope'),
    'Generic admission: data-class out-of-scope reason is explicit',
  );
  ok(
    envelope.admission.reasonCodes.includes('irreversible-action-not-approved'),
    'Generic admission: irreversible scope reason is explicit',
  );
  equal(policyCheck?.outcome, 'fail', 'Generic admission: blocked scope escalation fails the policy check');
  ok(
    policyCheck?.reasonCodes.includes('scope-blocked'),
    'Generic admission: scope-blocked reason attaches to the policy check',
  );
  ok(
    policyCheck?.reasonCodes.includes('operation-out-of-scope'),
    'Generic admission: scope operation reason attaches to the policy check',
  );
  equal(
    envelope.admission.request.policyScope.dimensions.scopeExplosionGuardOutcome,
    'block',
    'Generic admission: blocking scope guard outcome is carried',
  );
}

function testEnforceModeBlocksKnownUnsafeSignals(): void {
  const envelope = createGenericAdmissionEnvelope({
    ...baseMoneyAdmission('enforce'),
    observedFeatures: {
      policyBlocked: true,
    },
  });

  equal(envelope.shadowDecision, 'would_block', 'Generic admission: policyBlocked feature shadows block');
  equal(envelope.admission.decision, 'block', 'Generic admission: enforce mode applies block');
  equal(envelope.admission.allowed, false, 'Generic admission: block is not allowed');
  equal(envelope.admission.failClosed, true, 'Generic admission: block fails closed');
  equal(envelope.admission.retry.retryAllowed, false, 'Generic admission: policy-blocked actions are not model-retryable');
  ok(envelope.admission.retry.nonRetryableReasonCodes.includes('policy-blocked'), 'Generic admission: block marks policy-blocked as non-retryable');
  ok(envelope.admission.feedback.operatorOnlyReasonCodes.includes('policy-blocked'), 'Generic admission: policy-blocked feedback is operator-only');
}

function testInvalidInputFailsClosed(): void {
  throws(
    () =>
      createGenericAdmissionEnvelope({
        ...baseMoneyAdmission('maybe'),
      }),
    /mode must be one of/u,
    'Generic admission: invalid modes fail closed',
  );
  throws(
    () =>
      createGenericAdmissionEnvelope({
        ...baseMoneyAdmission('enforce'),
        domain: 'finance-but-not-really',
      }),
    /domain must be one of/u,
    'Generic admission: invalid domains fail closed',
  );
  throws(
    () =>
      createGenericAdmissionEnvelope({
        ...baseMoneyAdmission('enforce'),
        observedFeatures: {
          adapterReady: true,
        },
        observedFeatureOrigins: {
          adapterReady: 'self-asserted-by-model',
        },
      }),
    /observedFeatureOrigins\.adapterReady must be one of/u,
    'Generic admission: invalid observed feature origins fail closed',
  );
  throws(
    () =>
      createGenericAdmissionEnvelope({
        ...baseMoneyAdmission('enforce'),
        authoritySources: [
          {
            sourceKind: 'private-chat',
            claimKind: 'approval',
            sourceRef: 'chat:123',
          },
        ],
      }),
    /authoritySources\[0\]\.sourceKind must be one of/u,
    'Generic admission: invalid authority source kind fails closed',
  );
}

function testGenericGuardReasonCodeSetsRemainMappedToChecks(): void {
  const contractsSource = readProjectFile('src/consequence-admission/contracts.ts');
  const engineSource = [
    readProjectFile('src/consequence-admission/generic-engine.ts'),
    readProjectFile('src/consequence-admission/generic-engine-checks.ts'),
  ].join('\n');
  const reasonCodeSetNames = [
    ...contractsSource.matchAll(
      /^export const (GENERIC_ADMISSION_[A-Z_]+_REASON_CODES):/gmu,
    ),
  ].map((match) => match[1]);

  ok(
    reasonCodeSetNames.length >= 9,
    'Generic admission: guard reason-code set inventory is discoverable',
  );

  for (const setName of reasonCodeSetNames) {
    ok(
      engineSource.includes(`${setName}.has(reason)`),
      `Generic admission: ${setName} is mapped into the per-check reason surface`,
    );
  }
}

export function runDriftAuthorityScopeTests(): void {
  testCurrentStaleAuthorityPolicyCanAdmitCompleteRequest();
  testMatchingDecisionContextCanAdmitCompleteRequest();
  testMissingDecisionContextBlocksEnforceMode();
  testDecisionContextDriftRequiresReview();
  testCleanAuthorityCreepCanAdmitCompleteRequest();
  testAuthorityCreepMeasurementAsAuthorityRequiresReview();
  testAuthorityCreepBoundaryRequestBlocksEnforceMode();
  testStalePolicyMismatchBlocksEnforceMode();
  testMissingAuthorityFreshnessRequiresReview();
  testScopeExpansionNarrowsEnforceMode();
  testScopeEscalationBlocksEnforceMode();
  testEnforceModeBlocksKnownUnsafeSignals();
  testInvalidInputFailsClosed();
  testGenericGuardReasonCodeSetsRemainMappedToChecks();
}
