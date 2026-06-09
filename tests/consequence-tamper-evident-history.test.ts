import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
  consequenceAdmissionDescriptor,
  consequenceTamperEvidentHistoryDescriptor,
  createConsequenceAuditEvidenceExport,
  createConsequenceTamperEvidentHistoryLedger,
  createGenericAdmissionEnvelope,
  createShadowAdmissionEvent,
  evaluateConsequenceDataMinimizationArtifact,
  verifyConsequenceTamperEvidentHistoryEntries,
  type ConsequenceTamperEvidentHistoryEntry,
} from '../src/consequence-admission/index.js';

let passed = 0;

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function digestOf(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

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

function appendThreeEntries() {
  const ledger = createConsequenceTamperEvidentHistoryLedger({
    historyId: 'history:tenant-retail:production',
    now: () => '2026-05-05T10:00:00.000Z',
  });
  const first = ledger.record({
    sourceKind: 'shadow-admission-event',
    sourceId: 'shadow-event:001',
    sourceDigest: digestOf('shadow-event-001'),
    tenantId: 'tenant_retail',
    environment: 'production',
    occurredAt: '2026-05-05T09:59:00.000Z',
    reasonCodes: ['policy-gap'],
  });
  const second = ledger.record({
    sourceKind: 'retry-attempt',
    sourceId: 'retry-attempt:001',
    sourceDigest: digestOf('retry-attempt-001'),
    tenantId: 'tenant_retail',
    environment: 'production',
    occurredAt: '2026-05-05T10:00:10.000Z',
    artifactRefs: [
      {
        kind: 'previous-admission',
        id: 'admission:held',
        digest: digestOf('previous-admission'),
      },
    ],
  });
  const third = ledger.record({
    sourceKind: 'downstream-execution-receipt',
    sourceId: 'execution-receipt:001',
    sourceDigest: digestOf('execution-receipt-001'),
    tenantId: 'tenant_retail',
    environment: 'production',
    occurredAt: '2026-05-05T10:00:20.000Z',
    reasonCodes: ['downstream-execution-succeeded'],
  });
  return { ledger, first, second, third };
}

function testHistoryRecordsDigestChainAndExport(): void {
  const { ledger, first, second, third } = appendThreeEntries();

  equal(first.outcome, 'recorded', 'Tamper history: first entry records');
  equal(second.outcome, 'recorded', 'Tamper history: second entry records');
  equal(third.outcome, 'recorded', 'Tamper history: third entry records');
  equal(first.entry?.previousEntryDigest, null, 'Tamper history: genesis previous entry is null');
  equal(first.entry?.previousRootDigest, null, 'Tamper history: genesis previous root is null');
  equal(
    second.entry?.previousEntryDigest,
    first.entry?.entryDigest,
    'Tamper history: second entry points to previous entry digest',
  );
  equal(
    second.entry?.previousRootDigest,
    first.entry?.rootDigest,
    'Tamper history: second entry points to previous root digest',
  );
  equal(third.entry?.rawPayloadStored, false, 'Tamper history: raw payload flag is false');
  ok(
    third.entry?.rootDigest !== first.entry?.rootDigest,
    'Tamper history: root digest advances as entries append',
  );

  const verification = ledger.verify();
  equal(verification.valid, true, 'Tamper history: verification passes for untouched chain');
  equal(verification.failClosed, false, 'Tamper history: valid chain does not fail closed');
  equal(verification.verifiedEntryCount, 3, 'Tamper history: verifier counts entries');

  const exported = ledger.exportHistory('2026-05-05T10:01:00.000Z');
  equal(exported.entryCount, 3, 'Tamper history: export carries entry count');
  equal(exported.verification.valid, true, 'Tamper history: export carries verification result');
  equal(exported.rawPayloadStored, false, 'Tamper history: export remains digest-first');
  equal(exported.complianceClaimed, false, 'Tamper history: export does not claim compliance');
  equal(exported.externalImmutableStoreClaimed, false, 'Tamper history: export does not claim external immutability');
  equal(exported.signatureIncluded, false, 'Tamper history: export does not claim a signature');
  ok(exported.digest.startsWith('sha256:'), 'Tamper history: export has digest');
}

function testDuplicateConflictAndScopeFailClosed(): void {
  const ledger = createConsequenceTamperEvidentHistoryLedger({
    historyId: 'history:scope',
    maxEntries: 2,
    now: () => '2026-05-05T11:00:00.000Z',
  });
  const first = ledger.record({
    sourceKind: 'audit-evidence-export',
    sourceId: 'audit-export:001',
    sourceDigest: digestOf('audit-export-001'),
    tenantId: 'tenant_scope',
    environment: 'production',
  });
  const duplicate = ledger.record({
    sourceKind: 'audit-evidence-export',
    sourceId: 'audit-export:001',
    sourceDigest: digestOf('audit-export-001'),
    tenantId: 'tenant_scope',
    environment: 'production',
  });
  const conflict = ledger.record({
    sourceKind: 'audit-evidence-export',
    sourceId: 'audit-export:001',
    sourceDigest: digestOf('audit-export-modified'),
    tenantId: 'tenant_scope',
    environment: 'production',
  });
  const tenantMismatch = ledger.record({
    sourceKind: 'business-risk-dashboard',
    sourceId: 'dashboard:tenant-other',
    sourceDigest: digestOf('dashboard-other-tenant'),
    tenantId: 'tenant_other',
    environment: 'production',
  });
  const environmentMismatch = ledger.record({
    sourceKind: 'business-risk-dashboard',
    sourceId: 'dashboard:staging',
    sourceDigest: digestOf('dashboard-staging'),
    tenantId: 'tenant_scope',
    environment: 'staging',
  });

  equal(first.outcome, 'recorded', 'Tamper history: first scoped artifact records');
  equal(duplicate.outcome, 'duplicate', 'Tamper history: duplicate artifact is idempotent');
  equal(duplicate.entry?.entryDigest, first.entry?.entryDigest, 'Tamper history: duplicate returns existing entry');
  equal(conflict.outcome, 'held', 'Tamper history: conflicting digest is held');
  ok(
    conflict.failureReasons.includes('source-conflict'),
    'Tamper history: conflicting digest has source-conflict reason',
  );
  equal(tenantMismatch.outcome, 'held', 'Tamper history: tenant mismatch is held');
  ok(
    tenantMismatch.failureReasons.includes('tenant-scope-mismatch'),
    'Tamper history: tenant mismatch reason is explicit',
  );
  equal(environmentMismatch.outcome, 'held', 'Tamper history: environment mismatch is held');
  ok(
    environmentMismatch.failureReasons.includes('environment-scope-mismatch'),
    'Tamper history: environment mismatch reason is explicit',
  );
}

function testVerificationDetectsTamperDeletionAndReorder(): void {
  const { ledger } = appendThreeEntries();
  const entries = ledger.snapshot().entries;
  const tamperedFirst = Object.freeze({
    ...entries[0],
    sourceDigest: digestOf('changed-source-digest'),
  }) satisfies ConsequenceTamperEvidentHistoryEntry;
  const tampered = verifyConsequenceTamperEvidentHistoryEntries({
    historyId: ledger.historyId,
    entries: [tamperedFirst, ...entries.slice(1)],
  });
  const deleted = verifyConsequenceTamperEvidentHistoryEntries({
    historyId: ledger.historyId,
    entries: entries.slice(1),
  });
  const reordered = verifyConsequenceTamperEvidentHistoryEntries({
    historyId: ledger.historyId,
    entries: [entries[1], entries[0], entries[2]],
  });

  equal(tampered.valid, false, 'Tamper history: modified source digest invalidates verification');
  ok(
    tampered.failureReasons.includes('entry-payload-digest-mismatch'),
    'Tamper history: modified payload is detected',
  );
  equal(deleted.valid, false, 'Tamper history: deleted first entry invalidates verification');
  ok(
    deleted.failureReasons.includes('sequence-gap'),
    'Tamper history: deletion produces sequence-gap',
  );
  ok(
    deleted.failureReasons.includes('previous-entry-digest-mismatch'),
    'Tamper history: deletion produces previous-entry mismatch',
  );
  equal(reordered.valid, false, 'Tamper history: reordered entries invalidate verification');
  ok(
    reordered.failureReasons.includes('previous-root-digest-mismatch'),
    'Tamper history: reorder produces previous-root mismatch',
  );
}

function testAuditExportCanBindHistoryWithoutRawPayloads(): void {
  const { ledger } = appendThreeEntries();
  const historyExport = ledger.exportHistory('2026-05-05T12:00:00.000Z');
  const event = createShadowAdmissionEvent({
    admission: createGenericAdmissionEnvelope({
      mode: 'observe',
      tenantId: 'tenant_retail',
      environment: 'production',
      actor: 'support-ai-agent',
      action: 'issue_refund',
      domain: 'money-movement',
      downstreamSystem: 'refund-service',
      requestedAt: '2026-05-05T12:01:00.000Z',
      decidedAt: '2026-05-05T12:01:01.000Z',
      recipient: 'raw_customer_identifier_must_not_escape',
      observedFeatures: {
        internalNote: 'raw_feature_must_not_escape',
      },
    }),
    occurredAt: '2026-05-05T12:01:02.000Z',
  });
  const auditExport = createConsequenceAuditEvidenceExport({
    events: [event],
    tamperEvidentHistory: historyExport,
    generatedAt: '2026-05-05T12:02:00.000Z',
  });
  const serialized = JSON.stringify(auditExport);
  const minimization = evaluateConsequenceDataMinimizationArtifact({
    surfaceKind: 'tamper-evident-history',
    exposedUnits: ['digests', 'timestamps', 'tenant-scope', 'artifact-reference', 'status'],
  });

  ok(
    auditExport.artifactRefs.some((artifact) => artifact.kind === 'tamper-evident-history'),
    'Tamper history: audit export references history artifact',
  );
  equal(
    auditExport.controlSummary.tamperEvidentHistoryEntryCount,
    3,
    'Tamper history: audit export reports history entry count',
  );
  ok(!serialized.includes('raw_customer_identifier_must_not_escape'), 'Tamper history: audit export does not leak raw recipient');
  ok(!serialized.includes('raw_feature_must_not_escape'), 'Tamper history: audit export does not leak raw feature');
  equal(minimization.allowed, true, 'Tamper history: redaction policy allows digest-first history surface');
}

function testDescriptorDocsAndPackageSurface(): void {
  const descriptor = consequenceTamperEvidentHistoryDescriptor();
  const admissionDescriptor = consequenceAdmissionDescriptor();
  const readme = readProjectFile('README.md');
  const doc = readProjectFile('docs', '02-architecture', 'tamper-evident-history.md');
  const auditDoc = readProjectFile('docs', '02-architecture', 'audit-evidence-export.md');
  const systemOverview = readProjectFile('docs', '02-architecture', 'system-overview.md');
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  equal(
    descriptor.version,
    CONSEQUENCE_TAMPER_EVIDENT_HISTORY_VERSION,
    'Tamper history: descriptor version is stable',
  );
  equal(descriptor.chainMode, 'linear-hash-chain', 'Tamper history: descriptor exposes chain mode');
  equal(descriptor.storesRawPayloads, false, 'Tamper history: descriptor rejects raw payload storage');
  equal(descriptor.merkleTransparencyLogIncluded, false, 'Tamper history: descriptor avoids Merkle overclaim');
  ok(
    admissionDescriptor.tamperEvidentHistoryEntryKinds.includes('audit-evidence-export'),
    'Tamper history: main descriptor exposes history entry kinds',
  );
  ok(
    admissionDescriptor.tamperEvidentHistoryVerificationFailureReasons.includes('sequence-gap'),
    'Tamper history: main descriptor exposes verification failure reasons',
  );
  includes(
    readme,
    'The trail records what was proposed',
    'Tamper history: README describes the decision trail',
  );
  includes(
    doc,
    'evaluation-grade linear hash chain',
    'Tamper history: doc states evaluation chain boundary',
  );
  includes(
    auditDoc,
    'tamper-evident history',
    'Tamper history: audit evidence doc links the history trail',
  );
  includes(
    systemOverview,
    '[Tamper-evident history](tamper-evident-history.md)',
    'Tamper history: system overview links doc',
  );
  equal(
    packageJson.scripts['test:consequence-tamper-evident-history'],
    'tsx tests/consequence-tamper-evident-history.test.ts',
    'Tamper history: focused script is exposed',
  );
}

testHistoryRecordsDigestChainAndExport();
testDuplicateConflictAndScopeFailClosed();
testVerificationDetectsTamperDeletionAndReorder();
testAuditExportCanBindHistoryWithoutRawPayloads();
testDescriptorDocsAndPackageSurface();

console.log(`Consequence tamper-evident history tests: ${passed} passed, 0 failed`);
