import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionPresentationBindingDescriptor,
  createConsequenceAdmissionCheck,
  createConsequenceAdmissionDownstreamContract,
  createConsequenceAdmissionPresentationBinding,
  createConsequenceAdmissionPresentationFreshnessNonce,
  createConsequenceAdmissionRequest,
  createConsequenceAdmissionResponse,
  evaluateConsequenceAdmissionPresentationBinding,
  type ConsequenceAdmissionCheck,
} from '../src/consequence-admission/index.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(value.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digestText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function passCheck(kind: ConsequenceAdmissionCheck['kind']): ConsequenceAdmissionCheck {
  return createConsequenceAdmissionCheck({
    kind,
    label: `${kind} check`,
    outcome: 'pass',
    required: true,
    summary: `${kind} passed for F4 freshness nonce validation.`,
    reasonCodes: [`${kind}-passed`],
    evidenceRefs: [`evidence:${kind}`],
  });
}

function admittedAction() {
  const request = createConsequenceAdmissionRequest({
    requestedAt: '2026-05-14T06:20:00.000Z',
    packFamily: 'general',
    entryPoint: {
      kind: 'internal-service',
      id: 'presentation-freshness-nonce-test',
      route: null,
      packageSubpath: null,
      sourceRef: 'customer/test-adapter',
    },
    proposedConsequence: {
      actor: 'AI-assisted workflow',
      action: 'prepare bounded action',
      downstreamSystem: 'bounded-action-service',
      consequenceKind: 'action',
      riskClass: 'R3',
      summary: 'AI-assisted workflow asks to present a bounded action.',
    },
    policyScope: {
      policyRef: 'policy:bounded-action:v1',
      tenantId: 'tenant_freshness',
      environment: 'production',
      dimensions: { domain: 'test' },
    },
    authority: {
      actorRef: 'actor:test-agent',
      reviewerRef: 'reviewer:test-owner',
      authorityMode: 'named-reviewer',
    },
    evidence: [
      {
        id: 'evidence:test',
        kind: 'test-record',
        digest: 'sha256:test',
        uri: null,
      },
    ],
    nativeInputRefs: ['target', 'bodyDigest', 'idempotencyKey'],
  });

  return createConsequenceAdmissionResponse({
    request,
    decidedAt: '2026-05-14T06:20:01.000Z',
    decision: 'admit',
    reason: 'Freshness nonce validation action passed admission checks.',
    reasonCodes: ['freshness-nonce-action-admitted'],
    checks: [
      passCheck('policy'),
      passCheck('authority'),
      passCheck('evidence'),
      passCheck('freshness'),
      passCheck('enforcement'),
    ],
    proof: [
      {
        kind: 'release-token',
        id: 'rt_f4_freshness_nonce',
        digest: 'sha256:token',
        uri: null,
        verifyHint: 'Verify the release token before presenting.',
      },
    ],
  });
}

function downstreamContract() {
  return createConsequenceAdmissionDownstreamContract({
    enforcementPointId: 'adapter:bounded-action-service',
    boundaryKind: 'action-dispatcher',
    consequenceDomain: 'system-operation',
    downstreamSystems: ['bounded-action-service'],
    acceptedConsequenceKinds: ['action'],
    acceptedRiskClasses: ['R3'],
    policyRefs: ['policy:bounded-action:v1'],
    environment: 'production',
  });
}

function testAttestorIssuedNonceDigestControlsFreshness(): void {
  const admission = admittedAction();
  const freshnessNonce = createConsequenceAdmissionPresentationFreshnessNonce({
    issuedAt: '2026-05-14T06:20:05.000Z',
    maxFreshnessSeconds: 60,
    nonce: 'nonce:f4:presentation:freshness',
  });
  const presentation = createConsequenceAdmissionPresentationBinding({
    admission,
    contract: downstreamContract(),
    target: {
      uri: 'https://example.internal/actions/bounded',
      method: 'POST',
      bodyDigest: 'sha256:bounded-body',
    },
    replayKey: 'f4:freshness:attempt:1',
    nonce: freshnessNonce.nonce,
    presentedAt: freshnessNonce.issuedAt,
    expiresAt: freshnessNonce.expiresAt,
  });
  const allowed = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: downstreamContract(),
    presentation,
    expected: {
      targetUri: 'https://example.internal/actions/bounded',
      method: 'POST',
      bodyDigest: 'sha256:bounded-body',
      nonceDigest: freshnessNonce.nonceDigest,
      requireBodyDigest: true,
      requireReplayKey: true,
      requireNonce: true,
      maxFreshnessSeconds: freshnessNonce.maxFreshnessSeconds,
    },
    now: '2026-05-14T06:20:30.000Z',
  });
  const wrongNonce = evaluateConsequenceAdmissionPresentationBinding({
    admission,
    contract: downstreamContract(),
    presentation,
    expected: {
      nonceDigest: digestText('nonce:f4:presentation:wrong'),
      requireNonce: true,
      maxFreshnessSeconds: freshnessNonce.maxFreshnessSeconds,
    },
    now: '2026-05-14T06:20:30.000Z',
  });
  const serializedDecision = JSON.stringify(allowed);

  equal(allowed.outcome, 'allow', 'F4 freshness nonce: matching nonce digest allows');
  equal(wrongNonce.outcome, 'hold', 'F4 freshness nonce: wrong nonce digest holds');
  ok(
    wrongNonce.failureReasons.includes('nonce-mismatch'),
    'F4 freshness nonce: wrong nonce digest records nonce mismatch',
  );
  equal(
    serializedDecision.includes(freshnessNonce.nonce),
    false,
    'F4 freshness nonce: decision does not serialize raw nonce',
  );
}

function testDescriptorDocsTrackerAndPackageStayAligned(): void {
  const descriptor = consequenceAdmissionPresentationBindingDescriptor();
  const validationDoc = readProjectFile('docs', 'audit', 'f4-presentation-freshness-nonce-validation.md');
  const presentationDoc = readProjectFile('docs', '02-architecture', 'downstream-presentation-binding.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  equal(descriptor.supportsAttestorIssuedFreshnessNonce, true, 'F4 freshness nonce: descriptor exposes support');
  equal(
    descriptor.freshnessNonceExposesRawNonceInDecision,
    false,
    'F4 freshness nonce: descriptor keeps decision nonce digest-only',
  );
  includes(validationDoc, 'Status: repository-side `fixed`', 'F4 freshness nonce doc: fixed status is explicit');
  includes(
    presentationDoc,
    'createConsequenceAdmissionPresentationFreshnessNonce',
    'F4 freshness nonce doc: helper is documented',
  );
  includes(
    tracker,
    'F4-LLM05-A presentation freshness relies on operator clock | `fixed`',
    'Tracker: F4-LLM05-A is fixed',
  );
  equal(
    packageJson.scripts['test:f4-presentation-freshness-nonce-validation'],
    'tsx tests/f4-presentation-freshness-nonce-validation.test.ts',
    'Package: F4 freshness nonce validation script is exposed',
  );
}

try {
  testAttestorIssuedNonceDigestControlsFreshness();
  testDescriptorDocsTrackerAndPackageStayAligned();
  console.log(`F4 presentation freshness nonce validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F4 presentation freshness nonce validation tests failed:', error);
  process.exitCode = 1;
}
