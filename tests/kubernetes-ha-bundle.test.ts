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

function dnsName(...labels: string[]): string {
  return labels.join('.');
}

function main(): void {
  const kustomization = read('ops/kubernetes/ha/kustomization.yaml');
  const apiDeployment = read('ops/kubernetes/ha/api-deployment.yaml');
  const workerDeployment = read('ops/kubernetes/ha/worker-deployment.yaml');
  const workerServiceAccount = read('ops/kubernetes/ha/worker-serviceaccount.yaml');
  const runtimeConfigMap = read('ops/kubernetes/ha/configmap.yaml');
  const releasePkiPvc = read('ops/kubernetes/ha/release-runtime-pki-pvc.yaml');
  const networkPolicy = read('ops/kubernetes/ha/networkpolicy.yaml');
  const apiHpa = read('ops/kubernetes/ha/api-hpa.yaml');
  const workerHpa = read('ops/kubernetes/ha/worker-hpa.yaml');
  const gateway = read('ops/kubernetes/ha/gateway.yaml');
  const httpRoute = read('ops/kubernetes/ha/httproute.yaml');
  const apiPdb = read('ops/kubernetes/ha/api-pdb.yaml');
  const workerPdb = read('ops/kubernetes/ha/worker-pdb.yaml');
  const gkeOverlay = read('ops/kubernetes/ha/providers/gke/kustomization.yaml');
  const gkeReadme = read('ops/kubernetes/ha/providers/gke/README.md');
  const gkeHealthCheckPolicy = read('ops/kubernetes/ha/providers/gke/healthcheckpolicy.yaml');
  const gkeBackendPolicy = read('ops/kubernetes/ha/providers/gke/gcpbackendpolicy.yaml');
  const gkeBackendPolicyCloudArmor = read('ops/kubernetes/ha/providers/gke/gcpbackendpolicy.cloudarmor.example.yaml');
  const gkeGatewayPolicy = read('ops/kubernetes/ha/providers/gke/gcpgatewaypolicy.yaml');
  const gkeHttpsGateway = read('ops/kubernetes/ha/providers/gke/https-gateway.example.yaml');
  const gkeHttpsRoute = read('ops/kubernetes/ha/providers/gke/https-httproute.example.yaml');
  const awsOverlay = read('ops/kubernetes/ha/providers/aws/kustomization.yaml');
  const awsIngress = read('ops/kubernetes/ha/providers/aws/alb-ingress.yaml');
  const awsHttpsIngress = read('ops/kubernetes/ha/providers/aws/alb-ingress.https.example.yaml');
  const awsReadme = read('ops/kubernetes/ha/providers/aws/README.md');
  const providersReadme = read('ops/kubernetes/ha/providers/README.md');
  const kedaOverlay = read('ops/kubernetes/ha/providers/keda/kustomization.yaml');
  const kedaReadme = read('ops/kubernetes/ha/providers/keda/README.md');
  const apiScaledObject = read('ops/kubernetes/ha/providers/keda/api-scaledobject.yaml');
  const workerScaledObject = read('ops/kubernetes/ha/providers/keda/worker-scaledobject.yaml');
  const workerTriggerAuth = read('ops/kubernetes/ha/providers/keda/worker-triggerauthentication.yaml');
  const workerScaledObjectTls = read('ops/kubernetes/ha/providers/keda/worker-scaledobject.tls.example.yaml');
  const apiPrometheusTriggerAuth = read('ops/kubernetes/ha/providers/keda/api-prometheus-triggerauthentication.example.yaml');
  const certManagerOverlay = read('ops/kubernetes/ha/providers/cert-manager/kustomization.yaml');
  const certManagerReadme = read('ops/kubernetes/ha/providers/cert-manager/README.md');
  const certManagerCertificate = read('ops/kubernetes/ha/providers/cert-manager/certificate.yaml');
  const certManagerClusterIssuer = read('ops/kubernetes/ha/providers/cert-manager/clusterissuer.example.yaml');
  const externalSecretsOverlay = read('ops/kubernetes/ha/providers/external-secrets/kustomization.yaml');
  const externalSecretsReadme = read('ops/kubernetes/ha/providers/external-secrets/README.md');
  const gkeClusterSecretStoreExample = read('ops/kubernetes/ha/providers/external-secrets/clustersecretstore.gke.example.yaml');
  const externalRuntimeSecret = read('ops/kubernetes/ha/providers/external-secrets/runtime-secrets.yaml');
  const externalTlsSecret = read('ops/kubernetes/ha/providers/external-secrets/tls-secret.yaml');
  const profilesReadme = read('ops/kubernetes/ha/profiles/README.md');
  const releaseBundleScript = read('scripts/render/render-ha-release-bundle.ts');
  const releaseProbeScript = read('scripts/probe/probe-ha-release-inputs.ts');
  const promotionPacketScript = read('scripts/render/render-ha-promotion-packet.ts');
  const gkeDomainCutoverScript = read('scripts/render/render-gke-domain-cutover.ts');
  const awsProfile = read('ops/kubernetes/ha/profiles/aws-production.json');
  const gkeProfile = read('ops/kubernetes/ha/profiles/gke-production.json');
  const haReadme = read('ops/kubernetes/ha/README.md');
  const retiredScaleOverageEnv = ['ATTESTOR_STRIPE_OVERAGE_PRICE', 'SCALE'].join('_');

  ok(kustomization.includes('api-deployment.yaml') && kustomization.includes('worker-serviceaccount.yaml') && kustomization.includes('networkpolicy.yaml') && kustomization.includes('gateway.yaml') && kustomization.includes('release-runtime-pki-pvc.yaml'), 'Kubernetes HA bundle: kustomization includes deployments, worker ServiceAccount, NetworkPolicy, gateway, and shared release-runtime PKI resources');
  ok(apiDeployment.includes('ATTESTOR_HA_MODE') && apiDeployment.includes('ATTESTOR_CONTROL_PLANE_PG_URL'), 'Kubernetes HA bundle: API deployment enables HA mode and shared control-plane');
  ok(apiDeployment.includes('ATTESTOR_RELEASE_AUTHORITY_PG_URL') && apiDeployment.includes('release-authority-pg-url'), 'Kubernetes HA bundle: API deployment wires shared release-authority PostgreSQL');
  ok(apiDeployment.includes('ATTESTOR_STRIPE_PRICE_PILOT_WORKFLOW') && apiDeployment.includes('stripe-price-pilot-workflow'), 'Kubernetes HA bundle: API deployment wires Pilot Workflow Stripe price');
  ok(apiDeployment.includes('ATTESTOR_STRIPE_PRICE_STARTER_WORKFLOW') && apiDeployment.includes('ATTESTOR_STRIPE_PRICE_PRO_WORKFLOW'), 'Kubernetes HA bundle: API deployment wires Starter/Pro Workflow Stripe prices');
  ok(apiDeployment.includes('ATTESTOR_STRIPE_OVERAGE_PRICE_STARTER_WORKFLOW') && apiDeployment.includes('ATTESTOR_STRIPE_OVERAGE_PRICE_PRO_WORKFLOW') && !apiDeployment.includes(retiredScaleOverageEnv), 'Kubernetes HA bundle: API deployment wires workflow overage prices without Scale account-plan overage');
  ok(apiDeployment.includes('claimName: attestor-release-runtime-pki') && apiDeployment.includes('/var/lib/attestor/release-runtime-pki'), 'Kubernetes HA bundle: API deployment mounts a shared release-runtime PKI path');
  ok(releasePkiPvc.includes('ReadWriteMany'), 'Kubernetes HA bundle: release-runtime PKI PVC requires shared read/write access across API pods');
  ok(releasePkiPvc.includes('storageClassName: attestor-release-runtime-pki-rwx') && releasePkiPvc.includes('ATTESTOR_RELEASE_RUNTIME_PKI_STORAGE_PROOF'), 'Kubernetes HA bundle: release-runtime PKI PVC requires explicit storage class and live storage proof');
  ok(networkPolicy.includes('name: attestor-default-deny') && networkPolicy.includes('name: attestor-runtime-egress'), 'Kubernetes HA bundle: NetworkPolicy defines default deny and runtime egress allowlist');
  ok(networkPolicy.includes('port: 4318') && networkPolicy.includes('port: 3307') && networkPolicy.includes('port: 6379'), 'Kubernetes HA bundle: NetworkPolicy names observability, Cloud SQL proxy, and Redis egress ports');
  ok(apiDeployment.includes('readinessProbe:') && apiDeployment.includes('livenessProbe:'), 'Kubernetes HA bundle: API deployment defines readiness and liveness probes');
  ok(apiDeployment.includes('rollingUpdate:') && apiDeployment.includes('maxUnavailable: 0'), 'Kubernetes HA bundle: API deployment uses zero-downtime rolling update settings');
  ok(apiDeployment.includes('startupProbe:') && apiDeployment.includes('preStop:'), 'Kubernetes HA bundle: API deployment defines startup probe and preStop drain');
  ok(apiDeployment.includes('topologySpreadConstraints:') && apiDeployment.includes('podAntiAffinity:'), 'Kubernetes HA bundle: API deployment spreads replicas across nodes/zones');
  ok(apiDeployment.includes('seccompProfile:') && apiDeployment.includes('type: RuntimeDefault'), 'Kubernetes HA bundle: API pod uses the runtime-default seccomp profile');
  ok(apiDeployment.includes('allowPrivilegeEscalation: false') && apiDeployment.includes('runAsNonRoot: true') && apiDeployment.includes('drop:') && apiDeployment.includes('ALL'), 'Kubernetes HA bundle: API containers drop Linux capabilities and disallow privilege escalation');
  ok(apiDeployment.includes('account-mfa-encryption-key') && !apiDeployment.includes('key: account-mfa-encryption-key\n                  optional: true'), 'Kubernetes HA bundle: hosted MFA encryption key is required by the API manifest');
  ok(workerDeployment.includes('ATTESTOR_HA_MODE') && workerDeployment.includes('REDIS_URL'), 'Kubernetes HA bundle: worker deployment requires shared Redis and HA mode');
  ok(kustomization.includes('worker-serviceaccount.yaml') && workerServiceAccount.includes('name: attestor-worker-runtime') && workerServiceAccount.includes('automountServiceAccountToken: false'), 'Kubernetes HA bundle: worker has an explicit no-token ServiceAccount');
  ok(workerDeployment.includes('serviceAccountName: attestor-worker-runtime') && workerDeployment.includes('automountServiceAccountToken: false'), 'Kubernetes HA bundle: worker does not run under the default ServiceAccount');
  ok(workerDeployment.includes('ATTESTOR_WORKER_HEALTH_PORT') && workerDeployment.includes('readinessProbe:') && workerDeployment.includes('livenessProbe:'), 'Kubernetes HA bundle: worker deployment exposes health/readiness probes');
  ok(workerDeployment.includes('OTEL_SERVICE_NAME') && workerDeployment.includes('attestor-worker'), 'Kubernetes HA bundle: worker deployment overrides OTLP service naming so worker traces stay distinct from the API');
  ok(workerDeployment.includes('topologySpreadConstraints:') && workerDeployment.includes('podAntiAffinity:'), 'Kubernetes HA bundle: worker deployment spreads replicas across nodes/zones');
  ok(workerDeployment.includes('seccompProfile:') && workerDeployment.includes('allowPrivilegeEscalation: false') && workerDeployment.includes('runAsNonRoot: true'), 'Kubernetes HA bundle: worker uses baseline pod/container security context');
  ok(runtimeConfigMap.includes('OTEL_EXPORTER_OTLP_ENDPOINT') && runtimeConfigMap.includes('attestor-observability-receiver.attestor-observability.svc.cluster.local:4318'), 'Kubernetes HA bundle: runtime configmap points applications at the in-cluster Alloy OTLP HTTP receiver');
  ok(runtimeConfigMap.includes('ATTESTOR_RUNTIME_PROFILE') && runtimeConfigMap.includes('production-shared'), 'Kubernetes HA bundle: runtime configmap selects the production-shared profile');
  ok(runtimeConfigMap.includes('ATTESTOR_RELEASE_RUNTIME_PKI_PATH') && runtimeConfigMap.includes('ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH'), 'Kubernetes HA bundle: runtime configmap declares the shared release-runtime PKI boundary');
  ok(apiHpa.includes('behavior:') && workerHpa.includes('behavior:'), 'Kubernetes HA bundle: HPAs include scale behaviors');
  ok(apiHpa.includes('memory') && workerHpa.includes('memory'), 'Kubernetes HA bundle: HPAs scale on memory as well as CPU');
  ok(apiPdb.includes('PodDisruptionBudget') && workerPdb.includes('PodDisruptionBudget'), 'Kubernetes HA bundle: PDBs exist for API and worker');
  ok(gateway.includes('Gateway') && gateway.includes('gke-l7-global-external-managed') && gateway.includes('NamedAddress'), 'Kubernetes HA bundle: Gateway API bootstrap uses the GKE global external Gateway with a named address');
  ok(httpRoute.includes('HTTPRoute') && httpRoute.includes('sectionName: http') && !httpRoute.includes('sectionName: https'), 'Kubernetes HA bundle: base HTTPRoute only targets the bootstrap HTTP listener');
  ok(httpRoute.includes('backendRefs:') && httpRoute.includes('attestor-api'), 'Kubernetes HA bundle: HTTPRoute forwards to attestor-api service');
  ok(gkeOverlay.includes('../../'), 'Kubernetes HA bundle: GKE managed LB overlay composes the base bundle');
  ok(gkeReadme.includes('render:gke-domain-cutover') && gkeReadme.includes(dnsName('sslip', 'io')) && gkeReadme.includes('A` record'), 'Kubernetes HA bundle: GKE README documents bootstrap dynamic DNS and final delegated-domain cutover flow');
  ok(gkeHealthCheckPolicy.includes('HealthCheckPolicy') && gkeHealthCheckPolicy.includes('/api/v1/ready'), 'Kubernetes HA bundle: GKE overlay defines managed health check policy');
  ok(gkeBackendPolicy.includes('GCPBackendPolicy') && gkeBackendPolicy.includes('connectionDraining') && gkeBackendPolicy.includes('securityPolicy: attestor-api-armor-policy'), 'Kubernetes HA bundle: GKE overlay defines backend timeout/draining defaults and active Cloud Armor policy reference');
  ok(gkeBackendPolicyCloudArmor.includes('securityPolicy: attestor-api-armor-policy'), 'Kubernetes HA bundle: GKE Cloud Armor example overlays the backend security policy when quota exists');
  ok(gkeGatewayPolicy.includes('GCPGatewayPolicy') && gkeGatewayPolicy.includes('sslPolicy') && !gkeGatewayPolicy.includes('allowGlobalAccess'), 'Kubernetes HA bundle: GKE overlay defines gateway TLS policy without relying on unsupported global-access fields');
  ok(gkeHttpsGateway.includes('protocol: HTTPS') && gkeHttpsGateway.includes('attestor-tls') && gkeHttpsGateway.includes(dnsName('attestor', 'example', 'com')), 'Kubernetes HA bundle: GKE HTTPS example finalizes TLS with the attestor-tls Secret and public hostname');
  ok(gkeHttpsRoute.includes('RequestRedirect') && gkeHttpsRoute.includes('sectionName: http') && gkeHttpsRoute.includes('sectionName: https'), 'Kubernetes HA bundle: GKE HTTPS route example redirects HTTP and serves HTTPS traffic');
  ok(awsOverlay.includes('../../'), 'Kubernetes HA bundle: AWS managed LB overlay composes the base bundle');
  ok(awsIngress.includes('alb.ingress.kubernetes.io/healthcheck-path') && awsIngress.includes('/api/v1/ready'), 'Kubernetes HA bundle: AWS overlay defines ALB health checks');
  ok(awsIngress.includes('alb.ingress.kubernetes.io/target-group-attributes') && awsIngress.includes('least_outstanding_requests'), 'Kubernetes HA bundle: AWS overlay tunes target-group draining and load balancing');
  ok(awsHttpsIngress.includes('alb.ingress.kubernetes.io/listen-ports: \'[{"HTTP":80},{"HTTPS":443}]\'') && awsHttpsIngress.includes('alb.ingress.kubernetes.io/ssl-redirect: "443"'), 'Kubernetes HA bundle: AWS HTTPS example defines HTTPS listener and HTTP redirect');
  ok(awsHttpsIngress.includes('alb.ingress.kubernetes.io/certificate-arn: REPLACE_WITH_ACM_CERTIFICATE_ARN') && awsHttpsIngress.includes('alb.ingress.kubernetes.io/wafv2-acl-arn: REPLACE_WITH_AWS_WAFV2_WEB_ACL_ARN'), 'Kubernetes HA bundle: AWS HTTPS example requires ACM certificate and WAFv2 placeholders');
  ok(awsReadme.includes('ATTESTOR_LIVE_SHADOW_HTTPS_PROOF') && awsReadme.includes('ATTESTOR_EDGE_WAF_PROOF'), 'Kubernetes HA bundle: AWS README documents HTTPS and WAF live proof gates');
  ok(providersReadme.includes('Azure / AKS is intentionally out of scope') && providersReadme.includes('Do not claim AKS parity'), 'Kubernetes HA bundle: provider README records the AKS accepted limitation');
  ok(kedaOverlay.includes('api-scaledobject.yaml') && kedaOverlay.includes('worker-scaledobject.yaml'), 'Kubernetes HA bundle: KEDA overlay composes workload-aware scaled objects');
  ok(kedaReadme.includes('providers/keda') && kedaReadme.includes('redis-address'), 'Kubernetes HA bundle: KEDA README documents rollout and Redis secret requirements');
  ok(kedaReadme.includes('ATTESTOR_KEDA_REDIS_TLS_PROOF') && kedaReadme.includes('ATTESTOR_KEDA_PROMETHEUS_AUTH_PROOF'), 'Kubernetes HA bundle: KEDA README documents Redis TLS and Prometheus auth proof gates');
  ok(apiScaledObject.includes('type: prometheus') && apiScaledObject.includes('attestor_http_requests_total'), 'Kubernetes HA bundle: API KEDA scaler uses Prometheus request-rate telemetry');
  ok(workerScaledObject.includes('type: redis-lists') && workerScaledObject.includes('bull:attestor-pipeline:wait'), 'Kubernetes HA bundle: worker KEDA scaler uses BullMQ waiting-list backlog');
  ok(workerTriggerAuth.includes('TriggerAuthentication') && workerTriggerAuth.includes('redis-address') && workerTriggerAuth.includes('redis-password'), 'Kubernetes HA bundle: worker KEDA scaler authenticates against Redis secrets');
  ok(workerScaledObjectTls.includes('enableTLS: "true"') && workerScaledObjectTls.includes('unsafeSsl: "false"'), 'Kubernetes HA bundle: KEDA Redis TLS example keeps TLS-on posture explicit');
  ok(apiPrometheusTriggerAuth.includes('kind: TriggerAuthentication') && apiPrometheusTriggerAuth.includes('bearerToken'), 'Kubernetes HA bundle: KEDA Prometheus auth example ships bearer-token TriggerAuthentication');
  ok(certManagerOverlay.includes('../../') && certManagerOverlay.includes('certificate.yaml'), 'Kubernetes HA bundle: cert-manager overlay composes certificate resource');
  ok(certManagerReadme.includes('cert-manager') && certManagerReadme.includes('ClusterIssuer') && certManagerReadme.includes('gatewayHTTPRoute.parentRefs') && certManagerReadme.includes('ATTESTOR_TLS_MATERIAL_SOURCE_PROOF'), 'Kubernetes HA bundle: cert-manager README documents Gateway API issuer requirements and TLS source proof');
  ok(certManagerCertificate.includes('kind: Certificate') && certManagerCertificate.includes('secretName: attestor-tls'), 'Kubernetes HA bundle: cert-manager overlay issues the Gateway TLS secret');
  ok(certManagerClusterIssuer.includes('kind: ClusterIssuer') && certManagerClusterIssuer.includes('gatewayHTTPRoute') && certManagerClusterIssuer.includes('name: attestor'), 'Kubernetes HA bundle: cert-manager example ships a Gateway API HTTP-01 ClusterIssuer');
  ok(externalSecretsOverlay.includes('../../') && externalSecretsOverlay.includes('runtime-secrets.yaml'), 'Kubernetes HA bundle: external-secrets overlay composes runtime secret resources');
  ok(externalSecretsReadme.includes('External Secrets Operator') && externalSecretsReadme.includes('ClusterSecretStore') && externalSecretsReadme.includes('render:ha-credentials') && externalSecretsReadme.includes('ATTESTOR_TLS_MATERIAL_SOURCE_PROOF'), 'Kubernetes HA bundle: external-secrets README documents cluster secret store requirements, renderer flow, and TLS source proof');
  ok(gkeClusterSecretStoreExample.includes('kind: ClusterSecretStore') && gkeClusterSecretStoreExample.includes('gcpsm:') && gkeClusterSecretStoreExample.includes('workloadIdentity:'), 'Kubernetes HA bundle: GKE ClusterSecretStore example binds External Secrets to Google Secret Manager with Workload Identity');
  ok(externalRuntimeSecret.includes('kind: ExternalSecret') && externalRuntimeSecret.includes('attestor-runtime-secrets'), 'Kubernetes HA bundle: external-secrets overlay manages runtime secret material');
  ok(externalRuntimeSecret.includes('release-authority-pg-url'), 'Kubernetes HA bundle: external-secrets overlay includes release-authority PostgreSQL');
  ok(externalRuntimeSecret.includes('stripe-price-pilot-workflow') && externalRuntimeSecret.includes('stripe-price-starter-workflow') && externalRuntimeSecret.includes('stripe-price-pro-workflow'), 'Kubernetes HA bundle: external-secrets overlay includes workflow Stripe prices');
  ok(externalRuntimeSecret.includes('stripe-overage-price-starter-workflow') && externalRuntimeSecret.includes('stripe-overage-price-pro-workflow') && !externalRuntimeSecret.includes('stripe-overage-price-scale'), 'Kubernetes HA bundle: external-secrets overlay includes workflow overage prices without Scale account-plan overage');
  ok(externalTlsSecret.includes('kubernetes.io/tls') && externalTlsSecret.includes('attestor-tls'), 'Kubernetes HA bundle: external-secrets overlay can project TLS material');
  ok(profilesReadme.includes('render:ha-profile') && profilesReadme.includes('aws-production.json') && profilesReadme.includes('Renderers always emit artifacts'), 'Kubernetes HA bundle: profiles README documents benchmark-to-profile tuning and emit-on-fail boundary');
  ok(releaseBundleScript.includes('render-ha-profile.ts') && releaseBundleScript.includes('render-ha-credentials.ts'), 'Kubernetes HA bundle: release bundle renderer composes scaling and credential artifacts');
  ok(gkeDomainCutoverScript.includes('https-gateway.example.yaml') && gkeDomainCutoverScript.includes('clusterissuer.example.yaml') && gkeDomainCutoverScript.includes('summary.json'), 'Kubernetes HA bundle: final-domain cutover renderer composes GKE Gateway and cert-manager manifests into a DNS handoff bundle');
  ok(releaseProbeScript.includes('render-ha-release-bundle.ts') && releaseProbeScript.includes('ATTESTOR_CONTROL_PLANE_PG_URL') && releaseProbeScript.includes('ATTESTOR_BILLING_LEDGER_PG_URL') && releaseProbeScript.includes('ATTESTOR_RELEASE_AUTHORITY_PG_URL') && releaseProbeScript.includes('ATTESTOR_RELEASE_RUNTIME_PKI_SHARED_PATH'), 'Kubernetes HA bundle: release input probe validates shared-state envs, shared PKI, and final bundle render');
  ok(promotionPacketScript.includes('ready-for-environment-promotion') && promotionPacketScript.includes('probeHaReleaseInputs') && promotionPacketScript.includes('release-bundle'), 'Kubernetes HA bundle: promotion packet script collapses HA readiness and release handoff into one checkpoint');
  ok(awsProfile.includes('"provider": "aws"') && awsProfile.includes('"availabilityTarget": 0.995'), 'Kubernetes HA bundle: AWS calibration profile ships production SLO defaults');
  ok(gkeProfile.includes('"provider": "gke"') && gkeProfile.includes('"timeoutLatencyMultiplier": 6'), 'Kubernetes HA bundle: GKE calibration profile ships backend timeout tuning defaults');
  ok(haReadme.includes('attestor-gateway-ip') && haReadme.includes('https-gateway.example.yaml') && haReadme.includes('https-httproute.example.yaml') && haReadme.includes(dnsName('sslip', 'io')) && haReadme.includes('render:ha-credentials') && haReadme.includes('render:ha-release-bundle') && haReadme.includes('probe:ha-release-inputs'), 'Kubernetes HA bundle: README documents static-address Gateway bootstrap, hostname-aware HTTPS finalization, and renderer-driven release wiring');
  ok(haReadme.includes('not a live-shadow or production ingress contract') && haReadme.includes('digest-pinned image refs'), 'Kubernetes HA bundle: README separates HTTP bootstrap from live-shadow HTTPS and digest-pinned release requirements');

  console.log(`\nKubernetes HA bundle tests: ${passed} passed, 0 failed`);
}

try {
  main();
} catch (error) {
  console.error('\nKubernetes HA bundle tests failed.');
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
