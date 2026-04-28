import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  probeProductionRehearsalSubstrates,
  type ProductionRehearsalSubstrateSummary,
} from '../scripts/probe-production-rehearsal-substrates.ts';

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

function readProjectFile(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

function includes(content: string, expected: string, message: string): void {
  assert.ok(
    content.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
  passed += 1;
}

function baseEnv(): Env {
  return {
    ATTESTOR_RUNTIME_PROFILE: 'production-shared',
    ATTESTOR_RELEASE_AUTHORITY_PG_URL: 'postgres://release-authority.example.invalid/attestor',
    ATTESTOR_CONTROL_PLANE_PG_URL: 'postgres://control-plane.example.invalid/attestor',
    ATTESTOR_BILLING_LEDGER_PG_URL: 'postgres://billing-ledger.example.invalid/attestor',
    REDIS_URL: 'redis://redis.example.invalid:6379',
    ATTESTOR_EXTERNAL_SECRET_STORE: 'platform-secrets',
    ATTESTOR_GKE_WORKLOAD_IDENTITY_SERVICE_ACCOUNT: 'attestor-runtime@example.iam.gserviceaccount.com',
    ATTESTOR_PUBLIC_HOSTNAME: 'attestor.example.invalid',
    ATTESTOR_GKE_STATIC_ADDRESS_NAME: 'attestor-gateway-ip',
    ATTESTOR_DNS_TARGET_IP: '203.0.113.10',
    ATTESTOR_TLS_CLUSTER_ISSUER: 'letsencrypt-prod',
    ATTESTOR_TLS_SECRET_NAME: 'attestor-tls',
    ATTESTOR_ACME_EMAIL: 'ops@example.invalid',
    ATTESTOR_OBSERVABILITY_PROVIDER: 'grafana-alloy',
    ATTESTOR_OBSERVABILITY_PROMETHEUS_URL: 'https://prometheus.example.invalid',
    ATTESTOR_OBSERVABILITY_ALERTMANAGER_URL: 'https://alertmanager.example.invalid',
    ATTESTOR_API_HEALTH_URL: 'https://attestor.example.invalid/api/v1/health',
    ATTESTOR_API_READY_URL: 'https://attestor.example.invalid/api/v1/ready',
    ATTESTOR_WORKER_HEALTH_URL: 'http://attestor-worker.attestor.svc.cluster.local:9808/health',
    ATTESTOR_WORKER_READY_URL: 'http://attestor-worker.attestor.svc.cluster.local:9808/ready',
  };
}

function readyResource(...conditions: string[]): unknown {
  return {
    status: {
      conditions: conditions.map((type) => ({ type, status: 'True', reason: 'Ready' })),
    },
  };
}

function readyRoute(): unknown {
  return {
    status: {
      parents: [
        {
          conditions: [
            { type: 'Accepted', status: 'True', reason: 'Accepted' },
            { type: 'ResolvedRefs', status: 'True', reason: 'ResolvedRefs' },
          ],
        },
      ],
    },
  };
}

function goodAdapters(overrides?: {
  readonly kubernetesResource?: (request: { kind: string; name: string; namespace: string | null }) => Promise<{ resource: unknown | null; error: string | null }>;
  readonly haPassed?: boolean;
  readonly observabilityPassed?: boolean;
}) {
  return {
    haRuntimeConnectivity: async () => ({
      provider: 'gke',
      tlsMode: 'cert-manager',
      timeoutMs: 5000,
      checks: {},
      overall: {
        passed: overrides?.haPassed ?? true,
        issues: overrides?.haPassed === false ? ['Redis connectivity failed: connection refused'] : [],
      },
    } as any),
    observabilityReceivers: async () => ({
      telemetry: {
        enabled: true,
        flushSucceeded: overrides?.observabilityPassed ?? true,
        flushError: overrides?.observabilityPassed === false ? 'collector unavailable' : null,
      },
      prometheus: {
        configured: true,
        url: 'https://prometheus.example.invalid',
        ok: overrides?.observabilityPassed ?? true,
        status: overrides?.observabilityPassed === false ? 503 : 200,
        error: overrides?.observabilityPassed === false ? 'HTTP 503' : null,
      },
      alertmanager: {
        configured: true,
        url: 'https://alertmanager.example.invalid',
        ok: overrides?.observabilityPassed ?? true,
        status: overrides?.observabilityPassed === false ? 503 : 200,
        error: overrides?.observabilityPassed === false ? 'HTTP 503' : null,
        activeAlerts: 0,
      },
    } as any),
    fetchEndpoint: async (url: string) => ({
      ok: true,
      status: 200,
      bodySnippet: url.includes('/ready') ? '{"status":"ready"}' : '{"status":"healthy"}',
      error: null,
    }),
    resolveHostname: async () => ({
      addresses: ['203.0.113.10'],
      error: null,
    }),
    kubernetesResource: overrides?.kubernetesResource ?? (async (request: { kind: string }) => {
      if (request.kind === 'HTTPRoute') return { resource: readyRoute(), error: null };
      if (request.kind === 'Gateway') return { resource: readyResource('Accepted', 'Programmed'), error: null };
      return { resource: readyResource('Ready'), error: null };
    }),
  };
}

async function runProbe(env: Env, adapters = goodAdapters()): Promise<ProductionRehearsalSubstrateSummary> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-substrate-probe-'));
  try {
    return await probeProductionRehearsalSubstrates({
      env,
      adapters,
      outputDir,
      timeoutMs: 100,
    });
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testProbePassesWithAllExternalSubstratesReady(): Promise<void> {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'attestor-substrate-probe-output-'));
  try {
    const summary = await probeProductionRehearsalSubstrates({
      env: baseEnv(),
      adapters: goodAdapters(),
      outputDir,
      timeoutMs: 100,
    });

    equal(summary.readiness.passed, true, 'Production rehearsal substrate probe: all green adapters pass');
    equal(summary.readiness.state, 'ready-for-rehearsal', 'Production rehearsal substrate probe: pass state is ready-for-rehearsal');
    ok(summary.checks.every((check) => check.status === 'pass'), 'Production rehearsal substrate probe: every check passes');
    ok(existsSync(resolve(outputDir, 'summary.json')), 'Production rehearsal substrate probe: summary artifact is written');
    ok(existsSync(resolve(outputDir, 'README.md')), 'Production rehearsal substrate probe: README artifact is written');
    includes(readFileSync(resolve(outputDir, 'README.md'), 'utf8'), 'ready-for-rehearsal', 'Production rehearsal substrate probe: README records ready state');
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function testProbeBlocksMissingRequiredInputsAndLocalRuntime(): Promise<void> {
  const env = baseEnv();
  delete env.ATTESTOR_RELEASE_AUTHORITY_PG_URL;
  env.ATTESTOR_RUNTIME_PROFILE = 'local-dev';

  const summary = await runProbe(env);

  equal(summary.readiness.passed, false, 'Production rehearsal substrate probe: missing env and local runtime block readiness');
  equal(summary.readiness.state, 'blocked-on-substrates', 'Production rehearsal substrate probe: blocked state is explicit');
  ok(summary.readiness.issues.some((issue) => issue.includes('ATTESTOR_RELEASE_AUTHORITY_PG_URL')), 'Production rehearsal substrate probe: missing release-authority PG URL is surfaced');
  ok(summary.readiness.issues.some((issue) => issue.includes('ATTESTOR_RUNTIME_PROFILE must be production-shared')), 'Production rehearsal substrate probe: local runtime is rejected');
}

async function testProbeBlocksFailedKubernetesConditions(): Promise<void> {
  const summary = await runProbe(baseEnv(), goodAdapters({
    kubernetesResource: async (request) => {
      if (request.kind === 'Certificate') {
        return {
          resource: {
            status: {
              conditions: [{ type: 'Ready', status: 'False', reason: 'Pending' }],
            },
          },
          error: null,
        };
      }
      if (request.kind === 'Gateway') {
        return {
          resource: readyResource('Accepted'),
          error: null,
        };
      }
      if (request.kind === 'HTTPRoute') return { resource: readyRoute(), error: null };
      return { resource: readyResource('Ready'), error: null };
    },
  }));

  equal(summary.readiness.passed, false, 'Production rehearsal substrate probe: failed Kubernetes readiness conditions block readiness');
  ok(summary.readiness.issues.some((issue) => issue.includes('gateway-ready')), 'Production rehearsal substrate probe: gateway condition failure is surfaced');
  ok(summary.readiness.issues.some((issue) => issue.includes('certificate-ready')), 'Production rehearsal substrate probe: certificate condition failure is surfaced');
}

async function testProbeBlocksHaAndObservabilityFailures(): Promise<void> {
  const summary = await runProbe(baseEnv(), goodAdapters({
    haPassed: false,
    observabilityPassed: false,
  }));

  equal(summary.readiness.passed, false, 'Production rehearsal substrate probe: HA and observability failures block readiness');
  ok(summary.readiness.issues.some((issue) => issue.includes('ha-runtime-connectivity')), 'Production rehearsal substrate probe: HA runtime failure is surfaced');
  ok(summary.readiness.issues.some((issue) => issue.includes('observability-receivers')), 'Production rehearsal substrate probe: observability failure is surfaced');
}

function testDocsAndPackageWireTheProbe(): void {
  const packageJson = JSON.parse(readProjectFile('package.json')) as {
    scripts: Record<string, string>;
  };
  const tracker = readProjectFile('docs', '02-architecture', 'production-rehearsal-buildout.md');
  const manifest = readProjectFile('docs', '08-deployment', 'production-rehearsal-manifest.example.json');

  equal(packageJson.scripts['probe:production-rehearsal-substrates'], 'tsx scripts/probe-production-rehearsal-substrates.ts', 'Production rehearsal substrate probe: package exposes the live substrate probe');
  equal(packageJson.scripts['test:production-rehearsal-substrate-probe'], 'tsx tests/production-rehearsal-substrate-probe.test.ts', 'Production rehearsal substrate probe: package exposes the probe test');
  includes(tracker, '| Completed | 6 |', 'Production rehearsal substrate probe: tracker marks six steps complete');
  includes(tracker, '| 05 | complete | Prove external substrate readiness |', 'Production rehearsal substrate probe: Step 05 is complete without renumbering');
  includes(tracker, 'Implement Step 07: rehearse queue, worker, and async recovery.', 'Production rehearsal substrate probe: immediate next step advances to Step 07');
  includes(manifest, 'npm run probe:production-rehearsal-substrates', 'Production rehearsal substrate probe: manifest command plan includes the substrate probe');
}

await testProbePassesWithAllExternalSubstratesReady();
await testProbeBlocksMissingRequiredInputsAndLocalRuntime();
await testProbeBlocksFailedKubernetesConditions();
await testProbeBlocksHaAndObservabilityFailures();
testDocsAndPackageWireTheProbe();

console.log(`production-rehearsal-substrate-probe.test.ts: ${passed} assertions passed`);
