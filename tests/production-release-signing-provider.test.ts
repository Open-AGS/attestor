import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ATTESTOR_RELEASE_DECISION_LOG_PATH_ENV } from '../src/release-kernel/release-decision-log.js';
import { ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV } from '../src/release-kernel/release-evidence-pack.js';
import { ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV } from '../src/release-kernel/release-introspection.js';
import { ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV } from '../src/release-kernel/reviewer-queue.js';
import {
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  createReleaseRuntimeBootstrap,
} from '../src/service/bootstrap/release-runtime.js';
import {
  ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV,
  ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV,
  ReleaseSigningProviderConfigurationError,
  buildReleaseSigningProviderDiagnostics,
} from '../src/service/bootstrap/release-signing-provider.js';
import {
  ATTESTOR_RUNTIME_PROFILE_ENV,
  findRuntimeProfile,
} from '../src/service/bootstrap/runtime-profile.js';

let passed = 0;

const STORE_PATH_ENV = [
  ATTESTOR_RUNTIME_PROFILE_ENV,
  ATTESTOR_RELEASE_DECISION_LOG_PATH_ENV,
  ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV,
  ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV,
  ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV,
  'ATTESTOR_RELEASE_ENFORCEMENT_DEGRADED_MODE_STORE_PATH',
  'ATTESTOR_POLICY_CONTROL_PLANE_STORE_PATH',
  'ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PATH',
  'ATTESTOR_POLICY_MUTATION_AUDIT_LOG_PATH',
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV,
  ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV,
] as const;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(value: string, expected: string, message: string): void {
  assert.ok(
    value.includes(expected),
    `${message}\nExpected to include: ${expected}\nActual: ${value}`,
  );
  passed += 1;
}

function restoreEnvironment(previous: Map<string, string | undefined>): void {
  for (const key of STORE_PATH_ENV) {
    const value = previous.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function durableProfile() {
  const profile = findRuntimeProfile('single-node-durable');
  assert.ok(profile, 'single-node-durable profile must exist');
  return profile;
}

function localProfile() {
  const profile = findRuntimeProfile('local-dev');
  assert.ok(profile, 'local-dev profile must exist');
  return profile;
}

function configureDurableRuntimePaths(root: string): void {
  process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = 'single-node-durable';
  process.env[ATTESTOR_RELEASE_DECISION_LOG_PATH_ENV] = join(root, 'release-decision-log.jsonl');
  process.env[ATTESTOR_RELEASE_REVIEWER_QUEUE_STORE_PATH_ENV] = join(root, 'release-reviewer-queue.json');
  process.env[ATTESTOR_RELEASE_TOKEN_INTROSPECTION_STORE_PATH_ENV] = join(root, 'release-token-introspection.json');
  process.env[ATTESTOR_RELEASE_EVIDENCE_PACK_STORE_PATH_ENV] = join(root, 'release-evidence-packs.json');
  process.env.ATTESTOR_RELEASE_ENFORCEMENT_DEGRADED_MODE_STORE_PATH = join(root, 'degraded-mode-grants.json');
  process.env.ATTESTOR_POLICY_CONTROL_PLANE_STORE_PATH = join(root, 'policy-control-plane.json');
  process.env.ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PATH = join(root, 'policy-activation-approvals.json');
  process.env.ATTESTOR_POLICY_MUTATION_AUDIT_LOG_PATH = join(root, 'policy-mutation-audit.json');
  process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV] = join(root, 'release-runtime-pki.json');
}

function testDiagnosticsDoNotOverclaimLocalSignerMaterial(): void {
  const ephemeral = buildReleaseSigningProviderDiagnostics({
    runtimeProfile: localProfile(),
    pkiPersistence: {
      mode: 'ephemeral',
      path: null,
    },
    env: {},
  });

  equal(
    ephemeral.kind,
    'runtime-ephemeral',
    'Release signing provider: local-dev without a PKI path is runtime-ephemeral',
  );
  equal(
    ephemeral.productionReady,
    false,
    'Release signing provider: ephemeral signer is not production-ready',
  );
  equal(
    ephemeral.privateKeyExportable,
    true,
    'Release signing provider: ephemeral runtime still owns exportable key material',
  );
  ok(
    ephemeral.blockers.some((blocker) => blocker.includes('changes on runtime restart')),
    'Release signing provider: ephemeral signer reports restart-verification blocker',
  );

  const filePem = buildReleaseSigningProviderDiagnostics({
    runtimeProfile: durableProfile(),
    pkiPersistence: {
      mode: 'file',
      path: '/var/lib/attestor/release-runtime-pki.json',
    },
    env: {},
  });

  equal(
    filePem.kind,
    'file-pem',
    'Release signing provider: durable file-backed PKI is classified as file-pem',
  );
  equal(
    filePem.productionReady,
    false,
    'Release signing provider: file-backed PEM is restart-safe but not production KMS/HSM-ready',
  );
  ok(
    filePem.blockers.some((blocker) => blocker.includes('external KMS/HSM provider')),
    'Release signing provider: file-backed PEM reports external provider promotion blocker',
  );
}

async function expectBootstrapError(input: {
  root: string;
  messageIncludes: string;
}): Promise<void> {
  try {
    await createReleaseRuntimeBootstrap({ runtimeProfile: durableProfile() });
    assert.fail('expected release signing provider bootstrap to fail closed');
  } catch (error) {
    ok(
      error instanceof ReleaseSigningProviderConfigurationError,
      'Release signing provider: bootstrap fails with a release signing provider configuration error',
    );
    includes(
      error instanceof Error ? error.message : String(error),
      input.messageIncludes,
      'Release signing provider: bootstrap failure explains the unsafe signing provider configuration',
    );
  }

  equal(
    existsSync(join(input.root, 'release-runtime-pki.json')),
    false,
    'Release signing provider: fail-closed preflight does not create local issuer key material',
  );
}

async function testExternalKmsDeclarationFailsClosed(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'attestor-release-signing-external-'));
  const previousEnv = new Map<string, string | undefined>(
    STORE_PATH_ENV.map((key) => [key, process.env[key]]),
  );

  try {
    configureDurableRuntimePaths(root);
    process.env[ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV] = 'external-kms';
    await expectBootstrapError({
      root,
      messageIncludes: 'external-kms is not implemented yet',
    });
  } finally {
    restoreEnvironment(previousEnv);
    rmSync(root, { recursive: true, force: true });
  }
}

