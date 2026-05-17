import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function testMasterPlanExistsAndKeepsOneEngine(): void {
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );

  includes(plan, '# Unified Shadow-To-Policy Master Plan', 'Unified plan: document exists');
  includes(plan, 'Attestor stays one control engine:', 'Unified plan: one engine posture is explicit');
  includes(
    plan,
    'Finance, crypto, CRM/support, ITSM/workflow, data/IAM, procurement/spend, and',
    'Unified plan: domains are adapters, not separate engines',
  );
  includes(
    plan,
    'Crypto is not a separate engine.',
    'Unified plan: crypto split is explicitly blocked',
  );
  excludes(
    plan,
    /\bCrypto Attestor\b|\bEnterprise Attestor\b/u,
    'Unified plan: does not introduce separate product identities',
  );
}

function testMasterPlanRecordsCountsAndLegacySteps(): void {
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );

  for (const expected of [
    '| Total master-plan rounds | 26 |',
    '| Complete | 16 |',
    '| Remaining | 10 |',
    '| 07 | complete | Consequence shared-store inventory |',
    '| 08 | complete | Consequence shared-store PR slice 1 |',
    '| 09 | complete | Consequence shared-store PR slice 2 |',
    '| 10 | complete | LLM provider runtime decision |',
    '| 11 | complete | Anthropic runtime PR |',
    '| 12 | complete | Production rehearsal go/no-go packet |',
    '| 13 | complete | Target-system compatibility matrix |',
    '| 14 | complete | Shadow event canonical schema |',
    '| 15 | complete | Action surface graph |',
    '| 16 | complete | Evidence state model |',
  ]) {
    includes(plan, expected, `Unified plan: records ${expected}`);
  }
}

function testMasterPlanRecordsNewWorkSequence(): void {
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );

  for (const expected of [
    '| 17 | planned | Policy Candidate PR contract |',
    '| 18 | planned | Active Question Engine |',
    '| 19 | planned | Counterexample replay generator |',
    '| 20 | planned | Policy Twin backtest |',
    '| 21 | planned | Review-by-exception inbox |',
    '| 22 | planned | Approval/dismiss feedback loop |',
    '| 23 | planned | Enterprise integration recipes |',
    '| 24 | planned | General Crypto Transaction Gate |',
    '| 25 | planned | Spend, procurement, data, IAM, health, and insurance recipes |',
    '| 26 | planned | Pilot readiness packet |',
  ]) {
    includes(plan, expected, `Unified plan: records ${expected}`);
  }
}

function testMasterPlanRecordsGeneralCryptoScope(): void {
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );

  for (const expected of [
    '`native.transfer`, `erc20.approve`, `permit.sign`, `swap.execute`, `bridge.transfer`, `safe.tx.propose`, `userop.submit`, `session_key.grant`, `x402.pay`',
    'unlimited approval, malicious spender, permit/domain mismatch',
    'EVM transaction decoder, ERC-20 transfer/approve/permit, native transfer, Safe transaction, simulation binding',
    'Do not make Attestor a wallet, custodian, exchange, chain analytics provider, or transaction broadcaster.',
  ]) {
    includes(plan, expected, `Unified plan: crypto scope records ${expected}`);
  }
}

function testMasterPlanRecordsResearchAnchorsAndNonClaims(): void {
  const plan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud role recommendations',
    'Cedar policy validation',
    'OPA decision logs',
    'Salesforce Agentforce actions',
    'Microsoft Copilot Studio tools',
    'MuleSoft Agentforce API actions',
    'Zapier AI Actions reference',
    'Fireblocks transaction authorization policy',
    'BitGo policies overview',
    'Coinbase CDP Policy Engine',
    'Snowflake Cortex Agents REST API',
    'Databricks AI agent tools',
    'Okta Workflows connector building blocks',
    'Microsoft Entra Lifecycle Workflow extensibility',
    'CloudEvents specification',
    'OpenTelemetry Logs Data Model',
    'Open Cybersecurity Schema Framework',
    'W3C PROV Data Model',
    'OpenAPI Specification',
    'AsyncAPI Specification',
    'Model Context Protocol tools',
    'EIP-712 typed data',
    'ERC-4337 account abstraction',
    'Production go/no-go evidence and target-readiness discipline',
    'GitHub deployment environments',
  ]) {
    includes(plan, expected, `Unified plan: source anchor ${expected} is recorded`);
  }

  includes(
    tracker,
    '[Unified Shadow-To-Policy Master Plan](unified-shadow-to-policy-master-plan.md)',
    'Unlock tracker: links the unified master plan',
  );
  includes(plan, 'automatic policy activation', 'Unified plan: automatic activation non-claim is explicit');
  includes(plan, 'completion of steps 17-26', 'Unified plan: remaining step non-claim is explicit');
  assert.equal(
    packageJson.scripts['test:unified-shadow-to-policy-master-plan'],
    'tsx tests/unified-shadow-to-policy-master-plan.test.ts',
    'Unified plan: package script is registered',
  );
  passed += 1;
}

testMasterPlanExistsAndKeepsOneEngine();
testMasterPlanRecordsCountsAndLegacySteps();
testMasterPlanRecordsNewWorkSequence();
testMasterPlanRecordsGeneralCryptoScope();
testMasterPlanRecordsResearchAnchorsAndNonClaims();

console.log(`Unified Shadow-to-Policy master plan tests: ${passed} passed, 0 failed`);
