import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  assuranceCaseContractDescriptor,
  createAssuranceCaseContract,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  evaluateAssuranceCaseModuleComposition,
  evaluateAssuranceCaseScopeChange,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
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

function throws(fn: () => unknown, pattern: RegExp, message: string): void {
  assert.throws(fn, pattern, message);
  passed += 1;
}

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const digestE = `sha256:${'e'.repeat(64)}`;
const digestF = `sha256:${'f'.repeat(64)}`;
const digest0 = `sha256:${'0'.repeat(64)}`;
const digest1 = `sha256:${'1'.repeat(64)}`;
const digest2 = `sha256:${'2'.repeat(64)}`;
const digest3 = `sha256:${'3'.repeat(64)}`;

function claimNode(overrides?: {
  readonly nodeId?: string;
  readonly tenantRefDigest?: string;
  readonly kind?: 'claim' | 'evidence' | 'context';
}): AssuranceCaseNode {
  return createAssuranceCaseNode({
    nodeId: overrides?.nodeId ?? 'claim:refund-authority',
    kind: overrides?.kind ?? 'claim',
    title: 'Refund authority claim',
    bodyDigest: digestB,
    tenantRefDigest: overrides?.tenantRefDigest ?? digestA,
    scopeDigest: digestC,
    createdByRefDigest: digestD,
    createdAt: '2026-05-18T09:00:00.000Z',
  });
}

function evidenceNode(): AssuranceCaseNode {
  return createAssuranceCaseNode({
    nodeId: 'evidence:shadow-cohort',
    kind: 'evidence',
    title: 'Shadow cohort evidence',
    bodyDigest: digestE,
    tenantRefDigest: digestA,
    scopeDigest: digestC,
    createdByRefDigest: digestD,
    createdAt: '2026-05-18T09:01:00.000Z',
    sourceStandards: ['sacm-2.3-aligned-substrate', 'eliminative-argumentation'],
  });
}

function defeater(overrides?: {
  readonly defeaterId?: string;
  readonly state?: 'open' | 'closed-by-evidence' | 'closed-by-scope' | 'residual-accepted';
  readonly tenantRefDigest?: string;
  readonly attacksNodeId?: string;
}): AssuranceCaseDefeater {
  const state = overrides?.state ?? 'open';
  return createAssuranceCaseDefeater({
    defeaterId: overrides?.defeaterId ?? 'defeater:cohort-poisoned',
    kind: 'undermining',
    state,
    attacksNodeId: overrides?.attacksNodeId ?? 'claim:refund-authority',
    reasonDigest: digestF,
    tenantRefDigest: overrides?.tenantRefDigest ?? digestA,
    openedByRefDigest: digest0,
    openedAt: '2026-05-18T09:02:00.000Z',
    closedByEvidenceDigest: state === 'closed-by-evidence' ? digest1 : null,
    closedByRefDigest: state === 'closed-by-evidence' || state === 'closed-by-scope'
      ? digest2
      : null,
    closedAt: state === 'closed-by-evidence' || state === 'closed-by-scope'
      ? '2026-05-18T09:03:00.000Z'
      : null,
    residualReasonDigest: state === 'closed-by-scope' || state === 'residual-accepted'
      ? digest3
      : null,
    residualAcceptedByRefDigest: state === 'residual-accepted' ? digest2 : null,
    residualAcceptedAt: state === 'residual-accepted'
      ? '2026-05-18T09:03:00.000Z'
      : null,
  });
}

function transition() {
  return createAssuranceCaseTransition({
    transitionId: 'transition:open-defeater',
    transitionKind: 'open-defeater',
    actorRefDigest: digest0,
    occurredAt: '2026-05-18T09:02:00.000Z',
    reasonDigest: digestF,
    defeaterId: 'defeater:cohort-poisoned',
    fromState: null,
    toState: 'open',
  });
}

