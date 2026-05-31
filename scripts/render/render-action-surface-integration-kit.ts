import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES,
  createActionSurfaceIntegrationKitArtifactDraftBundle,
  createActionSurfaceIntegrationKitMcpGatewayDraftBundle,
  createActionSurfaceIntegrationKitNoBypassProbeBundle,
  createActionSurfaceIntegrationKitPacket,
  createActionSurfaceOnboardingPacket,
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
  type ActionSurfaceManifestKind,
  type ActionSurfaceOnboardingReadinessOverride,
  type ShadowAdmissionEvent,
} from '../../src/consequence-admission/index.js';
import {
  safeErrorMessage,
  stringifySecretSafe,
} from '../lib/secret-safe-output.ts';

type ManifestInputSpec = {
  readonly path: string;
  readonly manifestKind?: ActionSurfaceManifestKind | 'auto';
};

export interface RenderActionSurfaceIntegrationKitOptions {
  readonly outputDir?: string;
  readonly generatedAt?: string;
  readonly attestorBaseUrl?: string;
  readonly targetOpenApiRef?: string;
  readonly manifests?: readonly ManifestInputSpec[];
  readonly declarations?: readonly ActionSurfaceDeclaration[];
  readonly declarationsPath?: string;
  readonly shadowEvents?: readonly ShadowAdmissionEvent[];
  readonly shadowEventsPath?: string;
  readonly readinessOverrides?: readonly ActionSurfaceOnboardingReadinessOverride[];
  readonly readinessOverridesPath?: string;
  readonly defaultDomain?: string;
  readonly downstreamSystem?: string;
  readonly credentialPosture?: string;
}

