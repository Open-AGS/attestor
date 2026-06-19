import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import {
  createAssuranceCaseContract,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  createDecisionLineageGraph,
  type DecisionLineageArtifactRefInput,
  type DecisionLineageGraphRecord,
} from '../src/consequence-admission/index.js';
import { registerGenericAdmissionRoutes } from '../src/service/http/routes/generic-admission-routes.js';

let passed = 0;

export function passedCount(): number { return passed; }

export function doesNotMatch(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

export function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

export function sha(seed: string): string {
  return `sha256:${createHash('sha256').update(seed).digest('hex')}`;
}

export function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

export function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

export function trustedAuthoritySources(): readonly Record<string, string>[] {
  return [{
    sourceKind: 'verified-approval',
    claimKind: 'approval',
    sourceRef: 'approval:refund:987',
    evidenceDigest: digest('a'),
  }];
}

export function trustedApprovals(): readonly Record<string, string | boolean>[] {
  return [{
    approvalRef: 'approval:refund:987',
    sourceKind: 'approval-workflow',
    state: 'approved',
    sourceRef: 'workflow:refund-approval:987',
    reviewerRef: 'reviewer:risk-owner',
    reviewerAuthorityDigest: digest('b'),
    approvalDigest: digest('c'),
    scopeDigest: digest('d'),
    issuedAt: '2026-05-01T17:00:00.000Z',
    expiresAt: '2026-05-01T19:00:00.000Z',
    signatureVerified: true,
  }];
}

export function validAdmissionPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'enforce',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T18:00:00.000Z',
    decidedAt: '2026-05-01T18:00:01.000Z',
    policyRef: 'policy:refunds:v1',
    reviewerRef: 'reviewer:risk-owner',
    evidenceRefs: ['order:987', 'payment:456'],
    authoritySources: trustedAuthoritySources(),
    approvals: trustedApprovals(),
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    ...overrides,
  };
}

export function createApp(): Hono {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'custom-admission-guard-test-plan',
      monthlyRunQuota: 100,
    }),
    recordShadowAdmission: () => {},
  });
  return app;
}

export function cleanDecisionContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    modelVersion: 'model:route-private-refund-agent:2026-05-01',
    toolSchemaDigest: digest('1'),
    toolManifestDigest: digest('2'),
    policyVersion: 'policy:route-refunds:v4-private',
    policyDigest: digest('3'),
    configDigest: digest('4'),
    promptDigest: digest('5'),
    verifierDigest: digest('6'),
    simulationDigest: digest('7'),
    evaluatedAt: '2026-05-01T17:00:00.000Z',
    expiresAt: '2026-05-02T17:00:00.000Z',
    ...overrides,
  };
}

export function scopedMoneyAdmission(): Record<string, unknown> {
  return validAdmissionPayload({
    scopeOwnerPolicyRef: 'policy:refund-scope-private',
    requestedScope: {
      amountMinorUnits: 9000,
      currency: 'usd',
      recordCount: 12,
      operationType: 'refund',
      recipientId: 'recipient_other_private',
      tenantId: 'tenant_route',
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
      tenantId: 'tenant_route',
      environments: ['production'],
      downstreamSystems: ['refund-service-private'],
      dataClasses: ['customer-visible'],
      reversibilityClasses: ['reversible', 'compensating-action-available'],
    },
  });
}

export const authorityCreepTenantDigest = sha('tenant:generic-route-authority-creep');
export const authorityCreepScopeDigest = sha('scope:generic-route-authority-creep');
export const authorityCreepActorDigest = sha('actor:generic-route-authority-creep');
export const authorityCreepTransitionDigest = sha('transition:generic-route-authority-creep');

