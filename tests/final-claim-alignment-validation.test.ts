import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to include: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

function testReadmePublicClaimBoundary(): void {
  const readme = readProjectFile('README.md');
  const docsFrontDoor = readProjectFile('docs', 'README.md');

  includes(
    readme,
    '**A gate for high-risk AI actions.**',
    'Final claim alignment: README keeps control infrastructure headline',
  );
  includes(
    readme,
    'Attestor sits between what an AI wants to do and the system that would do it.',
    'Final claim alignment: README keeps primary placement sentence',
  );
  includes(
    readme,
    'It controls the proposed action before a customer system acts.',
    'Final claim alignment: README keeps proposed-action control sentence',
  );
  includes(readme, 'evaluation release', 'Final claim alignment: README keeps evaluation-release status');
  includes(
    readme,
    'not a finished public SaaS, a production-use guarantee, a completed customer-operated deployment, or a substitute for an external security audit',
    'Final claim alignment: README keeps production/audit non-claim',
  );
  includes(
    readme,
    'These links are context anchors, not compliance claims.',
    'Final claim alignment: README keeps regulatory-anchor non-claim boundary',
  );
  includes(
    docsFrontDoor,
    '[Audit remediation tracker](audit/attestor-audit-remediation-tracker.md)',
    'Final claim alignment: docs front door links remediation tracker',
  );
}

function testFinalAuditDocsCloseQueueWithoutOverclaim(): void {
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const finalDoc = readProjectFile('docs', 'audit', 'final-claim-alignment-validation.md');
  const provenance = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');

  includes(
    tracker,
    'Remaining work after the final claim-alignment slice: 0 planned',
    'Final claim alignment: tracker has zero planned F1-F5 units',
  );
  includes(
    tracker,
    'FINAL-1 README / public docs claim alignment | `fixed`',
    'Final claim alignment: tracker closes README/docs row',
  );
  includes(
    tracker,
    'FINAL-2 research provenance / remediation ledger sync | `fixed`',
    'Final claim alignment: tracker closes provenance row',
  );
  includes(
    tracker,
    'PR #327',
    'Final claim alignment: tracker records the latest prior merged PR',
  );
  includes(
    finalDoc,
    'Claims Explicitly Not Made',
    'Final claim alignment: final validation doc lists non-claims',
  );
  includes(
    finalDoc,
    'Remaining planned units in the current F1-F5 queue: 0',
    'Final claim alignment: final validation doc records queue closure',
  );
  includes(
    provenance,
    '### 18. F1-F5 Audit Remediation Closure',
    'Final claim alignment: provenance ledger records F1-F5 closure',
  );
  includes(
    provenance,
    'PR #327 merge commit `e4bca21903df7dd7ce144aefc5c7aebc559387e8`',
    'Final claim alignment: provenance ledger records PR #327 merge commit',
  );
}

function testOverclaimLanguageIsNarrowed(): void {
  const adapterFramework = readProjectFile('docs', '02-architecture', 'adapter-framework.md');
  const cryptoBuildout = readProjectFile('docs', '02-architecture', 'crypto-authorization-core-buildout.md');
  const f1Validation = readProjectFile('docs', 'audit', 'f1-threat-model-foundation-validation.md');
  const finalDoc = readProjectFile('docs', 'audit', 'final-claim-alignment-validation.md');
  const packageJson = readProjectFile('package.json');

  excludes(
    adapterFramework,
    /production-grade customer edges/iu,
    'Final claim alignment: adapter framework avoids production-grade customer-edge claim',
  );
  excludes(
    cryptoBuildout,
    /chain-authoritative adapter nonce checks/iu,
    'Final claim alignment: crypto authorization docs avoid chain-authoritative adapter claim',
  );
  excludes(
    f1Validation,
    /production-grade evidence packets/iu,
    'Final claim alignment: F1 validation avoids production-grade evidence-packet claim',
  );
  includes(
    cryptoBuildout,
    'adapter-provided nonce evidence',
    'Final claim alignment: crypto authorization docs keep adapter evidence boundary',
  );
  includes(
    finalDoc,
    'chain-authoritative crypto verification without verifiable adapter evidence',
    'Final claim alignment: final doc records crypto authority non-claim',
  );
  includes(
    packageJson,
    '"test:final-claim-alignment-validation"',
    'Final claim alignment: package script is exposed',
  );
}

testReadmePublicClaimBoundary();
testFinalAuditDocsCloseQueueWithoutOverclaim();
testOverclaimLanguageIsNarrowed();

console.log(`Final claim alignment validation tests: ${passed} passed, 0 failed`);
