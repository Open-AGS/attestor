import {
  assert,
  Hono,
  createApp,
  createDpopProof,
  createInMemoryReleaseTokenIntrospectionStore,
  createLoopGuardedApp,
  cleanDecisionContext,
  digest,
  equal,
  markPassed,
  generateDpopKeyPair,
  issueGenericAdmissionProtectedReleaseToken,
  ok,
  registerGenericAdmissionRoutes,
  releaseTokenIssuerFixture,
  resolveHostedGenericAdmissionDpopSenderConfirmation,
  trustedApprovals,
  trustedAuthoritySources,
  validAdmissionPayload,
} from './helpers.js';

async function testPostAdmissionRouteBlocksUntrustedToolResultAuthority(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      allowedToolResultEvidenceClasses: ['policy-record'],
      toolResults: [
        {
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
        },
      ],
    })),
  });
  const body = await response.json() as GenericAdmissionEnvelope;
  const serialized = JSON.stringify(body);

  equal(response.status, 200, 'Generic admission route: tool-result guard request returns an envelope');
  equal(body.shadowDecision, 'would_block', 'Generic admission route: untrusted tool-result authority shadows block');
  equal(body.admission.decision, 'block', 'Generic admission route: untrusted tool-result authority blocks');
  ok(
    body.admission.reasonCodes.includes('tool-result-untrusted-source'),
    'Generic admission route: untrusted tool-result source reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('tool-result-block'),
    'Generic admission route: tool-result block reason is explicit',
  );
  assert.doesNotMatch(
    serialized,
    /tool-result:private:policy-ref|attacker\.example|private-policy/u,
    'Generic admission route: response does not leak raw tool-result refs or source URLs',
  );
  markPassed();
}

async function testPostAdmissionRouteBlocksUnsafeAgenticSupplyChain(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      agenticSupplyChain: {
        components: [
          {
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
          },
        ],
      },
    })),
  });
  const body = await response.json() as GenericAdmissionEnvelope;
  const serialized = JSON.stringify(body);

  equal(response.status, 200, 'Generic admission route: supply-chain guard request returns an envelope');
  equal(body.shadowDecision, 'would_block', 'Generic admission route: unsafe supply chain shadows block');
  equal(body.admission.decision, 'block', 'Generic admission route: unsafe supply chain blocks');
  ok(
    body.admission.reasonCodes.includes('supply-chain-critical-component-block'),
    'Generic admission route: critical supply-chain block reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('supply-chain-permission-overbroad'),
    'Generic admission route: overbroad supply-chain permission reason is explicit',
  );
  equal(
    body.admission.request.policyScope.dimensions.agenticSupplyChainGuardOutcome,
    'block',
    'Generic admission route: supply-chain outcome is dimensioned',
  );
  assert.doesNotMatch(
    serialized,
    /private-route-risk|private-route-generated-code|refund:admin/u,
    'Generic admission route: response does not leak raw supply-chain refs or permissions',
  );
  markPassed();
}

async function testPostAdmissionRouteBlocksUnsafeHumanReviewFatigue(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
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
    })),
  });
  const body = await response.json() as GenericAdmissionEnvelope;
  const serialized = JSON.stringify(body);

  equal(response.status, 200, 'Generic admission route: human-review guard request returns an envelope');
  equal(body.shadowDecision, 'would_block', 'Generic admission route: unsafe human-review packet shadows block');
  equal(body.admission.decision, 'block', 'Generic admission route: unsafe human-review packet blocks');
  ok(
    body.admission.reasonCodes.includes('raw-payload-stored'),
    'Generic admission route: raw human-review payload storage reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('auto-enforce-requested'),
    'Generic admission route: auto-enforce human-review bypass reason is explicit',
  );
  equal(
    body.admission.request.policyScope.dimensions.humanReviewFatigueGuardOutcome,
    'block',
    'Generic admission route: human-review guard outcome is dimensioned',
  );
  equal(
    body.admission.request.policyScope.dimensions.humanReviewRawPayloadStored,
    true,
    'Generic admission route: human-review raw payload dimension is boolean-only',
  );
  assert.doesNotMatch(
    serialized,
    /private-route-fatigue-risk/u,
    'Generic admission route: response does not leak raw human-review packet refs',
  );
  markPassed();
}

