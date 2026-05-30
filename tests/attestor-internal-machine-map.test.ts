import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_TYPES,
  RELEASE_DECISION_STATUSES,
  RELEASE_DECISION_TERMINAL_STATUSES,
  RISK_CLASSES,
} from '../src/release-kernel/types.js';
import {
  DETERMINISTIC_CONTROL_CATEGORIES,
  RISK_CONTROL_PROFILES,
} from '../src/release-kernel/risk-controls.js';
import {
  CONSEQUENCE_ADMISSION_CHECK_KINDS,
  CONSEQUENCE_ADMISSION_DECISIONS,
  GENERIC_ADMISSION_MODES,
  GENERIC_ADMISSION_SHADOW_DECISIONS,
} from '../src/consequence-admission/index.js';
import {
  CONSEQUENCE_ADMISSION_DOMAINS,
} from '../src/consequence-admission/taxonomy.js';
import {
  CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
  CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS,
} from '../src/consequence-admission/data-minimization-redaction-policy.js';
import {
  CONSEQUENCE_FAILURE_MODE_IDS,
} from '../src/consequence-admission/failure-mode-registry.js';
import {
  CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS,
  CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES,
  CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS,
  CONSEQUENCE_GUARD_ACTIVATION_STATES,
} from '../src/consequence-admission/guard-activation-readiness.js';
import {
  ENFORCEMENT_BOUNDARY_KINDS,
  ENFORCEMENT_FAILURE_REASONS,
  ENFORCEMENT_OUTCOMES,
  ENFORCEMENT_POINT_KINDS,
  ENFORCEMENT_VERIFICATION_MODES,
  RELEASE_PRESENTATION_MODES,
} from '../src/release-enforcement-plane/types.js';

let passed = 0;

const RELEASE_POLICY_ROLLOUT_MODES = [
  'dry-run',
  'canary',
  'enforce',
  'rolled-back',
] as const;

const RELEASE_POLICY_ROLLOUT_REASONS = [
  'dry-run',
  'canary-enforce',
  'canary-shadow',
  'canary-missing-context',
  'enforce',
  'rolled-back',
] as const;

const RELEASE_POLICY_ROLLOUT_COHORT_KEYS = [
  'request-id',
  'output-hash',
  'requester-id',
  'target-id',
  'tenant-id',
  'account-id',
  'plan-id',
  'cohort-id',
] as const;

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

function countLine(label: string, count: number): string {
  return `| ${label} | ${count} |`;
}

function includesEach(
  content: string,
  expectedValues: readonly string[],
  messagePrefix: string,
): void {
  for (const expected of expectedValues) {
    includes(content, expected, `${messagePrefix}: ${expected}`);
  }
}

