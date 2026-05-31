import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createAttestorReviewCaseDetail,
  createAttestorReviewSurface,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
  createConsequenceDashboardApiSummary,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  type AttestorReviewSurface,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import {
  ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME,
  ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION,
  attestorReviewSurfaceExportDescriptor,
  attestorReviewSurfaceExportHeaders,
  createAttestorReviewSurfaceExportArtifact,
  serializeAttestorReviewSurfaceExportArtifact,
} from '../src/service/shadow/attestor-review-surface-export.js';

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
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function event(input?: {
  readonly mode?: 'observe' | 'warn' | 'review' | 'enforce';
  readonly blocked?: boolean;
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt?: string;
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input?.mode ?? 'observe',
      tenantId: 'tenant_review_surface_export',
      environment: 'sandbox',
      actor: 'support-agent',
      action: input?.action ?? 'issue_refund',
      domain: input?.domain ?? 'money-movement',
      downstreamSystem: input?.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-31T13:00:00.000Z',
      decidedAt: '2026-05-31T13:00:01.000Z',
      recipient: 'raw_export_recipient_must_not_escape',
      policyRef: input?.policyRef ?? null,
      evidenceRefs: input?.evidenceRefs ?? ['evidence:export_raw_must_not_escape'],
      observedFeatures: {
        rawMarker: 'raw_export_feature_must_not_escape',
      },
    }),
    occurredAt: input?.occurredAt ?? '2026-05-31T13:01:00.000Z',
    downstreamOutcome: input?.blocked ? 'blocked' : 'proceeded',
    humanOutcome: input?.blocked ? 'rejected' : 'not-reviewed',
  });
}

function reviewSurface(): AttestorReviewSurface {
  const auditEvidence = createConsequenceAuditEvidenceExport({
    events: [
      event(),
      event({
        mode: 'review',
        blocked: true,
        policyRef: 'policy:refunds:v1',
        occurredAt: '2026-05-31T13:02:00.000Z',
      }),
    ],
    generatedAt: '2026-05-31T13:03:00.000Z',
  });
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: '2026-05-31T13:04:00.000Z',
  });
  const summary = createConsequenceDashboardApiSummary({
    auditEvidence,
    dashboard,
    generatedAt: '2026-05-31T13:05:00.000Z',
  });

  return createAttestorReviewSurface({
    auditEvidence,
    businessRiskDashboard: dashboard,
    dashboardSummary: summary,
    generatedAt: '2026-05-31T13:06:00.000Z',
  });
}

function testExportArtifactIsDigestBoundAndRedacted(): void {
  const surface = reviewSurface();
  const firstCaseDigest = surface.caseDigests[0];
  assert.ok(firstCaseDigest, 'Review surface export: fixture has case digest');
  const caseDetail = createAttestorReviewCaseDetail({
    reviewSurface: surface,
    caseDigest: firstCaseDigest,
  });
  const artifact = createAttestorReviewSurfaceExportArtifact({
    reviewSurface: surface,
    caseDetails: [caseDetail],
    generatedAt: '2026-05-31T13:07:00.000Z',
  });
  const serialized = serializeAttestorReviewSurfaceExportArtifact(artifact);
  const parsed = JSON.parse(serialized) as typeof artifact;

  equal(artifact.version, ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION, 'Review surface export: version is stable');
  equal(artifact.exportKind, 'attestor-review-surface-json', 'Review surface export: kind is stable');
  equal(artifact.mediaType, 'application/json', 'Review surface export: media type is JSON');
  equal(artifact.filename, ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME, 'Review surface export: filename is stable');
  equal(
    artifact.sourceReviewSurfaceDigest,
    surface.digest,
    'Review surface export: source review surface digest is bound',
  );
  equal(artifact.reviewSurface.digest, surface.digest, 'Review surface export: review surface is retained');
  equal(artifact.caseDetails[0]?.caseDigest, firstCaseDigest, 'Review surface export: case detail is retained');
  equal(artifact.boundary.rawPayloadStored, false, 'Review surface export: raw payload storage is false');
  equal(artifact.boundary.rawCaseMaterialStored, false, 'Review surface export: raw case storage is false');
  equal(artifact.boundary.decisionSupportOnly, true, 'Review surface export: decision support boundary is explicit');
  equal(artifact.boundary.autoEnforce, false, 'Review surface export: auto enforcement is false');
  equal(artifact.boundary.productionReady, false, 'Review surface export: production readiness is false');
  equal(artifact.boundary.complianceClaimed, false, 'Review surface export: compliance is not claimed');
  ok(artifact.digest.startsWith('sha256:'), 'Review surface export: digest is generated');
  ok(artifact.canonical.includes('"attestor-review-surface-json"'), 'Review surface export: canonical payload is present');
  equal(parsed.digest, artifact.digest, 'Review surface export: serialized JSON round-trips digest');
  ok(!serialized.includes('tenant_review_surface_export'), 'Review surface export: raw tenant id is not serialized');
  ok(!serialized.includes('raw_export_recipient_must_not_escape'), 'Review surface export: raw recipient is not serialized');
  ok(!serialized.includes('raw_export_feature_must_not_escape'), 'Review surface export: raw feature is not serialized');
  ok(!serialized.includes('export_raw_must_not_escape'), 'Review surface export: raw evidence refs are not serialized');
}