export function authorityCreepLineageGraph(
  artifacts: readonly DecisionLineageArtifactRefInput[] = [],
): DecisionLineageGraphRecord {
  const claim = createAssuranceCaseNode({
    nodeId: 'claim:generic-route-authority-bounded',
    kind: 'claim',
    title: 'Generic route authority remains bounded',
    bodyDigest: sha('claim:generic-route-authority-creep'),
    tenantRefDigest: authorityCreepTenantDigest,
    scopeDigest: authorityCreepScopeDigest,
    createdByRefDigest: authorityCreepActorDigest,
    createdAt: '2026-05-01T16:58:00.000Z',
  });
  const evidence = createAssuranceCaseNode({
    nodeId: 'evidence:generic-route-runtime-lineage',
    kind: 'evidence',
    title: 'Generic route runtime lineage evidence',
    bodyDigest: sha('evidence:generic-route-authority-creep'),
    tenantRefDigest: authorityCreepTenantDigest,
    scopeDigest: authorityCreepScopeDigest,
    createdByRefDigest: authorityCreepActorDigest,
    createdAt: '2026-05-01T16:58:01.000Z',
  });
  const assuranceCase = createAssuranceCaseContract({
    caseId: 'case:generic-route-authority-creep',
    tenantRefDigest: authorityCreepTenantDigest,
    rootClaimId: claim.nodeId,
    createdAt: '2026-05-01T16:58:00.000Z',
    lastReviewedAt: '2026-05-01T16:59:00.000Z',
    nodes: [claim, evidence],
    defeaters: [],
    transitions: [
      createAssuranceCaseTransition({
        transitionId: 'transition:generic-route-authority-claim',
        transitionKind: 'create-node',
        actorRefDigest: authorityCreepActorDigest,
        occurredAt: '2026-05-01T16:58:02.000Z',
        reasonDigest: authorityCreepTransitionDigest,
        nodeId: claim.nodeId,
        evidenceRefDigest: claim.digest,
      }),
      createAssuranceCaseTransition({
        transitionId: 'transition:generic-route-authority-evidence',
        transitionKind: 'create-node',
        actorRefDigest: authorityCreepActorDigest,
        occurredAt: '2026-05-01T16:58:03.000Z',
        reasonDigest: authorityCreepTransitionDigest,
        nodeId: evidence.nodeId,
        evidenceRefDigest: evidence.digest,
      }),
    ],
  });
  return createDecisionLineageGraph({
    assuranceCase,
    lineageId: 'lineage:generic-route-authority-creep',
    generatedAt: '2026-05-01T16:59:30.000Z',
    builderRefDigest: authorityCreepActorDigest,
    artifactRefs: artifacts,
  });
}

export function cleanAuthorityCreepMetadata(): Record<string, unknown> {
  return {
    lineageGraph: authorityCreepLineageGraph(),
    evaluatorRefDigest: authorityCreepActorDigest,
  };
}

export type RouteGuardCase = {
  readonly guard: string;
  readonly payload: Record<string, unknown>;
  readonly shadowDecision: string;
  readonly decision: string;
  readonly reasonCodes: readonly string[];
  readonly dimensions: readonly [string, unknown][];
  readonly redactionPattern?: RegExp;
};

