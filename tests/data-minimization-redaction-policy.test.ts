import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
  consequenceAdmissionDescriptor,
  consequenceAuditEvidenceExportDescriptor,
  consequenceBusinessRiskDashboardDescriptor,
  consequenceDashboardApiSummaryDescriptor,
  consequenceDataMinimizationMaterialSafetyFindings,
  consequenceDataMinimizationRedactionPolicyDescriptor,
  consequenceExternalReviewPacketDescriptor,
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

function testDescriptorCoversCriticalSurfaces(): void {
  const descriptor = consequenceDataMinimizationRedactionPolicyDescriptor();
  const modelFeedback = descriptor.surfaces.find((surface) =>
    surface.surfaceKind === 'admission-model-feedback'
  );
  const auditExport = descriptor.surfaces.find((surface) =>
    surface.surfaceKind === 'audit-evidence-export'
  );
  const dashboard = descriptor.surfaces.find((surface) =>
    surface.surfaceKind === 'business-risk-dashboard'
  );
  const dashboardApiSummary = descriptor.surfaces.find((surface) =>
    surface.surfaceKind === 'dashboard-api-summary'
  );
  const externalReview = descriptor.surfaces.find((surface) =>
    surface.surfaceKind === 'external-review-packet'
  );

  equal(
    descriptor.version,
    CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    'Data minimization policy: version is stable',
  );
  ok(
    descriptor.governanceRefs.includes('owasp-llm02-sensitive-information-disclosure'),
    'Data minimization policy: OWASP LLM sensitive disclosure reference is exposed',
  );
  ok(
    descriptor.governanceRefs.includes('gdpr-art-5-data-minimisation'),
    'Data minimization policy: GDPR data minimization reference is exposed',
  );
  equal(descriptor.modelFeedbackIsRedacted, true, 'Data minimization policy: model feedback is redacted');
  equal(descriptor.proofSurfacesAreDigestFirst, true, 'Data minimization policy: proof surfaces are digest-first');
  equal(descriptor.dashboardIsDecisionSupportOnly, true, 'Data minimization policy: dashboard is decision support only');
  equal(descriptor.rawPayloadStored, false, 'Data minimization policy: raw payload storage is false');
  equal(descriptor.rawOverrideSupported, false, 'Data minimization policy: raw override is not supported');
  ok(modelFeedback, 'Data minimization policy: model feedback surface is present');
  equal(modelFeedback?.modelSafe, true, 'Data minimization policy: model feedback is model-safe');
  ok(
    modelFeedback?.allowedUnits.includes('safe-instruction'),
    'Data minimization policy: model feedback allows safe instruction',
  );
  ok(auditExport, 'Data minimization policy: audit export surface is present');
  ok(
    auditExport?.allowedUnits.includes('artifact-reference'),
    'Data minimization policy: audit export allows artifact references',
  );
  ok(dashboard, 'Data minimization policy: dashboard surface is present');
  ok(
    dashboard?.allowedUnits.includes('operator-supplied-aggregate-impact'),
    'Data minimization policy: dashboard allows only aggregate impact',
  );
  ok(dashboardApiSummary, 'Data minimization policy: dashboard API summary surface is present');
  ok(
    dashboardApiSummary?.allowedUnits.includes('artifact-reference'),
    'Data minimization policy: dashboard API summary allows artifact references',
  );
  ok(externalReview, 'Data minimization policy: external review packet surface is present');
  ok(
    externalReview?.allowedUnits.includes('artifact-reference'),
    'Data minimization policy: external review packet allows artifact references',
  );

  for (const surface of descriptor.surfaces) {
    equal(surface.rawPayloadStored, false, `Data minimization policy: ${surface.surfaceKind} stores no raw payload`);
    equal(surface.rawOverrideSupported, false, `Data minimization policy: ${surface.surfaceKind} has no raw override`);
    ok(
      surface.forbiddenRawClasses.includes('credential-or-secret'),
      `Data minimization policy: ${surface.surfaceKind} forbids credentials and secrets`,
    );
    ok(
      surface.forbiddenRawClasses.includes('raw-bank-or-payment-data'),
      `Data minimization policy: ${surface.surfaceKind} forbids raw bank/payment data`,
    );
    ok(
      surface.forbiddenRawClasses.includes('raw-wallet-key-or-secret'),
      `Data minimization policy: ${surface.surfaceKind} forbids wallet secrets`,
    );
  }
}

function testEvaluationAllowsOnlySurfaceSpecificUnits(): void {
  const allowed = evaluateConsequenceDataMinimizationArtifact({
    surfaceKind: 'admission-model-feedback',
    rawPayloadStored: false,
    exposedUnits: ['reason-codes', 'safe-instruction', 'missing-field-names'],
  });
  const blocked = evaluateConsequenceDataMinimizationArtifact({
    surfaceKind: 'audit-evidence-export',
    rawPayloadStored: true,
    exposedUnits: ['operator-supplied-aggregate-impact'],
    exposedRawClasses: ['raw-customer-identifier', 'credential-or-secret'],
  });

  equal(allowed.allowed, true, 'Data minimization policy: model-safe feedback shape is allowed');
  equal(allowed.failClosed, false, 'Data minimization policy: allowed feedback does not fail closed');
  equal(allowed.rawPayloadStored, false, 'Data minimization policy: evaluation output never stores raw payload');
  ok(allowed.digest.startsWith('sha256:'), 'Data minimization policy: allowed evaluation is digest-shaped');
  equal(blocked.allowed, false, 'Data minimization policy: unsafe audit export shape is blocked');
  equal(blocked.failClosed, true, 'Data minimization policy: unsafe audit export fails closed');
  ok(
    blocked.reasonCodes.includes('raw-payload-stored'),
    'Data minimization policy: raw payload storage is a blocker',
  );
  ok(
    blocked.reasonCodes.includes('forbidden-raw-class:raw-customer-identifier'),
    'Data minimization policy: raw customer identifiers are blockers',
  );
  ok(
    blocked.reasonCodes.includes('forbidden-raw-class:credential-or-secret'),
    'Data minimization policy: credentials and secrets are blockers',
  );
  ok(
    blocked.reasonCodes.includes('data-unit-not-allowed:operator-supplied-aggregate-impact'),
    'Data minimization policy: dashboard-only impact units are not allowed in audit export',
  );
}

