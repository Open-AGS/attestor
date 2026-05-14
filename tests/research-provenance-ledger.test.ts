import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function projectPath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}

function projectRef(...segments: string[]): string {
  return segments.join('/');
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(projectPath(...segments), 'utf8').replace(/\r\n/gu, '\n');
}

function listMarkdownFiles(...segments: string[]): readonly string[] {
  return readdirSync(projectPath(...segments))
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();
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

function ledger(): string {
  return readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
}

function testLedgerIndexesAllResearchNotes(): void {
  const content = ledger();

  for (const fileName of listMarkdownFiles('docs', 'research')) {
    if (fileName === 'attestor-research-provenance-ledger.md') {
      continue;
    }

    includes(
      content,
      projectRef('docs', 'research', fileName),
      `Research provenance ledger: indexed research note ${fileName}`,
    );
  }
}

function testLedgerIndexesArchitectureResearchTrackers(): void {
  const content = ledger();

  for (const fileName of listMarkdownFiles('docs', '02-architecture')) {
    const tracker = readProjectFile('docs', '02-architecture', fileName);
    if (!/research anchors?/iu.test(tracker)) {
      continue;
    }

    includes(
      content,
      projectRef('docs', '02-architecture', fileName),
      `Research provenance ledger: indexed architecture research tracker ${fileName}`,
    );
  }
}

function testLedgerIndexesHostedAuditEvidence(): void {
  includes(
    ledger(),
    'docs/01-overview/hosted-product-flow-audit.md',
    'Research provenance ledger: indexed hosted product flow audit evidence',
  );
}

function testLedgerIndexesAuditRemediationClosure(): void {
  const content = ledger();

  includes(
    content,
    '### 18. F1-F5 Audit Remediation Closure',
    'Research provenance ledger: final F1-F5 closure entry is present',
  );
  includes(
    content,
    'PR #326 merge commit `7029ea2afeec41a3afe29b9359dbdf2f844bfc99`',
    'Research provenance ledger: PR #326 merge evidence is recorded',
  );
  includes(
    content,
    'PR #327 merge commit `e4bca21903df7dd7ce144aefc5c7aebc559387e8`',
    'Research provenance ledger: PR #327 merge evidence is recorded',
  );
  includes(
    content,
    'docs/audit/final-claim-alignment-validation.md',
    'Research provenance ledger: final claim-alignment doc is indexed',
  );
  includes(
    content,
    'tests/final-claim-alignment-validation.test.ts',
    'Research provenance ledger: final claim-alignment test is indexed',
  );
  includes(
    content,
    'does not prove external compliance certification',
    'Research provenance ledger: final closure keeps certification non-claim explicit',
  );
}

function testLedgerKeepsEvidenceBoundaryExplicit(): void {
  const content = ledger();

  includes(
    content,
    'It is not a certification, not an independent external audit, and not a claim of full production readiness.',
    'Research provenance ledger: opening disclaimer stays explicit',
  );
  includes(
    content,
    'It does not invent sources.',
    'Research provenance ledger: source non-invention rule stays explicit',
  );
  includes(
    content,
    'not expanded rather than invented',
    'Research provenance ledger: source-to-commit attribution gaps stay explicit',
  );
  excludes(content, /\bproduction-ready\b/iu, 'Research provenance ledger: avoids production-ready claim language');
  excludes(content, /\bsale-ready\b/iu, 'Research provenance ledger: avoids sale-ready claim language');
  excludes(content, /\bpurchasable\b/iu, 'Research provenance ledger: avoids purchasable claim language');
}

function testLedgerDoesNotExposeLiveSecrets(): void {
  const content = ledger();

  excludes(content, /rk_live_/u, 'Research provenance ledger: no live restricted key prefix');
  excludes(content, /sk_live_/u, 'Research provenance ledger: no live secret key prefix');
  excludes(content, /whsec_/u, 'Research provenance ledger: no webhook secret prefix');
  excludes(content, /STRIPE_API_KEY\s*=/u, 'Research provenance ledger: no assigned Stripe API key');
  excludes(content, /STRIPE_WEBHOOK_SECRET\s*=/u, 'Research provenance ledger: no assigned Stripe webhook secret');
}

testLedgerIndexesAllResearchNotes();
testLedgerIndexesArchitectureResearchTrackers();
testLedgerIndexesHostedAuditEvidence();
testLedgerIndexesAuditRemediationClosure();
testLedgerKeepsEvidenceBoundaryExplicit();
testLedgerDoesNotExposeLiveSecrets();

console.log(`Research provenance ledger tests: ${passed} passed, 0 failed`);
