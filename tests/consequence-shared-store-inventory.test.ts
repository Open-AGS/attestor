import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_SHARED_STORE_COMPONENTS,
} from '../src/service/bootstrap/consequence-shared-store-profile.js';
import {
  CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS,
  CONSEQUENCE_SHARED_STORE_INVENTORY_VERSION,
  evaluateConsequenceSharedStoreInventory,
} from '../src/service/bootstrap/consequence-shared-store-inventory.js';

let passed = 0;

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

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function testInventoryCoversProfileComponents(): void {
  const evaluation = evaluateConsequenceSharedStoreInventory({
    evaluatedAt: '2026-05-16T09:00:00.000Z',
  });

  equal(
    evaluation.version,
    CONSEQUENCE_SHARED_STORE_INVENTORY_VERSION,
    'Consequence shared-store inventory: version is explicit',
  );
  equal(
    evaluation.productionReady,
    false,
    'Consequence shared-store inventory: inventory does not claim production readiness',
  );
  equal(
    evaluation.activatesStorageMigration,
    false,
    'Consequence shared-store inventory: inventory does not activate migration',
  );
  equal(
    evaluation.rawPayloadStored,
    false,
    'Consequence shared-store inventory: diagnostics stay raw-payload free',
  );
  equal(
    evaluation.profileCoverageComplete,
    true,
    'Consequence shared-store inventory: all profile components are covered',
  );
  equal(
    evaluation.missingProfileComponentIds.length,
    0,
    'Consequence shared-store inventory: no profile component is missing',
  );
  equal(
    evaluation.profileComponentCount,
    CONSEQUENCE_SHARED_STORE_COMPONENTS.length,
    'Consequence shared-store inventory: profile component count matches the profile',
  );
  ok(
    evaluation.totalItems > CONSEQUENCE_SHARED_STORE_COMPONENTS.length,
    'Consequence shared-store inventory: includes adjacent receipt/read-model/domain projection surfaces',
  );
}

function testFirstAndSecondSlicesAreExplicit(): void {
  const evaluation = evaluateConsequenceSharedStoreInventory();

  deepEqual(
    evaluation.firstPrItemIds,
    ['retry-attempt-ledger', 'presentation-replay-ledger'],
    'Consequence shared-store inventory: first implementation slice is atomic retry/replay',
  );
  ok(
    evaluation.secondPrItemIds.includes('shadow-admission-events'),
    'Consequence shared-store inventory: append-only event history is in slice 09',
  );
  ok(
    evaluation.secondPrItemIds.includes('audit-evidence-export'),
    'Consequence shared-store inventory: audit read-model source history is in slice 09',
  );
  ok(
    evaluation.secondPrItemIds.includes('downstream-execution-receipt'),
    'Consequence shared-store inventory: downstream receipts are in slice 09',
  );
  equal(
    evaluation.recommendedNextPr,
    '10-llm-provider-runtime-decision',
    'Consequence shared-store inventory: next PR recommendation moves to provider runtime decision after Step 09',
  );
}

function testProductionBlockersAndProofShape(): void {
  const retry = CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS.find((item) =>
    item.id === 'retry-attempt-ledger'
  );
  const replay = CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS.find((item) =>
    item.id === 'presentation-replay-ledger'
  );
  const dashboard = CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS.find((item) =>
    item.id === 'business-risk-dashboard'
  );

  ok(retry, 'Consequence shared-store inventory: retry ledger item exists');
  ok(replay, 'Consequence shared-store inventory: presentation replay item exists');
  ok(dashboard, 'Consequence shared-store inventory: dashboard item exists');

  equal(
    retry?.requiredPrimitive,
    'atomic-record-if-absent',
    'Consequence shared-store inventory: retry ledger requires record-if-absent',
  );
  ok(
    retry?.requiredOperationalProofs.includes('idempotency-constraint-digest'),
    'Consequence shared-store inventory: retry ledger requires idempotency proof digest',
  );
  equal(
    replay?.requiredPrimitive,
    'atomic-set-if-absent',
    'Consequence shared-store inventory: presentation replay requires set-if-absent',
  );
  ok(
    dashboard?.requiredOperationalProofs.includes('worker-claim-query-digest'),
    'Consequence shared-store inventory: read-model sources require worker claim proof',
  );
  ok(
    evaluateConsequenceSharedStoreInventory().productionBlockingItemIds.includes('agent-loop-abuse-guard'),
    'Consequence shared-store inventory: agent-loop guard remains a production-shared blocker until shared proof exists',
  );
}

