import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { probeHaRuntimeConnectivity, type HaRuntimeConnectivitySummary } from './probe-ha-runtime-connectivity.ts';
import { probeObservabilityReceivers, type ReceiverProbeSummary } from './probe-observability-receivers.ts';

type CheckStatus = 'pass' | 'fail';
type Environment = Readonly<Record<string, string | undefined>>;

interface TargetProfile {
  readonly profileVersion: string;
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
  readonly secretPosture: {
    readonly mode: string;
    readonly plaintextSecretsAllowed: boolean;
    readonly workloadIdentityRequired: boolean;
  };
  readonly substrates: readonly Array<{
    readonly id: string;
    readonly kind: string;
    readonly requiredEnv: readonly string[];
  }>;
}

interface EndpointProbe {
  readonly ok: boolean;
  readonly status: number;
  readonly bodySnippet: string | null;
  readonly error: string | null;
}

interface DnsProbe {
  readonly addresses: readonly string[];
  readonly error: string | null;
}

interface KubernetesResourceProbe {
  readonly resource: unknown | null;
  readonly error: string | null;
}

interface ProbeAdapters {
  readonly haRuntimeConnectivity: (provider: 'generic' | 'aws' | 'gke') => Promise<HaRuntimeConnectivitySummary>;
  readonly observabilityReceivers: (outputDir: string) => Promise<ReceiverProbeSummary>;
  readonly fetchEndpoint: (url: string, timeoutMs: number) => Promise<EndpointProbe>;
  readonly resolveHostname: (hostname: string) => Promise<DnsProbe>;
  readonly kubernetesResource: (request: KubernetesResourceRequest) => Promise<KubernetesResourceProbe>;
}

interface KubernetesResourceRequest {
  readonly kind: string;
  readonly name: string;
  readonly namespace: string | null;
}

export interface SubstrateCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly evidence?: unknown;
}

export interface ProductionRehearsalSubstrateSummary {
  readonly generatedAt: string;
  readonly profileId: string;
  readonly readiness: {
    readonly state: 'ready-for-rehearsal' | 'blocked-on-substrates';
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
  };
  readonly checks: readonly SubstrateCheck[];
  readonly nonClaims: readonly string[];
}

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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function readProfile(path: string): TargetProfile {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as TargetProfile;
}

function pass(id: string, detail: string, evidence?: unknown): SubstrateCheck {
  return { id, status: 'pass', detail, evidence };
}

function fail(id: string, detail: string, evidence?: unknown): SubstrateCheck {
  return { id, status: 'fail', detail, evidence };
}

function conditionEntries(resource: unknown): Array<{ type?: string; status?: string; reason?: string; message?: string }> {
  const typed = resource as {
    status?: {
      conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }>;
      parents?: Array<{ conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }> }>;
    };
  } | null;
  const direct = typed?.status?.conditions ?? [];
  const parentConditions = typed?.status?.parents?.flatMap((parent) => parent.conditions ?? []) ?? [];
  return [...direct, ...parentConditions];
}

function hasCondition(resource: unknown, type: string): boolean {
  return conditionEntries(resource).some((condition) => condition.type === type && condition.status === 'True');
}

function conditionSummary(resource: unknown): string {
  const conditions = conditionEntries(resource);
  if (conditions.length === 0) return 'no status conditions found';
  return conditions
    .map((condition) => `${condition.type ?? 'unknown'}=${condition.status ?? 'unknown'}${condition.reason ? `(${condition.reason})` : ''}`)
    .join(', ');
}

function resourceCheck(
  id: string,
  probe: KubernetesResourceProbe,
  requiredConditions: readonly string[],
): SubstrateCheck {
  if (probe.error) return fail(id, probe.error);
  if (!probe.resource) return fail(id, 'resource was not returned');
  const missing = requiredConditions.filter((condition) => !hasCondition(probe.resource, condition));
  if (missing.length > 0) {
    return fail(id, `missing Ready conditions: ${missing.join(', ')}; observed ${conditionSummary(probe.resource)}`);
  }
  return pass(id, `required conditions present: ${requiredConditions.join(', ')}`, { conditions: conditionSummary(probe.resource) });
}

function requiredEnvChecks(profile: TargetProfile, env: Environment): SubstrateCheck[] {
  const checks: SubstrateCheck[] = [];
  const names = unique(profile.substrates.flatMap((substrate) => substrate.requiredEnv));
  const missing = names.filter((name) => !envValue(env, name));
  checks.push(
    missing.length === 0
      ? pass('required-environment', `${names.length} required environment inputs are present`)
      : fail('required-environment', `missing required environment inputs: ${missing.join(', ')}`),
  );
  return checks;
}

