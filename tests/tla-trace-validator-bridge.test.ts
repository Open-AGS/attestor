import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  DECISION_TRACE_LOGGER_VERSION,
  TLA_TRACE_VALIDATOR_BRIDGE_VERSION,
  TLA_TRACE_VALIDATOR_INVARIANTS,
  TLA_TRACE_VALIDATOR_SPEC_MODULE,
  createCanonicalShadowEvent,
  createDecisionTraceLogger,
  createTlaTraceValidatorBridge,
  runShadowRuntimePipelineDryRun,
  tlaTraceValidatorBridgeDescriptor,
  type CreateTlaTraceValidatorBridgeInput,
  type DecisionTraceSnapshot,
  type TlaTraceValidatorDangerFlag,
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

function fixtureSnapshot(): DecisionTraceSnapshot {
  const event = createCanonicalShadowEvent({
    occurredAt: '2026-05-18T16:00:00.000Z',
    sourceKind: 'target-system-shadow',
    producer: 'attestor.tla-trace-validator-bridge.test',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    observed: {
      targetSystem: 'refund-service',
      targetAccountRefDigest: null,
      actionName: 'refund.create',
      actionKind: 'api-operation',
      consequenceClass: 'financial',
      resourceRefDigest: digestC,
      dataClass: 'money-movement',
      amountAssetChain: null,
      authorityDelta: null,
    },
    inferred: {
      targetSystem: null,
      targetAccountRefDigest: null,
      actionName: null,
      actionKind: null,
      consequenceClass: null,
      resourceRefDigest: null,
      dataClass: null,
      amountAssetChain: null,
      authorityDelta: {
        authorityKind: 'delegated-service-role',
        principalRefDigest: digestB,
        resourceRefDigest: digestC,
        permissionRefDigest: digestD,
      },
    },
    evidenceRefs: [{ kind: 'evidence', digest: digestA, origin: 'observed' }],
    approvalRefs: [{ kind: 'approval', digest: digestB, origin: 'operator-supplied' }],
    receiptRefs: [{ kind: 'receipt', digest: digestC, origin: 'observed' }],
    policyRefs: [{ kind: 'policy', digest: digestD, origin: 'observed' }],
    replayRefDigest: digestE,
    rawMaterialPolicy: 'digest-only',
  });
  const pipeline = runShadowRuntimePipelineDryRun({
    event,
    projectionOptions: {
      authorityRefDigest: digestD,
      coverageRefDigest: digestE,
      policyScopeRefDigest: digestF,
      freshnessWindowSeconds: 300,
    },
    generatedAt: '2026-05-18T16:00:01.000Z',
  });
  const logger = createDecisionTraceLogger({
    traceId: 'trace:i09:valid',
    ttlSeconds: 3600,
    now: () => '2026-05-18T16:00:00.000Z',
  });
  logger.recordPipeline(pipeline, '2026-05-18T16:00:02.000Z');
  return logger.snapshot('2026-05-18T16:30:00.000Z');
}

function input(
  overrides?: Partial<CreateTlaTraceValidatorBridgeInput>,
): CreateTlaTraceValidatorBridgeInput {
  return {
    snapshot: fixtureSnapshot(),
    bridgeId: 'tla-trace:i09:refund-authority',
    evaluatedAt: '2026-05-18T16:31:00.000Z',
    validatorRefDigest: digest0,
    tenantRefDigest: digestA,
    scopeDigest: digestB,
    targetClaimNodeId: 'claim:refund-authority',
    specRefDigest: digestC,
    configRefDigest: digestD,
    invariantNames: [...TLA_TRACE_VALIDATOR_INVARIANTS],
    validatorKind: 'tlc-report',
    validatorVerdict: 'valid',
    validatorReportRefDigest: digestE,
    ...overrides,
  };
}

