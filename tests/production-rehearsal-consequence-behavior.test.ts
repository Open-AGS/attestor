import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  rehearseProductionConsequenceBehavior,
  type ProductionConsequenceBehaviorStores,
  type ProductionConsequenceBehaviorSummary,
} from '../scripts/rehearse/rehearse-production-consequence-behavior.ts';
import {
  createInMemoryReleaseTokenIntrospectionStore,
} from '../src/release-kernel/release-introspection.js';
import {
  createInMemoryReleaseEvidencePackStore,
} from '../src/release-kernel/release-evidence-pack.js';
import {
  createInMemoryReleaseReviewerQueueStore,
  type ReleaseReviewerQueueListOptions,
  type ReleaseReviewerQueueRecord,
} from '../src/release-kernel/reviewer-queue.js';

let passed = 0;

type Env = Record<string, string | undefined>;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

function baseEnv(): Env {
  return {
    ATTESTOR_RUNTIME_PROFILE: 'production-shared',
    ATTESTOR_RELEASE_AUTHORITY_PG_URL: 'postgres://release-authority.example.invalid/attestor',
    ATTESTOR_PUBLIC_HOSTNAME: 'attestor.example.invalid',
  };
}

function passedSubstrateSummary() {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state: 'ready-for-rehearsal',
      issues: [],
    },
    target: {
      provider: 'gke',
      namespace: 'attestor',
      publicHostname: 'attestor.example.invalid',
    },
  };
}

function failedSubstrateSummary() {
  return {
    ...passedSubstrateSummary(),
    readiness: {
      passed: false,
      state: 'blocked-on-substrates',
      issues: ['ha-runtime-connectivity: Release-authority PostgreSQL connectivity failed'],
    },
  };
}

function fakeStores(overrides?: {
  readonly registerIssuedToken?: () => Promise<never>;
}): ProductionConsequenceBehaviorStores {
  const tokenIntrospection = createInMemoryReleaseTokenIntrospectionStore();
  const evidencePack = createInMemoryReleaseEvidencePackStore();
  const reviewerQueue = createInMemoryReleaseReviewerQueueStore();
  let claimVersion = 0;

  return {
    tokenIntrospection: {
      ...tokenIntrospection,
      registerIssuedToken: overrides?.registerIssuedToken ?? tokenIntrospection.registerIssuedToken,
    },
    evidencePack,
    reviewerQueue: {
      upsert: (record) => reviewerQueue.upsert(record),
      get: (id) => reviewerQueue.get(id),
      getRecord: (id) => reviewerQueue.getRecord(id),
      listPending: (options?: ReleaseReviewerQueueListOptions) => reviewerQueue.listPending(options),
      claimNextPending: (input) => {
        const pending = reviewerQueue.listPending(input);
        const item = pending.items[0];
        if (!item) return null;
        const record = reviewerQueue.getRecord(item.id) as ReleaseReviewerQueueRecord;
        claimVersion += 1;
        return {
          claimToken: `claim_${claimVersion}`,
          claimedBy: input.claimedBy,
          claimedAt: input.claimedAt ?? '2026-04-28T12:00:30.000Z',
          claimExpiresAt: '2026-04-28T12:02:30.000Z',
          claimVersion,
          record,
        };
      },
      releaseClaim: () => true,
    },
    mode: 'injected-test-store',
  };
}

