#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CLAUDE_AUDIT_DISCIPLINE_PATH = 'CLAUDE.md';

export const REQUIRED_CLAUDE_PHRASES = Object.freeze([
  'Claude-Specific Operating Rules For Attestor',
  'intentionally Claude-specific',
  'Recent Fixes Chain-Effect Check',
  'commit impact map',
  'Direct regression check',
  'Defense-in-depth check',
  'Behavioral semantics check',
  'Cross-fix interaction check',
  'Test coverage drift check',
  'Config/manifest parity check',
  'Documentation/evidence drift check',
  'original dangerous failure mode',
  'no new gap',
  'needs live test',
  'needs ops proof',
  'repo-proven P0/P1',
  'NIST SP 800-218',
  'NIST SP 800-115',
  'OWASP SAMM',
  'OWASP ASVS',
  'Google SRE postmortem',
]);

export const REQUIRED_CHAIN_EFFECT_RESULTS = Object.freeze([
  'no new gap',
  'new gap',
  'needs live test',
  'needs ops proof',
  'blocked',
]);

function readProjectFile(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8').replace(/\r\n/gu, '\n');
}

function assertIncludes(content, expected, label, failures) {
  if (!content.includes(expected)) {
    failures.push(`${label}: missing ${expected}`);
  }
}

export function validateClaudeAuditDiscipline() {
  const failures = [];
  let content = '';

  try {
    content = readProjectFile(CLAUDE_AUDIT_DISCIPLINE_PATH);
  } catch {
    failures.push(`${CLAUDE_AUDIT_DISCIPLINE_PATH}: file is missing`);
    return { ok: false, failures };
  }

  if (content.trim().length === 0) {
    failures.push(`${CLAUDE_AUDIT_DISCIPLINE_PATH}: file is empty`);
  }

  for (const phrase of REQUIRED_CLAUDE_PHRASES) {
    assertIncludes(content, phrase, 'Claude audit discipline', failures);
  }

  for (const result of REQUIRED_CHAIN_EFFECT_RESULTS) {
    assertIncludes(content, result, 'Claude chain-effect result taxonomy', failures);
  }

  if (!/Do not copy them into\s+`AGENTS\.md`/u.test(content)) {
    failures.push('Claude audit discipline: must stay Claude-only and not modify AGENTS.md by default');
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateClaudeAuditDiscipline();
  if (!result.ok) {
    console.error('Claude audit discipline check failed.');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Claude audit discipline checks: passed');
}
