import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  actionSurfaceIntegrationKitLiveProofPrepBundleDescriptor,
  createActionSurfaceIntegrationKitLiveProofPrepBundle,
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

function createMultiModeKit() {
  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt: '2026-06-02T09:00:00.000Z',
    declarations: [
      {
        sourceKind: 'openapi',
        actionSurface: 'payments.issue_refund',
        domain: 'money-movement',
        downstreamSystem: 'refund-service',
        action: 'issue_refund',
        method: 'POST',
        path: '/refunds',
        credentialPosture: 'gateway-held-secret',
        integrationModeHint: 'gateway-proxy',
      },
      {
        sourceKind: 'mcp-tools',
        actionSurface: 'warehouse.export_customer_data',
        domain: 'data-disclosure',
        downstreamSystem: 'warehouse-mcp',
        action: 'export_customer_data',
        toolName: 'export_customer_data',
        credentialPosture: 'gateway-held-secret',
        integrationModeHint: 'mcp-tool-gateway',
      },
      {
        sourceKind: 'manual',
        actionSurface: 'support.summarize_case',
        domain: 'custom',
        downstreamSystem: 'support-console',
        action: 'summarize_case',
        operationRef: 'POST /cases/{id}/summary',
        credentialPosture: 'none',
        integrationModeHint: 'shadow-capture-sdk',
      },
    ],
  });
  return createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt: '2026-06-02T09:01:00.000Z',
  });
}

function testBundlePreparesLiveProofWithoutClosingIt(): void {
  const kit = createMultiModeKit();
  const bundle = createActionSurfaceIntegrationKitLiveProofPrepBundle({
    kit,
    generatedAt: '2026-06-02T09:02:00.000Z',
  });
  const text = JSON.stringify(bundle);

  equal(
    bundle.version,
    'attestor.action-surface-integration-kit-live-proof-prep.v1',
    'Live proof prep: version is explicit',
  );
  equal(bundle.sourceKitDigest, kit.digest, 'Live proof prep: source kit digest is retained');
  equal(
    bundle.sourcePacketDigest,
    kit.sourcePacketDigest,
    'Live proof prep: source packet digest is retained',
  );
  equal(
    bundle.sourceProbePlanDigest,
    kit.noBypassProbePlan.digest,
    'Live proof prep: source probe plan digest is retained',
  );
  ok(
    bundle.sourceProbeBundleDigest.startsWith('sha256:'),
    'Live proof prep: source probe bundle digest is retained',
  );
  ok(
    bundle.sourceCustomerGateWiringPacketDigest.startsWith('sha256:'),
    'Live proof prep: customer gate wiring packet digest is retained',
  );
  equal(bundle.status, 'review-required', 'Live proof prep: review is required');
  equal(bundle.surfaceCount, 3, 'Live proof prep: all surfaces are represented');
  equal(bundle.liveProofCandidateCount, 2, 'Live proof prep: observe-only surface is not a candidate');
  equal(bundle.probeCaseCount, 18, 'Live proof prep: probe cases are counted');
  equal(
    bundle.liveProofRegisterRef,
    'LP-CUSTOMER-PEP-NO-BYPASS',
    'Live proof prep: names live proof register target',
  );
  equal(
    bundle.liveProofGateEnv,
    'ATTESTOR_CUSTOMER_PEP_NO_BYPASS_PROOF',
    'Live proof prep: names live proof gate env flag',
  );
  ok(
    bundle.captureRecordFields.includes('no-raw-data-confirmation'),
    'Live proof prep: live proof capture requires no-raw-data confirmation',
  );
  equal(bundle.executesLiveProof, false, 'Live proof prep: does not execute proof');
  equal(bundle.recordsLiveProof, false, 'Live proof prep: does not record proof');
  equal(
    bundle.generatedBundleMayCloseLiveProof,
    false,
    'Live proof prep: generated bundle cannot close live proof',
  );
  equal(bundle.autoEnforce, false, 'Live proof prep: auto enforce is false');
  equal(bundle.deploysInfrastructure, false, 'Live proof prep: deployment is false');
  equal(bundle.issuesCredentials, false, 'Live proof prep: credential issuance is false');
  equal(bundle.activatesEnforcement, false, 'Live proof prep: activation is false');
  equal(bundle.productionReady, false, 'Live proof prep: production readiness is false');
  equal(
    bundle.nonBypassableClaimAllowed,
    false,
    'Live proof prep: no-bypass claim is false',
  );
  ok(bundle.digest.startsWith('sha256:'), 'Live proof prep: digest is generated');
  ok(!text.includes('sk_live_must_not_escape'), 'Live proof prep: secret-like text is not serialized');
}

