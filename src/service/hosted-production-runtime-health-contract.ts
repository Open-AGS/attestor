export const HOSTED_PRODUCTION_RUNTIME_HEALTH_CONTRACT_VERSION =
  'attestor.hosted-production-runtime-health-contract.v1';

export type HostedProductionRuntimeHealthSurface =
  | 'api_process_health'
  | 'api_dependency_readiness'
  | 'worker_process_health'
  | 'async_queue_runtime'
  | 'storage_authority_runtime'
  | 'webhook_ingress_runtime'
  | 'degraded_mode_runtime';

export type HostedProductionRuntimeHealthRisk =
  | 'liveness_depends_on_external_substrate'
  | 'readiness_overclaims_runtime'
  | 'startup_routes_traffic_too_early'
  | 'worker_accepts_jobs_while_draining'
  | 'queue_accepts_unbounded_work'
  | 'storage_path_not_shared'
  | 'webhook_accepts_unverifiable_events'
  | 'degraded_mode_hidden'
  | 'health_endpoint_leaks_secret';

export type HostedProductionRuntimeHealthControl =
  | 'liveness_process_only'
  | 'startup_bootstrap_separate_from_readiness'
  | 'readiness_dependency_gate'
  | 'ready_returns_503_on_blockers'
  | 'runtime_profile_explicit_in_production_like_env'
  | 'release_runtime_durability_gate'
  | 'production_storage_path_gate'
  | 'shared_authority_runtime_gate'
  | 'release_signing_provider_gate'
  | 'ha_external_redis_gate'
  | 'ha_shared_control_plane_gate'
  | 'ha_shared_billing_ledger_gate'
  | 'worker_shutdown_not_ready'
  | 'worker_redis_readiness_gate'
  | 'worker_ha_readiness_gate'
  | 'queue_retry_backoff_policy'
  | 'queue_stalled_job_limit'
  | 'tenant_queue_capacity_guard'
  | 'tenant_active_execution_lease'
  | 'dead_letter_recovery_visible'
  | 'webhook_signature_secret_required'
  | 'webhook_provider_signature_verification'
  | 'webhook_dedupe_store_gate'
  | 'degraded_grant_store_visible'
  | 'privacy_minimized_diagnostics'
  | 'no_secret_output'
  | 'no_store_response'
  | 'bounded_probe_work';

export interface HostedProductionRuntimeHealthGuard {
  readonly id: string;
  readonly title: string;
  readonly surface: HostedProductionRuntimeHealthSurface;
  readonly probes: readonly string[];
  readonly runtimeRisks: readonly HostedProductionRuntimeHealthRisk[];
  readonly requiredControls: readonly HostedProductionRuntimeHealthControl[];
  readonly livenessBoundary: string;
  readonly readinessBoundary: string;
  readonly startupBoundary: string;
  readonly privacyBoundary: string;
  readonly implementationEvidence: readonly string[];
  readonly validation: readonly string[];
  readonly standards: readonly string[];
}

