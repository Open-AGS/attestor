import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionDescriptor,
  consequenceDataMinimizationRedactionPolicyDescriptor,
  consequenceExternalReviewPacketDescriptor,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
  createConsequenceExternalReviewPacket,
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
  readonly occurredAt: string;
  readonly humanOutcome?: 'not-reviewed' | 'rejected';
}): ShadowAdmissionEvent {
  return createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: input.mode,
      tenantId: 'tenant_external_review',
      environment: 'production',
      actor: 'support-ai-agent',
      action: input.action ?? 'issue_refund',
      domain: input.domain ?? 'money-movement',
      downstreamSystem: input.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-05T09:00:00.000Z',
      decidedAt: '2026-05-05T09:00:01.000Z',
      amount: {
        value: 38000,
        currency: 'HUF',
      },
      recipient: 'raw_customer_external_review_marker_must_not_escape',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      observedFeatures: {
        rawNote: 'raw_external_review_note_must_not_escape',
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
      occurredAt: '2026-05-05T09:00:02.000Z',
    }),
    event({
      mode: 'observe',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['ticket:external-review'],
      occurredAt: '2026-05-05T09:01:02.000Z',
    }),
    event({
      mode: 'enforce',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['order:external-review'],
      occurredAt: '2026-05-05T09:02:02.000Z',
      humanOutcome: 'rejected',
    }),
  ];
  const simulation = createShadowPolicySimulationReport({
    events,
    proposedMode: 'review',
    generatedAt: '2026-05-05T09:03:00.000Z',
  });
  const policyDiscovery = createShadowPolicyDiscoveryCandidates({
    report: simulation,
    generatedAt: '2026-05-05T09:04:00.000Z',
  });
  return createConsequenceAuditEvidenceExport({
    events,
    simulations: [simulation],
    policyDiscovery,
    generatedAt: '2026-05-05T09:05:00.000Z',
  });
}

function repositoryEvidence() {
  return [
    {
      kind: 'security-policy',
      id: 'SECURITY.md',
      uri: 'SECURITY.md',
      status: 'present',
      summary: 'Disclosure path and evaluation security boundary.',
    },
    {
      kind: 'license',
      id: 'LICENSE',
      uri: 'LICENSE',
      status: 'present',
      summary: 'Repository license reference.',
    },
    {
      kind: 'ci-verify',
      id: 'verify-workflow',
      uri: '.github/workflows',
      status: 'present',
      summary: 'Required verify workflow reference.',
    },
    {
      kind: 'codeql',
      id: 'codeql-analysis',
      uri: '.github/workflows/codeql.yml',
      status: 'present',
      summary: 'CodeQL analysis reference.',
    },
    {
      kind: 'dependency-review',
      id: 'dependency-review',
      uri: '.github/workflows',
      status: 'present',
      summary: 'Dependency review reference.',
    },
    {
      kind: 'supply-chain-baseline',
      id: 'supply-chain-baseline',
      uri: 'scripts/check/check-supply-chain-baseline.mjs',
      status: 'present',
      summary: 'Registry, lockfile, integrity, workflow permission guard.',
    },
  ] as const;
}