function profilePostureCheck(profile: TargetProfile, env: Environment): SubstrateCheck {
  const issues: string[] = [];
  if (profile.profileId !== 'gke-production-rehearsal') issues.push(`unexpected profile id: ${profile.profileId}`);
  if (profile.targetEnvironment.provider !== 'gke') issues.push(`unexpected provider: ${profile.targetEnvironment.provider}`);
  if (profile.runtime.profile !== 'production-shared') issues.push('target profile must use production-shared');
  if (!profile.runtime.requireSharedAuthority) issues.push('target profile must require shared authority');
  if (!profile.runtime.noLocalFallback) issues.push('target profile must disable local fallback');
  if (profile.runtime.sharedAuthorityContract !== 'async-shared-authority-stores') issues.push('target profile must use async-shared-authority-stores');
  if (profile.secretPosture.mode !== 'external-secret') issues.push('target profile must use external-secret posture');
  if (profile.secretPosture.plaintextSecretsAllowed) issues.push('plaintext secrets must not be allowed');
  if (profile.secretPosture.workloadIdentityRequired !== true) issues.push('Workload Identity must be required');
  if (envValue(env, 'ATTESTOR_RUNTIME_PROFILE') !== 'production-shared') issues.push('ATTESTOR_RUNTIME_PROFILE must be production-shared');

  return issues.length === 0
    ? pass('target-profile-posture', 'GKE production-shared target posture is pinned')
    : fail('target-profile-posture', issues.join(' '));
}

function endpointUrl(env: Environment, explicitName: string, fallback: string | null): string | null {
  return envValue(env, explicitName) ?? fallback;
}

function endpointCheck(id: string, url: string | null, probe: EndpointProbe | null, requireHttps: boolean): SubstrateCheck {
  if (!url) return fail(id, 'endpoint URL is required');
  try {
    const parsed = new URL(url);
    if (requireHttps && parsed.protocol !== 'https:') {
      return fail(id, `${url} must use https:// for the public API path`);
    }
  } catch {
    return fail(id, `${url} is not a valid URL`);
  }
  if (!probe) return fail(id, 'endpoint probe was not executed');
  if (!probe.ok) return fail(id, probe.error ? `${url} failed: ${probe.error}` : `${url} returned HTTP ${probe.status}`);
  return pass(id, `${url} returned HTTP ${probe.status}`, { status: probe.status, bodySnippet: probe.bodySnippet });
}

