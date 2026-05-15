import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consequenceAdmissionVerifierHelperDescriptor,
} from '../src/consequence-admission/index.js';

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

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

const validationDoc = readProjectFile(
  'docs',
  'audit',
  'f2-customer-gate-enforcement-validation.md',
);
const tracker = readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
const customerGate = readProjectFile('src', 'consequence-admission', 'customer-gate.ts');
const genericProtectedReleaseToken = readProjectFile(
  'src',
  'consequence-admission',
  'generic-protected-release-token.ts',
);
const customerPepRuntimeAdoption = readProjectFile(
  'src',
  'consequence-admission',
  'customer-pep-runtime-adoption.ts',
);
const packageJson = JSON.parse(readProjectFile('package.json')) as {
  readonly scripts: Readonly<Record<string, string>>;
};
const verifierDescriptor = consequenceAdmissionVerifierHelperDescriptor();

includes(
  validationDoc,
  'Status: `partial`.',
  'F2 customer gate validation: status is partial',
);
includes(
  validationDoc,
  'The finding is valid for `customer-gate.ts` by itself.',
  'F2 customer gate validation: scoped finding remains valid',
);
includes(
  validationDoc,
  'The finding is too broad if it is applied to the entire repository.',
  'F2 customer gate validation: broad claim is corrected',
);
includes(
  validationDoc,
  'generic protected release-token issuance helper: can issue sender-constrained protected tokens',
  'F2 customer gate validation: generic protected token issuance is explicit',
);
includes(
  validationDoc,
  'customer PEP runtime adoption proof',
  'F2 customer gate validation: customer PEP runtime adoption proof is explicit',
);
includes(
  validationDoc,
  'release-enforcement customer-gate helper: consumes a proven release-enforcement verifier result',
  'F2 customer gate validation: release-enforcement verifier consumer is explicit',
);
includes(
  validationDoc,
  'hosted durable introspection/replay wiring: registers issued protected tokens',
  'F2 customer gate validation: hosted durable introspection bridge is explicit',
);
includes(
  validationDoc,
  'hosted DPoP proof replay consumption: consumes token-request DPoP proof jti values',
  'F2 customer gate validation: hosted DPoP proof replay consumption is explicit',
);
includes(
  validationDoc,
  'Current repo evidence supports `partial`, not `fixed`.',
  'F2 customer gate validation: no overclaim is present',
);
includes(
  tracker,
  '| F2-AG-1 customer-gate honor-system | `partial` |',
  'Tracker: F2-AG-1 status is updated',
);
includes(
  tracker,
  'protected release-enforcement verifier-consumer path',
  'Tracker: F2-AG-1 protected verifier consumer is recorded',
);
includes(
  tracker,
  'generic high-risk protected release-token issuance contract',
  'Tracker: F2-AG-1 generic protected token issuance is recorded',
);
includes(
  tracker,
  'scoped customer PEP runtime adoption proof contract',
  'Tracker: F2-AG-1 customer PEP runtime adoption proof is recorded',
);
includes(
  tracker,
  '| F4-LLM06-A customer gate honor-system | `partial` |',
  'Tracker: F4 overlap status is updated',
);
includes(
  customerGate,
  'Run downstream action',
  'Customer gate source: instruction path remains visible',
);
includes(
  customerGate,
  'evaluateConsequenceAdmissionGateWithReleaseEnforcement',
  'Customer gate source: release-enforcement verifier consumer exists',
);
includes(
  genericProtectedReleaseToken,
  'issueGenericAdmissionProtectedReleaseToken',
  'Generic protected release-token source: issuer helper exists',
);
includes(
  genericProtectedReleaseToken,
  'sender-confirmation-required',
  'Generic protected release-token source: sender constraint is required',
);
includes(
  customerPepRuntimeAdoption,
  'evaluateCustomerPepRuntimeAdoption',
  'Customer PEP runtime adoption source: evaluator exists',
);
includes(
  customerPepRuntimeAdoption,
  'sender-constraint-not-required',
  'Customer PEP runtime adoption source: sender constraint blocker exists',
);
equal(
  verifierDescriptor.cryptographicTokenVerification,
  false,
  'Verifier helper descriptor: downstream contract helper does not overclaim cryptographic token verification',
);
equal(
  packageJson.scripts['test:f2-customer-gate-validation'],
  'tsx tests/f2-customer-gate-validation.test.ts',
  'Package: focused F2 customer-gate validation test is exposed',
);

console.log(`F2 customer gate validation tests: ${passed} passed, 0 failed`);
