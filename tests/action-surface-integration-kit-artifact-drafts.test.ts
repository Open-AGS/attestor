import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationKitArtifactDraftDescriptor,
  createActionSurfaceIntegrationKitArtifactDraftBundle,
  createActionSurfaceIntegrationKitPacket,
  createActionSurfaceOnboardingPacket,
} from '../src/consequence-admission/index.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function createRefundOpenApi(): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: 'Refund API',
      version: '1.0.0',
    },
    paths: {
      '/refunds': {
        post: {
          operationId: 'issueRefund',
          description: 'raw_prompt_must_not_escape sk_live_must_not_escape',
          tags: ['refunds'],
          responses: {
            '200': {
              description: 'ok',
            },
          },
        },
      },
    },
  });
}

function createKit() {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-05-31T10:00:00.000Z',
    attestorBaseUrl: 'https://attestor.example.com',
    manifests: [
      {
        text: createRefundOpenApi(),
        sourceRef: 'openapi/refunds.json',
        downstreamSystem: 'refund-service',
        defaultDomain: 'money-movement',
        credentialPosture: 'agent-held-static-secret',
      },
    ],
  });
  return createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt: '2026-05-31T10:01:00.000Z',
  });
}

function testOpenApiOverlayDraftIsDigestBoundAndReviewOnly(): void {
  const kit = createKit();
  const bundle = createActionSurfaceIntegrationKitArtifactDraftBundle({
    kit,
    generatedAt: '2026-05-31T10:02:00.000Z',
    targetOpenApiRef: './refunds.openapi.json',
  });
  const action = bundle.openApiOverlay.actions[0];
  const extension = action?.update['x-attestor'] as {
    readonly sourceKitDigest: string;
    readonly sourcePacketDigest: string;
    readonly reviewRequired: boolean;
    readonly customerStopPointRequired: boolean;
    readonly routePlacementReviewed: boolean;
    readonly credentialBoundaryReviewRequired: boolean;
    readonly executionProofRequired: boolean;
    readonly requiredEvidence: readonly string[];
    readonly authority: string;
    readonly rawPayloadStored: boolean;
    readonly productionReady: boolean;
    readonly nonBypassableClaimAllowed: boolean;
  };
  const text = JSON.stringify(bundle);

  equal(bundle.version, 'attestor.action-surface-integration-kit-artifact-drafts.v1', 'Artifact drafts: version is explicit');
  equal(bundle.sourceKitDigest, kit.digest, 'Artifact drafts: source kit digest is retained');
  equal(bundle.routeCount, 1, 'Artifact drafts: one HTTP route is discovered');
  equal(bundle.openApiOverlay.overlay, '1.1.0', 'Artifact drafts: OpenAPI Overlay version is explicit');
  equal(bundle.openApiOverlay.extends, './refunds.openapi.json', 'Artifact drafts: OpenAPI target ref is retained');
  equal(action?.target, "$.paths['/refunds'].post", 'Artifact drafts: overlay target uses JSONPath path/method');
  equal(extension.sourceKitDigest, kit.digest, 'Artifact drafts: overlay extension binds kit digest');
  equal(extension.sourcePacketDigest, kit.sourcePacketDigest, 'Artifact drafts: overlay extension binds source packet digest');
  equal(extension.reviewRequired, true, 'Artifact drafts: overlay extension requires review');
  equal(
    extension.customerStopPointRequired,
    true,
    'Artifact drafts: overlay extension requires customer stop point',
  );
  equal(
    extension.routePlacementReviewed,
    false,
    'Artifact drafts: overlay extension route placement is not reviewed',
  );
  equal(
    extension.credentialBoundaryReviewRequired,
    true,
    'Artifact drafts: overlay extension requires credential boundary review',
  );
  equal(
    extension.executionProofRequired,
    true,
    'Artifact drafts: overlay extension requires execution proof',
  );
  ok(
    extension.requiredEvidence.includes('customer-stop-point-decision-digest'),
    'Artifact drafts: overlay extension names stop-point evidence',
  );
  equal(
    extension.authority,
    'review-metadata-only',
    'Artifact drafts: overlay extension authority is metadata-only',
  );
  equal(extension.rawPayloadStored, false, 'Artifact drafts: overlay extension stores no raw payload');
  equal(extension.productionReady, false, 'Artifact drafts: overlay extension is not production-ready');
  equal(extension.nonBypassableClaimAllowed, false, 'Artifact drafts: overlay extension blocks no-bypass claim');
  equal(bundle.openApiOverlay.requiredReview, true, 'Artifact drafts: overlay requires review');
  equal(bundle.openApiOverlay.rawPayloadStored, false, 'Artifact drafts: overlay stores no raw payload');
  equal(bundle.openApiOverlay.productionReady, false, 'Artifact drafts: overlay is not production-ready');
  equal(bundle.openApiOverlay.nonBypassableClaimAllowed, false, 'Artifact drafts: overlay does not allow no-bypass claim');
  ok(bundle.openApiOverlay.digest.startsWith('sha256:'), 'Artifact drafts: overlay digest is generated');
  ok(!text.includes('raw_prompt_must_not_escape'), 'Artifact drafts: raw OpenAPI description is not serialized');
  ok(!text.includes('sk_live_must_not_escape'), 'Artifact drafts: secret-like text is not serialized');
}