function testExportDescriptorHeadersDocsAndScript(): void {
  const descriptor = attestorReviewSurfaceExportDescriptor();
  const headers = attestorReviewSurfaceExportHeaders();
  const docs = readProjectFile('docs', '02-architecture', 'attestor-review-surface-contract.md');
  const shadowRoutesDoc = readProjectFile('docs', '02-architecture', 'shadow-summary-routes.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    ATTESTOR_REVIEW_SURFACE_EXPORT_VERSION,
    'Review surface export: descriptor version is stable',
  );
  equal(descriptor.mediaType, 'application/json', 'Review surface export: descriptor media type is JSON');
  equal(descriptor.disposition, 'attachment', 'Review surface export: descriptor is an attachment');
  equal(descriptor.includesCaseDetails, true, 'Review surface export: descriptor includes case details');
  equal(descriptor.rendersFromReviewSurfaceOnly, true, 'Review surface export: descriptor renders from review surface only');
  equal(descriptor.rawPayloadStored, false, 'Review surface export: descriptor stores no raw payload');
  equal(descriptor.rawCaseMaterialStored, false, 'Review surface export: descriptor stores no raw case material');
  equal(descriptor.autoEnforce, false, 'Review surface export: descriptor never auto-enforces');
  equal(descriptor.productionReady, false, 'Review surface export: descriptor claims no production readiness');
  equal(headers['content-type'], 'application/json; charset=utf-8', 'Review surface export: JSON content type is set');
  equal(headers['cache-control'], 'no-store', 'Review surface export: cache-control is no-store');
  equal(
    headers['content-disposition'],
    `attachment; filename="${ATTESTOR_REVIEW_SURFACE_EXPORT_FILENAME}"`,
    'Review surface export: content disposition is attachment',
  );
  equal(headers['x-content-type-options'], 'nosniff', 'Review surface export: nosniff header is set');
  includes(
    docs,
    'GET /api/v1/shadow/review-surface/export',
    'Review surface docs: export route is named',
  );
  includes(
    shadowRoutesDoc,
    'GET /api/v1/shadow/review-surface/export',
    'Shadow summary docs: export route is named',
  );
  equal(
    pkg.scripts['test:attestor-review-surface-export'],
    'tsx tests/attestor-review-surface-export.test.ts',
    'Package: export test is exposed',
  );
}

assert.throws(
  () => attestorReviewSurfaceExportHeaders('bad\r\nname.json'),
  /filename must be static and header-safe/u,
  'Review surface export: unsafe filenames are rejected',
);
passed += 1;

testExportArtifactIsDigestBoundAndRedacted();
testExportDescriptorHeadersDocsAndScript();

ok(passed > 0, 'Attestor review surface export tests executed');
console.log(`Attestor review surface export tests: ${passed} passed, 0 failed`);