function testCryptoStaysOneEngineProjection(): void {
  const evaluation = evaluateConsequenceSharedStoreInventory();
  const crypto = CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS.find((item) =>
    item.id === 'crypto-execution-admission-telemetry-receipts'
  );

  ok(crypto, 'Consequence shared-store inventory: crypto projection item exists');
  equal(
    crypto?.plane,
    'domain-adapter-projection',
    'Consequence shared-store inventory: crypto is represented as a domain projection',
  );
  equal(
    crypto?.cryptoCompatible,
    true,
    'Consequence shared-store inventory: crypto item is compatible with the same engine',
  );
  ok(
    crypto?.nextContract.includes('not a separate store engine'),
    'Consequence shared-store inventory: crypto split is explicitly blocked',
  );
  ok(
    evaluation.noGoConditions.includes('do-not-split-crypto-into-a-separate-store-engine'),
    'Consequence shared-store inventory: no-go keeps crypto in the same storage engine',
  );
  deepEqual(
    evaluation.domainProjectionItemIds,
    ['crypto-execution-admission-telemetry-receipts'],
    'Consequence shared-store inventory: domain projections are explicit',
  );
}

function testEvidencePathsAndDocsAreWired(): void {
  for (const item of CONSEQUENCE_SHARED_STORE_INVENTORY_ITEMS) {
    for (const evidence of item.repositoryEvidence) {
      ok(
        existsSync(join(process.cwd(), evidence)),
        `Consequence shared-store inventory: evidence path exists for ${item.id}: ${evidence}`,
      );
    }
  }

  const docs = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-shared-store-inventory.md',
  );
  const tracker = readProjectFile(
    'docs',
    '02-architecture',
    'attestor-unlock-source-of-truth.md',
  );
  const masterPlan = readProjectFile(
    'docs',
    '02-architecture',
    'unified-shadow-to-policy-master-plan.md',
  );
  const researchLedger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const atomicStoreDoc = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-shared-atomic-stores.md',
  );
  const historyOutboxDoc = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-shared-history-outbox-store.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };

  ok(
    docs.includes('Inventory only'),
    'Consequence shared-store inventory docs: inventory-only boundary is explicit',
  );
  ok(
    docs.includes('PostgreSQL `INSERT ... ON CONFLICT`'),
    'Consequence shared-store inventory docs: ON CONFLICT source anchor is documented',
  );
  ok(
    docs.includes('crypto execution-admission telemetry and receipts stay a domain projection'),
    'Consequence shared-store inventory docs: crypto projection boundary is documented',
  );
  ok(
    tracker.includes('| Complete in this tracker | 12 |'),
    'Unlock tracker: completion count includes the production go/no-go packet',
  );
  ok(
    tracker.includes('| 07 | complete | Consequence shared-store inventory |'),
    'Unlock tracker: step 07 is complete',
  );
  ok(
    tracker.includes('| 08 | complete | Consequence shared-store PR slice 1 |'),
    'Unlock tracker: step 08 is complete',
  );
  ok(
    tracker.includes('| 09 | complete | Consequence shared-store PR slice 2 |'),
    'Unlock tracker: step 09 is complete',
  );
  ok(
    masterPlan.includes('| Complete | 20 |'),
    'Unified master plan: completion count includes the Policy Twin backtest',
  );
  ok(
    masterPlan.includes('| 07 | complete | Consequence shared-store inventory |'),
    'Unified master plan: step 07 is complete',
  );
  ok(
    masterPlan.includes('| 08 | complete | Consequence shared-store PR slice 1 |'),
    'Unified master plan: step 08 is complete',
  );
  ok(
    masterPlan.includes('| 09 | complete | Consequence shared-store PR slice 2 |'),
    'Unified master plan: step 09 is complete',
  );
  ok(
    atomicStoreDoc.includes('PostgreSQL-backed shared atomic store slice'),
    'Consequence shared atomic stores docs: Step 08 implementation doc exists',
  );
  ok(
    historyOutboxDoc.includes('PostgreSQL-backed shared source-history and outbox primitive'),
    'Consequence shared history outbox docs: Step 09 implementation doc exists',
  );
  ok(
    researchLedger.includes('### 49. Consequence Shared-Store Inventory'),
    'Research ledger: step 07 inventory entry is recorded',
  );
  ok(
    researchLedger.includes('### 50. Consequence Shared Atomic Stores'),
    'Research ledger: step 08 atomic store entry is recorded',
  );
  ok(
    researchLedger.includes('### 51. Consequence Shared History Outbox Store'),
    'Research ledger: step 09 history outbox entry is recorded',
  );
  equal(
    packageJson.scripts['test:consequence-shared-store-inventory'],
    'tsx tests/consequence-shared-store-inventory.test.ts',
    'Consequence shared-store inventory: package script is registered',
  );
  equal(
    packageJson.scripts['test:consequence-shared-atomic-stores'],
    'tsx tests/consequence-shared-atomic-stores.test.ts',
    'Consequence shared atomic stores: package script is registered',
  );
  equal(
    packageJson.scripts['test:consequence-shared-history-outbox-store'],
    'tsx tests/consequence-shared-history-outbox-store.test.ts',
    'Consequence shared history outbox store: package script is registered',
  );
}

testInventoryCoversProfileComponents();
testFirstAndSecondSlicesAreExplicit();
testProductionBlockersAndProofShape();
testCryptoStaysOneEngineProjection();
testEvidencePathsAndDocsAreWired();

console.log(`Consequence shared-store inventory tests: ${passed} passed, 0 failed`);
