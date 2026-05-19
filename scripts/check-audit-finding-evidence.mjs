#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, 'docs', 'audit');
const LIFECYCLE_PATH = join(AUDIT_DIR, 'finding-lifecycle-and-evidence-ledger.md');
const LEDGER_TEMPLATE_PATH = join(AUDIT_DIR, 'ledger-template.md');
const TRACKER_PATH = join(AUDIT_DIR, 'attestor-audit-remediation-tracker.md');

const REQUIRED_CLOSED_FIELDS = [
  'Finding ID:',
  'Lifecycle state:',
  'Severity:',
  'Original report:',
  'Original target ref:',
  'Current validation ref:',
  'Protected principle:',
  'Trust surface:',
  'Original risk:',
  'Repository evidence:',
  'Research anchors:',
  'Mapping:',
  'Decision:',
  'Smallest safe fix:',
  'Negative/adversarial tests:',
  'Positive/regression tests:',
  'CI checks:',
  'Fix PR:',
  'Merge commit:',
  'Re-audit result:',
  'Residual risk:',
  'No-claims:',
  'Closed by:',
  'Date opened:',
  'Date closed:',
];

const MAPPING_PATTERN = /\b(?:CWE-\d+|NIST\b|OWASP\b|STRIDE\b|STPA\b|ASVS\b|DSOVS\b)/iu;

function read(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/gu, '\n');
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`${label}: missing ${expected}`);
  }
}

function fencedTextBlocks(content) {
  return [...content.matchAll(/```text\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

function checkLifecycleAndTemplate() {
  const lifecycle = read(LIFECYCLE_PATH);
  const template = read(LEDGER_TEMPLATE_PATH);

  for (const field of REQUIRED_CLOSED_FIELDS) {
    assertIncludes(lifecycle, field, 'finding lifecycle record schema');
  }
  assertIncludes(template, 'Mapping:', 'ledger template finding entry');
  assertIncludes(
    lifecycle,
    'Mapping: CWE-352; OWASP CSRF guidance; NIST SP 800-115 mitigation reporting',
    'finding lifecycle example mapping',
  );
}

function checkClosedLifecycleRecords() {
  const files = readdirSync(AUDIT_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => join(AUDIT_DIR, file));

  for (const filePath of files) {
    const content = read(filePath);
    for (const block of fencedTextBlocks(content)) {
      if (!/^Finding ID:/mu.test(block) || !/^Lifecycle state:\s*closed\s*$/mu.test(block)) {
        continue;
      }
      for (const field of REQUIRED_CLOSED_FIELDS) {
        if (!block.includes(field)) {
          fail(`${filePath}: closed finding record is missing ${field}`);
        }
      }
      const mappingLine = block.split('\n').find((line) => line.startsWith('Mapping:')) ?? '';
      if (!MAPPING_PATTERN.test(mappingLine)) {
        fail(`${filePath}: closed finding record Mapping must cite CWE, NIST, OWASP, STRIDE, STPA, ASVS, or DSOVS`);
      }
      for (const field of ['Fix PR:', 'Merge commit:', 'CI checks:', 'Re-audit result:', 'Residual risk:', 'No-claims:']) {
        const line = block.split('\n').find((entry) => entry.startsWith(field)) ?? '';
        if (line.trim() === field) {
          fail(`${filePath}: closed finding record has empty ${field}`);
        }
      }
    }
  }
}

function checkTrackerFixedRowsHaveEvidence() {
  const tracker = read(TRACKER_PATH);
  const rows = tracker
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.startsWith('|---'));

  for (const row of rows) {
    const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    const [id, status, evidence] = cells;
    if (!id || id === 'ID' || status !== '`fixed`') continue;

    if (!/(?:PR #\d+|docs\/audit\/|test:|\.test\.ts)/u.test(evidence ?? '')) {
      fail(`Tracker fixed row ${id} must cite PR, audit doc, or test evidence.`);
    }
  }
}

checkLifecycleAndTemplate();
checkClosedLifecycleRecords();
checkTrackerFixedRowsHaveEvidence();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Audit finding evidence checks: passed');
