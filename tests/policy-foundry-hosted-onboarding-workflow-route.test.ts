import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE,
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE,
} from '../src/service/http/routes/policy-foundry-hosted-onboarding-routes.js';
import { createFileBackedPolicyFoundryHostedWizardStateStore } from '../src/service/policy-foundry/policy-foundry-hosted-wizard-state.js';
import {
  baseRequestBody,
  createApp,
  createEvent,
  deepEqual,
  digest,
  entitlement,
  equal,
  excludes,
  includes,
  ok,
  passedCount,
  passingLiveDownstreamReplayObservations,
  passingReplayObservations,
  pipelineIdempotencyService,
  tenantA,
  tenantB,
  testDocsAndScriptsExposeHostedWorkflowRoute,
  testHostedRouteRendersStatelessReviewWorkflow,
  withPipelineIdempotencyEnv,
  workflowEntitlement,
} from './policy-foundry-hosted-onboarding-workflow-route-fixtures.js';

async function testHostedRouteRendersHtmlViewFromSameWorkflow(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const html = await response.text();

  equal(response.status, 200, 'Policy Foundry hosted view route: request succeeds');
  equal(response.headers.get('cache-control'), 'no-store', 'Policy Foundry hosted view route: response is no-store');
  includes(
    response.headers.get('content-type') ?? '',
    'text/html',
    'Policy Foundry hosted view route: content type is HTML',
  );
  equal(response.headers.get('x-content-type-options'), 'nosniff', 'Policy Foundry hosted view route: nosniff header is set');
  equal(response.headers.get('referrer-policy'), 'no-referrer', 'Policy Foundry hosted view route: referrer policy is no-referrer');
  equal(response.headers.get('x-frame-options'), 'DENY', 'Policy Foundry hosted view route: frame denial header is set');
  includes(
    response.headers.get('content-security-policy') ?? '',
    "frame-ancestors 'none'",
    'Policy Foundry hosted view route: CSP denies framing',
  );
  includes(html, 'Policy Foundry hosted onboarding', 'Policy Foundry hosted view route: HTML identity is visible');
  includes(html, 'Customer action required', 'Policy Foundry hosted view route: review surface headline renders');
  includes(html, 'Adversarial replay', 'Policy Foundry hosted view route: current task renders');
  includes(html, 'adversarial-replay-missing', 'Policy Foundry hosted view route: no-go condition renders');
  includes(html, 'Review material only', 'Policy Foundry hosted view route: review-only boundary renders');
  excludes(html, /raw_prompt_must_not_escape/u, 'Policy Foundry hosted view route: raw OpenAPI descriptions are not emitted');
  excludes(html, /rk_live_must_not_escape/u, 'Policy Foundry hosted view route: secret-like manifest text is not emitted');
  excludes(html, /C:\/Users\/thedi\/private/u, 'Policy Foundry hosted view route: caller source path is not emitted');
  excludes(html, /tenant_foundry_route_a/u, 'Policy Foundry hosted view route: raw tenant id is not emitted');
}

async function testHostedRouteRejectsNonJsonMediaType(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'not-json',
  });
  const body = await response.json() as { readonly reasonCodes: readonly string[] };

  equal(response.status, 415, 'Policy Foundry hosted route: non-JSON media type returns 415');
  ok(
    body.reasonCodes.includes('policy-foundry-hosted-onboarding-json-required'),
    'Policy Foundry hosted route: non-JSON media type reason is stable',
  );
}