function testMachineMapExistsAndNamesTheCoreShape(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');

  includes(doc, '# Attestor Internal Machine Map', 'Machine map: document exists');
  includes(doc, 'release PDP + admission PDP -> enforcement PEP', 'Machine map: core shape is explicit');
  includes(doc, '## One-Picture Internal Map', 'Machine map: one-picture diagram section is present');
  includes(doc, '../assets/attestor-internal-machine-map.svg', 'Machine map: readable SVG poster is embedded');
  includes(doc, '## The Ten Decision Axes', 'Machine map: decision axes section is present');
  includes(doc, '## Axis Fan-Out / Fan-In', 'Machine map: fan-out/fan-in section is present');
  includes(doc, '## Decision Points In The Picture', 'Machine map: decision-point section is present');
  includes(doc, '## Result Emergence', 'Machine map: result emergence section is present');
  includes(
    doc,
    'Decision points are diamond nodes.',
    'Machine map: diamond-node convention is explicit',
  );

  const mermaidBlocks = doc.match(/```mermaid/g) ?? [];
  assert.equal(
    mermaidBlocks.length,
    0,
    'Machine map: document uses the readable SVG poster instead of a dense Mermaid block',
  );
  passed += 1;

  for (const expected of [
    '<svg',
    'Attestor Internal Machine Blueprint',
    'Callers, Route Lanes, And Runtime Ingress',
    'Core route group',
    'Public site and proof route group',
    'Auth and account route group',
    'Admin and operator route group',
    'Pipeline route group',
    'Admission and shadow route group',
    'Webhook route group',
    'Ten Decision Axes Applied To The Same Candidate',
    'Policy Control Plane',
    'Release PDP',
    'Domain Packs Into Admission PDP',
    'Admission PDP',
    'Enforcement PEP, Customer Gate, Terminal Outcomes',
    'Shared Stores',
    'Support Surfaces',
    'Shadow-To-Policy Loop',
    'PROCEED',
    'HOLD',
  ]) {
    includes(svg, expected, `Machine map SVG: one-picture map includes ${expected}`);
  }

  for (const axis of [
    '| Time |',
    '| Identity |',
    '| Content |',
    '| Evidence |',
    '| Risk |',
    '| Scope / intent |',
    '| Rollout |',
    '| Consequence |',
    '| Human |',
    '| Cryptography |',
  ]) {
    includes(doc, axis, `Machine map: axis row ${axis} exists`);
  }
}

function testMachineMapNamesEveryHighLevelDecisionPoint(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');

  for (const expected of [
    ['Entry path / route lane', 'Entry path'],
    ['Policy resolution', 'Policy resolution'],
    ['Rollout resolution', 'Rollout resolution'],
    ['Deterministic release check aggregate', 'Deterministic checks'],
    ['ReleaseDecision', 'ReleaseDecision'],
    ['Admission mode ladder', 'Admission mode ladder'],
    ['Required admission checks satisfied?', 'Required admission checks'],
    ['Canonical decision', 'Canonical decision'],
    ['Protected release token required?', 'Protected token required?'],
    ['Enforcement path', 'Enforcement path'],
    ['Presentation mode acceptable?', 'Presentation mode ok?'],
    ['Offline verification valid?', 'Offline verification'],
    ['Online verification required and valid?', 'Online verification'],
    ['Enforcement result', 'Enforcement result'],
    ['Customer gate', 'Customer gate'],
  ]) {
    const [docText, svgText] = expected;
    includes(doc, docText, `Machine map: decision point ${docText} is named`);
    includes(svg, svgText, `Machine map SVG: decision point ${svgText} is visible`);
  }
}

function testMachineMapNamesEveryTopLevelSourceDirectory(): void {
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');
  const sourceRoot = join(process.cwd(), 'src');
  const sourceDirectories = readdirSync(sourceRoot)
    .filter((entry) => statSync(join(sourceRoot, entry)).isDirectory())
    .sort((left, right) => left.localeCompare(right));

  for (const directory of sourceDirectories) {
    includes(
      svg,
      `src/${directory}`,
      `Machine map SVG: top-level source directory src/${directory} is visible`,
    );
  }
}

function testMachineMapCountsStayAlignedWithSourceConstants(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');

  for (const [label, count] of [
    ['Release consequence types', CONSEQUENCE_TYPES.length],
    ['Risk classes', RISK_CLASSES.length],
    ['Release decision statuses', RELEASE_DECISION_STATUSES.length],
    ['Terminal release statuses', RELEASE_DECISION_TERMINAL_STATUSES.length],
    ['Deterministic control categories', DETERMINISTIC_CONTROL_CATEGORIES.length],
    ['Admission decisions', CONSEQUENCE_ADMISSION_DECISIONS.length],
    ['Generic admission modes', GENERIC_ADMISSION_MODES.length],
    ['Generic shadow decisions', GENERIC_ADMISSION_SHADOW_DECISIONS.length],
    ['Consequence admission checks', CONSEQUENCE_ADMISSION_CHECK_KINDS.length],
    ['Consequence admission domains', CONSEQUENCE_ADMISSION_DOMAINS.length],
    ['Data minimization surfaces', CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS.length],
    ['Forbidden raw data classes', CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES.length],
    ['Failure modes', CONSEQUENCE_FAILURE_MODE_IDS.length],
    ['Enforcement point kinds', ENFORCEMENT_POINT_KINDS.length],
    ['Enforcement boundary kinds', ENFORCEMENT_BOUNDARY_KINDS.length],
    ['Enforcement verification modes', ENFORCEMENT_VERIFICATION_MODES.length],
    ['Release presentation modes', RELEASE_PRESENTATION_MODES.length],
    ['Enforcement outcomes', ENFORCEMENT_OUTCOMES.length],
    ['Enforcement failure reasons', ENFORCEMENT_FAILURE_REASONS.length],
  ] as const) {
    includes(doc, countLine(label, count), `Machine map: count for ${label} is current`);
  }

  includes(doc, '| Release rollout modes | 4 |', 'Machine map: rollout mode count is recorded');
  includes(doc, '| Release rollout reasons | 6 |', 'Machine map: rollout reason count is recorded');
  includes(doc, '| Public package entrypoints | 9 |', 'Machine map: package entrypoint count is recorded');
}

function testMachineMapSvgExposesRepoSourcedValueSets(): void {
  const svg = readProjectFile('docs', 'assets', 'attestor-internal-machine-map.svg');
  const guardActivationReadinessLabel =
    `Guard Activation Readiness Matrix (${CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS.length} covered profiles x ` +
    `${CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS.length} criteria x ` +
    `${CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES.length} statuses)`;

  for (const expected of [
    'Risk x Control Matrix',
    'Release Rollout Matrix',
    'Release Decision Status Value Set',
    'Release Presentation Modes (6) And Enforcement Outcomes',
    guardActivationReadinessLabel,
    'Guard Criteria (1-11)',
    'Guard Status / State Vocabulary',
    'Enforcement Failure Reasons (23)',
    'Failure Mode Registry (20 modes)',
    'Data Minimization Surfaces (34)',
    'Forbidden Raw Data Classes (15)',
    '34x15 Redaction Matrix Rule',
    'Tenant perimeter',
    'KMS / signer boundary',
    'Downstream contract boundary',
  ]) {
    includes(svg, expected, `Machine map SVG: blueprint value panel ${expected} is visible`);
  }

  includesEach(svg, CONSEQUENCE_TYPES, 'Machine map SVG: consequence type is visible');
  includesEach(svg, RISK_CLASSES, 'Machine map SVG: risk class is visible');
  includesEach(svg, RELEASE_DECISION_STATUSES, 'Machine map SVG: release status is visible');
  includesEach(
    svg,
    RELEASE_DECISION_TERMINAL_STATUSES,
    'Machine map SVG: terminal release status is visible',
  );
  includesEach(
    svg,
    DETERMINISTIC_CONTROL_CATEGORIES,
    'Machine map SVG: deterministic check is visible',
  );
  includesEach(
    svg,
    RELEASE_POLICY_ROLLOUT_MODES,
    'Machine map SVG: rollout mode is visible',
  );
  includesEach(
    svg,
    RELEASE_POLICY_ROLLOUT_REASONS,
    'Machine map SVG: rollout reason is visible',
  );
  includesEach(
    svg,
    RELEASE_POLICY_ROLLOUT_COHORT_KEYS,
    'Machine map SVG: rollout cohort key is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_ADMISSION_DECISIONS,
    'Machine map SVG: admission decision is visible',
  );
  includesEach(svg, GENERIC_ADMISSION_MODES, 'Machine map SVG: generic mode is visible');
  includesEach(
    svg,
    GENERIC_ADMISSION_SHADOW_DECISIONS,
    'Machine map SVG: generic shadow decision is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_ADMISSION_CHECK_KINDS,
    'Machine map SVG: admission check is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_ADMISSION_DOMAINS,
    'Machine map SVG: admission domain is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_DATA_MINIMIZATION_SURFACE_KINDS,
    'Machine map SVG: data-minimization surface is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_DATA_MINIMIZATION_FORBIDDEN_RAW_CLASSES,
    'Machine map SVG: forbidden raw data class is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_FAILURE_MODE_IDS,
    'Machine map SVG: failure mode is visible',
  );
  includesEach(
    svg,
    ENFORCEMENT_POINT_KINDS,
    'Machine map SVG: enforcement point kind is visible',
  );
  includesEach(
    svg,
    ENFORCEMENT_BOUNDARY_KINDS,
    'Machine map SVG: enforcement boundary kind is visible',
  );
  includesEach(
    svg,
    ENFORCEMENT_VERIFICATION_MODES,
    'Machine map SVG: enforcement verification mode is visible',
  );
  includesEach(
    svg,
    RELEASE_PRESENTATION_MODES,
    'Machine map SVG: release presentation mode is visible',
  );
  includesEach(svg, ENFORCEMENT_OUTCOMES, 'Machine map SVG: enforcement outcome is visible');
  includesEach(
    svg,
    ENFORCEMENT_FAILURE_REASONS,
    'Machine map SVG: enforcement failure reason is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_GUARD_ACTIVATION_GUARD_IDS,
    'Machine map SVG: guard id is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_GUARD_ACTIVATION_CRITERION_IDS,
    'Machine map SVG: guard criterion is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_GUARD_ACTIVATION_CRITERION_STATUSES,
    'Machine map SVG: guard criterion status is visible',
  );
  includesEach(
    svg,
    CONSEQUENCE_GUARD_ACTIVATION_STATES,
    'Machine map SVG: guard activation state is visible',
  );

  for (const riskClass of RISK_CLASSES) {
    const profile = RISK_CONTROL_PROFILES[riskClass];
    includes(svg, profile.review.mode, `Machine map SVG: review mode for ${riskClass} is visible`);
    includes(
      svg,
      profile.token.minimumEnforcement,
      `Machine map SVG: token enforcement for ${riskClass} is visible`,
    );
    includes(
      svg,
      profile.evidence.retentionClass,
      `Machine map SVG: evidence retention for ${riskClass} is visible`,
    );
    includes(
      svg,
      `${profile.token.maxTtlSeconds}s`,
      `Machine map SVG: token TTL for ${riskClass} is visible`,
    );
  }
}

function testMachineMapLinksAndFolderViewArePresent(): void {
  const doc = readProjectFile('docs', '02-architecture', 'attestor-internal-machine-map.md');
  const readme = readProjectFile('README.md');
  const overview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'src/release-kernel/*',
    'src/release-policy-control-plane/*',
    'src/consequence-admission/index.ts',
    'src/release-enforcement-plane/*',
    'src/consequence-admission/customer-gate.ts',
    'src/crypto-execution-admission/*',
    'src/service/*',
    'src/consequence-admission/policy-foundry-*.ts',
  ]) {
    includes(doc, expected, `Machine map: source area ${expected} is mapped`);
  }

  includes(
    overview,
    '[Attestor internal machine map](attestor-internal-machine-map.md)',
    'Machine map: system overview links the raw structure map',
  );
  includes(
    readme,
    '[Attestor internal machine map](docs/02-architecture/attestor-internal-machine-map.md)',
    'Machine map: README links the one-picture internal map',
  );
  assert.equal(
    packageJson.scripts['test:attestor-internal-machine-map'],
    'tsx tests/attestor-internal-machine-map.test.ts',
    'Machine map: package script is registered',
  );
  passed += 1;
}

testMachineMapExistsAndNamesTheCoreShape();
testMachineMapNamesEveryHighLevelDecisionPoint();
testMachineMapNamesEveryTopLevelSourceDirectory();
testMachineMapCountsStayAlignedWithSourceConstants();
testMachineMapSvgExposesRepoSourcedValueSets();
testMachineMapLinksAndFolderViewArePresent();

console.log(`Attestor internal machine map tests: ${passed} passed, 0 failed`);
