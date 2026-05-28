#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_FINDING_INDEX_PATH = join(process.cwd(), 'docs', 'audit', 'finding-index.md');
const LOCKING_TEST_MARKER = 'Locking test:';
const TEST_CONTRACT_MARKER = 'Test contract:';
const TEST_PATH_PATTERN = /`(tests\/[^`|]+?\.test\.ts)`/gu;
const LIVE_TEST_CONTRACT_PATTERN = /`(tests\/live-[^`|]+?\.test\.ts)`/gu;

function normalizeLineEndings(value) {
  return value.replace(/\r\n/gu, '\n');
}

function stripBackticks(value) {
  return value.replace(/`/gu, '').trim();
}

function stateText(row) {
  return stripBackticks(row.state).toLowerCase();
}

function isHighSeverity(severity) {
  return /\bP0\b|\bP1\b/u.test(severity);
}

function isRepoClosedState(row) {
  const state = stateText(row);
  if (state.includes('disputed/closed')) return false;
  if (state.includes('accepted limitation')) return false;
  return /\bclosed\b/u.test(state);
}

function needsFutureLiveTestContract(row) {
  const state = stateText(row);
  return state.includes('needs live test') || state.includes('needs ops proof');
}

function extractPathsAfterMarker(row, marker, pattern = TEST_PATH_PATTERN) {
  const combined = `${row.evidence} ${row.action}`;
  const markerIndex = combined.lastIndexOf(marker);
  if (markerIndex < 0) return [];
  const markerBody = combined.slice(markerIndex);
  return [...markerBody.matchAll(pattern)].map((match) => match[1]);
}

function validateRelativeTestPath(path, row, failures, options = {}) {
  const { requireExistingTests = true, projectRoot = process.cwd(), label = 'test path' } = options;
  if (path.includes('\\') || path.includes('..') || !path.startsWith('tests/')) {
    failures.push(`${row.lineNumber}: ${row.finding} ${label} must be a repository-local tests/... path: ${path}`);
    return;
  }
  if (requireExistingTests && !existsSync(join(projectRoot, path))) {
    failures.push(`${row.lineNumber}: ${row.finding} ${label} does not exist: ${path}`);
  }
}

export function parseFindingIndexRows(content) {
  const rows = [];
  const lines = normalizeLineEndings(content).split('\n');
  for (const [index, line] of lines.entries()) {
    if (!line.startsWith('|') || line.startsWith('|---')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 6 || cells[0] === 'Finding') continue;
    const [finding, state, severity, protectedPrinciple, evidence, action] = cells;
    rows.push({
      lineNumber: index + 1,
      raw: line,
      finding,
      state,
      severity,
      protectedPrinciple,
      evidence,
      action,
    });
  }
  return rows;
}

export function validateFindingTestCoverage(options = {}) {
  const {
    content = readFileSync(DEFAULT_FINDING_INDEX_PATH, 'utf8'),
    projectRoot = process.cwd(),
    requireExistingTests = true,
  } = options;
  const failures = [];
  const checkedRows = [];
  const futureContracts = [];

  for (const row of parseFindingIndexRows(content)) {
    if (!isHighSeverity(row.severity)) continue;

    if (isRepoClosedState(row)) {
      checkedRows.push(row.finding);
      if (!`${row.evidence} ${row.action}`.includes(LOCKING_TEST_MARKER)) {
        failures.push(`${row.lineNumber}: ${row.finding} is closed P0/P1 but lacks ${LOCKING_TEST_MARKER}`);
        continue;
      }
      const paths = extractPathsAfterMarker(row, LOCKING_TEST_MARKER);
      if (paths.length === 0) {
        failures.push(`${row.lineNumber}: ${row.finding} ${LOCKING_TEST_MARKER} must cite at least one tests/*.test.ts path`);
        continue;
      }
      for (const path of paths) {
        validateRelativeTestPath(path, row, failures, { projectRoot, requireExistingTests, label: LOCKING_TEST_MARKER });
      }
    }

    if (needsFutureLiveTestContract(row)) {
      futureContracts.push(row.finding);
      if (!`${row.evidence} ${row.action}`.includes(TEST_CONTRACT_MARKER)) {
        failures.push(`${row.lineNumber}: ${row.finding} needs live/ops proof but lacks ${TEST_CONTRACT_MARKER}`);
        continue;
      }
      const paths = extractPathsAfterMarker(row, TEST_CONTRACT_MARKER, LIVE_TEST_CONTRACT_PATTERN);
      if (paths.length === 0) {
        failures.push(`${row.lineNumber}: ${row.finding} ${TEST_CONTRACT_MARKER} must cite a future tests/live-*.test.ts contract path`);
      }
      for (const path of paths) {
        validateRelativeTestPath(path, row, failures, {
          projectRoot,
          requireExistingTests: false,
          label: TEST_CONTRACT_MARKER,
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    checkedRows,
    futureContracts,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateFindingTestCoverage();
  if (!result.ok) {
    console.error('Finding test coverage check failed.');
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(
    `Finding test coverage checks: passed (${result.checkedRows.length} closed P0/P1 rows, ${result.futureContracts.length} live/ops contracts)`,
  );
}