export interface RenderedActionSurfaceIntegrationKit {
  readonly kit: ReturnType<typeof createActionSurfaceIntegrationKitPacket>;
  readonly artifacts: {
    readonly outputDir: string;
    readonly readmePath: string;
    readonly summaryPath: string;
    readonly artifactManifestPath: string;
    readonly noBypassProbesPath: string;
    readonly approvalRecordTemplatePath: string;
    readonly artifactsDir: string;
    readonly openApiOverlayPath: string;
    readonly envoyExtAuthzPath: string;
    readonly mcpGatewayDraftsPath: string;
    readonly noBypassProbeBundlePath: string;
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

function renderReadme(input: {
  readonly kit: RenderedActionSurfaceIntegrationKit['kit'];
  readonly artifactDrafts:
    ReturnType<typeof createActionSurfaceIntegrationKitArtifactDraftBundle>;
  readonly mcpGatewayDrafts:
    ReturnType<typeof createActionSurfaceIntegrationKitMcpGatewayDraftBundle>;
  readonly noBypassProbeBundle:
    ReturnType<typeof createActionSurfaceIntegrationKitNoBypassProbeBundle>;
}): string {
  const { kit, artifactDrafts, mcpGatewayDrafts, noBypassProbeBundle } = input;
  return `# Attestor action surface integration kit

Generated at:

- ${kit.generatedAt}

Packet:

- version: ${kit.version}
- status: ${kit.status}
- digest: ${kit.digest}
- source packet digest: ${kit.sourcePacketDigest}
- surfaces: ${kit.summary.surfaceCount}
- generated artifacts: ${kit.artifactManifest.artifactCount}
- no-bypass probe cases: ${kit.noBypassProbePlan.probeCaseCount}

Safety boundary:

- approval required: ${kit.approvalRequired}
- auto enforce: ${kit.autoEnforce}
- raw payload stored: ${kit.rawPayloadStored}
- production ready: ${kit.productionReady}
- execution plan only: ${kit.executionPlanOnly}
- deploys infrastructure: ${kit.deploysInfrastructure}
- issues credentials: ${kit.issuesCredentials}
- activates enforcement: ${kit.activatesEnforcement}
- non-bypassable claim allowed: ${kit.nonBypassableClaimAllowed}

Generated review files:

- summary.json
- artifact-manifest.json
- no-bypass-probes.json
- approval-record.template.json
- artifacts/openapi-overlay.json
- artifacts/envoy-ext-authz.json
- artifacts/mcp-gateway-drafts.json
- artifacts/no-bypass-probe-bundle.json

Review status:

- OpenAPI routes: ${artifactDrafts.routeCount}
- MCP tool drafts: ${mcpGatewayDrafts.toolCount}
- no-bypass probe bundle cases: ${noBypassProbeBundle.probeCaseCount}
- probe bundle executes probes: ${noBypassProbeBundle.executesProbes}
- proof result recorded: ${noBypassProbeBundle.proofResultRecorded}

Limitations:

${formatList([...kit.limitations, ...noBypassProbeBundle.limitations])}

Next safe step:

1. Review the generated files above.
2. Confirm the customer stop point and credential boundary.
3. Run customer-approved probes separately.
4. Bind probe results back to packet and artifact digests.

This renderer does not apply infrastructure, expose tools, run probes, issue
credentials, activate enforcement, or prove customer PEP no-bypass.
`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${stringifySecretSafe(value)}\n`, 'utf8');
}

export function renderActionSurfaceIntegrationKit(
  options: RenderActionSurfaceIntegrationKitOptions = {},
): RenderedActionSurfaceIntegrationKit {
  const outputDir = resolve(
    options.outputDir
      ?? arg(
        'output-dir',
        env('ATTESTOR_ACTION_SURFACE_INTEGRATION_KIT_OUTPUT_DIR')
          ?? '.attestor/action-surface-integration-kit/latest',
      )!,
  );
  const generatedAt = options.generatedAt
    ?? arg('generated-at', env('ATTESTOR_ACTION_SURFACE_INTEGRATION_KIT_GENERATED_AT'));
  const manifests = options.manifests ?? manifestSpecsFromArgs();
  const defaultDomain = options.defaultDomain
    ?? arg('default-domain', env('ATTESTOR_ACTION_SURFACE_DEFAULT_DOMAIN'));
  const downstreamSystem = options.downstreamSystem
    ?? arg('downstream-system', env('ATTESTOR_ACTION_SURFACE_DOWNSTREAM_SYSTEM'));
  const manifestCredentialPosture = credentialPosture(
    options.credentialPosture
      ?? arg('credential-posture', env('ATTESTOR_ACTION_SURFACE_CREDENTIAL_POSTURE')),
  );
  const declarationsPath = options.declarationsPath
    ?? arg('declarations', env('ATTESTOR_ACTION_SURFACE_DECLARATIONS_PATH'));
  const shadowEventsPath = options.shadowEventsPath
    ?? arg('shadow-events', env('ATTESTOR_ACTION_SURFACE_SHADOW_EVENTS_PATH'));
  const readinessOverridesPath = options.readinessOverridesPath
    ?? arg('readiness-overrides', env('ATTESTOR_ACTION_SURFACE_READINESS_OVERRIDES_PATH'));
  const targetOpenApiRef = options.targetOpenApiRef
    ?? arg('target-openapi', env('ATTESTOR_ACTION_SURFACE_TARGET_OPENAPI_REF'));

  const onboardingPacket = createActionSurfaceOnboardingPacket({
    generatedAt,
    attestorBaseUrl: options.attestorBaseUrl ?? arg('attestor-base-url', env('ATTESTOR_BASE_URL')),
    manifests: manifests.map((manifest) => ({
      text: readFileSync(resolve(manifest.path), 'utf8'),
      sourceRef: manifest.path,
      manifestKind: manifest.manifestKind ?? 'auto',
      defaultDomain,
      downstreamSystem,
      credentialPosture: manifestCredentialPosture,
    })),
    declarations: options.declarations ?? (declarationsPath
      ? readJsonArray<ActionSurfaceDeclaration>(declarationsPath, '--declarations')
      : undefined),
    events: options.shadowEvents ?? (shadowEventsPath
      ? readJsonArray<ShadowAdmissionEvent>(shadowEventsPath, '--shadow-events')
      : undefined),
    readinessOverrides: options.readinessOverrides ?? (readinessOverridesPath
      ? readJsonArray<ActionSurfaceOnboardingReadinessOverride>(
        readinessOverridesPath,
        '--readiness-overrides',
      )
      : undefined),
  });
  const kit = createActionSurfaceIntegrationKitPacket({
    packet: onboardingPacket,
    generatedAt,
  });
  const artifactDrafts = createActionSurfaceIntegrationKitArtifactDraftBundle({
    kit,
    generatedAt,
    targetOpenApiRef,
  });
  const mcpGatewayDrafts = createActionSurfaceIntegrationKitMcpGatewayDraftBundle({
    kit,
    generatedAt,
  });
  const noBypassProbeBundle = createActionSurfaceIntegrationKitNoBypassProbeBundle({
    kit,
    generatedAt,
  });

  const artifactsDir = resolve(outputDir, 'artifacts');
  mkdirSync(artifactsDir, { recursive: true });

  const readmePath = resolve(outputDir, 'README.md');
  const summaryPath = resolve(outputDir, 'summary.json');
  const artifactManifestPath = resolve(outputDir, 'artifact-manifest.json');
  const noBypassProbesPath = resolve(outputDir, 'no-bypass-probes.json');
  const approvalRecordTemplatePath = resolve(outputDir, 'approval-record.template.json');
  const openApiOverlayPath = resolve(artifactsDir, 'openapi-overlay.json');
  const envoyExtAuthzPath = resolve(artifactsDir, 'envoy-ext-authz.json');
  const mcpGatewayDraftsPath = resolve(artifactsDir, 'mcp-gateway-drafts.json');
  const noBypassProbeBundlePath = resolve(artifactsDir, 'no-bypass-probe-bundle.json');

  writeFileSync(
    readmePath,
    renderReadme({ kit, artifactDrafts, mcpGatewayDrafts, noBypassProbeBundle }),
    'utf8',
  );
  writeJson(summaryPath, kit.summary);
  writeJson(artifactManifestPath, kit.artifactManifest);
  writeJson(noBypassProbesPath, kit.noBypassProbePlan);
  writeJson(approvalRecordTemplatePath, kit.approvalRecordTemplate);
  writeJson(openApiOverlayPath, artifactDrafts.openApiOverlay);
  writeJson(envoyExtAuthzPath, artifactDrafts.envoyExtAuthz);
  writeJson(mcpGatewayDraftsPath, mcpGatewayDrafts);
  writeJson(noBypassProbeBundlePath, noBypassProbeBundle);

  return Object.freeze({
    kit,
    artifacts: Object.freeze({
      outputDir,
      readmePath,
      summaryPath,
      artifactManifestPath,
      noBypassProbesPath,
      approvalRecordTemplatePath,
      artifactsDir,
      openApiOverlayPath,
      envoyExtAuthzPath,
      mcpGatewayDraftsPath,
      noBypassProbeBundlePath,
    }),
  });
}

function printUsage(): void {
  console.log(`Usage:
  npm run render:action-surface-integration-kit -- \\
    --openapi=path/to/openapi.yaml \\
    --output-dir=.attestor/action-surface-integration-kit/latest

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
  --output-dir=<path>            Default: .attestor/action-surface-integration-kit/latest
  --target-openapi=<ref>         Customer OpenAPI ref for overlay draft metadata.
  --attestor-base-url=<url>      HTTPS base URL used in review-draft templates.
  --default-domain=<domain>      Optional default domain for manifest declarations.
  --downstream-system=<name>     Optional downstream system label.
  --credential-posture=<posture> Optional credential posture for manifest declarations.

The renderer writes review files only. It does not deploy gateways, issue
credentials, run probes, activate enforcement, or claim production readiness.`);
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }
  const result = renderActionSurfaceIntegrationKit();
  console.log(stringifySecretSafe({
    status: result.kit.status,
    digest: result.kit.digest,
    outputDir: result.artifacts.outputDir,
    readme: result.artifacts.readmePath,
    summary: result.artifacts.summaryPath,
    artifactManifest: result.artifacts.artifactManifestPath,
    noBypassProbes: result.artifacts.noBypassProbesPath,
    approvalRecordTemplate: result.artifacts.approvalRecordTemplatePath,
    artifacts: [
      basename(result.artifacts.openApiOverlayPath),
      basename(result.artifacts.envoyExtAuthzPath),
      basename(result.artifacts.mcpGatewayDraftsPath),
      basename(result.artifacts.noBypassProbeBundlePath),
    ],
    surfaceCount: result.kit.summary.surfaceCount,
    probeCaseCount: result.kit.noBypassProbePlan.probeCaseCount,
    deploysInfrastructure: result.kit.deploysInfrastructure,
    activatesEnforcement: result.kit.activatesEnforcement,
    nonBypassableClaimAllowed: result.kit.nonBypassableClaimAllowed,
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