function testDescriptorRecordsBoundaries(): void {
  const descriptor = assuranceCaseContractDescriptor();

  equal(descriptor.version, ASSURANCE_CASE_CONTRACT_VERSION, 'Assurance case: version is explicit');
  equal(descriptor.sacmVersionTarget, 'SACM 2.3', 'Assurance case: targets current SACM vocabulary');
  equal(descriptor.sacmAlignedNotConformant, true, 'Assurance case: does not overclaim SACM conformance');
  ok(descriptor.nodeKinds.includes('claim'), 'Assurance case: claim nodes are represented');
  ok(descriptor.nodeKinds.includes('evidence'), 'Assurance case: evidence nodes are represented');
  ok(descriptor.defeaterKinds.includes('rebutting'), 'Assurance case: rebutting defeaters are represented');
  ok(descriptor.defeaterKinds.includes('undermining'), 'Assurance case: undermining defeaters are represented');
  ok(descriptor.defeaterKinds.includes('undercutting'), 'Assurance case: undercutting defeaters are represented');
  equal(descriptor.gsnRenderViewOnly, true, 'Assurance case: GSN is render view only');
  equal(descriptor.eliminativeArgumentation, true, 'Assurance case: eliminative argumentation is explicit');
  equal(descriptor.assurance2Defeasibility, true, 'Assurance case: Assurance 2.0 defeasibility is explicit');
  equal(descriptor.noRuntimeEngine, true, 'Assurance case: descriptor is not a runtime engine');
  equal(descriptor.noLearning, true, 'Assurance case: descriptor is not learning');
  equal(descriptor.grantsAuthority, false, 'Assurance case: descriptor grants no authority');
  equal(descriptor.canAdmit, false, 'Assurance case: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Assurance case: descriptor cannot enforce');
  equal(descriptor.productionReady, false, 'Assurance case: descriptor is not production readiness');
  ok(descriptor.nonClaims.includes('not-live-enforcement'), 'Assurance case: live enforcement is a non-claim');
  ok(descriptor.nonClaims.includes('not-sacm-conformance-claim'), 'Assurance case: SACM conformance is a non-claim');
}

function testOpenDefeaterPreventsIndefeasibility(): void {
  const rootClaim = claimNode();
  const caseContract = createAssuranceCaseContract({
    caseId: 'case:refund-policy-candidate',
    tenantRefDigest: digestA,
    rootClaimId: rootClaim.nodeId,
    createdAt: '2026-05-18T09:00:00.000Z',
    lastReviewedAt: '2026-05-18T09:10:00.000Z',
    nodes: [rootClaim, evidenceNode()],
    defeaters: [defeater()],
    transitions: [transition()],
    moduleRefDigests: [digestB],
  });

  equal(caseContract.version, ASSURANCE_CASE_CONTRACT_VERSION, 'Assurance case: contract version is explicit');
  equal(caseContract.indefeasible, false, 'Assurance case: open defeater prevents indefeasibility');
  equal(caseContract.openDefeaterCount, 1, 'Assurance case: open defeater is counted');
  equal(caseContract.grantsAuthority, false, 'Assurance case: contract grants no authority');
  equal(caseContract.canAdmit, false, 'Assurance case: contract cannot admit');
  equal(caseContract.activatesEnforcement, false, 'Assurance case: contract cannot enforce');
  equal(caseContract.productionReady, false, 'Assurance case: contract is not production readiness');
  ok(caseContract.caseRefDigest.startsWith('sha256:'), 'Assurance case: case ref digest is present');
  ok(caseContract.digest.startsWith('sha256:'), 'Assurance case: contract digest is present');
}