export const HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS: readonly HostedProductionRuntimeHealthGuard[] = [
  {
    id: 'api.process-health',
    title: 'API process health and startup visibility',
    surface: 'api_process_health',
    probes: ['GET /api/v1/startup', 'GET /api/v1/health'],
    runtimeRisks: [
      'liveness_depends_on_external_substrate',
      'startup_routes_traffic_too_early',
      'health_endpoint_leaks_secret',
    ],
    requiredControls: [
      'liveness_process_only',
      'startup_bootstrap_separate_from_readiness',
      'privacy_minimized_diagnostics',
      'no_secret_output',
      'no_store_response',
      'bounded_probe_work',
    ],
    livenessBoundary:
      'The API startup and health routes report process, version, instance, uptime, registry, and non-secret runtime posture; they do not become the dependency readiness gate.',
    readinessBoundary:
      'Dependency and promotion blockers are visible in the health payload but are enforced by /api/v1/ready, not by treating liveness as routability.',
    startupBoundary:
      'The startup probe is separate from readiness and returns only process bootstrap state so an operator can distinguish booted process from traffic-ready service.',
    privacyBoundary:
      'Health output is no-store and diagnostic-only; it must not expose credentials, raw connection strings, webhook secrets, private keys, raw provider bodies, or customer payloads.',
    implementationEvidence: [
      'src/service/http/routes/core-routes.ts',
      'src/service/bootstrap/runtime.ts',
      'src/service/bootstrap/server.ts',
      'src/service/version.ts',
      'src/service/http-production-edge-contract.ts',
    ],
    validation: [
      'tests/service-core-routes.test.ts',
      'tests/service-version-alignment.test.ts',
      'tests/http-production-edge-contract.test.ts',
      'tests/production-runtime-profile.test.ts',
    ],
    standards: [
      'Kubernetes probes: liveness, readiness, and startup probes have distinct operational meanings.',
      'Google SRE: monitoring should separate symptoms, causes, and actionable signals.',
      'OWASP API3:2023 Sensitive Data Exposure: diagnostics must avoid secrets and private payloads.',
    ],
  },
  {
    id: 'api.dependency-readiness',
    title: 'API dependency and routability readiness',
    surface: 'api_dependency_readiness',
    probes: ['GET /api/v1/ready'],
    runtimeRisks: [
      'readiness_overclaims_runtime',
      'storage_path_not_shared',
      'startup_routes_traffic_too_early',
      'health_endpoint_leaks_secret',
    ],
    requiredControls: [
      'readiness_dependency_gate',
      'ready_returns_503_on_blockers',
      'runtime_profile_explicit_in_production_like_env',
      'release_runtime_durability_gate',
      'production_storage_path_gate',
      'shared_authority_runtime_gate',
      'release_signing_provider_gate',
      'ha_external_redis_gate',
      'ha_shared_control_plane_gate',
      'ha_shared_billing_ledger_gate',
      'privacy_minimized_diagnostics',
      'no_secret_output',
      'no_store_response',
      'bounded_probe_work',
    ],
    livenessBoundary:
      'The API may be live while readiness is false; orchestrators should remove it from traffic when /api/v1/ready returns 503.',
    readinessBoundary:
      'Readiness is the aggregated stop/go signal over async backend, Redis, PKI, runtime durability, release signing provider, shared authority readiness, production storage path, domains, and HA/shared ledger posture.',
    startupBoundary:
      'Production-like runtimes must select ATTESTOR_RUNTIME_PROFILE explicitly before readiness can truthfully describe the deployment.',
    privacyBoundary:
      'Readiness returns booleans, blocker codes, runtime profile metadata, and non-secret state summaries without connection strings, tokens, private keys, or raw payloads.',
    implementationEvidence: [
      'src/service/http/routes/core-routes.ts',
      'src/service/bootstrap/runtime-profile.ts',
      'src/service/bootstrap/shared-authority-readiness.ts',
      'src/service/bootstrap/production-storage-path.ts',
      'src/service/high-availability.ts',
      'src/service/bootstrap/release-signing-provider.ts',
    ],
    validation: [
      'tests/service-core-routes.test.ts',
      'tests/production-runtime-profile.test.ts',
      'tests/shared-authority-runtime-readiness.test.ts',
      'tests/production-storage-path.test.ts',
      'tests/production-release-signing-provider.test.ts',
      'tests/ha-runtime-connectivity-probe.test.ts',
    ],
    standards: [
      'Kubernetes readiness probes: readiness gates decide whether a container should receive traffic.',
      'NIST SSDF PW.8: runtime verification should fail closed when required controls are absent.',
      'OWASP API4:2023 Unrestricted Resource Consumption: probes must stay bounded and cheap.',
    ],
  },
  {
    id: 'worker.health-readiness',
    title: 'Worker process health and queue readiness',
    surface: 'worker_process_health',
    probes: ['GET worker:/health', 'GET worker:/ready'],
    runtimeRisks: [
      'worker_accepts_jobs_while_draining',
      'liveness_depends_on_external_substrate',
      'health_endpoint_leaks_secret',
    ],
    requiredControls: [
      'liveness_process_only',
      'readiness_dependency_gate',
      'worker_shutdown_not_ready',
      'worker_redis_readiness_gate',
      'worker_ha_readiness_gate',
      'privacy_minimized_diagnostics',
      'no_secret_output',
      'no_store_response',
      'bounded_probe_work',
    ],
    livenessBoundary:
      'Worker /health reports the worker process and shutdown state; it returns non-ready when the process is draining instead of masking shutdown.',
    readinessBoundary:
      'Worker /ready requires local readiness, not shutting down, Redis reachable, and HA worker state ready before accepting queue work.',
    startupBoundary:
      'Worker startup fails closed when HA mode is enabled without external Redis, preventing local or embedded Redis from masquerading as production shared queue infrastructure.',
    privacyBoundary:
      'Worker probes expose instance id, queue backend, Redis availability, and HA posture without Redis URLs, credentials, job payloads, customer data, or raw queue bodies.',
    implementationEvidence: [
      'src/service/worker.ts',
      'src/service/async-pipeline.ts#checkRedisHealth',
      'src/service/high-availability.ts#evaluateWorkerHighAvailabilityState',
    ],
    validation: [
      'tests/live-worker-health.test.ts',
      'tests/live-async-tenant-execution-redis.test.ts',
      'tests/live-async-weighted-dispatch-redis.test.ts',
    ],
    standards: [
      'Kubernetes probes: worker liveness and readiness should be separate when dependency health changes routability.',
      'BullMQ stalled job guidance: worker recovery and draining should be explicit.',
      'OWASP API4:2023 Unrestricted Resource Consumption: workers must not accept unbounded retry work while unhealthy.',
    ],
  },
  {
    id: 'async.queue-runtime',
    title: 'Async queue, retry, and tenant capacity runtime',
    surface: 'async_queue_runtime',
    probes: [
      'GET /api/v1/pipeline/jobs/:jobId',
      'GET /api/v1/admin/dead-letter',
      'GET /api/v1/ready',
    ],
    runtimeRisks: [
      'queue_accepts_unbounded_work',
      'worker_accepts_jobs_while_draining',
      'readiness_overclaims_runtime',
    ],
    requiredControls: [
      'queue_retry_backoff_policy',
      'queue_stalled_job_limit',
      'tenant_queue_capacity_guard',
      'tenant_active_execution_lease',
      'dead_letter_recovery_visible',
      'ha_external_redis_gate',
      'readiness_dependency_gate',
      'privacy_minimized_diagnostics',
      'no_secret_output',
    ],
    livenessBoundary:
      'Queue runtime evidence is not liveness; a process may be live while Redis, tenant leases, or DLQ recovery are not acceptable for traffic.',
    readinessBoundary:
      'Async readiness is true only when the selected backend is configured, Redis is reachable when BullMQ is selected, and tenant capacity, retry, stalled-job, lease, and DLQ boundaries remain visible.',
    startupBoundary:
      'API and worker startup expose async backend mode and Redis mode so in-process or local fallback is never mistaken for HA-safe production queue posture.',
    privacyBoundary:
      'Queue and dead-letter views expose job ids, tenant refs, status, counts, attempts, and reason summaries without raw job payloads or provider bodies.',
    implementationEvidence: [
      'src/service/async-pipeline.ts',
      'src/service/async-dead-letter-store.ts',
      'src/service/application/pipeline-dead-letter-service.ts',
      'src/service/http/routes/pipeline-async-routes.ts',
      'src/service/application/pipeline-usage-service.ts',
    ],
    validation: [
      'tests/service-pipeline-usage-service.test.ts',
      'tests/service-pipeline-dead-letter-service.test.ts',
      'tests/production-rehearsal-async-recovery.test.ts',
      'tests/hosted-webhook-async-reconciliation-hardening.test.ts',
    ],
    standards: [
      'BullMQ retry guidance: failed jobs should use explicit attempts and backoff.',
      'BullMQ stalled job guidance: crashed workers need bounded stalled recovery.',
      'OWASP API4:2023 Unrestricted Resource Consumption: queue admission and retry must be bounded.',
    ],
  },
  {
    id: 'storage.authority-readiness',
    title: 'Storage, release authority, and degraded-mode readiness',
    surface: 'storage_authority_runtime',
    probes: ['GET /api/v1/health', 'GET /api/v1/ready'],
    runtimeRisks: [
      'storage_path_not_shared',
      'degraded_mode_hidden',
      'readiness_overclaims_runtime',
      'health_endpoint_leaks_secret',
    ],
    requiredControls: [
      'runtime_profile_explicit_in_production_like_env',
      'release_runtime_durability_gate',
      'production_storage_path_gate',
      'shared_authority_runtime_gate',
      'degraded_grant_store_visible',
      'release_signing_provider_gate',
      'ready_returns_503_on_blockers',
      'privacy_minimized_diagnostics',
      'no_secret_output',
    ],
    livenessBoundary:
      'Storage and release-authority substrate state is diagnostic and readiness-critical, but it should not be used as a process liveness dependency.',
    readinessBoundary:
      'The selected runtime profile decides whether file, shared, or production-shared storage modes are acceptable; production-shared remains not ready until shared authority and request-path cutover are explicit.',
    startupBoundary:
      'Startup fails closed for production-like runtimes without explicit profile selection, and production-shared bootstrap exposes durability violations instead of hiding them.',
    privacyBoundary:
      'Storage readiness reports component modes, blocker codes, and safe summaries, not database URLs, key material, degraded grant secrets, or raw stored objects.',
    implementationEvidence: [
      'src/service/bootstrap/runtime-profile.ts',
      'src/service/bootstrap/release-runtime.ts',
      'src/service/bootstrap/shared-authority-readiness.ts',
      'src/service/bootstrap/production-storage-path.ts',
      'src/service/release-degraded-mode-grant-store.ts',
    ],
    validation: [
      'tests/production-runtime-profile.test.ts',
      'tests/production-runtime-restart-recovery.test.ts',
      'tests/shared-authority-runtime-readiness.test.ts',
      'tests/production-storage-path.test.ts',
      'tests/production-shared-request-path-cutover.test.ts',
      'tests/production-shared-multi-instance-recovery.test.ts',
    ],
    standards: [
      'Kubernetes readiness probes: dependency readiness should gate traffic, not process existence.',
      'NIST SSDF PW.8: runtime operational controls should be verified before release/promotion.',
      'Google SRE: operational readiness should surface actionable blockers.',
    ],
  },
  {
    id: 'webhook.ingress-runtime',
    title: 'Webhook ingress runtime readiness',
    surface: 'webhook_ingress_runtime',
    probes: [
      'POST /api/v1/billing/stripe/webhook',
      'POST /api/v1/email/sendgrid/webhook',
      'POST /api/v1/email/mailgun/webhook',
      'npm run probe:stripe-webhook-config',
    ],
    runtimeRisks: [
      'webhook_accepts_unverifiable_events',
      'readiness_overclaims_runtime',
      'health_endpoint_leaks_secret',
    ],
    requiredControls: [
      'webhook_signature_secret_required',
      'webhook_provider_signature_verification',
      'webhook_dedupe_store_gate',
      'ha_shared_billing_ledger_gate',
      'privacy_minimized_diagnostics',
      'no_secret_output',
      'no_store_response',
      'bounded_probe_work',
    ],
    livenessBoundary:
      'Webhook route existence is not process liveness and is not a billing readiness claim.',
    readinessBoundary:
      'Webhook readiness requires provider signature material, accepted event allowlists, dedupe state, and shared billing/control-plane state in public hosted or HA deployments.',
    startupBoundary:
      'Operator probes and env checks must verify webhook URL, endpoint id, signing secret, and shared ledger posture before live billing readiness is claimed.',
    privacyBoundary:
      'Webhook diagnostics and probes expose endpoint ids, status, event names, hashes, and safe summaries without webhook secrets, provider bodies, card/payment details, or customer payloads.',
    implementationEvidence: [
      'src/service/http/routes/stripe-webhook-routes.ts',
      'src/service/application/stripe-webhook-service.ts',
      'src/service/http/routes/email-webhook-routes.ts',
      'src/service/application/email-webhook-service.ts',
      'scripts/probe/probe-stripe-webhook-config.ts',
      'src/service/hosted-webhook-async-reconciliation-hardening.ts',
    ],
    validation: [
      'tests/service-stripe-webhook-service.test.ts',
      'tests/service-email-webhook-service.test.ts',
      'tests/stripe-webhook-config-probe.test.ts',
      'tests/hosted-webhook-async-reconciliation-hardening.test.ts',
    ],
    standards: [
      'Stripe webhooks: verify signatures with the raw body and configured webhook secret.',
      'Stripe go-live checklist: webhook testing and live key readiness are explicit launch gates.',
      'OWASP API2:2023 and API3:2023: provider callbacks must authenticate and avoid sensitive output.',
    ],
  },
] as const;

export function hostedProductionRuntimeHealthContractProfile(): {
  readonly version: string;
  readonly posture: string;
  readonly unresolvedProductionDependency: string;
  readonly guards: readonly HostedProductionRuntimeHealthGuard[];
} {
  return {
    version: HOSTED_PRODUCTION_RUNTIME_HEALTH_CONTRACT_VERSION,
    posture:
      'Production runtime health separates process liveness, dependency readiness, startup diagnostics, worker queue readiness, storage authority readiness, webhook ingress readiness, degraded-mode visibility, and privacy-minimized probe output.',
    unresolvedProductionDependency:
      'Repo-side runtime health contracts do not replace a real deployment target, env injection, service restart, endpoint probes, worker probes, Stripe/webhook smoke tests, observability checks, or rehearsal against live infrastructure.',
    guards: HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS,
  };
}

export function requireHostedProductionRuntimeHealthGuard(
  id: string,
): HostedProductionRuntimeHealthGuard {
  const guard = HOSTED_PRODUCTION_RUNTIME_HEALTH_GUARDS.find((entry) => entry.id === id);
  if (!guard) {
    throw new Error(`Hosted production runtime health guard '${id}' was not found.`);
  }
  return guard;
}
