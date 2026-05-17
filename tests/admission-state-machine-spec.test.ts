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

const invariantNames = [
  'TypeOK',
  'NoAdmitWithoutAuthority',
  'NoEnforcementWithoutPacket',
  'NoCrossTenantLeak',
  'NoReviewBypass',
  'MonotoneFusion',
  'ReplaySafety',
] as const;

function testTlaModuleDefinesBoundedStateMachine(): void {
  const spec = readProjectFile('specs', 'admission-state-machine.tla');

  for (const expected of [
    '---- MODULE AdmissionStateMachine ----',
    'EXTENDS Naturals, FiniteSets',
    'CONSTANTS',
    'Tenants,',
    'Requests,',
    'Digests,',
    'Nonces,',
    'NoDigest,',
    'NoNonce',
    'Stages == {',
    '"proposed"',
    '"enveloped"',
    '"traced"',
    '"review"',
    '"blocked"',
    '"admitted"',
    '"enforced"',
    'Hazards == 0..4',
    'VARIABLES',
    'requestTenant',
    'requestStage',
    'authorityOk',
    'traceValid',
    'traceTenant',
    'packetDigest',
    'packetNonce',
    'consumedNonces',
    'reviewRequired',
    'reviewed',
    'hazard',
    'priorHazard',
    'enforcementActive',
    'vars == <<',
    'Init ==',
    'Next ==',
    'Spec ==',
    'Init /\\ [][Next]_vars',
  ]) {
    includes(spec, expected, `Admission state machine TLA: records ${expected}`);
  }
}

function testTlaActionsMatchRuntimeAssuranceBoundary(): void {
  const spec = readProjectFile('specs', 'admission-state-machine.tla');

  for (const expected of [
    'Envelope(r) ==',
    'RecordTrace(r) ==',
    'BindAuthority(r) ==',
    'IssuePacket(r, d, n) ==',
    'RaiseHazard(r, h) ==',
    'Review(r) ==',
    'Admit(r) ==',
    'Enforce(r) ==',
    'Block(r) ==',
    '/\\ requestStage[r] = "proposed"',
    '/\\ requestStage[r] = "enveloped"',
    '/\\ traceValid\' = [traceValid EXCEPT ![r] = TRUE]',
    '/\\ traceTenant\' = [traceTenant EXCEPT ![r] = requestTenant[r]]',
    '/\\ packetDigest\' = [packetDigest EXCEPT ![r] = d]',
    '/\\ packetNonce\' = [packetNonce EXCEPT ![r] = n]',
    '/\\ h >= hazard[r]',
    '/\\ reviewRequired\' = [reviewRequired EXCEPT ![r] = reviewRequired[r] \\/ (h >= 3)]',
    '/\\ authorityOk[r]',
    '/\\ traceValid[r]',
    '/\\ packetDigest[r] # NoDigest',
    '/\\ packetNonce[r] \\notin consumedNonces',
    '/\\ requestStage\' = [requestStage EXCEPT ![r] = "enforced"]',
    '/\\ consumedNonces\' = consumedNonces \\cup {packetNonce[r]}',
  ]) {
    includes(spec, expected, `Admission state machine TLA: records action fragment ${expected}`);
  }
}

function testTlaInvariantsAndConfigStayAligned(): void {
  const spec = readProjectFile('specs', 'admission-state-machine.tla');
  const config = readProjectFile('specs', 'MCAdmission.cfg');

  includes(config, 'SPECIFICATION Spec', 'Admission state machine config: names Spec');
  includes(config, 'CONSTANTS', 'Admission state machine config: has constants');
  includes(config, 'Tenants = {tenantA, tenantB}', 'Admission state machine config: bounds tenants');
  includes(config, 'Requests = {requestA, requestB}', 'Admission state machine config: bounds requests');
  includes(config, 'Digests = {digestA, digestB, noDigest}', 'Admission state machine config: bounds digests');
  includes(config, 'Nonces = {nonceA, nonceB}', 'Admission state machine config: bounds nonces');
  includes(config, 'NoDigest = noDigest', 'Admission state machine config: binds no digest sentinel');
  includes(config, 'NoNonce = noNonce', 'Admission state machine config: binds no nonce sentinel');

  for (const invariant of invariantNames) {
    includes(spec, `${invariant} ==`, `Admission state machine TLA: defines invariant ${invariant}`);
    includes(config, `INVARIANT ${invariant}`, `Admission state machine config: checks invariant ${invariant}`);
  }

  for (const expected of [
    'requestStage[r] \\in {"admitted", "enforced"} => authorityOk[r]',
    'enforcementActive[r] =>',
    'traceValid[r] => traceTenant[r] = requestTenant[r]',
    'reviewRequired[r] => reviewed[r]',
    'priorHazard[r] <= hazard[r]',
    'packetNonce[r1] # packetNonce[r2]',
  ]) {
    includes(spec, expected, `Admission state machine TLA: records safety fragment ${expected}`);
  }
}

function testDocsOverviewAndPackageScriptStayAligned(): void {
  const doc = readProjectFile('docs', '02-architecture', 'admission-state-machine-spec.md');
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '# Admission State Machine Spec',
    'W07 implementation contract',
    'manual TLA+ skeleton',
    'specs/admission-state-machine.tla',
    'specs/MCAdmission.cfg',
    'NoAdmitWithoutAuthority',
    'NoEnforcementWithoutPacket',
    'NoCrossTenantLeak',
    'NoReviewBypass',
    'MonotoneFusion',
    'ReplaySafety',
    'not a proof that the TypeScript runtime is formally verified',
    'does not run TLC, Apalache, or any other model checker',
    'Specifying Systems',
    'How Amazon Web Services uses formal methods',
    'Systems Correctness Practices at AWS',
    'Apalache',
  ]) {
    includes(doc, expected, `Admission state machine doc: records ${expected}`);
  }

  for (const expected of [
    '| W07 | complete | TLA+ Admission State Machine Skeleton |',
    'specs/admission-state-machine.tla',
    'specs/MCAdmission.cfg',
    'tests/admission-state-machine-spec.test.ts',
    'docs/02-architecture/admission-state-machine-spec.md',
    'model-checker execution claim',
    'TLC or Apalache CI dependency',
    'Design-first formal specification framing',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  excludes(
    doc,
    /\bproduction-ready\b|\bformally verified TypeScript\b|\bTLC passed\b|\bApalache passed\b/u,
    'Admission state machine doc: avoids overclaim wording',
  );
  assert.equal(
    packageJson.scripts['test:admission-state-machine-spec'],
    'tsx tests/admission-state-machine-spec.test.ts',
    'Admission state machine spec: package script is registered',
  );
  passed += 1;
}

testTlaModuleDefinesBoundedStateMachine();
testTlaActionsMatchRuntimeAssuranceBoundary();
testTlaInvariantsAndConfigStayAligned();
testDocsOverviewAndPackageScriptStayAligned();

console.log(`Admission state machine spec tests: ${passed} passed, 0 failed`);