async function defaultFetchEndpoint(url: string, timeoutMs: number): Promise<EndpointProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      bodySnippet: text.trim() ? text.slice(0, 500) : null,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      bodySnippet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function defaultResolveHostname(hostname: string): Promise<DnsProbe> {
  try {
    const records = await lookup(hostname, { all: true });
    return { addresses: records.map((record) => record.address), error: null };
  } catch (error) {
    return { addresses: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function defaultKubernetesResource(request: KubernetesResourceRequest): Promise<KubernetesResourceProbe> {
  const args = ['get', request.kind, request.name, '-o', 'json'];
  if (request.namespace) args.splice(3, 0, '-n', request.namespace);
  const result = spawnSync('kubectl', args, {
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    return {
      resource: null,
      error: (result.stderr || result.stdout || `kubectl exited ${result.status}`).trim(),
    };
  }
  try {
    return { resource: JSON.parse(result.stdout) as unknown, error: null };
  } catch (error) {
    return { resource: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function defaultAdapters(): ProbeAdapters {
  return {
    haRuntimeConnectivity: (provider) => probeHaRuntimeConnectivity({ provider }),
    observabilityReceivers: (outputDir) => probeObservabilityReceivers({ outputDir }),
    fetchEndpoint: defaultFetchEndpoint,
    resolveHostname: defaultResolveHostname,
    kubernetesResource: defaultKubernetesResource,
  };
}

function renderReadme(summary: ProductionRehearsalSubstrateSummary): string {
  const checkLines = summary.checks.map((check) => `- ${check.status.toUpperCase()} ${check.id}: ${check.detail}`).join('\n');
  const issueLines = summary.readiness.issues.length
    ? summary.readiness.issues.map((issue) => `- ${issue}`).join('\n')
    : '- none';
  return `# Production rehearsal substrate readiness

Generated at:

- ${summary.generatedAt}

Profile:

- ${summary.profileId}
- provider: ${summary.target.provider}
- namespace: ${summary.target.namespace}
- public hostname: ${summary.target.publicHostname ?? 'not configured'}

Readiness:

- state: ${summary.readiness.state}
- passed: ${summary.readiness.passed}

Checks:

${checkLines}

Issues:

${issueLines}

Non-claims:

${summary.nonClaims.map((claim) => `- ${claim}`).join('\n')}
`;
}

export async function probeProductionRehearsalSubstrates(options?: {
  profilePath?: string;
  outputDir?: string;
  env?: Environment;
  adapters?: Partial<ProbeAdapters>;
  timeoutMs?: number;
}): Promise<ProductionRehearsalSubstrateSummary> {
  const env = options?.env ?? process.env;
  const profilePath = resolve(options?.profilePath ?? arg(
    'profile',
    'docs/08-deployment/production-rehearsal-targets/gke-production-rehearsal.json',
  )!);
  const outputDir = resolve(options?.outputDir ?? arg(
    'output-dir',
    '.attestor/rehearsal/gke-production-rehearsal/substrate-readiness',
  )!);
  const timeoutMs = options?.timeoutMs ?? Number.parseInt(arg('timeout-ms', envValue(env, 'ATTESTOR_REHEARSAL_PROBE_TIMEOUT_MS') ?? '5000')!, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('timeout-ms must be a positive integer.');

  const profile = readProfile(profilePath);
  const adapters = { ...defaultAdapters(), ...options?.adapters };
  const checks: SubstrateCheck[] = [
    profilePostureCheck(profile, env),
    ...requiredEnvChecks(profile, env),
  ];
  const namespace = envValue(env, 'ATTESTOR_K8S_NAMESPACE') ?? profile.targetEnvironment.namespace;
  const hostname = envValue(env, 'ATTESTOR_PUBLIC_HOSTNAME');
  const dnsTargetIp = envValue(env, 'ATTESTOR_DNS_TARGET_IP');
  const apiHealthUrl = endpointUrl(env, 'ATTESTOR_API_HEALTH_URL', hostname ? `https://${hostname}/api/v1/health` : null);
  const apiReadyUrl = endpointUrl(env, 'ATTESTOR_API_READY_URL', hostname ? `https://${hostname}/api/v1/ready` : null);
  const workerHealthUrl = endpointUrl(env, 'ATTESTOR_WORKER_HEALTH_URL', null);
  const workerReadyUrl = endpointUrl(env, 'ATTESTOR_WORKER_READY_URL', null);

  const ha = await adapters.haRuntimeConnectivity('gke');
  checks.push(
    ha.overall.passed
      ? pass('ha-runtime-connectivity', 'shared PostgreSQL, Redis, runtime profile, image, hostname, and TLS connectivity preflight passed')
      : fail('ha-runtime-connectivity', ha.overall.issues.join(' ') || 'HA runtime connectivity failed'),
  );

  const [apiHealthProbe, apiReadyProbe, workerHealthProbe, workerReadyProbe] = await Promise.all([
    apiHealthUrl ? adapters.fetchEndpoint(apiHealthUrl, timeoutMs) : Promise.resolve(null),
    apiReadyUrl ? adapters.fetchEndpoint(apiReadyUrl, timeoutMs) : Promise.resolve(null),
    workerHealthUrl ? adapters.fetchEndpoint(workerHealthUrl, timeoutMs) : Promise.resolve(null),
    workerReadyUrl ? adapters.fetchEndpoint(workerReadyUrl, timeoutMs) : Promise.resolve(null),
  ]);
  checks.push(endpointCheck('api-health', apiHealthUrl, apiHealthProbe, true));
  checks.push(endpointCheck('api-ready', apiReadyUrl, apiReadyProbe, true));
  checks.push(endpointCheck('worker-health', workerHealthUrl, workerHealthProbe, false));
  checks.push(endpointCheck('worker-ready', workerReadyUrl, workerReadyProbe, false));

  if (hostname && dnsTargetIp) {
    const dnsProbe = await adapters.resolveHostname(hostname);
    checks.push(
      dnsProbe.error
        ? fail('dns-target', dnsProbe.error)
        : (dnsProbe.addresses.includes(dnsTargetIp)
            ? pass('dns-target', `${hostname} resolves to ${dnsTargetIp}`, { addresses: dnsProbe.addresses })
            : fail('dns-target', `${hostname} does not resolve to ${dnsTargetIp}; observed ${dnsProbe.addresses.join(', ') || 'none'}`)),
    );
  } else {
    checks.push(fail('dns-target', 'ATTESTOR_PUBLIC_HOSTNAME and ATTESTOR_DNS_TARGET_IP are required for DNS verification'));
  }

  const storeKind = envValue(env, 'ATTESTOR_HA_EXTERNAL_SECRET_STORE_KIND') ?? 'ClusterSecretStore';
  const storeName = envValue(env, 'ATTESTOR_EXTERNAL_SECRET_STORE') ?? envValue(env, 'ATTESTOR_HA_SECRET_STORE') ?? 'platform-secrets';
  const externalSecretName = envValue(env, 'ATTESTOR_K8S_RUNTIME_EXTERNAL_SECRET_NAME') ?? 'attestor-runtime-secrets';
  const gatewayName = envValue(env, 'ATTESTOR_K8S_GATEWAY_NAME') ?? 'attestor';
  const httpRouteName = envValue(env, 'ATTESTOR_K8S_HTTPROUTE_NAME') ?? 'attestor-api-https';
  const certificateName = envValue(env, 'ATTESTOR_K8S_CERTIFICATE_NAME') ?? 'attestor-api';

  const [secretStore, externalSecret, gateway, httpRoute, certificate] = await Promise.all([
    adapters.kubernetesResource({ kind: storeKind, name: storeName, namespace: storeKind === 'ClusterSecretStore' ? null : namespace }),
    adapters.kubernetesResource({ kind: 'ExternalSecret', name: externalSecretName, namespace }),
    adapters.kubernetesResource({ kind: 'Gateway', name: gatewayName, namespace }),
    adapters.kubernetesResource({ kind: 'HTTPRoute', name: httpRouteName, namespace }),
    adapters.kubernetesResource({ kind: 'Certificate', name: certificateName, namespace }),
  ]);
  checks.push(resourceCheck('secret-store-ready', secretStore, ['Ready']));
  checks.push(resourceCheck('external-secret-ready', externalSecret, ['Ready']));
  checks.push(resourceCheck('gateway-ready', gateway, ['Accepted', 'Programmed']));
  checks.push(resourceCheck('httproute-ready', httpRoute, ['Accepted', 'ResolvedRefs']));
  checks.push(resourceCheck('certificate-ready', certificate, ['Ready']));

  const observability = await adapters.observabilityReceivers(resolve(outputDir, 'observability-receivers'));
  const observabilityIssues: string[] = [];
  if (!observability.telemetry.flushSucceeded) observabilityIssues.push(`OTLP flush failed: ${observability.telemetry.flushError ?? 'unknown'}`);
  if (!observability.prometheus.configured || !observability.prometheus.ok) observabilityIssues.push(`Prometheus probe failed: ${observability.prometheus.error ?? 'not configured'}`);
  if (!observability.alertmanager.configured || !observability.alertmanager.ok) observabilityIssues.push(`Alertmanager probe failed: ${observability.alertmanager.error ?? 'not configured'}`);
  checks.push(
    observabilityIssues.length === 0
      ? pass('observability-receivers', 'OTLP, Prometheus, and Alertmanager probes passed')
      : fail('observability-receivers', observabilityIssues.join(' ')),
  );

  const issues = checks.filter((check) => check.status !== 'pass').map((check) => `${check.id}: ${check.detail}`);
  const summary: ProductionRehearsalSubstrateSummary = {
    generatedAt: new Date().toISOString(),
    profileId: profile.profileId,
    readiness: {
      state: issues.length === 0 ? 'ready-for-rehearsal' : 'blocked-on-substrates',
      passed: issues.length === 0,
      issues,
    },
    target: {
      provider: profile.targetEnvironment.provider,
      namespace,
      publicHostname: hostname,
    },
    artifacts: {
      outputDir,
      summaryPath: resolve(outputDir, 'summary.json'),
      readmePath: resolve(outputDir, 'README.md'),
    },
    checks,
    nonClaims: [
      'This substrate probe is not market validation.',
      'This substrate probe is not a blanket production guarantee for other environments.',
      'This substrate probe does not replace independent security review or operator approval.',
      'This substrate probe does not add a hosted crypto route or a new product line.',
    ],
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(summary.artifacts.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(summary.artifacts.readmePath, renderReadme(summary), 'utf8');
  return summary;
}

async function main(): Promise<void> {
  const summary = await probeProductionRehearsalSubstrates();
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.readiness.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
}
