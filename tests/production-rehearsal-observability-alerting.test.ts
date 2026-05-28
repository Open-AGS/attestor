import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  rehearseProductionObservabilityAlerting,
  type ProductionObservabilityAlertingSummary,
} from '../scripts/rehearse/rehearse-production-observability-alerting.ts';
import { renderPrometheusMetrics } from '../src/service/observability.js';

let passed = 0;

type Env = Record<string, string | undefined>;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function equal<T>(actual: T, expected: T, message: string): void {
  assert.equal(actual, expected, message);
  passed += 1;
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function readProjectFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readProjectFile(...segments)) as T;
}

function passedSummary(state: string) {
  return {
    profileId: 'gke-production-rehearsal',
    readiness: {
      passed: true,
      state,
      issues: [],
    },
    target: {
      provider: 'gke',
      namespace: 'attestor',
      publicHostname: 'attestor.example.invalid',
    },
  };
}

function failedDrSummary() {
  return {
    ...passedSummary('failed-backup-restore-dr-rehearsal'),
    readiness: {
      passed: false,
      state: 'failed-backup-restore-dr-rehearsal',
      issues: ['restore target did not pass'],
    },
  };
}

function baseSummaries() {
  return {
    substrateSummary: passedSummary('ready-for-rehearsal'),
    consequenceSummary: passedSummary('passed-core-consequence-rehearsal'),
    asyncSummary: passedSummary('passed-async-recovery-rehearsal'),
    drSummary: passedSummary('passed-backup-restore-dr-rehearsal'),
  };
}

function runtimeHealthBody(overrides?: Record<string, unknown>) {
  return {
    status: 'healthy',
    runtimeProfile: {
      id: 'production-shared',
      label: 'Production Shared',
    },
    releaseRuntime: {
      durability: {
        ready: true,
        summary: 'ready',
      },
      requestPath: {
        version: 'attestor.release-runtime.request-path.v1',
        usesSharedAuthorityStores: true,
        contract: 'async-shared-authority-stores',
      },
    },
    sharedAuthorityRuntime: {
      ready: true,
    },
    ...overrides,
  };
}

function runtimeReadyBody(overrides?: Record<string, unknown>) {
  return {
    ready: true,
    checks: {
      releaseRuntime: true,
      sharedAuthorityRuntime: true,
    },
    runtimeProfile: {
      id: 'production-shared',
      label: 'Production Shared',
    },
    releaseRuntime: {
      durability: {
        ready: true,
      },
      requestPath: {
        usesSharedAuthorityStores: true,
        contract: 'async-shared-authority-stores',
      },
    },
    sharedAuthorityRuntime: {
      ready: true,
    },
    ...overrides,
  };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolvePort, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve server port.'));
        return;
      }
      resolvePort(address.port);
    });
    server.on('error', reject);
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
}

async function withServers<T>(
  run: (urls: {
    collectorUrl: string;
    prometheusUrl: string;
    alertmanagerUrl: string;
    apiBaseUrl: string;
    dashboardUrl: string;
    collectorRequests: string[];
  }) => Promise<T>,
  options?: {
    healthBody?: Record<string, unknown>;
    readyBody?: Record<string, unknown>;
  },
): Promise<T> {
  const collectorRequests: string[] = [];
  const collector = createServer((req, res) => {
    collectorRequests.push(req.url ?? '/');
    res.writeHead(200).end('ok');
  });
  const prometheus = createServer((req, res) => {
    if ((req.url ?? '').startsWith('/api/v1/query')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        data: { resultType: 'vector', result: [{ metric: {}, value: [1, '1'] }] },
      }));
      return;
    }
    res.writeHead(404).end();
  });
  const alertmanager = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify([{ labels: { severity: 'critical' } }]));
  });
  const api = createServer((req, res) => {
    if (req.url === '/api/v1/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(options?.healthBody ?? runtimeHealthBody()));
      return;
    }
    if (req.url === '/api/v1/ready') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(options?.readyBody ?? runtimeReadyBody()));
      return;
    }
    res.writeHead(404).end('not found');
  });
  const dashboard = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><title>Attestor Overview</title></html>');
  });

  const collectorPort = await listen(collector);
  const prometheusPort = await listen(prometheus);
  const alertmanagerPort = await listen(alertmanager);
  const apiPort = await listen(api);
  const dashboardPort = await listen(dashboard);

  try {
    return await run({
      collectorUrl: `http://127.0.0.1:${collectorPort}`,
      prometheusUrl: `http://127.0.0.1:${prometheusPort}`,
      alertmanagerUrl: `http://127.0.0.1:${alertmanagerPort}`,
      apiBaseUrl: `http://127.0.0.1:${apiPort}`,
      dashboardUrl: `http://127.0.0.1:${dashboardPort}/d/attestor-overview`,
      collectorRequests,
    });
  } finally {
    await close(collector);
    await close(prometheus);
    await close(alertmanager);
    await close(api);
    await close(dashboard);
  }
}

