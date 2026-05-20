import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function run(mode: 'repo' | 'live', env: NodeJS.ProcessEnv = process.env) {
  return spawnSync(
    process.execPath,
    ['scripts/check-ops-live-shadow-readiness.mjs', `--mode=${mode}`],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env,
    },
  );
}

function main(): void {
  const repo = run('repo');
  ok(repo.status === 0, `ops live-shadow repo gate passes\nstdout:\n${repo.stdout}\nstderr:\n${repo.stderr}`);
  ok(repo.stdout.includes('repo readiness check passed'), 'ops live-shadow repo gate reports success');

  const liveMissing = run('live', { ...process.env });
  ok(liveMissing.status !== 0, 'ops live-shadow live gate fails without live proof flags');
  ok(liveMissing.stderr.includes('ATTESTOR_LIVE_SHADOW_HTTPS_PROOF'), 'ops live-shadow live gate requires HTTPS proof');
  ok(liveMissing.stderr.includes('ATTESTOR_CLUSTER_SECRET_STORE_PROOF'), 'ops live-shadow live gate requires ClusterSecretStore proof');
  ok(liveMissing.stderr.includes('ATTESTOR_NETWORK_POLICY_PROOF'), 'ops live-shadow live gate requires NetworkPolicy proof');
  ok(liveMissing.stderr.includes('ATTESTOR_EDGE_WAF_PROOF'), 'ops live-shadow live gate requires edge WAF proof');
  ok(liveMissing.stderr.includes('ATTESTOR_GCP_IAM_LEAST_PRIVILEGE_PROOF'), 'ops live-shadow live gate requires IAM proof');
  ok(liveMissing.stderr.includes('ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF'), 'ops live-shadow live gate requires release-runtime PKI storage proof');
  ok(liveMissing.stderr.includes('ATTESTOR_TLS_MATERIAL_SOURCE_PROOF'), 'ops live-shadow live gate requires TLS material source proof');
  ok(liveMissing.stderr.includes('ATTESTOR_OBSERVABILITY_ALERT_DELIVERY_PROOF'), 'ops live-shadow live gate requires observability alert delivery proof');
  ok(liveMissing.stderr.includes('ATTESTOR_OBSERVABILITY_BACKEND_AUTH_PROOF'), 'ops live-shadow live gate requires observability backend auth proof');
  ok(liveMissing.stderr.includes('ATTESTOR_OBSERVABILITY_STORAGE_PROOF'), 'ops live-shadow live gate requires observability storage proof');
  ok(liveMissing.stderr.includes('ATTESTOR_BUDGET_ALERTING_PROOF'), 'ops live-shadow live gate requires budget alerting proof');

  const liveReady = run('live', {
    ...process.env,
    ATTESTOR_LIVE_SHADOW_HTTPS_PROOF: 'verified',
    ATTESTOR_CLUSTER_SECRET_STORE_PROOF: 'verified',
    ATTESTOR_NETWORK_POLICY_PROOF: 'verified',
    ATTESTOR_EDGE_WAF_PROOF: 'verified',
    ATTESTOR_GCP_IAM_LEAST_PRIVILEGE_PROOF: 'verified',
    ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF: 'verified',
    ATTESTOR_TLS_MATERIAL_SOURCE_PROOF: 'verified',
    ATTESTOR_OBSERVABILITY_ALERT_DELIVERY_PROOF: 'verified',
    ATTESTOR_OBSERVABILITY_BACKEND_AUTH_PROOF: 'verified',
    ATTESTOR_OBSERVABILITY_STORAGE_PROOF: 'verified',
    ATTESTOR_BUDGET_ALERTING_PROOF: 'verified',
  });
  ok(liveReady.status === 0, `ops live-shadow live gate passes with proof flags\nstdout:\n${liveReady.stdout}\nstderr:\n${liveReady.stderr}`);
  ok(liveReady.stdout.includes('live readiness check passed'), 'ops live-shadow live gate reports success');

  console.log(`Ops live-shadow readiness tests: ${passed} passed, 0 failed`);
}

try {
  main();
} catch (error) {
  console.error('\nOps live-shadow readiness tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
