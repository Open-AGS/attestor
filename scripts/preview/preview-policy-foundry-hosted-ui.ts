import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import {
  createPolicyFoundryAdversarialReplayExecutor,
  createPolicyFoundryCommercialBoundary,
  createPolicyFoundryHostedOnboardingWorkflow,
  createPolicyFoundryHostedReviewSurface,
  createPolicyFoundrySelfOnboardingCliPacket,
  type ActionSurfaceOnboardingRedTeamFixtureBundle,
  type PolicyFoundryAdversarialReplayObservation,
} from '../../src/consequence-admission/index.js';
import { renderPolicyFoundryHostedUiFlow } from '../../src/service/policy-foundry-hosted-ui.js';

type PreviewState = 'blocked' | 'ready';

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function previewManifest(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'Refund API Preview',
      version: '1.0.0',
    },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'Preview-only refund workflow used for browser QA.',
          responses: {
            '200': { description: 'ok' },
          },
        },
      },
    },
  });
}

function passingObservations(
  bundle: ActionSurfaceOnboardingRedTeamFixtureBundle,
): readonly PolicyFoundryAdversarialReplayObservation[] {
  return bundle.cases.map((entry) => ({
    caseId: entry.caseId,
    observedOutcome: entry.expectedOutcome,
    observedAt: '2026-05-13T13:00:00.000Z',
    executionMode: 'synthetic-local',
    evidenceDigest: digest(`preview:${entry.caseId}`),
    reasonCodes: [`fixture:${entry.kind}`, 'preview:browser-qa'],
    rawPayloadStored: false,
    downstreamMutationAttempted: false,
    credentialMaterialUsed: false,
  }));
}

function normalizePreviewState(value: string | null | undefined): PreviewState {
  return value === 'ready' ? 'ready' : 'blocked';
}

export function createPolicyFoundryHostedUiPreviewHtml(
  state: PreviewState = 'blocked',
): string {
  const packet = createPolicyFoundrySelfOnboardingCliPacket({
    generatedAt: '2026-05-13T13:00:00.000Z',
    tenantId: 'tenant_policy_foundry_preview',
    manifests: [
      {
        text: previewManifest(),
        sourceRef: 'preview/refund.openapi.json',
        manifestKind: 'openapi',
        defaultDomain: 'money-movement',
        downstreamSystem: 'refund-service',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  const adversarialReplay = state === 'ready'
    ? createPolicyFoundryAdversarialReplayExecutor({
      generatedAt: '2026-05-13T13:01:00.000Z',
      fixtureBundle: packet.redTeamFixtures,
      observations: passingObservations(packet.redTeamFixtures),
    })
    : null;
  const workflow = createPolicyFoundryHostedOnboardingWorkflow({
    generatedAt: '2026-05-13T13:02:00.000Z',
    selfOnboardingPacket: packet,
    adversarialReplay,
    commercialBoundary: createPolicyFoundryCommercialBoundary({
      generatedAt: '2026-05-13T13:02:00.000Z',
      plan: 'starter',
      requestedCapabilities: ['basic-shadow-summary', 'active-questions'],
    }),
    reviewedStepIds: state === 'ready'
      ? ['surface-map', 'active-questions', 'coverage-review', 'gate-plan', 'adversarial-replay', 'patch-review']
      : ['surface-map'],
    customerApprovalRecorded: state === 'ready',
  });

  return renderPolicyFoundryHostedUiFlow(createPolicyFoundryHostedReviewSurface({
    generatedAt: '2026-05-13T13:03:00.000Z',
    workflow,
  }));
}

export function createPolicyFoundryHostedUiPreviewApp(): Hono {
  const app = new Hono();
  app.get('/', (c) => c.redirect('/policy-foundry/hosted-ui-preview'));
  app.get('/policy-foundry/hosted-ui-preview', (c) => {
    c.header('cache-control', 'no-store');
    return c.html(createPolicyFoundryHostedUiPreviewHtml(
      normalizePreviewState(c.req.query('state')),
    ));
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT ?? '3717', 10);
  serve({
    fetch: createPolicyFoundryHostedUiPreviewApp().fetch,
    port,
  });
  console.log(`[attestor] Policy Foundry hosted UI preview: http://127.0.0.1:${port}/policy-foundry/hosted-ui-preview`);
}
