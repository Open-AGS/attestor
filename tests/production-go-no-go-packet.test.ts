import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderProductionGoNoGoPacket } from '../scripts/render-production-go-no-go-packet.ts';

let passed = 0;

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

function excludes(content: string, unexpected: string, message: string): void {
  assert.ok(
    !content.includes(unexpected),
    `${message}\nDid not expect to find: ${unexpected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(label: string): string {
  const seed = Buffer.from(label, 'utf8').toString('hex');
  return `sha256:${seed.padEnd(64, 'a').slice(0, 64)}`;
}

function createTempRoot(): string {
  return mkdtempSync(resolve(tmpdir(), 'attestor-production-go-no-go-'));
}

function promotionSummary(options?: {
  readonly verdict?: 'go' | 'no-go';
  readonly environmentPacketReady?: boolean;
  readonly omitEvidenceId?: string;
  readonly includeAttestation?: boolean;
}): unknown {
  const evidenceIds = [
    'repo-verify-output',
    'production-readiness-packet',
    'production-rehearsal-substrate-readiness',
    'production-rehearsal-consequence-behavior',
    'production-rehearsal-async-recovery',
    'production-rehearsal-backup-restore-dr',
    'production-rehearsal-observability-alerting',
    'release-provenance-verification',
  ].filter((id) => id !== options?.omitEvidenceId);

  return {
    schemaVersion: 'attestor.production-promotion-candidate.v1',
    rehearsalId: 'gke-production-rehearsal-test',
    targetEnvironment: {
      name: 'gke-prod-rehearsal',
      type: 'production-like',
      provider: 'gke',
      region: 'europe-west1',
      publicHostname: 'attestor.example.invalid',
    },
    source: {
      repository: 'AI-gateway-systems/attestor',
      commit: '528d70fc',
      tag: 'v0.2-production-candidate',
      workflowRuns: {
        evaluationSmoke: '25970791698',
        fullVerify: '25970791699',
        releaseProvenance: '25970791700',
        productionRehearsal: '25970791701',
      },
    },
    runtime: {
      profile: 'production-shared',
      requireSharedAuthority: true,
      noLocalFallback: true,
    },
    environmentPacket: {
      state: options?.environmentPacketReady === false
        ? 'blocked-on-environment-inputs'
        : 'ready-for-environment-promotion',
      promotionGatePassed: options?.environmentPacketReady !== false,
      issues: [],
      missingInputs: [],
    },
    evidence: {
      requiredCount: evidenceIds.length,
      passingRequiredCount: evidenceIds.length,
      includedArtifacts: evidenceIds.map((id) => ({
        id,
        sourcePath: `evidence/${id}.json`,
        sha256: 'a'.repeat(64),
      })),
      missingArtifacts: [],
      digestMismatches: [],
    },
    goNoGo: {
      verdict: options?.verdict ?? 'go',
      manifestVerdict: options?.verdict ?? 'go',
      blockers: options?.verdict === 'no-go' ? ['operator-no-go'] : [],
      notes: 'Fixture reviewed.',
    },
    artifacts: {
      summaryPath: 'evidence/promotion-summary.json',
      archivePath: 'evidence/production-promotion-candidate.tar.gz',
      archiveSha256Path: 'evidence/production-promotion-candidate.tar.gz.sha256',
      attestationPath: options?.includeAttestation === false
        ? null
        : 'evidence/production-promotion-attestation.json',
    },
    attestation: {
      localSignature: options?.includeAttestation === false ? null : { type: 'fixture-attestation' },
    },
    limitations: ['Fixture only.'],
  };
}

async function renderFixture(options?: {
  readonly summary?: unknown;
  readonly targetScope?: 'environment-promotion' | 'customer-enforcement';
  readonly providerRouteMode?: 'not-used' | 'required';
  readonly customerPepProofDigest?: string | null;
  readonly providerRouteProofDigest?: string | null;
  readonly externalSignerProofDigest?: string | null;
  readonly approvedBy?: string | null;
}): Promise<{
  readonly root: string;
  readonly summaryPath: string;
  readonly packet: Awaited<ReturnType<typeof renderProductionGoNoGoPacket>>;
}> {
  const root = createTempRoot();
  const summaryPath = resolve(root, 'promotion-summary.json');
  writeJson(summaryPath, options?.summary ?? promotionSummary());
  const hasExternalSignerOverride = Object.prototype.hasOwnProperty.call(
    options ?? {},
    'externalSignerProofDigest',
  );
  const hasApprovedByOverride = Object.prototype.hasOwnProperty.call(
    options ?? {},
    'approvedBy',
  );
  const packet = await renderProductionGoNoGoPacket({
    rootDir: process.cwd(),
    promotionSummaryPath: summaryPath,
    outputDir: resolve(root, 'out'),
    targetScope: options?.targetScope ?? 'environment-promotion',
    providerRouteMode: options?.providerRouteMode ?? 'not-used',
    externalSignerProofDigest: hasExternalSignerOverride
      ? options?.externalSignerProofDigest ?? null
      : digest('external-signer'),
    customerPepProofDigest: options?.customerPepProofDigest,
    providerRouteProofDigest: options?.providerRouteProofDigest,
    approvedBy: hasApprovedByOverride ? options?.approvedBy ?? null : 'operator@example.invalid',
    approvedAt: new Date(Date.now() - 1_000).toISOString(),
  });
  return { root, summaryPath, packet };
}

async function testEnvironmentPromotionCanGoWithScopedNonClaims(): Promise<void> {
  const { root, packet } = await renderFixture();
  try {
    equal(packet.decision.verdict, 'go', 'Production go/no-go packet: environment promotion fixture can go');
    equal(packet.targetScope, 'environment-promotion', 'Production go/no-go packet: target scope is recorded');
    ok(
      packet.gates.some((gate) =>
        gate.id === 'customer-pep-cutover-proof' && gate.status === 'not-applicable'),
      'Production go/no-go packet: customer PEP cutover is explicitly out of scope',
    );
    ok(
      packet.gates.some((gate) =>
        gate.id === 'llm-provider-route-proof' && gate.status === 'not-applicable'),
      'Production go/no-go packet: live LLM provider route can be explicitly not used',
    );
    includes(
      readFileSync(packet.artifacts.readmePath, 'utf8'),
      'verdict: go',
      'Production go/no-go packet: README records go verdict',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function testCustomerEnforcementRequiresPepProof(): Promise<void> {
  const missing = await renderFixture({ targetScope: 'customer-enforcement' });
  try {
    equal(missing.packet.decision.verdict, 'no-go', 'Production go/no-go packet: customer enforcement without PEP proof fails closed');
    ok(
      missing.packet.decision.blockers.some((blocker) =>
        blocker.includes('customer-pep-cutover-proof-digest-required')),
      'Production go/no-go packet: missing PEP proof blocker is surfaced',
    );
  } finally {
    rmSync(missing.root, { recursive: true, force: true });
  }

  const present = await renderFixture({
    targetScope: 'customer-enforcement',
    customerPepProofDigest: digest('customer-pep'),
  });
  try {
    equal(present.packet.decision.verdict, 'go', 'Production go/no-go packet: customer enforcement can go with PEP proof');
    ok(
      present.packet.gates.some((gate) =>
        gate.id === 'customer-pep-cutover-proof' && gate.status === 'pass'),
      'Production go/no-go packet: PEP proof gate passes when digest is present',
    );
  } finally {
    rmSync(present.root, { recursive: true, force: true });
  }
}

async function testProviderRouteRequiredNeedsProof(): Promise<void> {
  const missing = await renderFixture({ providerRouteMode: 'required' });
  try {
    equal(missing.packet.decision.verdict, 'no-go', 'Production go/no-go packet: provider route without smoke proof fails closed');
    ok(
      missing.packet.decision.blockers.some((blocker) =>
        blocker.includes('llm-provider-route-proof-digest-required')),
      'Production go/no-go packet: missing provider route proof blocker is surfaced',
    );
  } finally {
    rmSync(missing.root, { recursive: true, force: true });
  }

  const present = await renderFixture({
    providerRouteMode: 'required',
    providerRouteProofDigest: digest('provider-route'),
  });
  try {
    equal(present.packet.decision.verdict, 'go', 'Production go/no-go packet: provider route can go with proof digest');
    ok(
      present.packet.gates.some((gate) =>
        gate.id === 'llm-provider-route-proof' && gate.status === 'pass'),
      'Production go/no-go packet: provider route gate passes with digest evidence',
    );
  } finally {
    rmSync(present.root, { recursive: true, force: true });
  }
}

async function testPromotionCandidateBlockersRemainNoGo(): Promise<void> {
  const { root, packet } = await renderFixture({
    summary: promotionSummary({ verdict: 'no-go' }),
  });
  try {
    equal(packet.decision.verdict, 'no-go', 'Production go/no-go packet: no-go promotion candidate remains no-go');
    ok(
      packet.decision.blockers.some((blocker) =>
        blocker.includes('production-promotion-candidate-verdict-not-go')),
      'Production go/no-go packet: candidate verdict blocker is surfaced',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function testMissingSignerAndApprovalRemainNoGoAndSecretSafe(): Promise<void> {
  const { root, packet } = await renderFixture({
    externalSignerProofDigest: null,
    approvedBy: null,
  });
  try {
    equal(packet.decision.verdict, 'no-go', 'Production go/no-go packet: missing signer and approval fail closed');
    ok(
      packet.decision.blockers.some((blocker) =>
        blocker.includes('external-signer-runtime-proof-digest-required')),
      'Production go/no-go packet: missing signer proof blocker is surfaced',
    );
    ok(
      packet.decision.blockers.some((blocker) =>
        blocker.includes('human-approval-actor-required')),
      'Production go/no-go packet: missing approval actor blocker is surfaced',
    );
    const summary = readFileSync(packet.artifacts.summaryPath, 'utf8');
    excludes(summary, 'operator@example.invalid', 'Production go/no-go packet: summary does not store raw approval actor');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function testDocsAndScriptsExposeStep12(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Record<string, string>;
  };
  const productionReadiness = readProjectFile('docs', '08-deployment', 'production-readiness.md');
  const goNoGoDoc = readProjectFile('docs', '08-deployment', 'production-go-no-go-packet.md');
  const tracker = readProjectFile('docs', '02-architecture', 'attestor-unlock-source-of-truth.md');
  const masterPlan = readProjectFile('docs', '02-architecture', 'unified-shadow-to-policy-master-plan.md');
  const ledger = readProjectFile('docs', 'research', 'attestor-research-provenance-ledger.md');

  equal(
    packageJson.scripts['render:production-go-no-go-packet'],
    'tsx scripts/render-production-go-no-go-packet.ts',
    'Production go/no-go packet: render script is exposed',
  );
  equal(
    packageJson.scripts['test:production-go-no-go-packet'],
    'tsx tests/production-go-no-go-packet.test.ts',
    'Production go/no-go packet: test script is exposed',
  );
  includes(productionReadiness, 'production-go-no-go-packet.md', 'Production readiness guide: links the go/no-go packet');
  includes(goNoGoDoc, 'render:production-go-no-go-packet', 'Production go/no-go doc: command is documented');
  includes(goNoGoDoc, 'external-signer-runtime-proof', 'Production go/no-go doc: signer gate is documented');
  includes(goNoGoDoc, 'customer-pep-cutover-proof', 'Production go/no-go doc: PEP gate is documented');
  includes(goNoGoDoc, 'llm-provider-route-proof', 'Production go/no-go doc: provider route gate is documented');
  includes(tracker, '| Complete in this tracker | 12 |', 'Unlock tracker: Step 12 completion count is updated');
  includes(tracker, '| Remaining after this tracker | 0 |', 'Unlock tracker: no remaining tracker steps');
  includes(tracker, '| 12 | complete | Production rehearsal go/no-go packet |', 'Unlock tracker: Step 12 is complete');
  includes(masterPlan, '| Complete | 16 |', 'Unified plan: Step 16 completion count is updated');
  includes(masterPlan, '| Remaining | 10 |', 'Unified plan: remaining count moves to 10');
  includes(masterPlan, '| 12 | complete | Production rehearsal go/no-go packet |', 'Unified plan: Step 12 is complete');
  includes(masterPlan, '| 13 | complete | Target-system compatibility matrix |', 'Unified plan: Step 13 is complete');
  includes(masterPlan, '| 14 | complete | Shadow event canonical schema |', 'Unified plan: Step 14 is complete');
  includes(masterPlan, '| 15 | complete | Action surface graph |', 'Unified plan: Step 15 is complete');
  includes(masterPlan, '| 16 | complete | Evidence state model |', 'Unified plan: Step 16 is complete');
  includes(ledger, '### 54. Production Rehearsal Go/No-Go Packet', 'Research ledger: Step 12 entry is present');
}

await testEnvironmentPromotionCanGoWithScopedNonClaims();
await testCustomerEnforcementRequiresPepProof();
await testProviderRouteRequiredNeedsProof();
await testPromotionCandidateBlockersRemainNoGo();
await testMissingSignerAndApprovalRemainNoGoAndSecretSafe();
testDocsAndScriptsExposeStep12();

console.log(`Production go/no-go packet tests: ${passed} passed, 0 failed`);