async function testHostedRoutePersistsAndResumesWizardState(): Promise<void> {
  const workspace = mkdtempSync(join(tmpdir(), 'attestor-pfwiz-route-'));
  try {
    const storePath = join(workspace, 'wizard-state.json');
    const wizardStateStore = createFileBackedPolicyFoundryHostedWizardStateStore({ path: storePath });
    const app = createApp({ wizardStateStore });
    const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...baseRequestBody(),
        persistWizardState: true,
        wizardSessionId: 'customer-visible-session-ref',
        wizardStateTtlHours: 12,
      }),
    });
    const text = await response.text();
    const body = JSON.parse(text) as {
      readonly storageMode: string;
      readonly wizardState: {
        readonly kind: string;
        readonly session: {
          readonly sessionId: string;
          readonly tenantDigest: string;
          readonly workflowDigest: string;
          readonly reviewSurfaceDigest: string;
          readonly rawPayloadStored: boolean;
          readonly rawReviewSurfaceStored: boolean;
          readonly productionReady: boolean;
          readonly autoEnforce: boolean;
          readonly taskCards: readonly unknown[];
        };
      };
      readonly reviewSurface: {
        readonly digest: string;
        readonly workflowDigest: string;
      };
    };
    const sessionRoute = HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_SESSION_ROUTE
      .replace(':sessionId', body.wizardState.session.sessionId);
    const resume = await app.request(sessionRoute);
    const resumeText = await resume.text();
    const resumed = JSON.parse(resumeText) as {
      readonly tenant: { readonly tenantDigest: string };
      readonly storageMode: string;
      readonly rawPayloadStored: boolean;
      readonly productionReady: boolean;
      readonly wizardState: {
        readonly sessionId: string;
        readonly reviewSurfaceDigest: string;
        readonly rawPayloadStored: boolean;
        readonly productionReady: boolean;
      };
    };
    const foreignTenantResponse = await createApp({
      routeTenant: tenantB,
      wizardStateStore,
    }).request(sessionRoute);
    const fileText = readFileSync(storePath, 'utf8');

    equal(response.status, 200, 'Policy Foundry hosted route: persisted wizard request succeeds');
    equal(body.storageMode, 'file-backed-wizard-state', 'Policy Foundry hosted route: storage mode changes when wizard state persists');
    equal(body.wizardState.kind, 'created', 'Policy Foundry hosted route: wizard state is created');
    ok(body.wizardState.session.sessionId.startsWith('pfwiz_'), 'Policy Foundry hosted route: wizard session id is generated');
    equal(body.wizardState.session.tenantDigest, digest(tenantA.tenantId), 'Policy Foundry hosted route: wizard tenant is digest-only');
    equal(body.wizardState.session.workflowDigest, body.reviewSurface.workflowDigest, 'Policy Foundry hosted route: wizard binds workflow digest');
    equal(body.wizardState.session.reviewSurfaceDigest, body.reviewSurface.digest, 'Policy Foundry hosted route: wizard binds review surface digest');
    equal(body.wizardState.session.rawPayloadStored, false, 'Policy Foundry hosted route: wizard state stores no raw payload');
    equal(body.wizardState.session.rawReviewSurfaceStored, false, 'Policy Foundry hosted route: wizard state stores no raw review surface');
    equal(body.wizardState.session.productionReady, false, 'Policy Foundry hosted route: wizard state is not production-ready');
    equal(body.wizardState.session.autoEnforce, false, 'Policy Foundry hosted route: wizard state does not auto-enforce');
    ok(body.wizardState.session.taskCards.length > 0, 'Policy Foundry hosted route: wizard state stores compact task state');
    equal(resume.status, 200, 'Policy Foundry hosted route: wizard state resume succeeds');
    equal(resume.headers.get('cache-control'), 'no-store', 'Policy Foundry hosted route: resume response is no-store');
    equal(resumed.tenant.tenantDigest, digest(tenantA.tenantId), 'Policy Foundry hosted route: resume response is tenant-bound');
    equal(resumed.storageMode, 'file-backed-evaluation', 'Policy Foundry hosted route: resume exposes evaluation storage mode');
    equal(resumed.rawPayloadStored, false, 'Policy Foundry hosted route: resume stores no raw payload');
    equal(resumed.productionReady, false, 'Policy Foundry hosted route: resume does not claim production readiness');
    equal(resumed.wizardState.sessionId, body.wizardState.session.sessionId, 'Policy Foundry hosted route: resume returns the same session');
    equal(resumed.wizardState.reviewSurfaceDigest, body.reviewSurface.digest, 'Policy Foundry hosted route: resume returns digest-bound state');
    equal(foreignTenantResponse.status, 404, 'Policy Foundry hosted route: foreign tenant cannot resume session');
    excludes(text, /raw_prompt_must_not_escape|rk_live_must_not_escape|C:\/Users\/thedi\/private|customer-visible-session-ref/u, 'Policy Foundry hosted route: persisted response exposes no raw manifest path or caller session ref');
    excludes(resumeText, /raw_prompt_must_not_escape|rk_live_must_not_escape|C:\/Users\/thedi\/private|tenant_foundry_route_a/u, 'Policy Foundry hosted route: resumed state exposes no raw manifest or tenant id');
    excludes(fileText, /raw_prompt_must_not_escape|rk_live_must_not_escape|C:\/Users\/thedi\/private|tenant_foundry_route_a|customer-visible-session-ref/u, 'Policy Foundry hosted route: wizard file stores no raw manifest, tenant id, or caller session ref');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

