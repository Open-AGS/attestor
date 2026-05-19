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

function testDecisionPacketFreezesScope(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'golden-refund-shadow-pilot.md',
  );

  for (const expected of [
    '# Golden Path: Refund',
    'Status: complete',
    'Golden Path: Refund is the first concrete path.',
    'refund action surface',
    'synthetic canonical shadow events',
    'shadow runtime replay',
    'Policy Foundry summary',
    'pilot readiness packet',
    'engine visibility report',
    'Not a refund product.',
    'Not a refund engine.',
    'Not a separate finance direction.',
    'Not a new Attestor mode.',
    'The refund domain supplies the example',
    'surface; it does not get independent authority.',
  ]) {
    includes(doc, expected, `Golden refund path: records ${expected}`);
  }

  excludes(
    doc,
    /\bRefund Product\b|\bRefund Engine\b/u,
    'Golden refund path: avoids product/engine naming',
  );
}

function testRepositoryEvidenceAndResearchAnchors(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'golden-refund-shadow-pilot.md',
  );

  for (const expected of [
    'examples/action-surface-onboarding/refund.openapi.json',
    'src/consequence-admission/action-surface-manifest-intake.ts',
    'src/consequence-admission/shadow-runtime-fixture-replay-smoke.ts',
    'src/consequence-admission/policy-foundry-policy-twin-summary.ts',
    'src/consequence-admission/pilot-readiness-packet.ts',
    'src/service/worker.ts',
    'not a shadow runtime activation worker',
    'src/service/consequence-shared-history-outbox-store.ts',
    'Stripe Refunds API',
    'Shopify `refundCreate`',
    'AWS IAM Access Analyzer policy generation',
    'Google Cloud role recommendations review/apply',
    'Terraform plan',
    'Kubernetes dry-run',
    'OPA decision logs',
    'Cedar policy validation',
    'OpenAPI Specification',
    'CloudEvents specification',
    'OpenTelemetry traces and spans',
    'Stripe idempotent requests',
    'Reproducible Builds definition',
    'SLSA provenance',
  ]) {
    includes(doc, expected, `Golden refund path: records ${expected}`);
  }
}

function testTrackerAndG06G07Boundaries(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'golden-refund-shadow-pilot.md',
  );

  for (const expected of [
    'Progress after G08 lands: 8/8 complete. 0 steps remain.',
    '| G01 | complete | Golden Path decision packet |',
    '| G02 | complete | Refund OpenAPI enrichment |',
    '| G03 | complete | Refund shadow fixture builder |',
    '| G04 | complete | Policy Foundry refund projection |',
    '| G05 | complete | Runtime smoke |',
    '| G06 | complete | Pilot readiness probe |',
    '| G07 | complete | Demo CLI |',
    '| G08 | complete | Engine visibility report |',
    'ready-for-shadow-pilot',
    'not-ready',
    'ready-for-scoped-pilot` is outside the G-series',
    'Markdown as the primary G07 output',
    'JSON as secondary machine output',
    'determinism check',
  ]) {
    includes(doc, expected, `Golden refund path: records ${expected}`);
  }
}

function testRelationshipBridgeAndDataBoundary(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'golden-refund-shadow-pilot.md',
  );

  for (const expected of [
    'prior refund signal',
    'confirms',
    'escalates',
    'undermining defeater',
    'without inventing a separate refund engine',
    'no live Stripe refund',
    'no live Shopify refund',
    'no Google Cloud work',
    'no GKE requirement',
    'no GCP KMS requirement',
    'no production worker readiness claim',
    'no live customer PEP claim',
    'no auto-enforcement',
    'no raw customer identifier',
    'no raw tenant identifier',
    'no raw payment payload',
    'no raw order payload',
    'It does not execute refunds automatically.',
  ]) {
    includes(doc, expected, `Golden refund path: records ${expected}`);
  }

  excludes(
    doc,
    /\bexecutes refunds automatically\b/iu,
    'Golden refund path: does not overclaim refund execution',
  );
}

function testArchitectureLinksAndPackageScriptStayAligned(): void {
  const masterPlan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );
  const runtimeOverview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  includes(
    masterPlan,
    '[Golden Path: Refund](golden-refund-shadow-pilot.md)',
    'Unified plan: links the refund golden path',
  );
  includes(
    runtimeOverview,
    '[Golden Path: Refund](golden-refund-shadow-pilot.md)',
    'Runtime overview: links the refund golden path',
  );
  assert.equal(
    packageJson.scripts['test:golden-refund-shadow-pilot'],
    'tsx tests/golden-refund-shadow-pilot.test.ts',
    'Package scripts: exposes golden refund path test',
  );
  passed += 1;
}

testDecisionPacketFreezesScope();
testRepositoryEvidenceAndResearchAnchors();
testTrackerAndG06G07Boundaries();
testRelationshipBridgeAndDataBoundary();
testArchitectureLinksAndPackageScriptStayAligned();

console.log(`Golden Path: Refund tests passed (${passed} assertions)`);

