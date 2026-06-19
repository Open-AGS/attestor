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
    'src/consequence-admission/policy-foundry-counterexample-ledger.ts',
    'Policy Foundry docs: counterexample ledger contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-policy-twin-summary.ts',
    'Policy Foundry docs: Policy Twin summary contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-authority-relationship-context.ts',
    'Policy Foundry docs: authority relationship context contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-review-only-patch-pack.ts',
    'Policy Foundry docs: review-only patch pack contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-self-onboarding-cli.ts',
    'Policy Foundry docs: self-onboarding CLI contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-outcome-feedback-loop.ts',
    'Policy Foundry docs: outcome feedback loop contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-drift-policy-debt-detector.ts',
    'Policy Foundry docs: drift/policy debt detector contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-commercial-boundary.ts',
    'Policy Foundry docs: commercial boundary contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-adversarial-replay-executor.ts',
    'Policy Foundry docs: adversarial replay executor contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-live-downstream-replay.ts',
    'Policy Foundry docs: live downstream replay contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-hosted-onboarding-workflow.ts',
    'Policy Foundry docs: hosted onboarding workflow contract evidence is named',
  );
  includes(
    doc,
    'src/consequence-admission/policy-foundry-hosted-review-surface.ts',
    'Policy Foundry docs: hosted review surface contract evidence is named',
  );
  includes(
    doc,
    'src/service/policy-foundry/policy-foundry-hosted-ui.ts',
    'Policy Foundry docs: hosted UI flow renderer evidence is named',
  );
  includes(
    doc,
    'scripts/preview/preview-policy-foundry-hosted-ui.ts',
    'Policy Foundry docs: hosted UI browser preview evidence is named',
  );
  includes(
    doc,
    'src/service/policy-foundry/policy-foundry-hosted-wizard-state.ts',
    'Policy Foundry docs: hosted wizard state evidence is named',
  );
  includes(
    doc,
    'productionStoragePath',
    'Policy Foundry docs: hosted wizard storage production gate is named',
  );
  includes(
    doc,
    'scripts/probe/probe-policy-foundry-production-smoke.ts',
    'Policy Foundry docs: production smoke probe evidence is named',
  );
  includes(
    doc,
    'tests/policy-foundry-production-smoke-probe.test.ts',
    'Policy Foundry docs: production smoke probe test evidence is named',
  );
  includes(
    doc,
    'scripts/render/render-policy-foundry-self-onboarding.ts',
    'Policy Foundry docs: self-onboarding renderer evidence is named',
  );
  includes(
    doc,
    'GET /api/v1/shadow/policy-foundry/active-questions',
    'Policy Foundry docs: active question route is named',
  );
  includes(
    doc,
    'self-attest `redTeamReplayStatus`, `customerApproved`, or',
    'Policy Foundry docs: readiness replay and proof flags cannot be caller supplied',
  );
}

