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

function governance(fileName: string): string {
  return readProjectFile('docs', '03-governance', fileName);
}

function auditDoc(): string {
  return readProjectFile('docs', 'audit', 'f9-compliance-gap-validation.md');
}

function tracker(): string {
  return readProjectFile('docs', 'audit', 'attestor-audit-remediation-tracker.md');
}

function testFrameworkMappings(): void {
  const soc2 = governance('soc2-tsc-mapping.md');
  includes(soc2, 'AICPA 2017 Trust Services Criteria', 'F9-C1: SOC 2 mapping cites the official TSC anchor');
  includes(soc2, 'AI-decision evidence. It is not', 'F9-C2: SOC 2 mapping separates AI-decision evidence from Type II evidence');
  includes(soc2, 'sampled access', 'F9-C2: SOC 2 mapping names access evidence still needed outside the repo');
  includes(soc2, 'change approvals', 'F9-C2: SOC 2 mapping names change evidence still needed outside the repo');
  includes(soc2, 'incident records', 'F9-C2: SOC 2 mapping names incident evidence still needed outside the repo');

  const iso27001 = governance('iso27001-2022-annex-a-mapping.md');
  includes(iso27001, 'ISO/IEC 27001:2022', 'F9-C1: ISO 27001 mapping exists');
  includes(iso27001, 'A.8 Technological controls', 'F9-C1: ISO 27001 mapping covers technical controls');
  includes(iso27001, 'Out of scope', 'F9-C1: ISO 27001 mapping keeps org-only controls explicit');

  const iso42001 = governance('iso42001-2023-annex-a-mapping.md');
  includes(iso42001, 'ISO/IEC 42001:2023', 'F9-C1: ISO 42001 mapping exists');
  includes(iso42001, 'Attestor does not certify that an upstream model is safe', 'F9-C8: ISO 42001 mapping avoids upstream model overclaim');
  includes(iso42001, 'A.10 Third-party relationships', 'F9-C6: ISO 42001 mapping covers third-party relationships');
}

function testGovernanceDocsCoverAllF9Findings(): void {
  includes(governance('compliance-evidence-boundary.md'), 'Attestor is SOC 2 or ISO compliant out of the box', 'F9-C2: compliance boundary names the unsafe claim');
  includes(governance('shared-responsibility-matrix.md'), 'Tenant isolation', 'F9-C12: shared responsibility matrix covers tenant isolation');
  includes(governance('shared-responsibility-matrix.md'), 'Compliance mapping', 'F9-C12: shared responsibility matrix covers compliance mapping ownership');
  includes(governance('segregation-of-duties.md'), 'Required Two-Person Boundaries', 'F9-C5: SoD doc includes two-person boundaries');
  includes(governance('third-party-providers.md'), 'OpenAI Boundary', 'F9-C6: provider inventory names OpenAI boundary');
  includes(governance('data-residency.md'), 'does not implement per-tenant regional pinning', 'F9-C3: data residency posture is explicit');
  includes(governance('retention-policy.md'), 'does not impose a universal legal retention schedule', 'F9-C4: retention boundary is explicit');
  includes(governance('security-testing.md'), 'NIST SP 800-115', 'F9-C9: security testing doc cites testing guidance');
  includes(governance('cryptography-policy.md'), 'Public Rekor-style transparency log is not implemented or claimed', 'F9-C10: cryptography policy keeps transparency-log non-claim');
  includes(governance('privacy-notice-template.md'), 'customer-adaptable template', 'F9-C11: privacy notice is a template, not legal completion');
  includes(governance('ai-accessibility-bias-boundary.md'), 'Attestor does not train or certify upstream AI models', 'F9-C8: AI bias/accessibility boundary is explicit');

  const dr = readProjectFile('docs', '08-deployment', 'backup-restore-dr.md');
  includes(dr, '## RPO / RTO guidance', 'F9-C7: DR doc includes RPO/RTO guidance');
}

function testTrackerAndValidationClosure(): void {
  const validation = auditDoc();
  includes(validation, '# F9 Compliance Gap Validation', 'F9 validation: title is present');
  includes(validation, 'F9-C1', 'F9 validation: maps report finding F9-C1');
  includes(validation, 'F9-C12', 'F9 validation: maps report finding F9-C12');
  includes(validation, 'The F9 queue is closed for planned repository documentation work', 'F9 validation: queue closure is explicit');
  includes(validation, 'not a SOC 2 report', 'F9 validation: SOC 2 non-claim is explicit');
  includes(validation, 'not an ISO management-system audit', 'F9 validation: ISO non-claim is explicit');
  includes(validation, 'not proof', 'F9 validation: live production non-claim starts explicitly');
  includes(validation, 'of a live production control environment', 'F9 validation: live production non-claim completes explicitly');

  const remediationTracker = tracker();
  includes(remediationTracker, 'F9 compliance gap analysis | 12 | 11 | 1 | 0', 'Tracker: F9 count row is present');
  includes(remediationTracker, 'Remaining F9 queue after compliance gap validation: 0 planned', 'Tracker: F9 remaining queue is explicit');
  includes(remediationTracker, 'F9-C2 SOC 2 Type II evidence-pack implication | `accepted-limitation`', 'Tracker: F9-C2 accepted limitation is tracked');
  includes(remediationTracker, 'F10 customer escape-hatch abuse | 12 | 8 | 4 | 0', 'Tracker: F10 count row is present');
  includes(remediationTracker, 'F10 is closed for planned repository', 'Tracker: F10 closure is explicit');
}

function testDocsAvoidComplianceOverclaim(): void {
  for (const [label, content] of [
    ['soc2', governance('soc2-tsc-mapping.md')],
    ['iso27001', governance('iso27001-2022-annex-a-mapping.md')],
    ['iso42001', governance('iso42001-2023-annex-a-mapping.md')],
    ['evidence-boundary', governance('compliance-evidence-boundary.md')],
    ['validation', auditDoc()],
  ] as const) {
    excludes(content, /\bSOC 2 Type II audited\.\s*$/imu, `F9 docs: ${label} avoids standalone SOC 2 audit overclaim`);
    excludes(content, /\bISO\/IEC 27001 audited\.\s*$/imu, `F9 docs: ${label} avoids standalone ISO 27001 audit overclaim`);
    excludes(content, /\bISO\/IEC 42001 audited\.\s*$/imu, `F9 docs: ${label} avoids standalone ISO 42001 audit overclaim`);
    excludes(content, /\bguarantees EU-only processing\b/iu, `F9 docs: ${label} avoids data-residency overclaim`);
  }
}

function testPackageScriptIsExposed(): void {
  const pkg = readProjectFile('package.json');
  includes(pkg, '"test:f9-compliance-gap-validation"', 'Package: F9 validation test script is exposed');
}

testFrameworkMappings();
testGovernanceDocsCoverAllF9Findings();
testTrackerAndValidationClosure();
testDocsAvoidComplianceOverclaim();
testPackageScriptIsExposed();

console.log(`F9 compliance gap validation tests: ${passed} passed, 0 failed`);