async function testHostedRouteReplaysPersistedWizardStateWithIdempotencyKey(): Promise<void> {
  const restoreEnv = withPipelineIdempotencyEnv();
  const workspace = mkdtempSync(join(tmpdir(), 'attestor-pfwiz-route-idem-'));
  try {
    const storePath = join(workspace, 'wizard-state.json');
    const wizardStateStore = createFileBackedPolicyFoundryHostedWizardStateStore({ path: storePath });
    const app = createApp({
      wizardStateStore,
      pipelineIdempotencyService: pipelineIdempotencyService(),
    });
    const requestBody = {
      ...baseRequestBody(),
      generatedAt: '2026-05-13T09:01:00.000Z',
      persistWizardState: true,
      wizardSessionId: 'customer-visible-session-ref',
      wizardStateTtlHours: 12,
    };

    const first = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'policy-foundry-wizard-route-1',
      },
      body: JSON.stringify(requestBody),
    });
    const firstBody = await first.json() as {
      readonly wizardState: {
        readonly kind: string;
        readonly session: { readonly sessionId: string };
      };
    };
    const replay = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'policy-foundry-wizard-route-1',
      },
      body: JSON.stringify(requestBody),
    });
    const replayBody = await replay.json() as typeof firstBody;
    const snapshot = wizardStateStore.exportSnapshot();

    equal(first.status, 200, 'Policy Foundry hosted route idempotency: first persisted request succeeds');
    equal(replay.status, 200, 'Policy Foundry hosted route idempotency: replay succeeds');
    equal(
      replay.headers.get('x-attestor-idempotent-replay'),
      'true',
      'Policy Foundry hosted route idempotency: replay header is set',
    );
    equal(
      replay.headers.get('x-attestor-idempotency-key'),
      null,
      'Policy Foundry hosted route idempotency: replay response does not echo the raw idempotency key',
    );
    deepEqual(
      replayBody,
      firstBody,
      'Policy Foundry hosted route idempotency: replay returns the stored response body',
    );
    equal(firstBody.wizardState.kind, 'created', 'Policy Foundry hosted route idempotency: first response created state');
    equal(
      snapshot.records.length,
      1,
      'Policy Foundry hosted route idempotency: replay does not create another wizard-state record',
    );
    equal(
      snapshot.records[0]?.events.length,
      1,
      'Policy Foundry hosted route idempotency: replay does not append another wizard-state event',
    );
  } finally {
    restoreEnv();
    rmSync(workspace, { recursive: true, force: true });
  }
}

async function testHostedRouteRejectsIdempotencyKeyConflicts(): Promise<void> {
  const restoreEnv = withPipelineIdempotencyEnv();
  const workspace = mkdtempSync(join(tmpdir(), 'attestor-pfwiz-route-idem-conflict-'));
  try {
    const storePath = join(workspace, 'wizard-state.json');
    const wizardStateStore = createFileBackedPolicyFoundryHostedWizardStateStore({ path: storePath });
    const app = createApp({
      wizardStateStore,
      pipelineIdempotencyService: pipelineIdempotencyService(),
    });
    const firstBody = {
      ...baseRequestBody(),
      generatedAt: '2026-05-13T09:01:00.000Z',
      persistWizardState: true,
      wizardSessionId: 'customer-visible-session-ref',
    };
    const conflictingBody = {
      ...firstBody,
      requestedCapabilities: ['basic-shadow-summary'],
    };

    const first = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'policy-foundry-wizard-route-conflict',
      },
      body: JSON.stringify(firstBody),
    });
    const conflict = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'policy-foundry-wizard-route-conflict',
      },
      body: JSON.stringify(conflictingBody),
    });
    const conflictText = await conflict.text();
    const conflictBody = JSON.parse(conflictText) as {
      readonly reasonCodes: readonly string[];
    };

    equal(first.status, 200, 'Policy Foundry hosted route idempotency: first conflict fixture request succeeds');
    equal(conflict.status, 409, 'Policy Foundry hosted route idempotency: key reuse with different body returns 409');
    ok(
      conflictBody.reasonCodes.includes('policy-foundry-hosted-onboarding-idempotency-conflict'),
      'Policy Foundry hosted route idempotency: conflict reason is stable',
    );
    excludes(
      conflictText,
      /policy-foundry-wizard-route-conflict/u,
      'Policy Foundry hosted route idempotency: conflict response does not expose the raw idempotency key',
    );
  } finally {
    restoreEnv();
    rmSync(workspace, { recursive: true, force: true });
  }
}

