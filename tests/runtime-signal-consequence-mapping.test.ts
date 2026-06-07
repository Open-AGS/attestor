import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
  createRuntimeSignalEnvelope,
  mapRuntimeSignalToConsequenceCandidate,
  normalizeRuntimeSignal,
  runtimeSignalConsequenceMappingDescriptor,
} from '../src/consequence-admission/index.js';
import type {
  ConsequenceEnvelopeConsequenceClass,
  RuntimeSignalEnvelope,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function includes<T>(values: readonly T[] | string, expected: T | string, message: string): void {
  if (typeof values === 'string' && typeof expected === 'string') {
    assert.ok(values.includes(expected), `${message}\nExpected to find: ${expected}`);
  } else {
    assert.ok(
      (values as readonly T[]).includes(expected as T),
      `${message}\nExpected to find: ${String(expected)}`,
    );
  }
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
const eventTime = '2026-05-18T09:30:00Z';
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

function baseEnvelope(
  overrides: Partial<Parameters<typeof createRuntimeSignalEnvelope>[0]> = {},
): RuntimeSignalEnvelope {
  return createRuntimeSignalEnvelope({
    signalKind: 'proposed-action',
    sourceTrustLevel: 'signed-or-bound',
    sourceSystem: 'sdk.customer-gate',
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    runtimeRef: 'workflow:export-runner',
    traceId,
    runId: 'run-001',
    eventTime,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
    operationRef: 'POST /api/v1/exports#createExport',
    inputSchemaDigest: digestC,
    argumentOrBodyDigest: digestD,
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['evidence:export-request.v1'],
    approvalRefs: ['approval:manager.v1'],
    ...overrides,
  });
}

function candidateClassFor(
  actionSurface: string,
  operationRef: string | null = null,
): ConsequenceEnvelopeConsequenceClass {
  return mapRuntimeSignalToConsequenceCandidate(
    baseEnvelope({
      actionSurface,
      operationRef,
      downstreamSystem: actionSurface,
    }),
  ).consequenceClass;
}

function testDescriptorKeepsMappingReviewOnly(): void {
  const descriptor = runtimeSignalConsequenceMappingDescriptor();

  equal(descriptor.version, RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION, 'Runtime signal consequence mapping: descriptor version is explicit');
  equal(descriptor.runtimeSignalEnvelopeVersion, 'attestor.runtime-signal-envelope.v1', 'Runtime signal consequence mapping: descriptor consumes RS02 envelope');
  equal(descriptor.consequenceEnvelopeContractVersion, 'attestor.consequence-envelope-contract.v1', 'Runtime signal consequence mapping: descriptor maps to existing consequence envelope contract');
  equal(descriptor.actionRiskInventoryVersion, 'attestor.action-risk-inventory.v1', 'Runtime signal consequence mapping: descriptor uses existing action-risk vocabulary');
  includes(descriptor.consequenceClasses, 'data-movement', 'Runtime signal consequence mapping: descriptor exposes existing data-movement class');
  includes(descriptor.missingControls, 'gate-proof-missing', 'Runtime signal consequence mapping: descriptor names gate proof as missing control');
  equal(descriptor.ruleBasedCandidateOnly, true, 'Runtime signal consequence mapping: descriptor is rule-based candidate mapping only');
  equal(descriptor.proofSignalsHandledByProofIntake, true, 'Runtime signal consequence mapping: proof signals stay in proof intake');
  equal(descriptor.reviewMaterialOnly, true, 'Runtime signal consequence mapping: descriptor output is review material only');
  equal(descriptor.canGrantAuthority, false, 'Runtime signal consequence mapping: descriptor cannot grant authority');
  equal(descriptor.canAdmit, false, 'Runtime signal consequence mapping: descriptor cannot admit');
  equal(descriptor.activatesEnforcement, false, 'Runtime signal consequence mapping: descriptor cannot activate enforcement');
  equal(descriptor.productionReady, false, 'Runtime signal consequence mapping: descriptor is not production readiness');
}

function testOpenApiExportDeclarationMapsToDataMovementCandidate(): void {
  const normalized = normalizeRuntimeSignal({
    sourceKind: 'openapi-operation',
    sourceSystem: 'openapi.customer-api',
    eventTime,
    method: 'POST',
    path: '/api/v1/exports',
    operationId: 'createExport',
    inputSchemaDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });
  const candidate = mapRuntimeSignalToConsequenceCandidate(normalized.envelope);

  equal(candidate.version, RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION, 'Runtime signal consequence mapping: candidate version is explicit');
  equal(candidate.sourceSignalDigest, normalized.envelope.signalDigest, 'Runtime signal consequence mapping: candidate binds source signal digest');
  equal(candidate.sourceSignalKind, 'declaration', 'Runtime signal consequence mapping: OpenAPI declaration remains declaration-sourced');
  equal(candidate.candidateOrigin, 'declaration-surface', 'Runtime signal consequence mapping: declaration origin is explicit');
  equal(candidate.actionSurface, 'data-export', 'Runtime signal consequence mapping: explicit action surface is preserved');
  equal(candidate.consequenceClass, 'data-movement', 'Runtime signal consequence mapping: export maps to data movement');
  includes(candidate.mappingRuleIds, 'surface-explicit', 'Runtime signal consequence mapping: explicit surface rule is recorded');
  includes(candidate.mappingRuleIds, 'class-data-movement', 'Runtime signal consequence mapping: data movement rule is recorded');
  includes(candidate.missingControls, 'tenant-binding-missing', 'Runtime signal consequence mapping: declaration without tenant binding stays incomplete');
  includes(candidate.missingControls, 'actor-binding-missing', 'Runtime signal consequence mapping: declaration without actor binding stays incomplete');
  includes(candidate.missingControls, 'source-binding-missing', 'Runtime signal consequence mapping: declared source needs binding before stronger use');
  includes(candidate.missingControls, 'gate-proof-missing', 'Runtime signal consequence mapping: gate proof is not inferred from declaration');
  includes(candidate.riskSignals, 'policy-gap', 'Runtime signal consequence mapping: missing policy maps to policy gap');
  includes(candidate.riskSignals, 'authority-gap', 'Runtime signal consequence mapping: missing actor/approval maps to authority gap');
  equal(candidate.recommendedNextStep, 'define-policy', 'Runtime signal consequence mapping: first missing control asks for policy definition');
  equal(candidate.reviewMaterialOnly, true, 'Runtime signal consequence mapping: candidate is review material only');
  equal(candidate.canAdmit, false, 'Runtime signal consequence mapping: candidate cannot admit');
  ok(candidate.candidateDigest.startsWith('sha256:'), 'Runtime signal consequence mapping: candidate digest is generated');
}

function testBoundProposedActionKeepsOnlyGateAndReplayGaps(): void {
  const candidate = mapRuntimeSignalToConsequenceCandidate(baseEnvelope());

  equal(candidate.sourceSignalKind, 'proposed-action', 'Runtime signal consequence mapping: proposed action signal is preserved');
  equal(candidate.candidateOrigin, 'proposed-action-surface', 'Runtime signal consequence mapping: proposed action origin is explicit');
  equal(candidate.consequenceClass, 'data-movement', 'Runtime signal consequence mapping: data export proposed action maps to data movement');
  deepEqual(
    candidate.missingControls,
    ['gate-proof-missing', 'replay-proof-missing'],
    'Runtime signal consequence mapping: a digest-bound proposed action still needs gate and replay proof',
  );
  deepEqual(candidate.riskSignals, ['adapter-gap'], 'Runtime signal consequence mapping: gate/replay gaps stay adapter-readiness work');
  equal(candidate.recommendedNextStep, 'prepare-adapter', 'Runtime signal consequence mapping: gate/replay gap recommends adapter preparation');
  equal(candidate.activatesEnforcement, false, 'Runtime signal consequence mapping: candidate cannot activate enforcement');
  equal(candidate.productionReady, false, 'Runtime signal consequence mapping: candidate is not production readiness');
}

function testExistingConsequenceClassesAreRecognized(): void {
  equal(candidateClassFor('refund-request', 'POST /api/v1/refunds#createRefund'), 'financial', 'Runtime signal consequence mapping: refund maps to financial');
  equal(candidateClassFor('admin-role-grant', 'POST /api/v1/admin/users#grantRole'), 'authority-change', 'Runtime signal consequence mapping: role grant maps to authority change');
  equal(candidateClassFor('email-notification', 'POST /api/v1/messages#sendEmail'), 'external-communication', 'Runtime signal consequence mapping: email maps to external communication');
  equal(candidateClassFor('deployment-run', 'POST /api/v1/deployments#runDeployment'), 'operational-execution', 'Runtime signal consequence mapping: deploy maps to operational execution');
  equal(candidateClassFor('wallet-swap', 'POST /api/v1/wallets#swap'), 'programmable-money', 'Runtime signal consequence mapping: wallet swap maps to programmable money');
  equal(candidateClassFor('clinical-triage-note', 'POST /api/v1/health#triage'), 'health-claims', 'Runtime signal consequence mapping: health triage maps to health claims');
  equal(candidateClassFor('ambiguous-surface', 'POST /api/v1/objects#doThing'), 'unknown', 'Runtime signal consequence mapping: unknown surface stays unknown');
}

function testOperationRefCanProvideSurfaceWhenActionSurfaceMissing(): void {
  const candidate = mapRuntimeSignalToConsequenceCandidate(
    baseEnvelope({
      actionSurface: null,
      operationRef: 'POST /api/v1/refunds#createRefund',
      downstreamSystem: 'refund-service',
    }),
  );

  equal(candidate.actionSurface, 'POST /api/v1/refunds#createRefund', 'Runtime signal consequence mapping: operation ref becomes fallback surface');
  includes(candidate.mappingRuleIds, 'surface-from-operation-ref', 'Runtime signal consequence mapping: fallback surface rule is recorded');
  equal(candidate.consequenceClass, 'financial', 'Runtime signal consequence mapping: fallback surface is still classified');
}

function testFailsClosedForAuthorityUpgradeAndProofSignals(): void {
  const envelope = baseEnvelope();
  throws(
    () =>
      mapRuntimeSignalToConsequenceCandidate({
        ...envelope,
        canAdmit: true,
      } as never),
    /requires a no-authority runtime signal envelope/u,
    'Runtime signal consequence mapping: forged admission authority fails closed',
  );

  const proofEnvelope = createRuntimeSignalEnvelope({
    signalKind: 'enforcement-proof',
    sourceTrustLevel: 'enforcement-proof',
    sourceSystem: 'pep.customer-gate',
    eventTime,
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    runtimeRef: 'pep:data-export',
    traceId,
    runId: 'run-proof-001',
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
    operationRef: 'pep.receipt:data-export',
    inputSchemaDigest: digestC,
    argumentOrBodyDigest: digestD,
    policyRefs: ['policy:data-export.v1'],
    evidenceRefs: ['evidence:pep-receipt.v1'],
    approvalRefs: ['approval:manager.v1'],
  });
  throws(
    () => mapRuntimeSignalToConsequenceCandidate(proofEnvelope),
    /does not turn enforcement-proof signals into action candidates/u,
    'Runtime signal consequence mapping: enforcement proof remains proof-intake material',
  );
}

function testDocsPackageAndProbeStayAligned(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-signal-handling.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const packageProbe = readProjectFile(
    'scripts',
    'probe',
    'probe-consequence-admission-package-surface.mjs',
  );

  includes(doc, 'RS05 Consequence Mapping', 'Runtime signal consequence mapping: architecture note names RS05');
  includes(doc, 'attestor.runtime-signal-consequence-mapping.v1', 'Runtime signal consequence mapping: architecture note records version');
  equal(
    packageJson.scripts['test:runtime-signal-consequence-mapping'],
    'tsx tests/runtime-signal-consequence-mapping.test.ts',
    'Runtime signal consequence mapping: package script is registered',
  );
  includes(
    packageProbe,
    'RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION',
    'Runtime signal consequence mapping: package surface probe covers version export',
  );
  includes(
    packageProbe,
    'mapRuntimeSignalToConsequenceCandidate',
    'Runtime signal consequence mapping: package surface probe covers mapping export',
  );
}

testDescriptorKeepsMappingReviewOnly();
testOpenApiExportDeclarationMapsToDataMovementCandidate();
testBoundProposedActionKeepsOnlyGateAndReplayGaps();
testExistingConsequenceClassesAreRecognized();
testOperationRefCanProvideSurfaceWhenActionSurfaceMissing();
testFailsClosedForAuthorityUpgradeAndProofSignals();
testDocsPackageAndProbeStayAligned();

console.log(`Runtime signal consequence mapping tests: ${passed} passed, 0 failed`);
