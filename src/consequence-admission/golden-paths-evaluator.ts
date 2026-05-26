import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createGoldenAuthorityChangeDemoSummary,
} from './golden-authority-change-demo.js';
import {
  createGoldenDataExportDemoSummary,
} from './golden-data-export-demo.js';
import {
  createGoldenExternalCommunicationDemoSummary,
} from './golden-external-communication-demo.js';
import {
  createGoldenOperationalExecutionDemoSummary,
} from './golden-operational-execution-demo.js';
import {
  createGoldenProgrammableMoneyDemoSummary,
} from './golden-programmable-money-demo.js';
import {
  createGoldenRefundDemoSummary,
} from './golden-refund-demo.js';

export const GOLDEN_PATHS_EVALUATOR_VERSION =
  'attestor.golden-paths-evaluator.v1';

export type GoldenPathsEvaluatorReadiness = 'local-review-ready' | 'not-ready';

interface GoldenPathSourceSummary {
  readonly version: string;
  readonly step: string;
  readonly actionSurface: string;
  readonly scenarioCount: number;
  readonly namedGaps: readonly unknown[];
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly digest: string;
}

interface GoldenPathDefinition {
  readonly key: string;
  readonly name: string;
  readonly pack: string;
  readonly actionClass: string;
  readonly command: string;
  readonly docPath: string;
  readonly createSummary: () => GoldenPathSourceSummary;
  readonly extraNoClaims: readonly string[];
}

export interface GoldenPathsEvaluatorPath {
  readonly key: string;
  readonly name: string;
  readonly pack: string;
  readonly actionClass: string;
  readonly command: string;
  readonly jsonCommand: string;
  readonly docPath: string;
  readonly step: string;
  readonly actionSurface: string;
  readonly sourceDemoVersion: string;
  readonly sourceDemoDigest: string;
  readonly scenarioCount: number;
  readonly namedGapCount: number;
  readonly readinessVerdict: 'ready-for-shadow-pilot' | 'not-ready';
  readonly readinessBlockers: readonly string[];
  readonly evaluatorReadiness: GoldenPathsEvaluatorReadiness;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly noClaims: readonly string[];
}

