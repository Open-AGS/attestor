import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  probeAlertRouting,
  type AlertRoutingProbeSummary,
} from '../probe/probe-alert-routing.ts';
import {
  probeObservabilityReceivers,
  type ReceiverProbeSummary,
} from '../probe/probe-observability-receivers.ts';
import {
  fail,
  pass,
  skip,
  type ProductionObservabilityAlertingCheck,
} from './observability-alerting-checks.ts';

type Environment = Readonly<Record<string, string | undefined>>;

interface TargetProfile {
  readonly profileId: string;
  readonly targetEnvironment: {
    readonly provider: string;
    readonly namespace: string;
  };
  readonly runtime: {
    readonly profile: string;
    readonly requireSharedAuthority: boolean;
    readonly noLocalFallback: boolean;
    readonly sharedAuthorityContract: string;
  };
  readonly substrates: readonly Array<{
    readonly id: string;
    readonly kind: string;
    readonly requiredEnv: readonly string[];
  }>;
}

interface PriorStepSummary {
  readonly profileId?: string;
  readonly readiness: {
    readonly passed: boolean;
    readonly state: string;
    readonly issues?: readonly string[];
  };
  readonly target?: {
    readonly provider?: string;
    readonly namespace?: string;
    readonly publicHostname?: string | null;
  };
}

interface EndpointProbe<T = unknown> {
  readonly ok: boolean;
  readonly status: number;
  readonly body: T | null;
  readonly bodySnippet: string | null;
  readonly error: string | null;
}

interface DashboardTruth {
  readonly dashboardPath: string;
  readonly dashboardUrl: string;
  readonly reachableStatus: number;
  readonly exposesRuntimeTruthMetric: boolean;
  readonly panelTitles: readonly string[];
}

interface RuntimeTruth {
  readonly healthStatus: number;
  readonly readyStatus: number;
  readonly runtimeProfile: string | null;
  readonly releaseRuntimeReady: boolean;
  readonly requestPathContract: string | null;
  readonly requestPathUsesSharedStores: boolean;
  readonly sharedAuthorityRuntimeReady: boolean;
}

interface RunbookTruth {
  readonly path: string;
  readonly stopConditionCount: number;
  readonly coversRuntimeProfile: boolean;
  readonly coversSharedAuthority: boolean;
  readonly coversObservability: boolean;
  readonly coversAlertRouting: boolean;
  readonly coversDrPrerequisite: boolean;
}

interface ObservabilityAlertingBehavior {
  readonly receiverProbe: {
    readonly telemetryFlushSucceeded: boolean;
    readonly prometheusOk: boolean;
    readonly alertmanagerOk: boolean;
  };
  readonly alertRouting: {
    readonly routingValid: boolean;
    readonly deliveryCoverageValid: boolean;
    readonly scenarioCount: number;
  };
  readonly runtimeTruth: RuntimeTruth;
  readonly dashboardTruth: DashboardTruth;
  readonly runbookTruth: RunbookTruth;
}

interface RehearsalAdapters {
  readonly receiverProbe: (outputDir: string) => Promise<ReceiverProbeSummary>;
  readonly alertRoutingProbe: (outputDir: string) => Promise<AlertRoutingProbeSummary>;
  readonly fetchJson: <T>(url: string, timeoutMs: number) => Promise<EndpointProbe<T>>;
  readonly fetchText: (url: string, timeoutMs: number) => Promise<EndpointProbe<string>>;
}

export type { ProductionObservabilityAlertingCheck } from './observability-alerting-checks.ts';

export interface ProductionObservabilityAlertingSummary {
  readonly generatedAt: string;
  readonly profileId: string;
  readonly readiness: {
    readonly state:
      | 'passed-observability-alerting-runbook-rehearsal'
      | 'blocked-on-target-prerequisites'
      | 'failed-observability-alerting-runbook-rehearsal';
    readonly passed: boolean;
    readonly issues: readonly string[];
  };
  readonly target: {
    readonly provider: string;
    readonly namespace: string;
    readonly publicHostname: string | null;
  };
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
    readonly receiverProbeDir: string;
    readonly alertRoutingDir: string;
    readonly runbookPath: string;
    readonly dashboardPath: string;
  };
  readonly checks: readonly ProductionObservabilityAlertingCheck[];
  readonly behavior: ObservabilityAlertingBehavior | null;
  readonly nonClaims: readonly string[];
}

