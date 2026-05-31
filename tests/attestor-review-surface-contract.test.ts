import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTESTOR_REVIEW_SURFACE_VERSION,
  attestorReviewSurfaceContractDescriptor,
  consequenceAdmissionDescriptor,
  consequenceDataMinimizationRedactionPolicyDescriptor,
  createAttestorReviewSurface,
  createConsequenceAuditEvidenceExport,
  createConsequenceBusinessRiskDashboard,
  createConsequenceDashboardApiSummary,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  evaluateConsequenceDataMinimizationArtifact,
  type AssuranceMeasurementPlane,
  type EvidenceStateModel,
  type ReviewByExceptionInboxResult,
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

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function digest(value: string): string {
  return `sha256:${Buffer.from(value).toString('hex').padEnd(64, '0').slice(0, 64)}`;
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
      tenantId: 'tenant_review_surface_contract',
      environment: 'sandbox',
      actor: 'support-agent',
      action: input.action ?? 'issue_refund',
      domain: input.domain ?? 'money-movement',
      downstreamSystem: input.downstreamSystem ?? 'refund-service',
      requestedAt: '2026-05-31T10:00:00.000Z',
      decidedAt: '2026-05-31T10:00:01.000Z',
      recipient: 'raw_review_surface_marker_must_not_escape',
      policyRef: input.policyRef ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      observedFeatures: {
        rawNote: 'raw_review_surface_feature_must_not_escape',
      },
    }),
    occurredAt: input.occurredAt,
    downstreamOutcome: input.humanOutcome === 'rejected' ? 'blocked' : 'proceeded',
    humanOutcome: input.humanOutcome ?? 'not-reviewed',
  });
}

function auditDashboardSummaryFixture() {
  const events = [
    event({
      mode: 'observe',
      occurredAt: '2026-05-31T10:01:00.000Z',
    }),
    event({
      mode: 'observe',
      action: 'export_customer_report',
      domain: 'data-disclosure',
      downstreamSystem: 'report-service',
      policyRef: 'policy:reports:v1',
      evidenceRefs: ['evidence:report-review'],
      occurredAt: '2026-05-31T10:02:00.000Z',
    }),
    event({
      mode: 'review',
      policyRef: 'policy:refunds:v1',
      evidenceRefs: ['evidence:refund-review'],
      occurredAt: '2026-05-31T10:03:00.000Z',
      humanOutcome: 'rejected',
    }),
  ];
  const auditEvidence = createConsequenceAuditEvidenceExport({
    events,
    generatedAt: '2026-05-31T10:04:00.000Z',
    includeSurfaceNames: true,
  });
  const dashboard = createConsequenceBusinessRiskDashboard({
    auditExport: auditEvidence,
    generatedAt: '2026-05-31T10:05:00.000Z',
  });
  const summary = createConsequenceDashboardApiSummary({
    auditEvidence,
    dashboard,
    generatedAt: '2026-05-31T10:06:00.000Z',
  });

  return { auditEvidence, dashboard, summary };
}

function reviewInboxFixture(): ReviewByExceptionInboxResult {
  const itemDigest = digest('review-inbox-item');
  return {
    digest: digest('review-inbox'),
    rawPayloadStored: false,
    autoEnforce: false,
    status: 'blocked',
    approvalPacketReady: false,
    items: [
      {
        itemId: 'review-inbox-item-1',
        itemDigest,
        lane: 'blocked-by-evidence',
        requiredAction: 'provide-evidence',
        defaultVisible: true,
        approvalBlocked: true,
        reviewContextDigest: digest('review-context'),
        sourcePolicyCandidateDigest: digest('policy-candidate'),
        sourcePolicyTwinCandidateDigest: digest('policy-twin-candidate'),
        sourceEvidenceStateDigest: digest('evidence-state-surface'),
        reasonCodes: ['review-inbox-evidence-or-replay-blocker'],
        noGoReasons: ['policy-twin-missed-evidence'],
      },
    ],
  } as unknown as ReviewByExceptionInboxResult;
}

function evidenceStateFixture(): EvidenceStateModel {
  return {
    digest: digest('evidence-state'),
    rawPayloadStored: false,
    autoEnforce: false,
    stateCounts: {
      observed: 4,
      inferred: 0,
      missing: 1,
      conflicting: 0,
      stale: 2,
      untrusted: 0,
      approved: 0,
      enforceable: 0,
    },
    surfaceCount: 2,
  } as unknown as EvidenceStateModel;
}