function testClosedAndResidualDefeatersCanBeIndefeasible(): void {
  const rootClaim = claimNode();
  const caseContract = createAssuranceCaseContract({
    caseId: 'case:refund-policy-candidate',
    tenantRefDigest: digestA,
    rootClaimId: rootClaim.nodeId,
    createdAt: '2026-05-18T09:00:00.000Z',
    lastReviewedAt: '2026-05-18T09:10:00.000Z',
    nodes: [rootClaim, evidenceNode()],
    defeaters: [
      defeater({ defeaterId: 'defeater:closed-by-evidence', state: 'closed-by-evidence' }),
      defeater({ defeaterId: 'defeater:closed-by-scope', state: 'closed-by-scope' }),
      defeater({ defeaterId: 'defeater:residual', state: 'residual-accepted' }),
    ],
    transitions: [],
  });

  equal(caseContract.indefeasible, true, 'Assurance case: no open defeaters can be indefeasible');
  equal(caseContract.openDefeaterCount, 0, 'Assurance case: open defeaters are zero');
  equal(caseContract.closedDefeaterCount, 2, 'Assurance case: closed defeaters are counted separately from residuals');
  equal(caseContract.residualDefeaterCount, 1, 'Assurance case: residual accepted defeaters are counted');
  ok(caseContract.residualDefeatersAccepted.includes('defeater:residual'), 'Assurance case: residual acceptance is attributed');
}

function testInvalidDefeaterStatesFailClosed(): void {
  throws(
    () => createAssuranceCaseDefeater({
      defeaterId: 'defeater:bad',
      kind: 'rebutting',
      state: 'closed-by-evidence',
      attacksNodeId: 'claim:refund-authority',
      reasonDigest: digestF,
      tenantRefDigest: digestA,
      openedByRefDigest: digest0,
      openedAt: '2026-05-18T09:02:00.000Z',
      closedByEvidenceDigest: null,
      closedByRefDigest: digest2,
      closedAt: '2026-05-18T09:03:00.000Z',
    }),
    /closedByEvidenceDigest is required/u,
    'Assurance case: evidence closure requires evidence digest',
  );

  throws(
    () => createAssuranceCaseDefeater({
      defeaterId: 'defeater:bad-open',
      kind: 'undercutting',
      state: 'open',
      attacksNodeId: 'claim:refund-authority',
      reasonDigest: digestF,
      tenantRefDigest: digestA,
      openedByRefDigest: digest0,
      openedAt: '2026-05-18T09:02:00.000Z',
      residualReasonDigest: digest3,
    }),
    /residualReasonDigest must be null/u,
    'Assurance case: open defeater cannot carry residual acceptance material',
  );
}

function testTenantAndRootClaimInvariants(): void {
  const rootClaim = claimNode();

  throws(
    () => createAssuranceCaseContract({
      caseId: 'case:tenant-mismatch',
      tenantRefDigest: digestA,
      rootClaimId: rootClaim.nodeId,
      createdAt: '2026-05-18T09:00:00.000Z',
      lastReviewedAt: '2026-05-18T09:10:00.000Z',
      nodes: [rootClaim, claimNode({ nodeId: 'claim:other', tenantRefDigest: digestB })],
      defeaters: [],
      transitions: [],
    }),
    /node tenantRefDigest mismatch/u,
    'Assurance case: cross-tenant nodes are rejected',
  );

  throws(
    () => createAssuranceCaseContract({
      caseId: 'case:bad-root',
      tenantRefDigest: digestA,
      rootClaimId: 'evidence:shadow-cohort',
      createdAt: '2026-05-18T09:00:00.000Z',
      lastReviewedAt: '2026-05-18T09:10:00.000Z',
      nodes: [rootClaim, evidenceNode()],
      defeaters: [],
      transitions: [],
    }),
    /rootClaimId must reference a claim node/u,
    'Assurance case: root claim must be a claim node',
  );
}

function testScopeBroadeningRequiresNewClaimId(): void {
  const rejected = evaluateAssuranceCaseScopeChange({
    previousClaimId: 'claim:refund-authority',
    nextClaimId: 'claim:refund-authority',
    posture: 'broadens-scope',
  });
  const accepted = evaluateAssuranceCaseScopeChange({
    previousClaimId: 'claim:refund-authority',
    nextClaimId: 'claim:refund-authority:v2',
    posture: 'broadens-scope',
  });

  equal(rejected.accepted, false, 'Assurance case: in-place scope broadening is rejected');
  equal(rejected.requiresNewClaimId, true, 'Assurance case: broadening requires a new claim id');
  equal(rejected.outcome, 'rejected-in-place-scope-broadening', 'Assurance case: rejection outcome is explicit');
  equal(accepted.accepted, true, 'Assurance case: broadened scope with new claim id is accepted as a new claim');
  ok(accepted.digest.startsWith('sha256:'), 'Assurance case: scope evaluation has digest');
}

