/**
 * Offline fixture scenario, benchmark, and help commands.
 */

import { renderPackSummary } from '../output-pack.js';
import { runFinancialPipeline } from '../pipeline.js';
import { runBenchmarkCorpus } from '../replay.js';
import { printReportSummary } from './artifacts.js';
import { BENCHMARK_CORPUS, LIVE_SCENARIOS, SCENARIOS } from './scenarios.js';

export function runScenario(id: string): void {
  const scenario = SCENARIOS[id];
  if (!scenario) {
    console.error(`Unknown scenario "${id}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n  Attestor Financial - Running scenario: ${id}`);
  console.log(`  ${scenario.description}\n`);

  const report = runFinancialPipeline(scenario.input);
  printReportSummary(report);

  if (report.reportValidation) {
    console.log(`\n${renderPackSummary(report.outputPack)}`);
  }
}

export function runBenchmark(): void {
  console.log('\n  Attestor Financial - Benchmark Corpus\n');

  const summary = runBenchmarkCorpus(BENCHMARK_CORPUS);

  for (const result of summary.results) {
    const status = result.decisionMatch && result.scorerMatch ? '✓' : '✗';
    console.log(`  ${status} ${result.scenario.id}: ${result.scenario.description} -> ${result.report.decision} (expected: ${result.scenario.expectedDecision})`);
  }

  console.log(`\n  Results: ${summary.passed}/${summary.totalScenarios} scenarios match expected decisions\n`);
  process.exit(summary.failed > 0 ? 1 : 0);
}

export function printHelp(): void {
  console.log(`
  Attestor Financial - Evidence-Governed Financial Data Pipeline

  Usage:
    npx tsx src/financial/cli.ts scenario <id>         Run a named fixture scenario
    npx tsx src/financial/cli.ts live-scenario <id>    Run a bounded local live scenario
    npx tsx src/financial/cli.ts prove <id> [key-dir] [--reviewer-key-dir <dir>] [--connector <id>]
                                                      Run governed scenario + issue signed certificate
    npx tsx src/financial/cli.ts multi-query            Run a governed multi-query proof (fixed scenario set)
    npx tsx src/financial/cli.ts healthcare            Run healthcare domain E2E scenarios
    npx tsx src/financial/cli.ts healthcare-closeout   Run the ONC/VSAC live credential closeout path
    npx tsx src/financial/cli.ts pg-demo-init          Bootstrap demo schema + data in PostgreSQL for real DB proof
    npx tsx src/financial/cli.ts pg-demo-teardown      Remove the demo schema from PostgreSQL
    npx tsx src/financial/cli.ts doctor                Check product proof readiness (keys, DB, credentials)
    npx tsx src/financial/cli.ts benchmark             Run the full replay benchmark corpus
    npx tsx src/financial/cli.ts list                  List available scenarios

  Fixture scenarios:
${Object.entries(SCENARIOS).map(([id, definition]) => `    ${id.padEnd(20)} ${definition.description}`).join('\n')}

  Live scenarios:
${Object.entries(LIVE_SCENARIOS).map(([id, definition]) => `    ${id.padEnd(20)} ${definition.description}`).join('\n')}

  Fixture scenarios remain offline/fixture-based.
  Live scenarios are bounded local hybrid exercises: model-generated SQL + local SQLite execution + persisted reviewer artifacts.
  `);
}
