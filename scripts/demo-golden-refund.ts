import { pathToFileURL } from 'node:url';
import {
  createGoldenRefundDemoSummary,
  runGoldenRefundEngineVisibilityDeterminismCheck,
  renderGoldenRefundDemoJson,
  renderGoldenRefundDemoMarkdown,
} from '../src/consequence-admission/index.js';
import { safeErrorMessage } from './secret-safe-output.ts';

function printUsage(): void {
  console.log(`Usage:
  npm run demo:golden-refund
  npm run demo:golden-refund -- --json
  npm run demo:golden-refund -- --determinism-check --runs=1000

Default output is Markdown for copy/paste, screenshots, and demos.
Use --json for secondary machine-readable output.
Use --determinism-check to run the decision-relevant digest stability check.

This command is fixture-only and shadow-only. It does not call Stripe, Shopify,
Google Cloud, a worker, an audit database, or any target system. It does not
activate policies, train models, admit actions, or prove production readiness.`);
}

function parseRuns(argv: readonly string[]): number {
  const raw = argv.find((arg) => arg.startsWith('--runs='))?.slice('--runs='.length);
  if (!raw) return 1000;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
    throw new Error('--runs must be an integer from 1 to 10000.');
  }
  return parsed;
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }
  if (process.argv.includes('--determinism-check')) {
    const check = runGoldenRefundEngineVisibilityDeterminismCheck(parseRuns(process.argv));
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(check, null, 2));
      return;
    }
    console.log(`# Golden Path: Refund Determinism Check

- identical-input runs: ${check.identicalInputRuns}
- identical-input unique digests: ${check.identicalInputUniqueDigests}
- shuffled-input runs: ${check.shuffledInputRuns}
- shuffled-input unique digests: ${check.shuffledInputUniqueDigests}
- stable: ${check.stable}
- digest covers: ${check.digestCovers.join(', ')}
- digest excludes: ${check.digestExcludes.join(', ')}
- digest: ${check.digest}`);
    return;
  }
  const summary = createGoldenRefundDemoSummary();
  if (process.argv.includes('--json')) {
    console.log(renderGoldenRefundDemoJson(summary).trimEnd());
    return;
  }
  console.log(renderGoldenRefundDemoMarkdown(summary).trimEnd());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exit(1);
  }
}
