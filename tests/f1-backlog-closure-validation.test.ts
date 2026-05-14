import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceDataMinimizationRedactionPolicyDescriptor,
  consequenceReplayLayerPlacementDescriptor,
  consequenceTamperEvidentHistoryDescriptor,
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

function excludes(value: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(value, unexpected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

try {
  const validation = readProjectFile('docs', 'audit', 'f1-backlog-closure-validation.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const replayDoc = readProjectFile('docs', '02-architecture', 'replay-layer-placement.md');
  const retryDoc = readProjectFile('docs', '02-architecture', 'retry-attempt-ledger.md');
  const presentationReplayDoc = readProjectFile('docs', '02-architecture', 'presentation-replay-ledger.md');
  const tamperDoc = readProjectFile('docs', '02-architecture', 'tamper-evident-history.md');
  const packageJson = readProjectFile('package.json');

  const replayDescriptor = consequenceReplayLayerPlacementDescriptor();
  const minimizationDescriptor = consequenceDataMinimizationRedactionPolicyDescriptor();
  const historyDescriptor = consequenceTamperEvidentHistoryDescriptor();

  includes(validation, 'F1-CC-3 cross-vector replay correlation', 'F1 validation: CC-3 is named');
  includes(validation, 'F1-CC-4 data-minimization fan-out', 'F1 validation: CC-4 is named');
  includes(validation, 'F1-CC-6 cross-log integrity anchor', 'F1 validation: CC-6 is named');
  includes(validation, 'common digest-only replay correlation event', 'F1 validation: replay next shape is explicit');
  includes(validation, '`assertDataMinimizedSurface(...)`', 'F1 validation: data minimization next helper is explicit');
  includes(validation, 'Accepted limitation', 'F1 validation: cross-log limitation is explicit');
  includes(validation, 'NIST SP 800-92', 'F1 validation: NIST log-management source is cited');
  includes(validation, 'OWASP Logging Cheat Sheet', 'F1 validation: OWASP logging source is cited');
  includes(validation, 'Stripe idempotency guidance', 'F1 validation: Stripe idempotency source is cited');
  includes(validation, 'RFC 9162', 'F1 validation: transparency-log source is cited');

  includes(
    replayDoc,
    'It is not a production-readiness claim',
    'F1 replay: replay placement avoids production overclaim',
  );
  ok(
    replayDescriptor.surfaces.some((surface) => surface.kind === 'presentation-replay-consumption'),
    'F1 replay: presentation replay surface is in descriptor',
  );
  ok(
    replayDescriptor.surfaces.some((surface) => surface.kind === 'sandbox-downstream-replay'),
    'F1 replay: sandbox replay surface is in descriptor',
  );
  includes(retryDoc, 'shared-store contract', 'F1 replay: retry ledger shared-store contract is documented');
  includes(
    presentationReplayDoc,
    'single-use replay consumption rule',
    'F1 replay: presentation replay consumption is documented',
  );

  ok(
    minimizationDescriptor.surfaceKinds.length >= 34,
    'F1 data minimization: descriptor has broad surface inventory',
  );
  ok(
    minimizationDescriptor.runtimeSecretMarkers.includes('private_key'),
    'F1 data minimization: runtime secret markers are present',
  );
  ok(
    minimizationDescriptor.promptLeakageMarkers.includes('system_prompt'),
    'F1 data minimization: prompt leakage markers are present',
  );
  equal(
    minimizationDescriptor.productionReady,
    false,
    'F1 data minimization: descriptor does not claim production readiness',
  );

  includes(
    tamperDoc,
    'evaluation-grade linear hash chain',
    'F1 cross-log: tamper history boundary is documented',
  );
  equal(historyDescriptor.chainMode, 'linear-hash-chain', 'F1 cross-log: descriptor exposes linear chain mode');
  equal(historyDescriptor.storesRawPayloads, false, 'F1 cross-log: history is raw-payload-free');
  equal(
    historyDescriptor.merkleTransparencyLogIncluded,
    false,
    'F1 cross-log: history does not claim Merkle transparency log',
  );
  includes(
    tamperDoc,
    'external immutability is still not claimed',
    'F1 cross-log: docs avoid external immutability claim',
  );

  includes(
    tracker,
    'Remaining work after the final claim-alignment slice: 0 planned',
    'F1 tracker: final remaining work count is updated',
  );
  includes(tracker, '#326', 'F1 tracker: previous PR #326 is recorded');
  includes(
    tracker,
    'F1-CC-3 cross-vector replay correlation | `backlog` | F1 Backlog Closure Validation',
    'F1 tracker: CC-3 is closed as qualified backlog',
  );
  includes(
    tracker,
    'F1-CC-4 data-minimization fan-out | `backlog` | F1 Backlog Closure Validation',
    'F1 tracker: CC-4 is closed as qualified backlog',
  );
  includes(
    tracker,
    'F1-CC-6 cross-log integrity anchor | `accepted-limitation` | F1 Backlog Closure Validation',
    'F1 tracker: CC-6 is closed as accepted limitation',
  );
  includes(
    packageJson,
    '"test:f1-backlog-closure-validation"',
    'F1 package: closure validation script is exposed',
  );
  excludes(
    validation,
    /\b(certification|certified|production-ready|fully solved|universal cross-vector replay)\b/iu,
    'F1 validation: avoids certification and universal-replay overclaims',
  );

  console.log(`F1 backlog closure validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F1 backlog closure validation tests failed:', error);
  process.exitCode = 1;
}