async function withEnv<T>(env: Env, run: () => Promise<T>): Promise<T> {
  const previous: Env = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const key of Object.keys(env)) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function baseEnv(urls: {
  collectorUrl: string;
  prometheusUrl: string;
  alertmanagerUrl: string;
  apiBaseUrl: string;
  dashboardUrl: string;
}): Env {
  return {
    ATTESTOR_RUNTIME_PROFILE: 'production-shared',
    ATTESTOR_OBSERVABILITY_PROVIDER: 'grafana-alloy',
    ATTESTOR_OBSERVABILITY_PROMETHEUS_URL: urls.prometheusUrl,
    ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL: urls.alertmanagerUrl,
    ATTESTOR_OBSERVABILITY_DASHBOARD_URL: urls.dashboardUrl,
    ATTESTOR_API_HEALTH_URL: `${urls.apiBaseUrl}/api/v1/health`,
    ATTESTOR_API_READY_URL: `${urls.apiBaseUrl}/api/v1/ready`,
    ALERTMANAGER_DEFAULT_WEBHOOK_URL: 'https://alerts.example.invalid/default',
    ALERTMANAGER_CRITICAL_PAGERDUTY_ROUTING_KEY: 'pd-routing-key',
    ALERTMANAGER_WARNING_WEBHOOK_URL: 'https://alerts.example.invalid/warning',
    ALERTMANAGER_SECURITY_WEBHOOK_URL: 'https://alerts.example.invalid/security',
    ALERTMANAGER_BILLING_WEBHOOK_URL: 'https://alerts.example.invalid/billing',
    ALERTMANAGER_PRODUCTION_MODE: 'true',
    OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${urls.collectorUrl}/v1/logs`,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${urls.collectorUrl}/v1/traces`,
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: `${urls.collectorUrl}/v1/metrics`,
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: 'http/protobuf',
    OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'http/protobuf',
    OTEL_METRIC_EXPORT_INTERVAL: '200',
    OTEL_SERVICE_NAME: 'attestor-production-observability-alerting-test',
  };
}

async function runPassRehearsal(): Promise<{
  summary: ProductionObservabilityAlertingSummary;
  outputDir: string;
  collectorRequests: string[];
}> {
  return withServers(async (urls) => {
    const env = baseEnv(urls);
    const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-observability-alerting-'));
    try {
      const summary = await withEnv(env, () => rehearseProductionObservabilityAlerting({
        env,
        ...baseSummaries(),
        outputDir,
        timeoutMs: 2000,
      }));
      return { summary, outputDir, collectorRequests: urls.collectorRequests };
    } catch (error) {
      rmSync(outputDir, { recursive: true, force: true });
      throw error;
    }
  });
}