function testPrepItemsCarryCandidateAndObserveBoundaries(): void {
  const bundle = createActionSurfaceIntegrationKitLiveProofPrepBundle({
    kit: createMultiModeKit(),
  });

  const gatewayItem = bundle.prepItems.find((item) =>
    item.actionSurface === 'payments.issue_refund'
  );
  equal(
    gatewayItem?.targetBoundary,
    'customer-gateway-or-sidecar-pep',
    'Live proof prep: gateway item targets customer gateway boundary',
  );
  equal(
    gatewayItem?.liveProofCaptureCandidate,
    true,
    'Live proof prep: gateway item is a live proof candidate',
  );
  ok(
    gatewayItem?.routeOrToolRefs.includes('POST /refunds'),
    'Live proof prep: route ref is retained',
  );
  ok(
    gatewayItem?.requiredWiringEvidenceFields.includes('no-bypass-probe-result'),
    'Live proof prep: wiring evidence requires no-bypass probe result',
  );
  ok(
    gatewayItem?.requiredProbeEvidenceFields.includes('customer-stop-point-decision-digest'),
    'Live proof prep: probe evidence requires customer stop-point digest',
  );
  ok(
    gatewayItem?.requiredRuntimeEvidenceKinds.includes('gateway-config'),
    'Live proof prep: runtime adoption evidence is retained',
  );
  ok(
    gatewayItem?.sourceProbeIds.some((probeId) =>
      probeId.includes('direct-downstream-without-attestor-presentation')
    ),
    'Live proof prep: direct bypass probe id is retained',
  );
  includes(
    gatewayItem?.proofCaptureSteps.join('\n') ?? '',
    'direct downstream call without an Attestor presentation',
    'Live proof prep: direct bypass evidence step is human-readable',
  );
  equal(gatewayItem?.safeToAutoRun, false, 'Live proof prep: gateway proof is not auto-run');
  equal(gatewayItem?.executesLiveProof, false, 'Live proof prep: gateway item does not execute proof');
  equal(
    gatewayItem?.generatedBundleMayCloseLiveProof,
    false,
    'Live proof prep: gateway item cannot close live proof',
  );
  equal(gatewayItem?.authority, 'live-proof-prep-only', 'Live proof prep: gateway authority is prep-only');

  const shadowItem = bundle.prepItems.find((item) =>
    item.actionSurface === 'support.summarize_case'
  );
  equal(
    shadowItem?.liveProofCaptureCandidate,
    false,
    'Live proof prep: shadow path is not a live proof candidate',
  );
  equal(
    shadowItem?.targetBoundary,
    'shadow-or-advisory-observation-only',
    'Live proof prep: shadow path stays observation-only',
  );
  includes(
    shadowItem?.nextSafeStep ?? '',
    'Choose and review a customer-owned stop point',
    'Live proof prep: shadow path points to stop-point selection',
  );
  ok(
    shadowItem?.missingProofs.includes('customer-stop-point-not-selected-for-enforcement'),
    'Live proof prep: shadow path names missing stop-point selection',
  );
  equal(
    shadowItem?.nonBypassableClaimAllowed,
    false,
    'Live proof prep: shadow path cannot claim no-bypass',
  );
}

function testDescriptorDocsPackageAndLinkText(): void {
  const descriptor = actionSurfaceIntegrationKitLiveProofPrepBundleDescriptor();
  equal(descriptor.approvalRequired, true, 'Live proof prep descriptor: approval is required');
  equal(descriptor.executesLiveProof, false, 'Live proof prep descriptor: execution is false');
  equal(
    descriptor.generatedBundleMayCloseLiveProof,
    false,
    'Live proof prep descriptor: generated prep cannot close live proof',
  );
  ok(
    descriptor.captureRecordFields.includes('remaining-limitation'),
    'Live proof prep descriptor: remaining limitation field is listed',
  );

  const doc = readProjectFile('docs', '02-architecture', 'action-surface-integration-kit-buildout.md');
  includes(doc, 'Live Proof Prep Bundle', 'Integration kit doc: live proof prep section exists');
  includes(
    doc,
    'action-surface-integration-kit-live-proof-prep.ts',
    'Integration kit doc: live proof prep source is named',
  );
  includes(
    doc,
    'test:action-surface-integration-kit-live-proof-prep',
    'Integration kit doc: live proof prep script is named',
  );
  excludes(
    doc,
    /live proof prep bundle proves customer PEP no-bypass/iu,
    'Integration kit doc: live proof prep proof is not overclaimed',
  );

  const readme = readProjectFile('README.md');
  const navigator = readProjectFile('docs', '01-overview', 'repository-navigator.md');
  excludes(
    readme,
    /\[Review surface dashboard summary\]\(docs\/02-architecture\/dashboard-api-summary\.md\)/u,
    'README keeps review surface dashboard behind the repository navigator',
  );
  includes(
    navigator,
    '[Review surface dashboard summary](../02-architecture/dashboard-api-summary.md)',
    'Repository navigator: dashboard link text is standalone',
  );

  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  equal(
    pkg.scripts['test:action-surface-integration-kit-live-proof-prep'],
    'tsx tests/action-surface-integration-kit-live-proof-prep.test.ts',
    'package.json exposes live proof prep test',
  );
}

try {
  testBundlePreparesLiveProofWithoutClosingIt();
  testPrepItemsCarryCandidateAndObserveBoundaries();
  testDescriptorDocsPackageAndLinkText();
  console.log(`Action surface integration kit live proof prep tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Action surface integration kit live proof prep tests failed:', error);
  process.exitCode = 1;
}
