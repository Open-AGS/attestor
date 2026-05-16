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

function decisionDoc(): string {
  return readProjectFile(
    'docs',
    '02-architecture',
    'external-kms-hsm-provider-decision.md',
  );
}

function testDecisionSelectsGcpFirst(): void {
  const doc = decisionDoc();

  for (const expected of [
    '# External KMS/HSM Provider Decision',
    'Implement the first real external release signer adapter against **Google Cloud',
    'KMS**.',
    'providerClass: gcp-kms',
    'portable release algorithm: Ed25519 / EdDSA',
    'provider native algorithm: EC_SIGN_ED25519',
    'provider sign input mode: raw',
    'minimum promotion protection posture: HSM-backed or stronger provider proof',
    'AWS KMS remains the second compatible adapter candidate.',
    'Azure Key Vault or',
    'Azure Managed HSM remains a future ES256/PS256 or algorithm-migration candidate',
  ]) {
    includes(doc, expected, `KMS/HSM provider decision: records ${expected}`);
  }
}

function testDecisionRecordsProviderMatrixAndNoGos(): void {
  const doc = decisionDoc();

  for (const expected of [
    '| Google Cloud KMS | first adapter |',
    '| AWS KMS | second adapter |',
    '| Azure Key Vault | not first |',
    '| Azure Managed HSM | not first |',
    '| Confidential compute signer | later |',
    'the selected Google Cloud KMS key version cannot use `EC_SIGN_ED25519`',
    'the adapter cannot prove raw-vs-digest input mode',
    'the proof cannot bind provider-native algorithm and protection level',
    'the runtime can silently fall back to `file-pem` or `runtime-ephemeral`',
    'the PR would claim production readiness from a single provider adapter',
  ]) {
    includes(doc, expected, `KMS/HSM provider decision: matrix/no-go includes ${expected}`);
  }

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(without|until|not|no|claim|readiness|proof))/iu,
    'KMS/HSM provider decision: does not make an unqualified production-ready claim',
  );
}

function testDecisionHasPrimarySourcesAndRepoLinks(): void {
  const doc = decisionDoc();
  const sourceOfTruth = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const cryptoPolicy = readProjectFile(
    'docs',
    '03-governance',
    'cryptography-policy.md',
  );
  const researchLedger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    'Google Cloud KMS algorithms',
    'Cloud KMS asymmetricSign',
    'Cloud KMS protection',
    'AWS KMS Sign',
    'AWS KMS key stores',
    'Azure Key Vault Sign',
    'Azure Key Vault key details',
    'Azure Managed HSM',
  ]) {
    includes(doc, expected, `KMS/HSM provider decision: primary anchor ${expected} is recorded`);
  }

  includes(
    sourceOfTruth,
    'docs/02-architecture/external-kms-hsm-provider-decision.md',
    'KMS/HSM provider decision: source-of-truth tracker links this decision',
  );
  includes(
    cryptoPolicy,
    'External KMS/HSM provider decision',
    'KMS/HSM provider decision: cryptography policy links this decision',
  );
  includes(
    researchLedger,
    '### 43. External KMS/HSM Provider Decision',
    'KMS/HSM provider decision: research ledger entry exists',
  );
  assert.equal(
    packageJson.scripts['test:external-kms-hsm-provider-decision'],
    'tsx tests/external-kms-hsm-provider-decision.test.ts',
    'KMS/HSM provider decision: package script is registered',
  );
  passed += 1;
}

testDecisionSelectsGcpFirst();
testDecisionRecordsProviderMatrixAndNoGos();
testDecisionHasPrimarySourcesAndRepoLinks();

console.log(`External KMS/HSM provider decision tests: ${passed} passed, 0 failed`);