const DEFAULT_PROFILE_PATH =
  'docs/08-deployment/production-rehearsal-targets/gke-production-rehearsal.json';
const DEFAULT_OUTPUT_DIR =
  '.attestor/rehearsal/gke-production-rehearsal/observability-alerting';
const DEFAULT_SUBSTRATE_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/substrate-readiness/summary.json';
const DEFAULT_CONSEQUENCE_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/consequence-behavior/summary.json';
const DEFAULT_ASYNC_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/async-recovery/summary.json';
const DEFAULT_DR_SUMMARY =
  '.attestor/rehearsal/gke-production-rehearsal/backup-restore-dr/summary.json';
const DEFAULT_RUNBOOK_PATH =
  'docs/08-deployment/production-rehearsal-operator-runbook.md';
const DEFAULT_DASHBOARD_PATH =
  'ops/observability/grafana/dashboards/attestor-overview.json';

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function envValue(env: Environment, name: string): string | null {
  const value = env[name];
  return value && value.trim() ? value.trim() : null;
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

function tryReadSummary(path: string): PriorStepSummary | null {
  try {
    return readJsonFile<PriorStepSummary>(path);
  } catch {
    return null;
  }
}

function requireSubstrate(
  profile: TargetProfile,
  id: string,
  kind: string,
  requiredEnv: string,
): boolean {
  return profile.substrates.some((substrate) =>
    substrate.id === id &&
    substrate.kind === kind &&
    substrate.requiredEnv.includes(requiredEnv));
}

function targetPrerequisiteChecks(input: {
  readonly env: Environment;
  readonly profile: TargetProfile;
  readonly substrateSummary: PriorStepSummary | null;
  readonly consequenceSummary: PriorStepSummary | null;
  readonly asyncSummary: PriorStepSummary | null;
  readonly drSummary: PriorStepSummary | null;
  readonly runbookPath: string;
  readonly dashboardPath: string;
}): ProductionObservabilityAlertingCheck[] {
  const checks: ProductionObservabilityAlertingCheck[] = [];
  const profileIssues: string[] = [];
  if (input.profile.profileId !== 'gke-production-rehearsal') {
    profileIssues.push(`unexpected profile id: ${input.profile.profileId}`);
  }
  if (input.profile.targetEnvironment.provider !== 'gke') {
    profileIssues.push(`unexpected provider: ${input.profile.targetEnvironment.provider}`);
  }
  if (input.profile.runtime.profile !== 'production-shared') {
    profileIssues.push('target profile must use production-shared');
  }
  if (!input.profile.runtime.requireSharedAuthority) {
    profileIssues.push('target profile must require shared authority');
  }
  if (!input.profile.runtime.noLocalFallback) {
    profileIssues.push('target profile must disable local fallback');
  }
  if (input.profile.runtime.sharedAuthorityContract !== 'async-shared-authority-stores') {
    profileIssues.push('target profile must use async-shared-authority-stores');
  }
  if (!requireSubstrate(input.profile, 'grafana-alloy-observability', 'observability', 'ATTESTOR_OBSERVABILITY_PROMETHEUS_URL')) {
    profileIssues.push('grafana-alloy-observability substrate must require Prometheus URL');
  }
  if (!requireSubstrate(input.profile, 'grafana-alloy-observability', 'observability', 'ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL')) {
    profileIssues.push('grafana-alloy-observability substrate must require Alertmanager URL');
  }
  checks.push(
    profileIssues.length === 0
      ? pass('target-profile-observability-contract', 'Target profile pins production-shared observability rehearsal inputs')
      : fail('target-profile-observability-contract', profileIssues.join(' ')),
  );

  const envIssues: string[] = [];
  if (envValue(input.env, 'ATTESTOR_RUNTIME_PROFILE') !== 'production-shared') {
    envIssues.push('ATTESTOR_RUNTIME_PROFILE must be production-shared');
  }
  for (const name of [
    'ATTESTOR_OBSERVABILITY_PROVIDER',
    'ATTESTOR_OBSERVABILITY_PROMETHEUS_URL',
    'ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL',
    'ATTESTOR_OBSERVABILITY_DASHBOARD_URL',
    'ATTESTOR_API_HEALTH_URL',
    'ATTESTOR_API_READY_URL',
  ] as const) {
    if (!envValue(input.env, name)) envIssues.push(`${name} is required`);
  }
  checks.push(
    envIssues.length === 0
      ? pass('observability-environment-inputs', 'Observability provider, receiver endpoints, dashboard URL, and runtime endpoints are explicit')
      : fail('observability-environment-inputs', envIssues.join(' ')),
  );

  const summaries: Array<readonly [string, PriorStepSummary | null, string]> = [
    ['substrate-readiness-prerequisite', input.substrateSummary, 'Step 05 substrate readiness'],
    ['consequence-rehearsal-prerequisite', input.consequenceSummary, 'Step 06 consequence behavior'],
    ['async-recovery-prerequisite', input.asyncSummary, 'Step 07 async recovery'],
    ['backup-restore-dr-prerequisite', input.drSummary, 'Step 08 backup/restore/DR'],
  ];
  for (const [id, summary, label] of summaries) {
    if (!summary) {
      checks.push(fail(id, `${label} summary is missing`));
    } else if (!summary.readiness.passed) {
      checks.push(
        fail(id, `${label} is ${summary.readiness.state}`, {
          issues: summary.readiness.issues ?? [],
        }),
      );
    } else {
      checks.push(pass(id, `${label} passed for the named target`, {
        state: summary.readiness.state,
      }));
    }
  }

  checks.push(
    existsSync(resolve(input.runbookPath))
      ? pass('operator-runbook-present', 'Operator runbook exists before observability rehearsal', {
        path: resolve(input.runbookPath),
      })
      : fail('operator-runbook-present', `Operator runbook is missing: ${input.runbookPath}`),
  );
  checks.push(
    existsSync(resolve(input.dashboardPath))
      ? pass('dashboard-definition-present', 'Grafana dashboard definition exists before observability rehearsal', {
        path: resolve(input.dashboardPath),
      })
      : fail('dashboard-definition-present', `Grafana dashboard definition is missing: ${input.dashboardPath}`),
  );

  return checks;
}

async function defaultFetchJson<T>(url: string, timeoutMs: number): Promise<EndpointProbe<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let body: T | null = null;
    if (text.trim()) {
      try {
        body = JSON.parse(text) as T;
      } catch {
        body = null;
      }
    }
    return {
      ok: response.ok && body !== null,
      status: response.status,
      body,
      bodySnippet: text.trim() ? text.slice(0, 500) : null,
      error: response.ok ? (body === null ? 'response was not JSON' : null) : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      bodySnippet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function defaultFetchText(url: string, timeoutMs: number): Promise<EndpointProbe<string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body: text,
      bodySnippet: text.trim() ? text.slice(0, 500) : null,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      bodySnippet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function defaultAdapters(env: Environment): RehearsalAdapters {
  return {
    receiverProbe: (outputDir) => probeObservabilityReceivers({
      outputDir,
      prometheusUrl: envValue(env, 'ATTESTOR_OBSERVABILITY_PROMETHEUS_URL'),
      alertmanagerUrl: envValue(env, 'ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL'),
    }),
    alertRoutingProbe: (outputDir) => probeAlertRouting({ outputDir }),
    fetchJson: defaultFetchJson,
    fetchText: defaultFetchText,
  };
}

function runtimeTruthFromResponses(input: {
  readonly health: EndpointProbe<Record<string, unknown>>;
  readonly ready: EndpointProbe<Record<string, unknown>>;
}): RuntimeTruth {
  const healthBody = input.health.body ?? {};
  const readyBody = input.ready.body ?? {};
  const runtimeProfile = healthBody.runtimeProfile as Record<string, unknown> | undefined;
  const releaseRuntime = healthBody.releaseRuntime as Record<string, unknown> | undefined;
  const durability = releaseRuntime?.durability as Record<string, unknown> | undefined;
  const requestPath = releaseRuntime?.requestPath as Record<string, unknown> | undefined;
  const sharedAuthorityRuntime = healthBody.sharedAuthorityRuntime as Record<string, unknown> | undefined;

  return {
    healthStatus: input.health.status,
    readyStatus: input.ready.status,
    runtimeProfile: typeof runtimeProfile?.id === 'string' ? runtimeProfile.id : null,
    releaseRuntimeReady: durability?.ready === true,
    requestPathContract: typeof requestPath?.contract === 'string' ? requestPath.contract : null,
    requestPathUsesSharedStores: requestPath?.usesSharedAuthorityStores === true,
    sharedAuthorityRuntimeReady:
      sharedAuthorityRuntime?.ready === true &&
      (readyBody as { checks?: Record<string, unknown> }).checks?.sharedAuthorityRuntime === true,
  };
}

function assertRuntimeTruth(truth: RuntimeTruth): void {
  const issues: string[] = [];
  if (truth.healthStatus < 200 || truth.healthStatus >= 300) {
    issues.push(`health endpoint returned HTTP ${truth.healthStatus}`);
  }
  if (truth.readyStatus < 200 || truth.readyStatus >= 300) {
    issues.push(`ready endpoint returned HTTP ${truth.readyStatus}`);
  }
  if (truth.runtimeProfile !== 'production-shared') {
    issues.push(`runtimeProfile must be production-shared, got ${truth.runtimeProfile ?? 'missing'}`);
  }
  if (!truth.releaseRuntimeReady) {
    issues.push('releaseRuntime.durability.ready must be true');
  }
  if (truth.requestPathContract !== 'async-shared-authority-stores') {
    issues.push(`releaseRuntime.requestPath.contract must be async-shared-authority-stores, got ${truth.requestPathContract ?? 'missing'}`);
  }
  if (!truth.requestPathUsesSharedStores) {
    issues.push('releaseRuntime.requestPath.usesSharedAuthorityStores must be true');
  }
  if (!truth.sharedAuthorityRuntimeReady) {
    issues.push('sharedAuthorityRuntime.ready and ready.checks.sharedAuthorityRuntime must be true');
  }
  if (issues.length > 0) {
    throw new Error(`Runtime/shared-authority truth check failed: ${issues.join(' ')}`);
  }
}

function dashboardTruth(input: {
  readonly dashboardPath: string;
  readonly dashboardUrl: string;
  readonly dashboardProbe: EndpointProbe<string>;
}): DashboardTruth {
  const parsed = readJsonFile<{
    readonly panels?: Array<{
      readonly title?: string;
      readonly targets?: Array<{ readonly expr?: string }>;
    }>;
  }>(input.dashboardPath);
  const panelTitles = (parsed.panels ?? []).map((panel) => panel.title ?? 'untitled');
  const targetExpressions = (parsed.panels ?? [])
    .flatMap((panel) => panel.targets ?? [])
    .map((target) => target.expr ?? '');
  const exposesRuntimeTruthMetric = targetExpressions.some((expr) =>
    expr.includes('attestor_runtime_profile_info'));
  return {
    dashboardPath: resolve(input.dashboardPath),
    dashboardUrl: input.dashboardUrl,
    reachableStatus: input.dashboardProbe.status,
    exposesRuntimeTruthMetric,
    panelTitles,
  };
}

function assertDashboardTruth(truth: DashboardTruth): void {
  const issues: string[] = [];
  if (truth.reachableStatus < 200 || truth.reachableStatus >= 300) {
    issues.push(`dashboard URL returned HTTP ${truth.reachableStatus}`);
  }
  if (!truth.exposesRuntimeTruthMetric) {
    issues.push('dashboard does not query attestor_runtime_profile_info');
  }
  if (!truth.panelTitles.some((title) => /runtime|shared authority/i.test(title))) {
    issues.push('dashboard does not name a runtime/shared authority panel');
  }
  if (issues.length > 0) {
    throw new Error(`Dashboard truth check failed: ${issues.join(' ')}`);
  }
}

function runbookTruth(path: string): RunbookTruth {
  const content = readFileSync(resolve(path), 'utf8');
  const stopConditionCount = (content.match(/\bstop condition\b/gi) ?? []).length
    + (content.match(/^-\s+.*stop/gim) ?? []).length;
  return {
    path: resolve(path),
    stopConditionCount,
    coversRuntimeProfile: /ATTESTOR_RUNTIME_PROFILE|runtime profile/i.test(content),
    coversSharedAuthority: /shared authority|usesSharedAuthorityStores|async-shared-authority-stores/i.test(content),
    coversObservability: /OTLP|Prometheus|Grafana|observability/i.test(content),
    coversAlertRouting: /Alertmanager|alert routing|receiver/i.test(content),
    coversDrPrerequisite: /backup|restore|DR|disaster/i.test(content),
  };
}

function assertRunbookTruth(truth: RunbookTruth): void {
  const issues: string[] = [];
  if (truth.stopConditionCount < 5) issues.push('runbook must name at least five stop conditions');
  if (!truth.coversRuntimeProfile) issues.push('runbook must cover runtime profile stop conditions');
  if (!truth.coversSharedAuthority) issues.push('runbook must cover shared-authority stop conditions');
  if (!truth.coversObservability) issues.push('runbook must cover observability receiver stop conditions');
  if (!truth.coversAlertRouting) issues.push('runbook must cover alert routing stop conditions');
  if (!truth.coversDrPrerequisite) issues.push('runbook must cover Step 08 backup/restore/DR prerequisite evidence');
  if (issues.length > 0) {
    throw new Error(`Operator runbook check failed: ${issues.join(' ')}`);
  }
}

async function runObservabilityAlertingBehavior(input: {
  readonly env: Environment;
  readonly outputDir: string;
  readonly runbookPath: string;
  readonly dashboardPath: string;
  readonly adapters: RehearsalAdapters;
  readonly timeoutMs: number;
}): Promise<ObservabilityAlertingBehavior> {
  const receiver = await input.adapters.receiverProbe(resolve(input.outputDir, 'observability-receivers'));
  const receiverIssues: string[] = [];
  if (!receiver.telemetry.flushSucceeded) {
    receiverIssues.push(`OTLP telemetry flush failed: ${receiver.telemetry.flushError ?? 'unknown'}`);
  }
  if (!receiver.prometheus.configured || !receiver.prometheus.ok) {
    receiverIssues.push(`Prometheus probe failed: ${receiver.prometheus.error ?? 'not configured'}`);
  }
  if (!receiver.alertmanager.configured || !receiver.alertmanager.ok) {
    receiverIssues.push(`Alertmanager probe failed: ${receiver.alertmanager.error ?? 'not configured'}`);
  }
  if (receiverIssues.length > 0) {
    throw new Error(receiverIssues.join(' '));
  }

  const alertRouting = await input.adapters.alertRoutingProbe(resolve(input.outputDir, 'alert-routing'));
  if (!alertRouting.releaseReadiness.routingValid || !alertRouting.releaseReadiness.deliveryCoverageValid) {
    throw new Error(
      `Alert routing probe failed: ${alertRouting.releaseReadiness.issues.join(' | ') || 'unknown routing issue'}`,
    );
  }

  const [health, ready, dashboardProbe] = await Promise.all([
    input.adapters.fetchJson<Record<string, unknown>>(envValue(input.env, 'ATTESTOR_API_HEALTH_URL')!, input.timeoutMs),
    input.adapters.fetchJson<Record<string, unknown>>(envValue(input.env, 'ATTESTOR_API_READY_URL')!, input.timeoutMs),
    input.adapters.fetchText(envValue(input.env, 'ATTESTOR_OBSERVABILITY_DASHBOARD_URL')!, input.timeoutMs),
  ]);
  if (!health.ok) {
    throw new Error(`Health endpoint did not return JSON success: ${health.error ?? `HTTP ${health.status}`}`);
  }
  if (!ready.ok) {
    throw new Error(`Ready endpoint did not return JSON success: ${ready.error ?? `HTTP ${ready.status}`}`);
  }
  if (!dashboardProbe.ok) {
    throw new Error(`Dashboard URL did not return success: ${dashboardProbe.error ?? `HTTP ${dashboardProbe.status}`}`);
  }

  const runtimeTruth = runtimeTruthFromResponses({ health, ready });
  assertRuntimeTruth(runtimeTruth);

  const dashboards = dashboardTruth({
    dashboardPath: input.dashboardPath,
    dashboardUrl: envValue(input.env, 'ATTESTOR_OBSERVABILITY_DASHBOARD_URL')!,
    dashboardProbe,
  });
  assertDashboardTruth(dashboards);

  const runbook = runbookTruth(input.runbookPath);
  assertRunbookTruth(runbook);

  return {
    receiverProbe: {
      telemetryFlushSucceeded: receiver.telemetry.flushSucceeded,
      prometheusOk: receiver.prometheus.ok,
      alertmanagerOk: receiver.alertmanager.ok,
    },
    alertRouting: {
      routingValid: alertRouting.releaseReadiness.routingValid,
      deliveryCoverageValid: alertRouting.releaseReadiness.deliveryCoverageValid,
      scenarioCount: alertRouting.scenarios.length,
    },
    runtimeTruth,
    dashboardTruth: dashboards,
    runbookTruth: runbook,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function renderReadme(summary: ProductionObservabilityAlertingSummary): string {
  const lines = [
    '# Production Observability / Alerting / Runbook Rehearsal',
    '',
    `Generated: ${summary.generatedAt}`,
    `Profile: ${summary.profileId}`,
    `State: ${summary.readiness.state}`,
    `Passed: ${summary.readiness.passed ? 'yes' : 'no'}`,
    '',
    '## Checks',
    '',
    ...summary.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`),
    '',
    '## Artifacts',
    '',
    `- Summary: ${summary.artifacts.summaryPath}`,
    `- Receiver probe: ${summary.artifacts.receiverProbeDir}`,
    `- Alert routing probe: ${summary.artifacts.alertRoutingDir}`,
    `- Runbook: ${summary.artifacts.runbookPath}`,
    `- Dashboard: ${summary.artifacts.dashboardPath}`,
    '',
    '## Behavior',
    '',
  ];
  if (summary.behavior) {
    lines.push(
      `- OTLP telemetry flush: ${summary.behavior.receiverProbe.telemetryFlushSucceeded ? 'passed' : 'failed'}`,
      `- Prometheus probe: ${summary.behavior.receiverProbe.prometheusOk ? 'passed' : 'failed'}`,
      `- Alertmanager probe: ${summary.behavior.receiverProbe.alertmanagerOk ? 'passed' : 'failed'}`,
      `- Alert routing scenarios: ${summary.behavior.alertRouting.scenarioCount}`,
      `- Runtime profile: ${summary.behavior.runtimeTruth.runtimeProfile ?? 'missing'}`,
      `- Shared authority request path: ${summary.behavior.runtimeTruth.requestPathUsesSharedStores ? 'shared' : 'not shared'}`,
      `- Dashboard runtime truth metric: ${summary.behavior.dashboardTruth.exposesRuntimeTruthMetric ? 'present' : 'missing'}`,
      `- Runbook stop conditions: ${summary.behavior.runbookTruth.stopConditionCount}`,
    );
  } else {
    lines.push('- Core observability/alerting/runbook behavior was not exercised.');
  }
  lines.push(
    '',
    '## Non-Claims',
    '',
    ...summary.nonClaims.map((claim) => `- ${claim}`),
    '',
  );
  return lines.join('\n');
}

export async function rehearseProductionObservabilityAlerting(options?: {
  readonly env?: Environment;
  readonly profile?: TargetProfile;
  readonly substrateSummary?: PriorStepSummary | null;
  readonly consequenceSummary?: PriorStepSummary | null;
  readonly asyncSummary?: PriorStepSummary | null;
  readonly drSummary?: PriorStepSummary | null;
  readonly runbookPath?: string;
  readonly dashboardPath?: string;
  readonly outputDir?: string;
  readonly adapters?: Partial<RehearsalAdapters>;
  readonly timeoutMs?: number;
}): Promise<ProductionObservabilityAlertingSummary> {
  const env = options?.env ?? process.env;
  const profile = options?.profile ?? readJsonFile<TargetProfile>(
    arg('profile', DEFAULT_PROFILE_PATH)!,
  );
  const outputDir = resolve(options?.outputDir ?? arg('output-dir', DEFAULT_OUTPUT_DIR)!);
  const runbookPath = resolve(options?.runbookPath ?? arg(
    'runbook',
    envValue(env, 'ATTESTOR_OPERATOR_RUNBOOK_PATH') ?? DEFAULT_RUNBOOK_PATH,
  )!);
  const dashboardPath = resolve(options?.dashboardPath ?? arg(
    'dashboard',
    DEFAULT_DASHBOARD_PATH,
  )!);
  const timeoutMs = options?.timeoutMs ?? Number.parseInt(arg(
    'timeout-ms',
    envValue(env, 'ATTESTOR_REHEARSAL_PROBE_TIMEOUT_MS') ?? '5000',
  )!, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeout-ms must be a positive integer.');
  }

  mkdirSync(outputDir, { recursive: true });
  const summaryPath = resolve(outputDir, 'summary.json');
  const readmePath = resolve(outputDir, 'README.md');
  const substrateSummary = options?.substrateSummary ?? tryReadSummary(
    arg('substrate-summary', DEFAULT_SUBSTRATE_SUMMARY)!,
  );
  const consequenceSummary = options?.consequenceSummary ?? tryReadSummary(
    arg('consequence-summary', DEFAULT_CONSEQUENCE_SUMMARY)!,
  );
  const asyncSummary = options?.asyncSummary ?? tryReadSummary(
    arg('async-summary', DEFAULT_ASYNC_SUMMARY)!,
  );
  const drSummary = options?.drSummary ?? tryReadSummary(
    arg('dr-summary', DEFAULT_DR_SUMMARY)!,
  );

  const checks = targetPrerequisiteChecks({
    env,
    profile,
    substrateSummary,
    consequenceSummary,
    asyncSummary,
    drSummary,
    runbookPath,
    dashboardPath,
  });
  const prerequisiteIssues = checks
    .filter((check) => check.status === 'fail')
    .map((check) => `${check.id}: ${check.detail}`);
  const nonClaims = [
    'This rehearsal is not a managed observability service.',
    'This rehearsal is not a guarantee that every customer paging policy is correct.',
    'This rehearsal does not replace a human incident commander or on-call escalation review.',
    'This rehearsal does not prove market/customer validation or a hosted public SaaS launch.',
    'This rehearsal does not claim production promotion until Step 10 packages the final go/no-go evidence bundle.',
  ];

  let behavior: ObservabilityAlertingBehavior | null = null;
  let readiness: ProductionObservabilityAlertingSummary['readiness'];
  if (prerequisiteIssues.length > 0) {
    checks.push(skip(
      'observability-alerting-runbook-rehearsal',
      'Core observability/alerting/runbook behavior skipped because prerequisites failed',
    ));
    readiness = {
      state: 'blocked-on-target-prerequisites',
      passed: false,
      issues: prerequisiteIssues,
    };
  } else {
    try {
      const adapters = {
        ...defaultAdapters(env),
        ...options?.adapters,
      };
      behavior = await runObservabilityAlertingBehavior({
        env,
        outputDir,
        runbookPath,
        dashboardPath,
        adapters,
        timeoutMs,
      });
      checks.push(pass('observability-receivers', 'OTLP, Prometheus, and Alertmanager receiver probes passed', behavior.receiverProbe));
      checks.push(pass('alert-routing', 'Alertmanager routing and required delivery coverage passed', behavior.alertRouting));
      checks.push(pass('runtime-shared-authority-truth', 'Health and readiness endpoints expose production-shared async shared-authority request-path truth', behavior.runtimeTruth));
      checks.push(pass('dashboard-runtime-truth', 'Operational dashboard is reachable and exposes the runtime/shared-authority truth metric', behavior.dashboardTruth));
      checks.push(pass('operator-runbook-stop-conditions', 'Operator runbook names stop conditions for runtime, shared authority, observability, alerting, and DR prerequisites', behavior.runbookTruth));
      readiness = {
        state: 'passed-observability-alerting-runbook-rehearsal',
        passed: true,
        issues: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push(fail('observability-alerting-runbook-rehearsal', message));
      readiness = {
        state: 'failed-observability-alerting-runbook-rehearsal',
        passed: false,
        issues: [message],
      };
    }
  }

  const summary: ProductionObservabilityAlertingSummary = {
    generatedAt: new Date().toISOString(),
    profileId: profile.profileId,
    readiness,
    target: {
      provider: profile.targetEnvironment.provider,
      namespace: profile.targetEnvironment.namespace,
      publicHostname: substrateSummary?.target?.publicHostname ?? null,
    },
    artifacts: {
      outputDir,
      summaryPath,
      readmePath,
      receiverProbeDir: resolve(outputDir, 'observability-receivers'),
      alertRoutingDir: resolve(outputDir, 'alert-routing'),
      runbookPath,
      dashboardPath,
    },
    checks,
    behavior,
    nonClaims,
  };
  writeJson(summaryPath, summary);
  writeFileSync(readmePath, renderReadme(summary), 'utf8');
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rehearseProductionObservabilityAlerting()
    .then((summary) => {
      console.log(`Production observability/alerting/runbook rehearsal: ${summary.readiness.state}`);
      console.log(`Summary: ${summary.artifacts.summaryPath}`);
      console.log(`README: ${summary.artifacts.readmePath}`);
      if (!summary.readiness.passed) {
        for (const issue of summary.readiness.issues) {
          console.error(`- ${issue}`);
        }
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : error);
      process.exit(1);
    });
}
