import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTESTOR_REVIEW_SURFACE_VERSION,
  attestorReviewSurfaceContractDescriptor,
  consequenceAdmissionDescriptor,
  consequenceDataMinimizationRedactionPolicyDescriptor,
  evaluateConsequenceDataMinimizationArtifact,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function testDescriptorDefinesOneWorkspaceContract(): void {
  const descriptor = attestorReviewSurfaceContractDescriptor();

  equal(
    descriptor.version,
    ATTESTOR_REVIEW_SURFACE_VERSION,
    'Review surface contract: version is stable',
  );
  equal(
    descriptor.dataMinimizationSurfaceKind,
    'attestor-review-surface',
    'Review surface contract: data minimization surface is stable',
  );
  for (const area of [
    'overview',
    'review-queue',
    'cases',
    'action-map',
    'evidence-library',
    'policy',
    'assurance',
  ] as const) {
    ok(descriptor.areas.includes(area), `Review surface contract: ${area} area is present`);
  }
  for (const form of [
    'ui',
    'json-api',
    'csv-export',
    'markdown-html-packet',
    'proof-bundle',
    'digest-ref-link',
  ] as const) {
    ok(descriptor.dataForms.includes(form), `Review surface contract: ${form} data form is present`);
  }
  for (const slice of [
    'ReviewSurfaceOverview',
    'ReviewQueueItem',
    'ReviewCaseDetail',
    'EvidenceArtifactIndex',
    'ActionSurfaceMapView',
    'PolicyPromotionPanel',
    'AssuranceHealthPanel',
  ] as const) {
    ok(
      descriptor.contractSlices.includes(slice),
      `Review surface contract: ${slice} slice is present`,
    );
  }
  ok(
    descriptor.sourceSurfaces.includes('dashboard-api-summary'),
    'Review surface contract: dashboard API summary is a source surface',
  );
  ok(
    descriptor.sourceSurfaces.includes('policy-foundry-hosted-review-surface'),
    'Review surface contract: hosted review surface is a source surface',
  );
  ok(
    descriptor.freshnessStates.includes('stale'),
    'Review surface contract: stale freshness is explicit',
  );
  ok(
    descriptor.lifecycleStates.includes('reopened'),
    'Review surface contract: reopened lifecycle state is explicit',
  );
  ok(
    descriptor.statusLabels.includes('missing-evidence'),
    'Review surface contract: missing evidence status is explicit',
  );
  ok(
    descriptor.requiredFields.includes('nextSafeStep'),
    'Review surface contract: next safe step is required',
  );
}

function testDescriptorKeepsAuthorityBoundaryClosed(): void {
  const descriptor = attestorReviewSurfaceContractDescriptor();

  equal(descriptor.rawPayloadStored, false, 'Review surface contract: raw payload storage is false');
  equal(descriptor.decisionSupportOnly, true, 'Review surface contract: decision support boundary is explicit');
  equal(descriptor.autoEnforce, false, 'Review surface contract: auto enforcement is false');
  equal(descriptor.productionReady, false, 'Review surface contract: production readiness is false');
  equal(descriptor.activatesEnforcement, false, 'Review surface contract: activation is false');
  equal(descriptor.deploysInfrastructure, false, 'Review surface contract: deployment is false');
  equal(descriptor.issuesCredentials, false, 'Review surface contract: credential issuance is false');
  equal(descriptor.mutatesPolicyBundle, false, 'Review surface contract: policy mutation is false');
  equal(descriptor.grantsAuthority, false, 'Review surface contract: authority grant is false');
  equal(descriptor.customerPepNoBypassProven, false, 'Review surface contract: customer PEP no-bypass is not proven');
  equal(descriptor.complianceClaimed, false, 'Review surface contract: compliance claim is false');
  equal(descriptor.hostedUiImplemented, false, 'Review surface contract: hosted UI is not claimed');
  equal(descriptor.authorityBoundary.canBlockAction, false, 'Review surface contract: cannot block by itself');
  equal(
    descriptor.authorityBoundary.canReduceEvidenceRequirements,
    false,
    'Review surface contract: cannot reduce evidence requirements',
  );
  ok(
    descriptor.prohibitedRawClasses.includes('raw-provider-bodies'),
    'Review surface contract: provider bodies are prohibited',
  );
}

