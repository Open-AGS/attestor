import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGenericAdmissionEnvelope,
  type ConsequenceAdmissionDomain,
} from '../src/consequence-admission/index.js';

let passed = 0;

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

function extractJsonBlocks(content: string): readonly unknown[] {
  return [...content.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/gu)].map((match) =>
    JSON.parse(match[1] ?? 'null'),
  );
}

const doc = readProjectFile('docs', '01-overview', 'shadow-event-payload-examples.md');
const readme = readProjectFile('README.md');
const packageJson = JSON.parse(readProjectFile('package.json')) as {
  readonly scripts: Record<string, string>;
};
const payloads = extractJsonBlocks(doc);

function testExamplesAreGenericObserveModeAdmissions(): void {
  assert.equal(payloads.length, 5, 'Docs expose exactly five copy-paste JSON examples');
  passed += 1;

  const domains = new Set<ConsequenceAdmissionDomain>();
  for (const payload of payloads) {
    assert.equal(typeof payload, 'object', 'Each JSON example parses to an object');
    assert.notEqual(payload, null, 'Each JSON example is non-null');
    const record = payload as Record<string, unknown>;
    assert.equal(record.mode, 'observe', 'Each example starts in observe mode');
    assert.equal(typeof record.policyRef, 'string', 'Each example names a policy reference');
    assert.ok(Array.isArray(record.evidenceRefs), 'Each example sends evidence references');
    assert.ok(
      (record.evidenceRefs as readonly unknown[]).length > 0,
      'Each example has at least one evidence reference',
    );

    const envelope = createGenericAdmissionEnvelope(payload);
    assert.equal(envelope.mode, 'observe', 'Each example is accepted by the generic admission envelope');
    assert.equal(
      envelope.admission.request.entryPoint.route,
      '/api/v1/admissions',
      'Examples compile against the shipped generic admission route',
    );
    assert.equal(
      envelope.admission.operationalContext?.nonEnforcingMode,
      true,
      'Examples remain non-enforcing shadow evidence',
    );
    domains.add(record.domain as ConsequenceAdmissionDomain);
    passed += 7;
  }

  assert.deepEqual(
    [...domains].sort(),
    [
      'data-disclosure',
      'external-communication',
      'money-movement',
      'programmable-money',
      'system-operation',
    ],
    'Examples cover refund, export, deploy, message, and wallet domains',
  );
  passed += 1;
}

function testDocsExplainTheCorrectBoundary(): void {
  includes(doc, '# Run Attestor In Shadow Pilot Mode', 'Docs use the shadow pilot title');
  includes(doc, 'Run Attestor in shadow pilot mode - and map what your AI agents are trying to', 'Docs carry the shadow pilot value line');
  includes(doc, '## Start Here', 'Docs organize payloads behind a start-here table');
  includes(doc, 'POST /api/v1/admissions', 'Docs point users to the shipped generic admission route');
  includes(doc, 'This page does not define a separate public `/shadow-events` ingest', 'Docs do not invent a shadow ingest route');
  includes(doc, 'Use `mode: "observe"` first.', 'Docs start with shadow mode');
  includes(doc, 'opaque references and digests', 'Docs teach reference-based evidence');
  includes(doc, 'Attestor does not sign or broadcast', 'Docs keep programmable-money no-claim');
  includes(doc, 'operationalContext.nonEnforcingMode', 'Docs show how to read non-enforcing mode');
  includes(readme, 'docs/01-overview/shadow-event-payload-examples.md', 'README links shadow event payload examples');
}

function testDocsCarrySourceAnchorsAndSupportLinks(): void {
  includes(doc, 'https://github.com/cloudevents/spec', 'Docs cite CloudEvents source anchor');
  includes(doc, 'https://opentelemetry.io/docs/specs/otel/logs/data-model/', 'Docs cite OpenTelemetry source anchor');
  includes(doc, 'https://www.w3.org/TR/prov-dm/', 'Docs cite W3C PROV source anchor');
  includes(doc, 'https://www.openpolicyagent.org/docs/management-decision-logs', 'Docs cite OPA decision-log source anchor');
  includes(doc, '../05-proof/reason-codes.md', 'Docs link reason-code support docs');
  includes(doc, '../05-proof/failure-modes-and-controls.md', 'Docs link failure-mode support docs');
}

function testDocsDoNotExposeSensitiveOrOverclaimedMaterial(): void {
  excludes(doc, /\bsk_(live|test)_[A-Za-z0-9_]+/u, 'Docs do not expose Stripe secret keys');
  excludes(doc, /\brk_(live|test)_[A-Za-z0-9_]+/u, 'Docs do not expose Stripe restricted keys');
  excludes(doc, /\bwhsec_[A-Za-z0-9_]+/u, 'Docs do not expose webhook secrets');
  excludes(doc, /\bBearer\s+(?!<redacted>)[A-Za-z0-9._-]+/u, 'Docs do not expose bearer tokens');
  excludes(doc, /-----BEGIN [A-Z ]*PRIVATE KEY-----/u, 'Docs do not expose private keys');
  excludes(doc, /0x[a-fA-F0-9]{40}/u, 'Docs do not expose raw wallet addresses');
  includes(doc, 'Do not send raw prompts', 'Docs explicitly forbid raw prompts');
  excludes(doc, /production-ready/iu, 'Docs avoid production-ready claim wording');
  excludes(doc, /enterprise-grade/iu, 'Docs avoid enterprise marketing language');
}

function testPackageScriptIsExposed(): void {
  assert.equal(
    packageJson.scripts['test:shadow-event-payload-examples-docs'],
    'tsx tests/shadow-event-payload-examples-docs.test.ts',
    'Package exposes shadow event payload examples docs test',
  );
  passed += 1;
}

testExamplesAreGenericObserveModeAdmissions();
testDocsExplainTheCorrectBoundary();
testDocsCarrySourceAnchorsAndSupportLinks();
testDocsDoNotExposeSensitiveOrOverclaimedMaterial();
testPackageScriptIsExposed();

console.log(`Shadow event payload examples docs tests: ${passed} passed, 0 failed`);