function testEnvoyExtAuthzDraftStaysNonApplying(): void {
  const bundle = createActionSurfaceIntegrationKitArtifactDraftBundle({
    kit: createKit(),
  });
  const route = bundle.envoyExtAuthz.routeHints[0];
  const filterText = JSON.stringify(bundle.envoyExtAuthz.filter);

  equal(bundle.envoyExtAuthz.kind, 'envoy-ext-authz-http-filter-draft', 'Artifact drafts: Envoy draft kind is explicit');
  equal(bundle.envoyExtAuthz.failureModeAllow, false, 'Artifact drafts: Envoy draft is fail-closed by default');
  equal(route?.method, 'POST', 'Artifact drafts: route method is retained');
  equal(route?.path, '/refunds', 'Artifact drafts: route path is retained');
  equal(route?.reviewRequired, true, 'Artifact drafts: route hint requires review');
  equal(route?.domain, 'money-movement', 'Artifact drafts: route hint keeps domain');
  equal(route?.downstreamSystem, 'refund_service', 'Artifact drafts: route hint keeps downstream system');
  equal(
    route?.customerStopPointRequired,
    true,
    'Artifact drafts: route hint requires customer stop point',
  );
  equal(
    route?.routePlacementReviewed,
    false,
    'Artifact drafts: route hint is not placement-reviewed',
  );
  equal(
    route?.credentialBoundaryReviewRequired,
    true,
    'Artifact drafts: route hint requires credential boundary review',
  );
  equal(
    route?.executionProofRequired,
    true,
    'Artifact drafts: route hint requires execution proof',
  );
  ok(
    route?.requiredEvidence.includes('operator-review-record-digest'),
    'Artifact drafts: route hint names operator review evidence',
  );
  equal(
    route?.authority,
    'route-review-hint-only',
    'Artifact drafts: route hint has no independent authority',
  );
  includes(filterText, 'envoy.filters.http.ext_authz', 'Artifact drafts: Envoy filter name is present');
  includes(filterText, 'failureModeAllow', 'Artifact drafts: Envoy failure mode field is present');
  equal(
    bundle.envoyExtAuthz.reviewPlan.customerOwnedStopPointRequired,
    true,
    'Artifact drafts: Envoy review plan requires customer-owned stop point',
  );
  equal(
    bundle.envoyExtAuthz.reviewPlan.routePlacementReviewed,
    false,
    'Artifact drafts: Envoy review plan is not placement-reviewed',
  );
  equal(
    bundle.envoyExtAuthz.reviewPlan.rawRequestBodyAllowed,
    false,
    'Artifact drafts: Envoy review plan blocks raw request body forwarding',
  );
  includes(
    JSON.stringify(bundle.envoyExtAuthz.reviewPlan),
    'confirm route coverage',
    'Artifact drafts: Envoy review plan gives reviewer action',
  );
  equal(bundle.approvalRequired, true, 'Artifact drafts: approval is required');
  equal(bundle.autoEnforce, false, 'Artifact drafts: auto enforce is false');
  equal(bundle.rawPayloadStored, false, 'Artifact drafts: raw payload storage is false');
  equal(bundle.productionReady, false, 'Artifact drafts: production readiness is false');
  equal(bundle.deploysInfrastructure, false, 'Artifact drafts: deployment is false');
  equal(bundle.issuesCredentials, false, 'Artifact drafts: credential issuance is false');
  equal(bundle.activatesEnforcement, false, 'Artifact drafts: enforcement activation is false');
  equal(bundle.nonBypassableClaimAllowed, false, 'Artifact drafts: no-bypass claim is false');
  ok(bundle.digest.startsWith('sha256:'), 'Artifact drafts: bundle digest is generated');
}

function testDescriptorDocsAndPackageScript(): void {
  const descriptor = actionSurfaceIntegrationKitArtifactDraftDescriptor();
  equal(descriptor.overlayVersion, '1.1.0', 'Artifact drafts descriptor: overlay version is explicit');
  equal(descriptor.gatewayDraftKind, 'envoy-ext-authz-http-filter-draft', 'Artifact drafts descriptor: gateway draft kind is explicit');
  equal(descriptor.deploysInfrastructure, false, 'Artifact drafts descriptor: deployment is false');
  equal(descriptor.activatesEnforcement, false, 'Artifact drafts descriptor: enforcement activation is false');

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');
  includes(doc, 'OpenAPI And Gateway Drafts', 'Integration kit doc: artifact draft section exists');
  includes(doc, 'action-surface-integration-kit-artifact-drafts.ts', 'Integration kit doc: artifact draft source is named');
  includes(doc, 'test:action-surface-integration-kit-artifact-drafts', 'Integration kit doc: artifact draft script is named');
  excludes(doc, /artifact drafts deploy gateways/iu, 'Integration kit doc: gateway deployment is not overclaimed');

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-kit-artifact-drafts'],
    'tsx tests/action-surface-integration-kit-artifact-drafts.test.ts',
    'package.json exposes artifact draft test',
  );
}

try {
  testOpenApiOverlayDraftIsDigestBoundAndReviewOnly();
  testEnvoyExtAuthzDraftStaysNonApplying();
  testDescriptorDocsAndPackageScript();
  console.log(`Action surface integration kit artifact draft tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit artifact draft tests failed:', error);
  process.exitCode = 1;
}