async function testHostedRouteCanAcceptPassingReplayObservations(): Promise<void> {
  const app = createApp();
  const first = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const firstBody = await first.json() as {
    readonly selfOnboardingPacket: {
      readonly redTeamFixtures: {
        readonly cases: readonly RedTeamCase[];
      };
    };
  };
  const observations = passingReplayObservations(firstBody.selfOnboardingPacket.redTeamFixtures.cases);
  const second = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      adversarialReplayObservations: observations,
      reviewedStepIds: ['surface-map', 'adversarial-replay', 'patch-review'],
    }),
  });
  const secondBody = await second.json() as {
    readonly adversarialReplay: {
      readonly status: string;
      readonly observedCaseCount: number;
      readonly missingCaseCount: number;
      readonly productionReady: boolean;
      readonly executesProductionTraffic: boolean;
    };
    readonly workflow: {
      readonly noGoReasons: readonly string[];
      readonly sourceDigests: { readonly adversarialReplayDigest: string | null };
      readonly productionReady: boolean;
    };
    readonly reviewSurface: {
      readonly workflowDigest: string;
      readonly noGoCards: readonly { readonly reason: string }[];
      readonly productionReady: boolean;
    };
  };

  equal(second.status, 200, 'Policy Foundry hosted route: passing replay request succeeds');
  equal(secondBody.adversarialReplay.status, 'passed', 'Policy Foundry hosted route: replay passes');
  equal(secondBody.adversarialReplay.observedCaseCount, observations.length, 'Policy Foundry hosted route: all observations are counted');
  equal(secondBody.adversarialReplay.missingCaseCount, 0, 'Policy Foundry hosted route: no replay cases are missing');
  equal(secondBody.adversarialReplay.productionReady, false, 'Policy Foundry hosted route: replay remains non-production');
  equal(secondBody.adversarialReplay.executesProductionTraffic, false, 'Policy Foundry hosted route: replay does not execute production traffic');
  ok(
    !secondBody.workflow.noGoReasons.includes('adversarial-replay-missing'),
    'Policy Foundry hosted route: replay missing no-go is cleared',
  );
  ok(
    secondBody.workflow.sourceDigests.adversarialReplayDigest?.startsWith('sha256:'),
    'Policy Foundry hosted route: replay digest is bound into workflow',
  );
  equal(secondBody.workflow.productionReady, false, 'Policy Foundry hosted route: passing replay still does not prove production readiness');
  equal(secondBody.reviewSurface.noGoCards.some((card) => card.reason === 'adversarial-replay-missing'), false, 'Policy Foundry hosted route: review surface clears replay-missing no-go');
  equal(secondBody.reviewSurface.productionReady, false, 'Policy Foundry hosted route: review surface still does not prove production readiness');
}

