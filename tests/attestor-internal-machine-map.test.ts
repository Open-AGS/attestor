import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_ADMISSION_CHECK_KINDS,
  CONSEQUENCE_ADMISSION_DECISIONS,
} from '../src/consequence-admission/index.js';

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
  assert.equal(
    unexpected.test(content),
    false,
    `${message}\nUnexpected pattern: ${unexpected}`,
  );
  passed += 1;
}

function testMachineMapExistsAndNamesTheCorePath(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');

  includes(doc, '# Attestor Internal Machine Map', 'Machine map: document exists');
  includes(doc, 'engine-level internal map', 'Machine map: status names engine-level scope');
  includes(doc, 'It is not a claim that every source file', 'Machine map: completeness boundary is explicit');
  includes(doc, '## One-Picture Internal Map', 'Machine map: one-picture diagram section is present');
  includes(doc, '../assets/attestor-internal-machine-map.svg', 'Machine map: readable SVG is embedded');
  includes(doc, 'AI / workflow proposes an action', 'Machine map: source side is explicit');
  includes(doc, 'admission PDP', 'Machine map: PDP is explicit');
  includes(doc, 'protected release authorization', 'Machine map: release proof layer is explicit');
  includes(doc, 'enforcement PEP', 'Machine map: PEP is explicit');
  includes(doc, 'customer gate', 'Machine map: customer gate is explicit');
  includes(doc, 'real action or nothing happens', 'Machine map: terminal split is explicit');
  excludes(doc, /```mermaid/u, 'Machine map: document uses the SVG poster, not Mermaid');

  includes(svg, '<svg', 'Machine map SVG: svg exists');
  includes(svg, 'Attestor Full Consequence Path Map', 'Machine map SVG: title is updated');
  includes(svg, 'AI AGENT / WORKFLOW', 'Machine map SVG: AI source is visible');
  includes(svg, 'ACTION INTENT NORMALIZER', 'Machine map SVG: normalizer is visible');
  includes(svg, 'PIP: Policy / Evidence / Context Inputs', 'Machine map SVG: PIP panel is visible');
  includes(svg, 'PDP: CONSEQUENCE', 'Machine map SVG: PDP is visible');
  includes(svg, 'PAP / Release Authorization Layer', 'Machine map SVG: release authorization is visible');
  includes(svg, 'PEP: Release Enforcement Verifier', 'Machine map SVG: enforcement verifier is visible');
  includes(svg, 'Customer Gate / Downstream PEP', 'Machine map SVG: customer gate is visible');
  includes(svg, 'REAL DOWNSTREAM ACTION', 'Machine map SVG: real action terminal is visible');
  includes(svg, 'NOTHING HAPPENS', 'Machine map SVG: no-action terminal is visible');
  includes(svg, 'Digest-Only Proof Packet / Audit Output', 'Machine map SVG: proof packet is visible');
}

function testMachineMapNamesTheBranchingSemantics(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');

  for (const decision of CONSEQUENCE_ADMISSION_DECISIONS) {
    includes(doc, `\`${decision}\``, `Machine map: decision ${decision} is documented`);
    includes(svg, decision, `Machine map SVG: decision ${decision} is visible`);
  }

  for (const checkKind of CONSEQUENCE_ADMISSION_CHECK_KINDS) {
    includes(doc, checkKind, `Machine map: admission check ${checkKind} is documented`);
  }

  for (const expected of [
    'review/block produces proof-only hold',
    'no executable authority',
    'protected release token',
    'online introspection',
    'replay consumption',
    'sender-constrained presentation',
    'wrong tenant',
    'wrong target/audience',
    'replayed authorization',
    'scope outside allowed bounds',
  ]) {
    includes(`${doc}\n${svg}`, expected, `Machine map: branch rule ${expected} is visible`);
  }
}

function testMachineMapPreservesAuthorityBoundariesAndNoClaims(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');

  for (const expected of [
    '| PIP | Policy Information Point',
    '| PAP | Policy Administration Point',
    '| PDP | Policy Decision Point',
    '| PEP | Policy Enforcement Point',
    'NIST SP 800-162',
    'OASIS XACML 3.0 core specification',
    'not a generic access-control product claim',
    'Production: customer-owned and customer-operated.',
    'This is where non-bypassability must be proven in a real customer deployment.',
  ]) {
    includes(`${doc}\n${svg}`, expected, `Machine map: authority boundary ${expected} is present`);
  }

  for (const expected of [
    'not production readiness',
    'not enterprise readiness',
    'not live customer PEP no-bypass',
    'not live shared replay/introspection stores',
    'not external KMS/HSM-backed runtime signing',
    'not customer deployment',
    'compliance certification',
  ]) {
    includes(`${doc}\n${svg}`, expected, `Machine map: no-claim ${expected} is visible`);
  }
}

function testMachineMapLinksAndSourceAreasArePresent(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');
  const readme = readProjectFile('README.md');
  const overview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'src/api/*',
    'src/consequence-admission/*',
    'src/release-kernel/*',
    'src/release-layer/*',
    'src/release-policy-control-plane/*',
    'src/release-enforcement-plane/*',
    'src/consequence-admission/customer-gate.ts',
    'src/service/*',
    'src/signing/*',
    'Shadow-to-policy modules inform future policy; they are not the enforcement edge.',
  ]) {
    includes(`${doc}\n${svg}`, expected, `Machine map: source area ${expected} is mapped`);
  }

  includes(
    overview,
    '[Attestor internal machine map](attestor-internal-machine-map.md)',
    'Machine map: system overview links the internal map',
  );
  includes(
    readme,
    'href="docs/02-architecture/attestor-internal-machine-map.md"',
    'Machine map: README has a primary link to the internal map',
  );
  includes(
    readme,
    'View the full consequence path map',
    'Machine map: README primary link names the full consequence path map',
  );
  assert.equal(
    packageJson.scripts['test:attestor-internal-machine-map'],
    'tsx tests/attestor-internal-machine-map.test.ts',
    'Machine map: package script is registered',
  );
  passed += 1;
}

testMachineMapExistsAndNamesTheCorePath();
testMachineMapNamesTheBranchingSemantics();
testMachineMapPreservesAuthorityBoundariesAndNoClaims();
testMachineMapLinksAndSourceAreasArePresent();

console.log(`Attestor internal machine map tests: ${passed} passed, 0 failed`);
