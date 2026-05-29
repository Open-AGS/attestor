/**
 * Financial Reference Implementation - operator CLI.
 *
 * Entry points:
 * - Run a named fixture scenario
 * - Run the full replay benchmark corpus
 * - Run a bounded local live scenario (model-generated SQL + local SQLite execution)
 *
 * Usage:
 *   npx tsx src/financial/cli.ts scenario <id>
 *   npx tsx src/financial/cli.ts live-scenario <id>
 *   npx tsx src/financial/cli.ts benchmark
 */

import 'dotenv/config';

import { runDoctor, runHealthcareCloseout, runHealthcareDemo, runMultiQueryDemo, runPgDemoInit, runPgDemoTeardown } from './cli/demo-commands.js';
import { printHelp, runBenchmark, runScenario } from './cli/fixture-commands.js';
import { runLiveScenario } from './cli/live-scenario.js';
import { runProductProof } from './cli/product-proof.js';
import { LIVE_SCENARIOS, SCENARIOS } from './cli/scenarios.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'scenario' && args[1]) {
    runScenario(args[1]);
    return;
  }

  if (command === 'live-scenario' && args[1]) {
    await runLiveScenario(args[1]);
    return;
  }

  if (command === 'benchmark') {
    runBenchmark();
    return;
  }

  if (command === 'prove' && args[1]) {
    // Parse optional --reviewer-key-dir flag from remaining args
    const proveArgs = args.slice(1);
    const scenarioArg = proveArgs[0];
    let keyDirArg: string | undefined;
    let reviewerKeyDirArg: string | undefined;
    let connectorArg: string | undefined;
    for (let i = 1; i < proveArgs.length; i++) {
      if (proveArgs[i] === '--reviewer-key-dir' && proveArgs[i + 1]) {
        reviewerKeyDirArg = proveArgs[++i];
      } else if (proveArgs[i] === '--connector' && proveArgs[i + 1]) {
        connectorArg = proveArgs[++i];
      } else if (!keyDirArg) {
        keyDirArg = proveArgs[i];
      }
    }
    await runProductProof(scenarioArg, keyDirArg, reviewerKeyDirArg, connectorArg);
    return;
  }

  if (command === 'multi-query') {
    await runMultiQueryDemo();
    return;
  }

  if (command === 'healthcare') {
    await runHealthcareDemo();
    return;
  }

  if (command === 'healthcare-closeout') {
    await runHealthcareCloseout();
    return;
  }

  if (command === 'pg-demo-init') {
    await runPgDemoInit();
    return;
  }

  if (command === 'pg-demo-teardown') {
    await runPgDemoTeardown();
    return;
  }

  if (command === 'doctor') {
    await runDoctor();
    return;
  }

  if (command === 'list') {
    console.log('\n  Fixture scenarios:');
    for (const [id, definition] of Object.entries(SCENARIOS)) {
      console.log(`    ${id.padEnd(20)} ${definition.description}`);
    }
    console.log('\n  Live scenarios:');
    for (const [id, definition] of Object.entries(LIVE_SCENARIOS)) {
      console.log(`    ${id.padEnd(20)} ${definition.description}`);
    }
    console.log('');
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error('\n  Financial CLI crashed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