function assuranceFixture(): AssuranceMeasurementPlane {
  return {
    digest: digest('assurance'),
    rawPayloadStored: false,
    autoEnforce: false,
    status: 'measurement-degraded',
    nextSafeStep: 'Mark the review surface degraded until source-backed again.',
    summary: {
      degradedSignalCount: 1,
      driftDetectedCount: 1,
    },
  } as unknown as AssuranceMeasurementPlane;
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

function testAggregatorComposesDigestBoundReviewSurface(): void {
  const { auditEvidence, dashboard, summary } = auditDashboardSummaryFixture();
  const reviewInbox = reviewInboxFixture();
  const evidenceState = evidenceStateFixture();
  const assurance = assuranceFixture();
  const surface = createAttestorReviewSurface({
    auditEvidence,
    businessRiskDashboard: dashboard,
    dashboardSummary: summary,
    reviewInbox,
    evidenceState,
    assurance,
    generatedAt: '2026-05-31T10:07:00.000Z',
  });
  const serialized = JSON.stringify(surface);

  equal(surface.version, ATTESTOR_REVIEW_SURFACE_VERSION, 'Review surface aggregator: version is stable');
  equal(surface.sourceAuditExportDigest, auditEvidence.digest, 'Review surface aggregator: audit digest is bound');
  equal(surface.sourceBusinessRiskDashboardDigest, dashboard.digest, 'Review surface aggregator: dashboard digest is bound');
  equal(surface.sourceDashboardSummaryDigest, summary.digest, 'Review surface aggregator: summary digest is bound');
  equal(surface.sourceReviewInboxDigest, reviewInbox.digest, 'Review surface aggregator: inbox digest is retained');
  equal(surface.sourceEvidenceStateDigest, evidenceState.digest, 'Review surface aggregator: evidence digest is retained');
  equal(surface.sourceAssuranceDigest, assurance.digest, 'Review surface aggregator: assurance digest is retained');
  equal(surface.mode, 'mixed', 'Review surface aggregator: mixed mode is explicit');
  equal(surface.overview.freshnessState, 'degraded', 'Review surface aggregator: degraded freshness reaches overview');
  equal(surface.overview.staleCount, 2, 'Review surface aggregator: stale count is derived from evidence state');
  equal(surface.reviewQueue[0]?.statusLabel, 'missing-evidence', 'Review surface aggregator: inbox lane maps to status label');
  equal(surface.reviewQueue[0]?.defaultVisible, true, 'Review surface aggregator: human work remains default-visible');
  equal(surface.policy.promotionBlocked, true, 'Review surface aggregator: blocked inbox blocks promotion panel');
  equal(surface.assurance.degradedSignalCount, 1, 'Review surface aggregator: assurance degraded signals are visible');
  equal(surface.rawPayloadStored, false, 'Review surface aggregator: raw payload storage is false');
  equal(surface.autoEnforce, false, 'Review surface aggregator: auto enforcement is false');
  equal(surface.activatesEnforcement, false, 'Review surface aggregator: enforcement activation is false');
  equal(surface.grantsAuthority, false, 'Review surface aggregator: authority grant is false');
  equal(surface.hostedUiImplemented, false, 'Review surface aggregator: hosted UI is not claimed');
  ok(surface.digest.startsWith('sha256:'), 'Review surface aggregator: digest is generated');
  ok(surface.canonical.includes('"reviewSurfaceId"'), 'Review surface aggregator: canonical payload is present');
  ok(
    surface.sourceSurfaces.includes('review-by-exception-inbox'),
    'Review surface aggregator: inbox source surface is listed',
  );
  ok(
    !serialized.includes('tenant_review_surface_contract'),
    'Review surface aggregator: serialized output excludes raw tenant id',
  );
  ok(
    !serialized.includes('raw_review_surface_marker_must_not_escape'),
    'Review surface aggregator: serialized output excludes raw recipient',
  );
  ok(
    !serialized.includes('raw_review_surface_feature_must_not_escape'),
    'Review surface aggregator: serialized output excludes raw observed feature',
  );
}

function testAggregatorRejectsMismatchedSourceDigests(): void {
  const { auditEvidence, dashboard, summary } = auditDashboardSummaryFixture();
  const otherAuditEvidence = createConsequenceAuditEvidenceExport({
    events: [
      event({
        mode: 'observe',
        occurredAt: '2026-05-31T11:01:00.000Z',
      }),
    ],
    generatedAt: '2026-05-31T11:02:00.000Z',
  });
  const mismatchedDashboard = createConsequenceBusinessRiskDashboard({
    auditExport: otherAuditEvidence,
    generatedAt: '2026-05-31T11:03:00.000Z',
  });

  assert.throws(
    () =>
      createAttestorReviewSurface({
        auditEvidence,
        businessRiskDashboard: mismatchedDashboard,
        dashboardSummary: summary,
      }),
    /businessRiskDashboard must be bound/u,
    'Review surface aggregator: mismatched dashboard is rejected',
  );
  passed += 1;
  assert.throws(
    () =>
      createAttestorReviewSurface({
        auditEvidence,
        businessRiskDashboard: dashboard,
        dashboardSummary: {
          ...summary,
          sourceDashboardDigest: digest('wrong-dashboard'),
        },
      }),
    /dashboardSummary must be bound to the businessRiskDashboard digest/u,
    'Review surface aggregator: mismatched summary is rejected',
  );
  passed += 1;
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
    'createAttestorReviewSurface',
    'Review surface docs: aggregator API is named',
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
testAggregatorComposesDigestBoundReviewSurface();
testAggregatorRejectsMismatchedSourceDigests();
testAdmissionAndRedactionDescriptorsExposeReviewSurface();
testDocsAndPackageScriptExposeContract();

ok(passed > 0, 'Attestor review surface contract tests executed');
console.log(`Attestor review surface contract tests: ${passed} passed, 0 failed`);