async function testStrictProductionProviderGateFailsClosed(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'attestor-release-signing-strict-'));
  const previousEnv = new Map<string, string | undefined>(
    STORE_PATH_ENV.map((key) => [key, process.env[key]]),
  );

  try {
    configureDurableRuntimePaths(root);
    process.env[ATTESTOR_REQUIRE_PRODUCTION_RELEASE_SIGNING_PROVIDER_ENV] = 'true';
    await expectBootstrapError({
      root,
      messageIncludes: 'requires a supported external KMS/HSM release signing provider',
    });
  } finally {
    restoreEnvironment(previousEnv);
    rmSync(root, { recursive: true, force: true });
  }
}

async function testFilePemProviderRemainsTruthful(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'attestor-release-signing-file-'));
  const previousEnv = new Map<string, string | undefined>(
    STORE_PATH_ENV.map((key) => [key, process.env[key]]),
  );

  try {
    configureDurableRuntimePaths(root);
    process.env[ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV] = 'file-pem';
    const runtime = await createReleaseRuntimeBootstrap({ runtimeProfile: durableProfile() });

    equal(
      runtime.releaseSigningProvider.kind,
      'file-pem',
      'Release signing provider: explicit file-pem provider is accepted for durable evaluation',
    );
    equal(
      runtime.releaseSigningProvider.productionReady,
      false,
      'Release signing provider: file-pem provider does not overclaim production readiness',
    );
    equal(
      runtime.releaseSigningProvider.privateKeyExportable,
      true,
      'Release signing provider: file-pem provider reports exportable private key material',
    );
    equal(
      existsSync(join(root, 'release-runtime-pki.json')),
      true,
      'Release signing provider: file-pem provider creates the selected local PKI store',
    );
  } finally {
    restoreEnvironment(previousEnv);
    rmSync(root, { recursive: true, force: true });
  }
}

async function testProviderMismatchFailsClosed(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'attestor-release-signing-mismatch-'));
  const previousEnv = new Map<string, string | undefined>(
    STORE_PATH_ENV.map((key) => [key, process.env[key]]),
  );

  try {
    configureDurableRuntimePaths(root);
    process.env[ATTESTOR_RELEASE_SIGNING_PROVIDER_ENV] = 'runtime-ephemeral';
    try {
      await createReleaseRuntimeBootstrap({ runtimeProfile: durableProfile() });
      assert.fail('expected provider mismatch to fail closed');
    } catch (error) {
      ok(
        error instanceof ReleaseSigningProviderConfigurationError,
        'Release signing provider: explicit provider mismatch fails with a configuration error',
      );
      includes(
        error instanceof Error ? error.message : String(error),
        'does not match resolved runtime signer file-pem',
        'Release signing provider: provider mismatch explains the resolved signer',
      );
    }
  } finally {
    restoreEnvironment(previousEnv);
    rmSync(root, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  testDiagnosticsDoNotOverclaimLocalSignerMaterial();
  await testExternalKmsDeclarationFailsClosed();
  await testStrictProductionProviderGateFailsClosed();
  await testFilePemProviderRemainsTruthful();
  await testProviderMismatchFailsClosed();

  console.log(`production-release-signing-provider.test.ts: ${passed} assertions passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
