/**
 * Fixture and live scenario definitions for the financial operator CLI.
 */

import type { BenchmarkEntry } from '../replay.js';
import type { FinancialPipelineInput } from '../pipeline.js';
import type { LiveProofInput } from '../types.js';
import {
  COUNTERPARTY_SQL, COUNTERPARTY_INTENT, COUNTERPARTY_FIXTURE,
  COUNTERPARTY_REPORT_CONTRACT, COUNTERPARTY_REPORT,
  LIQUIDITY_SQL, LIQUIDITY_INTENT, LIQUIDITY_FIXTURE,
  RECON_SQL, RECON_INTENT, RECON_FIXTURE,
  UNSAFE_SQL_WRITE, UNSAFE_SQL_INJECTION,
  HIGH_MAT_INTENT,
  CONCENTRATION_SQL, CONCENTRATION_INTENT, CONCENTRATION_FIXTURE,
  CONTROL_TOTAL_INTENT,
} from '../fixtures/scenarios.js';

export type LiveScenarioDefinition = {
  description: string;
  buildInput: (runId: string, candidateSql: string, liveProof: LiveProofInput) => FinancialPipelineInput;
  buildSqlPrompt: () => { systemPrompt: string; userMessage: string };
};

export const SCENARIOS: Record<string, { description: string; input: FinancialPipelineInput }> = {
  'counterparty': {
    description: 'Counterparty exposure summary (expected: pass)',
    input: { runId: 'cli-counterparty', intent: COUNTERPARTY_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
  },
  'liquidity': {
    description: 'Liquidity risk - negative value (expected: fail)',
    input: { runId: 'cli-liquidity', intent: LIQUIDITY_INTENT, candidateSql: LIQUIDITY_SQL, fixtures: [LIQUIDITY_FIXTURE] },
  },
  'recon': {
    description: 'Reconciliation variance - sum mismatch (expected: fail)',
    input: { runId: 'cli-recon', intent: RECON_INTENT, candidateSql: RECON_SQL, fixtures: [RECON_FIXTURE] },
  },
  'unsafe-sql': {
    description: 'Unsafe SQL - write operation (expected: block)',
    input: { runId: 'cli-unsafe', intent: COUNTERPARTY_INTENT, candidateSql: UNSAFE_SQL_WRITE, fixtures: [] },
  },
  'injection': {
    description: 'SQL injection attempt (expected: block)',
    input: { runId: 'cli-injection', intent: COUNTERPARTY_INTENT, candidateSql: UNSAFE_SQL_INJECTION, fixtures: [] },
  },
  'high-materiality': {
    description: 'High materiality - pending approval (expected: pending_approval)',
    input: { runId: 'cli-high-mat', intent: HIGH_MAT_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
  },
  'concentration': {
    description: 'Concentration limit breach (expected: pending_approval)',
    input: { runId: 'cli-concentration', intent: CONCENTRATION_INTENT, candidateSql: CONCENTRATION_SQL, fixtures: [CONCENTRATION_FIXTURE] },
  },
  'control-total': {
    description: 'Control total breach (expected: fail)',
    input: { runId: 'cli-control-total', intent: CONTROL_TOTAL_INTENT, candidateSql: COUNTERPARTY_SQL, fixtures: [COUNTERPARTY_FIXTURE], generatedReport: COUNTERPARTY_REPORT, reportContract: COUNTERPARTY_REPORT_CONTRACT },
  },
};

export const LIVE_SCENARIOS: Record<string, LiveScenarioDefinition> = {
  'counterparty': {
    description: 'Bounded local live counterparty exposure exercise (model SQL + local SQLite)',
    buildInput: (runId, candidateSql, liveProof) => ({
      runId,
      intent: COUNTERPARTY_INTENT,
      candidateSql,
      fixtures: [],
      generatedReport: COUNTERPARTY_REPORT,
      reportContract: COUNTERPARTY_REPORT_CONTRACT,
      liveProof,
    }),
    buildSqlPrompt: () => ({
      systemPrompt: [
        'You write exactly one read-only SQLite-compatible SQL query.',
        'Return SQL only. No markdown. No commentary. No prose.',
        'Use only a single SELECT statement.',
        'Do not use INSERT, UPDATE, DELETE, DROP, ALTER, PRAGMA, ATTACH, or multiple statements.',
        'Output columns must be exactly in this order: counterparty_name, exposure_usd, credit_rating, sector.',
      ].join(' '),
      userMessage: [
        `Goal: ${COUNTERPARTY_INTENT.description}`,
        'Allowed schema: risk',
        'Available table: risk.counterparty_exposures(counterparty_name TEXT, exposure_usd REAL, credit_rating TEXT, sector TEXT, reporting_date TEXT)',
        'Filter on reporting_date = "2026-03-28".',
        'Sort by exposure_usd descending.',
        'Do not aggregate. Return the detailed rows needed to prove the total exposure.',
        'The query should support these business constraints: at least 3 counterparties, non-negative exposure_usd, exposure_usd sum = 850000000.',
      ].join('\n'),
    }),
  },
};

export const BENCHMARK_CORPUS: BenchmarkEntry[] = [
  { scenario: { id: 'BM-001', description: 'Counterparty pass', category: 'pass', expectedFailureMode: null, expectedDecision: 'pass' }, input: SCENARIOS['counterparty'].input },
  { scenario: { id: 'BM-002', description: 'Unsafe SQL block', category: 'sql_safety', expectedFailureMode: 'write_operation', expectedDecision: 'block', expectedFailingScorer: 'sql_safety' }, input: SCENARIOS['unsafe-sql'].input },
  { scenario: { id: 'BM-003', description: 'Data contract fail', category: 'data_quality', expectedFailureMode: 'negative_value', expectedDecision: 'fail', expectedFailingScorer: 'data_contracts' }, input: SCENARIOS['liquidity'].input },
  { scenario: { id: 'BM-004', description: 'Recon mismatch', category: 'reconciliation', expectedFailureMode: 'sum_not_zero', expectedDecision: 'fail', expectedFailingScorer: 'reconciliation' }, input: SCENARIOS['recon'].input },
  { scenario: { id: 'BM-005', description: 'High materiality pending', category: 'oversight', expectedFailureMode: null, expectedDecision: 'pending_approval' }, input: SCENARIOS['high-materiality'].input },
  { scenario: { id: 'BM-006', description: 'Control total breach', category: 'reconciliation', expectedFailureMode: 'control_total', expectedDecision: 'fail' }, input: SCENARIOS['control-total'].input },
];
