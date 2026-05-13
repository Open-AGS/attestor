import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE,
  HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE,
} from '../src/service/http/routes/policy-foundry-hosted-onboarding-routes.js';
import { trimAndStripTrailingSlashes } from '../src/platform/string-normalization.js';
import {
  digestReference,
  safeErrorMessage,
  stringifySecretSafe,
} from './secret-safe-output.ts';

type FetchLike = typeof fetch;

type RedTeamCase = {
  readonly caseId: string;
  readonly kind: string;
  readonly expectedOutcome: string;
};

type JsonResult = {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
  readonly body: any;
};

export interface PolicyFoundryProductionSmokeProbeResult {
  readonly baseUrlRef: string | null;
  readonly healthStatus: number;
  readonly readinessStatus: number;
  readonly initialWorkflowDigest: string;
  readonly liveReplayDigest: string;
  readonly failedReplayBlocked: boolean;
  readonly reviewSurfaceEvidenceBound: boolean;
  readonly hostedViewRendered: boolean;
  readonly productionReadyClaimed: false;
  readonly executesProductionTraffic: false;
}

export interface PolicyFoundryProductionSmokeProbeOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
}

const SENSITIVE_MARKERS = [
  'raw_prompt_must_not_escape',
  'rk_live_must_not_escape',
  'private/refunds.openapi.json',
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeBaseUrl(value: string): string {
  const normalized = trimAndStripTrailingSlashes(value);
  if (!/^https?:\/\//iu.test(normalized)) {
    throw new Error('ATTESTOR_BASE_URL must be an http or https URL.');
  }
  return normalized;
}

function routeUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function assertNoSensitiveMarkers(text: string, label: string): void {
  for (const marker of SENSITIVE_MARKERS) {
    assert.equal(
      text.includes(marker),
      false,
      `${label} must not emit raw manifest, secret marker, or caller path material.`,
    );
  }
}

async function fetchText(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  label: string,
): Promise<JsonResult> {
  const res = await fetchImpl(url, init);
  const text = await res.text();
  assertNoSensitiveMarkers(text, label);
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return Object.freeze({
    status: res.status,
    headers: res.headers,
    text,
    body,
  });
}

function expectStatus(result: JsonResult, expected: number, label: string): void {
  if (result.status !== expected) {
    throw new Error(`${label} returned HTTP ${result.status}; expected ${expected}.`);
  }
}

function openApiManifest(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Refund API', version: '1.0.0' },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape rk_live_must_not_escape',
          responses: { '200': { description: 'ok' } },
        },
      },
    },
  });
}

function baseHostedBody() {
  return {
    includeShadowEvents: false,
    manifests: [
      {
        text: openApiManifest(),
        sourceRef: 'C:/Users/thedi/private/refunds.openapi.json',
        manifestKind: 'openapi',
      },
    ],
    defaultDomain: 'money-movement',
    downstreamSystem: 'refund-service',
    credentialPosture: 'agent-held-static-secret',
    requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
  };
}

function casesFrom(body: any): readonly RedTeamCase[] {
  const cases = body?.selfOnboardingPacket?.redTeamFixtures?.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('Policy Foundry production smoke probe did not receive red-team fixture cases.');
  }
  return cases.map((entry) => ({
    caseId: String(entry.caseId),
    kind: String(entry.kind),
    expectedOutcome: String(entry.expectedOutcome),
  }));
}

function localReplayObservations(cases: readonly RedTeamCase[]) {
  return cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: entry.expectedOutcome,
    observedAt: '2026-05-13T12:00:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(`local:${entry.caseId}`),
    reasonCodes: [`fixture:${entry.kind}`],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
}

function liveReplayObservations(cases: readonly RedTeamCase[], failFirst = false) {
  return cases.map((entry, index) => ({
    caseId: entry.caseId,
    observedOutcome: entry.expectedOutcome,
    observedAt: '2026-05-13T12:00:30.000Z',
    executionMode: 'gateway-proxy-sandbox',
    environment: 'sandbox',
    evidenceDigest: digest(`live:${entry.caseId}`),
    dryRunProofDigest: digest(`dry-run:${entry.caseId}`),
    downstreamReceiptDigest: digest(`receipt:${entry.caseId}`),
    reasonCodes: [`fixture:${entry.kind}`, 'dry-run:confirmed'],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
    productionTrafficAttempted: failFirst && index === 0,
    dryRunConfirmed: true,
    sandboxBoundaryVerified: true,
    unapprovedNetworkEgress: false,
  }));
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
}

