import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8').replace(/\r\n/gu, '\n');
}

function deploymentEnvValue(deployment: string, name: string): string | null {
  const lines = deployment.split(/\r?\n/u);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index]?.trim() === `- name: ${name}`) {
      const valueLine = lines[index + 1]?.trim() ?? '';
      return valueLine.startsWith('value: ') ? valueLine.slice('value: '.length) : null;
    }
  }
  return null;
}

function main(): void {
  const deployment = read('ops/kubernetes/observability/deployment.yaml');
  const observabilityReadme = read('ops/kubernetes/observability/README.md');
  const redisConfig = read('ops/redis/redis-recovery.conf');
  const redisReadme = read('ops/redis/README.md');
  const drCompose = read('docker-compose.dr.yml');
  const postgresConfig = read('ops/postgres/pitr/postgresql-pitr.conf');
  const archiveWal = read('ops/postgres/pitr/archive-wal.sh');
  const restoreWal = read('ops/postgres/pitr/restore-wal.sh');
  const postgresReadme = read('ops/postgres/pitr/README.md');
  const backupDr = read('docs/08-deployment/backup-restore-dr.md');
  const readinessGate = read('scripts/check/check-ops-live-shadow-readiness.mjs');
  const findingIndex = read('docs/audit/finding-index.md');
  const reportIndex = read('docs/audit/report-index.md');
  const liveProofRegister = read('docs/audit/live-proof-register.md');
  const controlMap = read('docs/audit/control-map.md');
  const remediation = read('docs/audit/ops-sweep-04-storage-collector-remediation.md');

  ok(
    deployment.includes('otel/opentelemetry-collector-contrib:0.152.0@sha256:')
      && !deployment.includes('otel/opentelemetry-collector-contrib:latest'),
    'OPS-38: OTel collector image remains versioned and digest pinned',
  );
  ok(
    deployment.includes('seccompProfile:')
      && deployment.includes('allowPrivilegeEscalation: false')
      && deployment.includes('readOnlyRootFilesystem: true')
      && deployment.includes('drop:\n                - ALL'),
    'OPS-41: OTel collector deployment has pod/container securityContext hardening',
  );
  ok(
    deployment.includes('automountServiceAccountToken: true')
      && observabilityReadme.includes('Kubernetes attributes processor uses'),
    'OPS-45: Kubernetes metadata token dependency is explicit and documented',
  );
  ok(
    deploymentEnvValue(deployment, 'TEMPO_OTLP_ENDPOINT') === 'tempo.attestor-observability.svc.cluster.local:4317'
      && deploymentEnvValue(deployment, 'LOKI_OTLP_ENDPOINT') === 'http://loki.attestor-observability.svc.cluster.local:3100/otlp'
      && observabilityReadme.includes('namespace-scoped NetworkPolicy proof'),
    'OPS-44: base Tempo/Loki endpoints are namespace-aligned and documented',
  );

  ok(
    redisConfig.includes('protected-mode yes')
      && !redisConfig.includes('protected-mode no')
      && redisConfig.includes('aclfile /run/redis/users.acl'),
    'OPS-39: Redis recovery config uses protected mode plus ACL file',
  );
  ok(
    redisConfig.includes('rename-command FLUSHALL ""')
      && redisConfig.includes('rename-command FLUSHDB ""')
      && redisConfig.includes('rename-command CONFIG ""'),
    'OPS-39: Redis recovery config disables high-risk administrative commands',
  );
  ok(
    drCompose.includes('user default off')
      && drCompose.includes('user attestor on')
      && drCompose.includes('ATTESTOR_REDIS_DR_PASSWORD: ${ATTESTOR_REDIS_DR_PASSWORD:-attestor-dr-local}')
      && drCompose.includes('redis://attestor:${ATTESTOR_REDIS_DR_PASSWORD:-attestor-dr-local}@redis-dr:6379')
      && redisReadme.includes('default user disabled'),
    'OPS-39: DR compose and docs wire authenticated Redis access',
  );

  ok(
    postgresConfig.includes("archive_command = 'sh /etc/postgresql/archive-wal.sh %p %f'")
      && postgresConfig.includes("restore_command = 'sh /etc/postgresql/restore-wal.sh %f %p'"),
    'OPS-40: PostgreSQL PITR config uses explicit archive and restore helpers',
  );
  ok(
    archiveWal.includes('ATTESTOR_PG_WAL_OFFSITE_ARCHIVE_DIR')
      && archiveWal.includes('ATTESTOR_PG_WAL_OFFSITE_REQUIRED')
      && archiveWal.includes('sha256sum "$wal_file"'),
    'OPS-40/OPS-42: archive helper supports offsite fail-closed mode and checksum sidecars',
  );
  ok(
    restoreWal.includes('ATTESTOR_PG_WAL_REQUIRE_CHECKSUM')
      && restoreWal.includes('sha256sum -c')
      && restoreWal.includes('Missing WAL checksum'),
    'OPS-42: restore helper verifies checksum sidecars before copying WAL',
  );
  ok(
    postgresReadme.includes('ATTESTOR_PG_WAL_OFFSITE_REQUIRED=true')
      && backupDr.includes('ATTESTOR_PG_WAL_OFFSITE_REQUIRED=true'),
    'OPS-40: PITR docs keep offsite WAL proof explicit',
  );

  ok(
    readinessGate.includes('OPS-39')
      && readinessGate.includes('OPS-40')
      && readinessGate.includes('OPS-41')
      && readinessGate.includes('OPS-44'),
    'OPS-SWEEP-04: live-shadow readiness gate indexes storage and collector remediation',
  );
  ok(
    findingIndex.includes('OPS-39 Redis recovery auth')
      && findingIndex.includes('OPS-40 PostgreSQL PITR local WAL archive')
      && findingIndex.includes('OPS-41 OTel collector securityContext'),
    'OPS-SWEEP-04: finding index reconciles Redis, PITR, and collector findings',
  );
  ok(
    reportIndex.includes('OPS-SWEEP-04')
      && liveProofRegister.includes('LP-POSTGRES-PITR-OFFSITE')
      && liveProofRegister.includes('LP-REDIS-AUTH-BOUNDARY')
      && controlMap.includes('PITR/Redis recovery'),
    'OPS-SWEEP-04: report, live proof, and control map indexes include storage recovery boundaries',
  );
  ok(
    remediation.includes('OPS-38')
      && remediation.includes('stale/closed')
      && remediation.includes('does not prove production PITR')
      && remediation.includes('does not prove live Redis network isolation'),
    'OPS-SWEEP-04: remediation doc keeps stale findings and no-overclaim boundaries explicit',
  );

  console.log(`\nOps Sweep 04 storage/collector remediation tests: ${passed} passed, 0 failed`);
}

try {
  main();
} catch (error) {
  console.error('\nOps Sweep 04 storage/collector remediation tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
