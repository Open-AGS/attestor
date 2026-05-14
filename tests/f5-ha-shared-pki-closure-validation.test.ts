import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV,
  createReleaseRuntimeBootstrap,
} from '../src/service/bootstrap/release-runtime.js';
import {
  ATTESTOR_RUNTIME_PROFILE_ENV,
  findRuntimeProfile,
} from '../src/service/bootstrap/runtime-profile.js';
import { resetKeylessCa } from '../src/signing/keyless-signer.js';

let passed = 0;

const ENV_KEYS = [
  ATTESTOR_RUNTIME_PROFILE_ENV,
  ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV,
  ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV,
  'ATTESTOR_HA_MODE',
  'ATTESTOR_RELEASE_RUNTIME_PKI_REQUIRE_SHARED_PATH',
] as const;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function productionSharedProfile() {
  const profile = findRuntimeProfile('production-shared');
  assert.ok(profile, 'production-shared profile must exist');
  return profile;
}

function saveEnvironment(): Map<string, string | undefined> {
  return new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(previous: Map<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = previous.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function withTempCwd<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), 'attestor-f5-ha-shared-pki-'));
  const previousCwd = process.cwd();
  try {
    process.chdir(root);
    return await fn(root);
  } finally {
    process.chdir(previousCwd);
    rmSync(root, { recursive: true, force: true });
  }
}

async function testProductionSharedPreflightDoesNotPersistLocalPki(): Promise<void> {
  const previous = saveEnvironment();
  resetKeylessCa();
  await withTempCwd(async (root) => {
    try {
      process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = 'production-shared';
      delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV];
      delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV];

      const runtime = await createReleaseRuntimeBootstrap({
        runtimeProfile: productionSharedProfile(),
        allowPreflightOnDurabilityViolation: true,
      });
      equal(runtime.pkiReady, false, 'F5 HA PKI: production-shared preflight is not PKI-ready without shared-path attestation');
      equal(runtime.pkiPersistence.mode, 'ephemeral', 'F5 HA PKI: preflight uses only ephemeral PKI when shared path is missing');
      equal(runtime.pkiPersistence.sharedPathRequired, true, 'F5 HA PKI: production-shared implicitly requires shared PKI path');
      equal(runtime.pkiPersistence.sharedPathAttested, false, 'F5 HA PKI: missing attestation is recorded');
      equal(
        existsSync(join(root, '.attestor', 'release-runtime-pki.json')),
        false,
        'F5 HA PKI: preflight does not create default local issuer key material',
      );
    } finally {
      restoreEnvironment(previous);
      resetKeylessCa();
    }
  });
}

async function testProductionSharedPreflightRejectsUnattestedConfiguredPath(): Promise<void> {
  const previous = saveEnvironment();
  resetKeylessCa();
  await withTempCwd(async (root) => {
    try {
      const pkiPath = join(root, 'release-runtime-pki.json');
      process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = 'production-shared';
      process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV] = pkiPath;
      delete process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV];

      const runtime = await createReleaseRuntimeBootstrap({
        runtimeProfile: productionSharedProfile(),
        allowPreflightOnDurabilityViolation: true,
      });
      equal(runtime.pkiReady, false, 'F5 HA PKI: configured but unattested path is not PKI-ready');
      equal(runtime.pkiPersistence.mode, 'ephemeral', 'F5 HA PKI: unattested path does not become file-backed in preflight');
      equal(existsSync(pkiPath), false, 'F5 HA PKI: unattested path does not create issuer key material');
    } finally {
      restoreEnvironment(previous);
      resetKeylessCa();
    }
  });
}

async function testProductionSharedSharedPathAttestationCreatesReadyFileBackedPki(): Promise<void> {
  const previous = saveEnvironment();
  resetKeylessCa();
  await withTempCwd(async (root) => {
    try {
      const pkiPath = join(root, 'release-runtime-pki.json');
      process.env[ATTESTOR_RUNTIME_PROFILE_ENV] = 'production-shared';
      process.env[ATTESTOR_RELEASE_RUNTIME_PKI_PATH_ENV] = pkiPath;
      process.env[ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH_ENV] = 'true';

      const runtime = await createReleaseRuntimeBootstrap({
        runtimeProfile: productionSharedProfile(),
        allowPreflightOnDurabilityViolation: true,
      });
      equal(runtime.pkiReady, true, 'F5 HA PKI: attested shared path is PKI-ready');
      equal(runtime.pkiPersistence.mode, 'file', 'F5 HA PKI: attested path uses file-backed PKI');
      equal(runtime.pkiPersistence.sharedPathRequired, true, 'F5 HA PKI: production-shared requirement stays recorded');
      equal(runtime.pkiPersistence.sharedPathAttested, true, 'F5 HA PKI: shared-path attestation is recorded');
      ok(existsSync(pkiPath), 'F5 HA PKI: attested shared path creates the issuer store');
    } finally {
      restoreEnvironment(previous);
      resetKeylessCa();
    }
  });
}

async function run(): Promise<void> {
  await testProductionSharedPreflightDoesNotPersistLocalPki();
  await testProductionSharedPreflightRejectsUnattestedConfiguredPath();
  await testProductionSharedSharedPathAttestationCreatesReadyFileBackedPki();

  console.log(`F5 HA shared PKI closure validation tests: ${passed} passed, 0 failed`);
}

run().catch((error) => {
  console.error('F5 HA shared PKI closure validation tests failed:', error);
  process.exitCode = 1;
});
