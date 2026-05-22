#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

const FILES = Object.freeze({
  kustomization: 'ops/kubernetes/ha/kustomization.yaml',
  apiDeployment: 'ops/kubernetes/ha/api-deployment.yaml',
  workerDeployment: 'ops/kubernetes/ha/worker-deployment.yaml',
  workerServiceAccount: 'ops/kubernetes/ha/worker-serviceaccount.yaml',
  releaseRuntimePkiPvc: 'ops/kubernetes/ha/release-runtime-pki-pvc.yaml',
  networkPolicy: 'ops/kubernetes/ha/networkpolicy.yaml',
  backendPolicy: 'ops/kubernetes/ha/providers/gke/gcpbackendpolicy.yaml',
  awsOverlay: 'ops/kubernetes/ha/providers/aws/kustomization.yaml',
  awsIngress: 'ops/kubernetes/ha/providers/aws/alb-ingress.yaml',
  awsHttpsIngressExample: 'ops/kubernetes/ha/providers/aws/alb-ingress.https.example.yaml',
  awsReadme: 'ops/kubernetes/ha/providers/aws/README.md',
  kedaKustomization: 'ops/kubernetes/ha/providers/keda/kustomization.yaml',
  kedaReadme: 'ops/kubernetes/ha/providers/keda/README.md',
  kedaApiScaledObject: 'ops/kubernetes/ha/providers/keda/api-scaledobject.yaml',
  kedaWorkerScaledObject: 'ops/kubernetes/ha/providers/keda/worker-scaledobject.yaml',
  kedaWorkerTriggerAuthentication: 'ops/kubernetes/ha/providers/keda/worker-triggerauthentication.yaml',
  kedaWorkerScaledObjectTlsExample: 'ops/kubernetes/ha/providers/keda/worker-scaledobject.tls.example.yaml',
  kedaPrometheusTriggerAuthenticationExample: 'ops/kubernetes/ha/providers/keda/api-prometheus-triggerauthentication.example.yaml',
  certManagerReadme: 'ops/kubernetes/ha/providers/cert-manager/README.md',
  certManagerKustomization: 'ops/kubernetes/ha/providers/cert-manager/kustomization.yaml',
  certManagerCertificate: 'ops/kubernetes/ha/providers/cert-manager/certificate.yaml',
  externalSecretsReadme: 'ops/kubernetes/ha/providers/external-secrets/README.md',
  externalSecretsKustomization: 'ops/kubernetes/ha/providers/external-secrets/kustomization.yaml',
  externalSecretsTlsSecret: 'ops/kubernetes/ha/providers/external-secrets/tls-secret.yaml',
  gkeClusterSecretStoreExample: 'ops/kubernetes/ha/providers/external-secrets/clustersecretstore.gke.example.yaml',
  releaseProbe: 'scripts/probe-ha-release-inputs.ts',
  releaseBundle: 'scripts/render-ha-release-bundle.ts',
  observabilityReadme: 'ops/observability/README.md',
  observabilityDeployment: 'ops/kubernetes/observability/deployment.yaml',
  observabilityKubernetesReadme: 'ops/kubernetes/observability/README.md',
  observabilityNamespace: 'ops/kubernetes/observability/namespace.yaml',
  observabilityKustomization: 'ops/kubernetes/observability/kustomization.yaml',
  observabilityNetworkPolicy: 'ops/kubernetes/observability/networkpolicy.yaml',
  prometheusConfig: 'ops/observability/prometheus/prometheus.yml',
  prometheusAlerts: 'ops/observability/prometheus/alerts.yml',
  alertmanagerConfig: 'ops/observability/alertmanager/alertmanager.yml',
  lokiConfig: 'ops/observability/loki/loki.yml',
  localOtelConfig: 'ops/otel/collector-config.yaml',
  observabilityConfigmap: 'ops/kubernetes/observability/configmap.yaml',
  redisRecoveryConfig: 'ops/redis/redis-recovery.conf',
  redisRecoveryReadme: 'ops/redis/README.md',
  drCompose: 'docker-compose.dr.yml',
  postgresPitrConfig: 'ops/postgres/pitr/postgresql-pitr.conf',
  postgresArchiveWal: 'ops/postgres/pitr/archive-wal.sh',
  postgresRestoreWal: 'ops/postgres/pitr/restore-wal.sh',
  postgresPitrReadme: 'ops/postgres/pitr/README.md',
  backupRestoreDr: 'docs/08-deployment/backup-restore-dr.md',
  remediation: 'docs/audit/ops-sweep-01-live-shadow-remediation.md',
  sweep02Remediation: 'docs/audit/ops-sweep-02-pki-tls-secrets-remediation.md',
  sweep03Remediation: 'docs/audit/ops-sweep-03-observability-remediation.md',
  sweep04Remediation: 'docs/audit/ops-sweep-04-storage-collector-remediation.md',
});