function testExternalReviewPacketCreatesReviewerHandoffWithoutRawPayloads(): void {
  const auditEvidence = auditExportFixture();
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: '2026-05-05T09:06:00.000Z',
  });
  const packet = createConsequenceExternalReviewPacket({
    auditEvidence,
    businessRiskDashboard: dashboard,
    runtimeEvidence: {
      runtimeProfileId: 'production-shared',
      productionStoragePathState: 'ready-for-selected-profile',
      readyForSelectedProfile: true,
      productionReady: true,
      blockerCount: 0,
      requiredProofs: ['shared-authority-store', 'shared-ledger-store'],
      sourceDigest: auditEvidence.digest,
    },
    repositoryEvidence: repositoryEvidence(),
    generatedAt: '2026-05-05T09:07:00.000Z',
  });
  const serialized = JSON.stringify(packet);

  equal(
    packet.version,
    'attestor.consequence-external-review-packet.v1',
    'External review packet: version is explicit',
  );
  equal(packet.auditEvidenceDigest, auditEvidence.digest, 'External review packet: source audit digest is retained');
  equal(packet.businessRiskDashboardDigest, dashboard.digest, 'External review packet: dashboard digest is retained');
  equal(packet.tenantId, 'tenant_external_review', 'External review packet: tenant scope is retained');
  equal(packet.environment, 'production', 'External review packet: environment scope is retained');
  equal(packet.rawPayloadStored, false, 'External review packet: raw payload storage is false');
  equal(packet.securityAuditClaimed, false, 'External review packet: security audit is not claimed');
  equal(packet.complianceClaimed, false, 'External review packet: compliance is not claimed');
  equal(packet.productionReady, false, 'External review packet: production readiness is not claimed');
  equal(packet.autoEnforce, false, 'External review packet: packet never auto-enforces');
  equal(packet.controlPosture.approvalRequired, true, 'External review packet: approval remains required');
  ok(packet.digest.startsWith('sha256:'), 'External review packet: digest is generated');
  ok(
    packet.focusAreas.includes('authorization-boundary'),
    'External review packet: authorization boundary focus is exposed',
  );
  ok(
    packet.focusAreas.includes('data-minimization'),
    'External review packet: data minimization focus is exposed',
  );
  ok(
    packet.focusAreas.includes('supply-chain'),
    'External review packet: supply-chain focus is exposed',
  );
  ok(
    packet.focusAreas.includes('non-claims-boundary'),
    'External review packet: non-claims focus is exposed',
  );
  ok(
    packet.nonClaims.includes('not-a-security-audit'),
    'External review packet: security audit non-claim is explicit',
  );
  ok(
    packet.evidenceRefs.some((ref) =>
      ref.kind === 'audit-evidence-export' &&
      ref.digest === auditEvidence.digest
    ),
    'External review packet: audit evidence ref is present',
  );
  ok(
    packet.evidenceRefs.some((ref) => ref.kind === 'supply-chain-baseline'),
    'External review packet: supply-chain evidence ref is present',
  );
  ok(
    packet.checklist.some((item) =>
      item.focusArea === 'production-storage' &&
      item.status === 'ready'
    ),
    'External review packet: runtime storage checklist can be ready',
  );
  ok(
    packet.findings.some((finding) => finding.kind === 'external-review-required'),
    'External review packet: external review requirement is retained',
  );
  ok(
    packet.findings.some((finding) => finding.kind === 'redacted-review-packet-ready'),
    'External review packet: redacted packet readiness is retained',
  );
  ok(!serialized.includes('raw_customer_external_review_marker_must_not_escape'), 'External review packet: raw recipient is not serialized');
  ok(!serialized.includes('raw_external_review_note_must_not_escape'), 'External review packet: raw feature is not serialized');
  ok(!serialized.includes('ticket:external-review'), 'External review packet: raw evidence ref is not serialized');
}

function testExternalReviewPacketFindsMissingEvidenceAndStorageBlockers(): void {
  const auditEvidence = auditExportFixture();
  const packet = createConsequenceExternalReviewPacket({
    auditEvidence,
    runtimeEvidence: {
      runtimeProfileId: 'production-shared',
      productionStoragePathState: 'blocked',
      readyForSelectedProfile: false,
      productionReady: false,
      blockerCount: 2,
      sourceDigest: auditEvidence.digest,
    },
    repositoryEvidence: [],
    generatedAt: '2026-05-05T10:00:00.000Z',
  });

  ok(
    packet.findings.some((finding) => finding.kind === 'business-risk-dashboard-missing'),
    'External review packet: missing dashboard is a finding',
  );
  ok(
    packet.findings.some((finding) =>
      finding.kind === 'production-storage-not-ready' &&
      finding.count === 2
    ),
    'External review packet: production storage blockers are findings',
  );
  ok(
    packet.findings.some((finding) =>
      finding.kind === 'required-repository-evidence-missing' &&
      finding.count === 6
    ),
    'External review packet: missing required repository evidence is counted',
  );
  ok(
    packet.checklist.some((item) =>
      item.itemId === 'review-production-storage' &&
      item.status === 'blocked'
    ),
    'External review packet: production storage checklist blocks when runtime evidence blocks',
  );
  ok(
    packet.controlPosture.blockerCount > 0,
    'External review packet: blockers affect control posture',
  );
}

