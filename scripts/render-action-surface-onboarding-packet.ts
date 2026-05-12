import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createActionSurfaceOnboardingPacket,
  ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES,
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
  type ActionSurfaceManifestKind,
  type ActionSurfaceOnboardingPacket,
  type ActionSurfaceOnboardingReadinessOverride,
  type ShadowAdmissionEvent,
} from '../src/consequence-admission/index.js';
import {
  safeErrorMessage,
  stringifySecretSafe,
} from './secret-safe-output.ts';

type ManifestInputSpec = {
  readonly path: string;
  readonly manifestKind?: ActionSurfaceManifestKind | 'auto';
};

export interface RenderActionSurfaceOnboardingPacketOptions {
  readonly outputDir?: string;
  readonly generatedAt?: string;
  readonly attestorBaseUrl?: string;
  readonly manifests?: readonly ManifestInputSpec[];
  readonly declarationsPath?: string;
  readonly shadowEventsPath?: string;
  readonly readinessOverridesPath?: string;
  readonly defaultDomain?: string;
  readonly downstreamSystem?: string;
  readonly credentialPosture?: string;
}

export interface RenderedActionSurfaceOnboardingPacket {
  readonly packet: ActionSurfaceOnboardingPacket;
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
  };
}

function arg(name: string, fallback?: string): string | undefined {
  const prefixed = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefixed));
  if (found) return found.slice(prefixed.length);
  return fallback;
}

function args(name: string): readonly string[] {
  const prefixed = `--${name}=`;
  return Object.freeze(
    process.argv
      .filter((entry) => entry.startsWith(prefixed))
      .map((entry) => entry.slice(prefixed.length))
      .filter((entry) => entry.trim().length > 0),
  );
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

function readJsonArray<T>(path: string, label: string): readonly T[] {
  const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }
  return Object.freeze(parsed as readonly T[]);
}

function credentialPosture(
  value: string | undefined,
): ActionSurfaceDeclaredCredentialPosture | undefined {
  if (!value) return undefined;
  if (!(ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES as readonly string[]).includes(value)) {
    throw new Error(
      `--credential-posture must be one of: ${ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES.join(', ')}.`,
    );
  }
  return value as ActionSurfaceDeclaredCredentialPosture;
}

function manifestSpecsFromArgs(): readonly ManifestInputSpec[] {
  return Object.freeze([
    ...args('manifest').map((path) => ({ path, manifestKind: 'auto' as const })),
    ...args('openapi').map((path) => ({ path, manifestKind: 'openapi' as const })),
    ...args('asyncapi').map((path) => ({ path, manifestKind: 'asyncapi' as const })),
    ...args('mcp-tools').map((path) => ({ path, manifestKind: 'mcp-tools' as const })),
    ...args('workflow').map((path) => ({ path, manifestKind: 'workflow-manifest' as const })),
  ]);
}