async function testHostedRouteBindsPassingLiveDownstreamReplay(): Promise<void> {
  const app = createApp();
  const first = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const firstBody = await first.json() as {
    readonly selfOnboardingPacket: {
      readonly redTeamFixtures: {
        readonly cases: readonly RedTeamCase[];
      };
    };
  };
  const replayObservations =
    passingReplayObservations(firstBody.selfOnboardingPacket.redTeamFixtures.cases);
  const liveDownstreamReplayObservations =
    passingLiveDownstreamReplayObservations(firstBody.selfOnboardingPacket.redTeamFixtures.cases);
  const second = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      adversarialReplayObservations: replayObservations,
      liveDownstreamReplayObservations,
      reviewedStepIds: ['surface-map', 'adversarial-replay', 'patch-review'],
      customerApprovalRecorded: true,
    }),
  });
  const secondBody = await second.json() as {
    readonly liveDownstreamReplay: {
      readonly status: string;
      readonly liveDownstreamObservationCount: number;
      readonly productionReady: boolean;
      readonly executesProductionTraffic: boolean;
    };
    readonly workflow: {
      readonly sourceDigests: { readonly liveDownstreamReplayDigest: string | null };
      readonly noGoReasons: readonly string[];
      readonly productionReady: boolean;
      readonly executesProductionTraffic: boolean;
    };
    readonly reviewSurface: {
      readonly evidenceCards: readonly { readonly evidenceKind: string }[];
      readonly noGoCards: readonly { readonly reason: string }[];
      readonly productionReady: boolean;
    };
  };

  equal(second.status, 200, 'Policy Foundry hosted route: live downstream replay request succeeds');
  equal(secondBody.liveDownstreamReplay.status, 'passed', 'Policy Foundry hosted route: live downstream replay passes');
  equal(
    secondBody.liveDownstreamReplay.liveDownstreamObservationCount,
    liveDownstreamReplayObservations.length,
    'Policy Foundry hosted route: live downstream replay observations are counted',
  );
  equal(secondBody.liveDownstreamReplay.productionReady, false, 'Policy Foundry hosted route: live downstream replay does not prove production readiness');
  equal(secondBody.liveDownstreamReplay.executesProductionTraffic, false, 'Policy Foundry hosted route: live downstream replay does not execute production traffic');
  ok(
    secondBody.workflow.sourceDigests.liveDownstreamReplayDigest?.startsWith('sha256:'),
    'Policy Foundry hosted route: live downstream replay digest is bound into workflow',
  );
  ok(
    !secondBody.workflow.noGoReasons.includes('live-downstream-replay-failed'),
    'Policy Foundry hosted route: passing live downstream replay has no live no-go',
  );
  equal(secondBody.workflow.productionReady, false, 'Policy Foundry hosted route: workflow still does not prove production readiness');
  equal(secondBody.workflow.executesProductionTraffic, false, 'Policy Foundry hosted route: workflow still does not execute production traffic');
  ok(
    secondBody.reviewSurface.evidenceCards.some((card) => card.evidenceKind === 'liveDownstreamReplayDigest'),
    'Policy Foundry hosted route: review surface exposes live downstream replay evidence digest card',
  );
  equal(secondBody.reviewSurface.noGoCards.some((card) => card.reason === 'live-downstream-replay-failed'), false, 'Policy Foundry hosted route: review surface has no live replay no-go for passing report');
  equal(secondBody.reviewSurface.productionReady, false, 'Policy Foundry hosted route: review surface still does not prove production readiness');
}

