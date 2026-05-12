import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function projectPath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(projectPath(...segments), 'utf8').replace(/\r\n/gu, '\n');
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

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function assertFileExists(path: string, message: string): void {
  ok(existsSync(projectPath(...path.split('/'))), message);
}

function packageJson(): {
  readonly scripts: Readonly<Record<string, string>>;
} {
  return JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
}

function testRootAgentGuidanceKeepsCoreContract(): void {
  const agents = readProjectFile('AGENTS.md');

  includes(agents, '# AGENTS.md - Attestor Agent Guidance', 'Agent guidance: root title stays stable');
  includes(agents, 'Attestor is an acceptance, proof, and control layer for AI-driven actions before they become real-world consequences.', 'Agent guidance: project identity stays explicit');
  includes(agents, 'Inspect repository evidence first.', 'Agent guidance: repository evidence comes before implementation');
  includes(agents, 'Identify the affected trust surface and protected principle.', 'Agent guidance: trust surface and principle mapping stays required');
  includes(agents, 'Use primary or official external anchors when the change touches security, privacy, billing, infrastructure, provenance, AI-agent authority, or production readiness.', 'Agent guidance: research-backed change trigger stays explicit');
  includes(agents, 'Add or update regression tests when behavior changes.', 'Agent guidance: behavior changes require regression tests');
  includes(agents, 'State limitations and no-go conditions explicitly.', 'Agent guidance: limitations and no-go conditions stay explicit');
  includes(agents, 'If evidence is missing, say `not proven`, not `broken`.', 'Agent guidance: missing evidence wording stays exact');
}

function testProtectedPrinciplesStayComplete(): void {
  const agents = readProjectFile('AGENTS.md');

  for (const principle of [
    'proof integrity',
    'fail-closed boundary',
    'tenant isolation',
    'customer authority',
    'data minimization and redaction',
    'no overclaim',
    'runtime readiness',
    'release provenance',
    'auditability',
    'replay and idempotency safety',
    'operational boundedness',
  ]) {
    includes(agents, `- ${principle}`, `Agent guidance: protected principle is present: ${principle}`);
  }
}

function testEvidenceAndDoNotRulesStayConcrete(): void {
  const agents = readProjectFile('AGENTS.md');

  for (const expected of [
    '- protected principle',
    '- external or research anchor',
    '- repository evidence',
    '- risk being closed',
    '- smallest safe fix',
    '- regression test or verification command',
    '- limitation or no-go if evidence remains incomplete',
    'Green tests alone are not enough for trust-sensitive work.',
    'Do not overclaim production readiness, compliance, audit completion, security posture, SLSA level, live billing readiness, or deployment maturity.',
    'Do not weaken fail-closed behavior.',
    'Do not replace deterministic controls with model judgment.',
    'Do not put private financial, billing, or operator-specific blockers into public repository docs.',
    'For audit findings, validate before fixing.',
    'Mark unsupported findings as `disputed`, `duplicate`, `out-of-scope`, `blocked`, or `accepted limitation`',
    'docs/audit/ledger-template.md',
  ]) {
    includes(agents, expected, `Agent guidance: concrete rule remains present: ${expected}`);
  }

  includes(
    agents,
    'raw prompts, credentials, customer identifiers, tenant ids, webhook bodies, payment data, wallet material, IP addresses, user agents, provider bodies, downstream error bodies, or private thresholds',
    'Agent guidance: sensitive-output ban stays broad and concrete',
  );
}

function testAuditFindingHandlingStaysOperational(): void {
  const coldAudit = readProjectFile('docs', 'ai', 'playbooks', 'cold-audit.md');
  const ledger = readProjectFile('docs', 'audit', 'ledger-template.md');
  const f1Validation = readProjectFile('docs', 'audit', 'f1-threat-model-foundation-validation.md');

  for (const expected of [
    'Classify each issue as confirmed, disputed, duplicate, out-of-scope, fixed, blocked, or accepted limitation.',
    'Validation evidence:',
    'Dispute rationale:',
    'Research anchors for fix:',
    'If evidence is incomplete, say `not proven`.',
  ]) {
    includes(coldAudit, expected, `Agent guidance: cold-audit playbook preserves audit validation rule: ${expected}`);
  }

  for (const expected of [
    '## Audit Run Header',
    'Status: open | confirmed | disputed | duplicate | out-of-scope | fixed | blocked | accepted limitation',
    'Do not implement a fix from a finding until the finding is validated against repository evidence.',
    'A finding is not fixed until the fix is merged and the verification evidence is recorded.',
  ]) {
    includes(ledger, expected, `Agent guidance: audit ledger preserves finding lifecycle rule: ${expected}`);
  }

  for (const expected of [
    '# F1 Threat Model Foundation Validation',
    'CC-1 | refined',
    'CC-5 | confirmed',
    'This remediation slice fixes the confirmed CC-5 tenant mismatch issue and the refined CC-1 shared guard runtime path.',
    'CC-2, CC-3, CC-4, and CC-6 are not closed by this document.',
  ]) {
    includes(f1Validation, expected, `Agent guidance: F1 validation ledger preserves status: ${expected}`);
  }
}

