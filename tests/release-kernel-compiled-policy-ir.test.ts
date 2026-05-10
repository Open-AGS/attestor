import { strict as assert } from 'node:assert';
import {
  ADMISSION_OBLIGATION_BITS,
  COMPILED_ADMISSION_POLICY_IR_VERSION,
  admissionObligationMaskFor,
  admissionObligationMaskHex,
  compileReleasePolicyDefinition,
  computeCompiledAdmissionPolicyIrHash,
  requiredObligationsForReleasePolicy,
  verifyCompiledAdmissionPolicy,
  type AdmissionObligationKind,
} from '../src/release-kernel/compiled-policy-ir.js';
import {
  createFirstHardGatewayReleasePolicy,
  createReleasePolicyDefinition,
} from '../src/release-kernel/release-policy.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes<T>(values: readonly T[], expected: T, message: string): void {
  assert.ok(values.includes(expected), message);
  passed += 1;
}

async function main(): Promise<void> {
  const firstPolicy = createFirstHardGatewayReleasePolicy();
  const compiled = compileReleasePolicyDefinition(firstPolicy);

  equal(
    compiled.version,
    COMPILED_ADMISSION_POLICY_IR_VERSION,
    'Compiled policy IR: compiled policies carry the stable IR version',
  );
  equal(
    compiled.sourcePolicyId,
    'finance.structured-record-release.v1',
    'Compiled policy IR: source policy id stays bound into the compiled artifact',
  );
  ok(
    compiled.policyHash.startsWith('sha256:') && compiled.irHash.startsWith('sha256:'),
    'Compiled policy IR: policy and IR digests are explicit SHA-256 bindings',
  );
  equal(
    compiled.irHash,
    computeCompiledAdmissionPolicyIrHash(compiled),
    'Compiled policy IR: IR hash recomputes from the canonical compiled payload',
  );
  equal(
    compileReleasePolicyDefinition(createFirstHardGatewayReleasePolicy()).irHash,
    compiled.irHash,
    'Compiled policy IR: repeated compilation of the same policy is stable',
  );

  equal(
    compiled.indexKey.consequenceType,
    'record',
    'Compiled policy IR: index key carries consequence type for fast lookup',
  );
  equal(
    compiled.indexKey.riskClass,
    'R4',
    'Compiled policy IR: index key carries risk class for fast lookup',
  );
  includes(
    compiled.indexKey.targetKinds,
    'record-store',
    'Compiled policy IR: index key carries target kind coverage',
  );
  includes(
    compiled.indexKey.artifactTypes,
    'financial-reporting.record-field',
    'Compiled policy IR: index key carries artifact type coverage',
  );

  const expectedObligations = requiredObligationsForReleasePolicy(firstPolicy);
  assert.deepEqual(
    compiled.requiredObligations,
    expectedObligations,
    'Compiled policy IR: required obligations are derived deterministically from policy checks and release discipline',
  );
  passed += 1;
  equal(
    compiled.requiredObligationMaskHex,
    admissionObligationMaskHex(admissionObligationMaskFor(compiled.requiredObligations)),
    'Compiled policy IR: obligation mask is derived from the compiled obligation set',
  );

  for (const obligation of [
    'contract-shape',
    'target-binding',
    'capability-boundary',
    'consequence-hash-integrity',
    'policy-rule-validation',
    'evidence-completeness',
    'trace-grade-regression',
    'provenance-binding',
    'downstream-receipt-reconciliation',
    'release-token',
    'token-introspection',
    'signed-envelope',
    'durable-evidence-pack',
    'human-review',
    'replay-ledger',
    'regulated-retention',
  ] as const satisfies readonly AdmissionObligationKind[]) {
    includes(
      compiled.requiredObligations,
      obligation,
      `Compiled policy IR: first hard gateway includes ${obligation}`,
    );
  }

  const obligationMask = admissionObligationMaskFor(compiled.requiredObligations);
  ok(
    (obligationMask & ADMISSION_OBLIGATION_BITS['token-introspection']) !== 0n,
    'Compiled policy IR: bitset can test token introspection without scanning obligations',
  );

  const verification = verifyCompiledAdmissionPolicy(compiled);
  ok(verification.valid, 'Compiled policy IR: first hard gateway verifies cleanly');
  equal(
    verification.errors.length,
    0,
    'Compiled policy IR: first hard gateway verification has no errors',
  );
  equal(
    verification.warnings.length,
    0,
    'Compiled policy IR: active first hard gateway verification has no warnings',
  );

  const weakenedR4Policy = createReleasePolicyDefinition({
    ...firstPolicy,
    id: 'finance.weakened-r4-policy',
    acceptance: {
      ...firstPolicy.acceptance,
      requiredChecks: firstPolicy.acceptance.requiredChecks.filter(
        (check) =>
          check !== 'provenance-binding' &&
          check !== 'downstream-receipt-reconciliation',
      ),
      requiredEvidenceKinds: ['trace', 'finding-log', 'signature'],
    },
    release: {
      ...firstPolicy.release,
      requireDurableEvidencePack: false,
      requireDownstreamReceipt: false,
    },
  });
  const weakenedVerification = verifyCompiledAdmissionPolicy(
    compileReleasePolicyDefinition(weakenedR4Policy),
  );
  ok(
    !weakenedVerification.valid,
    'Compiled policy IR: weakened R4 policy is rejected before hot-path use',
  );
  ok(
    weakenedVerification.errors.some(
      (error) =>
        error.code === 'missing-required-check' &&
        error.message.includes('provenance-binding'),
    ),
    'Compiled policy IR: verifier names missing R4 provenance binding',
  );
  ok(
    weakenedVerification.errors.some(
      (error) =>
        error.code === 'missing-downstream-receipt' ||
        (error.code === 'missing-required-check' &&
          error.message.includes('downstream-receipt-reconciliation')),
    ),
    'Compiled policy IR: verifier names missing R4 downstream receipt reconciliation',
  );
  ok(
    weakenedVerification.errors.some((error) => error.code === 'missing-required-evidence'),
    'Compiled policy IR: verifier rejects R4 policies without provenance evidence',
  );

  const draftPolicy = createReleasePolicyDefinition({
    ...firstPolicy,
    id: 'finance.draft-r4-policy',
    status: 'draft',
  });
  const draftVerification = verifyCompiledAdmissionPolicy(
    compileReleasePolicyDefinition(draftPolicy),
  );
  ok(
    draftVerification.valid,
    'Compiled policy IR: draft policies can verify structurally before activation',
  );
  ok(
    draftVerification.warnings.some((warning) => warning.code === 'non-active-policy'),
    'Compiled policy IR: draft policies warn before enforced hot-path insertion',
  );

  const tamperedMask = verifyCompiledAdmissionPolicy({
    ...compiled,
    requiredObligationMaskHex: '0x0',
  });
  ok(
    !tamperedMask.valid,
    'Compiled policy IR: tampered obligation masks are rejected',
  );
  ok(
    tamperedMask.errors.some((error) => error.code === 'mask-mismatch'),
    'Compiled policy IR: verifier reports mask mismatch directly',
  );

  const tamperedUnknown = verifyCompiledAdmissionPolicy({
    ...compiled,
    requiredObligations: [
      ...compiled.requiredObligations,
      'unbounded-runtime-eval' as AdmissionObligationKind,
    ],
  });
  ok(
    !tamperedUnknown.valid,
    'Compiled policy IR: unknown obligations are rejected',
  );
  ok(
    tamperedUnknown.errors.some((error) => error.code === 'unknown-obligation'),
    'Compiled policy IR: verifier reports unknown obligations without crashing',
  );

  console.log(`\nRelease kernel compiled-policy IR tests: ${passed} passed, 0 failed`);
}

main().catch((error) => {
  console.error('\nRelease kernel compiled-policy IR tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
