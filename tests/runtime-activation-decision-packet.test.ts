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

function testDecisionPacketRecordsHybridActivationShape(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-activation-decision-packet.md',
  );

  for (const expected of [
    '# Runtime Activation Decision Packet',
    'Status: R01 decision packet',
    'Use a hybrid event-driven plus reconcile-loop activation model:',
    'The model is intentionally at-least-once and idempotent.',
    'exactly-once delivery. The safe invariant is:',
    'same source event digest + same activation profile version',
    'runShadowRuntimePipelineDryRun(...)',
    'canAdmit = false',
    'grantsAuthority = false',
    'activatesEnforcement = false',
    'autoEnforce = false',
    'learnsFromTraffic = false',
    'rawPayloadRead = false',
    'productionReady = false',
  ]) {
    includes(doc, expected, `Runtime activation packet: records ${expected}`);
  }
}

function testDecisionPacketRecordsRepoEvidenceAndSources(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-activation-decision-packet.md',
  );

  for (const expected of [
    'src/consequence-admission/shadow-runtime-pipeline.ts',
    'src/consequence-admission/canonical-shadow-event-schema.ts',
    'src/consequence-admission/shadow-events.ts',
    'src/consequence-admission/retry-attempt-ledger.ts',
    'src/service/consequence-shared-history-outbox-store.ts',
    'src/consequence-admission/decision-trace-logger.ts',
    'src/consequence-admission/decision-lineage-graph.ts',
    'src/consequence-admission/assurance-measurement-plane.ts',
    'src/consequence-admission/outcome-feedback-coe-wiring.ts',
    'src/consequence-admission/failure-mode-replay-fixtures.ts',
    'docs/02-architecture/data-minimization-redaction-policy.md',
    'CloudEvents specification',
    'OpenTelemetry Logs Data Model',
    'W3C Trace Context',
    'Kubernetes controller concept',
    'PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED`',
    'PostgreSQL advisory locks',
    'Stripe idempotent requests',
    'Stripe webhooks',
    'Martin Fowler Event Sourcing',
    'CQRS',
    'Transactional Outbox pattern',
    'Lamport, Time, Clocks, and the Ordering of Events',
  ]) {
    includes(doc, expected, `Runtime activation packet: records ${expected}`);
  }
}

function testDecisionPacketRecordsSchedulingAndObservabilityBoundaries(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-activation-decision-packet.md',
  );

  for (const expected of [
    'activationWorkKeyDigest',
    "version: 'attestor.runtime-activation-work-key.v1'",
    'Delivery | At-least-once. Exactly-once is not claimed.',
    'Ordering | Per tenant/source partition ordering only. No global total order.',
    'Clock authority | Timestamps are evidence, not ordering proof.',
    'event-driven trigger for normal latency',
    'reconcile loop for recovery and missed notifications',
    'idempotency key for duplicate tolerance',
    'per-tenant/source partial order for operational boundedness',
    'Allowed to store or emit:',
    'Forbidden to store or emit:',
    'raw idempotency key',
    'Measurement and observability cannot become authority.',
    'must not tune enforcement, relax policy, mutate calibration, train models, or',
  ]) {
    includes(doc, expected, `Runtime activation packet: records ${expected}`);
  }
}

function testDecisionPacketRecordsRSeriesAndNonClaims(): void {
  const doc = readProjectFile(
    'docs',
    '02-architecture',
    'runtime-activation-decision-packet.md',
  );

  for (const expected of [
    'R01 defines the next runtime activation series.',
    '8/8 complete, 0 steps remain.',
    '| R01 | complete | Runtime Activation Decision Packet |',
    '| R02 | complete | Shadow Activation Profile Contract |',
    '| R03 | complete | Shadow Outbox Work Item Contract |',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'The R-series is complete',
    'live enforcement',
    'production worker readiness',
    'exactly-once delivery',
    'global total ordering',
    'audit-plane write integration',
    'external event bus delivery',
    'learned invariant activation',
    'policy activation',
    'raw event storage',
  ]) {
    includes(doc, expected, `Runtime activation packet: records ${expected}`);
  }

  excludes(
    doc,
    /\bproduction-ready\b.*\bclaim\b/iu,
    'Runtime activation packet: avoids production-ready claim phrasing',
  );
}

function testOverviewLedgerAndPackageSurfaceStayAligned(): void {
  const overview = readProjectFile(
    'docs',
    '02-architecture',
    'consequence-runtime-assurance-overview.md',
  );
  const ledger = readProjectFile(
    'docs',
    'research',
    'attestor-research-provenance-ledger.md',
  );
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  for (const expected of [
    '## Runtime Activation Series',
    'Progress: 8/8 complete after R08. 0 steps remain.',
    '| R01 | complete | Runtime Activation Decision Packet |',
    '| R02 | complete | Shadow Activation Profile Contract |',
    '| R03 | complete | Shadow Outbox Work Item Contract |',
    '| R04 | complete | Dispatcher / Reconcile Claim Contract |',
    '| R05 | complete | Shadow Runtime Activation Runner |',
    '| R06 | complete | Trace / Lineage / Measurement Hooks |',
    '| R07 | complete | Outcome Feedback Hook |',
    '| R08 | complete | End-to-End Fixture Replay Smoke |',
    'docs/02-architecture/runtime-activation-decision-packet.md',
    'src/consequence-admission/shadow-activation-profile-contract.ts',
    'src/consequence-admission/shadow-outbox-work-item-contract.ts',
    'src/consequence-admission/shadow-dispatch-claim-contract.ts',
    'src/consequence-admission/shadow-runtime-activation-runner.ts',
    'src/consequence-admission/shadow-runtime-observability-hooks.ts',
    'src/consequence-admission/shadow-runtime-outcome-feedback-hook.ts',
    'src/consequence-admission/shadow-runtime-fixture-replay-smoke.ts',
  ]) {
    includes(overview, expected, `Overview: records ${expected}`);
  }

  includes(
    ledger,
    'docs/02-architecture/runtime-activation-decision-packet.md',
    'Research ledger: indexes runtime activation decision packet',
  );

  assert.equal(
    packageJson.scripts['test:runtime-activation-decision-packet'],
    'tsx tests/runtime-activation-decision-packet.test.ts',
    'Package scripts: exposes runtime activation decision packet test',
  );
  passed += 1;
}

testDecisionPacketRecordsHybridActivationShape();
testDecisionPacketRecordsRepoEvidenceAndSources();
testDecisionPacketRecordsSchedulingAndObservabilityBoundaries();
testDecisionPacketRecordsRSeriesAndNonClaims();
testOverviewLedgerAndPackageSurfaceStayAligned();

console.log(`runtime-activation-decision-packet tests passed (${passed} assertions)`);