async function testHostedRouteBlocksFailedLiveDownstreamReplay(): Promise<void> {
  const app = createApp();
  const first = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseRequestBody()),
  });
  const firstBody = await first.json() as {
    readonly selfOnboardingPacket: {
      readonly redTeamFixtures: {
        readonly cases: readonly RedTeamCase[];
      };
    };
  };
  const liveObservations =
    passingLiveDownstreamReplayObservations(firstBody.selfOnboardingPacket.redTeamFixtures.cases)
      .map((entry, index) =>
        index === 0
          ? { ...entry, productionTrafficAttempted: true }
          : entry
      );
  const second = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      adversarialReplayObservations:
        passingReplayObservations(firstBody.selfOnboardingPacket.redTeamFixtures.cases),
      liveDownstreamReplayObservations: liveObservations,
      customerApprovalRecorded: true,
    }),
  });
  const secondBody = await second.json() as {
    readonly liveDownstreamReplay: {
      readonly status: string;
      readonly noGoReasons: readonly string[];
    };
    readonly workflow: {
      readonly status: string;
      readonly noGoReasons: readonly string[];
      readonly blockedStepIds: readonly string[];
    };
    readonly reviewSurface: {
      readonly noGoCards: readonly { readonly reason: string }[];
    };
  };

  equal(second.status, 200, 'Policy Foundry hosted route: failed live replay request returns review material');
  equal(secondBody.liveDownstreamReplay.status, 'failed', 'Policy Foundry hosted route: failed live downstream replay is explicit');
  ok(
    secondBody.liveDownstreamReplay.noGoReasons.includes('production-traffic-attempted'),
    'Policy Foundry hosted route: live downstream replay records production traffic no-go',
  );
  equal(secondBody.workflow.status, 'blocked', 'Policy Foundry hosted route: failed live downstream replay blocks workflow');
  ok(
    secondBody.workflow.noGoReasons.includes('live-downstream-replay-failed'),
    'Policy Foundry hosted route: workflow records failed live downstream replay no-go',
  );
  ok(
    secondBody.workflow.blockedStepIds.includes('scoped-rollout-review'),
    'Policy Foundry hosted route: failed live downstream replay blocks scoped rollout review',
  );
  ok(
    secondBody.reviewSurface.noGoCards.some((card) => card.reason === 'live-downstream-replay-failed'),
    'Policy Foundry hosted route: review surface exposes failed live replay no-go',
  );
}

async function testHostedRouteKeepsTenantScopedShadowEvents(): Promise<void> {
  const app = createApp({
    routeTenant: tenantB,
    events: [createEvent(tenantA), createEvent(tenantB)],
  });
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ declarations: [] }),
  });
  const body = await response.json() as {
    readonly tenant: { readonly tenantDigest: string };
    readonly selfOnboardingPacket: {
      readonly shadowEventCount: number;
      readonly onboardingPacket: { readonly eventCount: number };
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: tenant B request succeeds');
  equal(body.tenant.tenantDigest, digest(tenantB.tenantId), 'Policy Foundry hosted route: response is tenant B digest');
  equal(body.selfOnboardingPacket.shadowEventCount, 1, 'Policy Foundry hosted route: only tenant B events are included');
  equal(body.selfOnboardingPacket.onboardingPacket.eventCount, 1, 'Policy Foundry hosted route: onboarding packet stays tenant-scoped');
}

async function testHostedRouteRejectsInvalidReplayOutcome(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      adversarialReplayObservations: [
        {
          caseId: 'case_invalid',
          observedOutcome: 'allow-everything',
        },
      ],
    }),
  });
  const body = await response.json() as {
    readonly decision: string;
    readonly failClosed: boolean;
    readonly reasonCodes: readonly string[];
    readonly detail: string;
  };

  equal(response.status, 400, 'Policy Foundry hosted route: invalid replay outcome returns 400');
  equal(body.decision, 'block', 'Policy Foundry hosted route: invalid input returns block problem');
  equal(body.failClosed, true, 'Policy Foundry hosted route: invalid input fails closed');
  ok(
    body.reasonCodes.includes('policy-foundry-hosted-onboarding-render-failed'),
    'Policy Foundry hosted route: invalid input has stable reason code',
  );
  includes(
    body.detail,
    'observedOutcome',
    'Policy Foundry hosted route: invalid input explains rejected field',
  );
}

