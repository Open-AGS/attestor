import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  createGoldenPathsEvaluatorSummary,
  createGoldenRefundDemoSummary,
  renderGoldenPathsEvaluatorJson,
  renderGoldenPathsEvaluatorMarkdown,
  renderGoldenRefundDemoJson,
  renderGoldenRefundDemoMarkdown,
} from '../../src/consequence-admission/index.js';
import { safeErrorMessage } from '../lib/secret-safe-output.ts';

export const LOCAL_EVALUATION_RUNNER_VERSION = 'attestor.local-evaluation-runner.v1';

export interface LocalEvaluationArtifact {
  readonly name: string;
  readonly path: string;
  readonly description: string;
}

export interface LocalEvaluationResult {
  readonly version: typeof LOCAL_EVALUATION_RUNNER_VERSION;
  readonly command: 'npm run evaluate:local';
  readonly artifactRoot: string;
  readonly localOnly: true;
  readonly repoSideOnly: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly noTargetSystemCalls: true;
  readonly productionReady: false;
  readonly enterpriseReady: false;
  readonly noClaims: readonly string[];
  readonly artifacts: readonly LocalEvaluationArtifact[];
}

const DEFAULT_OUTPUT_DIR = join('.attestor', 'evaluation', 'latest');

const LOCAL_EVALUATION_NO_CLAIMS = Object.freeze([
  'no downstream execution or mutation',
  'no live customer deployment proof',
  'no customer PEP no-bypass proof',
  'no external KMS/HSM runtime signing proof',
  'no live shared-store proof',
  'no provider dashboard proof',
  'no production readiness claim',
  'no enterprise readiness claim',
] as const);

function toRelativePath(path: string): string {
  const rel = relative(process.cwd(), path).replace(/\\/gu, '/');
  return rel && !rel.startsWith('..') ? rel : '[custom-output-dir]';
}

function writeArtifact(outputDir: string, name: string, content: string): LocalEvaluationArtifact {
  const targetPath = join(outputDir, name);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  return Object.freeze({
    name,
    path: toRelativePath(targetPath),
    description: artifactDescription(name),
  });
}

function artifactDescription(name: string): string {
  switch (name) {
    case 'summary.md':
      return 'human-readable local evaluation summary';
    case 'decision-trail.json':
      return 'machine-readable digest-bound local evaluation trail';
    case 'refund-golden-path.md':
      return 'first concrete refund path with decision and evidence references';
    case 'refund-golden-path.json':
      return 'machine-readable refund path summary';
    case 'boundary.md':
      return 'local evaluation no-claim and authority boundary';
    default:
      return 'local evaluation artifact';
  }
}

function renderSummaryMarkdown(input: {
  readonly goldenPathsMarkdown: string;
  readonly artifactRoot: string;
}): string {
  return `# Attestor Local Evaluation

This is the smallest repo-side evaluation package for the current Golden Paths.
It is synthetic, local, shadow-only, and fixture-only.

## Run

\`\`\`bash
npm run evaluate:local
\`\`\`

## What You Should See

- proposed action
- Attestor checks
- decision shape: \`admit\`, \`narrow\`, \`review\`, or \`block\`
- reason codes
- digest-bound proof references
- downstream gate boundary

## Artifact Root

\`${input.artifactRoot}\`

${input.goldenPathsMarkdown.trimEnd()}
`;
}

