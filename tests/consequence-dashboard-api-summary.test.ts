import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionDescriptor,
  consequenceDashboardApiSummaryDescriptor,
  consequenceDataMinimizationRedactionPolicyDescriptor,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
  createConsequenceDashboardApiSummary,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  type ShadowAdmissionEvent,
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function event(input: {
  readonly mode: 'observe' | 'warn' | 'review' | 'enforce';
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input.mode,
      tenantId: 'tenant_dashboard_api',
      environment: 'production',
      actor: 'support-ai-agent',
      action: input.action ?? 'issue_refund',
      domain: input.domain ?? 'money-movement',
      downstreamSystem: input.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-06T09:00:00.000Z',
      decidedAt: '2026-05-06T09:00:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'raw_customer_dashboard_api_marker_must_not_escape',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      observedFeatures: input.observedFeatures ?? {
        rawNote: 'raw_dashboard_api_note_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
  });
}

function auditExportFixture() {
  const events = [
    event({
      mode: 'observe',
      occurredAt: '2026-05-06T09:00:02.000Z',
    }),
    event({
      mode: 'observe',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:dashboard-api-raw-evidence'],
      occurredAt: '2026-05-06T09:01:02.000Z',
    }),
    event({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:dashboard-api-raw-evidence'],
      observedFeatures: {
        policyBlocked: true,
        adapterReady: true,
      },
      occurredAt: '2026-05-06T09:02:02.000Z',
      humanOutcome: 'rejected',
    }),
  ];
  const simulation = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-06T09:03:00.000Z',
  });
  const policyDiscovery = createShadowPolicyDiscoveryCandidates({
    report: simulation,
    generatedAt: '2026-05-06T09:04:00.000Z',
  });
  return createConsequenceAuditEvidenceExport({
    events,
    simulations: [simulation],
    policyDiscovery,
    generatedAt: '2026-05-06T09:05:00.000Z',
  });
}

function testDashboardApiSummaryCreatesCompactBusinessViewWithoutRawPayloads(): void {
  const auditEvidence = auditExportFixture();
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: '2026-05-06T09:06:00.000Z',
  });
  const summary = createConsequenceDashboardApiSummary({
    auditEvidence,
    dashboard,
    generatedAt: '2026-05-06T09:07:00.000Z',
  });
  const serialized = JSON.stringify(summary);

  equal(
    summary.version,
    'attestor.consequence-dashboard-api-summary.v1',
    'Dashboard API summary: version is explicit',
  );
  equal(summary.sourceAuditExportDigest, auditEvidence.digest, 'Dashboard API summary: source audit digest is retained');
  equal(summary.sourceDashboardDigest, dashboard.digest, 'Dashboard API summary: source dashboard digest is retained');
  equal(summary.tenantId, 'tenant_dashboard_api', 'Dashboard API summary: tenant is retained');
  equal(summary.environment, 'production', 'Dashboard API summary: environment is retained');
  equal(summary.overview.observedActionCount, 3, 'Dashboard API summary: action count is retained');
  equal(summary.overview.policyGapCount, auditEvidence.controlSummary.policyGapCount, 'Dashboard API summary: policy gaps are retained');
  equal(summary.overview.wouldBlockCount, auditEvidence.controlSummary.blockedCount, 'Dashboard API summary: block count is retained');
  equal(summary.rawPayloadStored, false, 'Dashboard API summary: raw payload storage is false');
  equal(summary.rawImpactValueStored, false, 'Dashboard API summary: raw impact storage is false');
  equal(summary.complianceClaimed, false, 'Dashboard API summary: compliance is not claimed');
  equal(summary.productionReady, false, 'Dashboard API summary: production readiness is not claimed');
  equal(summary.decisionSupportOnly, true, 'Dashboard API summary: decision support boundary is explicit');
  equal(summary.autoEnforce, false, 'Dashboard API summary: summary never enforces');
  ok(summary.digest.startsWith('sha256:'), 'Dashboard API summary: digest is generated');
  ok(
    summary.tiles.some((tile) => tile.kind === 'policy-gaps' && tile.severity === 'high'),
    'Dashboard API summary: policy gap tile is high severity',
  );
  ok(
    summary.attentionItems.some((item) =>
      item.kind === 'define-policy' &&
      item.route === '/api/v1/shadow/policy-candidates'
    ),
    'Dashboard API summary: policy gap next step points to policy candidates',
  );
  ok(
    summary.apiLinks.some((link) =>
      link.kind === 'business-risk-dashboard' &&
      link.route === '/api/v1/shadow/business-risk-dashboard'
    ),
    'Dashboard API summary: full dashboard link is present',
  );
  ok(
    summary.topDomains.some((row) =>
      row.domain === 'money-movement' &&
      row.recommendedNextStep.length > 0
    ),
    'Dashboard API summary: top domain rows are present',
  );
  ok(!serialized.includes('raw_customer_dashboard_api_marker_must_not_escape'), 'Dashboard API summary: raw recipient is not serialized');
  ok(!serialized.includes('raw_dashboard_api_note_must_not_escape'), 'Dashboard API summary: raw feature is not serialized');
  ok(!serialized.includes('dashboard-api-raw-evidence'), 'Dashboard API summary: raw evidence ref is not serialized');
}