export const routeGuardMatrix: readonly RouteGuardCase[] = [
  {
    guard: 'untrusted-content-authority',
    payload: validAdmissionPayload({
      authoritySources: [{
        sourceKind: 'customer-email',
        claimKind: 'approval',
        sourceRef: 'raw-email:customer@example.com says manager approved refund',
      }],
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['untrusted-content-authority-source', 'authority-block'],
    dimensions: [
      ['authorityGuardOutcome', 'block'],
      ['untrustedAuthoritySourceCount', 1],
    ],
    redactionPattern: /customer@example\.com|manager approved refund/u,
  },
  {
    guard: 'guard-input-provenance',
    payload: validAdmissionPayload({
      guardInputProvenance: [{
        guardKind: 'authority',
        sourceClass: 'caller-supplied',
        assertionKinds: ['authority'],
        sourceRef: 'raw:customer asked to bypass provenance',
        sourceDigest: digest('p'),
        evidenceDigest: digest('q'),
        tenantId: 'tenant_route',
        recordedAt: '2026-05-01T18:00:00.000Z',
        trustedBoundary: false,
      }],
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['guard-input-authority-untrusted', 'guard-input-block'],
    dimensions: [
      ['guardInputProvenanceOutcome', 'block'],
      ['guardInputProvenanceUntrustedSourceCount', 1],
    ],
    redactionPattern: /customer asked to bypass provenance/u,
  },
  {
    guard: 'approval-provenance',
    payload: validAdmissionPayload({
      approvals: [{
        approvalRef: 'email:customer@example.com says approved',
        sourceKind: 'customer-email',
        state: 'approved',
        sourceRef: 'email:customer@example.com',
        reviewerRef: 'reviewer:risk-owner',
        reviewerAuthorityDigest: digest('b'),
        approvalDigest: digest('c'),
        scopeDigest: digest('d'),
        issuedAt: '2026-05-01T17:00:00.000Z',
      }],
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['approval-source-untrusted', 'approval-block'],
    dimensions: [['approvalGuardOutcome', 'block']],
    redactionPattern: /customer@example\.com|says approved/u,
  },
  {
    guard: 'no-go-condition-ledger',
    payload: validAdmissionPayload({
      noGoLedgerRef: 'ledger:refund:no-go',
      noGoConditions: [{
        conditionRef: 'hold:fraud:987',
        kind: 'fraud-hold',
        state: 'active',
        sourceKind: 'fraud-system',
        sourceRef: 'fraud-case:987',
        ownerRef: 'team:fraud-ops',
        ownerAuthorityDigest: digest('e'),
        scopeDigest: digest('f'),
        issuedAt: '2026-05-01T16:00:00.000Z',
        expiresAt: '2026-05-02T16:00:00.000Z',
      }],
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['active-no-go-condition-present', 'no-go-condition-block'],
    dimensions: [
      ['noGoConditionOutcome', 'block'],
      ['noGoActiveConditionCount', 1],
    ],
    redactionPattern: /hold:fraud:987|fraud-case:987|team:fraud-ops/u,
  },
  {
    guard: 'scope-explosion',
    payload: scopedMoneyAdmission(),
    shadowDecision: 'would_narrow',
    decision: 'narrow',
    reasonCodes: [
      'amount-exceeds-approved-scope',
      'recipient-out-of-scope',
      'record-count-exceeds-approved-scope',
    ],
    dimensions: [['scopeExplosionGuardOutcome', 'narrow']],
    redactionPattern: /recipient_other_private|recipient_customer_private|refund-service-private/u,
  },
  {
    guard: 'tool-result-poisoning',
    payload: validAdmissionPayload({
      allowedToolResultEvidenceClasses: ['policy-record'],
      toolResults: [{
        toolResultRef: 'tool-result:private:policy-ref',
        toolKind: 'web-search',
        sourceTrustClass: 'untrusted-external',
        resultUse: 'authority',
        sourceRef: 'https://attacker.example/private-policy',
        sourceTimestamp: '2026-05-01T18:00:00.000Z',
        integrityDigest: digest('e'),
        evidenceDigest: digest('f'),
        evidenceClass: 'policy-record',
        toolRisk: 'high',
      }],
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['tool-result-untrusted-source', 'tool-result-block'],
    dimensions: [['toolResultGuardOutcome', 'block']],
    redactionPattern: /tool-result:private:policy-ref|attacker\.example|private-policy/u,
  },
  {
    guard: 'agentic-supply-chain',
    payload: validAdmissionPayload({
      agenticSupplyChain: {
        components: [{
          componentRef: 'generated-adapter:private-route-risk',
          componentKind: 'generated-adapter',
          trustClass: 'unknown',
          criticality: 'critical',
          sourceRef: 'model-output:private-route-generated-code',
          sourcePinned: false,
          declaredPermissions: ['refund:create', 'refund:admin'],
          allowedPermissions: ['refund:create'],
          generatedArtifact: true,
          generatedArtifactReviewed: false,
          domainPackBoundaryVerified: false,
        }],
      },
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['supply-chain-critical-component-block', 'supply-chain-permission-overbroad'],
    dimensions: [['agenticSupplyChainGuardOutcome', 'block']],
    redactionPattern: /private-route-risk|private-route-generated-code|refund:admin/u,
  },
  {
    guard: 'human-review-fatigue',
    payload: validAdmissionPayload({
      humanReviewFatigue: {
        reviewSurfaceKind: 'external-review-packet',
        reviewPacketRef: 'review-packet:private-route-fatigue-risk',
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
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['raw-payload-stored', 'auto-enforce-requested'],
    dimensions: [
      ['humanReviewFatigueGuardOutcome', 'block'],
      ['humanReviewRawPayloadStored', true],
    ],
    redactionPattern: /private-route-fatigue-risk/u,
  },
  {
    guard: 'multi-agent-delegation',
    payload: validAdmissionPayload({
      multiAgentDelegation: {
        principalChain: [
          {
            principalRef: 'agent:private-route-originator',
            principalKind: 'ai-agent',
            role: 'originator',
            tenantId: 'tenant:private-route',
            identityDigest: digest('1'),
            authorityDigest: digest('2'),
            scopeDigest: digest('3'),
          },
          {
            principalRef: 'agent:private-route-executor',
            principalKind: 'ai-agent',
            role: 'executor',
            tenantId: 'tenant:private-route',
            identityDigest: digest('4'),
            authorityDigest: digest('5'),
            scopeDigest: digest('6'),
          },
          {
            principalRef: 'agent:private-route-executor',
            principalKind: 'ai-agent',
            role: 'approver',
            tenantId: 'tenant:private-route',
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
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['delegation-scope-unapproved', 'delegation-actor-self-approved'],
    dimensions: [
      ['multiAgentDelegationGuardOutcome', 'block'],
      ['multiAgentDelegationAgentPrincipalCount', 3],
    ],
    redactionPattern: /private-route-originator|private-route-executor|tenant:private-route/u,
  },
  {
    guard: 'stale-authority-policy',
    payload: validAdmissionPayload({
      staleAuthorityPolicy: {
        policyVersion: 'policy.refunds.v2-private',
        currentPolicyVersion: 'policy.refunds.v3-private',
        policyDigest: digest('a'),
        currentPolicyDigest: digest('b'),
        policyUpdatedAt: '2026-05-01T18:00:30.000Z',
        approvalIssuedAt: '2026-05-01T18:00:00.000Z',
        approvalValidFrom: '2026-05-01T18:00:00.000Z',
        approvalValidUntil: '2026-05-01T19:00:00.000Z',
        authorityCheckedAt: '2026-05-01T18:00:00.000Z',
        authorityExpiresAt: '2026-05-01T19:00:00.000Z',
        maxAuthorityAgeSeconds: 300,
        driftState: 'no-go',
        noGoReasons: ['private-fraud-hold-ticket-456'],
      },
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['policy-version-mismatch', 'policy-updated-after-approval', 'stale-policy-block'],
    dimensions: [['staleAuthorityPolicyGuardOutcome', 'block']],
    redactionPattern: /policy\.refunds\.v2-private|policy\.refunds\.v3-private|private-fraud-hold-ticket-456/u,
  },
  {
    guard: 'decision-context-drift',
    payload: validAdmissionPayload({
      decisionContextDrift: {
        boundContext: cleanDecisionContext({
          modelVersion: null,
          toolSchemaDigest: null,
          policyVersion: null,
          configDigest: null,
        }),
        currentContext: null,
      },
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: ['current-context-missing', 'decision-context-block'],
    dimensions: [
      ['decisionContextDriftOutcome', 'block'],
      ['decisionContextMissingDimensionCount', 4],
    ],
    redactionPattern: /route-private-refund-agent|policy:route-refunds:v4-private/u,
  },
  {
    guard: 'authority-creep',
    payload: validAdmissionPayload({
      authorityCreep: {
        ...cleanAuthorityCreepMetadata(),
        policyActivationRequested: true,
        authorityActionRequested: true,
      },
    }),
    shadowDecision: 'would_block',
    decision: 'block',
    reasonCodes: [
      'authority-creep-finding:policy-activation-requested',
      'authority-creep-finding:authority-action-requested',
    ],
    dimensions: [
      ['authorityCreepGuardOutcome', 'authority-creep-rejected-boundary'],
      ['authorityCreepRejectedBoundary', true],
    ],
    redactionPattern: /case:generic-route-authority-creep|claim:generic-route-authority-bounded/u,
  },
];

export type RouteRequiredEvidenceDomain = {
  readonly name: string;
  readonly domain: string;
  readonly action: string;
  readonly downstreamSystem: string;
  readonly overrides?: Record<string, unknown>;
};

export type RouteRequiredEvidenceCase = {
  readonly name: string;
  readonly domain: string;
  readonly payload: Record<string, unknown>;
  readonly reasonCode: string;
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly operatorOnlyReasonCodes?: readonly string[];
};

export type RouteDimensionCase = {
  readonly name: string;
  readonly payload: Record<string, unknown>;
  readonly reasonCode: string;
  readonly dimensions: readonly [string, unknown][];
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly operatorOnlyReasonCodes: readonly string[];
};

export function routeDomainPayload(routeDomain: RouteRequiredEvidenceDomain): Record<string, unknown> {
  return validAdmissionPayload({
    domain: routeDomain.domain,
    action: routeDomain.action,
    downstreamSystem: routeDomain.downstreamSystem,
    ...routeDomain.overrides,
  });
}

export function withoutField(
  payload: Record<string, unknown>,
  fieldName: string,
  value: unknown,
): Record<string, unknown> {
  return {
    ...payload,
    [fieldName]: value,
  };
}

export const routeRequiredEvidenceDomains: readonly RouteRequiredEvidenceDomain[] = [
  {
    name: 'financial record',
    domain: 'financial-record',
    action: 'write_reconciliation_record',
    downstreamSystem: 'finance-workflow',
  },
  {
    name: 'money movement',
    domain: 'money-movement',
    action: 'issue_refund',
    downstreamSystem: 'refund-service',
  },
  {
    name: 'programmable money',
    domain: 'programmable-money',
    action: 'wallet_call',
    downstreamSystem: 'wallet-rpc',
    overrides: {
      observedFeatures: {
        adapterReady: true,
      },
      observedFeatureOrigins: {
        adapterReady: 'operator-attested',
      },
    },
  },
  {
    name: 'data disclosure',
    domain: 'data-disclosure',
    action: 'export_customer_package',
    downstreamSystem: 'customer-export-service',
    overrides: {
      dataScope: {
        records: 12,
        classification: 'restricted',
        fields: ['email', 'account_status'],
      },
    },
  },
  {
    name: 'authority change',
    domain: 'authority-change',
    action: 'grant_admin_role',
    downstreamSystem: 'identity-provider',
    overrides: {
      authorityMode: 'grant-role',
    },
  },
  {
    name: 'external communication',
    domain: 'external-communication',
    action: 'send_customer_notice',
    downstreamSystem: 'notification-service',
  },
  {
    name: 'regulated filing',
    domain: 'regulated-filing',
    action: 'prepare_regulated_notice',
    downstreamSystem: 'filing-system',
  },
  {
    name: 'system operation',
    domain: 'system-operation',
    action: 'deploy_service_change',
    downstreamSystem: 'deployment-pipeline',
  },
];

export const routeRequiredEvidenceCases: readonly RouteRequiredEvidenceCase[] = Object.freeze([
  ...routeRequiredEvidenceDomains.flatMap((routeDomain) => {
    const payload = routeDomainPayload(routeDomain);
    return [
      {
        name: `${routeDomain.name} missing policy ref`,
        domain: routeDomain.domain,
        payload: withoutField(payload, 'policyRef', null),
        reasonCode: 'policy-ref-missing',
        missingFields: ['policyRef'],
        requiredEvidenceKinds: ['policy_ref'],
      },
      {
        name: `${routeDomain.name} missing evidence refs`,
        domain: routeDomain.domain,
        payload: withoutField(payload, 'evidenceRefs', []),
        reasonCode: 'evidence-ref-missing',
        missingFields: ['evidenceRefs'],
        requiredEvidenceKinds: ['evidence_ref'],
      },
      {
        name: `${routeDomain.name} missing authority source`,
        domain: routeDomain.domain,
        payload: {
          ...payload,
          authoritySources: [],
          approvals: [],
        },
        reasonCode: 'authority-source-missing',
        missingFields: ['authoritySources'],
        requiredEvidenceKinds: ['trusted_authority_source_ref'],
        operatorOnlyReasonCodes: ['authority-source-missing'],
      },
    ];
  }),
  {
    name: 'money movement missing required guard input provenance',
    domain: 'money-movement',
    payload: validAdmissionPayload({
      requiredGuardInputProvenance: ['authority'],
    }),
    reasonCode: 'guard-input-provenance-missing',
    missingFields: ['guardInputProvenance'],
    requiredEvidenceKinds: ['guard_input_provenance_ref'],
    operatorOnlyReasonCodes: ['guard-input-provenance-missing'],
  },
]);

export const routeAdapterReadinessCases: readonly RouteDimensionCase[] = [
  {
    name: 'programmable money missing adapter readiness',
    payload: validAdmissionPayload({
      domain: 'programmable-money',
      action: 'wallet_call',
      downstreamSystem: 'wallet-rpc',
    }),
    reasonCode: 'adapter-readiness-missing',
    dimensions: [
      ['adapterReady', false],
      ['adapterReadyObserved', false],
      ['adapterReadyOrigin', null],
    ],
    missingFields: ['observedFeatures.adapterReady'],
    requiredEvidenceKinds: ['adapter_readiness_ref'],
    operatorOnlyReasonCodes: ['adapter-readiness-missing'],
  },
  {
    name: 'programmable money caller-supplied adapter readiness',
    payload: validAdmissionPayload({
      domain: 'programmable-money',
      action: 'wallet_call',
      downstreamSystem: 'wallet-rpc',
      observedFeatures: {
        adapterReady: true,
      },
      observedFeatureOrigins: {
        adapterReady: 'caller-supplied',
      },
    }),
    reasonCode: 'adapter-readiness-origin-untrusted',
    dimensions: [
      ['adapterReady', false],
      ['adapterReadyObserved', true],
      ['adapterReadyOrigin', 'caller-supplied'],
    ],
    missingFields: ['observedFeatureOrigins.adapterReady'],
    requiredEvidenceKinds: ['adapter_readiness_origin_ref'],
    operatorOnlyReasonCodes: ['adapter-readiness-origin-untrusted'],
  },
];

export const routeDomainMetadataCases: readonly RouteDimensionCase[] = [
  {
    name: 'money movement missing amount metadata',
    payload: validAdmissionPayload({
      amount: null,
    }),
    reasonCode: 'amount-scope-missing',
    dimensions: [['domain', 'money-movement']],
    missingFields: ['amount'],
    requiredEvidenceKinds: [],
    operatorOnlyReasonCodes: [],
  },
  {
    name: 'money movement missing recipient metadata',
    payload: validAdmissionPayload({
      recipient: null,
    }),
    reasonCode: 'recipient-scope-missing',
    dimensions: [['domain', 'money-movement']],
    missingFields: ['recipient'],
    requiredEvidenceKinds: [],
    operatorOnlyReasonCodes: [],
  },
  {
    name: 'data disclosure missing data scope metadata',
    payload: validAdmissionPayload({
      domain: 'data-disclosure',
      action: 'export_customer_package',
      downstreamSystem: 'customer-export-service',
      dataScope: null,
    }),
    reasonCode: 'data-scope-missing',
    dimensions: [['domain', 'data-disclosure']],
    missingFields: ['dataScope'],
    requiredEvidenceKinds: ['data_scope_ref'],
    operatorOnlyReasonCodes: [],
  },
  {
    name: 'authority change missing authority mode metadata',
    payload: validAdmissionPayload({
      domain: 'authority-change',
      action: 'grant_admin_role',
      downstreamSystem: 'identity-provider',
      authorityMode: null,
    }),
    reasonCode: 'authority-mode-missing',
    dimensions: [['domain', 'authority-change']],
    missingFields: ['authorityMode'],
    requiredEvidenceKinds: ['authority_ref'],
    operatorOnlyReasonCodes: [],
  },
];