function testDescriptorRecordsFormalBoundary(): void {
  const descriptor = tlaTraceValidatorBridgeDescriptor();

  equal(descriptor.version, TLA_TRACE_VALIDATOR_BRIDGE_VERSION, 'TLA bridge: version is explicit');
  equal(descriptor.assuranceCaseContractVersion, ASSURANCE_CASE_CONTRACT_VERSION, 'TLA bridge: binds assurance case');
  equal(descriptor.decisionTraceLoggerVersion, DECISION_TRACE_LOGGER_VERSION, 'TLA bridge: binds decision trace logger');
  equal(descriptor.specModuleName, TLA_TRACE_VALIDATOR_SPEC_MODULE, 'TLA bridge: spec module is explicit');
  ok(descriptor.invariants.includes('NoAdmitWithoutAuthority'), 'TLA bridge: authority invariant is exposed');
  ok(descriptor.invariants.includes('ReplaySafety'), 'TLA bridge: replay invariant is exposed');
  ok(descriptor.sourceAnchors.includes('microsoft-tla-specifying-systems-design-first'), 'TLA bridge: Microsoft TLA anchor is present');
  ok(descriptor.sourceAnchors.includes('aws-formal-methods-design-bug-discovery'), 'TLA bridge: AWS formal methods anchor is present');
  ok(descriptor.sourceAnchors.includes('apalache-tla-model-checker-documentation'), 'TLA bridge: Apalache anchor is present');
  equal(descriptor.createsEvidenceNodeOnValidReport, true, 'TLA bridge: valid report creates evidence');
  equal(descriptor.opensRebuttingDefeaterOnInvalidReport, true, 'TLA bridge: invalid report opens rebutting defeater');
  equal(descriptor.opensUndercuttingDefeaterOnUnknownReport, true, 'TLA bridge: unknown report opens undercutting defeater');
  equal(descriptor.requiresVerifiedDecisionTrace, true, 'TLA bridge: verified trace is required');
  equal(descriptor.requiresValidatorReportForEvidence, true, 'TLA bridge: validator report is required for evidence');
  equal(descriptor.doesNotRunModelChecker, true, 'TLA bridge: descriptor does not run model checker');
  equal(descriptor.notRuntimeOracle, true, 'TLA bridge: descriptor is not runtime oracle');
  equal(descriptor.noFormalProofClaim, true, 'TLA bridge: descriptor makes no formal proof claim');
  equal(descriptor.canAdmit, false, 'TLA bridge: cannot admit');
  equal(descriptor.activatesEnforcement, false, 'TLA bridge: cannot activate enforcement');
  ok(descriptor.nonClaims.includes('not-tlc-runner'), 'TLA bridge: TLC runner is a non-claim');
  ok(descriptor.nonClaims.includes('not-formal-proof'), 'TLA bridge: formal proof is a non-claim');
}

function testValidReportCreatesEvidenceOnly(): void {
  const record = createTlaTraceValidatorBridge(input());

  equal(record.version, TLA_TRACE_VALIDATOR_BRIDGE_VERSION, 'TLA bridge: record version is explicit');
  equal(record.outcome, 'tla-trace-evidence-ready', 'TLA bridge: valid report is evidence-ready');
  equal(record.formalSpecEvidenceReady, true, 'TLA bridge: formal evidence is ready');
  equal(record.evidenceNode?.kind, 'evidence', 'TLA bridge: evidence node is created');
  equal(record.evidenceNode?.tenantRefDigest, digestA, 'TLA bridge: evidence node is tenant-bound');
  equal(record.evidenceTransition?.transitionKind, 'create-node', 'TLA bridge: evidence transition is create-node');
  equal(record.openDefeater, null, 'TLA bridge: valid report opens no defeater');
  equal(record.dangerFlags.length, 0, 'TLA bridge: valid report has no danger flags');
  equal(record.doesNotRunModelChecker, true, 'TLA bridge: record does not run model checker');
  equal(record.notRuntimeOracle, true, 'TLA bridge: record is not runtime oracle');
  equal(record.noFormalProofClaim, true, 'TLA bridge: record makes no formal proof claim');
  equal(record.noRawTrace, true, 'TLA bridge: record stores no raw trace');
  equal(record.noRawSpec, true, 'TLA bridge: record stores no raw spec');
  equal(record.grantsAuthority, false, 'TLA bridge: record grants no authority');
  equal(record.canAdmit, false, 'TLA bridge: record cannot admit');
  ok(record.digest.startsWith('sha256:'), 'TLA bridge: record has digest');
}