function testDashboardApiSummaryRejectsMismatchedDashboard(): void {
  const auditEvidence = auditExportFixture();
  const otherAuditEvidence = createConsequenceAuditEvidenceExport({
    events: [
      event({
        mode: 'observe',
        occurredAt: '2026-05-06T10:00:02.000Z',
      }),
    ],
    generatedAt: '2026-05-06T10:01:00.000Z',
  });
  const mismatchedDashboard = createConsequenceBusinessRiskDashboard({
    auditExport: otherAuditEvidence,
    generatedAt: '2026-05-06T10:02:00.000Z',
  });

  throws(
    () =>
      createConsequenceDashboardApiSummary({
        auditEvidence,
        dashboard: mismatchedDashboard,
      }),
    /dashboard must be bound to the auditEvidence digest/u,
    'Dashboard API summary: dashboard source digest must match audit evidence digest',
  );
}

function testEmptyDashboardApiSummaryStaysExplicit(): void {
  const auditEvidence = createConsequenceAuditEvidenceExport({
    events: [],
    generatedAt: '2026-05-06T11:00:00.000Z',
  });
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: '2026-05-06T11:01:00.000Z',
  });
  const summary = createConsequenceDashboardApiSummary({
    auditEvidence,
    dashboard,
    generatedAt: '2026-05-06T11:02:00.000Z',
  });

  equal(summary.overview.observedActionCount, 0, 'Dashboard API summary: empty count is zero');
  ok(
    summary.headline.includes('No AI action evidence'),
    'Dashboard API summary: empty headline is explicit',
  );
  ok(
    summary.attentionItems.some((item) => item.kind === 'start-shadow-mode'),
    'Dashboard API summary: empty window points to shadow mode evidence',
  );
  ok(
    summary.tiles.some((tile) => tile.kind === 'actions-observed' && tile.severity === 'medium'),
    'Dashboard API summary: empty observed-action tile asks for attention',
  );
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = consequenceDashboardApiSummaryDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();
  const redactionPolicy = consequenceDataMinimizationRedactionPolicyDescriptor();
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'dashboard-api-summary.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    'attestor.consequence-dashboard-api-summary.v1',
    'Dashboard API summary: descriptor version is stable',
  );
  ok(
    descriptor.tileKinds.includes('policy-gaps'),
    'Dashboard API summary: descriptor exposes tile kinds',
  );
  ok(
    descriptor.attentionKinds.includes('define-policy'),
    'Dashboard API summary: descriptor exposes attention kinds',
  );
  ok(
    descriptor.linkKinds.includes('business-risk-dashboard'),
    'Dashboard API summary: descriptor exposes API link kinds',
  );
  equal(descriptor.decisionSupportOnly, true, 'Dashboard API summary: descriptor is decision support only');
  ok(
    admissionDescriptor.dashboardApiSummaryTileKinds.includes('would-block'),
    'Dashboard API summary: main descriptor exposes tile kinds',
  );
  ok(
    redactionPolicy.surfaceKinds.includes('dashboard-api-summary'),
    'Dashboard API summary: data minimization policy exposes summary surface',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Dashboard API summary: README links the existing-systems overview',
  );
  includes(
    doc,
    'not a raw event feed',
    'Dashboard API summary: doc states raw feed boundary',
  );
  includes(
    systemOverview,
    '[Review surface dashboard summary](dashboard-api-summary.md)',
    'Dashboard API summary: system overview links doc',
  );
  equal(
    packageJson.scripts['test:consequence-dashboard-api-summary'],
    'tsx tests/consequence-dashboard-api-summary.test.ts',
    'Dashboard API summary: focused script is exposed',
  );
}

testDashboardApiSummaryCreatesCompactBusinessViewWithoutRawPayloads();
testDashboardApiSummaryRejectsMismatchedDashboard();
testEmptyDashboardApiSummaryStaysExplicit();
testDescriptorDocsAndPackageSurface();

console.log(`Consequence dashboard API summary tests: ${passed} passed, 0 failed`);
