import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createGoldenProgrammableMoneyDemoSummary,
  renderGoldenProgrammableMoneyDemoJson,
  renderGoldenProgrammableMoneyDemoMarkdown,
  renderGoldenProgrammableMoneyReviewerSandboxJson,
  renderGoldenProgrammableMoneyReviewerSandboxMarkdown,
  runGoldenProgrammableMoneyReviewerSandbox,
} from '../../src/consequence-admission/index.js';
import { resolveExistingPathInsideAllowedRoots } from './demo-path-boundary.ts';
import { safeErrorMessage } from '../lib/secret-safe-output.ts';

function printUsage(): void {
  console.log(`Usage:
  npm run demo:golden-programmable-money
  npm run demo:golden-programmable-money -- --json
  npm run demo:golden-programmable-money -- --scenario fixtures/golden-programmable-money-reviewer-sandbox.example.json

Default output is Markdown for copy/paste, screenshots, and demos.
Use --json for secondary machine-readable output.
Use --scenario to run a strict allowlisted reviewer-supplied Programmable
Money input through the same shadow-only engine path. Scenario files are
constrained to the local fixtures directory unless --allow-outside-demo-root is
passed for an operator-local override.

This command is fixture-only and shadow-only. It does not call a wallet, sign,
broadcast, submit a UserOperation, submit a Safe transaction, answer a custody
callback, call a bundler, call an x402 facilitator, call a solver, call a
provider, write audit records, settle a payment, or mutate a target system. It
does not activate policies, train models, admit actions, prove customer PEP
enforcement, prove chain settlement, or prove production readiness.`);
}

function parseScenarioPath(argv: readonly string[]): string | null {
  const inline = argv.find((arg) => arg.startsWith('--scenario='))?.slice('--scenario='.length);
  if (inline) return inline;
  const index = argv.indexOf('--scenario');
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--scenario requires a JSON file path.');
  }
  return value;
}

function allowOutsideDemoRoot(argv: readonly string[]): boolean {
  return argv.includes('--allow-outside-demo-root');
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }
  const scenarioPath = parseScenarioPath(process.argv);
  if (scenarioPath) {
    const boundedScenarioPath = resolveExistingPathInsideAllowedRoots(scenarioPath, {
      allowedRootDescriptions: ['fixtures/'],
      allowedRoots: [resolve('fixtures')],
      allowOutsideRoot: allowOutsideDemoRoot(process.argv),
      overrideFlagName: '--allow-outside-demo-root',
      purpose: 'golden programmable money scenario',
    });
    const raw = readFileSync(boundedScenarioPath, 'utf8');
    const input = JSON.parse(raw) as unknown;
    const result = runGoldenProgrammableMoneyReviewerSandbox(input);
    if (process.argv.includes('--json')) {
      console.log(renderGoldenProgrammableMoneyReviewerSandboxJson(result).trimEnd());
      return;
    }
    console.log(renderGoldenProgrammableMoneyReviewerSandboxMarkdown(result).trimEnd());
    return;
  }
  const summary = createGoldenProgrammableMoneyDemoSummary();
  if (process.argv.includes('--json')) {
    console.log(renderGoldenProgrammableMoneyDemoJson(summary).trimEnd());
    return;
  }
  console.log(renderGoldenProgrammableMoneyDemoMarkdown(summary).trimEnd());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exit(1);
  }
}