async function testHostedRouteBlocksUnsafeAutomationRequests(): Promise<void> {
  const app = createApp();
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      autoEnforceRequested: true,
      credentialIssuanceRequested: true,
      infrastructureDeployRequested: true,
      productionTrafficExecutionRequested: true,
      rawPayloadStorageRequested: true,
    }),
  });
  const body = await response.json() as {
    readonly autoEnforce: boolean;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly activatesEnforcement: boolean;
    readonly issuesCredentials: boolean;
    readonly deploysInfrastructure: boolean;
    readonly executesProductionTraffic: boolean;
    readonly workflow: {
      readonly status: string;
      readonly noGoReasons: readonly string[];
    };
    readonly reviewSurface: {
      readonly status: string;
      readonly noGoCards: readonly { readonly reason: string }[];
    };
    readonly commercialBoundary: {
      readonly noGoReasons: readonly string[];
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: unsafe request returns review material');
  equal(body.autoEnforce, false, 'Policy Foundry hosted route: top-level autoEnforce remains false');
  equal(body.rawPayloadStored, false, 'Policy Foundry hosted route: top-level rawPayloadStored remains false');
  equal(body.productionReady, false, 'Policy Foundry hosted route: top-level productionReady remains false');
  equal(body.activatesEnforcement, false, 'Policy Foundry hosted route: activation remains false');
  equal(body.issuesCredentials, false, 'Policy Foundry hosted route: credential issuance remains false');
  equal(body.deploysInfrastructure, false, 'Policy Foundry hosted route: deploy remains false');
  equal(body.executesProductionTraffic, false, 'Policy Foundry hosted route: production execution remains false');
  equal(body.workflow.status, 'blocked', 'Policy Foundry hosted route: unsafe requests block workflow');
  equal(body.reviewSurface.status, 'blocked', 'Policy Foundry hosted route: unsafe requests block review surface');
  for (const reason of [
    'auto-enforce-requested',
    'credential-issuance-requested',
    'infrastructure-deploy-requested',
    'production-traffic-execution-requested',
    'raw-payload-storage-requested',
  ] as const) {
    ok(body.workflow.noGoReasons.includes(reason), `Policy Foundry hosted route: ${reason} is recorded`);
  }
  ok(
    body.commercialBoundary.noGoReasons.includes('shadow-auto-enforce-requested'),
    'Policy Foundry hosted route: commercial boundary also rejects shadow auto-enforce',
  );
  ok(
    body.reviewSurface.noGoCards.some((card) => card.reason === 'auto-enforce-requested'),
    'Policy Foundry hosted route: review surface exposes unsafe automation blocker',
  );
}

async function testHostedRouteUsesBillingProviderPlanForCommercialBoundary(): Promise<void> {
  const app = createApp({
    billingResolverConfigured: true,
    billingEntitlement: entitlement({ effectivePlanId: 'trial' }),
    workflowResolverConfigured: true,
    workflowEntitlement: workflowEntitlement({ tier: 'starter-workflow' }),
  });
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      workflowId: 'wf_foundry_route',
      commercialPlan: 'pro-workflow',
      requestedCapabilities: ['customer-operated-deployment'],
      requestedCustomerOperatedDeployment: true,
    }),
  });
  const body = await response.json() as {
    readonly commercialBoundary: {
      readonly plan: string;
      readonly noGoReasons: readonly string[];
    };
    readonly billingEntitlementEnforcement: {
      readonly enforcementMode: string;
      readonly entitlementPresent: boolean;
      readonly accessEnabled: boolean;
      readonly workflowEntitlementTier: string;
      readonly effectiveBillingPlanId: string;
      readonly commercialPlanForBoundary: string;
      readonly noGoReasons: readonly string[];
      readonly commercialCapabilitiesAllowed: boolean;
      readonly entitlementDecisionAuthority: boolean;
      readonly safetyMinimumsRemainAvailable: boolean;
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: billing-entitled request returns review material');
  equal(body.billingEntitlementEnforcement.enforcementMode, 'billing-provider-enforced', 'Policy Foundry hosted route: billing provider enforcement is active');
  equal(body.billingEntitlementEnforcement.entitlementPresent, true, 'Policy Foundry hosted route: entitlement presence is visible');
  equal(body.billingEntitlementEnforcement.accessEnabled, true, 'Policy Foundry hosted route: active entitlement enables commercial review context');
  equal(body.billingEntitlementEnforcement.workflowEntitlementTier, 'starter-workflow', 'Policy Foundry hosted route: workflow entitlement tier is visible');
  equal(body.billingEntitlementEnforcement.effectiveBillingPlanId, 'starter-workflow', 'Policy Foundry hosted route: effective billing tier comes from workflow entitlement');
  equal(body.billingEntitlementEnforcement.commercialPlanForBoundary, 'starter-workflow', 'Policy Foundry hosted route: boundary tier cannot be elevated by request body');
  ok(
    body.billingEntitlementEnforcement.noGoReasons.includes('requested-plan-not-entitled'),
    'Policy Foundry hosted route: requested plan elevation is blocked',
  );
  ok(
    body.billingEntitlementEnforcement.noGoReasons.includes('customer-operated-not-entitled'),
    'Policy Foundry hosted route: customer-operated request needs negotiated deployment entitlement',
  );
  equal(body.billingEntitlementEnforcement.commercialCapabilitiesAllowed, false, 'Policy Foundry hosted route: unavailable commercial capability is held');
  equal(body.billingEntitlementEnforcement.entitlementDecisionAuthority, false, 'Policy Foundry hosted route: billing is not policy authority');
  equal(body.billingEntitlementEnforcement.safetyMinimumsRemainAvailable, true, 'Policy Foundry hosted route: safety minimums stay available');
  equal(body.commercialBoundary.plan, 'starter-workflow', 'Policy Foundry hosted route: commercial boundary uses workflow billing tier');
  ok(
    body.commercialBoundary.noGoReasons.includes('customer-operated-deployment-not-in-plan'),
    'Policy Foundry hosted route: commercial boundary blocks customer-operated request on starter workflow',
  );
}

async function testHostedRouteFailsClosedWhenBillingProviderStateIsMissing(): Promise<void> {
  const app = createApp({
    billingResolverConfigured: true,
    billingEntitlement: null,
  });
  const response = await app.request(HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...baseRequestBody(),
      requestedCapabilities: ['review-enforce-ladder'],
      requestedProductionWorkflowCount: 1,
      requestedHostedProduction: true,
    }),
  });
  const body = await response.json() as {
    readonly commercialBoundary: {
      readonly plan: string;
      readonly noGoReasons: readonly string[];
    };
    readonly billingEntitlementEnforcement: {
      readonly entitlementPresent: boolean;
      readonly commercialPlanForBoundary: string;
      readonly noGoReasons: readonly string[];
      readonly commercialCapabilitiesAllowed: boolean;
    };
  };

  equal(response.status, 200, 'Policy Foundry hosted route: missing billing state returns review material');
  equal(body.billingEntitlementEnforcement.entitlementPresent, false, 'Policy Foundry hosted route: missing entitlement is explicit');
  equal(body.billingEntitlementEnforcement.commercialPlanForBoundary, 'trial', 'Policy Foundry hosted route: missing entitlement fails closed to trial boundary');
  ok(
    body.billingEntitlementEnforcement.noGoReasons.includes('billing-entitlement-missing'),
    'Policy Foundry hosted route: missing entitlement is a no-go',
  );
  equal(body.billingEntitlementEnforcement.commercialCapabilitiesAllowed, false, 'Policy Foundry hosted route: commercial capability is held without entitlement');
  equal(body.commercialBoundary.plan, 'trial', 'Policy Foundry hosted route: commercial boundary is not elevated without billing provider state');
  ok(
    body.commercialBoundary.noGoReasons.includes('production-enforcement-not-in-plan'),
    'Policy Foundry hosted route: production request is blocked without entitlement',
  );
}

