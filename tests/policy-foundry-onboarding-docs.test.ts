import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function packageJson(): {
  readonly scripts: Readonly<Record<string, string>>;
} {
  return JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
}

function testPolicyFoundryArchitectureIsGrounded(): void {
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');

  includes(
    doc,
    'Policy Foundry is a platform-core onboarding layer for observed-action policy',
    'Policy Foundry docs: core layer identity is explicit',
  );
  includes(
    doc,
    'Attestor identifies policy candidates and missing controls from shadow action',
    'Policy Foundry docs: external language avoids ML-training claims',
  );
  includes(
    doc,
    'It is not an automatic policy writer',
    'Policy Foundry docs: auto policy writing is rejected',
  );
  includes(
    doc,
    'Finance and crypto remain',
    'Policy Foundry docs: packs do not become separate products',
  );
  includes(
    doc,
    'separate product identities',
    'Policy Foundry docs: separate product identities are rejected',
  );
  includes(
    doc,
    'src/consequence-admission/policy-discovery-candidates.ts',
    'Policy Foundry docs: current policy candidate code evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/shadow-simulation.ts',
    'Policy Foundry docs: current Policy Twin foundation is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-red-team-replay.ts',
    'Policy Foundry docs: red-team replay contract evidence is named',
  );
  includes(
    doc,
    'GET /api/v1/shadow/policy-foundry/red-team-replay',
    'Policy Foundry docs: red-team replay route is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-active-questions.ts',
    'Policy Foundry docs: active question contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-coverage-score.ts',
    'Policy Foundry docs: coverage score contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-gate-planner.ts',
    'Policy Foundry docs: gate planner contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-candidate-registry.ts',
    'Policy Foundry docs: candidate registry contract evidence is named',
  );
  includes(
    doc,
    'GET /api/v1/shadow/policy-foundry/active-questions',
    'Policy Foundry docs: active question route is named',
  );
  includes(
    doc,
    'self-attest `redTeamReplayStatus` through the readiness query',
    'Policy Foundry docs: readiness replay status cannot be caller supplied',
  );
}

function testReadmeNamesPolicyFoundryWithoutOverclaiming(): void {
  const readme = readProjectFile('README.md');

  includes(
    readme,
    'Policy Foundry is the onboarding layer for this path.',
    'README: Policy Foundry is named in the adoption path',
  );
  includes(
    readme,
    'observed-action policy mining, not model training, not automatic policy writing',
    'README: Policy Foundry avoids ML-training and auto-policy claims',
  );
  includes(
    readme,
    'customers self-attest readiness controls',
    'README: readiness evidence cannot be self-attested',
  );
  includes(
    readme,
    '[Policy Foundry onboarding](docs/02-architecture/policy-foundry-onboarding.md)',
    'README: Policy Foundry architecture guide is linked',
  );
}

function testSafetyInvariantsAreExplicit(): void {
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');

  for (const invariant of [
    'approvalRequired: true',
    'autoEnforce: false',
    'llmAuthorityAllowed: false',
    'evidenceRequired: true',
    'simulationRequired: true',
    'not enough evidence',
    'no-go for enforce',
  ]) {
    includes(doc, invariant, `Policy Foundry docs: invariant ${invariant} is documented`);
  }

  for (const noGo of [
    'no simulation report',
    'no customer approval',
    'single actor dominates the candidate sample',
    'high-risk auto-admits appear in backtest',
    'red-team replay fails',
    'LLM text is the only source',
  ]) {
    includes(doc, noGo, `Policy Foundry docs: no-go condition ${noGo} is documented`);
  }
}

function testOnboardingResearchAnchorsAreRecorded(): void {
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');

  for (const anchor of [
    'AWS IAM Access Analyzer',
    'Google IAM Recommender',
    'Cedar and AWS Verified Permissions',
    'OPA decision logs and policy tests',
    'NIST SP 800-162',
    'ABAC policy-mining research',
    'Stripe onboarding is requirements-aware',
    'Auth0 progressive profiling',
    'LaunchDarkly and OpenFeature',
    'Zanzibar and OpenFGA',
  ]) {
    includes(doc, anchor, `Policy Foundry docs: research anchor ${anchor} is recorded`);
  }
}

function testCommercialBoundaryMatchesPackaging(): void {
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const packaging = readProjectFile('docs', '01-overview', 'product-packaging.md');

  includes(packaging, '## Policy Foundry Packaging Boundary', 'Product packaging: Foundry boundary section exists');
  includes(packaging, 'Policy Foundry is the platform-core onboarding layer for observed-action policy', 'Product packaging: Foundry is core');
  includes(packaging, 'missing controls from observed shadow actions', 'Product packaging: external language avoids training claims');
  includes(packaging, 'Policy Twin simulation preview', 'Product packaging: Trial carries Policy Twin preview');
  includes(packaging, 'Security minimums must not become paid-only features', 'Product packaging: safety floor is preserved');
  includes(packaging, 'not fully implemented yet', 'Product packaging: implementation limitation is explicit');

  for (const plan of ['developer', 'trial', 'starter', 'pro', 'scale', 'enterprise']) {
    includes(doc, `- ${plan[0]?.toUpperCase()}${plan.slice(1)}`, `Policy Foundry docs: ${plan} commercial posture is recorded`);
    includes(packaging, `| \`${plan}\` |`, `Product packaging: ${plan} Foundry row exists`);
  }
}

function testPackageScriptIsExposed(): void {
  const pkg = packageJson();

  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-onboarding-docs',
    'Package: Policy Foundry onboarding docs test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-onboarding-docs'] ?? '',
    'tsx tests/policy-foundry-onboarding-docs.test.ts',
    'Package: Policy Foundry onboarding docs test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-red-team-replay',
    'Package: Policy Foundry red-team replay test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-red-team-replay'] ?? '',
    'tsx tests/policy-foundry-red-team-replay.test.ts',
    'Package: Policy Foundry red-team replay test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-active-questions',
    'Package: Policy Foundry active questions test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-active-questions'] ?? '',
    'tsx tests/policy-foundry-active-questions.test.ts',
    'Package: Policy Foundry active questions test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-coverage-score',
    'Package: Policy Foundry coverage score test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-coverage-score'] ?? '',
    'tsx tests/policy-foundry-coverage-score.test.ts',
    'Package: Policy Foundry coverage score test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-gate-planner',
    'Package: Policy Foundry gate planner test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-gate-planner'] ?? '',
    'tsx tests/policy-foundry-gate-planner.test.ts',
    'Package: Policy Foundry gate planner test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-candidate-registry',
    'Package: Policy Foundry candidate registry test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-candidate-registry'] ?? '',
    'tsx tests/policy-foundry-candidate-registry.test.ts',
    'Package: Policy Foundry candidate registry test command is stable',
  );
}

testPolicyFoundryArchitectureIsGrounded();
testReadmeNamesPolicyFoundryWithoutOverclaiming();
testSafetyInvariantsAreExplicit();
testOnboardingResearchAnchorsAreRecorded();
testCommercialBoundaryMatchesPackaging();
testPackageScriptIsExposed();

ok(passed > 0, 'Policy Foundry onboarding docs tests executed');
console.log(`Policy Foundry onboarding docs tests: ${passed} passed, 0 failed`);
