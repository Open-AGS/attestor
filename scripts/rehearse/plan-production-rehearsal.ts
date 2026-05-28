import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type CommandPhase =
  | 'repo-baseline'
  | 'render'
  | 'probe'
  | 'rehearsal'
  | 'recovery'
  | 'observability'
  | 'provenance'
  | 'decision';

interface PackageJson {
  readonly scripts: Readonly<Record<string, string>>;
}

interface RehearsalCommand {
  readonly id: string;
  readonly phase: CommandPhase;
  readonly command: string;
  readonly required: boolean;
  readonly stopOnFailure: boolean;
  readonly expectedArtifacts?: readonly string[];
  readonly evidenceIds: readonly string[];
}

interface RehearsalEvidence {
  readonly id: string;
  readonly phase: CommandPhase;
  readonly kind: string;
  readonly required: boolean;
  readonly producer: string;
  readonly artifactPath?: string;
  readonly digestSha256?: string;
  readonly workflowRunId?: string;
  readonly verification?: string;
  readonly status: 'pending' | 'pass' | 'fail' | 'blocked' | 'skipped';
}

export interface ProductionRehearsalManifest {
  readonly schemaVersion: string;
  readonly rehearsalId: string;
  readonly targetEnvironment: {
    readonly name: string;
    readonly type: string;
    readonly provider: string;
    readonly region: string;
    readonly cluster?: string;
    readonly namespace?: string;
    readonly publicHostname?: string;
    readonly owner: string;
  };
  readonly source: {
    readonly repository: string;
    readonly commit: string;
    readonly tag?: string;
    readonly release?: string;
    readonly workflowRuns: Readonly<Record<string, string>>;
  };
  readonly runtime: {
    readonly profile: 'single-node-durable' | 'production-shared';
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly releaseAuthorityPgUrlRef?: string;
    readonly redisUrlRef?: string;
  };
  readonly secretPosture: {
    readonly mode: 'redacted' | 'external-secret' | 'secret-manager';
    readonly plaintextSecretsAllowed: boolean;
    readonly redactedFields: readonly string[];
  };
  readonly commandPlan: readonly RehearsalCommand[];
  readonly evidenceItems: readonly RehearsalEvidence[];
  readonly stopConditions: readonly string[];
  readonly nonClaims: readonly string[];
  readonly goNoGo: {
    readonly verdict: 'pending' | 'go' | 'no-go';
    readonly decidedBy?: string;
    readonly decidedAt?: string;
    readonly notes: string;
  };
}

export interface ProductionRehearsalPlan {
  readonly manifestPath: string;
  readonly rehearsalId: string;
  readonly targetSummary: string;
  readonly sourceSummary: string;
  readonly runtimeSummary: string;
  readonly commandOrder: readonly RehearsalCommand[];
  readonly requiredEvidenceIds: readonly string[];
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
}

const EXPECTED_SCHEMA_VERSION = 'attestor.production-rehearsal.manifest.v1';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlaceholder(value: unknown): boolean {
  const normalized = text(value).toLowerCase();
  return (
    !normalized ||
    normalized === 'pending' ||
    normalized === 'todo' ||
    normalized === 'tbd' ||
    normalized === '0000000' ||
    normalized.startsWith('replace-with-')
  );
}

function npmScriptName(command: string): string | null {
  const match = /^npm run ([^\s]+)$/u.exec(command.trim());
  return match?.[1] ?? null;
}

function commandLabel(command: RehearsalCommand, index: number): string {
  const stop = command.stopOnFailure ? 'stop-on-failure' : 'continue-on-failure';
  return `${index + 1}. [${command.phase}] ${command.command} (${stop})`;
}

export function loadProductionRehearsalManifest(manifestPath: string): ProductionRehearsalManifest {
  return readJson<ProductionRehearsalManifest>(manifestPath);
}