function testVerificationAndPlaybookReferencesStayUsable(): void {
  const agents = readProjectFile('AGENTS.md');

  for (const expected of [
    '`npm run typecheck`',
    '`npm run typecheck:hygiene`',
    '`npm run verify`',
    '`npm run security:supply-chain-baseline`',
    '`verify:live-local`',
    '`verify:ops`',
    '`verify:external-live`',
  ]) {
    includes(agents, expected, `Agent guidance: verification command stays present: ${expected}`);
  }

  for (const path of [
    'docs/ai/attestor-assurance-engineering.md',
    'docs/ai/playbooks/cold-audit.md',
    'docs/ai/playbooks/research-backed-change.md',
    'docs/ai/playbooks/implementation-hardening.md',
    'docs/ai/playbooks/pr-merge-review.md',
    'docs/ai/playbooks/no-go-decision.md',
    'docs/audit/ledger-template.md',
  ]) {
    includes(agents, path, `Agent guidance: playbook reference stays present: ${path}`);
    assertFileExists(path, `Agent guidance: referenced playbook exists: ${path}`);
  }
}

function testGuidanceFilesStayConciseEnoughForAgents(): void {
  const agents = readProjectFile('AGENTS.md');
  const claude = readProjectFile('CLAUDE.md');
  const copilot = readProjectFile('.github', 'copilot-instructions.md');

  ok(agents.length <= 5000, 'Agent guidance: AGENTS.md stays concise');
  ok(claude.length <= 1000, 'Agent guidance: CLAUDE.md bridge stays concise');
  ok(copilot.length <= 2500, 'Agent guidance: Copilot instructions stay concise');
}

function testClaudeBridgeUsesSharedSource(): void {
  const claude = readProjectFile('CLAUDE.md');

  includes(claude, '@AGENTS.md', 'Agent guidance: Claude bridge imports AGENTS.md');
  includes(claude, 'The root `AGENTS.md` is the shared source for Attestor agent behavior.', 'Agent guidance: Claude bridge keeps AGENTS.md as shared source');
  includes(claude, 'Use the playbooks under `docs/ai/playbooks/` only when the task matches that workflow.', 'Agent guidance: Claude bridge points long workflows at playbooks');
}

function testCopilotInstructionsKeepReviewBoundary(): void {
  const copilot = readProjectFile('.github', 'copilot-instructions.md');

  includes(copilot, 'Use the root `AGENTS.md` as the primary project guidance.', 'Agent guidance: Copilot uses AGENTS.md as primary guidance');
  includes(copilot, 'Treat Attestor as an acceptance, proof, and control layer for AI-driven consequences.', 'Agent guidance: Copilot keeps project identity');
  includes(copilot, 'Check whether the change preserves fail-closed behavior, tenant isolation, customer authority, data minimization, release provenance, auditability, replay/idempotency safety, and no-overclaim boundaries.', 'Agent guidance: Copilot review preserves protected principles');
  includes(copilot, 'Do not assume production readiness, compliance, audit completion, or live deployment maturity unless the repository evidence proves it.', 'Agent guidance: Copilot avoids overclaiming maturity');
  includes(copilot, 'For security, privacy, billing, provenance, AI-agent authority, or production-readiness changes, expect tests or explicit verification commands.', 'Agent guidance: Copilot expects verification on trust-sensitive changes');
  includes(copilot, 'Treat AI review output as a supplement to human review, not a merge authority.', 'Agent guidance: Copilot review is not merge authority');
  includes(copilot, 'raw prompts, credentials, customer identifiers, tenant ids, webhook bodies, payment data, wallet material, IP addresses, user agents, provider bodies, downstream error bodies, and private thresholds', 'Agent guidance: Copilot flags sensitive output surfaces');
}

function testGuidanceAvoidsPrivateOrOverclaimLanguage(): void {
  const combined = [
    readProjectFile('AGENTS.md'),
    readProjectFile('CLAUDE.md'),
    readProjectFile('.github', 'copilot-instructions.md'),
    readProjectFile('docs', 'ai', 'attestor-assurance-engineering.md'),
  ].join('\n');

  excludes(combined, /\bproduction-ready\b/iu, 'Agent guidance: avoids production-ready claim language');
  excludes(combined, /\bsale-ready\b/iu, 'Agent guidance: avoids sale-ready claim language');
  excludes(combined, /\bpurchasable\b/iu, 'Agent guidance: avoids purchasable claim language');
  excludes(combined, /rk_live_/u, 'Agent guidance: no live restricted key prefix');
  excludes(combined, /sk_live_/u, 'Agent guidance: no live secret key prefix');
  excludes(combined, /whsec_/u, 'Agent guidance: no webhook secret prefix');
  excludes(combined, /STRIPE_API_KEY\s*=/u, 'Agent guidance: no assigned Stripe API key');
  excludes(combined, /STRIPE_WEBHOOK_SECRET\s*=/u, 'Agent guidance: no assigned Stripe webhook secret');
}

function testPackageExposesAgentGuidanceGuard(): void {
  const scripts = packageJson().scripts;

  equal(
    scripts['test:agent-guidance-contract'],
    'tsx tests/agent-guidance-contract.test.ts',
    'Agent guidance: package.json exposes the guidance contract test',
  );
}

testRootAgentGuidanceKeepsCoreContract();
testProtectedPrinciplesStayComplete();
testEvidenceAndDoNotRulesStayConcrete();
testAuditFindingHandlingStaysOperational();
testVerificationAndPlaybookReferencesStayUsable();
testGuidanceFilesStayConciseEnoughForAgents();
testClaudeBridgeUsesSharedSource();
testCopilotInstructionsKeepReviewBoundary();
testGuidanceAvoidsPrivateOrOverclaimLanguage();
testPackageExposesAgentGuidanceGuard();

console.log(`Agent guidance contract tests: ${passed} passed, 0 failed`);