async function testObservabilityAlertingPassesAndWritesArtifacts(): Promise<void> {
  const { summary, outputDir, collectorRequests } = await runPassRehearsal();
  try {
    equal(summary.readiness.passed, true, 'Production observability/alerting: full rehearsal passes');
    equal(summary.readiness.state, 'passed-observability-alerting-runbook-rehearsal', 'Production observability/alerting: pass state is explicit');
    ok(summary.checks.every((check) => check.status === 'pass'), 'Production observability/alerting: every check passes');
    ok(summary.behavior !== null, 'Production observability/alerting: behavior is recorded');
    equal(summary.behavior?.receiverProbe.telemetryFlushSucceeded, true, 'Production observability/alerting: telemetry flush is recorded');
    equal(summary.behavior?.receiverProbe.prometheusOk, true, 'Production observability/alerting: Prometheus probe is recorded');
    equal(summary.behavior?.receiverProbe.alertmanagerOk, true, 'Production observability/alerting: Alertmanager probe is recorded');
    equal(summary.behavior?.alertRouting.routingValid, true, 'Production observability/alerting: alert routing is recorded');
    equal(summary.behavior?.alertRouting.deliveryCoverageValid, true, 'Production observability/alerting: alert delivery coverage is recorded');
    equal(summary.behavior?.runtimeTruth.runtimeProfile, 'production-shared', 'Production observability/alerting: runtime profile truth is recorded');
    equal(summary.behavior?.runtimeTruth.requestPathUsesSharedStores, true, 'Production observability/alerting: shared request path truth is recorded');
    equal(summary.behavior?.dashboardTruth.exposesRuntimeTruthMetric, true, 'Production observability/alerting: dashboard runtime metric is recorded');
    ok((summary.behavior?.runbookTruth.stopConditionCount ?? 0) >= 5, 'Production observability/alerting: runbook stop conditions are recorded');
    ok(collectorRequests.includes('/v1/logs') && collectorRequests.includes('/v1/traces') && collectorRequests.includes('/v1/metrics'), 'Production observability/alerting: OTLP receiver paths are exercised');
    includes(readFileSync(resolve(outputDir, 'README.md'), 'utf8'), 'passed-observability-alerting-runbook-rehearsal', 'Production observability/alerting: README records pass state');
    ok(Boolean(readJson<unknown>(outputDir, 'summary.json')), 'Production observability/alerting: summary JSON is readable');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testMissingDashboardBlocksBeforeCoreBehavior(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-observability-alerting-missing-'));
  try {
    const env: Env = {
      ATTESTOR_RUNTIME_PROFILE: 'production-shared',
      ATTESTOR_OBSERVABILITY_PROVIDER: 'grafana-alloy',
      ATTESTOR_OBSERVABILITY_PROMETHEUS_URL: 'http://127.0.0.1:9090',
      ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL: 'http://127.0.0.1:9093',
      ATTESTOR_API_HEALTH_URL: 'http://127.0.0.1:1/api/v1/health',
      ATTESTOR_API_READY_URL: 'http://127.0.0.1:1/api/v1/ready',
    };
    const summary = await rehearseProductionObservabilityAlerting({
      env,
      ...baseSummaries(),
      outputDir,
    });

    equal(summary.readiness.passed, false, 'Production observability/alerting: missing dashboard URL blocks readiness');
    equal(summary.readiness.state, 'blocked-on-target-prerequisites', 'Production observability/alerting: missing dashboard blocks before behavior');
    ok(summary.readiness.issues.some((issue) => issue.includes('ATTESTOR_OBSERVABILITY_DASHBOARD_URL')), 'Production observability/alerting: missing dashboard URL is surfaced');
    equal(summary.behavior, null, 'Production observability/alerting: behavior is skipped when dashboard URL is missing');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testFailedDrSummaryBlocksBeforeCoreBehavior(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-observability-alerting-dr-'));
  try {
    const summary = await rehearseProductionObservabilityAlerting({
      env: {
        ATTESTOR_RUNTIME_PROFILE: 'production-shared',
        ATTESTOR_OBSERVABILITY_PROVIDER: 'grafana-alloy',
        ATTESTOR_OBSERVABILITY_PROMETHEUS_URL: 'http://127.0.0.1:9090',
        ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL: 'http://127.0.0.1:9093',
        ATTESTOR_OBSERVABILITY_DASHBOARD_URL: 'http://127.0.0.1:3000/d/attestor-overview',
        ATTESTOR_API_HEALTH_URL: 'http://127.0.0.1:1/api/v1/health',
        ATTESTOR_API_READY_URL: 'http://127.0.0.1:1/api/v1/ready',
      },
      substrateSummary: passedSummary('ready-for-rehearsal'),
      consequenceSummary: passedSummary('passed-core-consequence-rehearsal'),
      asyncSummary: passedSummary('passed-async-recovery-rehearsal'),
      drSummary: failedDrSummary(),
      outputDir,
    });

    equal(summary.readiness.passed, false, 'Production observability/alerting: failed Step 08 blocks readiness');
    ok(summary.readiness.issues.some((issue) => issue.includes('failed-backup-restore-dr-rehearsal')), 'Production observability/alerting: failed Step 08 state is surfaced');
    equal(summary.behavior, null, 'Production observability/alerting: behavior is skipped when Step 08 failed');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testRuntimeTruthMismatchFailsCoreBehavior(): Promise<void> {
  await withServers(async (urls) => {
    const env = baseEnv(urls);
    const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-observability-alerting-runtime-'));
    try {
      const summary = await withEnv(env, () => rehearseProductionObservabilityAlerting({
        env,
        ...baseSummaries(),
        outputDir,
        timeoutMs: 2000,
      }));
      equal(summary.readiness.passed, false, 'Production observability/alerting: runtime mismatch fails rehearsal');
      equal(summary.readiness.state, 'failed-observability-alerting-runbook-rehearsal', 'Production observability/alerting: runtime mismatch is a failed behavior state');
      ok(summary.readiness.issues.some((issue) => issue.includes('runtimeProfile must be production-shared')), 'Production observability/alerting: runtime mismatch is surfaced');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, {
    healthBody: runtimeHealthBody({
      runtimeProfile: {
        id: 'local-dev',
        label: 'Local Development',
      },
    }),
  });
}

async function testAlertRoutingFailureFailsCoreBehavior(): Promise<void> {
  await withServers(async (urls) => {
    const env = {
      ...baseEnv(urls),
      ALERTMANAGER_WARNING_WEBHOOK_URL: undefined,
    };
    const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-observability-alerting-routing-'));
    try {
      const summary = await withEnv(env, () => rehearseProductionObservabilityAlerting({
        env,
        ...baseSummaries(),
        outputDir,
        timeoutMs: 2000,
      }));
      equal(summary.readiness.passed, false, 'Production observability/alerting: alert routing failure fails rehearsal');
      ok(summary.readiness.issues.some((issue) => issue.includes('warning alert routing')), 'Production observability/alerting: alert routing issue is surfaced');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
}

function testDocsPackageDashboardAndMetricsWireTheRehearsal(): void {
  const packageJson = readJson<{ scripts: Record<string, string> }>('package.json');
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');
  const manifest = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.example.json');
  const manifestDoc = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.md');
  const dashboard = readProjectFile('ops', 'observability', 'grafana', 'dashboards', 'attestor-overview.json');
  const runbook = readProjectFile('docs', '08-deployment', 'production-rehearsal-operator-runbook.md');
  const metrics = renderPrometheusMetrics('1.0.0', {
    runtimeProfile: 'production-shared',
    releaseRuntimeReady: true,
    requestPathContract: 'async-shared-authority-stores',
    requestPathUsesSharedStores: true,
  });

  equal(packageJson.scripts['rehearse:production-observability-alerting'], 'tsx scripts/rehearse/rehearse-production-observability-alerting.ts', 'Production observability/alerting: package exposes the rehearsal command');
  equal(packageJson.scripts['test:production-rehearsal-observability-alerting'], 'tsx tests/production-rehearsal-observability-alerting.test.ts', 'Production observability/alerting: package exposes the rehearsal test');
  includes(tracker, '| Completed | 10 |', 'Production observability/alerting: tracker marks ten steps complete');
  includes(tracker, '| Not started | 0 |', 'Production observability/alerting: tracker leaves no frozen steps pending');
  includes(tracker, '| 09 | complete | Rehearse observability, alerting, and operator runbooks |', 'Production observability/alerting: Step 09 is complete without renumbering');
  includes(tracker, 'The production rehearsal buildout is complete at the repository level.', 'Production observability/alerting: immediate next step advances beyond Step 10');
  includes(manifest, 'npm run rehearse:production-observability-alerting', 'Production observability/alerting: manifest command plan includes the rehearsal command');
  includes(manifest, 'production-rehearsal-observability-alerting', 'Production observability/alerting: manifest evidence includes the Step 09 summary');
  includes(manifestDoc, 'Observability / Alerting / Runbook Rehearsal', 'Production observability/alerting: manifest docs explain the Step 09 rehearsal');
  includes(dashboard, 'attestor_runtime_profile_info', 'Production observability/alerting: dashboard queries runtime truth metric');
  includes(runbook, 'stop if `releaseRuntime.requestPath.usesSharedAuthorityStores=false`', 'Production observability/alerting: runbook names shared-authority stop condition');
  includes(metrics, 'attestor_runtime_profile_info', 'Production observability/alerting: Prometheus metrics expose runtime truth info');
  includes(metrics, 'request_path_uses_shared_stores="true"', 'Production observability/alerting: runtime truth metric exposes shared-store state');
}

await testObservabilityAlertingPassesAndWritesArtifacts();
await testMissingDashboardBlocksBeforeCoreBehavior();
await testFailedDrSummaryBlocksBeforeCoreBehavior();
await testRuntimeTruthMismatchFailsCoreBehavior();
await testAlertRoutingFailureFailsCoreBehavior();
testDocsPackageDashboardAndMetricsWireTheRehearsal();

console.log(`production-rehearsal-observability-alerting.test.ts: ${passed} assertions passed`);
