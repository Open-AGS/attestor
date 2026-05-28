import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POLICY_BUNDLE_PAYLOAD_TYPE,
  POLICY_BUNDLE_STATEMENT_TYPE,
} from '../src/release-policy-control-plane/bundle-format.js';
import {
  policyBundleSignerBoundaryDescriptor,
} from '../src/release-policy-control-plane/bundle-signing.js';
import { createFileBackedPolicyMutationAuditLogWriter } from '../src/release-policy-control-plane/audit-log.js';
import { createFileBackedPolicyActivationApprovalStore } from '../src/release-policy-control-plane/activation-approvals.js';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf8');
}

function lineFor(content: string, marker: string): string {
  const line = content.split(/\r?\n/u).find((entry) => entry.includes(marker));
  assert.ok(line, `Expected to find ${marker}`);
  return line;
}

function includes(content: string, expected: string, message: string): void {
  ok(content.includes(expected), message);
}

function testPolicyBundleWireShapeAndSignerBoundary(): void {
  equal(
    POLICY_BUNDLE_PAYLOAD_TYPE,
    'application/vnd.in-toto+json',
    'Policy bundle proof discipline: DSSE payload type stays in-toto JSON',
  );
  equal(
    POLICY_BUNDLE_STATEMENT_TYPE,
    'https://in-toto.io/Statement/v1',
    'Policy bundle proof discipline: statement type stays in-toto Statement v1',
  );

  const boundary = policyBundleSignerBoundaryDescriptor();
  equal(boundary.productionReady, false, 'Policy bundle proof discipline: in-process signer is not production ready');
  equal(
    boundary.externalKmsHsmRequiredForProduction,
    true,
    'Policy bundle proof discipline: production signing requires external KMS/HSM',
  );
  ok(
    boundary.nonClaims.includes('not-production-signing-boundary'),
    'Policy bundle proof discipline: signer boundary records production non-claim',
  );
}

function testPolicyControlStoresDoNotBecomeSharedStoreProof(): void {
  equal(
    createFileBackedPolicyMutationAuditLogWriter('.attestor/tests/pr7-policy-audit.json').kind,
    'file-backed',
    'Policy mutation audit proof discipline: current durable writer is file-backed',
  );
  equal(
    createFileBackedPolicyActivationApprovalStore('.attestor/tests/pr7-policy-approvals.json').kind,
    'file-backed',
    'Policy activation approval proof discipline: current durable store is file-backed',
  );

  const auditSource = readProjectFile('src', 'release-policy-control-plane', 'audit-log.ts');
  includes(
    auditSource,
    "'.attestor/release-policy-mutation-audit-log.json'",
    'Policy mutation audit proof discipline: default audit path is local file-backed storage',
  );
  includes(
    auditSource,
    'withFileLock(path',
    'Policy mutation audit proof discipline: file lock is local serialization, not shared-store proof',
  );

  const approvalSource = readProjectFile('src', 'release-policy-control-plane', 'activation-approvals.ts');
  includes(
    approvalSource,
    "'.attestor/release-policy-activation-approvals.json'",
    'Policy activation approval proof discipline: default approval path is local file-backed storage',
  );
  includes(
    approvalSource,
    'withFileLock(path',
    'Policy activation approval proof discipline: approval store also uses file-lock discipline',
  );
}

function testAuditIndexesCloseOnlyRepoProvenPolicyControlClaims(): void {
  const findingIndex = readProjectFile('docs', 'audit', 'finding-index.md');
  const ops160 = lineFor(findingIndex, 'OPS-160 policy-bundle DSSE/in-toto clarification extension');
  includes(ops160, '`closed`', 'OPS-160 is closed repo-side');
  includes(
    ops160,
    'Locking test: `tests/release-policy-control-plane-proof-discipline.test.ts`.',
    'OPS-160 cites the proof-discipline locking test',
  );

  const ops161 = lineFor(findingIndex, 'OPS-161 policy mutation audit log shared-store proof gap');
  includes(ops161, '`closed / live-proof-only`', 'OPS-161 is closed repo-side and remains live-proof-only');
  includes(
    ops161,
    'ATTESTOR_POLICY_MUTATION_AUDIT_CHAIN_PROOF',
    'OPS-161 names the live proof flag',
  );

  const ops162 = lineFor(findingIndex, 'OPS-162 activation approval store production-bootstrap discipline');
  includes(
    ops162,
    '`accepted limitation / live-proof-only`',
    'OPS-162 remains an accepted limitation with live-proof discipline',
  );
  includes(
    ops162,
    'ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PROOF',
    'OPS-162 names the live proof flag',
  );
}

function testBaselineAndControlMapPreserveNoOverclaimBoundary(): void {
  const baseline = readProjectFile('docs', 'audit', 'current-posture-baseline.md');
  includes(
    baseline,
    'OPS-160/161 are repo-side closed',
    'Baseline records OPS-160/161 repo-side closure',
  );
  includes(
    baseline,
    'OPS-162 remains accepted limitation / live-proof-only',
    'Baseline keeps OPS-162 as live-proof-only accepted limitation',
  );
  includes(
    baseline,
    'Production remains not proven',
    'Baseline keeps production readiness separated from repo evidence',
  );

  const controlMap = readProjectFile('docs', 'audit', 'control-map.md');
  includes(
    controlMap,
    'ATTESTOR_POLICY_MUTATION_AUDIT_CHAIN_PROOF',
    'Control map includes policy mutation audit proof gate',
  );
  includes(
    controlMap,
    'ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PROOF',
    'Control map includes policy activation approval proof gate',
  );
  includes(
    controlMap,
    'primitive `src/signing/*` certificate/trust-chain layer remains Attestor-specific canonical JSON',
    'Control map preserves the primitive-signing non-DSSE boundary',
  );
}

function testLiveProofRegisterAndOpsGateAgree(): void {
  const liveProofRegister = readProjectFile('docs', 'audit', 'live-proof-register.md');
  includes(
    liveProofRegister,
    '`LP-POLICY-MUTATION-AUDIT-CHAIN-SHARED-STORE`',
    'Live proof register keeps policy mutation audit shared-store proof',
  );
  includes(
    liveProofRegister,
    'ATTESTOR_POLICY_MUTATION_AUDIT_CHAIN_PROOF',
    'Live proof register names policy mutation audit proof flag',
  );
  includes(
    liveProofRegister,
    '`LP-POLICY-ACTIVATION-APPROVAL-SHARED-STORE`',
    'Live proof register adds policy activation approval shared-store proof',
  );
  includes(
    liveProofRegister,
    'ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PROOF',
    'Live proof register names policy activation approval proof flag',
  );

  const opsGate = readProjectFile('scripts', 'check', 'check-ops-live-shadow-readiness.mjs');
  includes(
    opsGate,
    "ATTESTOR_POLICY_MUTATION_AUDIT_CHAIN_PROOF",
    'Ops live gate requires policy mutation audit proof before limited enforcement',
  );
  includes(
    opsGate,
    "ATTESTOR_POLICY_ACTIVATION_APPROVAL_STORE_PROOF",
    'Ops live gate requires policy activation approval proof before limited enforcement',
  );
}

testPolicyBundleWireShapeAndSignerBoundary();
testPolicyControlStoresDoNotBecomeSharedStoreProof();
testAuditIndexesCloseOnlyRepoProvenPolicyControlClaims();
testBaselineAndControlMapPreserveNoOverclaimBoundary();
testLiveProofRegisterAndOpsGateAgree();

console.log(`Release policy control-plane proof-discipline tests: ${passed} passed, 0 failed`);
