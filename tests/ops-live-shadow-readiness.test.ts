import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function run(mode: 'repo' | 'live', env: NodeJS.ProcessEnv = process.env, stage?: string) {
  return spawnSync(
    process.execPath,
    ['scripts/check-ops-live-shadow-readiness.mjs', `--mode=${mode}`, ...(stage ? [`--stage=${stage}`] : [])],
    {
      cwd: resolve('.'),
      encoding: 'utf8',
      env,
    },
  );
}

function main(): void {
  const liveShadowProofs = [
    'ATTESTOR_LIVE_SHADOW_HTTPS_PROOF',
    'ATTESTOR_CLUSTER_SECRET_STORE_PROOF',
    'ATTESTOR_NETWORK_POLICY_PROOF',
    'ATTESTOR_EDGE_WAF_PROOF',
    'ATTESTOR_GCP_IAM_LEAST_PRIVILEGE_PROOF',
    'ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF',
    'ATTESTOR_TLS_MATERIAL_SOURCE_PROOF',
    'ATTESTOR_OBSERVABILITY_ALERT_DELIVERY_PROOF',
    'ATTESTOR_OBSERVABILITY_BACKEND_AUTH_PROOF',
    'ATTESTOR_OBSERVABILITY_STORAGE_PROOF',
    'ATTESTOR_BUDGET_ALERTING_PROOF',
    'ATTESTOR_SHARED_REPLAY_STORE_PROOF',
    'ATTESTOR_POSTGRES_PITR_OFFSITE_PROOF',
    'ATTESTOR_REDIS_AUTH_BOUNDARY_PROOF',
    'ATTESTOR_OBSERVABILITY_POD_SECURITY_PROOF',
    'ATTESTOR_ADMIN_ACTOR_ROLE_SPLIT_PROOF',
    'ATTESTOR_ADMIN_RATE_LIMIT_PROOF',
    'ATTESTOR_STRIPE_WEBHOOK_PROOF',
    'ATTESTOR_SENDGRID_EVENT_WEBHOOK_PROOF',
    'ATTESTOR_MAILGUN_WEBHOOK_PROOF',
    'ATTESTOR_EMAIL_WEBHOOK_REPLAY_STORE_PROOF',
    'ATTESTOR_FEDERATED_CALLBACK_RATE_LIMIT_PROOF',
    'ATTESTOR_ACCOUNT_MUTATION_AUDIT_CHAIN_PROOF',
    'ATTESTOR_SHARED_AUTH_ABUSE_STORE_PROOF',
    'ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF',
    'ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF',
    'ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF',
    'ATTESTOR_KEDA_REDIS_TLS_PROOF',
    'ATTESTOR_KEDA_PROMETHEUS_AUTH_PROOF',
  ] as const;
  const limitedEnforcementProofs = [
    'ATTESTOR_SHARED_INTROSPECTION_STORE_PROOF',
    'ATTESTOR_CUSTOMER_PEP_NO_BYPASS_PROOF',
    'ATTESTOR_KMS_RUNTIME_SIGNING_PROOF',
    'ATTESTOR_DEGRADED_MODE_OUTAGE_PROOF',
  ] as const;

  const repo = run('repo');
  ok(repo.status === 0, `ops live-shadow repo gate passes\nstdout:\n${repo.stdout}\nstderr:\n${repo.stderr}`);
  ok(repo.stdout.includes('repo readiness check passed'), 'ops live-shadow repo gate reports success');

  const liveMissing = run('live', { ...process.env });
  ok(liveMissing.status !== 0, 'ops live-shadow live gate fails without live proof flags');
  for (const proof of liveShadowProofs) {
    ok(liveMissing.stderr.includes(proof), `ops live-shadow live gate requires ${proof}`);
  }
  for (const proof of limitedEnforcementProofs) {
    ok(!liveMissing.stderr.includes(proof), `ops live-shadow default stage does not require ${proof}`);
  }

  const liveReadyEnv = {
    ...process.env,
    ...Object.fromEntries(liveShadowProofs.map((proof) => [proof, 'verified'])),
  };
  const liveReady = run('live', liveReadyEnv);
  ok(liveReady.status === 0, `ops live-shadow live gate passes with proof flags\nstdout:\n${liveReady.stdout}\nstderr:\n${liveReady.stderr}`);
  ok(liveReady.stdout.includes('live readiness check passed'), 'ops live-shadow live gate reports success');

  const limitedMissing = run('live', liveReadyEnv, 'limited-enforcement');
  ok(limitedMissing.status !== 0, 'ops live-shadow limited-enforcement stage fails without limited proof flags');
  for (const proof of limitedEnforcementProofs) {
    ok(limitedMissing.stderr.includes(proof), `ops live-shadow limited-enforcement gate requires ${proof}`);
  }

  const limitedReady = run('live', {
    ...liveReadyEnv,
    ...Object.fromEntries(limitedEnforcementProofs.map((proof) => [proof, 'verified'])),
  }, 'limited-enforcement');
  ok(limitedReady.status === 0, `ops live-shadow limited-enforcement gate passes with cumulative proof flags\nstdout:\n${limitedReady.stdout}\nstderr:\n${limitedReady.stderr}`);

  console.log(`Ops live-shadow readiness tests: ${passed} passed, 0 failed`);
}

try {
  main();
} catch (error) {
  console.error('\nOps live-shadow readiness tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