function testInvalidAndUnknownReportsOpenTypedDefeaters(): void {
  const invalid = createTlaTraceValidatorBridge(input({
    validatorVerdict: 'invalid',
    counterexampleRefDigest: digest1,
  }));
  const unknown = createTlaTraceValidatorBridge(input({
    validatorKind: 'apalache-report',
    validatorVerdict: 'unknown',
    validatorReportRefDigest: digest2,
  }));

  equal(invalid.outcome, 'tla-trace-open-rebutting-defeater', 'TLA bridge: invalid report opens rebutting defeater');
  equal(invalid.opensRebuttingDefeater, true, 'TLA bridge: invalid report marks rebutting defeater');
  equal(invalid.openDefeater?.kind, 'rebutting', 'TLA bridge: invalid report defeater kind is rebutting');
  equal(invalid.openDefeater?.attacksNodeId, 'claim:refund-authority', 'TLA bridge: rebutting defeater attacks target claim');
  equal(invalid.defeaterTransition?.transitionKind, 'open-defeater', 'TLA bridge: invalid report has open-defeater transition');
  ok(invalid.dangerFlags.includes('validator-verdict-invalid'), 'TLA bridge: invalid verdict flag is present');

  equal(unknown.outcome, 'tla-trace-open-undercutting-defeater', 'TLA bridge: unknown report opens undercutting defeater');
  equal(unknown.opensUndercuttingDefeater, true, 'TLA bridge: unknown report marks undercutting defeater');
  equal(unknown.openDefeater?.kind, 'undercutting', 'TLA bridge: unknown report defeater kind is undercutting');
  ok(unknown.dangerFlags.includes('validator-verdict-unknown'), 'TLA bridge: unknown verdict flag is present');
}

function testHoldsForTraceSpecAndValidatorEvidence(): void {
  const snapshot = fixtureSnapshot();
  const badTrace = createTlaTraceValidatorBridge(input({
    snapshot: {
      ...snapshot,
      verification: {
        ...snapshot.verification,
        valid: false,
        failClosed: true,
        failureReasons: ['entry-payload-digest-mismatch'],
      },
    },
  }));
  const missingSpec = createTlaTraceValidatorBridge(input({
    specRefDigest: null,
  }));
  const notRun = createTlaTraceValidatorBridge(input({
    validatorVerdict: 'not-run',
    validatorReportRefDigest: null,
  }));

  equal(badTrace.outcome, 'tla-trace-held-for-trace-verification', 'TLA bridge: invalid trace holds');
  ok(badTrace.dangerFlags.includes('trace-verification-failed'), 'TLA bridge: trace verification flag is present');
  equal(missingSpec.outcome, 'tla-trace-held-for-spec-binding', 'TLA bridge: missing spec holds');
  ok(missingSpec.dangerFlags.includes('spec-ref-missing'), 'TLA bridge: spec missing flag is present');
  equal(notRun.outcome, 'tla-trace-held-for-validator-report', 'TLA bridge: not-run validator holds');
  ok(notRun.dangerFlags.includes('validator-not-run'), 'TLA bridge: not-run flag is present');
  equal(notRun.evidenceNode, null, 'TLA bridge: not-run creates no evidence');
}

function testBoundaryRequestsReject(): void {
  const cases: readonly [
    Partial<CreateTlaTraceValidatorBridgeInput>,
    TlaTraceValidatorDangerFlag,
  ][] = [
    [{ rawTraceRequested: true }, 'raw-trace-requested'],
    [{ rawSpecRequested: true }, 'raw-spec-requested'],
    [{ runtimeOracleRequested: true }, 'runtime-oracle-requested'],
    [{ formalProofClaimed: true }, 'formal-proof-claimed'],
    [{ policyActivationRequested: true }, 'policy-activation-requested'],
    [{ liveEnforcementRequested: true }, 'live-enforcement-requested'],
    [{ authorityActionRequested: true }, 'authority-action-requested'],
  ];

  for (const [overrides, flag] of cases) {
    const record = createTlaTraceValidatorBridge(input(overrides));
    equal(record.outcome, 'tla-trace-rejected-boundary', `TLA bridge: ${flag} rejects boundary`);
    ok(record.dangerFlags.includes(flag), `TLA bridge: ${flag} flag is present`);
    equal(record.formalSpecEvidenceReady, false, `TLA bridge: ${flag} creates no evidence`);
  }
}

