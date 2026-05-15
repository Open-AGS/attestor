import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  evaluateProductionStoragePath,
  type ProductionStorageMode,
  type ProductionStoragePathComponentId,
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

function testEvaluationProfiles(): void {
  const local = evaluateProductionStoragePath({
    runtimeProfileId: 'local-dev',
    controlPlaneMode: 'file',
    releaseAuthorityMode: 'disabled',
    evaluatedAt: '2026-05-05T00:00:00.000Z',
  });
  equal(local.state, 'evaluation-storage-accepted', 'Production storage path: local-dev accepts evaluation storage');
  equal(local.readyForSelectedProfile, true, 'Production storage path: local-dev does not claim production readiness');
  equal(local.productionReady, false, 'Production storage path: local-dev is not production ready');
  equal(local.blockers.length, 0, 'Production storage path: non-production profiles do not emit production blockers');
  equal(local.rawPayloadStored, false, 'Production storage path: diagnostics are raw-payload free');
  equal(local.exposesConnectionStrings, false, 'Production storage path: diagnostics do not expose connection strings');

  const singleNode = evaluateProductionStoragePath({
    runtimeProfileId: 'single-node-durable',
    controlPlaneMode: 'file',
    releaseAuthorityMode: 'disabled',
  });
  equal(singleNode.readyForSelectedProfile, true, 'Production storage path: single-node durable remains evaluation acceptable');
  equal(singleNode.components.length, 12, 'Production storage path: inventories every storage surface');
}

function testProductionSharedBlocksCurrentEvaluationStores(): void {
  const production = evaluateProductionStoragePath({
    runtimeProfileId: 'production-shared',
    controlPlaneMode: 'file',
    releaseAuthorityMode: 'disabled',
    evaluatedAt: '2026-05-05T00:00:00.000Z',
  });

  equal(production.state, 'production-shared-blocked', 'Production storage path: production-shared blocks by default');
  equal(production.readyForSelectedProfile, false, 'Production storage path: production-shared is not ready with evaluation stores');
  ok(
    production.blockers.some((blocker) => blocker.code === 'shared-control-plane-required'),
    'Production storage path: missing shared control plane is a blocker',
  );
  ok(
    production.blockers.some((blocker) => blocker.code === 'shared-release-authority-required'),
    'Production storage path: missing shared release authority is a blocker',
  );
  ok(
    production.blockers.some((blocker) => blocker.code === 'evaluation-store-not-shared'),
    'Production storage path: file-backed shadow stores are blockers',
  );
  ok(
    production.blockers.some((blocker) =>
      blocker.component === 'policy-foundry-hosted-wizard-state' &&
      blocker.code === 'evaluation-store-not-shared'
    ),
    'Production storage path: hosted wizard state must not be omitted from production-shared blockers',
  );
  ok(
    production.blockers.some((blocker) => blocker.code === 'in-memory-reference-not-shared'),
    'Production storage path: in-memory ledgers and guards are blockers',
  );
  ok(
    production.blockers.some((blocker) => blocker.code === 'derived-view-source-not-shared'),
    'Production storage path: derived audit/dashboard sources are blockers',
  );
}

function testProductionSharedReadyOnlyWithSharedStorage(): void {
  const production = evaluateProductionStoragePath({
    runtimeProfileId: 'production-shared',
    controlPlaneMode: 'postgres',
    releaseAuthorityMode: 'postgres',
    componentModes: {
      'control-plane-state': 'shared-postgres',
      'release-authority-state': 'shared-postgres',
      ...allSharedComponentModes(),
    },
  });

  equal(production.state, 'production-shared-ready', 'Production storage path: all shared storage can satisfy production-shared');
  equal(production.readyForSelectedProfile, true, 'Production storage path: shared storage clears selected profile readiness');
  equal(production.productionReady, true, 'Production storage path: shared storage is production-ready for this inventory');
  equal(production.blockers.length, 0, 'Production storage path: shared inventory has no blockers');
  ok(
    production.components.every((component) => component.rawPayloadStored === false),
    'Production storage path: every component advertises data minimization',
  );
  ok(
    production.components.every((component) => component.exposesStorageSecret === false),
    'Production storage path: every component avoids exposing storage secrets',
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
    const text = JSON.stringify(evaluateProductionStoragePath({
      runtimeProfileId: 'production-shared',
    }));
    equal(text.includes('secret-control'), false, 'Production storage path: control-plane password is not exposed');
    equal(text.includes('secret-release'), false, 'Production storage path: release-authority password is not exposed');
    equal(text.includes('db.example.invalid'), false, 'Production storage path: storage hostnames are not exposed');
  } finally {
    if (previousControlPlane === undefined) delete process.env.ATTESTOR_CONTROL_PLANE_PG_URL;
    else process.env.ATTESTOR_CONTROL_PLANE_PG_URL = previousControlPlane;
    if (previousReleaseAuthority === undefined) delete process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL;
    else process.env.ATTESTOR_RELEASE_AUTHORITY_PG_URL = previousReleaseAuthority;
  }
}

function testDocsAndRuntimeWiring(): void {
  const docs = readProjectFile('docs', '02-architecture', 'production-storage-path.md');
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');
  const coreRoutes = readProjectFile('src', 'service', 'http', 'routes', 'core-routes.ts');
  const apiRuntime = readProjectFile('src', 'service', 'bootstrap', 'api-route-runtime.ts');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  ok(docs.includes('# Production Storage Path'), 'Production storage path docs: document exists');
  ok(docs.includes('production-shared-blocked'), 'Production storage path docs: blocked state is documented');
  ok(docs.includes('file-backed evaluation stores'), 'Production storage path docs: evaluation store boundary is named');
  ok(docs.includes('Policy Foundry hosted wizard resume state'), 'Production storage path docs: hosted wizard state is inventoried');
  ok(docs.includes('protected request'), 'Production storage path docs: request guard boundary is documented');
  ok(docs.includes('Debezium Outbox Event Router'), 'Production storage path docs: outbox primary anchor is documented');
  ok(productionReadiness.includes('## Production Storage Path Gate'), 'Production readiness docs: storage gate section exists');
  ok(productionReadiness.includes('productionStoragePath'), 'Production readiness docs: readiness response field is documented');
  ok(productionReadiness.includes('non-preflight `/api/v1/*` routes'), 'Production readiness docs: protected route guard boundary is documented');
  ok(coreRoutes.includes('checks.productionStoragePath'), 'Production storage path: ready route checks storage path');
  ok(coreRoutes.includes('productionStoragePath,'), 'Production storage path: health route exposes diagnostics');
  ok(apiRuntime.includes('evaluateProductionStoragePathState'), 'Production storage path: API runtime wires evaluator');
  equal(
    packageJson.scripts['test:production-storage-path'],
    'tsx tests/production-storage-path.test.ts',
    'Production storage path: focused npm script is registered',
  );
}

function run(): void {
  testEvaluationProfiles();
  testProductionSharedBlocksCurrentEvaluationStores();
  testProductionSharedReadyOnlyWithSharedStorage();
  testNoSecretLeakageInDiagnostics();
  testDocsAndRuntimeWiring();
  console.log(`Production storage path tests: ${passed} passed, 0 failed`);
}

run();