async function testPostAdmissionRouteBlocksUnsafeMultiAgentDelegation(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
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
    })),
  });
  const body = await response.json() as GenericAdmissionEnvelope;
  const serialized = JSON.stringify(body);

  equal(response.status, 200, 'Generic admission route: delegation guard request returns an envelope');
  equal(body.shadowDecision, 'would_block', 'Generic admission route: unsafe delegation chain shadows block');
  equal(body.admission.decision, 'block', 'Generic admission route: unsafe delegation chain blocks');
  ok(
    body.admission.reasonCodes.includes('delegation-scope-unapproved'),
    'Generic admission route: unapproved delegated scope reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('delegation-actor-self-approved'),
    'Generic admission route: self-approved delegation reason is explicit',
  );
  equal(
    body.admission.request.policyScope.dimensions.multiAgentDelegationGuardOutcome,
    'block',
    'Generic admission route: delegation guard outcome is dimensioned',
  );
  equal(
    body.admission.request.policyScope.dimensions.multiAgentDelegationAgentPrincipalCount,
    3,
    'Generic admission route: delegation agent principal count is dimensioned',
  );
  assert.doesNotMatch(
    serialized,
    /private-route-originator|private-route-executor|tenant:private-route/u,
    'Generic admission route: response does not leak raw delegation refs or tenant ids',
  );
  markPassed();
}

async function testPostAdmissionRouteBlocksStaleAuthorityPolicy(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
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
    })),
  });
  const body = await response.json() as GenericAdmissionEnvelope;
  const serialized = JSON.stringify(body);

  equal(response.status, 200, 'Generic admission route: stale policy guard request returns an envelope');
  equal(body.shadowDecision, 'would_block', 'Generic admission route: stale policy shadows block');
  equal(body.admission.decision, 'block', 'Generic admission route: stale policy blocks enforce mode');
  ok(
    body.admission.reasonCodes.includes('policy-version-mismatch'),
    'Generic admission route: stale policy mismatch reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('policy-updated-after-approval'),
    'Generic admission route: policy update after approval reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('stale-policy-block'),
    'Generic admission route: stale policy block reason is explicit',
  );
  equal(
    body.admission.request.policyScope.dimensions.staleAuthorityPolicyGuardOutcome,
    'block',
    'Generic admission route: stale policy outcome is dimensioned',
  );
  assert.doesNotMatch(
    serialized,
    /policy\.refunds\.v2-private|policy\.refunds\.v3-private|private-fraud-hold-ticket-456/u,
    'Generic admission route: response does not leak raw stale policy/no-go text',
  );
  markPassed();
}

async function testPostAdmissionRouteBlocksMissingDecisionContext(): Promise<void> {
  const app = createApp();
  const response = await app.request('/api/v1/admissions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(validAdmissionPayload({
      decisionContextDrift: {
        boundContext: cleanDecisionContext({
          modelVersion: null,
          toolSchemaDigest: null,
          policyVersion: null,
          configDigest: null,
        }),
        currentContext: null,
      },
    })),
  });
  const body = await response.json() as GenericAdmissionEnvelope;
  const serialized = JSON.stringify(body);

  equal(response.status, 200, 'Generic admission route: decision-context guard request returns an envelope');
  equal(body.shadowDecision, 'would_block', 'Generic admission route: missing decision context shadows block');
  equal(body.admission.decision, 'block', 'Generic admission route: missing decision context blocks enforce mode');
  ok(
    body.admission.reasonCodes.includes('current-context-missing'),
    'Generic admission route: missing current context reason is explicit',
  );
  ok(
    body.admission.reasonCodes.includes('decision-context-block'),
    'Generic admission route: decision-context block reason is explicit',
  );
  equal(
    body.admission.request.policyScope.dimensions.decisionContextDriftOutcome,
    'block',
    'Generic admission route: decision-context outcome is dimensioned',
  );
  equal(
    body.admission.request.policyScope.dimensions.decisionContextMissingDimensionCount,
    4,
    'Generic admission route: missing decision-context dimensions are counted',
  );
  assert.doesNotMatch(
    serialized,
    /route-private-refund-agent|policy:route-refunds:v4-private/u,
    'Generic admission route: response does not leak raw decision-context values',
  );
  markPassed();
}

export async function runGuardRouteTests(): Promise<void> {
  await testPostAdmissionRouteBlocksUntrustedToolResultAuthority();
  await testPostAdmissionRouteBlocksUnsafeAgenticSupplyChain();
  await testPostAdmissionRouteBlocksUnsafeHumanReviewFatigue();
  await testPostAdmissionRouteBlocksUnsafeMultiAgentDelegation();
  await testPostAdmissionRouteBlocksStaleAuthorityPolicy();
  await testPostAdmissionRouteBlocksMissingDecisionContext();
}
