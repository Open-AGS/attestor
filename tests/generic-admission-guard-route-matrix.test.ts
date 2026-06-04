import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import {
  createAssuranceCaseContract,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  createConsequenceAdmissionAgentLoopAbuseGuard,
  createDecisionLineageGraph,
  type DecisionLineageArtifactRefInput,
  type DecisionLineageGraphRecord,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';
import { registerGenericAdmissionRoutes } from '../src/service/http/routes/generic-admission-routes.js';

let passed = 0;

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

function sha(seed: string): string {
  return `sha256:${createHash('sha256').update(seed).digest('hex')}`;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function trustedAuthoritySources(): readonly Record<string, string>[] {
  return [{
    sourceKind: 'verified-approval',
    claimKind: 'approval',
    sourceRef: 'approval:refund:987',
    evidenceDigest: digest('a'),
  }];
}

function trustedApprovals(): readonly Record<string, string | boolean>[] {
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

function validAdmissionPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function createApp(): Hono {
  const app = new Hono();
  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    recordShadowAdmission: () => {},
  });
  return app;
}

function cleanDecisionContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function scopedMoneyAdmission(): Record<string, unknown> {
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

const authorityCreepTenantDigest = sha('tenant:generic-route-authority-creep');
const authorityCreepScopeDigest = sha('scope:generic-route-authority-creep');
const authorityCreepActorDigest = sha('actor:generic-route-authority-creep');
const authorityCreepTransitionDigest = sha('transition:generic-route-authority-creep');

function authorityCreepLineageGraph(
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

function cleanAuthorityCreepMetadata(): Record<string, unknown> {
  return {
    lineageGraph: authorityCreepLineageGraph(),
    evaluatorRefDigest: authorityCreepActorDigest,
  };
}

type RouteGuardCase = {
  readonly guard: string;
  readonly payload: Record<string, unknown>;
  readonly shadowDecision: string;
  readonly decision: string;
  readonly reasonCodes: readonly string[];
  readonly dimensions: readonly [string, unknown][];
  readonly redactionPattern?: RegExp;
};

const routeGuardMatrix: readonly RouteGuardCase[] = [
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

type RouteRequiredEvidenceDomain = {
  readonly name: string;
  readonly domain: string;
  readonly action: string;
  readonly downstreamSystem: string;
  readonly overrides?: Record<string, unknown>;
};

type RouteRequiredEvidenceCase = {
  readonly name: string;
  readonly domain: string;
  readonly payload: Record<string, unknown>;
  readonly reasonCode: string;
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly operatorOnlyReasonCodes?: readonly string[];
};

type RouteDimensionCase = {
  readonly name: string;
  readonly payload: Record<string, unknown>;
  readonly reasonCode: string;
  readonly dimensions: readonly [string, unknown][];
  readonly missingFields: readonly string[];
  readonly requiredEvidenceKinds: readonly string[];
  readonly operatorOnlyReasonCodes: readonly string[];
};

function routeDomainPayload(routeDomain: RouteRequiredEvidenceDomain): Record<string, unknown> {
  return validAdmissionPayload({
    domain: routeDomain.domain,
    action: routeDomain.action,
    downstreamSystem: routeDomain.downstreamSystem,
    ...routeDomain.overrides,
  });
}

function withoutField(
  payload: Record<string, unknown>,
  fieldName: string,
  value: unknown,
): Record<string, unknown> {
  return {
    ...payload,
    [fieldName]: value,
  };
}

const routeRequiredEvidenceDomains: readonly RouteRequiredEvidenceDomain[] = [
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

const routeRequiredEvidenceCases: readonly RouteRequiredEvidenceCase[] =
  routeRequiredEvidenceDomains.flatMap((routeDomain) => {
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
  });

const routeAdapterReadinessCases: readonly RouteDimensionCase[] = [
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

async function postAdmission(payload: Record<string, unknown>): Promise<GenericAdmissionEnvelope> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json() as GenericAdmissionEnvelope;

  equal(response.status, 200, 'Generic admission guard matrix: route returns an envelope');
  equal(response.headers.get('cache-control'), 'no-store', 'Generic admission guard matrix: route response is no-store');

  return body;
}

async function testStructuredGuardCase(routeGuardCase: RouteGuardCase): Promise<void> {
  const body = await postAdmission(routeGuardCase.payload);
  const serialized = JSON.stringify(body);
  const dimensions = body.admission.request.policyScope.dimensions as Record<string, unknown>;

  equal(
    body.shadowDecision,
    routeGuardCase.shadowDecision,
    `Generic admission guard matrix: ${routeGuardCase.guard} shadows expected decision`,
  );
  equal(
    body.admission.decision,
    routeGuardCase.decision,
    `Generic admission guard matrix: ${routeGuardCase.guard} returns expected admission decision`,
  );

  for (const reasonCode of routeGuardCase.reasonCodes) {
    ok(
      body.admission.reasonCodes.includes(reasonCode),
      `Generic admission guard matrix: ${routeGuardCase.guard} includes ${reasonCode}`,
    );
  }
  for (const [dimension, expected] of routeGuardCase.dimensions) {
    equal(
      dimensions[dimension],
      expected,
      `Generic admission guard matrix: ${routeGuardCase.guard} carries ${dimension}`,
    );
  }
  if (routeGuardCase.redactionPattern) {
    assert.doesNotMatch(
      serialized,
      routeGuardCase.redactionPattern,
      `Generic admission guard matrix: ${routeGuardCase.guard} does not leak raw guard material`,
    );
    passed += 1;
  }
}

function assertEnforceRouteHoldForReview(
  body: GenericAdmissionEnvelope,
  label: string,
): void {
  equal(body.mode, 'enforce', `Generic admission route invariants: ${label} stays in enforce mode`);
  equal(body.shadowDecision, 'would_review', `Generic admission route invariants: ${label} shadows review`);
  equal(body.downstreamPosture, 'hold-for-review', `Generic admission route invariants: ${label} holds downstream`);
  equal(body.enforcementActive, true, `Generic admission route invariants: ${label} keeps enforcement active`);
  equal(body.admission.decision, 'review', `Generic admission route invariants: ${label} returns review`);
  equal(body.admission.allowed, false, `Generic admission route invariants: ${label} is not allowed`);
  equal(body.admission.failClosed, true, `Generic admission route invariants: ${label} fails closed`);
}

async function testRequiredEvidenceRouteCase(routeCase: RouteRequiredEvidenceCase): Promise<void> {
  const body = await postAdmission(routeCase.payload);
  const dimensions = body.admission.request.policyScope.dimensions as Record<string, unknown>;

  assertEnforceRouteHoldForReview(body, routeCase.name);
  equal(
    dimensions.domain,
    routeCase.domain,
    `Generic admission route invariants: ${routeCase.name} carries the domain dimension`,
  );
  ok(
    body.admission.reasonCodes.includes(routeCase.reasonCode),
    `Generic admission route invariants: ${routeCase.name} includes ${routeCase.reasonCode}`,
  );
  for (const missingField of routeCase.missingFields) {
    ok(
      body.admission.feedback.missingFields.includes(missingField),
      `Generic admission route invariants: ${routeCase.name} feedback names ${missingField}`,
    );
  }
  for (const requiredEvidenceKind of routeCase.requiredEvidenceKinds) {
    ok(
      body.admission.feedback.requiredEvidenceKinds.includes(requiredEvidenceKind),
      `Generic admission route invariants: ${routeCase.name} feedback asks for ${requiredEvidenceKind}`,
    );
  }
  for (const operatorReason of routeCase.operatorOnlyReasonCodes ?? []) {
    ok(
      body.admission.feedback.operatorOnlyReasonCodes.includes(operatorReason),
      `Generic admission route invariants: ${routeCase.name} marks ${operatorReason} operator-only`,
    );
  }
}

async function testAdapterReadinessRouteCase(routeCase: RouteDimensionCase): Promise<void> {
  const body = await postAdmission(routeCase.payload);
  const dimensions = body.admission.request.policyScope.dimensions as Record<string, unknown>;

  assertEnforceRouteHoldForReview(body, routeCase.name);
  ok(
    body.admission.reasonCodes.includes(routeCase.reasonCode),
    `Generic admission route invariants: ${routeCase.name} includes ${routeCase.reasonCode}`,
  );
  for (const [dimension, expected] of routeCase.dimensions) {
    equal(
      dimensions[dimension],
      expected,
      `Generic admission route invariants: ${routeCase.name} carries ${dimension}`,
    );
  }
  for (const missingField of routeCase.missingFields) {
    ok(
      body.admission.feedback.missingFields.includes(missingField),
      `Generic admission route invariants: ${routeCase.name} feedback names ${missingField}`,
    );
  }
  for (const requiredEvidenceKind of routeCase.requiredEvidenceKinds) {
    ok(
      body.admission.feedback.requiredEvidenceKinds.includes(requiredEvidenceKind),
      `Generic admission route invariants: ${routeCase.name} feedback asks for ${requiredEvidenceKind}`,
    );
  }
  for (const operatorReason of routeCase.operatorOnlyReasonCodes) {
    ok(
      body.admission.feedback.operatorOnlyReasonCodes.includes(operatorReason),
      `Generic admission route invariants: ${routeCase.name} marks ${operatorReason} operator-only`,
    );
  }
}

async function testAgentLoopAbuseGuardCase(): Promise<void> {
  const app = new Hono();
  const guard = createConsequenceAdmissionAgentLoopAbuseGuard({
    policy: {
      maxRetryAttemptsPerPreviousAdmission: 2,
    },
    now: () => '2026-05-01T18:12:00.000Z',
  });
  let shadowRecords = 0;

  registerGenericAdmissionRoutes(app, {
    currentTenant: () => ({
      tenantId: 'tenant_route',
      tenantName: 'Route Tenant',
      authenticatedAt: '2026-05-01T18:00:00.000Z',
      source: 'api_key',
      planId: 'starter',
      monthlyRunQuota: 100,
    }),
    evaluateAgentLoopAbuse: ({ tenant, envelope, receivedAt }) =>
      guard.evaluate({
        tenantId: tenant.tenantId,
        envelope,
        receivedAt,
      }),
    recordShadowAdmission: () => {
      shadowRecords += 1;
    },
  });

  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      mode: 'review',
      retryAttempt: {
        previousAdmissionId: 'admission:previous',
        previousAdmissionDigest: 'sha256:previous-admission',
        previousRequestId: 'request:previous',
        attemptNumber: 3,
        attemptedAt: '2026-05-01T18:12:00.000Z',
        correctionReasonCodes: ['policy-ref-missing'],
        correctionFields: ['policyRef'],
        idempotencyKey: 'retry:matrix:over-budget',
      },
    })),
  });
  const body = await response.json() as {
    readonly decision: string;
    readonly failClosed: boolean;
    readonly reasonCodes: readonly string[];
  };

  equal(response.status, 429, 'Generic admission guard matrix: agent-loop guard returns 429');
  equal(body.decision, 'block', 'Generic admission guard matrix: agent-loop guard blocks');
  equal(body.failClosed, true, 'Generic admission guard matrix: agent-loop guard fails closed');
  ok(
    body.reasonCodes.includes('agent-loop-attempt-budget-exhausted'),
    'Generic admission guard matrix: agent-loop attempt budget reason is explicit',
  );
  equal(shadowRecords, 0, 'Generic admission guard matrix: blocked loop attempt is not shadow recorded');
}

for (const routeGuardCase of routeGuardMatrix) {
  await testStructuredGuardCase(routeGuardCase);
}
for (const routeCase of routeRequiredEvidenceCases) {
  await testRequiredEvidenceRouteCase(routeCase);
}
for (const routeCase of routeAdapterReadinessCases) {
  await testAdapterReadinessRouteCase(routeCase);
}
await testAgentLoopAbuseGuardCase();

console.log(`Generic admission guard route matrix tests: ${passed} passed, 0 failed`);
