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

function testClosureDocRecordsContract(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'external-signer-contract-closure.md',
  );

  for (const expected of [
    '# External Signer Contract Closure',
    'provider protection level',
    'provider sign request digest',
    'provider response digest',
    'raw provider response redaction state',
    '`live-provider-proof-stale`',
    '`live-provider-proof-descriptor-mismatch`',
    '`live-provider-proof-verification-failed`',
    '`live-provider-protection-level-insufficient`',
    'The fake external KMS signer remains test-only.',
    '`external-kms` still fails closed in runtime bootstrap until a real provider is',
  ]) {
    includes(doc, expected, `External signer closure: document records ${expected}`);
  }

  excludes(
    doc,
    /\bproduction-ready\b(?![\s\S]{0,80}(without|until|not|no|claim|readiness|proof))/iu,
    'External signer closure: does not make an unqualified production-ready claim',
  );
}

function testSourceContractCarriesClosedFields(): void {
  const source = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'release-tenant-signer-boundary.ts',
  );

  for (const expected of [
    'RELEASE_TENANT_SIGNER_PROVIDER_PROTECTION_LEVELS',
    'providerProtectionLevel',
    'providerRequestDigest',
    'providerResponseDigest',
    'liveProviderProofProviderRequestDigest',
    'liveProviderProofProviderResponseDigest',
    'rawProviderResponseStored: false',
    'providerProtectionLevelProductionReady',
    'live-provider-protection-level-insufficient',
  ]) {
    includes(source, expected, `External signer closure: source carries ${expected}`);
  }
}

function testTrackerPolicyProvenanceAndPackageAreAligned(): void {
  const tracker = readProjectFile(
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

  includes(
    tracker,
    '| 03 | complete | External signer contract closure |',
    'External signer closure: source-of-truth tracker marks step 03 complete',
  );
  includes(
    cryptoPolicy,
    'External signer contract closure',
    'External signer closure: cryptography policy links closure doc',
  );
  includes(
    researchLedger,
    '### 44. External Signer Contract Closure',
    'External signer closure: research ledger entry exists',
  );
  assert.equal(
    packageJson.scripts['test:external-signer-contract-closure'],
    'tsx tests/external-signer-contract-closure.test.ts',
    'External signer closure: package script is registered',
  );
  passed += 1;
}

testClosureDocRecordsContract();
testSourceContractCarriesClosedFields();
testTrackerPolicyProvenanceAndPackageAreAligned();

console.log(`External signer contract closure tests: ${passed} passed, 0 failed`);
