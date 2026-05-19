import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ingestActionSurfaceManifestText,
} from '../src/consequence-admission/action-surface-manifest-intake.js';

let passed = 0;

type JsonRecord = Record<string, unknown>;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function asRecord(value: unknown, message: string): JsonRecord {
  assert.ok(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    message,
  );
  passed += 1;
  return value as JsonRecord;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function arrayIncludes<T>(items: readonly T[], expected: T, message: string): void {
  assert.ok(
    items.includes(expected),
    `${message}\nExpected to find: ${String(expected)}`,
  );
  passed += 1;
}

function requestSchemaFor(manifest: JsonRecord, path: string): JsonRecord {
  const paths = asRecord(manifest.paths, 'Refund OpenAPI: paths object exists');
  const pathItem = asRecord(paths[path], `Refund OpenAPI: ${path} path exists`);
  const post = asRecord(pathItem.post, `Refund OpenAPI: ${path} POST exists`);
  const requestBody = asRecord(post.requestBody, `Refund OpenAPI: ${path} request body exists`);
  const content = asRecord(requestBody.content, `Refund OpenAPI: ${path} request content exists`);
  const json = asRecord(content['application/json'], `Refund OpenAPI: ${path} JSON content exists`);
  return asRecord(json.schema, `Refund OpenAPI: ${path} schema exists`);
}

function propertiesFor(schema: JsonRecord, path: string): JsonRecord {
  return asRecord(schema.properties, `Refund OpenAPI: ${path} schema properties exist`);
}

function requiredFor(schema: JsonRecord): readonly string[] {
  assert.ok(Array.isArray(schema.required), 'Refund OpenAPI: required list exists');
  passed += 1;
  return schema.required as readonly string[];
}

function testManifestDeclaresGoldenPathBoundary(): void {
  const manifest = JSON.parse(readProjectFile(
    'examples',
    'action-surface-onboarding',
    'refund.openapi.json',
  )) as JsonRecord;

  equal(manifest.openapi, '3.1.0', 'Refund OpenAPI: keeps OpenAPI 3.1.0');
  const info = asRecord(manifest.info, 'Refund OpenAPI: info exists');
  equal(info.version, '1.1.0', 'Refund OpenAPI: G02 version is recorded');
  includes(
    JSON.stringify(info),
    'Synthetic refund action surface for Attestor Golden Path: Refund',
    'Refund OpenAPI: description names the golden path',
  );

  const extension = asRecord(
    manifest['x-attestor-golden-path'],
    'Refund OpenAPI: Attestor golden path extension exists',
  );
  equal(extension.name, 'Golden Path: Refund', 'Refund OpenAPI: extension names the path');
  equal(extension.step, 'G02', 'Refund OpenAPI: extension records G02');
  equal(extension.shadowOnly, true, 'Refund OpenAPI: extension is shadow-only');
  equal(extension.rawPayloadStored, false, 'Refund OpenAPI: extension forbids raw payload storage');
  equal(extension.autoEnforce, false, 'Refund OpenAPI: extension forbids auto enforcement');
  equal(extension.productionReady, false, 'Refund OpenAPI: extension avoids production readiness');

  const requiredEvidenceRefs = extension.requiredEvidenceRefs as readonly string[];
  for (const expected of [
    'orderEvidenceRefDigest',
    'paymentEvidenceRefDigest',
    'customerAuthorityRefDigest',
    'policyCandidateRefDigest',
  ]) {
    arrayIncludes(requiredEvidenceRefs, expected, `Refund OpenAPI: extension requires ${expected}`);
  }
}

function testIssueRefundRequiresEvidenceAndPriorRefundSignal(): void {
  const manifest = JSON.parse(readProjectFile(
    'examples',
    'action-surface-onboarding',
    'refund.openapi.json',
  )) as JsonRecord;
  const schema = requestSchemaFor(manifest, '/refunds');
  const properties = propertiesFor(schema, '/refunds');
  const required = requiredFor(schema);

  for (const expected of [
    'orderRefDigest',
    'requestedAmount',
    'refundReason',
    'refundMethod',
    'orderEvidenceRefDigest',
    'paymentEvidenceRefDigest',
    'customerAuthorityRefDigest',
    'policyCandidateRefDigest',
    'priorRefundSignal',
  ]) {
    arrayIncludes(required, expected, `Refund OpenAPI: issueRefund requires ${expected}`);
  }

  const refundReason = asRecord(properties.refundReason, 'Refund OpenAPI: refundReason exists');
  const refundReasonEnum = refundReason.enum as readonly string[];
  for (const expected of [
    'duplicate',
    'fraudulent',
    'requested_by_customer',
    'service_failure',
    'policy_exception',
  ]) {
    arrayIncludes(refundReasonEnum, expected, `Refund OpenAPI: refundReason includes ${expected}`);
  }

  const refundMethod = asRecord(properties.refundMethod, 'Refund OpenAPI: refundMethod exists');
  const refundMethodEnum = refundMethod.enum as readonly string[];
  for (const expected of [
    'original_payment_method',
    'store_credit',
    'manual_review_only',
  ]) {
    arrayIncludes(refundMethodEnum, expected, `Refund OpenAPI: refundMethod includes ${expected}`);
  }

  const priorRefundSignal = asRecord(
    properties.priorRefundSignal,
    'Refund OpenAPI: priorRefundSignal exists',
  );
  const priorRequired = requiredFor(priorRefundSignal);
  for (const expected of [
    'hasPriorRefundWithinWindow',
    'priorRefundCountClass',
    'priorRefundEvidenceRefDigest',
  ]) {
    arrayIncludes(priorRequired, expected, `Refund OpenAPI: priorRefundSignal requires ${expected}`);
  }

  includes(
    JSON.stringify(priorRefundSignal),
    'confirms/escalates',
    'Refund OpenAPI: prior refund signal bridges to relationship material',
  );
}

function testApprovalRouteCarriesReviewEvidenceOnly(): void {
  const manifest = JSON.parse(readProjectFile(
    'examples',
    'action-surface-onboarding',
    'refund.openapi.json',
  )) as JsonRecord;
  const schema = requestSchemaFor(manifest, '/refunds/{refundId}/approve');
  const properties = propertiesFor(schema, '/refunds/{refundId}/approve');
  const required = requiredFor(schema);

  for (const expected of [
    'reviewerRefDigest',
    'approvalRefDigest',
    'reviewPacketRefDigest',
    'evidenceReviewedDigest',
    'decision',
  ]) {
    arrayIncludes(required, expected, `Refund OpenAPI: approveRefund requires ${expected}`);
  }

  const decision = asRecord(properties.decision, 'Refund OpenAPI: approval decision exists');
  const decisionEnum = decision.enum as readonly string[];
  for (const expected of [
    'approve_for_shadow_pilot',
    'request_more_evidence',
    'reject',
  ]) {
    arrayIncludes(decisionEnum, expected, `Refund OpenAPI: approval decision includes ${expected}`);
  }

  excludes(
    JSON.stringify(manifest),
    /customerName|customerEmail|cardNumber|paymentIntentId|stripeChargeId|shopifyOrderId/iu,
    'Refund OpenAPI: manifest avoids raw customer/payment/order identifiers',
  );
}

function testManifestStillRendersThroughActionSurfaceIntake(): void {
  const text = readProjectFile(
    'examples',
    'action-surface-onboarding',
    'refund.openapi.json',
  );
  const intake = ingestActionSurfaceManifestText(text, {
    sourceRef: 'examples/action-surface-onboarding/refund.openapi.json',
    manifestKind: 'openapi',
    downstreamSystem: 'refund-service',
    defaultDomain: 'money-movement',
    credentialPosture: 'agent-held-static-secret',
  });

  equal(intake.manifestKind, 'openapi', 'Refund OpenAPI: manifest intake detects OpenAPI');
  equal(intake.declarationCount, 2, 'Refund OpenAPI: two write operations remain declared');
  equal(intake.approvalRequired, true, 'Refund OpenAPI: intake keeps approval required');
  equal(intake.autoEnforce, false, 'Refund OpenAPI: intake keeps auto enforcement disabled');
  equal(intake.rawPayloadStored, false, 'Refund OpenAPI: intake keeps raw payload storage disabled');
  equal(intake.productionReady, false, 'Refund OpenAPI: intake avoids production readiness');
  ok(
    intake.declarations.some((item) => item.actionSurface === 'refund_service.issue_refund'),
    'Refund OpenAPI: issueRefund action surface remains stable',
  );
  ok(
    intake.declarations.some((item) => item.actionSurface === 'refund_service.approve_refund'),
    'Refund OpenAPI: approveRefund action surface remains stable',
  );
}

function testDocsAndScriptsRecordG02(): void {
  const goldenPath = readProjectFile(
    'docs',
    '02-architecture',
    'golden-refund-shadow-pilot.md',
  );
  const exampleReadme = readProjectFile('examples', 'action-surface-onboarding', 'README.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Status: complete',
    'Progress after G08 lands: 8/8 complete. 0 steps remain.',
    '| G02 | complete | Refund OpenAPI enrichment |',
    'G02 adds the prior refund signal',
  ]) {
    includes(goldenPath, expected, `Golden refund path doc: records ${expected}`);
  }
  includes(exampleReadme, 'Golden Path: Refund G02 action surface', 'Example README: records G02');
  includes(ledger, 'G02 enriches the repo-side refund OpenAPI surface', 'Research ledger: records G02');
  equal(
    packageJson.scripts['test:golden-refund-openapi'],
    'tsx tests/golden-refund-openapi.test.ts',
    'Package scripts: exposes G02 OpenAPI test',
  );
}

testManifestDeclaresGoldenPathBoundary();
testIssueRefundRequiresEvidenceAndPriorRefundSignal();
testApprovalRouteCarriesReviewEvidenceOnly();
testManifestStillRendersThroughActionSurfaceIntake();
testDocsAndScriptsRecordG02();

console.log(`Golden Path: Refund OpenAPI tests passed (${passed} assertions)`);