function renderBoundaryMarkdown(noClaims: readonly string[]): string {
  return `# Local Evaluation Boundary

This package is review material only.

It does not call Stripe, Shopify, warehouses, identity providers, deploy
systems, wallets, banks, or customer production infrastructure.

It does not activate policy, grant authority, execute downstream actions, train
a model, prove a customer-owned gate, or prove production readiness.

## No-Claims

${noClaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

function renderDecisionTrailJson(input: {
  readonly result: LocalEvaluationResult;
  readonly goldenPathsJson: string;
  readonly refundJson: string;
}): string {
  const goldenPaths = JSON.parse(input.goldenPathsJson) as unknown;
  const refund = JSON.parse(input.refundJson) as unknown;
  return JSON.stringify(
    {
      version: input.result.version,
      command: input.result.command,
      artifactRoot: input.result.artifactRoot,
      localOnly: input.result.localOnly,
      repoSideOnly: input.result.repoSideOnly,
      shadowOnly: input.result.shadowOnly,
      fixtureOnly: input.result.fixtureOnly,
      noTargetSystemCalls: input.result.noTargetSystemCalls,
      productionReady: input.result.productionReady,
      enterpriseReady: input.result.enterpriseReady,
      noClaims: input.result.noClaims,
      goldenPaths,
      firstPath: refund,
    },
    null,
    2,
  );
}

export function runLocalEvaluation(options: {
  readonly outputDir?: string;
} = {}): LocalEvaluationResult {
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const artifactRoot = toRelativePath(outputDir);
  const goldenPathsSummary = createGoldenPathsEvaluatorSummary();
  const refundSummary = createGoldenRefundDemoSummary();
  const goldenPathsMarkdown = renderGoldenPathsEvaluatorMarkdown(goldenPathsSummary);
  const goldenPathsJson = renderGoldenPathsEvaluatorJson(goldenPathsSummary);
  const refundMarkdown = renderGoldenRefundDemoMarkdown(refundSummary);
  const refundJson = renderGoldenRefundDemoJson(refundSummary);

  const artifacts: LocalEvaluationArtifact[] = [];
  const partialResult: Omit<LocalEvaluationResult, 'artifacts'> = Object.freeze({
    version: LOCAL_EVALUATION_RUNNER_VERSION,
    command: 'npm run evaluate:local',
    artifactRoot,
    localOnly: true,
    repoSideOnly: true,
    shadowOnly: true,
    fixtureOnly: true,
    noTargetSystemCalls: true,
    productionReady: false,
    enterpriseReady: false,
    noClaims: LOCAL_EVALUATION_NO_CLAIMS,
  });

  artifacts.push(writeArtifact(
    outputDir,
    'summary.md',
    renderSummaryMarkdown({ goldenPathsMarkdown, artifactRoot }),
  ));
  artifacts.push(writeArtifact(
    outputDir,
    'decision-trail.json',
    renderDecisionTrailJson({
      result: { ...partialResult, artifacts: [] },
      goldenPathsJson,
      refundJson,
    }),
  ));
  artifacts.push(writeArtifact(outputDir, 'refund-golden-path.md', refundMarkdown));
  artifacts.push(writeArtifact(outputDir, 'refund-golden-path.json', refundJson));
  artifacts.push(writeArtifact(outputDir, 'boundary.md', renderBoundaryMarkdown(LOCAL_EVALUATION_NO_CLAIMS)));

  return Object.freeze({
    ...partialResult,
    artifacts: Object.freeze(artifacts),
  });
}

function printUsage(): void {
  console.log(`Usage:
  npm run evaluate:local
  npm run evaluate:local -- --json
  npm run evaluate:local -- --output-dir .attestor/evaluation/latest

Writes a local, repo-side evaluation package. The default artifact root is:
  ${DEFAULT_OUTPUT_DIR}

This command does not call downstream systems, execute actions, activate policy,
prove customer PEP no-bypass, prove external KMS/HSM signing, prove live shared
stores, or prove production readiness.`);
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
      'output-dir': {
        type: 'string',
      },
    },
    strict: true,
  });

  if (parsed.values.help) {
    printUsage();
    return;
  }

  const result = runLocalEvaluation({ outputDir: parsed.values['output-dir'] });
  if (parsed.values.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`# Attestor Local Evaluation

Wrote ${result.artifacts.length} local evaluation artifacts to \`${result.artifactRoot}\`.

${result.artifacts.map((artifact) => `- ${artifact.name}: ${artifact.description}`).join('\n')}

This is synthetic, repo-side, shadow-only, and fixture-only. It does not prove
production readiness or customer PEP no-bypass.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exit(1);
  }
}
