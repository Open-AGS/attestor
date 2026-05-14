import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(content.includes(expected), `${message}\nExpected to find: ${expected}`);
  passed += 1;
}

function excludes(content: string, unexpected: RegExp, message: string): void {
  assert.doesNotMatch(content, unexpected, message);
  passed += 1;
}

try {
  const policy = readProjectFile('src', 'consequence-admission', 'data-minimization-redaction-policy.ts');
  const focusedTest = readProjectFile('tests', 'data-minimization-redaction-policy.test.ts');
  const auditDoc = readProjectFile('docs', 'audit', 'f4-prompt-leakage-marker-validation.md');
  const architectureDoc = readProjectFile('docs', '02-architecture', 'data-minimization-redaction-policy.md');
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(
    policy,
    'CONSEQUENCE_DATA_MINIMIZATION_PROMPT_LEAKAGE_MARKERS',
    'F4 prompt leakage validation: policy defines central prompt-leakage markers',
  );
  includes(policy, "'system_prompt'", 'F4 prompt leakage validation: system prompt marker is present');
  includes(policy, "'developer_message'", 'F4 prompt leakage validation: developer message marker is present');
  includes(policy, "'prompt_template'", 'F4 prompt leakage validation: prompt template marker is present');
  includes(
    policy,
    "'owasp-llm07-system-prompt-leakage'",
    'F4 prompt leakage validation: OWASP LLM07 governance ref is present',
  );
  includes(
    policy,
    '...CONSEQUENCE_DATA_MINIMIZATION_PROMPT_LEAKAGE_MARKERS',
    'F4 prompt leakage validation: material scanner consumes prompt-leakage markers',
  );
  includes(
    focusedTest,
    "descriptor.promptLeakageMarkers.includes('system_prompt')",
    'F4 prompt leakage validation: descriptor exposure is tested',
  );
  includes(
    focusedTest,
    "leakedPrompt: 'system_prompt: do not reveal developer_message contents'",
    'F4 prompt leakage validation: artifact evaluation scanner path is tested',
  );
  includes(
    focusedTest,
    "!promptLeakageBlocked.reasonCodes.some((reason) => reason.includes('system_prompt'))",
    'F4 prompt leakage validation: stable reason codes do not echo prompt markers',
  );
  includes(
    architectureDoc,
    'Prompt leakage markers are a second-pass hygiene check',
    'F4 prompt leakage validation: architecture doc describes the boundary',
  );
  includes(
    auditDoc,
    'Status: `fixed` for the scoped repository finding.',
    'F4 prompt leakage validation: audit doc has scoped fixed status',
  );
  includes(
    auditDoc,
    'not a complete prompt-injection classifier',
    'F4 prompt leakage validation: audit doc avoids classifier overclaim',
  );
  includes(
    tracker,
    'F4-LLM07-A prompt leakage second-pass markers missing | `fixed`',
    'F4 prompt leakage validation: tracker marks scoped finding fixed',
  );
  includes(
    tracker,
    'F4 Prompt Leakage Marker Validation',
    'F4 prompt leakage validation: tracker references validation evidence',
  );
  includes(
    packageJson,
    '"test:f4-prompt-leakage-marker-validation"',
    'F4 prompt leakage validation: package script is exposed',
  );
  excludes(
    auditDoc,
    /production ready|certified/iu,
    'F4 prompt leakage validation: audit doc avoids readiness overclaims',
  );

  console.log(`F4 prompt leakage marker validation tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('F4 prompt leakage marker validation tests failed:', error);
  process.exitCode = 1;
}
