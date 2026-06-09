import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionDescriptor,
  consequenceBusinessRiskDashboardDescriptor,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
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
      tenantId: 'tenant_dashboard',
      environment: 'production',
      actor: 'support-ai-agent',
      action: input.action ?? 'issue_refund',
      domain: input.domain ?? 'money-movement',
      downstreamSystem: input.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-03T09:00:00.000Z',
      decidedAt: '2026-05-03T09:00:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'raw_customer_marker_must_not_escape',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      observedFeatures: input.observedFeatures ?? {
        rawNote: 'raw_note_must_not_escape',
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
      occurredAt: '2026-05-03T09:00:02.000Z',
    }),
    event({
      mode: 'observe',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:report'],
      occurredAt: '2026-05-03T09:01:02.000Z',
    }),
    event({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:refund'],
      observedFeatures: {
        policyBlocked: true,
        adapterReady: true,
      },
      occurredAt: '2026-05-03T09:02:02.000Z',
      humanOutcome: 'rejected',
    }),
  ];
  const simulation = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-03T09:03:00.000Z',
  });
  const policyDiscovery = createShadowPolicyDiscoveryCandidates({
    report: simulation,
    generatedAt: '2026-05-03T09:04:00.000Z',
  });
  return createConsequenceAuditEvidenceExport({
    events,
    simulations: [simulation],
    policyDiscovery,
    generatedAt: '2026-05-03T09:05:00.000Z',
  });
}

function testDashboardCreatesBusinessRiskSummaryWithoutRawPayloads(): void {
  const auditExport = auditExportFixture();
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport,
    generatedAt: '2026-05-03T09:06:00.000Z',
    impactObservations: [
      {
        kind: 'money-movement-held',
        value: 3800000,
        unit: 'minor-currency-units',
        currency: 'HUF',
        domain: 'money-movement',
        sourceDigest: auditExport.digest,
        confidence: 0.8,
        summary: 'Operator-supplied held refund exposure for this review window.',
      },
    ],
  });
  const serialized = JSON.stringify(dashboard);

  equal(
    dashboard.version,
    'attestor.consequence-business-risk-dashboard.v1',
    'Business risk dashboard: version is explicit',
  );
  equal(dashboard.sourceAuditExportDigest, auditExport.digest, 'Business risk dashboard: source audit digest is retained');
  equal(dashboard.tenantId, 'tenant_dashboard', 'Business risk dashboard: tenant is retained');
  equal(dashboard.environment, 'production', 'Business risk dashboard: environment is retained');
  equal(dashboard.posture, 'blocked-for-review', 'Business risk dashboard: high findings block review');
  equal(dashboard.impactMode, 'operator-supplied', 'Business risk dashboard: impact mode is explicit');
  equal(dashboard.impactObservations.length, 1, 'Business risk dashboard: impact observation is retained');
  equal(dashboard.rawPayloadStored, false, 'Business risk dashboard: raw payload storage is false');
  equal(dashboard.rawImpactValueStored, false, 'Business risk dashboard: raw impact storage is false');
  equal(dashboard.complianceClaimed, false, 'Business risk dashboard: compliance is not claimed');
  equal(dashboard.decisionSupportOnly, true, 'Business risk dashboard: dashboard is decision support only');
  equal(dashboard.autoEnforce, false, 'Business risk dashboard: dashboard never enforces');
  ok(dashboard.digest.startsWith('sha256:'), 'Business risk dashboard: digest is generated');
  ok(
    dashboard.widgets.includes('operator-supplied-impact'),
    'Business risk dashboard: impact widget is exposed',
  );
  ok(
    dashboard.metrics.some((item) => item.metric === 'ai-actions-observed' && item.value === 3),
    'Business risk dashboard: action count metric is present',
  );
  ok(
    dashboard.metrics.some((item) => item.metric === 'policy-gap-events'),
    'Business risk dashboard: policy gap metric is present',
  );
  ok(
    dashboard.domainRows.some((row) =>
      row.domain === 'money-movement' &&
      row.blockedCount >= 1 &&
      row.riskScore > 0
    ),
    'Business risk dashboard: domain risk row is generated',
  );
  ok(
    dashboard.signalRows.some((row) => row.signal === 'policy-gap'),
    'Business risk dashboard: policy gap signal is generated',
  );
  ok(dashboard.impactDigest?.startsWith('sha256:'), 'Business risk dashboard: impact digest is generated');
  ok(!serialized.includes('raw_customer_marker_must_not_escape'), 'Business risk dashboard: raw recipient is not serialized');
  ok(!serialized.includes('raw_note_must_not_escape'), 'Business risk dashboard: raw feature is not serialized');
  ok(!serialized.includes('ticket:report'), 'Business risk dashboard: raw evidence ref is not serialized');
}

