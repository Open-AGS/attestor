import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_SHARED_STORE_PROFILE_SPEC_VERSION,
  evaluateConsequenceSharedStoreProfile,
} from '../src/service/bootstrap/consequence-shared-store-profile.js';
import type {
  ProductionStorageMode,
  ProductionStoragePathComponentId,
} from '../src/service/bootstrap/production-storage-path.js';

let passed = 0;

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function allSharedComponentModes(): Partial<
Readonly<Record<ProductionStoragePathComponentId, ProductionStorageMode>>
> {
  return {
    'shadow-admission-events': 'shared-durable',
    'shadow-policy-simulations': 'shared-durable',
    'shadow-policy-candidates': 'shared-durable',
    'shadow-activation-receipts': 'shared-durable',
    'policy-foundry-hosted-wizard-state': 'shared-durable',
    'retry-attempt-ledger': 'shared-durable',
    'presentation-replay-ledger': 'shared-durable',
    'agent-loop-abuse-guard': 'shared-durable',
    'audit-evidence-export': 'shared-durable',
    'business-risk-dashboard': 'shared-durable',
  };
}

function testEvaluationProfileAcceptsBacklogWithoutProductionClaim(): void {
  const profile = evaluateConsequenceSharedStoreProfile({
    runtimeProfileId: 'local-dev',
    controlPlaneMode: 'file',
    releaseAuthorityMode: 'disabled',
    componentModes: {
      'agent-loop-abuse-guard': 'in-memory-reference',
    },
    evaluatedAt: '2026-05-15T08:00:00.000Z',
  });

  equal(
    profile.version,
    CONSEQUENCE_SHARED_STORE_PROFILE_SPEC_VERSION,
    'Consequence shared-store profile: version is explicit',
  );
  equal(
    profile.state,
    'evaluation-shared-store-backlog-accepted',
    'Consequence shared-store profile: local-dev accepts backlog without production claim',
  );
  equal(profile.readyForSelectedProfile, true, 'Consequence shared-store profile: local-dev stays runnable');
  equal(profile.productionReady, false, 'Consequence shared-store profile: local-dev is not production ready');
  equal(profile.blockers.length, 0, 'Consequence shared-store profile: local-dev emits no production blockers');
  equal(profile.authorityComponents.length, 2, 'Consequence shared-store profile: authority substrate is inventoried');
  equal(profile.components.length, 10, 'Consequence shared-store profile: consequence/read-model surfaces are inventoried');
  ok(
    profile.backlogComponentIds.includes('retry-attempt-ledger'),
    'Consequence shared-store profile: retry ledger remains backlog outside production',
  );
  ok(
    profile.noGoConditions.includes('in-memory-reference-ledger'),
    'Consequence shared-store profile: in-memory ledger no-go is named',
  );
  equal(
    profile.activatesStorageMigration,
    false,
    'Consequence shared-store profile: evaluator does not activate storage migration',
  );
}

function testProductionSharedBlocksCurrentConsequenceStores(): void {
  const profile = evaluateConsequenceSharedStoreProfile({
    runtimeProfileId: 'production-shared',
    controlPlaneMode: 'postgres',
    releaseAuthorityMode: 'postgres',
    componentModes: {
      'control-plane-state': 'shared-postgres',
      'release-authority-state': 'shared-postgres',
      'agent-loop-abuse-guard': 'in-memory-reference',
    },
    evaluatedAt: '2026-05-15T08:01:00.000Z',
  });

  equal(
    profile.state,
    'production-shared-consequence-blocked',
    'Consequence shared-store profile: production-shared blocks current consequence stores',
  );
  equal(profile.authorityStoreReady, true, 'Consequence shared-store profile: authority substrate can be ready');
  equal(profile.consequenceStoreReady, false, 'Consequence shared-store profile: consequence stores are not ready by default');
  equal(profile.readyForSelectedProfile, false, 'Consequence shared-store profile: selected production profile is blocked');
  ok(
    profile.blockingComponentIds.includes('retry-attempt-ledger'),
    'Consequence shared-store profile: retry ledger blocks production-shared',
  );
  ok(
    profile.blockingComponentIds.includes('presentation-replay-ledger'),
    'Consequence shared-store profile: replay ledger blocks production-shared',
  );
  ok(
    profile.blockingComponentIds.includes('audit-evidence-export'),
    'Consequence shared-store profile: audit source history blocks production-shared',
  );
  ok(
    profile.noGoConditions.includes('file-backed-evaluation-history'),
    'Consequence shared-store profile: file-backed history no-go is named',
  );
  ok(
    profile.noGoConditions.includes('derived-evaluation-read-model'),
    'Consequence shared-store profile: derived read-model no-go is named',
  );
  ok(
    profile.blockers.some((blocker) => blocker.code === 'in-memory-reference-not-shared'),
    'Consequence shared-store profile: in-memory blocker is carried from storage path',
  );
}

