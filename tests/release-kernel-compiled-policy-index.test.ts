import { strict as assert } from 'node:assert';
import {
  COMPILED_ADMISSION_POLICY_INDEX_VERSION,
  compiledAdmissionPolicyIndexLookupKey,
  createCompiledAdmissionPolicyIndex,
  resolveCompiledAdmissionPolicyIndexEntries,
  resolveCompiledAdmissionPolicyIndexEntry,
} from '../src/release-kernel/compiled-policy-index.js';
import {
  createFirstHardGatewayReleasePolicy,
  createReleasePolicyDefinition,
} from '../src/release-kernel/release-policy.js';
import type { ReleaseEvaluationRequest } from '../src/release-kernel/release-decision-engine.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function makeRequest(): ReleaseEvaluationRequest {
  return {
    id: 'compiled_index_req_001',
    createdAt: '2026-05-10T09:00:00.000Z',
    outputHash: 'sha256:output',
    consequenceHash: 'sha256:consequence',
    outputContract: {
      artifactType: 'financial-reporting.record-field',
      expectedShape: 'structured financial record payload',
      consequenceType: 'record',
      riskClass: 'R4',
    },
    capabilityBoundary: {
      allowedTools: ['record-commit'],
      allowedTargets: ['finance.reporting.record-store'],
      allowedDataDomains: ['financial-reporting'],
    },
    requester: {
      id: 'svc.reporting',
      type: 'service',
    },
    target: {
      kind: 'record-store',
      id: 'finance.reporting.record-store',
    },
  };
}

async function main(): Promise<void> {
  const firstPolicy = createFirstHardGatewayReleasePolicy();
  const weakenedPolicy = createReleasePolicyDefinition({
    ...firstPolicy,
    id: 'finance.weakened-index-policy',
    acceptance: {
      ...firstPolicy.acceptance,
      requiredChecks: ['contract-shape'],
      requiredEvidenceKinds: ['trace'],
    },
    release: {
      ...firstPolicy.release,
      tokenEnforcement: 'optional',
      requireDurableEvidencePack: false,
      requireDownstreamReceipt: false,
    },
  });
  const draftPolicy = createReleasePolicyDefinition({
    ...firstPolicy,
    id: 'finance.draft-index-policy',
    status: 'draft',
  });

  const index = createCompiledAdmissionPolicyIndex([
    firstPolicy,
    weakenedPolicy,
    draftPolicy,
  ]);

  equal(
    index.version,
    COMPILED_ADMISSION_POLICY_INDEX_VERSION,
    'Compiled policy index: index carries stable version',
  );
  equal(
    index.entries.length,
    1,
    'Compiled policy index: only active verifier-clean policies enter the hot-path index',
  );
  equal(
    index.entries[0]?.definition.id,
    'finance.structured-record-release.v1',
    'Compiled policy index: first hard gateway is the accepted hot-path entry',
  );
  equal(
    index.rejectedEntries.length,
    2,
    'Compiled policy index: rejected policies remain visible for diagnostics',
  );
  ok(
    index.rejectedEntries.some(
      (entry) =>
        entry.definition.id === 'finance.weakened-index-policy' &&
        entry.reason === 'verification-failed',
    ),
    'Compiled policy index: verifier-failed policies are rejected before runtime lookup',
  );
  ok(
    index.rejectedEntries.some(
      (entry) =>
        entry.definition.id === 'finance.draft-index-policy' &&
        entry.reason === 'non-active-policy',
    ),
    'Compiled policy index: draft policies are not inserted into enforced hot-path buckets',
  );

  const key = compiledAdmissionPolicyIndexLookupKey({
    consequenceType: 'record',
    riskClass: 'R4',
    targetKind: 'record-store',
    artifactType: 'financial-reporting.record-field',
  });
  ok(
    (index.buckets[key] ?? []).length === 1,
    'Compiled policy index: lookup bucket is narrowed by consequence, risk, target kind, and artifact type',
  );

  const request = makeRequest();
  const entries = resolveCompiledAdmissionPolicyIndexEntries(index, request);
  equal(
    entries.length,
    1,
    'Compiled policy index: matching request resolves one indexed candidate',
  );
  equal(
    resolveCompiledAdmissionPolicyIndexEntry(index, request)?.definition.id,
    firstPolicy.id,
    'Compiled policy index: single-entry resolver returns the matching policy definition',
  );

  const wrongArtifact = resolveCompiledAdmissionPolicyIndexEntry(index, {
    ...request,
    outputContract: {
      ...request.outputContract,
      artifactType: 'financial-reporting.analyst-note',
    },
  });
  equal(
    wrongArtifact,
    null,
    'Compiled policy index: non-indexed artifact types do not scan unrelated policies',
  );

  const widenedBoundary = resolveCompiledAdmissionPolicyIndexEntry(index, {
    ...request,
    capabilityBoundary: {
      ...request.capabilityBoundary,
      allowedTools: ['record-commit', 'wire-transfer'],
    },
  });
  equal(
    widenedBoundary,
    null,
    'Compiled policy index: widened capability boundaries fail closed during candidate filtering',
  );

  console.log(`\nRelease kernel compiled-policy index tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel compiled-policy index tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
