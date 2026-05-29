import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGenericAdmissionEnvelope,
  createGoldenPathsEvaluatorSummary,
  type CreateGenericAdmissionInput,
  type GenericAdmissionEnvelope,
} from '../src/consequence-admission/index.js';

interface ShapeSnapshot {
  readonly shapeVersion: string;
  readonly surface: string;
  readonly payload: unknown;
}

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readSnapshot(name: string): string {
  return readFileSync(
    join(process.cwd(), 'tests', 'snapshots', 'api-evidence-shapes', `${name}.json`),
    'utf8',
  );
}

function assertSnapshot(name: string, value: ShapeSnapshot): void {
  const actual = stableJson(value);
  const expected = readSnapshot(name);
  equal(
    actual,
    expected,
    `API/evidence shape snapshot ${name} changed. Review the contract and update the checked-in snapshot intentionally if this is expected.`,
  );
  ok(!actual.includes('customer_123'), `API/evidence shape snapshot ${name} does not expose raw recipient`);
  ok(!actual.includes('workflow:refund-approval:987'), `API/evidence shape snapshot ${name} does not expose raw approval workflow ref`);
}

function trustedMoneyAdmission(overrides: Partial<CreateGenericAdmissionInput> = {}): CreateGenericAdmissionInput {
  return {
    mode: 'enforce',
    actor: 'support-ai-agent',
    action: 'issue_refund',
    domain: 'money-movement',
    downstreamSystem: 'refund-service',
    requestedAt: '2026-05-01T17:00:00.000Z',
    decidedAt: '2026-05-01T17:00:01.000Z',
    requestId: 'snapshot-admission-001',
    tenantId: 'tenant_snapshot',
    policyRef: 'policy:refunds:v1',
    evidenceRefs: ['order:987', 'payment:456'],
    authoritySources: [{
      sourceKind: 'verified-approval',
      claimKind: 'approval',
      sourceRef: 'approval:refund:987',
      evidenceDigest: digest('a'),
    }],
    approvals: [{
      approvalRef: 'approval:refund:987',
      sourceKind: 'approval-workflow',
      state: 'approved',
      sourceRef: 'workflow:refund-approval:987',
      reviewerRef: 'reviewer:risk-owner',
      reviewerAuthorityDigest: digest('b'),
      approvalDigest: digest('c'),
      scopeDigest: digest('d'),
      issuedAt: '2026-05-01T17:00:00.000Z',
      expiresAt: '2026-05-01T19:00:00.000Z',
      signatureVerified: true,
    }],
    amount: {
      value: 38000,
      currency: 'HUF',
    },
    recipient: 'customer_123',
    ...overrides,
  };
}

function admissionShape(envelope: GenericAdmissionEnvelope): ShapeSnapshot {
  return {
    shapeVersion: 'attestor.api-evidence-shape.v1',
    surface: 'generic-admission-envelope',
    payload: {
      mode: envelope.mode,
      shadowDecision: envelope.shadowDecision,
      downstreamPosture: envelope.downstreamPosture,
      enforcementActive: envelope.enforcementActive,
      decision: envelope.admission.decision,
      allowed: envelope.admission.allowed,
      failClosed: envelope.admission.failClosed,
      reasonCodes: envelope.admission.reasonCodes,
      missingFields: envelope.admission.feedback.missingFields,
      requiredEvidenceKinds: envelope.admission.feedback.requiredEvidenceKinds,
      operatorOnlyReasonCodes: envelope.admission.feedback.operatorOnlyReasonCodes,
      proofKinds: envelope.admission.proof.map((proof) => proof.kind),
      checks: envelope.admission.checks.map((check) => ({
        kind: check.kind,
        outcome: check.outcome,
        reasonCodes: check.reasonCodes,
      })),
      retry: {
        retryAllowed: envelope.admission.retry.retryAllowed,
        retryCategory: envelope.admission.retry.retryCategory,
        nextAllowedMode: envelope.admission.retry.nextAllowedMode,
      },
    },
  };
}

function goldenSummaryShape(): ShapeSnapshot {
  const summary = createGoldenPathsEvaluatorSummary();
  return {
    shapeVersion: 'attestor.api-evidence-shape.v1',
    surface: 'golden-paths-evaluator-summary',
    payload: {
      version: summary.version,
      pathCount: summary.pathCount,
      readyPathCount: summary.readyPathCount,
      totalScenarioCount: summary.totalScenarioCount,
      totalNamedGapCount: summary.totalNamedGapCount,
      localOnly: summary.localOnly,
      repoSideOnly: summary.repoSideOnly,
      shadowOnly: summary.shadowOnly,
      noCustomerPepProof: summary.noCustomerPepProof,
      noExternalKmsProof: summary.noExternalKmsProof,
      productionReady: summary.productionReady,
      enterpriseReady: summary.enterpriseReady,
      paths: summary.paths.map((path) => ({
        key: path.key,
        pack: path.pack,
        readiness: path.evaluatorReadiness,
        scenarioCount: path.scenarioCount,
        namedGapCount: path.namedGapCount,
        activatesEnforcement: path.activatesEnforcement,
        productionReady: path.productionReady,
      })),
    },
  };
}

assertSnapshot(
  'generic-admission-admit',
  admissionShape(createGenericAdmissionEnvelope(trustedMoneyAdmission())),
);
assertSnapshot(
  'generic-admission-review',
  admissionShape(createGenericAdmissionEnvelope({
    ...trustedMoneyAdmission({
      mode: 'review',
      requestId: 'snapshot-review-001',
    }),
    policyRef: null,
    evidenceRefs: [],
    authoritySources: [],
    approvals: [],
  })),
);
assertSnapshot('golden-paths-evaluator-summary', goldenSummaryShape());

console.log(`api-evidence-shape-snapshots.test.ts: ${passed} assertions passed`);
