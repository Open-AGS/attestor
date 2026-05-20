import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;

function ok(condition: unknown, message: string): void {
  assert.ok(condition, message);
  passed += 1;
}

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8');
}

function main(): void {
  const prometheus = read('ops/observability/prometheus/prometheus.yml');
  const alertmanager = read('ops/observability/alertmanager/alertmanager.yml');
  const alerts = read('ops/observability/prometheus/alerts.yml');
  const loki = read('ops/observability/loki/loki.yml');
  const collector = read('ops/otel/collector-config.yaml');
  const k8sCollector = read('ops/kubernetes/observability/configmap.yaml');
  const grafanaCloudCollector = read('ops/kubernetes/observability/providers/grafana-cloud/patch-configmap.yaml');
  const grafanaAlloyCollector = read('ops/kubernetes/observability/providers/grafana-alloy/patch-configmap.yaml');
  const compose = read('docker-compose.observability.yml');
  const credentialsRenderer = read('scripts/render-observability-credentials.ts');
  const readme = read('ops/observability/README.md');

  ok(
    prometheus.includes('credentials_file: /etc/prometheus/secrets/metrics-api-key')
      && !prometheus.includes('credentials: metrics-secret'),
    'OPS-26: Prometheus uses a mounted credentials file, not a committed bearer literal',
  );
  ok(
    compose.includes('prometheus-metrics-token:/etc/prometheus/secrets/metrics-api-key:ro')
      && credentialsRenderer.includes('prometheus-metrics-token'),
    'OPS-26: local compose and renderer agree on the Prometheus token file contract',
  );

  ok(
    alertmanager.includes('url_file: /etc/alertmanager/secrets/default-webhook-url')
      && alertmanager.includes('url_file: /etc/alertmanager/secrets/critical-webhook-url')
      && alertmanager.includes('url_file: /etc/alertmanager/secrets/warning-webhook-url'),
    'OPS-25: static Alertmanager config no longer routes to empty severity receivers',
  );
  ok(
    alertmanager.includes('team="security"')
      && alertmanager.includes('receiver: security')
      && alertmanager.includes('team="billing"')
      && alertmanager.includes('receiver: billing'),
    'OPS-25/30: Alertmanager carries security and billing escalation routes',
  );

  ok(
    alerts.includes('AttestorAdminAuthFailure')
      && alerts.includes('AttestorSecurityRejectionSpike')
      && alerts.includes('AttestorWebhookSignatureInvalid')
      && alerts.includes('team: security'),
    'OPS-30: security event alerts are present',
  );
  ok(
    alerts.includes('AttestorBudgetTelemetryMissing')
      && alerts.includes('attestor_cloud_budget_usage_ratio')
      && alerts.includes('team: billing'),
    'OPS-35: budget telemetry absence is visible before live shadow claims',
  );

  ok(loki.includes('auth_enabled: true'), 'OPS-27: local Loki tenant auth is enabled');
  ok(
    loki.includes('retention_period: ${ATTESTOR_OBSERVABILITY_LOKI_RETENTION_PERIOD}')
      && compose.includes('-config.expand-env=true'),
    'OPS-31: Loki retention is profile/env driven',
  );
  ok(
    collector.includes('X-Scope-OrgID: ${LOKI_TENANT_ID}')
      && k8sCollector.includes('X-Scope-OrgID: ${LOKI_TENANT_ID}'),
    'OPS-27: OTel Loki writes include a tenant header',
  );
  ok(
    collector.includes('insecure: ${TEMPO_OTLP_INSECURE}')
      && collector.includes('insecure: ${LOKI_OTLP_INSECURE}')
      && k8sCollector.includes('insecure: ${TEMPO_OTLP_INSECURE}')
      && k8sCollector.includes('insecure: ${LOKI_OTLP_INSECURE}'),
    'OPS-28/29: collector backend TLS posture is explicit and env-controlled',
  );
  ok(
    !k8sCollector.includes('detectors: [env, system]')
      && !grafanaCloudCollector.includes('detectors: [env, system]')
      && !grafanaAlloyCollector.includes('detectors: [env, system]')
      && k8sCollector.includes('detectors: [system]'),
    'OPS-34: Kubernetes collector configs do not use the env resource detector',
  );
  ok(
    readme.includes('Prometheus bearer-token file')
      && readme.includes('Production storage, encryption-at-rest, and backup/restore evidence remain live ops proof')
      && readme.includes('collector-to-Loki/Tempo traffic defaults to in-cluster plaintext behind NetworkPolicy'),
    'OPS-32/33: local storage and plaintext telemetry limitations are documented without overclaim',
  );

  console.log(`\nOps Sweep 03 observability remediation tests: ${passed} passed, 0 failed`);
}

try {
  main();
} catch (error) {
  console.error('\nOps Sweep 03 observability remediation tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
