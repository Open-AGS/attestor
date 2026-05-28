import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const rootDir = join(fileURLToPath(new URL('../..', import.meta.url)));
const externalGateEnv = 'ATTESTOR_RUN_EXTERNAL_LIVE_TESTS';

function testCommand(scriptName) {
  return {
    label: scriptName,
    command: `npm run ${scriptName}`,
  };
}

export const liveOpsGroups = Object.freeze({
  localLive: Object.freeze([
    'test:live-api',
    'test:live-pg',
    'test:connectors-and-filing',
    'test:live-otlp',
    'test:live-account-email-delivery',
    'test:live-account-email-provider-webhook',
    'test:live-account-email-mailgun-webhook',
    'test:live-account-oidc-sso',
    'test:live-account-saml-sso',
    'test:live-account-passkeys',
    'test:live-tenant-key-vault-recovery',
    'test:live-rate-limit-redis',
    'test:live-async-tenant-execution-redis',
    'test:live-async-weighted-dispatch-redis',
    'test:live-ha-proxy',
    'test:live-worker-health',
  ]),
  opsRender: Object.freeze([
    'test:observability-bundle',
    'test:alertmanager-config-render',
    'test:alert-routing-probe',
    'test:observability-credentials-render',
    'test:observability-profile-render',
    'test:observability-benchmark',
    'test:observability-release-bundle-render',
    'test:observability-receiver-probe',
    'test:observability-release-input-probe',
    'test:observability-promotion-packet',
    'test:kubernetes-observability-bundle',
    'test:dr-bundle',
    'test:kubernetes-ha-bundle',
    'test:ha-calibration',
    'test:ha-profile-render',
    'test:ha-credentials-render',
    'test:ha-runtime-connectivity-probe',
    'test:ha-release-bundle-render',
    'test:ha-release-input-probe',
    'test:ha-promotion-packet',
    'test:gke-domain-cutover-render',
    'test:production-readiness-packet',
    'test:secret-manager-bootstrap-render',
  ]),
  externalLive: Object.freeze([
    'test:live-snowflake',
    'test:live-vsac',
    'test:live-cypress',
    'probe:policy-foundry-production-smoke',
    'probe:openai-live-smoke',
    'probe:anthropic-live-smoke',
  ]),
});

function externalLiveEnabled(env = process.env) {
  return env[externalGateEnv] === 'true';
}

export function resolveLiveOpsGate(mode, options = {}) {
  const includeExternal = options.includeExternal ?? externalLiveEnabled(options.env);

  if (mode === 'local' || mode === 'local-live') {
    return liveOpsGroups.localLive.map(testCommand);
  }

  if (mode === 'ops' || mode === 'ops-render') {
    return liveOpsGroups.opsRender.map(testCommand);
  }

  if (mode === 'external' || mode === 'external-live') {
    return includeExternal ? liveOpsGroups.externalLive.map(testCommand) : [];
  }

  if (mode === 'full') {
    const commands = [
      ...liveOpsGroups.localLive,
      ...liveOpsGroups.opsRender,
    ];
    if (includeExternal) commands.push(...liveOpsGroups.externalLive);
    return commands.map(testCommand);
  }

  throw new Error(`Unknown live/ops gate "${mode}". Expected local-live, ops, external-live, or full.`);
}

export function runLiveOpsGate(mode, options = {}) {
  const root = options.root ?? rootDir;
  const env = options.env ?? process.env;
  const includeExternal = externalLiveEnabled(env);

  if ((mode === 'external' || mode === 'external-live') && !includeExternal) {
    console.error(`[live-ops:${mode}] blocked: set ${externalGateEnv}=true in an explicit live environment.`);
    process.exitCode = 2;
    return;
  }

  const commands = resolveLiveOpsGate(mode, { includeExternal, env });
  console.log(`[live-ops:${mode}] ${commands.length} commands`);

  if (mode === 'full' && !includeExternal) {
    console.log(`[live-ops:${mode}] external live tests skipped; set ${externalGateEnv}=true to include Snowflake, VSAC, Cypress, Policy Foundry production smoke, OpenAI live smoke, and Anthropic live smoke probes.`);
  }

  for (const [index, item] of commands.entries()) {
    const ordinal = `${index + 1}/${commands.length}`.padStart(7);
    console.log(`\n[live-ops:${mode}] ${ordinal} ${item.label}`);
    const result = spawnSync(item.command, {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      env,
    });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiveOpsGate(process.argv[2] ?? 'full');
}
