import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
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
  ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION,
  attestorReviewSurfaceHtmlPreviewDescriptor,
  renderAttestorReviewSurfaceHtmlPreview,
} from '../src/service/shadow/attestor-review-surface-html-preview.js';

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

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
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
      tenantId: 'tenant_review_surface_html',
      environment: 'sandbox',
      actor: 'support-agent',
      action: input?.action ?? 'issue_refund',
      domain: input?.domain ?? 'money-movement',
      downstreamSystem: input?.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-31T12:00:00.000Z',
      decidedAt: '2026-05-31T12:00:01.000Z',
      recipient: 'raw_html_preview_recipient_must_not_escape',
      policyRef: input?.policyRef ?? null,
      evidenceRefs: input?.evidenceRefs ?? ['evidence:html_preview_raw_must_not_escape'],
      observedFeatures: {
        rawMarker: 'raw_html_preview_feature_must_not_escape',
      },
    }),
    occurredAt: input?.occurredAt ?? '2026-05-31T12:01:00.000Z',
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
        occurredAt: '2026-05-31T12:02:00.000Z',
      }),
    ],
    generatedAt: '2026-05-31T12:03:00.000Z',
  });
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: '2026-05-31T12:04:00.000Z',
  });
  const summary = createConsequenceDashboardApiSummary({
    auditEvidence,
    dashboard,
    generatedAt: '2026-05-31T12:05:00.000Z',
  });

  return createAttestorReviewSurface({
    auditEvidence,
    businessRiskDashboard: dashboard,
    dashboardSummary: summary,
    generatedAt: '2026-05-31T12:06:00.000Z',
  });
}

function testHtmlPreviewRendersReviewSurfaceOnly(): void {
  const surface = reviewSurface();
  const html = renderAttestorReviewSurfaceHtmlPreview(surface);

  includes(html, '<!doctype html>', 'Review surface HTML preview: document is rendered');
  includes(html, 'Attestor review surface', 'Review surface HTML preview: page identity is visible');
  includes(html, 'Skip to review queue', 'Review surface HTML preview: skip link is present');
  includes(html, 'data-testid="attestor-review-surface-status"', 'Review surface HTML preview: status panel has stable QA selector');
  includes(html, 'data-testid="attestor-review-surface-queue"', 'Review surface HTML preview: queue has stable QA selector');
  includes(html, 'role="alert"', 'Review surface HTML preview: blocker state uses alert role');
  includes(html, 'aria-live="assertive"', 'Review surface HTML preview: blocker state is announced assertively');
  includes(html, '<ol class="task-list">', 'Review surface HTML preview: review queue renders as ordered task list');
  includes(html, '/api/v1/shadow/review-surface/cases/', 'Review surface HTML preview: case detail route is linked');
  includes(html, 'Evidence digests', 'Review surface HTML preview: evidence digest section is visible');
  includes(html, surface.digest, 'Review surface HTML preview: review surface digest is visible');
  includes(html, surface.sourceAuditExportDigest, 'Review surface HTML preview: audit evidence digest is visible');
  includes(html, 'Review material only', 'Review surface HTML preview: boundary statement is visible');
  includes(html, 'overflow-wrap: anywhere', 'Review surface HTML preview: long digest wrapping is present');
  includes(html, '@media (max-width: 640px)', 'Review surface HTML preview: mobile viewport CSS is present');
  excludes(
    html,
    /tenant_review_surface_html|raw_html_preview_recipient_must_not_escape|raw_html_preview_feature_must_not_escape|html_preview_raw_must_not_escape/u,
    'Review surface HTML preview: raw tenant, recipient, feature, and evidence refs are not rendered',
  );
}

function testHtmlPreviewEscapesRenderedFields(): void {
  const surface = reviewSurface();
  const first = surface.reviewQueue[0];
  assert.ok(first, 'Review surface HTML preview: fixture has queue item');
  const hostileSurface: AttestorReviewSurface = {
    ...surface,
    overview: {
      ...surface.overview,
      nextSafeStep: '<img src=x onerror=alert(1)>',
    },
    reviewQueue: [
      {
        ...first,
        queueItemId: '<script>alert(1)</script>',
        nextSafeStep: 'Review <script>alert(2)</script>',
      },
    ],
  };
  const html = renderAttestorReviewSurfaceHtmlPreview(hostileSurface);

  includes(
    html,
    '&lt;img src=x onerror=alert(1)&gt;',
    'Review surface HTML preview: overview text is escaped',
  );
  includes(
    html,
    'Review &lt;script&gt;alert(2)&lt;/script&gt;',
    'Review surface HTML preview: queue text is escaped',
  );
  excludes(html, /<script>|<img src=x/u, 'Review surface HTML preview: hostile markup is not executable HTML');
}

function testHtmlPreviewDescriptorDocsAndScript(): void {
  const descriptor = attestorReviewSurfaceHtmlPreviewDescriptor();
  const docs = readProjectFile('docs', '02-architecture', 'attestor-review-surface-contract.md');
  const shadowRoutesDoc = readProjectFile('docs', '02-architecture', 'shadow-summary-routes.md');
  const pkg = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    ATTESTOR_REVIEW_SURFACE_HTML_PREVIEW_VERSION,
    'Review surface HTML preview: descriptor version is stable',
  );
  equal(
    descriptor.dataMinimizationSurfaceKind,
    'attestor-review-surface',
    'Review surface HTML preview: data minimization surface is the review surface',
  );
  equal(
    descriptor.rendersFromReviewSurfaceOnly,
    true,
    'Review surface HTML preview: descriptor renders from review surface only',
  );
  equal(descriptor.rawPayloadStored, false, 'Review surface HTML preview: descriptor stores no raw payload');
  equal(descriptor.autoEnforce, false, 'Review surface HTML preview: descriptor never auto-enforces');
  equal(descriptor.productionReady, false, 'Review surface HTML preview: descriptor claims no production readiness');
  equal(descriptor.activatesEnforcement, false, 'Review surface HTML preview: descriptor cannot activate enforcement');
  includes(
    docs,
    'GET /api/v1/shadow/review-surface/view',
    'Review surface docs: hosted HTML preview route is named',
  );
  includes(
    docs,
    'src/service/shadow/attestor-review-surface-html-preview.ts',
    'Review surface docs: HTML preview renderer source is named',
  );
  includes(
    shadowRoutesDoc,
    'GET /api/v1/shadow/review-surface/view',
    'Shadow summary docs: HTML preview route is named',
  );
  equal(
    pkg.scripts['test:attestor-review-surface-html-preview'],
    'tsx tests/attestor-review-surface-html-preview.test.ts',
    'Package: HTML preview test is exposed',
  );
}

testHtmlPreviewRendersReviewSurfaceOnly();
testHtmlPreviewEscapesRenderedFields();
testHtmlPreviewDescriptorDocsAndScript();

ok(passed > 0, 'Attestor review surface HTML preview tests executed');
console.log(`Attestor review surface HTML preview tests: ${passed} passed, 0 failed`);