export async function runPolicyFoundryProductionSmokeProbe(
  options: PolicyFoundryProductionSmokeProbeOptions,
): Promise<PolicyFoundryProductionSmokeProbeResult> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = authHeaders(options.apiKey);

  const health = await fetchText(fetchImpl, routeUrl(baseUrl, '/api/v1/health'), {}, 'health');
  expectStatus(health, 200, 'GET /api/v1/health');

  const ready = await fetchText(fetchImpl, routeUrl(baseUrl, '/api/v1/ready'), {}, 'ready');
  expectStatus(ready, 200, 'GET /api/v1/ready');

  const initial = await fetchText(
    fetchImpl,
    routeUrl(baseUrl, HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE),
    {
      method: 'POST',
      headers,
      body: JSON.stringify(baseHostedBody()),
    },
    'hosted workflow initial',
  );
  expectStatus(initial, 200, 'POST hosted onboarding workflow');
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assert.equal(initial.body.productionReady, false);
  assert.equal(initial.body.rawPayloadStored, false);
  assert.equal(initial.body.executesProductionTraffic, false);
  assert.equal(initial.body.adversarialReplay, null);
  assert.equal(initial.body.liveDownstreamReplay, null);

  const cases = casesFrom(initial.body);
  const passing = await fetchText(
    fetchImpl,
    routeUrl(baseUrl, HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...baseHostedBody(),
        adversarialReplayObservations: localReplayObservations(cases),
        liveDownstreamReplayObservations: liveReplayObservations(cases),
        reviewedStepIds: ['surface-map', 'adversarial-replay', 'patch-review'],
        customerApprovalRecorded: true,
      }),
    },
    'hosted workflow passing live replay',
  );
  expectStatus(passing, 200, 'POST hosted onboarding workflow with live replay');
  assert.equal(passing.body.liveDownstreamReplay?.status, 'passed');
  assert.match(passing.body.workflow?.sourceDigests?.liveDownstreamReplayDigest ?? '', /^sha256:[a-f0-9]{64}$/iu);
  assert.equal(passing.body.workflow?.productionReady, false);
  assert.equal(passing.body.workflow?.executesProductionTraffic, false);
  assert.equal(
    passing.body.reviewSurface?.evidenceCards?.some(
      (card: { readonly evidenceKind?: string }) => card.evidenceKind === 'liveDownstreamReplayDigest',
    ),
    true,
  );

  const failed = await fetchText(
    fetchImpl,
    routeUrl(baseUrl, HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_ROUTE),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...baseHostedBody(),
        adversarialReplayObservations: localReplayObservations(cases),
        liveDownstreamReplayObservations: liveReplayObservations(cases, true),
        customerApprovalRecorded: true,
      }),
    },
    'hosted workflow failed live replay',
  );
  expectStatus(failed, 200, 'POST hosted onboarding workflow with failed live replay');
  assert.equal(failed.body.liveDownstreamReplay?.status, 'failed');
  assert.equal(
    failed.body.workflow?.noGoReasons?.includes('live-downstream-replay-failed'),
    true,
  );
  assert.equal(
    failed.body.workflow?.blockedStepIds?.includes('scoped-rollout-review'),
    true,
  );

  const view = await fetchText(
    fetchImpl,
    routeUrl(baseUrl, HOSTED_POLICY_FOUNDRY_ONBOARDING_WORKFLOW_VIEW_ROUTE),
    {
      method: 'POST',
      headers,
      body: JSON.stringify(baseHostedBody()),
    },
    'hosted workflow view',
  );
  expectStatus(view, 200, 'POST hosted onboarding workflow view');
  assert.match(view.headers.get('content-type') ?? '', /text\/html/iu);
  assert.equal(typeof view.body === 'string' && view.body.includes('Policy Foundry hosted onboarding'), true);

  return Object.freeze({
    baseUrlRef: digestReference('base-url', baseUrl),
    healthStatus: health.status,
    readinessStatus: ready.status,
    initialWorkflowDigest: initial.body.workflow.digest,
    liveReplayDigest: passing.body.liveDownstreamReplay.digest,
    failedReplayBlocked: failed.body.workflow.noGoReasons.includes('live-downstream-replay-failed'),
    reviewSurfaceEvidenceBound: passing.body.reviewSurface.evidenceCards.some(
      (card: { readonly evidenceKind?: string }) => card.evidenceKind === 'liveDownstreamReplayDigest',
    ),
    hostedViewRendered: true,
    productionReadyClaimed: false,
    executesProductionTraffic: false,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPolicyFoundryProductionSmokeProbe({
    baseUrl: requiredEnv('ATTESTOR_BASE_URL'),
    apiKey: requiredEnv('ATTESTOR_API_KEY'),
  })
    .then((result) => {
      console.log(stringifySecretSafe(result));
    })
    .catch((error) => {
      console.error(safeErrorMessage(error));
      process.exitCode = 1;
    });
}