function testExternalReviewPacketRejectsInvalidBindings(): void {
  const auditEvidence = auditExportFixture();
  const otherAuditEvidence = createConsequenceAuditEvidenceExport({
    events: [
      event({
        mode: 'observe',
        occurredAt: '2026-05-05T11:00:02.000Z',
      }),
    ],
    generatedAt: '2026-05-05T11:01:00.000Z',
  });
  const mismatchedDashboard = createConsequenceBusinessRiskDashboard({
    auditExport: otherAuditEvidence,
    generatedAt: '2026-05-05T11:02:00.000Z',
  });

  throws(
    () =>
      createConsequenceExternalReviewPacket({
        auditEvidence,
        businessRiskDashboard: mismatchedDashboard,
      }),
    /businessRiskDashboard must be bound to the auditEvidence digest/u,
    'External review packet: dashboard must bind to the source audit digest',
  );

  throws(
    () =>
      createConsequenceExternalReviewPacket({
        auditEvidence,
        repositoryEvidence: [
          {
            kind: 'security-policy',
            id: 'SECURITY.md',
            status: 'present',
            digest: 'not-a-digest',
          },
        ],
      }),
    /evidenceRefs\[\]\.digest must be a sha256 digest/u,
    'External review packet: repository evidence digests must be valid sha256 digests',
  );

  throws(
    () =>
      createConsequenceExternalReviewPacket({
        auditEvidence,
        repositoryEvidence: [
          {
            kind: 'security-policy',
            id: 'SECURITY.md',
            status: 'unknown' as 'present',
          },
        ],
      }),
    /evidence status must be one of/u,
    'External review packet: repository evidence status is validated',
  );
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = consequenceExternalReviewPacketDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();
  const redactionPolicy = consequenceDataMinimizationRedactionPolicyDescriptor();
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'external-review-packet.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const purpose = readProjectFile('docs', '01-overview', 'purpose.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    'attestor.consequence-external-review-packet.v1',
    'External review packet: descriptor version is stable',
  );
  ok(
    descriptor.focusAreas.includes('downstream-enforcement'),
    'External review packet: descriptor exposes downstream enforcement focus',
  );
  ok(
    descriptor.evidenceStatuses.includes('not-claimed'),
    'External review packet: descriptor exposes non-claim evidence status',
  );
  equal(descriptor.securityAuditClaimed, false, 'External review packet: descriptor does not claim security audit');
  ok(
    admissionDescriptor.externalReviewFocusAreas.includes('proof-integrity'),
    'External review packet: main descriptor exposes focus areas',
  );
  ok(
    admissionDescriptor.externalReviewEvidenceKinds.includes('supply-chain-baseline'),
    'External review packet: main descriptor exposes evidence kinds',
  );
  ok(
    redactionPolicy.surfaceKinds.includes('external-review-packet'),
    'External review packet: data minimization policy exposes packet surface',
  );
  includes(
    readme,
    '[Security and data handling](docs/01-overview/security-and-data-handling.md)',
    'External review packet: README links security and data handling',
  );
  includes(
    doc,
    'not a security audit',
    'External review packet: doc states non-audit boundary',
  );
  includes(
    systemOverview,
    '[External review packet](external-review-packet.md)',
    'External review packet: system overview links doc',
  );
  includes(
    purpose,
    'external review packet',
    'External review packet: purpose doc mentions reviewer handoff',
  );
  equal(
    packageJson.scripts['test:consequence-external-review-packet'],
    'tsx tests/consequence-external-review-packet.test.ts',
    'External review packet: focused script is exposed',
  );
}

testExternalReviewPacketCreatesReviewerHandoffWithoutRawPayloads();
testExternalReviewPacketFindsMissingEvidenceAndStorageBlockers();
testExternalReviewPacketRejectsInvalidBindings();
testDescriptorDocsAndPackageSurface();

console.log(`Consequence external review packet tests: ${passed} passed, 0 failed`);