function testDashboardDoesNotInferBusinessImpact(): void {
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditExportFixture(),
    generatedAt: '2026-05-03T10:00:00.000Z',
  });

  equal(dashboard.impactMode, 'not-supplied', 'Business risk dashboard: impact is not inferred');
  equal(dashboard.impactObservations.length, 0, 'Business risk dashboard: no impact observations are invented');
  equal(dashboard.impactDigest, null, 'Business risk dashboard: impact digest is null when no impact supplied');
}

function testDashboardRejectsUnsafeImpactObservations(): void {
  const auditExport = auditExportFixture();

  throws(
    () =>
      createConsequenceBusinessRiskDashboard({
        auditExport,
        impactObservations: [
          {
            kind: 'money-movement-held',
            value: 1,
            unit: 'actions',
            sourceDigest: auditExport.digest,
            rawValueStored: true as false,
          },
        ],
      }),
    /impact observations must not store raw values/u,
    'Business risk dashboard: raw impact observations are rejected',
  );

  throws(
    () =>
      createConsequenceBusinessRiskDashboard({
        auditExport,
        impactObservations: [
          {
            kind: 'money-movement-held',
            value: 1,
            unit: 'actions',
            sourceDigest: 'not-a-digest',
          },
        ],
      }),
    /sourceDigest must be a sha256 digest/u,
    'Business risk dashboard: source digest is required for impact observations',
  );
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = consequenceBusinessRiskDashboardDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'business-risk-dashboard.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    'attestor.consequence-business-risk-dashboard.v1',
    'Business risk dashboard: descriptor version is stable',
  );
  ok(
    descriptor.widgets.includes('consequence-domain-risk'),
    'Business risk dashboard: descriptor exposes domain risk widget',
  );
  equal(
    descriptor.impactMode,
    'operator-supplied-only',
    'Business risk dashboard: descriptor states operator-supplied impact only',
  );
  equal(descriptor.complianceClaimed, false, 'Business risk dashboard: descriptor does not claim compliance');
  ok(
    admissionDescriptor.businessRiskDashboardWidgets.includes('operator-supplied-impact'),
    'Business risk dashboard: main descriptor exposes widgets',
  );
  includes(
    readme,
    'href="docs/01-overview/how-attestor-connects-to-existing-systems.md"',
    'Business risk dashboard: README links the existing-systems overview',
  );
  includes(
    doc,
    'does not infer money saved',
    'Business risk dashboard: doc rejects inferred money-saved claims',
  );
  includes(
    systemOverview,
    '[Business risk dashboard](business-risk-dashboard.md)',
    'Business risk dashboard: system overview links doc',
  );
  equal(
    packageJson.scripts['test:consequence-business-risk-dashboard'],
    'tsx tests/consequence-business-risk-dashboard.test.ts',
    'Business risk dashboard: focused script is exposed',
  );
}

testDashboardCreatesBusinessRiskSummaryWithoutRawPayloads();
testDashboardDoesNotInferBusinessImpact();
testDashboardRejectsUnsafeImpactObservations();
testDescriptorDocsAndPackageSurface();

console.log(`Consequence business risk dashboard tests: ${passed} passed, 0 failed`);