export function createProductionRehearsalPlan(
  manifest: ProductionRehearsalManifest,
  options: {
    readonly manifestPath: string;
    readonly packageScripts: Readonly<Record<string, string>>;
  },
): ProductionRehearsalPlan {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (manifest.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    issues.push(`Unsupported schemaVersion: ${manifest.schemaVersion}`);
  }

  if (isPlaceholder(manifest.rehearsalId)) {
    issues.push('rehearsalId must be a real target run id.');
  }

  for (const [label, value] of [
    ['targetEnvironment.name', manifest.targetEnvironment?.name],
    ['targetEnvironment.provider', manifest.targetEnvironment?.provider],
    ['targetEnvironment.region', manifest.targetEnvironment?.region],
    ['targetEnvironment.owner', manifest.targetEnvironment?.owner],
  ] as const) {
    if (isPlaceholder(value)) issues.push(`${label} must be set before planning.`);
  }

  if (isPlaceholder(manifest.source?.commit)) {
    issues.push('source.commit must be the real commit under rehearsal.');
  } else if (!/^[a-f0-9]{7,40}$/u.test(manifest.source.commit)) {
    issues.push('source.commit must be a 7-40 character lowercase git SHA.');
  }

  for (const [key, value] of Object.entries(manifest.source?.workflowRuns ?? {})) {
    if (isPlaceholder(value)) {
      issues.push(`source.workflowRuns.${key} must be set or removed before planning.`);
    }
  }

  if (!['single-node-durable', 'production-shared'].includes(manifest.runtime?.profile)) {
    issues.push('runtime.profile must be single-node-durable or production-shared.');
  }

  if (manifest.runtime?.noLocalFallback !== true) {
    issues.push('runtime.noLocalFallback must be true.');
  }

  if (manifest.runtime?.profile === 'production-shared') {
    if (manifest.runtime.requireSharedAuthority !== true) {
      issues.push('production-shared requires runtime.requireSharedAuthority=true.');
    }
    if (isPlaceholder(manifest.runtime.releaseAuthorityPgUrlRef)) {
      issues.push('production-shared requires runtime.releaseAuthorityPgUrlRef.');
    }
    if (isPlaceholder(manifest.runtime.redisUrlRef)) {
      issues.push('production-shared requires runtime.redisUrlRef.');
    }
  }

  if (manifest.secretPosture?.plaintextSecretsAllowed !== false) {
    issues.push('secretPosture.plaintextSecretsAllowed must be false.');
  }

  if (!Array.isArray(manifest.secretPosture?.redactedFields) || manifest.secretPosture.redactedFields.length === 0) {
    issues.push('secretPosture.redactedFields must name the redacted secret references.');
  }

  const evidenceById = new Map((manifest.evidenceItems ?? []).map((item) => [item.id, item]));
  const requiredEvidenceIds = new Set<string>();

  if (!Array.isArray(manifest.commandPlan) || manifest.commandPlan.length === 0) {
    issues.push('commandPlan must contain at least one command.');
  }

  for (const command of manifest.commandPlan ?? []) {
    if (!command.required) {
      warnings.push(`Command ${command.id} is optional; production-promotion plans should justify optional commands.`);
    }
    if (!command.stopOnFailure) {
      issues.push(`Required command ${command.id} must stop on failure.`);
    }

    const scriptName = npmScriptName(command.command);
    if (scriptName && !options.packageScripts[scriptName]) {
      issues.push(`Command ${command.id} references missing npm script: ${scriptName}`);
    }

    for (const evidenceId of command.evidenceIds ?? []) {
      requiredEvidenceIds.add(evidenceId);
      if (!evidenceById.has(evidenceId)) {
        issues.push(`Command ${command.id} references missing evidence item: ${evidenceId}`);
      }
    }
  }

  for (const evidence of manifest.evidenceItems ?? []) {
    if (evidence.required) requiredEvidenceIds.add(evidence.id);
    if (evidence.required && evidence.status !== 'pending') {
      warnings.push(`Evidence ${evidence.id} is ${evidence.status}; planner output is not a production-promotion verdict.`);
    }
    if (evidence.required && !text(evidence.verification)) {
      issues.push(`Evidence ${evidence.id} must describe how it is verified.`);
    }
  }

  if (!Array.isArray(manifest.stopConditions) || manifest.stopConditions.length === 0) {
    issues.push('stopConditions must be present.');
  }
  if (!Array.isArray(manifest.nonClaims) || manifest.nonClaims.length === 0) {
    issues.push('nonClaims must be present.');
  }
  if (manifest.goNoGo?.verdict !== 'pending') {
    issues.push('goNoGo.verdict must remain pending during planning.');
  }

  return {
    manifestPath: options.manifestPath,
    rehearsalId: manifest.rehearsalId,
    targetSummary: `${manifest.targetEnvironment.name} (${manifest.targetEnvironment.type}, ${manifest.targetEnvironment.provider}/${manifest.targetEnvironment.region})`,
    sourceSummary: `${manifest.source.repository}@${manifest.source.commit}${manifest.source.tag ? ` tag=${manifest.source.tag}` : ''}`,
    runtimeSummary: `${manifest.runtime.profile}; sharedAuthority=${manifest.runtime.requireSharedAuthority}; noLocalFallback=${manifest.runtime.noLocalFallback}`,
    commandOrder: manifest.commandPlan,
    requiredEvidenceIds: [...requiredEvidenceIds].sort(),
    issues,
    warnings,
  };
}

export function renderProductionRehearsalPlan(plan: ProductionRehearsalPlan): string {
  const lines = [
    '# Attestor Production Rehearsal Plan',
    '',
    `Manifest: ${plan.manifestPath}`,
    `Rehearsal: ${plan.rehearsalId}`,
    `Target: ${plan.targetSummary}`,
    `Source: ${plan.sourceSummary}`,
    `Runtime: ${plan.runtimeSummary}`,
    '',
    '## Status',
    '',
    plan.issues.length === 0
      ? 'Plan status: ready to hand to an operator.'
      : 'Plan status: blocked. Fix the issues before running rehearsal commands.',
    '',
    '## Command Order',
    '',
    ...plan.commandOrder.map(commandLabel),
    '',
    '## Required Evidence',
    '',
    ...plan.requiredEvidenceIds.map((id) => `- ${id}`),
    '',
    '## Stop Conditions',
    '',
    'Any command marked stop-on-failure must stop the rehearsal when it fails. Pending evidence is not proof.',
  ];

  if (plan.warnings.length) {
    lines.push('', '## Warnings', '', ...plan.warnings.map((warning) => `- ${warning}`));
  }

  if (plan.issues.length) {
    lines.push('', '## Blocking Issues', '', ...plan.issues.map((issue) => `- ${issue}`));
  }

  return `${lines.join('\n')}\n`;
}

function arg(name: string): string | null {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
}

function usage(): string {
  return [
    'Usage: npm run plan:production-rehearsal -- --manifest <path>',
    '',
    'The planner prints the operator command order. It does not run commands and does not create production proof.',
  ].join('\n');
}

export function runProductionRehearsalPlannerCli(): number {
  const manifestArg = arg('manifest');
  if (!manifestArg) {
    console.error(usage());
    return 1;
  }

  const manifestPath = resolve(manifestArg);
  const manifest = loadProductionRehearsalManifest(manifestPath);
  const packageJson = readJson<PackageJson>(resolve('package.json'));
  const plan = createProductionRehearsalPlan(manifest, {
    manifestPath,
    packageScripts: packageJson.scripts,
  });

  process.stdout.write(renderProductionRehearsalPlan(plan));
  return plan.issues.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runProductionRehearsalPlannerCli();
}