function testModuleCompositionRequiresClosedCrossModuleDefeaters(): void {
  const open = evaluateAssuranceCaseModuleComposition({
    modules: [
      { moduleRefDigest: digestA, indefeasible: true, openDefeaterCount: 0 },
      { moduleRefDigest: digestB, indefeasible: true, openDefeaterCount: 0 },
    ],
    crossModuleDefeaters: [defeater()],
  });
  const closed = evaluateAssuranceCaseModuleComposition({
    modules: [
      { moduleRefDigest: digestA, indefeasible: true, openDefeaterCount: 0 },
      { moduleRefDigest: digestB, indefeasible: true, openDefeaterCount: 0 },
    ],
    crossModuleDefeaters: [
      defeater({ defeaterId: 'defeater:cross-closed', state: 'closed-by-evidence' }),
    ],
  });

  equal(open.indefeasible, false, 'Assurance case: open cross-module defeater blocks composition');
  equal(open.openCrossModuleDefeaterCount, 1, 'Assurance case: open cross-module defeater is counted');
  equal(closed.indefeasible, true, 'Assurance case: closed cross-module defeaters allow composition');
  ok(closed.digest.startsWith('sha256:'), 'Assurance case: module composition has digest');
}

function testDeterminismAndNoMutation(): void {
  const rootClaim = claimNode();
  const nodes = [rootClaim, evidenceNode()];
  const originalNodes = JSON.stringify(nodes);
  const input = {
    caseId: 'case:deterministic',
    tenantRefDigest: digestA,
    rootClaimId: rootClaim.nodeId,
    createdAt: '2026-05-18T09:00:00.000Z',
    lastReviewedAt: '2026-05-18T09:10:00.000Z',
    nodes,
    defeaters: [defeater({ state: 'closed-by-evidence' })],
    transitions: [transition()],
  };
  const first = createAssuranceCaseContract(input);
  const second = createAssuranceCaseContract(input);

  equal(first.digest, second.digest, 'Assurance case: same input yields same digest');
  equal(JSON.stringify(nodes), originalNodes, 'Assurance case: source node array is not mutated');
  ok(Object.isFrozen(first), 'Assurance case: contract output is frozen');
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'assurance-case-contract.md',
  );
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Assurance Case Contract',
    'I00',
    'SACM 2.3-aligned',
    'Eliminative Argumentation',
    'Assurance 2.0',
    'GSN render view',
    'not a runtime engine',
    'SACM 2.3-aligned, not a SACM certification',
    'does not replace deterministic Attestor gates',
  ]) {
    includes(docs, expected, `Assurance case docs: records ${expected}`);
  }
  includes(overview, '| I00 | complete | Assurance Case Contract |', 'Overview: I00 is tracked');
  includes(overview, 'src/consequence-admission/assurance-case-contract.ts', 'Overview: I00 source file is tracked');
  includes(overview, 'tests/assurance-case-contract.test.ts', 'Overview: I00 test file is tracked');
  assert.equal(
    packageJson.scripts['test:assurance-case-contract'],
    'tsx tests/assurance-case-contract.test.ts',
    'Assurance case: package script is registered',
  );
  passed += 1;
}

testDescriptorRecordsBoundaries();
testOpenDefeaterPreventsIndefeasibility();
testClosedAndResidualDefeatersCanBeIndefeasible();
testInvalidDefeaterStatesFailClosed();
testTenantAndRootClaimInvariants();
testScopeBroadeningRequiresNewClaimId();
testModuleCompositionRequiresClosedCrossModuleDefeaters();
testDeterminismAndNoMutation();
testDocsAndPackageSurface();

console.log(`Assurance case contract tests: ${passed} passed, 0 failed`);
