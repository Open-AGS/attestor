#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SECURITY_EVIDENCE_DOCS = Object.freeze([
  'docs/audit/README.md',
  'docs/audit/current-posture-baseline.md',
  'docs/audit/report-index.md',
  'docs/audit/finding-index.md',
  'docs/audit/live-proof-register.md',
  'docs/audit/control-map.md',
  'docs/research/README.md',
  'docs/research/attestor-research-provenance-ledger.md',
]);

export const REQUIRED_FINDINGS = Object.freeze([
  'B-081',
  'B-059',
  'B-069',
  'B-033',
  'B-025',
  'B-028',
  'Customer PEP no-bypass',
  'External KMS runtime signing',
  'Shared replay / introspection store',
  'Required commit signatures',
  'Required PR reviews',
  'Test adequacy map',
]);

export const REQUIRED_LIVE_PROOFS = Object.freeze([
  'LP-HTTPS-EDGE',
  'LP-CLUSTER-SECRET-STORE',
  'LP-NETWORK-POLICY',
  'LP-EDGE-WAF',
  'LP-GCP-IAM-LEAST-PRIVILEGE',
  'LP-RUNTIME-PKI-STORAGE',
  'LP-TLS-MATERIAL-SOURCE',
  'LP-SHARED-REPLAY-STORE',
  'LP-SHARED-INTROSPECTION-STORE',
  'LP-CUSTOMER-PEP-NO-BYPASS',
  'LP-KMS-RUNTIME-SIGNING',
  'LP-FINDING-TEST-COVERAGE',
]);

export const REQUIRED_PR_TEMPLATE_FIELDS = Object.freeze([
  'Finding index updated:',
  'Report index updated:',
  'Live proof register updated:',
  'Control map / research index updated:',
  'Evidence system exception:',
]);

export const REQUIRED_AUDIT_NAVIGATION_RULES = Object.freeze([
  '## Current Claim Navigation',
  '| Current repository, production, or enterprise posture | `docs/audit/current-posture-baseline.md` | `docs/audit/report-index.md`; `docs/audit/finding-index.md` |',
  '| Whether a finding is open, closed, accepted, stale, contradicted, or live-only | `docs/audit/finding-index.md` | the cited code, test, PR, CI, or live-proof row |',
  '| Whether repository evidence can close a live/deployment claim | `docs/audit/live-proof-register.md` | `scripts/check-ops-live-shadow-readiness.mjs`; the relevant environment proof flag |',
  '| Whether a new PR updated the right evidence files | `.github/pull_request_template.md` | `npm run check:security-evidence-system` |',
  '## Consistency Guard',
  '`npm run check:security-evidence-system`',
  '`npm run test:audit-finding-lifecycle`',
  '`npm run test:audit-finding-evidence`',
  '`npm run test:audit-finding-test-coverage`',
  'These guards prove index discipline only.',
]);

function readProjectFile(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8').replace(/\r\n/gu, '\n');
}

function assertIncludes(content, expected, label, failures) {
  if (!content.includes(expected)) {
    failures.push(`${label}: missing ${expected}`);
  }
}

export function validateSecurityEvidenceSystem() {
  const failures = [];

  for (const docPath of SECURITY_EVIDENCE_DOCS) {
    try {
      const content = readProjectFile(docPath);
      if (content.trim().length === 0) failures.push(`${docPath}: file is empty`);
    } catch {
      failures.push(`${docPath}: file is missing`);
    }
  }

  const auditReadme = readProjectFile('docs/audit/README.md');
  for (const expected of REQUIRED_AUDIT_NAVIGATION_RULES) {
    assertIncludes(auditReadme, expected, 'audit evidence README navigation rules', failures);
  }
  for (const docPath of [
    'docs/audit/report-index.md',
    'docs/audit/finding-index.md',
    'docs/audit/live-proof-register.md',
    'docs/audit/control-map.md',
    'docs/research/README.md',
  ]) {
    assertIncludes(auditReadme, docPath, 'audit evidence README required reading order', failures);
  }

  const reportIndex = readProjectFile('docs/audit/report-index.md');
  for (const reportId of ['POSTURE-BASELINE-2026-05-20', 'OPS-SWEEP-01', 'OPS-SWEEP-02']) {
    assertIncludes(reportIndex, reportId, 'report index', failures);
  }

  const findingIndex = readProjectFile('docs/audit/finding-index.md');
  for (const finding of REQUIRED_FINDINGS) {
    assertIncludes(findingIndex, finding, 'finding index', failures);
  }

  const liveProofRegister = readProjectFile('docs/audit/live-proof-register.md');
  for (const proof of REQUIRED_LIVE_PROOFS) {
    assertIncludes(liveProofRegister, proof, 'live proof register', failures);
  }

  const controlMap = readProjectFile('docs/audit/control-map.md');
  for (const anchor of ['NIST SP 800-218', 'NIST Cybersecurity Framework 2.0', 'OWASP SAMM', 'OWASP ASVS']) {
    assertIncludes(controlMap, anchor, 'control map external anchors', failures);
  }

  const researchReadme = readProjectFile('docs/research/README.md');
  assertIncludes(
    researchReadme,
    'attestor-research-provenance-ledger.md',
    'research README canonical ledger',
    failures,
  );

  const prTemplate = readProjectFile('.github/pull_request_template.md');
  for (const field of REQUIRED_PR_TEMPLATE_FIELDS) {
    assertIncludes(prTemplate, field, 'PR template evidence system fields', failures);
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateSecurityEvidenceSystem();
  if (!result.ok) {
    console.error('Security evidence system check failed.');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Security evidence system checks: passed');
}
