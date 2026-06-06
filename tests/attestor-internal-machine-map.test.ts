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

function testMachineMapExistsAndUsesTheTextDiagram(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');

  includes(doc, '# Attestor Internal Machine Map', 'Machine map: document exists');
  includes(doc, 'engine-level internal map', 'Machine map: status names engine-level scope');
  includes(doc, 'It is not a claim that every source file', 'Machine map: completeness boundary is explicit');
  includes(doc, '## Full Consequence Path Map', 'Machine map: full consequence path section is present');
  includes(doc, '```text', 'Machine map: diagram is a plain text block');
  includes(doc, '┌──────────────────────────────────────────────────────────────────────┐', 'Machine map: box-drawing frame is present');
  includes(doc, '│ AI AGENT / WORKFLOW                                                   │', 'Machine map: AI source box is present');
  includes(doc, '│ ACTION INTENT NORMALIZER                                              │', 'Machine map: normalizer box is present');
  includes(doc, '│ PIP: POLICY / EVIDENCE / CONTEXT INPUTS                              │', 'Machine map: PIP box is present');
  includes(doc, '│ PDP: CONSEQUENCE ADMISSION CORE                                       │', 'Machine map: PDP box is present');
  includes(doc, '│ PAP / RELEASE AUTHORIZATION LAYER                                    │', 'Machine map: release authorization box is present');
  includes(doc, '│ RELEASE ENFORCEMENT VERIFIER                                         │', 'Machine map: enforcement verifier box is present');
  includes(doc, '│ CUSTOMER GATE / DOWNSTREAM PEP                                       │', 'Machine map: customer gate box is present');
  includes(doc, '│ REAL DOWNSTREAM ACTION                                                │', 'Machine map: real action terminal is present');
  includes(doc, '│ PROOF PACKET / AUDIT OUTPUT                                           │', 'Machine map: proof packet terminal is present');
  excludes(doc, /!\[[^\]]*\]\(\.\.\/assets\/attestor-internal-machine-map\.svg\)/u, 'Machine map: SVG image embed is not used');
  excludes(doc, /Open full-size SVG/u, 'Machine map: full-size SVG link is not used');
  excludes(doc, /```mermaid/u, 'Machine map: Mermaid is not used for this map');
}

function testMachineMapNamesTheBranchingSemantics(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');

  for (const decision of CONSEQUENCE_ADMISSION_DECISIONS) {
    includes(doc, `\`${decision}\``, `Machine map: decision ${decision} is documented`);
  }

  for (const expected of ['ADMIT', 'NARROW', 'REVIEW', 'REVIEW/BLOCK', 'NO EXECUTION']) {
    includes(doc, expected, `Machine map: branch ${expected} is visible in the text diagram`);
  }

  for (const checkKind of CONSEQUENCE_ADMISSION_CHECK_KINDS) {
    includes(doc, checkKind, `Machine map: admission check ${checkKind} is documented`);
  }

  for (const expected of [
    'No executable release should be treated as authority',
    'protected release token',
    'online introspection',
    'replay consumption',
    'sender-constrained presentation',
    'wrong tenant',
    'wrong target or audience',
    'replayed authorization',
    'scope outside allowed bounds',
  ]) {
    includes(doc, expected, `Machine map: branch rule ${expected} is visible`);
  }
}

function testMachineMapPreservesAuthorityBoundaries(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');

  for (const expected of [
    '| PIP | Policy Information Point',
    '| PAP | Policy Administration Point',
    '| PDP | Policy Decision Point',
    '| PEP | Policy Enforcement Point',
    'NIST SP 800-162',
    'OASIS XACML 3.0 core specification',
    'not a generic access-control product claim',
    'Production: customer-owned, customer-operated.',
    'This is where non-bypassability must be proven in a real customer deployment.',
  ]) {
    includes(doc, expected, `Machine map: authority boundary ${expected} is present`);
  }

  for (const expected of [
    '## Proof Boundary',
    'internal consequence path only',
    'Production operation',
    'enterprise readiness',
    'customer deployment',
    'live customer PEP non-bypassability',
    'shared replay/introspection stores',
    'external key-backed signing',
    'compliance certification',
    'separate proof obligations',
  ]) {
    includes(doc, expected, `Machine map: proof boundary ${expected} is visible`);
  }

  excludes(doc, /## No-Claims/u, 'Machine map: avoids a separate no-claims list section');
  excludes(doc, /- not production readiness/u, 'Machine map: avoids long negative bullet lists');
}

function testMachineMapLinksAndSourceAreasArePresent(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
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
    'informs future policy but is not the enforcement edge.',
  ]) {
    includes(doc, expected, `Machine map: source area ${expected} is mapped`);
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
    'Machine map: README primary link name is preserved',
  );
  assert.equal(
    packageJson.scripts['test:attestor-internal-machine-map'],
    'tsx tests/attestor-internal-machine-map.test.ts',
    'Machine map: package script is registered',
  );
  passed += 1;
}

testMachineMapExistsAndUsesTheTextDiagram();
testMachineMapNamesTheBranchingSemantics();
testMachineMapPreservesAuthorityBoundaries();
testMachineMapLinksAndSourceAreasArePresent();

console.log(`Attestor internal machine map tests: ${passed} passed, 0 failed`);
