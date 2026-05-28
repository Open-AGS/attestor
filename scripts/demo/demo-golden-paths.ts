import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  createGoldenPathsEvaluatorSummary,
  renderGoldenPathsEvaluatorJson,
  renderGoldenPathsEvaluatorMarkdown,
} from '../../src/consequence-admission/index.js';
import { safeErrorMessage } from '../secret-safe-output.ts';

function printUsage(): void {
  console.log(`Usage:
  npm run demo:golden-paths
  npm run demo:golden-paths -- --json

Default output is compact Markdown for reviewers.
Use --json for deterministic machine-readable output.

This command summarizes the six local, synthetic Golden Paths. It does not call
downstream systems, execute actions, activate policy, prove customer PEP
enforcement, prove external KMS/HSM signing, prove live shared stores, or prove
production readiness.`);
}

function main(): void {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: false,
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      json: {
        type: 'boolean',
      },
    },
    strict: true,
  });

  if (parsed.values.help) {
    printUsage();
    return;
  }

  const summary = createGoldenPathsEvaluatorSummary();
  if (parsed.values.json) {
    console.log(renderGoldenPathsEvaluatorJson(summary).trimEnd());
    return;
  }

  console.log(renderGoldenPathsEvaluatorMarkdown(summary).trimEnd());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exit(1);
  }
}
