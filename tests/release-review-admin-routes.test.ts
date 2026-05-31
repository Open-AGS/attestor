import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  buildFinanceFilingReleaseMaterial,
  buildFinanceFilingReleaseObservation,
  createFinanceFilingReleaseCandidateFromReport,
  finalizeFinanceFilingReleaseDecision,
} from '../src/release-kernel/finance-record-release.js';
import { createReleaseDecisionEngine } from '../src/release-kernel/release-decision-engine.js';
import { createInMemoryReleaseDecisionLogWriter } from '../src/release-kernel/release-decision-log.js';
import {
  applyReviewerDecision,
  createFinanceReviewerQueueItem,
  ReleaseReviewerQueueError,
  type ReleaseReviewerQueueRecord,
} from '../src/release-kernel/reviewer-queue.js';
import { createReleaseTokenIssuer } from '../src/release-kernel/release-token.js';
import { createReleaseEvidencePackIssuer } from '../src/release-kernel/release-evidence-pack.js';
import { generateKeyPair } from '../src/signing/keys.js';
import {
  registerReleaseReviewRoutes,
  type ReleaseReviewRouteDeps,
} from '../src/service/http/routes/release-review-routes.js';
import { resetReleaseAdminRouteAuthLimiterForTests } from '../src/service/http/release-admin-authorization.js';
import { currentAdminAuthorized } from '../src/service/request-context.js';

function adminHeaders(extra?: Record<string, string>, token = 'admin-secret'): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function makeFinanceReport(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'release-review-admin-route',
    decision: 'pending_approval',
    certificate: { certificateId: 'cert_release_review_admin_route' },
    evidenceChain: { terminalHash: 'chain_terminal', intact: true },
    execution: {
      success: true,
      rows: [
        {
          counterparty_name: 'Bank of Nova Scotia',
          exposure_usd: 250000000,
          credit_rating: 'AA-',
          sector: 'Banking',
        },
      ],
    },
    liveProof: {
      mode: 'live_runtime',
      consistent: true,
    },
    receipt: {
      receiptStatus: 'withheld',
    },
    oversight: {
      status: 'pending',
    },
    escrow: {
      state: 'held',
    },
    filingReadiness: {
      status: 'internal_report_ready',
      totalGaps: 0,
      blockingGaps: 0,
    },
    audit: {
      chainIntact: true,
    },
    attestation: {
      manifestHash: 'manifest_hash',
    },
    ...overrides,
  } as any;
}

function createReviewRecord(): ReleaseReviewerQueueRecord {
  const report = makeFinanceReport();
  const candidate = createFinanceFilingReleaseCandidateFromReport(report);
  assert.ok(candidate, 'Release review route fixture: finance report creates a candidate');
  const material = buildFinanceFilingReleaseMaterial(candidate);
  const decisionLog = createInMemoryReleaseDecisionLogWriter();
  const engine = createReleaseDecisionEngine({ decisionLog });
  const evaluation = engine.evaluateWithDeterministicChecks(
    {
      id: 'release-review-admin-route-decision',
      createdAt: new Date().toISOString(),
      outputHash: material.hashBundle.outputHash,
      consequenceHash: material.hashBundle.consequenceHash,
      outputContract: material.outputContract,
      capabilityBoundary: material.capabilityBoundary,
      requester: {
        id: 'tenant:tenant-review-admin-route',
        type: 'service',
        displayName: 'Attestor API',
      },
      target: material.target,
    },
    buildFinanceFilingReleaseObservation(material, report),
  );
  const finalized = finalizeFinanceFilingReleaseDecision(evaluation.decision, report);
  return createFinanceReviewerQueueItem({
    decision: finalized,
    candidate,
    report,
    logEntries: decisionLog.entries(),
  });
}

function createFinalApprovalReadyReviewRecord(): ReleaseReviewerQueueRecord {
  return applyReviewerDecision({
    record: createReviewRecord(),
    outcome: 'approved',
    reviewerId: 'external.reviewer.one',
    reviewerName: 'External Reviewer One',
    reviewerRole: 'policy-admin',
    decidedAt: '2026-05-31T00:00:00.000Z',
  }).record;
}