const LIVE_PROOF_STAGE_ORDER = Object.freeze([
  'live-shadow',
  'limited-enforcement',
  'enterprise-pilot',
]);

const LIVE_PROOF_FLAGS = Object.freeze([
  { name: 'ATTESTOR_LIVE_SHADOW_HTTPS_PROOF', minStage: 'live-shadow', description: 'HTTPS Gateway/route was applied and probed with an https:// public URL.' },
  { name: 'ATTESTOR_CLUSTER_SECRET_STORE_PROOF', minStage: 'live-shadow', description: 'ClusterSecretStore backend and ExternalSecret sync were verified.' },
  { name: 'ATTESTOR_NETWORK_POLICY_PROOF', minStage: 'live-shadow', description: 'NetworkPolicy or equivalent cluster isolation was applied and tested.' },
  { name: 'ATTESTOR_EDGE_WAF_PROOF', minStage: 'live-shadow', description: 'Cloud Armor, AWS WAFv2, or equivalent edge WAF/rate-limit policy was attached and tested.' },
  { name: 'ATTESTOR_GCP_IAM_LEAST_PRIVILEGE_PROOF', minStage: 'live-shadow', description: 'GCP IAM least-privilege bindings were reviewed and verified when GKE/GCP providers are in use.' },
  { name: 'ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF', minStage: 'live-shadow', description: 'Release-runtime PKI storage class, encryption, RWX semantics, and backup posture were verified.' },
  { name: 'ATTESTOR_TLS_MATERIAL_SOURCE_PROOF', minStage: 'live-shadow', description: 'Exactly one TLS material source was selected, applied, and verified.' },
  { name: 'ATTESTOR_OBSERVABILITY_ALERT_DELIVERY_PROOF', minStage: 'live-shadow', description: 'Alertmanager warning, critical, security, billing, and Watchdog routes were delivered or intentionally routed in the live environment.' },
  { name: 'ATTESTOR_OBSERVABILITY_BACKEND_AUTH_PROOF', minStage: 'live-shadow', description: 'Observability backend auth, tenant header behavior, and cluster/network access were verified.' },
  { name: 'ATTESTOR_OBSERVABILITY_STORAGE_PROOF', minStage: 'live-shadow', description: 'Loki/Tempo storage, retention, encryption-at-rest, and backup boundaries were verified.' },
  { name: 'ATTESTOR_BUDGET_ALERTING_PROOF', minStage: 'live-shadow', description: 'Cloud budget telemetry and alert delivery were verified.' },
  { name: 'ATTESTOR_SHARED_REPLAY_STORE_PROOF', minStage: 'live-shadow', description: 'Multi-instance replay and nonce rejection were verified against the shared replay store.' },
  { name: 'ATTESTOR_POSTGRES_PITR_OFFSITE_PROOF', minStage: 'live-shadow', description: 'PostgreSQL base backup, offsite WAL archive, checksum verification, encryption-at-rest, and restore drill were verified.' },
  { name: 'ATTESTOR_REDIS_AUTH_BOUNDARY_PROOF', minStage: 'live-shadow', description: 'Redis ACL/password policy, network isolation, secret rotation, and restart behavior were verified.' },
  { name: 'ATTESTOR_OBSERVABILITY_POD_SECURITY_PROOF', minStage: 'live-shadow', description: 'Pod Security Admission or equivalent runtime enforcement was verified for the observability collector.' },
  { name: 'ATTESTOR_ADMIN_ACTOR_ROLE_SPLIT_PROOF', minStage: 'live-shadow', description: 'Live admin deployment uses role-scoped keys and audit records show distinct actor labels and roles.' },
  { name: 'ATTESTOR_ADMIN_RATE_LIMIT_PROOF', minStage: 'live-shadow', description: 'Admin abuse probe shows over-limit requests receive 429 before expensive admin credential comparison.' },
  { name: 'ATTESTOR_STRIPE_WEBHOOK_PROOF', minStage: 'live-shadow', description: 'Stripe webhook endpoint, signing secret, and fake-signature rejection were verified against the live route.' },
  { name: 'ATTESTOR_SENDGRID_EVENT_WEBHOOK_PROOF', minStage: 'live-shadow', description: 'SendGrid signed event webhook public key, endpoint binding, and fake-signature rejection were verified against the live route.' },
  { name: 'ATTESTOR_MAILGUN_WEBHOOK_PROOF', minStage: 'live-shadow', description: 'Mailgun webhook signing key, endpoint binding, and fake-signature rejection were verified against the live route.' },
  { name: 'ATTESTOR_EMAIL_WEBHOOK_REPLAY_STORE_PROOF', minStage: 'live-shadow', description: 'Email provider webhook replay/idempotency behavior was verified against shared control-plane storage across instances.' },
  { name: 'ATTESTOR_FEDERATED_CALLBACK_RATE_LIMIT_PROOF', minStage: 'live-shadow', description: 'Federated OIDC/SAML callback abuse probes return 429 before expensive callback verification while legitimate IdP retries still pass.' },
  { name: 'ATTESTOR_ACCOUNT_MUTATION_AUDIT_CHAIN_PROOF', minStage: 'live-shadow', description: 'Account-session mutations write hash-linked audit records through shared storage with account actor attribution.' },
  { name: 'ATTESTOR_SHARED_AUTH_ABUSE_STORE_PROOF', minStage: 'live-shadow', description: 'Auth abuse buckets are backed by shared Redis state across API replicas and cannot be bypassed per instance.' },
  { name: 'ATTESTOR_PIPELINE_IDEMPOTENCY_PROOF', minStage: 'live-shadow', description: 'Pipeline run/run-async idempotency was verified across retries and shared control-plane storage.' },
  { name: 'ATTESTOR_SHADOW_MUTATION_AUDIT_CHAIN_PROOF', minStage: 'live-shadow', description: 'Shadow POST/PATCH mutations write hash-linked audit records through shared storage with tenant-context actor attribution.' },
  { name: 'ATTESTOR_RELEASE_ROUTE_ROLE_ENFORCEMENT_PROOF', minStage: 'live-shadow', description: 'Release-review and release-policy-control routes reject role escalation attempts across deployed role-scoped admin keys.' },
  { name: 'ATTESTOR_HEALTH_DIAGNOSTIC_SPLIT_PROOF', minStage: 'live-shadow', description: 'Public health/ready probes expose only the minimal unauthenticated response through the deployed edge path.' },
  { name: 'ATTESTOR_VERIFY_RATE_LIMIT_PROOF', minStage: 'live-shadow', description: 'Public /api/v1/verify abuse probes return 429 before expensive verification work through the deployed edge path.' },
  { name: 'ATTESTOR_KEDA_REDIS_TLS_PROOF', minStage: 'live-shadow', description: 'KEDA Redis scaler TLS posture was matched to the runtime Redis endpoint and verified when KEDA is enabled.' },
  { name: 'ATTESTOR_KEDA_PROMETHEUS_AUTH_PROOF', minStage: 'live-shadow', description: 'KEDA Prometheus scaler authentication and namespace/network boundary were verified when KEDA is enabled.' },
  { name: 'ATTESTOR_SHARED_INTROSPECTION_STORE_PROOF', minStage: 'limited-enforcement', description: 'Introspection cache/store behavior was verified under restart, outage, and stale-token scenarios.' },
  { name: 'ATTESTOR_CUSTOMER_PEP_NO_BYPASS_PROOF', minStage: 'limited-enforcement', description: 'Reference customer PEP integration rejects direct downstream bypass attempts.' },
  { name: 'ATTESTOR_KMS_RUNTIME_SIGNING_PROOF', minStage: 'limited-enforcement', description: 'KMS/HSM-backed runtime signing and key identity were verified without raw private key export.' },
  { name: 'ATTESTOR_DEGRADED_MODE_OUTAGE_PROOF', minStage: 'limited-enforcement', description: 'Provider/Redis/Vault/DB outage behavior was verified as fail-closed or bounded break-glass with TTL/audit trail.' },
]);