function testAuthoritySubstrateStillBlocksSelectedProfile(): void {
  const profile = evaluateConsequenceSharedStoreProfile({
    runtimeProfileId: 'production-shared',
    controlPlaneMode: 'file',
    releaseAuthorityMode: 'disabled',
    componentModes: allSharedComponentModes(),
    evaluatedAt: '2026-05-15T08:02:00.000Z',
  });

  equal(
    profile.state,
    'production-shared-consequence-blocked',
    'Consequence shared-store profile: shared consequence stores still need authority substrate',
  );
  equal(profile.authorityStoreReady, false, 'Consequence shared-store profile: authority substrate is not ready');
  equal(profile.consequenceStoreReady, true, 'Consequence shared-store profile: consequence inventory can be satisfied');
  ok(
    profile.blockingComponentIds.includes('control-plane-state'),
    'Consequence shared-store profile: control-plane substrate blocks selected profile',
  );
  ok(
    profile.blockingComponentIds.includes('release-authority-state'),
    'Consequence shared-store profile: release-authority substrate blocks selected profile',
  );
  ok(
    profile.noGoConditions.includes('shared-authority-substrate-missing'),
    'Consequence shared-store profile: missing authority substrate no-go is named',
  );
}

function testReadyOnlyWhenEveryRelevantSurfaceIsShared(): void {
  const profile = evaluateConsequenceSharedStoreProfile({
    runtimeProfileId: 'production-shared',
    controlPlaneMode: 'postgres',
    releaseAuthorityMode: 'postgres',
    componentModes: {
      'control-plane-state': 'shared-postgres',
      'release-authority-state': 'shared-postgres',
      ...allSharedComponentModes(),
    },
    evaluatedAt: '2026-05-15T08:03:00.000Z',
  });

  equal(
    profile.state,
    'production-shared-consequence-ready',
    'Consequence shared-store profile: all shared surfaces clear this profile',
  );
  equal(profile.productionReady, true, 'Consequence shared-store profile: all relevant surfaces are ready');
  equal(profile.readyForSelectedProfile, true, 'Consequence shared-store profile: selected profile readiness clears');
  equal(profile.backlogComponentIds.length, 0, 'Consequence shared-store profile: no backlog remains');
  equal(profile.blockers.length, 0, 'Consequence shared-store profile: no production blockers remain');
  equal(profile.noGoConditions.length, 0, 'Consequence shared-store profile: no no-go condition remains');
  ok(
    profile.components.every((component) => component.rawPayloadStored === false),
    'Consequence shared-store profile: components remain raw-payload free',
  );
  ok(
    profile.components.every((component) => component.exposesStorageSecret === false),
    'Consequence shared-store profile: components do not expose storage secrets',
  );
}