function createFixture(input: {
  readonly reviewDetail?: unknown;
  readonly reviewRecord?: ReleaseReviewerQueueRecord;
  readonly staleRecordReads?: boolean;
  readonly tokenRegistrations?: string[];
  readonly evidencePackWrites?: string[];
} = {}): Hono {
  resetReleaseAdminRouteAuthLimiterForTests();
  const app = new Hono();
  let reviewRecord = input.reviewRecord ?? null;
  const initialReviewRecord = reviewRecord;
  const decisionLog = createInMemoryReleaseDecisionLogWriter();
  const tokenKeys = generateKeyPair();
  const evidenceKeys = generateKeyPair();
  const tokenIssuer = createReleaseTokenIssuer({
    issuer: 'attestor.release.review-route-test',
    privateKeyPem: tokenKeys.privateKeyPem,
    publicKeyPem: tokenKeys.publicKeyPem,
  });
  const evidenceIssuer = createReleaseEvidencePackIssuer({
    issuer: 'attestor.release.review-route-test',
    privateKeyPem: evidenceKeys.privateKeyPem,
    publicKeyPem: evidenceKeys.publicKeyPem,
  });
  const deps: ReleaseReviewRouteDeps = {
    currentAdminAuthorized,
    apiReleaseReviewerQueueStore: {
      listPending: async () => ({
        generatedAt: '2026-05-21T00:00:00.000Z',
        totalPending: 0,
        countsByRiskClass: {
          R0: 0,
          R1: 0,
          R2: 0,
          R3: 0,
          R4: 0,
        },
        items: [],
      }),
      get: async (id: string) =>
        reviewRecord?.detail.id === id ? reviewRecord.detail : input.reviewDetail ?? null,
      getRecord: async (id: string) => {
        const source = input.staleRecordReads ? initialReviewRecord : reviewRecord;
        return source?.detail.id === id ? source : null;
      },
      upsert: async (record: ReleaseReviewerQueueRecord) => {
        reviewRecord = record;
        return record.detail;
      },
      commitPendingTransition: async ({ record, expectedAuthorityState, expectedReviewerDecisionCount }) => {
        if (
          !reviewRecord ||
          reviewRecord.detail.id !== record.detail.id ||
          reviewRecord.detail.status !== 'pending-review' ||
          reviewRecord.detail.authorityState !== expectedAuthorityState ||
          reviewRecord.detail.reviewerDecisions.length !== expectedReviewerDecisionCount
        ) {
          throw new ReleaseReviewerQueueError(
            'already_finalized',
            `Release review '${record.detail.id}' changed before this transition could be committed.`,
          );
        }
        reviewRecord = record;
        return record.detail;
      },
    } as never,
    renderReleaseReviewerQueueInboxPage: () => '<html><body>empty</body></html>',
    renderReleaseReviewerQueueDetailPage: () => '<html><body>missing</body></html>',
    financeReleaseDecisionLog: decisionLog,
    apiReleaseTokenIssuer: tokenIssuer,
    apiReleaseEvidencePackStore: {
      get: async () => null,
      upsert: async (pack) => {
        input.evidencePackWrites?.push(pack.evidencePack.id);
        return pack;
      },
    } as never,
    apiReleaseEvidencePackIssuer: evidenceIssuer,
    apiReleaseIntrospectionStore: {
      registerIssuedToken: async ({ issuedToken }) => {
        input.tokenRegistrations?.push(issuedToken.tokenId);
      },
    } as never,
    resolveReleaseReviewTokenConfirmation: () => ({ jkt: 'sha256:test-sender-thumbprint' }),
    adminMutationRequest: async () => ({
      idempotencyKey: null,
      requestHash: 'test-release-review-auth',
    }),
    finalizeAdminMutation: async (input) => input.responseBody,
  };

  registerReleaseReviewRoutes(app, deps);
  return app;
}

