import assert from 'node:assert/strict';
import {
  REQUIRED_CHAIN_EFFECT_RESULTS,
  REQUIRED_CLAUDE_PHRASES,
  validateClaudeAuditDiscipline,
} from '../scripts/check-claude-audit-discipline.mjs';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function testClaudeAuditDisciplinePasses(): void {
  const result = validateClaudeAuditDiscipline();

  equal(result.ok, true, 'Claude audit discipline check passes');
  equal(result.failures.length, 0, 'Claude audit discipline reports no failures');
}

function testChainEffectChecklistIsRequired(): void {
  for (const phrase of [
    'Recent Fixes Chain-Effect Check',
    'Direct regression check',
    'Cross-fix interaction check',
    'Config/manifest parity check',
    'Documentation/evidence drift check',
  ]) {
    ok(REQUIRED_CLAUDE_PHRASES.includes(phrase), `${phrase} is required in Claude discipline`);
  }
}

function testOriginalFailureModeRuleIsRequired(): void {
  ok(
    REQUIRED_CLAUDE_PHRASES.includes('original dangerous failure mode'),
    'Claude discipline requires original failure mode validation',
  );
}

function testChainEffectResultTaxonomyIsRequired(): void {
  for (const result of ['no new gap', 'new gap', 'needs live test', 'needs ops proof', 'blocked']) {
    ok(REQUIRED_CHAIN_EFFECT_RESULTS.includes(result), `${result} is a required chain-effect result`);
  }
}

function testResearchAnchorsAreRequired(): void {
  for (const anchor of ['NIST SP 800-218', 'NIST SP 800-115', 'OWASP SAMM', 'OWASP ASVS']) {
    ok(REQUIRED_CLAUDE_PHRASES.includes(anchor), `${anchor} is required as a Claude process anchor`);
  }
}

testClaudeAuditDisciplinePasses();
testChainEffectChecklistIsRequired();
testOriginalFailureModeRuleIsRequired();
testChainEffectResultTaxonomyIsRequired();
testResearchAnchorsAreRequired();

console.log(`Claude audit discipline tests: ${passed} passed, 0 failed`);
