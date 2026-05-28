import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  DECISION_LINEAGE_GRAPH_VERSION,
  createAssuranceCaseContract,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  createDecisionLineageGraph,
  decisionLineageGraphDescriptor,
  type AssuranceCaseContract,
  type DecisionLineageArtifactRefInput,
  type DecisionLineageSignatureRefInput,
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

function sha(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const tenantDigest = sha('tenant:decision-lineage');
const scopeDigest = sha('scope:refund-policy');
const actorDigest = sha('actor:decision-lineage-builder');
const reviewerDigest = sha('reviewer:decision-lineage');
const claimBodyDigest = sha('claim:refund authority is evidence-bound');
const strategyBodyDigest = sha('strategy:review open defeat before promotion');
const evidenceBodyDigest = sha('evidence:runtime monitor record ready');
const defeaterReasonDigest = sha('defeater:runtime evidence not yet reviewed');
const transitionReasonDigest = sha('transition:lineage fixture');

function fixtureAssuranceCase(openDefeater = false): AssuranceCaseContract {
  const claim = createAssuranceCaseNode({
    nodeId: 'claim:refund-authority',
    kind: 'claim',
    title: 'Refund authority candidate is bounded',
    bodyDigest: claimBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T18:00:00.000Z',
  });
  const strategy = createAssuranceCaseNode({
    nodeId: 'strategy:refund-authority',
    kind: 'strategy',
    title: 'Review open defeat before promotion',
    bodyDigest: strategyBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T18:00:01.000Z',
  });
  const evidence = createAssuranceCaseNode({
    nodeId: 'evidence:runtime-monitor',
    kind: 'evidence',
    title: 'Runtime monitor observation',
    bodyDigest: evidenceBodyDigest,
    tenantRefDigest: tenantDigest,
    scopeDigest,
    createdByRefDigest: actorDigest,
    createdAt: '2026-05-18T18:00:02.000Z',
  });
  const transitions = [
    createAssuranceCaseTransition({
      transitionId: 'transition:create:claim',
      transitionKind: 'create-node',
      actorRefDigest: actorDigest,
      occurredAt: '2026-05-18T18:00:03.000Z',
      reasonDigest: transitionReasonDigest,
      nodeId: claim.nodeId,
      evidenceRefDigest: claim.digest,
    }),
    createAssuranceCaseTransition({
      transitionId: 'transition:create:strategy',
      transitionKind: 'create-node',
      actorRefDigest: actorDigest,
      occurredAt: '2026-05-18T18:00:04.000Z',
      reasonDigest: transitionReasonDigest,
      nodeId: strategy.nodeId,
      evidenceRefDigest: strategy.digest,
    }),
    createAssuranceCaseTransition({
      transitionId: 'transition:create:evidence',
      transitionKind: 'create-node',
      actorRefDigest: actorDigest,
      occurredAt: '2026-05-18T18:00:05.000Z',
      reasonDigest: transitionReasonDigest,
      nodeId: evidence.nodeId,
      evidenceRefDigest: evidence.digest,
    }),
  ];
  const defeaters = openDefeater
    ? [createAssuranceCaseDefeater({
        defeaterId: 'defeater:runtime-monitor-gap',
        kind: 'undermining',
        state: 'open',
        attacksNodeId: claim.nodeId,
        reasonDigest: defeaterReasonDigest,
        tenantRefDigest: tenantDigest,
        openedByRefDigest: reviewerDigest,
        openedAt: '2026-05-18T18:00:06.000Z',
      })]
    : [];
  const defeaterTransitions = openDefeater
    ? [createAssuranceCaseTransition({
        transitionId: 'transition:open:defeater-runtime-monitor-gap',
        transitionKind: 'open-defeater',
        actorRefDigest: reviewerDigest,
        occurredAt: '2026-05-18T18:00:07.000Z',
        reasonDigest: transitionReasonDigest,
        defeaterId: 'defeater:runtime-monitor-gap',
        toState: 'open',
        evidenceRefDigest: defeaterReasonDigest,
      })]
    : [];

  return createAssuranceCaseContract({
    caseId: openDefeater
      ? 'case:refund-authority-open'
      : 'case:refund-authority-ready',
    tenantRefDigest: tenantDigest,
    rootClaimId: claim.nodeId,
    createdAt: '2026-05-18T18:00:00.000Z',
    lastReviewedAt: '2026-05-18T18:10:00.000Z',
    nodes: [claim, strategy, evidence],
    defeaters,
    transitions: [...transitions, ...defeaterTransitions],
  });
}

function fixtureArtifact(caseContract: AssuranceCaseContract): DecisionLineageArtifactRefInput {
  return {
    artifactId: 'artifact:runtime-monitor-record',
    artifactKind: 'runtime-monitor-record',
    artifactDigest: sha('runtime-monitor-record:digest'),
    sourceVersion: 'attestor.runtime-monitor-skeleton.v1',
    producedAt: '2026-05-18T18:01:00.000Z',
    producerRefDigest: actorDigest,
    targetNodeId: caseContract.nodes.find((node) => node.kind === 'evidence')?.nodeId,
  };
}

function signaturesFor(
  caseContract: AssuranceCaseContract,
  artifacts: readonly DecisionLineageArtifactRefInput[],
): readonly DecisionLineageSignatureRefInput[] {
  const subjects = [
    caseContract.digest,
    ...caseContract.nodes.map((node) => node.digest),
    ...caseContract.defeaters.map((defeater) => defeater.digest),
    ...caseContract.transitions.map((transition) => transition.digest),
    ...artifacts.map((artifact) => artifact.artifactDigest),
  ];
  return subjects.map((subject, index) => ({
    signatureId: `signature:${index}`,
    envelopeKind: index % 2 === 0 ? 'dsse' : 'in-toto-statement',
    signatureRefDigest: sha(`signature:${index}:${subject}`),
    signerRefDigest: actorDigest,
    signedSubjectDigest: subject,
    signedAt: '2026-05-18T18:02:00.000Z',
  }));
}

function testDescriptorDeclaresDigestOnlyLineageBoundary(): void {
  const descriptor = decisionLineageGraphDescriptor();

  equal(descriptor.version, DECISION_LINEAGE_GRAPH_VERSION, 'Decision lineage: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'Decision lineage: assurance case version is bound');
  ok(descriptor.sourceAnchors.includes('w3c-prov-entity-activity-agent'), 'Decision lineage: PROV anchor is present');
  ok(descriptor.sourceAnchors.includes('openlineage-run-job-dataset-facets'), 'Decision lineage: OpenLineage anchor is present');
  ok(descriptor.sourceAnchors.includes('in-toto-statement-subject-predicate'), 'Decision lineage: in-toto anchor is present');
  ok(descriptor.sourceAnchors.includes('dsse-envelope-payloadtype-signatures'), 'Decision lineage: DSSE anchor is present');
  equal(descriptor.buildsDigestBoundDag, true, 'Decision lineage: digest-bound DAG is declared');
  equal(descriptor.tracksSignedSubjectsOnly, true, 'Decision lineage: signatures are references only');
  equal(descriptor.doesNotCreateSignatures, true, 'Decision lineage: descriptor creates no signature');
  equal(descriptor.noExternalLineageExport, true, 'Decision lineage: no external lineage export');
  equal(descriptor.noAuditWrite, true, 'Decision lineage: no audit write');
  equal(descriptor.canAdmit, false, 'Decision lineage: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Decision lineage: descriptor cannot enforce');
  ok(descriptor.nonClaims.includes('not-openlineage-export'), 'Decision lineage: OpenLineage export non-claim is present');
  ok(descriptor.nonClaims.includes('not-dsse-or-in-toto-signer'), 'Decision lineage: signer non-claim is present');
}

function testReadyGraphBindsCaseArtifactsTransitionsAndSignatures(): void {
  const caseContract = fixtureAssuranceCase();
  const artifact = fixtureArtifact(caseContract);
  const record = createDecisionLineageGraph({
    assuranceCase: caseContract,
    lineageId: 'lineage:refund-authority',
    generatedAt: '2026-05-18T18:03:00.000Z',
    builderRefDigest: actorDigest,
    artifactRefs: [artifact],
    signatureRefs: signaturesFor(caseContract, [artifact]),
    requireSignatureCoverage: true,
  });

  equal(record.version, DECISION_LINEAGE_GRAPH_VERSION, 'Decision lineage: record version is explicit');
  equal(record.outcome, 'decision-lineage-graph-ready', 'Decision lineage: fully signed graph is ready');
  equal(record.findings.length, 0, 'Decision lineage: ready graph has no findings');
  equal(record.missingSignatureCoverageDigests.length, 0, 'Decision lineage: no signature coverage gap');
  equal(record.artifactCount, 1, 'Decision lineage: artifact ref is counted');
  equal(record.signatureCount, record.requiredSubjectDigests.length, 'Decision lineage: every required subject is signed');
  ok(record.graphNodes.some((node) => node.kind === 'case'), 'Decision lineage: case node exists');
  ok(record.graphNodes.some((node) => node.kind === 'artifact'), 'Decision lineage: artifact node exists');
  ok(record.graphNodes.some((node) => node.kind === 'signature'), 'Decision lineage: signature nodes exist');
  ok(record.graphEdges.some((edge) => edge.kind === 'signature-covers'), 'Decision lineage: signature coverage edge exists');
  ok(record.graphEdges.some((edge) => edge.kind === 'supports'), 'Decision lineage: artifact support edge exists');
  equal(record.noRawPayload, true, 'Decision lineage: raw payload is blocked');
  equal(record.noExternalLineageExport, true, 'Decision lineage: external export is blocked');
  equal(record.noSignatureCreation, true, 'Decision lineage: signature creation is blocked');
  equal(record.grantsAuthority, false, 'Decision lineage: record grants no authority');
  ok(record.digest.startsWith('sha256:'), 'Decision lineage: record has a digest');
}

function testOpenDefeatersRemainVisibleWithoutBecomingAuthority(): void {
  const caseContract = fixtureAssuranceCase(true);
  const record = createDecisionLineageGraph({
    assuranceCase: caseContract,
    lineageId: 'lineage:refund-authority-open-defeater',
    generatedAt: '2026-05-18T18:03:00.000Z',
    builderRefDigest: actorDigest,
  });

  equal(record.outcome, 'decision-lineage-graph-ready', 'Decision lineage: open defeat is visible but does not block graph creation');
  equal(record.openDefeaterCount, 1, 'Decision lineage: open defeater count is retained');
  ok(record.reasonCodes.includes('decision-lineage-open-defeaters:1'), 'Decision lineage: open defeater reason is retained');
  ok(record.graphNodes.some((node) => node.kind === 'defeater'), 'Decision lineage: defeater node exists');
  ok(record.graphEdges.some((edge) => edge.kind === 'attacks'), 'Decision lineage: attack edge exists');
  equal(record.canAdmit, false, 'Decision lineage: open defeat does not become admission authority');
}

function testSignatureCoverageIsExplicitWhenRequired(): void {
  const caseContract = fixtureAssuranceCase();
  const record = createDecisionLineageGraph({
    assuranceCase: caseContract,
    lineageId: 'lineage:refund-authority-unsigned',
    generatedAt: '2026-05-18T18:03:00.000Z',
    builderRefDigest: actorDigest,
    signatureRefs: [{
      signatureId: 'signature:case-only',
      envelopeKind: 'dsse',
      signatureRefDigest: sha('signature:case-only'),
      signerRefDigest: actorDigest,
      signedSubjectDigest: caseContract.digest,
      signedAt: '2026-05-18T18:02:00.000Z',
    }],
    requireSignatureCoverage: true,
  });

  equal(record.outcome, 'decision-lineage-held-for-signature-coverage', 'Decision lineage: missing signature coverage holds');
  ok(record.findings.includes('signature-coverage-missing'), 'Decision lineage: signature finding is present');
  ok(record.missingSignatureCoverageDigests.length > 0, 'Decision lineage: missing subject digests are listed');
}

function testDanglingTargetsAndBoundaryRequestsFailClosed(): void {
  const caseContract = fixtureAssuranceCase();
  const dangling = createDecisionLineageGraph({
    assuranceCase: caseContract,
    lineageId: 'lineage:refund-authority-dangling',
    generatedAt: '2026-05-18T18:03:00.000Z',
    builderRefDigest: actorDigest,
    artifactRefs: [{
      ...fixtureArtifact(caseContract),
      artifactId: 'artifact:dangling',
      targetNodeId: 'evidence:missing',
    }],
  });
  const boundary = createDecisionLineageGraph({
    assuranceCase: caseContract,
    lineageId: 'lineage:refund-authority-boundary',
    generatedAt: '2026-05-18T18:03:00.000Z',
    builderRefDigest: actorDigest,
    rawPayloadRequested: true,
    externalLineageExportRequested: true,
    signatureCreationRequested: true,
  });

  equal(dangling.outcome, 'decision-lineage-held-for-case-binding', 'Decision lineage: dangling target holds');
  ok(dangling.findings.includes('artifact-target-missing'), 'Decision lineage: dangling target finding is present');
  equal(boundary.outcome, 'decision-lineage-rejected-boundary', 'Decision lineage: boundary request rejects');
  ok(boundary.findings.includes('raw-payload-requested'), 'Decision lineage: raw payload finding is present');
  ok(boundary.findings.includes('external-lineage-export-requested'), 'Decision lineage: external export finding is present');
  ok(boundary.findings.includes('signature-creation-requested'), 'Decision lineage: signature creation finding is present');
  equal(boundary.graphNodeCount > 0, true, 'Decision lineage: rejected boundary still has inspectable graph');
}

function testValidationDeterminismAndNoMutation(): void {
  const caseContract = fixtureAssuranceCase();
  const artifact = fixtureArtifact(caseContract);
  const signatures = signaturesFor(caseContract, [artifact]);
  const input = {
    assuranceCase: caseContract,
    lineageId: 'lineage:refund-authority-deterministic',
    generatedAt: '2026-05-18T18:03:00.000Z',
    builderRefDigest: actorDigest,
    artifactRefs: [artifact],
    signatureRefs: signatures,
    requireSignatureCoverage: true,
  };
  const before = JSON.stringify(input);
  const first = createDecisionLineageGraph(input);
  const second = createDecisionLineageGraph(input);

  equal(first.digest, second.digest, 'Decision lineage: identical input yields identical digest');
  equal(JSON.stringify(input), before, 'Decision lineage: input is not mutated');
  ok(Object.isFrozen(first), 'Decision lineage: output is frozen');
  throws(
    () => createDecisionLineageGraph({
      ...input,
      builderRefDigest: 'not-a-digest',
    }),
    /builderRefDigest must be a sha256 digest/u,
    'Decision lineage: invalid builder digest fails closed',
  );
  throws(
    () => createDecisionLineageGraph({
      ...input,
      assuranceCase: {
        ...caseContract,
        version: 'attestor.bad-version.v1',
      } as unknown as AssuranceCaseContract,
    }),
    /assurance case version mismatch/u,
    'Decision lineage: unsupported assurance case version fails closed',
  );
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile('docs', '02-architecture', 'decision-lineage-graph.md');
  const overview = readProjectFile('docs', '02-architecture', 'consequence-runtime-assurance-overview.md');
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(docs, '# Decision Lineage Graph', 'Decision lineage docs: title is present');
  includes(docs, 'attestor.decision-lineage-graph.v1', 'Decision lineage docs: version is present');
  includes(docs, 'not-openlineage-export', 'Decision lineage docs: OpenLineage export non-claim is present');
  includes(docs, 'not-dsse-or-in-toto-signer', 'Decision lineage docs: signer non-claim is present');
  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: I11 progress is updated');
  includes(overview, '| I11 | complete | Decision Lineage Graph |', 'Overview: I11 is complete');
  includes(overview, 'src/consequence-admission/decision-lineage-graph.ts', 'Overview: I11 source file is tracked');
  includes(overview, 'I11 turns the I00 assurance-case material', 'Overview: I11 explanation is present');
  includes(annex, 'Decision lineage graph', 'Research annex: I11 anchor is present');
  includes(ledger, 'docs/02-architecture/decision-lineage-graph.md', 'Research ledger: I11 doc is indexed');
  includes(packageProbe, 'DECISION_LINEAGE_GRAPH_VERSION', 'Package probe: I11 version is checked');
  includes(packageProbe, 'createDecisionLineageGraph', 'Package probe: I11 builder is checked');
  equal(
    packageJson.scripts['test:decision-lineage-graph'],
    'tsx tests/decision-lineage-graph.test.ts',
    'Decision lineage: package script is registered',
  );
}

testDescriptorDeclaresDigestOnlyLineageBoundary();
testReadyGraphBindsCaseArtifactsTransitionsAndSignatures();
testOpenDefeatersRemainVisibleWithoutBecomingAuthority();
testSignatureCoverageIsExplicitWhenRequired();
testDanglingTargetsAndBoundaryRequestsFailClosed();
testValidationDeterminismAndNoMutation();
testDocsAndPackageSurface();

console.log(`Decision lineage graph tests: ${passed} passed, 0 failed`);