function assertHtmlSecurityHeaders(response: Response, label: string): void {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${label}: nosniff header is set`);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer', `${label}: referrer policy is set`);
  assert.equal(response.headers.get('x-frame-options'), 'DENY', `${label}: frame denial header is set`);
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /frame-ancestors 'none'/u,
    `${label}: CSP denies framing`,
  );
}

async function requestJson(
  app: Hono,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; headers: Headers; body: any }> {
  const response = await app.request(path, {
    method: options?.method ?? 'GET',
    headers: options?.headers ?? adminHeaders(),
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

async function testReleaseReviewRoleScopedAdminKeys(): Promise<void> {
  const app = createFixture();
  const readList = await requestJson(app, '/api/v1/admin/release-reviews', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });
  const readCannotApprove = await requestJson(app, '/api/v1/admin/release-reviews/review_001/approve', {
    method: 'POST',
    headers: adminHeaders({
      'x-attestor-admin-actor-role': 'admin-release-admin',
    }, 'admin-read-secret'),
    body: {
      reviewerId: 'reviewer_001',
      reviewerName: 'Reviewer One',
      reviewerRole: 'release-manager',
    },
  });
  const releaseAdminReachesApprove = await requestJson(
    app,
    '/api/v1/admin/release-reviews/review_001/approve',
    {
      method: 'POST',
      headers: adminHeaders(undefined, 'admin-release-secret'),
      body: {
        reviewerId: 'reviewer_001',
        reviewerName: 'Reviewer One',
        reviewerRole: 'release-manager',
      },
    },
  );
  const releaseAdminCannotOverride = await requestJson(
    app,
    '/api/v1/admin/release-reviews/review_001/override',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-role': 'policy-break-glass',
      }, 'admin-release-secret'),
      body: {
        reasonCode: 'break-glass-test',
        requestedById: 'release_admin',
        requestedByName: 'Release Admin',
      },
    },
  );
  const breakGlassReachesOverride = await requestJson(
    app,
    '/api/v1/admin/release-reviews/review_001/override',
    {
      method: 'POST',
      headers: adminHeaders({
        'x-attestor-admin-actor-role': 'policy-break-glass',
      }, 'admin-break-glass-secret'),
      body: {
        reasonCode: 'break-glass-test',
        requestedById: 'incident_commander',
        requestedByName: 'Incident Commander',
      },
    },
  );

  assert.equal(readList.status, 200);
  assert.equal(readCannotApprove.status, 403);
  assert.equal(
    readCannotApprove.body.error,
    'Admin actor role does not match the role-scoped admin API key.',
  );
  assert.equal(releaseAdminReachesApprove.status, 404);
  assert.equal(releaseAdminCannotOverride.status, 403);
  assert.equal(
    releaseAdminCannotOverride.body.error,
    "Admin actor role 'admin-release-admin' is not allowed for this route.",
  );
  assert.equal(breakGlassReachesOverride.status, 404);
}

async function testReleaseReviewReviewerIdentityIsCredentialBound(): Promise<void> {
  const record = createReviewRecord();
  const app = createFixture({ reviewRecord: record });
  const firstApproval = await requestJson(app, `/api/v1/admin/release-reviews/${record.detail.id}/approve`, {
    method: 'POST',
    headers: adminHeaders(undefined, 'admin-release-secret'),
    body: {
      reviewerId: 'spoofed.reviewer.alpha',
      reviewerName: 'Spoofed Reviewer Alpha',
      reviewerRole: 'financial_reporting_manager',
      note: 'Body identity must not become reviewer authority.',
    },
  });
  const secondApproval = await requestJson(app, `/api/v1/admin/release-reviews/${record.detail.id}/approve`, {
    method: 'POST',
    headers: adminHeaders(undefined, 'admin-release-secret'),
    body: {
      reviewerId: 'spoofed.reviewer.beta',
      reviewerName: 'Spoofed Reviewer Beta',
      reviewerRole: 'financial_reporting_manager',
    },
  });

  assert.equal(firstApproval.status, 200);
  assert.equal(firstApproval.body.review.reviewerDecisions[0].reviewerId, 'admin-credential:admin-release-admin');
  assert.equal(firstApproval.body.review.reviewerDecisions[0].reviewerName, 'Admin Credential (admin-release-admin)');
  assert.equal(firstApproval.body.review.reviewerDecisions[0].reviewerRole, 'policy-admin');
  assert.equal(secondApproval.status, 409);
  assert.equal(secondApproval.body.code, 'duplicate_reviewer');
}

async function testReleaseReviewOverrideRequesterIsCredentialBound(): Promise<void> {
  const record = createReviewRecord();
  const app = createFixture({ reviewRecord: record });
  const override = await requestJson(app, `/api/v1/admin/release-reviews/${record.detail.id}/override`, {
    method: 'POST',
    headers: adminHeaders(undefined, 'admin-break-glass-secret'),
    body: {
      reasonCode: 'control-plane-recovery',
      ticketId: 'INC-4242',
      requestedById: 'spoofed.incident.commander',
      requestedByName: 'Spoofed Incident Commander',
      requestedByRole: 'incident-commander',
    },
  });

  assert.equal(override.status, 200);
  assert.equal(override.body.review.overrideGrant.requestedById, 'admin-credential:admin-break-glass');
  assert.equal(override.body.review.overrideGrant.requestedByLabel, 'Admin Credential (admin-break-glass)');
  assert.equal(override.body.review.overrideGrant.requestedByRole, 'policy-break-glass');
  assert.equal(override.body.releaseToken.override, true);
}

async function testReleaseReviewFinalApprovalCommitsBeforeTokenEvidenceSideEffects(): Promise<void> {
  const tokenRegistrations: string[] = [];
  const evidencePackWrites: string[] = [];
  const record = createFinalApprovalReadyReviewRecord();
  const app = createFixture({
    reviewRecord: record,
    staleRecordReads: true,
    tokenRegistrations,
    evidencePackWrites,
  });

  const firstApproval = await requestJson(app, `/api/v1/admin/release-reviews/${record.detail.id}/approve`, {
    method: 'POST',
    headers: adminHeaders(undefined, 'admin-release-secret'),
    body: { note: 'First final approval should commit the terminal transition.' },
  });
  const staleSecondApproval = await requestJson(app, `/api/v1/admin/release-reviews/${record.detail.id}/approve`, {
    method: 'POST',
    headers: adminHeaders(undefined, 'admin-release-secret'),
    body: { note: 'Stale final approval must not issue token or evidence.' },
  });

  assert.equal(firstApproval.status, 200);
  assert.ok(firstApproval.body.releaseToken?.tokenId);
  assert.ok(firstApproval.body.evidencePack?.evidencePackId);
  assert.equal(staleSecondApproval.status, 409);
  assert.equal(staleSecondApproval.body.code, 'already_finalized');
  assert.equal(tokenRegistrations.length, 1);
  assert.equal(evidencePackWrites.length, 1);
}

async function testReleaseReviewHtmlRoutesCarrySecurityHeaders(): Promise<void> {
  const app = createFixture({ reviewDetail: { id: 'review_001' } });
  const inbox = await app.request('/api/v1/admin/release-reviews/inbox', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });
  const detail = await app.request('/api/v1/admin/release-reviews/review_001/view', {
    headers: adminHeaders(undefined, 'admin-read-secret'),
  });

  assert.equal(inbox.status, 200);
  assert.equal(detail.status, 200);
  assertHtmlSecurityHeaders(inbox, 'Release review inbox HTML');
  assertHtmlSecurityHeaders(detail, 'Release review detail HTML');
}

async function run(): Promise<void> {
  const originalAdminApiKey = process.env.ATTESTOR_ADMIN_API_KEY;
  const originalAdminReadApiKey = process.env.ATTESTOR_ADMIN_READ_API_KEY;
  const originalAdminReleaseApiKey = process.env.ATTESTOR_ADMIN_RELEASE_API_KEY;
  const originalAdminBreakGlassApiKey = process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY;
  const originalAdminRateLimit = process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE;
  process.env.ATTESTOR_ADMIN_API_KEY = 'admin-secret';
  process.env.ATTESTOR_ADMIN_READ_API_KEY = 'admin-read-secret';
  process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = 'admin-release-secret';
  process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = 'admin-break-glass-secret';
  process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE = '10000';

  try {
    await testReleaseReviewRoleScopedAdminKeys();
    await testReleaseReviewReviewerIdentityIsCredentialBound();
    await testReleaseReviewOverrideRequesterIsCredentialBound();
    await testReleaseReviewFinalApprovalCommitsBeforeTokenEvidenceSideEffects();
    await testReleaseReviewHtmlRoutesCarrySecurityHeaders();
    console.log('Release review admin-route tests: 5 passed, 0 failed');
  } finally {
    process.env.ATTESTOR_ADMIN_API_KEY = originalAdminApiKey;
    process.env.ATTESTOR_ADMIN_READ_API_KEY = originalAdminReadApiKey;
    process.env.ATTESTOR_ADMIN_RELEASE_API_KEY = originalAdminReleaseApiKey;
    process.env.ATTESTOR_ADMIN_BREAK_GLASS_API_KEY = originalAdminBreakGlassApiKey;
    process.env.ATTESTOR_ADMIN_AUTH_RATE_LIMIT_PER_MINUTE = originalAdminRateLimit;
  }
}

await run();