function testMaterialSafetyFindingsUsePolicyForbiddenClasses(): void {
  const findings = consequenceDataMinimizationMaterialSafetyFindings({
    findingSubject: 'telemetry',
    material: JSON.stringify({
      body: 'release-token=raw token must not leave the runtime',
      attributes: {
        customerMarker: 'raw_customer_value_must_not_escape',
        rawPayloadStored: true,
        forbiddenClass: 'raw-bank-or-payment-data',
      },
    }),
  });

  ok(
    findings.some((finding) => finding.includes('release-token=')),
    'Data minimization policy: runtime token markers are detected centrally',
  );
  ok(
    findings.some((finding) => finding.includes('raw-bank-or-payment-data')),
    'Data minimization policy: forbidden raw classes are detected centrally',
  );
  ok(
    findings.some((finding) => finding.includes('raw payload marker')),
    'Data minimization policy: raw must-not-escape markers are detected centrally',
  );
  ok(
    findings.some((finding) => finding.includes('raw payload storage')),
    'Data minimization policy: raw payload storage declarations are detected centrally',
  );
}

function testExistingDescriptorsBindToPolicyVersion(): void {
  const admission = consequenceAdmissionDescriptor();
  const auditExport = consequenceAuditEvidenceExportDescriptor();
  const dashboard = consequenceBusinessRiskDashboardDescriptor();
  const dashboardApiSummary = consequenceDashboardApiSummaryDescriptor();
  const externalReview = consequenceExternalReviewPacketDescriptor();

  equal(
    admission.dataMinimizationPolicyVersion,
    CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    'Data minimization policy: admission descriptor exposes policy version',
  );
  ok(
    admission.dataMinimizationSurfaceKinds.includes('downstream-execution-receipt'),
    'Data minimization policy: admission descriptor exposes receipt surface',
  );
  ok(
    admission.dataMinimizationForbiddenRawClasses.includes('raw-idempotency-key'),
    'Data minimization policy: admission descriptor exposes raw idempotency key ban',
  );
  equal(
    auditExport.dataMinimizationPolicyVersion,
    CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    'Data minimization policy: audit export descriptor binds policy version',
  );
  equal(
    dashboard.dataMinimizationPolicyVersion,
    CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    'Data minimization policy: dashboard descriptor binds policy version',
  );
  equal(
    dashboardApiSummary.dataMinimizationPolicyVersion,
    CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    'Data minimization policy: dashboard API summary descriptor binds policy version',
  );
  equal(
    externalReview.dataMinimizationPolicyVersion,
    CONSEQUENCE_DATA_MINIMIZATION_REDACTION_POLICY_VERSION,
    'Data minimization policy: external review packet descriptor binds policy version',
  );
  equal(auditExport.rawPayloadStored, false, 'Data minimization policy: audit export remains raw-payload-free');
  equal(dashboard.rawPayloadStored, false, 'Data minimization policy: dashboard remains raw-payload-free');
  equal(dashboardApiSummary.rawPayloadStored, false, 'Data minimization policy: dashboard API summary remains raw-payload-free');
  equal(externalReview.rawPayloadStored, false, 'Data minimization policy: external review packet remains raw-payload-free');
}

function testDocsAndScriptsExposePolicy(): void {
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    readme,
    'docs/02-architecture/data-minimization-redaction-policy.md',
    'Data minimization policy: README links architecture doc',
  );
  includes(
    readme,
    'raw prompts, raw tool payloads, raw customer identifiers',
    'Data minimization policy: README names forbidden raw classes',
  );
  includes(
    doc,
    'dashboard-api-summary',
    'Data minimization policy: doc lists dashboard API summary surface',
  );
  includes(
    doc,
    'external-review-packet',
    'Data minimization policy: doc lists external review packet surface',
  );
  includes(
    doc,
    'Model-safe feedback is not training data',
    'Data minimization policy: doc separates feedback from training',
  );
  includes(
    doc,
    'raw bank or payment data',
    'Data minimization policy: doc forbids raw bank/payment data',
  );
  includes(
    doc,
    'Problem details are for HTTP interface detail, not implementation debugging internals',
    'Data minimization policy: doc captures problem details boundary',
  );
  includes(
    systemOverview,
    '[Data minimization and redaction policy](data-minimization-redaction-policy.md)',
    'Data minimization policy: system overview links doc',
  );
  equal(
    packageJson.scripts['test:data-minimization-redaction-policy'],
    'tsx tests/data-minimization-redaction-policy.test.ts',
    'Data minimization policy: focused script is exposed',
  );
}

testDescriptorCoversCriticalSurfaces();
testEvaluationAllowsOnlySurfaceSpecificUnits();
testMaterialSafetyFindingsUsePolicyForbiddenClasses();
testExistingDescriptorsBindToPolicyVersion();
testDocsAndScriptsExposePolicy();

console.log(`Data minimization redaction policy tests: ${passed} passed, 0 failed`);