function testNoSecretLeakageInDiagnostics(): void {
  const previousControlPlane = process.env.ATTESTOR_CONTROL_PLANE_PG_URL;
  const previousReleaseAuthority = process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL;
  try {
    process.env.ATTESTOR_CONTROL_PLANE_PG_URL =
      'postgres://attestor:secret-control@db.example.invalid:5432/control';
    process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL =
      'postgres://attestor:secret-release@db.example.invalid:5432/release';
    const text = JSON.stringify(evaluateConsequenceSharedStoreProfile({
      runtimeProfileId: 'production-shared',
      componentModes: {
        'agent-loop-abuse-guard': 'in-memory-reference',
      },
    }));
    equal(text.includes('secret-control'), false, 'Consequence shared-store profile: control password is not exposed');
    equal(text.includes('secret-release'), false, 'Consequence shared-store profile: release password is not exposed');
    equal(text.includes('db.example.invalid'), false, 'Consequence shared-store profile: storage hostname is not exposed');
  } finally {
    if (previousControlPlane === undefined) delete process.env.ATTESTOR_CONTROL_PLANE_PG_URL;
    else process.env.ATTESTOR_CONTROL_PLANE_PG_URL = previousControlPlane;
    if (previousReleaseAuthority === undefined) delete process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL;
    else process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL = previousReleaseAuthority;
  }
}

function testDocsAndPackageWiring(): void {
  const source = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'consequence-shared-store-profile.ts',
  );
  const apiRuntime = readProjectFile('src', 'service', 'bootstrap', 'api-route-runtime.ts');
  const requestGuard = readProjectFile(
    'src',
    'service',
    'bootstrap',
    'production-shared-request-guard.ts',
  );
  const server = readProjectFile('src', 'service', 'bootstrap', 'server.ts');
  const coreRoutes = readProjectFile('src', 'service', 'http', 'routes', 'core-routes.ts');
  const docs = readProjectFile('docs', '02-architecture', 'production-storage-path.md');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');
  const audit = readProjectFile('docs', 'audit', 'consequence-shared-store-profile-validation.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  ok(
    source.includes('atomic-record-if-absent'),
    'Consequence shared-store profile: retry ledger primitive is encoded',
  );
  ok(
    source.includes('atomic-set-if-absent'),
    'Consequence shared-store profile: replay ledger primitive is encoded',
  );
  ok(
    apiRuntime.includes('evaluateConsequenceSharedStoreProfileState'),
    'Consequence shared-store profile: API runtime wires evaluator',
  );
  ok(
    apiRuntime.includes('consequenceSharedStoreProfile,'),
    'Consequence shared-store profile: API runtime exposes profile in security diagnostics',
  );
  ok(
    requestGuard.includes('consequenceSharedStoreProfileReady'),
    'Consequence shared-store profile: production-shared request guard checks profile readiness',
  );
  ok(
    server.includes('Production-shared startup consequence storage gate failed'),
    'Consequence shared-store profile: startup diagnostics can fail closed on profile blockers',
  );
  ok(
    coreRoutes.includes('checks.consequenceSharedStoreProfile'),
    'Consequence shared-store profile: ready route checks the profile when wired',
  );
  ok(
    coreRoutes.includes('consequenceSharedStoreProfile,'),
    'Consequence shared-store profile: health and ready routes expose diagnostics',
  );
  ok(
    docs.includes('## Consequence Shared Store Profile'),
    'Consequence shared-store profile docs: production storage path names the profile',
  );
  ok(
    docs.includes('does not activate a migration'),
    'Consequence shared-store profile docs: migration non-claim is explicit',
  );
  ok(
    audit.includes('Protected principles'),
    'Consequence shared-store profile audit: protected principles are documented',
  );
  ok(
    audit.includes('PostgreSQL `INSERT ... ON CONFLICT`'),
    'Consequence shared-store profile audit: PostgreSQL primary anchor is documented',
  );
  ok(
    productionReadiness.includes('consequenceSharedStoreProfile'),
    'Consequence shared-store profile docs: production readiness guide names the runtime field',
  );
  equal(
    packageJson.scripts['test:consequence-shared-store-profile'],
    'tsx tests/consequence-shared-store-profile.test.ts',
    'Consequence shared-store profile: focused npm script is registered',
  );
}

function run(): void {
  testEvaluationProfileAcceptsBacklogWithoutProductionClaim();
  testProductionSharedBlocksCurrentConsequenceStores();
  testAuthoritySubstrateStillBlocksSelectedProfile();
  testReadyOnlyWhenEveryRelevantSurfaceIsShared();
  testNoSecretLeakageInDiagnostics();
  testDocsAndPackageWiring();
  console.log(`Consequence shared-store profile tests: ${passed} passed, 0 failed`);
}

run();
