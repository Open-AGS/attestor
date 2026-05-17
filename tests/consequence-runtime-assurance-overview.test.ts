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

function testOverviewRecordsOneEngineAndAuthoritySplit(): void {
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );

  includes(overview, '# Consequence Runtime Assurance Overview', 'Overview: document exists');
  includes(overview, 'Attestor stays one consequence control engine:', 'Overview: one-engine posture is explicit');
  includes(overview, 'Signal Relationship Fabric', 'Overview: fabric is named');
  includes(overview, 'Consequence Envelope', 'Overview: consequence envelope is named');
  includes(overview, 'Assurance Measurement Plane', 'Overview: measurement plane is named');
  includes(overview, 'The measurement plane never writes to the audit plane.', 'Overview: measurement plane has no audit write authority');
  includes(overview, 'Finance, crypto, support, workflow, data, IAM, procurement, health, and', 'Overview: packs remain one-engine projections');
  excludes(overview, /\bCrypto Attestor\b|\bEnterprise Attestor\b/u, 'Overview: no separate product identity is introduced');
}

function testOverviewRecordsContractShapeAndSequence(): void {
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );

  for (const expected of [
    'canonicalActionType',
    'reversibilityClass',
    'blastRadiusEstimate',
    'tenantContext',
    'SignalCategory',
    'verdict:',
    'observation:',
    'gap:',
    'boundary:',
    'measurement:',
    '`confirms` | symmetric',
    '`overrides` | directed',
    '`requires_review` | unary',
    '| 01 | complete | Consequence Envelope Contract |',
    '| 02 | complete | Signal Relationship Contract |',
    '| 03 | complete | LayerOpinion schema |',
    '| 04 | complete | Modulator authority tier |',
    '| 05 | complete | Relationship-aware monotone fusion |',
    '| 06 | planned | Conflict and abstention gate |',
    '| 10 | planned | Assurance measurement plane |',
    'src/consequence-admission/consequence-envelope-contract.ts',
    'tests/consequence-envelope-contract.test.ts',
    'src/consequence-admission/signal-relationship-contract.ts',
    'tests/signal-relationship-contract.test.ts',
    'src/consequence-admission/layer-opinion-schema.ts',
    'tests/layer-opinion-schema.test.ts',
    'src/consequence-admission/modulator-authority-tier.ts',
    'tests/modulator-authority-tier.test.ts',
    'src/consequence-admission/relationship-aware-monotone-fusion.ts',
    'tests/relationship-aware-monotone-fusion.test.ts',
    'src/consequence-admission/conflict-abstention-gate.ts',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }
}

function testOverviewRecordsFoundryMeasurementAndNonClaims(): void {
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );

  for (const expected of [
    'The fabric strengthens shadow mode and Policy Foundry.',
    'Goodhart protection is required',
    'measurement-degraded',
    'false admit risk count',
    'policy gap closure rate',
    'NIST AI RMF conformance',
    'automatic policy activation',
    'that measurement metrics can tune enforcement',
    'that the current repository implements the Signal Relationship Fabric',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }
}

function testResearchAnnexRecordsCrossDomainAnchors(): void {
  const annex = readProjectFile(
    'docs',
    'research',
    'cross-domain-pattern-sources.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Cross-Domain Pattern Sources For Consequence Runtime Assurance',
    'source domain pattern',
    'STPA / STAMP',
    'NASA FMEA Tool',
    'NRC Fault Tree Handbook',
    'NIST AI RMF',
    'Google SRE, Embracing Risk',
    'OWASP Agentic AI threats and mitigations',
    'Pearl, Causality',
    'System Dynamics Society',
    'Only AI RMF-mappable language is claimed, not conformance.',
    'Every future fabric mutation must run replay/backtest regression.',
  ]) {
    includes(annex, expected, `Research annex: records ${expected}`);
  }

  assert.equal(
    packageJson.scripts['test:consequence-runtime-assurance-overview'],
    'tsx tests/consequence-runtime-assurance-overview.test.ts',
    'Consequence runtime assurance overview: package script is registered',
  );
  passed += 1;
}

testOverviewRecordsOneEngineAndAuthoritySplit();
testOverviewRecordsContractShapeAndSequence();
testOverviewRecordsFoundryMeasurementAndNonClaims();
testResearchAnnexRecordsCrossDomainAnchors();

console.log(`Consequence runtime assurance overview tests: ${passed} passed, 0 failed`);
