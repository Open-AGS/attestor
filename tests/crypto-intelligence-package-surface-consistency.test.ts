import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES,
  CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS,
  createCryptoPackageSurfaceConsistencyProfile,
  cryptoPackageSurfaceConsistencyDescriptor,
} from '../src/crypto-intelligence/index.js';

type PackageJson = {
  readonly private: boolean;
  readonly exports: Readonly<Record<string, {
    readonly types?: string;
    readonly default?: string;
  }>>;
};

let passed = 0;

function packageJson(): PackageJson {
  return JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function deepEqual<T>(actual: T, expected: T, message: string): void {
  assert.deepEqual(actual, expected, message);
  passed += 1;
}

function testDescriptor(): void {
  const descriptor = cryptoPackageSurfaceConsistencyDescriptor();

  equal(
    descriptor.version,
    'attestor.crypto-package-surface-consistency.v1',
    'crypto package surface consistency: descriptor exposes version',
  );
  equal(
    descriptor.privatePackageRequired,
    true,
    'crypto package surface consistency: private package boundary is required',
  );
  equal(
    descriptor.publicNpmPublicationClaimed,
    false,
    'crypto package surface consistency: no public npm claim is made',
  );
  equal(
    descriptor.failClosedOnDrift,
    true,
    'crypto package surface consistency: drift fails closed',
  );
  deepEqual(
    descriptor.expectedExports,
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_EXPECTED_EXPORTS,
    'crypto package surface consistency: expected export targets are stable',
  );
  deepEqual(
    descriptor.deepImportProbes,
    CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES,
    'crypto package surface consistency: deep import probes are stable',
  );
}

function testActualPackageJsonPasses(): void {
  const pkg = packageJson();
  const profile = createCryptoPackageSurfaceConsistencyProfile({
    generatedAt: '2026-05-11T12:00:00.000Z',
    packagePrivate: pkg.private,
    exportMap: pkg.exports,
    blockedDeepImportProbes:
      CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES.map(
        (probe) => probe.specifier,
      ),
  });

  equal(profile.status, 'pass', 'crypto package surface consistency: package.json passes');
  equal(profile.summary.surfaceCount, 4, 'crypto package surface consistency: four surfaces are checked');
  equal(profile.summary.matchedExportCount, 4, 'crypto package surface consistency: all export targets match');
  equal(profile.summary.matchedDescriptorCount, 4, 'crypto package surface consistency: all descriptors match');
  equal(profile.summary.blockedDeepImportCount, 4, 'crypto package surface consistency: deep imports are blocked');
  deepEqual(
    profile.reasonCodes,
    ['package-surface-consistency-pass'],
    'crypto package surface consistency: pass reason is explicit',
  );
  ok(
    profile.digest.startsWith('sha256:'),
    'crypto package surface consistency: profile is digest-bound',
  );
}

function testMissingExportFailsClosed(): void {
  const pkg = packageJson();
  const { './crypto-intelligence': _removed, ...exportMap } = pkg.exports;
  const profile = createCryptoPackageSurfaceConsistencyProfile({
    generatedAt: '2026-05-11T12:00:00.000Z',
    packagePrivate: pkg.private,
    exportMap,
    blockedDeepImportProbes:
      CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES.map(
        (probe) => probe.specifier,
      ),
  });

  equal(profile.status, 'fail', 'crypto package surface consistency: missing export fails');
  ok(
    profile.reasonCodes.includes('package-export-map-entry-missing'),
    'crypto package surface consistency: missing export reason is reported',
  );
}

function testMismatchedExportFailsClosed(): void {
  const pkg = packageJson();
  const profile = createCryptoPackageSurfaceConsistencyProfile({
    generatedAt: '2026-05-11T12:00:00.000Z',
    packagePrivate: pkg.private,
    exportMap: {
      ...pkg.exports,
      './crypto-intelligence': {
        types: './dist/crypto-intelligence/wrong.d.ts',
        default: './dist/crypto-intelligence/index.js',
      },
    },
    blockedDeepImportProbes:
      CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES.map(
        (probe) => probe.specifier,
      ),
  });

  equal(profile.status, 'fail', 'crypto package surface consistency: mismatched export fails');
  ok(
    profile.reasonCodes.includes('package-export-target-mismatch'),
    'crypto package surface consistency: mismatch reason is reported',
  );
}

function testPrivatePackageAndDeepImportGuard(): void {
  const pkg = packageJson();
  const blocked = CRYPTO_PACKAGE_SURFACE_CONSISTENCY_DEEP_IMPORT_PROBES
    .filter((probe) => probe.surfaceId !== 'crypto-intelligence')
    .map((probe) => probe.specifier);
  const profile = createCryptoPackageSurfaceConsistencyProfile({
    generatedAt: '2026-05-11T12:00:00.000Z',
    packagePrivate: false,
    exportMap: pkg.exports,
    blockedDeepImportProbes: blocked,
  });

  equal(profile.status, 'fail', 'crypto package surface consistency: private and deep import drift fail');
  ok(
    profile.reasonCodes.includes('private-package-boundary-required'),
    'crypto package surface consistency: public package drift is reported',
  );
  ok(
    profile.reasonCodes.includes('deep-import-probe-unblocked'),
    'crypto package surface consistency: unblocked deep import is reported',
  );
}

testDescriptor();
testActualPackageJsonPasses();
testMissingExportFailsClosed();
testMismatchedExportFailsClosed();
testPrivatePackageAndDeepImportGuard();

console.log(`Crypto intelligence package surface consistency tests: ${passed} passed, 0 failed`);