function testDocsNamePolicyFoundryWithoutOverclaiming(): void {
  const doc = readProjectFile('docs', '02-architecture', 'policy-foundry-onboarding.md');
  const docsFrontDoor = readProjectFile('docs', 'README.md');

  includes(
    docsFrontDoor,
    '[Policy Foundry onboarding](02-architecture/policy-foundry-onboarding.md)',
    'Docs front door links the Policy Foundry architecture guide',
  );
  includes(
    doc,
    'It is not an automatic policy writer',
    'Policy Foundry docs: automatic policy writing is rejected',
  );
  includes(
    doc,
    '`tenantBoundaryProven` through the readiness query',
    'Policy Foundry docs: readiness evidence cannot be caller supplied',
  );
  includes(
    doc,
    'The Outcome Feedback Loop is the first reviewed-outcome return path',
    'Policy Foundry docs: outcome feedback is named without automation overclaim',
  );
  includes(
    doc,
    'The Drift And Policy Debt Detector is the first review-only detector',
    'Policy Foundry docs: drift/policy debt detector is named without automation overclaim',
  );
  includes(
    doc,
    'The action-surface red-team fixture bundle lives in',
    'Policy Foundry docs: red-team fixture bundle is named without production overclaim',
  );
  includes(
    doc,
    'The local adversarial replay executor consumes that fixture bundle',
    'Policy Foundry docs: local adversarial replay executor is named without production overclaim',
  );
  includes(
    doc,
    'The Policy Foundry Live Downstream Replay contract is the first non-mutating',
    'Policy Foundry docs: live downstream replay evidence is named without production overclaim',
  );
  includes(
    doc,
    'The Policy Foundry Hosted Onboarding Workflow is the first hosted workflow',
    'Policy Foundry docs: hosted onboarding workflow contract is named without UI overclaim',
  );
  includes(
    doc,
    'The compact hosted review surface lives in',
    'Policy Foundry docs: hosted review surface is named without production overclaim',
  );
  includes(
    doc,
    'preview:policy-foundry-hosted-ui',
    'Policy Foundry docs: local browser QA preview is named',
  );
  includes(
    doc,
    'This harness is browser QA only',
    'Policy Foundry docs: local browser QA preview limitation is explicit',
  );
  includes(
    doc,
    'Policy Foundry production smoke probe for already deployed hosted environments',
    'Policy Foundry docs: production smoke probe is named without production overclaim',
  );
  includes(
    doc,
    'a smoke probe pass is not a production-readiness',
    'Policy Foundry docs: hosted onboarding limitation stays bounded',
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
    'Terraform',
    'Kubernetes dry-run',
    'OpenTelemetry-style correlated signals',
    'NIST AI RMF monitor/manage discipline',
    'Terraform plan',
    'Stripe entitlement-style feature boundaries',
    'OpenFeature context-bound evaluation',
    'LaunchDarkly progressive rollouts',
    'OWASP session management',
    'Kubernetes readiness',
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
  includes(packaging, 'Policy Twin preview', 'Product packaging: Trial carries Policy Twin preview');
  includes(packaging, 'Security minimums must not become paid-only features', 'Product packaging: safety floor is preserved');
  includes(packaging, 'repo-side commercial boundary contract is implemented', 'Product packaging: repo-side commercial boundary is explicit');
  includes(packaging, 'hosted Policy Foundry route now also includes', 'Product packaging: hosted entitlement implementation is explicit');
  includes(packaging, 'commercial access gating, not policy', 'Product packaging: hosted entitlement limitation is explicit');

  for (const surface of ['Trial account entitlement', 'Pilot Workflow', 'Starter Workflow', 'Pro Workflow', 'Negotiated deployment']) {
    includes(doc, `- ${surface}`, `Policy Foundry docs: ${surface} commercial posture is recorded`);
  }
  for (const surface of ['`trial` account entitlement', '`pilot-workflow`', '`starter-workflow`', '`pro-workflow`', 'negotiated deployment']) {
    includes(packaging, `| ${surface} |`, `Product packaging: ${surface} Foundry row exists`);
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
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-counterexample-ledger',
    'Package: Policy Foundry counterexample ledger test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-counterexample-ledger'] ?? '',
    'tsx tests/policy-foundry-counterexample-ledger.test.ts',
    'Package: Policy Foundry counterexample ledger test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-policy-twin-summary',
    'Package: Policy Foundry Policy Twin summary test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-policy-twin-summary'] ?? '',
    'tsx tests/policy-foundry-policy-twin-summary.test.ts',
    'Package: Policy Foundry Policy Twin summary test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-authority-relationship-context',
    'Package: Policy Foundry authority relationship context test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-authority-relationship-context'] ?? '',
    'tsx tests/policy-foundry-authority-relationship-context.test.ts',
    'Package: Policy Foundry authority relationship context test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-review-only-patch-pack',
    'Package: Policy Foundry review-only patch pack test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-review-only-patch-pack'] ?? '',
    'tsx tests/policy-foundry-review-only-patch-pack.test.ts',
    'Package: Policy Foundry review-only patch pack test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-self-onboarding-cli',
    'Package: Policy Foundry self-onboarding CLI test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-self-onboarding-cli'] ?? '',
    'tsx tests/policy-foundry-self-onboarding-cli.test.ts',
    'Package: Policy Foundry self-onboarding CLI test command is stable',
  );
  includes(
    pkg.scripts['policy-foundry:self-onboard'] ?? '',
    'tsx scripts/render/render-policy-foundry-self-onboarding.ts',
    'Package: Policy Foundry self-onboarding renderer command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-outcome-feedback-loop',
    'Package: Policy Foundry outcome feedback loop test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-outcome-feedback-loop'] ?? '',
    'tsx tests/policy-foundry-outcome-feedback-loop.test.ts',
    'Package: Policy Foundry outcome feedback loop test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-drift-policy-debt-detector',
    'Package: Policy Foundry drift/policy debt detector test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-drift-policy-debt-detector'] ?? '',
    'tsx tests/policy-foundry-drift-policy-debt-detector.test.ts',
    'Package: Policy Foundry drift/policy debt detector test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-commercial-boundary',
    'Package: Policy Foundry commercial boundary test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-commercial-boundary'] ?? '',
    'tsx tests/policy-foundry-commercial-boundary.test.ts',
    'Package: Policy Foundry commercial boundary test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-billing-entitlement-enforcement',
    'Package: Policy Foundry billing entitlement enforcement test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-billing-entitlement-enforcement'] ?? '',
    'tsx tests/policy-foundry-billing-entitlement-enforcement.test.ts',
    'Package: Policy Foundry billing entitlement enforcement test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-adversarial-replay-executor',
    'Package: Policy Foundry adversarial replay executor test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-adversarial-replay-executor'] ?? '',
    'tsx tests/policy-foundry-adversarial-replay-executor.test.ts',
    'Package: Policy Foundry adversarial replay executor test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-live-downstream-replay',
    'Package: Policy Foundry live downstream replay test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-live-downstream-replay'] ?? '',
    'tsx tests/policy-foundry-live-downstream-replay.test.ts',
    'Package: Policy Foundry live downstream replay test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-hosted-onboarding-workflow',
    'Package: Policy Foundry hosted onboarding workflow test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-hosted-onboarding-workflow'] ?? '',
    'tsx tests/policy-foundry-hosted-onboarding-workflow.test.ts',
    'Package: Policy Foundry hosted onboarding workflow test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-hosted-review-surface',
    'Package: Policy Foundry hosted review surface test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-hosted-review-surface'] ?? '',
    'tsx tests/policy-foundry-hosted-review-surface.test.ts',
    'Package: Policy Foundry hosted review surface test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-hosted-ui-flow',
    'Package: Policy Foundry hosted UI flow test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-hosted-ui-flow'] ?? '',
    'tsx tests/policy-foundry-hosted-ui-flow.test.ts',
    'Package: Policy Foundry hosted UI flow test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-hosted-wizard-state',
    'Package: Policy Foundry hosted wizard state test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-hosted-wizard-state'] ?? '',
    'tsx tests/policy-foundry-hosted-wizard-state.test.ts',
    'Package: Policy Foundry hosted wizard state test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'preview:policy-foundry-hosted-ui',
    'Package: Policy Foundry hosted UI preview script is exposed',
  );
  includes(
    pkg.scripts['preview:policy-foundry-hosted-ui'] ?? '',
    'tsx scripts/preview/preview-policy-foundry-hosted-ui.ts',
    'Package: Policy Foundry hosted UI preview command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'test:policy-foundry-production-smoke-probe',
    'Package: Policy Foundry production smoke probe test is exposed',
  );
  includes(
    pkg.scripts['test:policy-foundry-production-smoke-probe'] ?? '',
    'tsx tests/policy-foundry-production-smoke-probe.test.ts',
    'Package: Policy Foundry production smoke probe test command is stable',
  );
  includes(
    JSON.stringify(pkg.scripts),
    'probe:policy-foundry-production-smoke',
    'Package: Policy Foundry production smoke probe is exposed',
  );
  includes(
    pkg.scripts['probe:policy-foundry-production-smoke'] ?? '',
    'tsx scripts/probe/probe-policy-foundry-production-smoke.ts',
    'Package: Policy Foundry production smoke probe command is stable',
  );
}

testPolicyFoundryArchitectureIsGrounded();
testDocsNamePolicyFoundryWithoutOverclaiming();
testSafetyInvariantsAreExplicit();
testOnboardingResearchAnchorsAreRecorded();
testCommercialBoundaryMatchesPackaging();
testPackageScriptIsExposed();

ok(passed > 0, 'Policy Foundry onboarding docs tests executed');
console.log(`Policy Foundry onboarding docs tests: ${passed} passed, 0 failed`);