try {
  await testHostedRouteRendersStatelessReviewWorkflow();
  await testHostedRouteRendersHtmlViewFromSameWorkflow();
  await testHostedRouteRejectsNonJsonMediaType();
  await testHostedRoutePersistsAndResumesWizardState();
  await testHostedRouteReplaysPersistedWizardStateWithIdempotencyKey();
  await testHostedRouteRejectsIdempotencyKeyConflicts();
  await testHostedRouteCanAcceptPassingReplayObservations();
  await testHostedRouteBindsPassingLiveDownstreamReplay();
  await testHostedRouteBlocksFailedLiveDownstreamReplay();
  await testHostedRouteKeepsTenantScopedShadowEvents();
  await testHostedRouteRejectsInvalidReplayOutcome();
  await testHostedRouteBlocksUnsafeAutomationRequests();
  await testHostedRouteUsesBillingProviderPlanForCommercialBoundary();
  await testHostedRouteFailsClosedWhenBillingProviderStateIsMissing();
  testDocsAndScriptsExposeHostedWorkflowRoute();
  console.log(`Policy Foundry hosted onboarding workflow route tests: ${passedCount()} passed, 0 failed`);
} catch (error) {
  console.error('Policy Foundry hosted onboarding workflow route tests failed:', error);
  process.exitCode = 1;
}