function formatList(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

function formatSurfacePlans(packet: ActionSurfaceOnboardingPacket): string {
  if (packet.surfacePlans.length === 0) return '- none';
  return packet.surfacePlans.map((plan) => `## ${plan.actionSurface}

- surface id: ${plan.surfaceId}
- domain: ${plan.domain ?? 'not declared'}
- downstream system: ${plan.downstreamSystem ?? 'not declared'}
- events: ${plan.eventCount}
- declarations: ${plan.declarationCount}
- recommended integration mode: ${plan.recommendedIntegrationMode}
- readiness status: ${plan.readinessStatus}
- bypass risk: ${plan.bypassRisk}
- credential posture: ${plan.credentialPosture}
- artifact kinds: ${plan.artifactKinds.length ? plan.artifactKinds.join(', ') : 'none'}
- next safe step: ${plan.nextSafeStep}
- next onboarding steps:
${formatList([...plan.nextOnboardingSteps])}
- missing controls:
${formatList([...plan.missingControls])}
- no-go reasons:
${formatList([...plan.noGoReasons])}
`).join('\n');
}

function renderReadme(packet: ActionSurfaceOnboardingPacket): string {
  return `# Attestor action surface onboarding packet

Generated at:

- ${packet.generatedAt}

Packet:

- version: ${packet.version}
- status: ${packet.status}
- digest: ${packet.digest}
- manifests: ${packet.manifestCount}
- declarations: ${packet.declarationCount}
- shadow events: ${packet.eventCount}
- surfaces: ${packet.profileCount}
- generated artifacts: ${packet.artifactCount}
- readiness results: ${packet.readinessCount}

Safety boundary:

- approval required: ${packet.approvalRequired}
- auto enforce: ${packet.autoEnforce}
- raw payload stored: ${packet.rawPayloadStored}
- production ready: ${packet.productionReady}
- execution plan only: ${packet.executionPlanOnly}
- deploys infrastructure: ${packet.deploysInfrastructure}
- issues credentials: ${packet.issuesCredentials}
- activates enforcement: ${packet.activatesEnforcement}
- non-bypassable claim allowed: ${packet.nonBypassableClaimAllowed}

Limitations:

${formatList([...packet.limitations])}

# Surface plans

${formatSurfacePlans(packet)}

# Review flow

1. Review the surface plans above.
2. Review generated artifact templates in \`summary.json\`.
3. Add shadow capture where event coverage is missing.
4. Close credential, verifier, gateway, policy simulation, red-team replay, and customer approval blockers.
5. Re-render this packet before any scoped enforcement review.
`;
}

export function renderActionSurfaceOnboardingPacket(
  options: RenderActionSurfaceOnboardingPacketOptions = {},
): RenderedActionSurfaceOnboardingPacket {
  const outputDir = resolve(
    options.outputDir
      ?? arg('output-dir', env('ATTESTOR_ACTION_SURFACE_ONBOARDING_OUTPUT_DIR') ?? '.attestor/action-surface-onboarding/latest')!,
  );
  const manifests = options.manifests ?? manifestSpecsFromArgs();
  const defaultDomain = options.defaultDomain ?? arg('default-domain', env('ATTESTOR_ACTION_SURFACE_DEFAULT_DOMAIN'));
  const downstreamSystem = options.downstreamSystem ?? arg('downstream-system', env('ATTESTOR_ACTION_SURFACE_DOWNSTREAM_SYSTEM'));
  const manifestCredentialPosture = credentialPosture(
    options.credentialPosture ?? arg('credential-posture', env('ATTESTOR_ACTION_SURFACE_CREDENTIAL_POSTURE')),
  );
  const declarationsPath = options.declarationsPath ?? arg('declarations', env('ATTESTOR_ACTION_SURFACE_DECLARATIONS_PATH'));
  const shadowEventsPath = options.shadowEventsPath ?? arg('shadow-events', env('ATTESTOR_ACTION_SURFACE_SHADOW_EVENTS_PATH'));
  const readinessOverridesPath = options.readinessOverridesPath ?? arg('readiness-overrides', env('ATTESTOR_ACTION_SURFACE_READINESS_OVERRIDES_PATH'));

  const packet = createActionSurfaceOnboardingPacket({
    generatedAt: options.generatedAt ?? arg('generated-at', env('ATTESTOR_ACTION_SURFACE_ONBOARDING_GENERATED_AT')),
    attestorBaseUrl: options.attestorBaseUrl ?? arg('attestor-base-url', env('ATTESTOR_BASE_URL')),
    manifests: manifests.map((manifest) => ({
      text: readFileSync(resolve(manifest.path), 'utf8'),
      sourceRef: manifest.path,
      manifestKind: manifest.manifestKind ?? 'auto',
      defaultDomain,
      downstreamSystem,
      credentialPosture: manifestCredentialPosture,
    })),
    declarations: declarationsPath
      ? readJsonArray<ActionSurfaceDeclaration>(declarationsPath, '--declarations')
      : undefined,
    events: shadowEventsPath
      ? readJsonArray<ShadowAdmissionEvent>(shadowEventsPath, '--shadow-events')
      : undefined,
    readinessOverrides: readinessOverridesPath
      ? readJsonArray<ActionSurfaceOnboardingReadinessOverride>(readinessOverridesPath, '--readiness-overrides')
      : undefined,
  });

  mkdirSync(outputDir, { recursive: true });
  const summaryPath = resolve(outputDir, 'summary.json');
  const readmePath = resolve(outputDir, 'README.md');
  writeFileSync(summaryPath, `${stringifySecretSafe(packet)}\n`, 'utf8');
  writeFileSync(readmePath, renderReadme(packet), 'utf8');

  return Object.freeze({
    packet,
    artifacts: Object.freeze({
      outputDir,
      summaryPath,
      readmePath,
    }),
  });
}

function printUsage(): void {
  console.log(`Usage:
  npm run render:action-surface-onboarding-packet -- --openapi=path/to/openapi.yaml --output-dir=.attestor/action-surface-onboarding/latest

Inputs:
  --manifest=<path>              Auto-detect OpenAPI, AsyncAPI, MCP tools, or workflow manifest.
  --openapi=<path>               Add an OpenAPI manifest.
  --asyncapi=<path>              Add an AsyncAPI manifest.
  --mcp-tools=<path>             Add an MCP tools manifest.
  --workflow=<path>              Add a workflow manifest.
  --declarations=<path>          Add JSON array of action surface declarations.
  --shadow-events=<path>         Add JSON array of redacted shadow admission events.
  --readiness-overrides=<path>   Add JSON array of reviewed readiness override signals.

Options:
  --output-dir=<path>            Default: .attestor/action-surface-onboarding/latest
  --attestor-base-url=<url>      HTTPS base URL used in review-draft templates.
  --default-domain=<domain>      Optional default domain for manifest declarations.
  --downstream-system=<name>     Optional downstream system label.
  --credential-posture=<posture> Optional credential posture for manifest declarations.

The renderer writes summary.json and README.md. It does not deploy gateways,
issue credentials, activate enforcement, or claim production readiness.`);
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }
  const result = renderActionSurfaceOnboardingPacket();
  console.log(stringifySecretSafe({
    status: result.packet.status,
    digest: result.packet.digest,
    outputDir: result.artifacts.outputDir,
    summary: result.artifacts.summaryPath,
    readme: result.artifacts.readmePath,
    surfaceCount: result.packet.profileCount,
    artifactCount: result.packet.artifactCount,
    nextFiles: [
      basename(result.artifacts.summaryPath),
      basename(result.artifacts.readmePath),
    ],
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorMessage(error));
    process.exit(1);
  }
}