function testBindingAndInvariantValidationFailClosed(): void {
  throws(
    () => createTlaTraceValidatorBridge(input({
      validatorRefDigest: 'not-a-digest',
    })),
    /validatorRefDigest must be a sha256 digest/u,
    'TLA bridge: bad validator digest fails closed',
  );
  throws(
    () => createTlaTraceValidatorBridge(input({
      invariantNames: ['UnknownInvariant' as never],
    })),
    /invariantNames\[0\] is not supported/u,
    'TLA bridge: unknown invariant fails closed',
  );
  throws(
    () => createTlaTraceValidatorBridge(input({
      snapshot: {
        ...fixtureSnapshot(),
        version: 'wrong-version',
      } as never,
    })),
    /snapshot version mismatch/u,
    'TLA bridge: wrong snapshot version fails closed',
  );
}

function testDeterminismAndNoMutation(): void {
  const source = input();
  const before = JSON.stringify(source);
  const first = createTlaTraceValidatorBridge(source);
  const second = createTlaTraceValidatorBridge(source);

  equal(first.digest, second.digest, 'TLA bridge: identical input yields identical digest');
  equal(JSON.stringify(source), before, 'TLA bridge: input is not mutated');
  ok(Object.isFrozen(first), 'TLA bridge: output is frozen');
}

function testDocsAndPackageSurface(): void {
  const docs = readProjectFile('docs', '02-architecture', 'tla-trace-validator-bridge.md');
  const overview = readProjectFile('docs', '02-architecture', 'consequence-runtime-assurance-overview.md');
  const annex = readProjectFile('docs', 'research', 'cross-domain-pattern-sources.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');
  const packageProbe = readProjectFile('scripts', 'probe', 'probe-consequence-admission-package-surface.mjs');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };

  includes(docs, '# TLA+ Trace Validator Bridge', 'TLA bridge docs: title is present');
  includes(docs, 'attestor.tla-trace-validator-bridge.v1', 'TLA bridge docs: version is present');
  includes(docs, 'does not run TLC, Apalache', 'TLA bridge docs: model-checker runner boundary is present');
  includes(docs, 'does not prove that TypeScript runtime behavior is formally verified', 'TLA bridge docs: formal proof boundary is present');
  includes(docs, 'does not activate policy, admit a consequence', 'TLA bridge docs: authority boundary is present');
  includes(overview, 'Progress: 14/14 complete after I13. 0 steps remain.', 'Overview: I09 progress is updated');
  includes(overview, '| I09 | complete | TLA+ Trace Validator Bridge |', 'Overview: I09 is complete');
  includes(overview, 'src/consequence-admission/tla-trace-validator-bridge.ts', 'Overview: I09 source file is tracked');
  includes(overview, 'I09 turns W06 decision trace snapshots', 'Overview: I09 explanation is present');
  includes(annex, 'TLA+ trace validator bridge', 'Research annex: I09 anchor is present');
  includes(ledger, 'docs/02-architecture/tla-trace-validator-bridge.md', 'Research ledger: I09 doc is indexed');
  includes(packageProbe, 'TLA_TRACE_VALIDATOR_BRIDGE_VERSION', 'Package probe: I09 version is checked');
  includes(packageProbe, 'createTlaTraceValidatorBridge', 'Package probe: I09 builder is checked');
  equal(
    packageJson.scripts['test:tla-trace-validator-bridge'],
    'tsx tests/tla-trace-validator-bridge.test.ts',
    'TLA bridge: package script is registered',
  );
}

testDescriptorRecordsFormalBoundary();
testValidReportCreatesEvidenceOnly();
testInvalidAndUnknownReportsOpenTypedDefeaters();
testHoldsForTraceSpecAndValidatorEvidence();
testBoundaryRequestsReject();
testBindingAndInvariantValidationFailClosed();
testDeterminismAndNoMutation();
testDocsAndPackageSurface();

console.log(`TLA trace validator bridge tests: ${passed} passed, 0 failed`);
