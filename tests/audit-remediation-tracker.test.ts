import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
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
  const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
  const packageJson = readProjectFile('package.json');

  includes(tracker, '# Attestor Audit Remediation Tracker', 'Tracker: title is present');
  includes(tracker, 'not a certification', 'Tracker: no-certification disclaimer is present');
  includes(tracker, '`origin/master` is the source of truth', 'Tracker: origin/master rule is present');
  includes(tracker, 'Estimated remaining work after this tracker lands: about 15 to 23', 'Tracker: remaining estimate is explicit');

  for (const pr of [
    '#220',
    '#291',
    '#292',
    '#293',
    '#294',
    '#295',
    '#296',
    '#297',
    '#298',
    '#299',
    '#300',
    '#301',
    '#302',
    '#303',
    '#304',
    '#305',
    '#306',
    '#307',
    '#308',
    '#309',
    '#310',
    '#311',
    '#312',
    '#313',
    '#314',
    '#315',
    '#316',
  ]) {
    includes(tracker, pr, `Tracker: ${pr} is referenced`);
  }

  for (const group of [
    'F1 Threat-Model Foundation',
    'F2 Agentic Consequence Surface',
    'F3 Cross-Cutting Guard Readiness',
    'F4 OWASP LLM / Input Surface Redo',
    'F5 Signing Layer',
    'Final Docs And Claim Alignment',
  ]) {
    includes(tracker, group, `Tracker: ${group} section exists`);
  }

  includes(tracker, 'F2-AG-4 multi-agent delegation confusion', 'Tracker: completed F2 remediation is named');
  includes(tracker, 'F2-AG-1 customer-gate honor-system | `partial`', 'Tracker: F2 customer-gate validation is closed as partial');
  includes(tracker, 'F2-AG-2 agent-payment settlement post-condition | `partial`', 'Tracker: F2 agent-payment settlement validation is closed as partial');
  includes(tracker, 'F2-AG-3 account-delegation / EIP-7702 scope | `partial`', 'Tracker: F2 EIP-7702 scope validation is closed as partial');
  includes(tracker, 'F2-AG-5 hidden downstream side effects / receipt omission | `partial`', 'Tracker: F2 downstream receipt omission validation is closed as partial');
  includes(tracker, 'F2-AG-6 unsupported confidence / hallucinated evidence | `partial`', 'Tracker: F2 evidence confidence validation is closed as partial');
  includes(tracker, 'F2-AG-7 agentic supply-chain and LLM provider dependency | `partial`', 'Tracker: F2 LLM provider supply-chain validation is closed as partial');
  includes(tracker, 'F2-AG-8 multimodal vision input future risk | `backlog`', 'Tracker: F2 multimodal vision future risk is backlogged');
  includes(tracker, 'F2-AG-9 free-text narrow constraints | `fixed`', 'Tracker: F2 constraint kind registry validation is fixed');
  includes(tracker, 'F2-AG-10 model/tool/config drift | `partial`', 'Tracker: F2 model/tool/config drift validation is closed as partial');
  includes(tracker, 'F3-CC-10 agentic supply-chain guard missing', 'Tracker: final F3 item is tracked');
  includes(tracker, 'F4-LLM10-B retry-attempt ledger storage claim', 'Tracker: detailed F4 redo is tracked');
  includes(tracker, 'F4-LLM09-A hallucinated evidence / unsupported confidence | `partial`', 'Tracker: F4 LLM09 evidence confidence validation is closed as partial');
  includes(tracker, 'F4-LLM01-A indirect prompt injection via operator-asserted trust class | `fixed`', 'Tracker: F4 trust class PKI proof validation is fixed');
  includes(tracker, 'F4-LLM01-B hosted LLM agent tool boundary descriptor-only | `invalid-as-stated`', 'Tracker: F4 hosted LLM boundary conformance is invalid as stated');
  includes(tracker, 'F4-LLM02-A data-minimization evaluation operator-driven | `fixed`', 'Tracker: F4 data minimization scanning is fixed');
  includes(tracker, 'F4-LLM02-B redaction policy not activated as an enforcement claim | `accepted-limitation`', 'Tracker: F4 data minimization readiness boundary is accepted');
  includes(tracker, 'F4-LLM05-A presentation freshness relies on operator clock | `fixed`', 'Tracker: F4 presentation freshness nonce is fixed');
  includes(tracker, 'F4-LLM05-B presentation replay ledger in-memory reference path | `partial`', 'Tracker: F4 replay shared-ledger validation is partial');
  includes(tracker, 'F4-LLM06-B agent-loop budget per process | `partial`', 'Tracker: F4 shared agent-loop validation is partial');
  includes(tracker, 'F4-LLM03-A agentic supply-chain coverage gap / single LLM provider | `partial`', 'Tracker: F4 LLM03 provider split is closed as partial');
  includes(tracker, 'F4-LLM10-A velocity limits depend on shared counter enforcement | `partial`', 'Tracker: F4 velocity source validation is partial');
  includes(tracker, 'F4-LLM10-B retry-attempt ledger storage claim | `partial`', 'Tracker: F4 retry ledger storage validation is partial');
  includes(tracker, 'F4-LLM07-A prompt leakage second-pass markers missing | `fixed`', 'Tracker: F4 prompt leakage marker validation is fixed');
  includes(tracker, 'F4 Prompt Leakage Marker Validation', 'Tracker: F4 prompt leakage marker validation evidence is linked');
  includes(tracker, 'F4-D Attestor-owned OpenAI usage / budget / prompt leakage scope | `backlog`', 'Tracker: F4-D OpenAI usage is backlogged');
  includes(tracker, 'F5-A6 transparency log missing', 'Tracker: F5 transparency limitation is tracked');
  includes(tracker, 'F5-A1 out-of-band trust root optional | `fixed`', 'Tracker: F5 CA pin validation is fixed');
  includes(tracker, 'F5 CA Pin Required Validation', 'Tracker: F5 CA pin validation evidence is linked');
  includes(tracker, 'F5-NEW-4 duplicate verify helper calls in CLI', 'Tracker: detailed F5 redo is tracked');
  includes(tracker, 'No `needs-revalidation` row can remain before starting F6', 'Tracker: F6 gate is explicit');
  excludes(tracker, /production ready|certified|fully complete/iu, 'Tracker: avoids production/certification overclaim wording');
  includes(packageJson, '"test:audit-remediation-tracker"', 'Package: tracker test script is exposed');
  includes(packageJson, '"test:f4-prompt-leakage-marker-validation"', 'Package: F4 prompt leakage validation script is exposed');
  includes(packageJson, '"test:f5-ca-pin-required-validation"', 'Package: F5 CA pin validation script is exposed');

  ok(tracker.split('\n').length > 120, 'Tracker: enough rows to cover supplied audit reports');
  console.log(`Audit remediation tracker tests: ${passed} passed, 0 failed`);
} catch (error) {
  console.error('Audit remediation tracker tests failed:', error);
  process.exitCode = 1;
}
