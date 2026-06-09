import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionDescriptor,
  consequenceAuditEvidenceExportDescriptor,
  createConsequenceAuditEvidenceExport,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  createShadowPolicyDiscoveryCandidates,
  createShadowPolicySimulationReport,
  createShadowSummarySurface,
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
  readonly tenantId?: string;
  readonly environment?: string;
  readonly action?: string;
  readonly domain?: string;
  readonly downstreamSystem?: string;
  readonly policyRef?: string | null;
  readonly evidenceRefs?: readonly string[];
  readonly occurredAt: string;
  readonly observedFeatures?: Readonly<Record<string, string | number | boolean | null>>;
  readonly humanOutcome?: 'not-reviewed' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input.mode,
      tenantId: input.tenantId ?? 'tenant_audit',
      environment: input.environment ?? 'production',
      actor: 'support-ai-agent',
      action: input.action ?? 'issue_refund',
      domain: input.domain ?? 'money-movement',
      downstreamSystem: input.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-02T10:00:00.000Z',
      decidedAt: '2026-05-02T10:00:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'raw_customer_identifier_must_not_escape',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      observedFeatures: input.observedFeatures ?? {
        internalComment: 'raw_internal_comment_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
    observedFeatures: {
      sensitiveFeature: 'raw_sensitive_feature_must_not_escape',
    },
  });
}

function testAuditExportCreatesReviewerPacketWithoutRawPayloads(): void {
  const events = [
    event({
      mode: 'observe',
      occurredAt: '2026-05-02T10:00:02.000Z',
    }),
    event({
      mode: 'observe',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:123'],
      occurredAt: '2026-05-02T10:01:02.000Z',
    }),
    event({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:987'],
      observedFeatures: {
        policyBlocked: true,
        adapterReady: true,
      },
      occurredAt: '2026-05-02T10:02:02.000Z',
      humanOutcome: 'rejected',
    }),
  ];
  const simulation = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-02T10:03:00.000Z',
  });
  const summary = createShadowSummarySurface({
    events,
    simulations: [simulation],
    generatedAt: '2026-05-02T10:04:00.000Z',
  });
  const policyDiscovery = createShadowPolicyDiscoveryCandidates({
    report: simulation,
    generatedAt: '2026-05-02T10:05:00.000Z',
  });
  const auditExport = createConsequenceAuditEvidenceExport({
    events,
    summarySurface: summary,
    simulations: [simulation],
    policyDiscovery,
    generatedAt: '2026-05-02T10:06:00.000Z',
  });
  const serialized = JSON.stringify(auditExport);

  equal(
    auditExport.version,
    'attestor.consequence-audit-evidence-export.v1',
    'Audit evidence export: version is explicit',
  );
  equal(auditExport.scope.tenantId, 'tenant_audit', 'Audit evidence export: tenant is inferred');
  equal(auditExport.scope.environment, 'production', 'Audit evidence export: environment is inferred');
  equal(
    auditExport.period.start,
    '2026-05-02T10:00:02.000Z',
    'Audit evidence export: period start is derived',
  );
  equal(
    auditExport.period.end,
    '2026-05-02T10:02:02.000Z',
    'Audit evidence export: period end is derived',
  );
  equal(auditExport.controlSummary.shadowEventCount, 3, 'Audit evidence export: event count is retained');
  equal(auditExport.controlSummary.simulationCount, 1, 'Audit evidence export: simulation count is retained');
  equal(
    auditExport.controlSummary.policyCandidateCount,
    policyDiscovery.candidateCount,
    'Audit evidence export: policy candidate count is retained',
  );
  equal(auditExport.complianceClaimed, false, 'Audit evidence export: compliance is not claimed');
  equal(auditExport.rawPayloadStored, false, 'Audit evidence export: raw payload storage is false');
  equal(auditExport.controlPosture.approvalRequired, true, 'Audit evidence export: approval remains required');
  equal(auditExport.controlPosture.autoEnforce, false, 'Audit evidence export: export never auto-enforces');
  ok(auditExport.eventSetDigest.startsWith('sha256:'), 'Audit evidence export: event set digest is generated');
  ok(auditExport.digest.startsWith('sha256:'), 'Audit evidence export: export digest is generated');
  ok(
    auditExport.artifactRefs.some((artifact) => artifact.kind === 'shadow-event-set'),
    'Audit evidence export: shadow event set artifact is referenced',
  );
  ok(
    auditExport.artifactRefs.some((artifact) => artifact.kind === 'shadow-summary'),
    'Audit evidence export: shadow summary artifact is referenced',
  );
  ok(
    auditExport.artifactRefs.some((artifact) => artifact.kind === 'shadow-simulation'),
    'Audit evidence export: simulation artifact is referenced',
  );
  ok(
    auditExport.artifactRefs.some((artifact) => artifact.kind === 'policy-discovery-candidates'),
    'Audit evidence export: policy discovery artifact is referenced',
  );
  ok(
    auditExport.findings.some((finding) => finding.kind === 'policy-gaps-present'),
    'Audit evidence export: policy gaps become findings',
  );
  ok(
    auditExport.findings.some((finding) => finding.kind === 'policy-candidates-require-approval'),
    'Audit evidence export: policy candidates keep approval finding',
  );
  ok(
    auditExport.findings.some((finding) => finding.kind === 'redacted-export-ready'),
    'Audit evidence export: redacted export readiness is stated',
  );
  equal(
    auditExport.surfaceSummaries.some((surface) => surface.actionSurface !== null),
    false,
    'Audit evidence export: surface names are redacted by default',
  );
  ok(
    auditExport.alignmentRefs.includes('nist-ai-rmf-documentation-traceability'),
    'Audit evidence export: NIST AI RMF support reference is present',
  );
  ok(
    auditExport.alignmentRefs.includes('eu-ai-act-logging-traceability-support'),
    'Audit evidence export: EU AI Act traceability support reference is present',
  );
  ok(!serialized.includes('raw_customer_identifier_must_not_escape'), 'Audit evidence export: raw recipient is not serialized');
  ok(!serialized.includes('raw_internal_comment_must_not_escape'), 'Audit evidence export: raw generic feature is not serialized');
  ok(!serialized.includes('raw_sensitive_feature_must_not_escape'), 'Audit evidence export: raw shadow feature is not serialized');
  ok(!serialized.includes('ticket:123'), 'Audit evidence export: raw evidence reference is not serialized');
}