function arg(name, fallback) {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n');
}

function includes(path, expected, issues, message) {
  const body = read(path);
  if (!body.includes(expected)) {
    issues.push(`${path}: ${message}`);
  }
}

function notIncludesNear(path, anchor, forbidden, issues, message) {
  const body = read(path);
  const index = body.indexOf(anchor);
  if (index < 0) {
    issues.push(`${path}: missing ${anchor}`);
    return;
  }
  const window = body.slice(index, index + 260);
  if (window.includes(forbidden)) {
    issues.push(`${path}: ${message}`);
  }
}

function envTruthy(name) {
  return /^(1|true|yes|on|verified)$/iu.test(process.env[name] ?? '');
}

function stageRank(stage) {
  return LIVE_PROOF_STAGE_ORDER.indexOf(stage);
}

function proofFlagsForStage(stage) {
  const requestedRank = stageRank(stage);
  return LIVE_PROOF_FLAGS.filter((flag) => stageRank(flag.minStage) <= requestedRank);
}

function requireFile(path, issues) {
  if (!existsSync(join(ROOT, path))) {
    issues.push(`${path}: file is missing`);
  }
}

function checkRepoReadiness() {
  const issues = [];
  for (const path of Object.values(FILES)) {
    requireFile(path, issues);
  }
  if (issues.length > 0) return issues;

  includes(FILES.kustomization, 'worker-serviceaccount.yaml', issues, 'worker ServiceAccount must be part of the HA bundle');
  includes(FILES.kustomization, 'networkpolicy.yaml', issues, 'NetworkPolicy must be part of the HA bundle');

  includes(FILES.workerServiceAccount, 'name: attestor-worker-runtime', issues, 'explicit worker ServiceAccount is required');
  includes(FILES.workerServiceAccount, 'automountServiceAccountToken: false', issues, 'worker ServiceAccount token automount must be disabled');
  includes(FILES.workerDeployment, 'serviceAccountName: attestor-worker-runtime', issues, 'worker must not use the default ServiceAccount');
  includes(FILES.workerDeployment, 'automountServiceAccountToken: false', issues, 'worker pod token automount must be disabled');

  includes(FILES.apiDeployment, 'seccompProfile:', issues, 'API pod must declare seccomp profile');
  includes(FILES.workerDeployment, 'seccompProfile:', issues, 'worker pod must declare seccomp profile');
  includes(FILES.apiDeployment, 'allowPrivilegeEscalation: false', issues, 'API containers must disallow privilege escalation');
  includes(FILES.workerDeployment, 'allowPrivilegeEscalation: false', issues, 'worker container must disallow privilege escalation');
  includes(FILES.apiDeployment, 'runAsNonRoot: true', issues, 'API containers must run as non-root');
  includes(FILES.workerDeployment, 'runAsNonRoot: true', issues, 'worker container must run as non-root');
  includes(FILES.apiDeployment, 'drop:\n                - ALL', issues, 'API containers must drop Linux capabilities');
  includes(FILES.workerDeployment, 'drop:\n                - ALL', issues, 'worker container must drop Linux capabilities');

  includes(FILES.releaseRuntimePkiPvc, 'attestor.dev/storage-boundary: release-runtime-pki', issues, 'release-runtime PKI PVC must be labeled as a key-material storage boundary');
  includes(FILES.releaseRuntimePkiPvc, 'attestor.dev/live-shadow-proof: ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF', issues, 'release-runtime PKI PVC must name the live storage proof gate');
  includes(FILES.releaseRuntimePkiPvc, 'storageClassName: attestor-release-runtime-pki-rwx', issues, 'release-runtime PKI PVC must not silently inherit the cluster default StorageClass');
  includes(FILES.releaseRuntimePkiPvc, 'ReadWriteMany', issues, 'release-runtime PKI PVC must keep explicit RWX semantics for HA');
  includes(FILES.releaseProbe, 'ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_CLASS', issues, 'release probe must require an explicit release-runtime PKI StorageClass');
  includes(FILES.releaseBundle, 'ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_CLASS', issues, 'release bundle render must inject an explicit release-runtime PKI StorageClass');

  notIncludesNear(
    FILES.apiDeployment,
    'key: account-mfa-encryption-key',
    'optional: true',
    issues,
    'account MFA encryption key must not be optional in HA API deployment',
  );

  includes(FILES.networkPolicy, 'kind: NetworkPolicy', issues, 'NetworkPolicy resources must be defined');
  includes(FILES.networkPolicy, 'name: attestor-default-deny', issues, 'default-deny NetworkPolicy is required');
  includes(FILES.networkPolicy, 'name: attestor-runtime-egress', issues, 'runtime egress NetworkPolicy is required');
  includes(FILES.networkPolicy, 'port: 4318', issues, 'observability egress must be explicit');
  includes(FILES.networkPolicy, 'port: 3307', issues, 'Cloud SQL proxy egress must be explicit');
  includes(FILES.networkPolicy, 'port: 6379', issues, 'Redis egress must be explicit');
  includes(FILES.networkPolicy, 'port: 443', issues, 'external HTTPS egress must stay explicit');

  includes(FILES.backendPolicy, 'securityPolicy: attestor-api-armor-policy', issues, 'active GKE backend policy must reference Cloud Armor');
  includes(FILES.awsOverlay, '../../', issues, 'AWS managed LB overlay must compose the base bundle');
  includes(FILES.awsIngress, 'alb.ingress.kubernetes.io/healthcheck-path', issues, 'AWS ALB overlay must define health checks');
  includes(FILES.awsIngress, 'alb.ingress.kubernetes.io/target-group-attributes', issues, 'AWS ALB overlay must keep target-group tuning');
  includes(FILES.awsHttpsIngressExample, 'alb.ingress.kubernetes.io/listen-ports: \'[{"HTTP":80},{"HTTPS":443}]\'', issues, 'AWS HTTPS example must declare HTTP and HTTPS listeners');
  includes(FILES.awsHttpsIngressExample, 'alb.ingress.kubernetes.io/ssl-redirect: "443"', issues, 'AWS HTTPS example must redirect cleartext HTTP to HTTPS');
  includes(FILES.awsHttpsIngressExample, 'alb.ingress.kubernetes.io/certificate-arn: REPLACE_WITH_ACM_CERTIFICATE_ARN', issues, 'AWS HTTPS example must require an ACM certificate ARN');
  includes(FILES.awsHttpsIngressExample, 'alb.ingress.kubernetes.io/wafv2-acl-arn: REPLACE_WITH_AWS_WAFV2_WEB_ACL_ARN', issues, 'AWS HTTPS example must show the WAFv2 association contract');
  includes(FILES.awsReadme, 'ATTESTOR_EDGE_WAF_PROOF', issues, 'AWS provider docs must name the edge WAF live proof gate');
  includes(FILES.awsReadme, 'ATTESTOR_LIVE_SHADOW_HTTPS_PROOF', issues, 'AWS provider docs must name the HTTPS live proof gate');
  includes(FILES.kedaKustomization, 'api-scaledobject.yaml', issues, 'KEDA overlay must compose API scaler');
  includes(FILES.kedaKustomization, 'worker-scaledobject.yaml', issues, 'KEDA overlay must compose worker scaler');
  includes(FILES.kedaReadme, 'redis-address', issues, 'KEDA docs must document Redis scaler secret requirements');
  includes(FILES.kedaReadme, 'ATTESTOR_KEDA_REDIS_TLS_PROOF', issues, 'KEDA docs must name the Redis TLS proof gate');
  includes(FILES.kedaReadme, 'ATTESTOR_KEDA_PROMETHEUS_AUTH_PROOF', issues, 'KEDA docs must name the Prometheus auth proof gate');
  includes(FILES.kedaApiScaledObject, 'type: prometheus', issues, 'KEDA API scaler must use Prometheus');
  includes(FILES.kedaWorkerScaledObject, 'type: redis-lists', issues, 'KEDA worker scaler must use Redis lists');
  includes(FILES.kedaWorkerTriggerAuthentication, 'redis-password', issues, 'KEDA worker scaler must authenticate with Redis secret material');
  includes(FILES.kedaWorkerScaledObjectTlsExample, 'enableTLS: "true"', issues, 'KEDA Redis TLS example must allow TLS-on runtime parity');
  includes(FILES.kedaPrometheusTriggerAuthenticationExample, 'kind: TriggerAuthentication', issues, 'KEDA Prometheus auth example must ship a TriggerAuthentication');
  includes(FILES.kedaPrometheusTriggerAuthenticationExample, 'bearerToken', issues, 'KEDA Prometheus auth example must support bearer-token auth');

  includes(FILES.certManagerKustomization, 'certificate.yaml', issues, 'cert-manager overlay must compose the Certificate resource');
  includes(FILES.certManagerCertificate, 'secretName: attestor-tls', issues, 'cert-manager Certificate must target the Gateway TLS Secret');
  includes(FILES.certManagerReadme, 'Do not apply this overlay together with the External Secrets TLS overlay', issues, 'cert-manager docs must enforce a single TLS material source');
  includes(FILES.certManagerReadme, 'ATTESTOR_TLS_MATERIAL_SOURCE_PROOF', issues, 'cert-manager docs must name the live TLS material proof gate');
  includes(FILES.externalSecretsKustomization, 'tls-secret.yaml', issues, 'External Secrets overlay must compose TLS projection explicitly');
  includes(FILES.externalSecretsTlsSecret, 'kubernetes.io/tls', issues, 'External Secrets TLS projection must create a Kubernetes TLS Secret');
  includes(FILES.externalSecretsReadme, 'Do not apply this TLS ExternalSecret together with the cert-manager overlay', issues, 'External Secrets docs must enforce a single TLS material source');
  includes(FILES.externalSecretsReadme, 'ATTESTOR_TLS_MATERIAL_SOURCE_PROOF', issues, 'External Secrets docs must name the live TLS material proof gate');
  includes(FILES.gkeClusterSecretStoreExample, 'kind: ClusterSecretStore', issues, 'GKE ClusterSecretStore example is required');
  includes(FILES.gkeClusterSecretStoreExample, 'gcpsm:', issues, 'GKE ClusterSecretStore example must use Google Secret Manager');
  includes(FILES.gkeClusterSecretStoreExample, 'workloadIdentity:', issues, 'GKE ClusterSecretStore example must use Workload Identity');
  includes(FILES.externalSecretsReadme, 'check:ops-live-shadow', issues, 'External Secrets docs must point to the live-shadow gate');

  includes(FILES.releaseProbe, 'immutable image digest', issues, 'release probe must reject tag-only image refs');
  includes(FILES.releaseBundle, 'immutable image digest', issues, 'release bundle render must reject tag-only image refs in production mode');
  includes(FILES.releaseBundle, 'sectionName: https', issues, 'GKE release bundle render must target HTTPS listener');

  includes(FILES.prometheusConfig, 'credentials_file: /etc/prometheus/secrets/metrics-api-key', issues, 'Prometheus must use a mounted metrics-token credentials file');
  includes(FILES.alertmanagerConfig, 'url_file: /etc/alertmanager/secrets/default-webhook-url', issues, 'Alertmanager default receiver must not be empty');
  includes(FILES.alertmanagerConfig, 'team="security"', issues, 'Alertmanager must route security-team alerts');
  includes(FILES.alertmanagerConfig, 'team="billing"', issues, 'Alertmanager must route billing-team alerts');
  includes(FILES.prometheusAlerts, 'AttestorAdminAuthFailure', issues, 'Prometheus must alert on admin authentication failures');
  includes(FILES.prometheusAlerts, 'AttestorSecurityRejectionSpike', issues, 'Prometheus must alert on security-relevant rejection spikes');
  includes(FILES.prometheusAlerts, 'AttestorWebhookSignatureInvalid', issues, 'Prometheus must alert on invalid webhook signatures');
  includes(FILES.prometheusAlerts, 'AttestorBudgetTelemetryMissing', issues, 'Prometheus must make missing budget telemetry visible');
  includes(FILES.prometheusAlerts, 'AttestorAvailabilityErrorBudgetFastBurn', issues, 'Prometheus must include fast burn-rate SLO availability alerts');
  includes(FILES.prometheusAlerts, 'AttestorLatencyErrorBudgetFastBurn', issues, 'Prometheus must include fast burn-rate SLO latency alerts');
  includes(FILES.lokiConfig, 'auth_enabled: true', issues, 'local Loki must require tenant auth');
  includes(FILES.lokiConfig, 'ATTESTOR_OBSERVABILITY_LOKI_RETENTION_PERIOD', issues, 'Loki retention must be profile/env driven');
  includes(FILES.localOtelConfig, 'X-Scope-OrgID: ${LOKI_TENANT_ID}', issues, 'local OTel to Loki writes must carry a tenant header');
  includes(FILES.observabilityConfigmap, 'X-Scope-OrgID: ${LOKI_TENANT_ID}', issues, 'Kubernetes OTel to Loki writes must carry a tenant header');
  includes(FILES.localOtelConfig, 'insecure: ${TEMPO_OTLP_INSECURE}', issues, 'local Tempo TLS posture must be env-controlled');
  includes(FILES.localOtelConfig, 'insecure: ${LOKI_OTLP_INSECURE}', issues, 'local Loki TLS posture must be env-controlled');
  includes(FILES.observabilityConfigmap, 'detectors: [system]', issues, 'Kubernetes collector must avoid env resource detector leakage');
  includes(FILES.observabilityReadme, 'Prometheus bearer-token file', issues, 'observability docs must document the Prometheus token-file contract');
  includes(FILES.observabilityReadme, 'Production storage, encryption-at-rest, and backup/restore evidence remain live ops proof', issues, 'observability docs must keep storage limitations explicit');
  includes(FILES.observabilityDeployment, 'otel/opentelemetry-collector-contrib:0.152.0@sha256:', issues, 'observability collector image must be versioned and digest pinned');
  includes(FILES.observabilityDeployment, 'seccompProfile:', issues, 'observability collector pod must declare seccomp profile');
  includes(FILES.observabilityDeployment, 'allowPrivilegeEscalation: false', issues, 'observability collector must disallow privilege escalation');
  includes(FILES.observabilityDeployment, 'readOnlyRootFilesystem: true', issues, 'observability collector must use a read-only root filesystem');
  includes(FILES.observabilityDeployment, 'drop:\n                - ALL', issues, 'observability collector must drop Linux capabilities');
  includes(FILES.observabilityDeployment, 'automountServiceAccountToken: true', issues, 'observability collector must make the Kubernetes metadata token dependency explicit');
  includes(FILES.observabilityDeployment, 'tempo.attestor-observability.svc.cluster.local:4317', issues, 'base observability deployment must keep Tempo endpoint namespace-aligned');
  includes(FILES.observabilityDeployment, 'http://loki.attestor-observability.svc.cluster.local:3100/otlp', issues, 'base observability deployment must keep Loki endpoint namespace-aligned');
  includes(FILES.observabilityNamespace, 'pod-security.kubernetes.io/enforce: restricted', issues, 'observability namespace must enforce the restricted Pod Security Standard');
  includes(FILES.observabilityNamespace, 'pod-security.kubernetes.io/audit: restricted', issues, 'observability namespace must audit against the restricted Pod Security Standard');
  includes(FILES.observabilityNamespace, 'pod-security.kubernetes.io/warn: restricted', issues, 'observability namespace must warn against the restricted Pod Security Standard');
  includes(FILES.observabilityKustomization, 'networkpolicy.yaml', issues, 'observability NetworkPolicy must be part of the Kubernetes observability bundle');
  includes(FILES.observabilityNetworkPolicy, 'name: attestor-otel-gateway-default-deny', issues, 'observability namespace must carry a collector default-deny NetworkPolicy');
  includes(FILES.observabilityNetworkPolicy, 'name: attestor-otel-gateway-ingress', issues, 'observability namespace must carry explicit collector ingress allowlist');
  includes(FILES.observabilityNetworkPolicy, 'name: attestor-otel-gateway-egress', issues, 'observability namespace must carry explicit collector egress allowlist');
  includes(FILES.observabilityNetworkPolicy, 'port: 4317', issues, 'observability NetworkPolicy must allow OTLP gRPC intentionally');
  includes(FILES.observabilityNetworkPolicy, 'port: 4318', issues, 'observability NetworkPolicy must allow OTLP HTTP intentionally');
  includes(FILES.observabilityNetworkPolicy, 'port: 8889', issues, 'observability NetworkPolicy must allow collector metrics intentionally');
  includes(FILES.observabilityNetworkPolicy, 'port: 3100', issues, 'observability NetworkPolicy must allow local Loki OTLP HTTP intentionally');
  includes(FILES.observabilityNetworkPolicy, 'port: 443', issues, 'observability NetworkPolicy must keep managed backend and Kubernetes API HTTPS egress explicit');
  includes(FILES.observabilityKubernetesReadme, 'Kubernetes attributes processor uses', issues, 'observability Kubernetes docs must document why the ServiceAccount token is intentionally mounted');
  includes(FILES.observabilityKubernetesReadme, 'namespace-scoped NetworkPolicy proof', issues, 'observability Kubernetes docs must document endpoint namespace alignment');

  includes(FILES.redisRecoveryConfig, 'protected-mode yes', issues, 'Redis recovery config must keep protected mode enabled');
  includes(FILES.redisRecoveryConfig, 'aclfile /run/redis/users.acl', issues, 'Redis recovery config must require an ACL file');
  includes(FILES.redisRecoveryConfig, 'rename-command FLUSHALL ""', issues, 'Redis recovery config must disable FLUSHALL');
  includes(FILES.redisRecoveryConfig, 'rename-command CONFIG ""', issues, 'Redis recovery config must disable CONFIG');
  includes(FILES.redisRecoveryReadme, 'default user disabled', issues, 'Redis docs must document the ACL boundary');
  includes(FILES.drCompose, 'user default off', issues, 'DR compose must generate an ACL file with the default Redis user disabled');
  includes(FILES.drCompose, 'ATTESTOR_REDIS_DR_PASSWORD: ${ATTESTOR_REDIS_DR_PASSWORD:-attestor-dr-local}', issues, 'DR compose must pass Redis DR password env into the Redis container');
  includes(FILES.drCompose, 'redis://attestor:${ATTESTOR_REDIS_DR_PASSWORD:-attestor-dr-local}@redis-dr:6379', issues, 'DR compose must wire API and worker to authenticated Redis URLs');

  includes(FILES.postgresPitrConfig, 'archive_command = \'sh /etc/postgresql/archive-wal.sh %p %f\'', issues, 'PostgreSQL PITR config must use the archive helper');
  includes(FILES.postgresPitrConfig, 'restore_command = \'sh /etc/postgresql/restore-wal.sh %f %p\'', issues, 'PostgreSQL PITR config must use the restore helper through sh');
  includes(FILES.postgresArchiveWal, 'ATTESTOR_PG_WAL_OFFSITE_ARCHIVE_DIR', issues, 'PostgreSQL WAL archive helper must support an offsite archive path');
  includes(FILES.postgresArchiveWal, 'sha256sum "$wal_file"', issues, 'PostgreSQL WAL archive helper must write checksum sidecars');
  includes(FILES.postgresRestoreWal, 'sha256sum -c', issues, 'PostgreSQL WAL restore helper must verify checksum sidecars');
  includes(FILES.postgresPitrReadme, 'ATTESTOR_PG_WAL_OFFSITE_REQUIRED=true', issues, 'PostgreSQL PITR docs must document fail-closed offsite archive mode');
  includes(FILES.backupRestoreDr, 'ATTESTOR_PG_WAL_OFFSITE_REQUIRED=true', issues, 'Backup/DR docs must keep offsite WAL proof explicit');

  includes(FILES.remediation, 'OPS-02', issues, 'remediation record must account for ClusterSecretStore finding');
  includes(FILES.remediation, 'OPS-04', issues, 'remediation record must account for NetworkPolicy finding');
  includes(FILES.remediation, 'OPS-05', issues, 'remediation record must account for CloudArmor finding');
  includes(FILES.sweep02Remediation, 'OPS-17', issues, 'Sweep 02 remediation record must account for release-runtime PKI storage');
  includes(FILES.sweep02Remediation, 'OPS-18', issues, 'Sweep 02 remediation record must account for TLS material source selection');
  includes(FILES.sweep02Remediation, 'OPS-21', issues, 'Sweep 02 remediation record must account for wildcard HTTPS egress');
  includes(FILES.sweep03Remediation, 'OPS-25', issues, 'Sweep 03 remediation record must account for Alertmanager receiver routing');
  includes(FILES.sweep03Remediation, 'OPS-26', issues, 'Sweep 03 remediation record must account for Prometheus token-file auth');
  includes(FILES.sweep03Remediation, 'OPS-30', issues, 'Sweep 03 remediation record must account for security event alerts');
  includes(FILES.sweep04Remediation, 'OPS-39', issues, 'Sweep 04 remediation record must account for Redis auth hardening');
  includes(FILES.sweep04Remediation, 'OPS-40', issues, 'Sweep 04 remediation record must account for PostgreSQL PITR offsite/checksum boundary');
  includes(FILES.sweep04Remediation, 'OPS-41', issues, 'Sweep 04 remediation record must account for observability collector securityContext');
  includes(FILES.sweep04Remediation, 'OPS-44', issues, 'Sweep 04 remediation record must account for observability endpoint namespace alignment');

  return issues;
}

function checkLiveProofs(stage) {
  const issues = checkRepoReadiness();
  for (const { name, description, minStage } of proofFlagsForStage(stage)) {
    if (!envTruthy(name)) {
      issues.push(`${name}: missing ${stage} live proof (minimum stage: ${minStage}). ${description}`);
    }
  }
  return issues;
}

function main() {
  const mode = arg('mode', 'repo');
  if (!['repo', 'live'].includes(mode)) {
    throw new Error('--mode must be repo or live');
  }
  const stage = arg('stage', 'live-shadow');
  if (!LIVE_PROOF_STAGE_ORDER.includes(stage)) {
    throw new Error(`--stage must be one of: ${LIVE_PROOF_STAGE_ORDER.join(', ')}`);
  }

  const issues = mode === 'live' ? checkLiveProofs(stage) : checkRepoReadiness();
  if (issues.length > 0) {
    console.error(`Ops live-shadow ${mode} readiness check failed${mode === 'live' ? ` for ${stage} stage` : ''}:`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log(`Ops live-shadow ${mode} readiness check passed${mode === 'live' ? ` for ${stage} stage` : ''}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