export interface GoldenPathsEvaluatorSummary {
  readonly version: typeof GOLDEN_PATHS_EVALUATOR_VERSION;
  readonly generatedAt: string;
  readonly reviewerCommand: 'npm run demo:golden-paths';
  readonly reviewerJsonCommand: 'npm run demo:golden-paths -- --json';
  readonly purpose: 'single reviewer entrypoint for all local golden paths';
  readonly authorityBoundary:
    'summarizes existing repo-side evidence only; does not admit or execute actions';
  readonly controlBoundary:
    'AI proposes -> Attestor checks -> admit/narrow/review/block -> proof remains';
  readonly pathCount: 6;
  readonly readyPathCount: number;
  readonly totalScenarioCount: number;
  readonly totalNamedGapCount: number;
  readonly packs: readonly string[];
  readonly paths: readonly GoldenPathsEvaluatorPath[];
  readonly localOnly: true;
  readonly repoSideOnly: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly noTargetSystemCalls: true;
  readonly noCustomerPepProof: true;
  readonly noExternalKmsProof: true;
  readonly noLiveSharedStoreProof: true;
  readonly noProviderDashboardProof: true;
  readonly noDownstreamExecution: true;
  readonly noPolicyActivation: true;
  readonly noAuthorityGrant: true;
  readonly productionReady: false;
  readonly enterpriseReady: false;
  readonly noClaims: readonly string[];
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-26T18:00:00.000Z';

const GLOBAL_NO_CLAIMS = Object.freeze([
  'no live customer PEP no-bypass proof',
  'no external KMS/HSM runtime signing proof',
  'no live shared replay/introspection store proof',
  'no provider dashboard binding proof',
  'no downstream execution or mutation',
  'no policy activation or authority grant',
  'no production or enterprise readiness claim',
] as const);

const GOLDEN_PATH_DEFINITIONS = Object.freeze([
  {
    key: 'money-movement-refund',
    name: 'Refund',
    pack: 'Money Movement',
    actionClass: 'refunds, payouts, credits, adjustments',
    command: 'npm run demo:golden-refund',
    docPath: 'docs/02-architecture/golden-refund-shadow-pilot.md',
    createSummary: createGoldenRefundDemoSummary,
    extraNoClaims: ['no Stripe or Shopify call', 'no refund execution'],
  },
  {
    key: 'data-movement-controlled-export',
    name: 'Controlled Data Export',
    pack: 'Data Movement',
    actionClass: 'customer exports, report releases, controlled data packages',
    command: 'npm run demo:golden-data-export',
    docPath: 'docs/02-architecture/golden-data-export-shadow-pilot.md',
    createSummary: createGoldenDataExportDemoSummary,
    extraNoClaims: ['no Snowflake or Databricks call', 'no warehouse query or data export'],
  },
  {
    key: 'authority-change-access',
    name: 'Authority Change',
    pack: 'Authority Change',
    actionClass: 'grants, revocations, approvals, delegations',
    command: 'npm run demo:golden-authority-change',
    docPath: 'docs/02-architecture/golden-authority-change-shadow-pilot.md',
    createSummary: createGoldenAuthorityChangeDemoSummary,
    extraNoClaims: ['no identity provider call', 'no access change'],
  },
  {
    key: 'external-communication-message',
    name: 'External Communication',
    pack: 'External Communication',
    actionClass: 'customer-facing, legal, billing, support, public messages',
    command: 'npm run demo:golden-external-communication',
    docPath: 'docs/02-architecture/golden-external-communication-shadow-pilot.md',
    createSummary: createGoldenExternalCommunicationDemoSummary,
    extraNoClaims: ['no SendGrid or Mailgun call', 'no message delivery'],
  },
  {
    key: 'operational-execution-change',
    name: 'Operational Execution',
    pack: 'Operational Execution',
    actionClass: 'deploys, secret rotations, infrastructure and incident actions',
    command: 'npm run demo:golden-operational-execution',
    docPath: 'docs/02-architecture/golden-operational-execution-shadow-pilot.md',
    createSummary: createGoldenOperationalExecutionDemoSummary,
    extraNoClaims: ['no deployment or infrastructure change', 'no secret-manager write'],
  },
  {
    key: 'programmable-money-transaction-intent',
    name: 'Programmable Money',
    pack: 'Programmable Money',
    actionClass: 'wallet calls, Safe transactions, account abstraction, x402, intent settlement',
    command: 'npm run demo:golden-programmable-money',
    docPath: 'docs/02-architecture/golden-programmable-money-shadow-pilot.md',
    createSummary: createGoldenProgrammableMoneyDemoSummary,
    extraNoClaims: ['no wallet call, signing, or broadcast', 'no chain settlement proof'],
  },
] satisfies readonly GoldenPathDefinition[]);

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function evaluatorReadiness(summary: GoldenPathSourceSummary): GoldenPathsEvaluatorReadiness {
  if (
    summary.readinessVerdict === 'ready-for-shadow-pilot' &&
    summary.shadowOnly &&
    summary.fixtureOnly &&
    summary.previewOnly &&
    summary.noTargetSystemCall &&
    summary.canAdmit === false &&
    summary.activatesEnforcement === false &&
    summary.productionReady === false
  ) {
    return 'local-review-ready';
  }

  return 'not-ready';
}

function createPathSummary(definition: GoldenPathDefinition): GoldenPathsEvaluatorPath {
  const summary = definition.createSummary();
  return Object.freeze({
    key: definition.key,
    name: definition.name,
    pack: definition.pack,
    actionClass: definition.actionClass,
    command: definition.command,
    jsonCommand: `${definition.command} -- --json`,
    docPath: definition.docPath,
    step: summary.step,
    actionSurface: summary.actionSurface,
    sourceDemoVersion: summary.version,
    sourceDemoDigest: summary.digest,
    scenarioCount: summary.scenarioCount,
    namedGapCount: summary.namedGaps.length,
    readinessVerdict: summary.readinessVerdict,
    readinessBlockers: summary.readinessBlockers,
    evaluatorReadiness: evaluatorReadiness(summary),
    shadowOnly: true,
    fixtureOnly: true,
    previewOnly: true,
    noTargetSystemCall: true,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    noClaims: Object.freeze([
      ...definition.extraNoClaims,
      'no live customer deployment proof',
      'no automatic policy activation',
      'no production readiness claim',
    ]),
  });
}

function createSummaryPayload(): Omit<GoldenPathsEvaluatorSummary, 'canonical' | 'digest'> {
  const paths = Object.freeze(GOLDEN_PATH_DEFINITIONS.map(createPathSummary));
  const readyPathCount = paths.filter((path) => path.evaluatorReadiness === 'local-review-ready').length;
  const packs = Object.freeze(paths.map((path) => path.pack));

  return Object.freeze({
    version: GOLDEN_PATHS_EVALUATOR_VERSION,
    generatedAt: GENERATED_AT,
    reviewerCommand: 'npm run demo:golden-paths',
    reviewerJsonCommand: 'npm run demo:golden-paths -- --json',
    purpose: 'single reviewer entrypoint for all local golden paths',
    authorityBoundary:
      'summarizes existing repo-side evidence only; does not admit or execute actions',
    controlBoundary:
      'AI proposes -> Attestor checks -> admit/narrow/review/block -> proof remains',
    pathCount: 6,
    readyPathCount,
    totalScenarioCount: paths.reduce((sum, path) => sum + path.scenarioCount, 0),
    totalNamedGapCount: paths.reduce((sum, path) => sum + path.namedGapCount, 0),
    packs,
    paths,
    localOnly: true,
    repoSideOnly: true,
    shadowOnly: true,
    fixtureOnly: true,
    noTargetSystemCalls: true,
    noCustomerPepProof: true,
    noExternalKmsProof: true,
    noLiveSharedStoreProof: true,
    noProviderDashboardProof: true,
    noDownstreamExecution: true,
    noPolicyActivation: true,
    noAuthorityGrant: true,
    productionReady: false,
    enterpriseReady: false,
    noClaims: GLOBAL_NO_CLAIMS,
  });
}

export function createGoldenPathsEvaluatorSummary(): GoldenPathsEvaluatorSummary {
  const payload = createSummaryPayload();
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function markdownTable(paths: readonly GoldenPathsEvaluatorPath[]): string {
  return [
    '| Pack | Path | Command | Scenarios | Gaps | Local status |',
    '|---|---|---|---:|---:|---|',
    ...paths.map((path) =>
      `| ${path.pack} | ${path.name} | \`${path.command}\` | ${path.scenarioCount} | ${path.namedGapCount} | ${path.evaluatorReadiness} |`,
    ),
  ].join('\n');
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function renderGoldenPathsEvaluatorMarkdown(
  summary: GoldenPathsEvaluatorSummary = createGoldenPathsEvaluatorSummary(),
): string {
  return `# Attestor Golden Paths Evaluator

One command gives a reviewer the local status of all six Golden Paths without
running live infrastructure or hiding the no-claim boundary.

## Reviewer Entry

\`\`\`bash
${summary.reviewerCommand}
${summary.reviewerJsonCommand}
\`\`\`

## Aggregate Result

- paths: ${summary.readyPathCount}/${summary.pathCount} local-review-ready
- scenarios: ${summary.totalScenarioCount}
- named gaps: ${summary.totalNamedGapCount}
- authority boundary: ${summary.authorityBoundary}
- control boundary: ${summary.controlBoundary}

${markdownTable(summary.paths)}

## What This Proves

- all six pack examples are reachable through repo-side local commands
- every path stays shadow-only, fixture-only, and preview-only
- every path exposes a digest-bound demo summary and an explicit no-claim boundary
- the evaluator is a reviewer index, not a second decision engine

## What This Does Not Prove

${bulletList(summary.noClaims)}

## Next

Run any path command above for detailed Markdown output, or use
\`${summary.reviewerJsonCommand}\` for machine-readable evaluator output.

Digest: ${summary.digest}
`;
}

export function renderGoldenPathsEvaluatorJson(
  summary: GoldenPathsEvaluatorSummary = createGoldenPathsEvaluatorSummary(),
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