function testAuditExportCanIncludeSurfaceNamesWhenRequested(): void {
  const auditExport = createConsequenceAuditEvidenceExport({
    events: [
      event({
        mode: 'observe',
        policyRef: 'policy:refunds:v1',
        evidenceRefs: ['order:1'],
        occurredAt: '2026-05-02T11:00:02.000Z',
      }),
    ],
    generatedAt: '2026-05-02T11:01:00.000Z',
    includeSurfaceNames: true,
  });

  equal(
    auditExport.scope.includeSurfaceNames,
    true,
    'Audit evidence export: explicit surface-name inclusion is recorded',
  );
  ok(
    auditExport.surfaceSummaries.some((surface) =>
      surface.actionSurface === 'refund-service.issue_refund'
    ),
    'Audit evidence export: named surface appears only when requested',
  );
}

function testAuditExportRejectsCrossTenantWindows(): void {
  throws(
    () =>
      createConsequenceAuditEvidenceExport({
        events: [
          event({
            mode: 'observe',
            tenantId: 'tenant_one',
            occurredAt: '2026-05-02T12:00:02.000Z',
          }),
          event({
            mode: 'observe',
            tenantId: 'tenant_two',
            occurredAt: '2026-05-02T12:01:02.000Z',
          }),
        ],
        generatedAt: '2026-05-02T12:02:00.000Z',
      }),
    /tenantId must be scoped to one value/u,
    'Audit evidence export: cross-tenant export is rejected',
  );
}

function testEmptyAuditExportIsBlockedForReview(): void {
  const auditExport = createConsequenceAuditEvidenceExport({
    events: [],
    generatedAt: '2026-05-02T13:00:00.000Z',
  });

  equal(auditExport.controlSummary.shadowEventCount, 0, 'Audit evidence export: empty count is explicit');
  equal(auditExport.controlPosture.reviewReady, false, 'Audit evidence export: empty packet is not review-ready');
  ok(
    auditExport.findings.some((finding) => finding.kind === 'no-shadow-events'),
    'Audit evidence export: empty packet gets no-shadow-events finding',
  );
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = consequenceAuditEvidenceExportDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'audit-evidence-export.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    'attestor.consequence-audit-evidence-export.v1',
    'Audit evidence export: descriptor version is stable',
  );
  ok(
    descriptor.artifactKinds.includes('shadow-event-set'),
    'Audit evidence export: descriptor exposes artifact kinds',
  );
  ok(
    descriptor.findingKinds.includes('raw-payload-present'),
    'Audit evidence export: descriptor exposes finding kinds',
  );
  equal(descriptor.complianceClaimed, false, 'Audit evidence export: descriptor does not claim compliance');
  ok(
    admissionDescriptor.auditEvidenceArtifactKinds.includes('shadow-simulation'),
    'Audit evidence export: main descriptor exposes audit artifact kinds',
  );
  includes(
    readme,
    'The trail records what was proposed',
    'Audit evidence export: README describes the decision trail',
  );
  includes(
    doc,
    'reviewer packet, not a compliance certificate',
    'Audit evidence export: doc states non-certificate boundary',
  );
  includes(
    systemOverview,
    '[Audit evidence export](audit-evidence-export.md)',
    'Audit evidence export: system overview links doc',
  );
  equal(
    packageJson.scripts['test:consequence-audit-evidence-export'],
    'tsx tests/consequence-audit-evidence-export.test.ts',
    'Audit evidence export: focused script is exposed',
  );
}

testAuditExportCreatesReviewerPacketWithoutRawPayloads();
testAuditExportCanIncludeSurfaceNamesWhenRequested();
testAuditExportRejectsCrossTenantWindows();
testEmptyAuditExportIsBlockedForReview();
testDescriptorDocsAndPackageSurface();

console.log(`Consequence audit evidence export tests: ${passed} passed, 0 failed`);