function testAdmissionAndRedactionDescriptorsExposeReviewSurface(): void {
  const admission = consequenceAdmissionDescriptor();
  const redaction = consequenceDataMinimizationRedactionPolicyDescriptor();
  const reviewSurface = redaction.surfaces.find((surface) =>
    surface.surfaceKind === 'attestor-review-surface'
  );
  const allowed = evaluateConsequenceDataMinimizationArtifact({
    surfaceKind: 'attestor-review-surface',
    exposedUnits: [
      'reason-codes',
      'safe-instruction',
      'digests',
      'artifact-reference',
      'policy-reference',
      'status',
    ],
    rawPayloadStored: false,
  });
  const blocked = evaluateConsequenceDataMinimizationArtifact({
    surfaceKind: 'attestor-review-surface',
    exposedRawClasses: ['raw-model-prompt', 'credential-or-secret'],
  });

  equal(
    admission.reviewSurfaceVersion,
    ATTESTOR_REVIEW_SURFACE_VERSION,
    'Review surface contract: main descriptor exposes version',
  );
  ok(
    admission.reviewSurfaceAreas.includes('review-queue'),
    'Review surface contract: main descriptor exposes areas',
  );
  ok(
    admission.reviewSurfaceDataForms.includes('proof-bundle'),
    'Review surface contract: main descriptor exposes data forms',
  );
  ok(
    admission.reviewSurfaceContractSlices.includes('ReviewCaseDetail'),
    'Review surface contract: main descriptor exposes contract slices',
  );
  ok(
    redaction.surfaceKinds.includes('attestor-review-surface'),
    'Review surface contract: data minimization descriptor exposes surface kind',
  );
  ok(reviewSurface, 'Review surface contract: data minimization policy exists');
  equal(reviewSurface?.rawPayloadStored, false, 'Review surface contract: redaction policy stores no raw payload');
  ok(
    reviewSurface?.allowedUnits.includes('policy-reference'),
    'Review surface contract: redaction policy allows policy references',
  );
  equal(allowed.allowed, true, 'Review surface contract: structural review units are allowed');
  equal(blocked.allowed, false, 'Review surface contract: forbidden raw classes fail closed');
}

function testDocsAndPackageScriptExposeContract(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-review-surface-contract.md');
  const docsIndex = readProjectFile('docs', 'README.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const dataMinimizationDoc = readProjectFile(
    'docs',
    '02-architecture',
    'data-minimization-redaction-policy.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    doc,
    'attestor.review-surface.v1',
    'Review surface docs: version is named',
  );
  includes(
    doc,
    'not a hosted UI implementation',
    'Review surface docs: hosted UI non-claim is explicit',
  );
  includes(
    doc,
    'src/consequence-admission/attestor-review-surface-contract.ts',
    'Review surface docs: source file is named',
  );
  includes(
    doc,
    'Kubernetes conditions',
    'Review surface docs: source-backed status pattern is named',
  );
  includes(
    docsIndex,
    '02-architecture/attestor-review-surface-contract.md',
    'Review surface docs: docs index links contract',
  );
  includes(
    systemOverview,
    '[Attestor Review Surface contract](attestor-review-surface-contract.md)',
    'Review surface docs: system overview links contract',
  );
  includes(
    dataMinimizationDoc,
    'attestor-review-surface',
    'Review surface docs: data minimization doc lists surface',
  );
  equal(
    packageJson.scripts['test:attestor-review-surface-contract'],
    'tsx tests/attestor-review-surface-contract.test.ts',
    'Review surface contract: focused script is exposed',
  );
}

testDescriptorDefinesOneWorkspaceContract();
testDescriptorKeepsAuthorityBoundaryClosed();
testAdmissionAndRedactionDescriptorsExposeReviewSurface();
testDocsAndPackageScriptExposeContract();

ok(passed > 0, 'Attestor review surface contract tests executed');
console.log(`Attestor review surface contract tests: ${passed} passed, 0 failed`);