async function runWithTemp(options: Parameters<typeof rehearseProductionConsequenceBehavior>[0] = {}): Promise<ProductionConsequenceBehaviorSummary> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-consequence-rehearsal-'));
  try {
    return await rehearseProductionConsequenceBehavior({
      env: baseEnv(),
      substrateSummary: passedSubstrateSummary(),
      stores: fakeStores(),
      outputDir,
      ...options,
    });
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testConsequenceRehearsalPassesAndWritesArtifacts(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-consequence-rehearsal-output-'));
  try {
    const summary = await rehearseProductionConsequenceBehavior({
      env: baseEnv(),
      substrateSummary: passedSubstrateSummary(),
      stores: fakeStores(),
      outputDir,
    });

    equal(summary.readiness.passed, true, 'Production consequence rehearsal: full behavior pass is ready');
    equal(summary.readiness.state, 'passed-core-consequence-rehearsal', 'Production consequence rehearsal: pass state is explicit');
    equal(summary.stores.mode, 'injected-test-store', 'Production consequence rehearsal: tests use injected stores');
    equal(summary.stores.requestPathContract, 'async-shared-authority-stores', 'Production consequence rehearsal: request path contract is preserved');
    ok(summary.checks.every((check) => check.status === 'pass'), 'Production consequence rehearsal: every check passes');
    equal(summary.behavior?.admittedGate.outcome, 'proceed', 'Production consequence rehearsal: admitted path proceeds');
    ok((summary.behavior?.admittedGate.proofRefCount ?? 0) > 0, 'Production consequence rehearsal: admitted path has proof refs');
    equal(summary.behavior?.blockedGate.outcome, 'hold', 'Production consequence rehearsal: blocked path holds');
    equal(summary.behavior?.blockedGate.proofRefCount, 0, 'Production consequence rehearsal: blocked path does not invent proof refs');
    equal(summary.behavior?.reviewGate.outcome, 'hold', 'Production consequence rehearsal: review path holds');
    equal(summary.behavior?.token.consumedInactiveReason, 'usage_exhausted', 'Production consequence rehearsal: replay/use-count exhaustion is observed');
    equal(summary.behavior?.token.revokedInactiveReason, 'revoked', 'Production consequence rehearsal: revoked token is inactive');
    equal(summary.behavior?.reviewerQueue.finalDecisionStatus, 'accepted', 'Production consequence rehearsal: reviewer queue closes to accepted decision');
    equal(summary.behavior?.evidencePack.verified, true, 'Production consequence rehearsal: evidence pack verifies');
    ok(existsSync(resolve(outputDir, 'summary.json')), 'Production consequence rehearsal: summary artifact is written');
    ok(existsSync(resolve(outputDir, 'README.md')), 'Production consequence rehearsal: README artifact is written');
    includes(readFileSync(resolve(outputDir, 'README.md'), 'utf8'), 'passed-core-consequence-rehearsal', 'Production consequence rehearsal: README records pass state');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testMissingSharedStoreBlocksBeforeCoreBehavior(): Promise<void> {
  const env = baseEnv();
  delete env.ATTESTOR_RELEASE_AUTHORITY_PG_URL;

  const summary = await runWithTemp({
    env,
    stores: fakeStores(),
  });

  equal(summary.readiness.passed, false, 'Production consequence rehearsal: missing shared store blocks readiness');
  equal(summary.readiness.state, 'blocked-on-target-prerequisites', 'Production consequence rehearsal: missing shared store blocks before behavior');
  ok(summary.readiness.issues.some((issue) => issue.includes('ATTESTOR_RELEASE_AUTHORITY_PG_URL')), 'Production consequence rehearsal: missing PG URL is surfaced');
  equal(summary.behavior, null, 'Production consequence rehearsal: behavior is not exercised when shared store is missing');
  ok(summary.checks.some((check) => check.id === 'core-consequence-rehearsal' && check.status === 'skip'), 'Production consequence rehearsal: core behavior is explicitly skipped');
}

async function testFailedSubstrateSummaryBlocksBeforeCoreBehavior(): Promise<void> {
  const summary = await runWithTemp({
    substrateSummary: failedSubstrateSummary(),
    stores: fakeStores(),
  });

  equal(summary.readiness.passed, false, 'Production consequence rehearsal: failed substrate summary blocks readiness');
  ok(summary.readiness.issues.some((issue) => issue.includes('blocked-on-substrates')), 'Production consequence rehearsal: failed substrate state is surfaced');
  equal(summary.behavior, null, 'Production consequence rehearsal: behavior is not exercised when substrate readiness failed');
}

async function testContractMismatchBlocksBeforeCoreBehavior(): Promise<void> {
  const profile = readJson<any>(
    'docs',
    '08-deployment',
    'production-rehearsal-targets',
    'gke-production-rehearsal.json',
  );
  profile.runtime.sharedAuthorityContract = 'local-process-memory';
  const tempDir = mkdtempSync(resolve(tmpdir(), 'attestor-consequence-profile-'));
  const profilePath = resolve(tempDir, 'profile.json');
  try {
    writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
    const summary = await runWithTemp({
      profilePath,
      stores: fakeStores(),
    });

    equal(summary.readiness.passed, false, 'Production consequence rehearsal: contract mismatch blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('async-shared-authority-stores')), 'Production consequence rehearsal: expected contract is surfaced');
    equal(summary.behavior, null, 'Production consequence rehearsal: behavior is not exercised on contract mismatch');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testSharedStoreFailureFailsCoreBehavior(): Promise<void> {
  const stores = fakeStores({
    registerIssuedToken: async () => {
      throw new Error('shared release authority store unavailable');
    },
  });
  const summary = await runWithTemp({ stores });

  equal(summary.readiness.passed, false, 'Production consequence rehearsal: shared store failure fails readiness');
  equal(summary.readiness.state, 'failed-core-consequence-rehearsal', 'Production consequence rehearsal: store failure is a core rehearsal failure');
  ok(summary.readiness.issues.some((issue) => issue.includes('shared release authority store unavailable')), 'Production consequence rehearsal: shared store error is surfaced');
}

function testDocsAndPackageWireTheRehearsal(): void {
  const packageJson = readJson<{ scripts: Record<string, string> }>('package.json');
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');
  const manifest = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.example.json');

  equal(packageJson.scripts['rehearse:production-consequence'], 'tsx scripts/rehearse/rehearse-production-consequence-behavior.ts', 'Production consequence rehearsal: package exposes the rehearsal command');
  equal(packageJson.scripts['test:production-rehearsal-consequence-behavior'], 'tsx tests/production-rehearsal-consequence-behavior.test.ts', 'Production consequence rehearsal: package exposes the rehearsal test');
  includes(tracker, '| Completed | 10 |', 'Production consequence rehearsal: tracker now reflects Step 10 completion');
  includes(tracker, '| Not started | 0 |', 'Production consequence rehearsal: tracker leaves no frozen steps pending');
  includes(tracker, '| 06 | complete | Rehearse core fail-closed consequence behavior |', 'Production consequence rehearsal: Step 06 is complete without renumbering');
  includes(tracker, 'The production rehearsal buildout is complete at the repository level.', 'Production consequence rehearsal: immediate next step now advances beyond Step 10');
  includes(manifest, 'npm run rehearse:production-consequence', 'Production consequence rehearsal: manifest command plan includes the rehearsal command');
  includes(manifest, 'production-rehearsal-consequence-behavior', 'Production consequence rehearsal: manifest evidence includes the behavior summary');
}

await testConsequenceRehearsalPassesAndWritesArtifacts();
await testMissingSharedStoreBlocksBeforeCoreBehavior();
await testFailedSubstrateSummaryBlocksBeforeCoreBehavior();
await testContractMismatchBlocksBeforeCoreBehavior();
await testSharedStoreFailureFailsCoreBehavior();
testDocsAndPackageWireTheRehearsal();

console.log(`production-rehearsal-consequence-behavior.test.ts: ${passed} assertions passed`);
