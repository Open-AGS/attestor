import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ACTION_SURFACE_DECLARED_CREDENTIAL_POSTURES,
  createPolicyFoundrySelfOnboardingCliPacket,
  type ActionSurfaceDeclaration,
  type ActionSurfaceDeclaredCredentialPosture,
  type ActionSurfaceManifestKind,
  type ActionSurfaceOnboardingReadinessOverride,
  type PolicyFoundrySelfOnboardingCliPacket,
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

export interface RenderPolicyFoundrySelfOnboardingOptions {
  readonly outputDir?: string;
  readonly generatedAt?: string;
  readonly sessionId?: string;
  readonly tenantId?: string;
  readonly reviewerRef?: string;
  readonly attestorBaseUrl?: string;
  readonly manifests?: readonly ManifestInputSpec[];
  readonly declarationsPath?: string;
  readonly shadowEventsPath?: string;
  readonly readinessOverridesPath?: string;
  readonly defaultDomain?: string;
  readonly downstreamSystem?: string;
  readonly credentialPosture?: string;
}

export interface RenderedPolicyFoundrySelfOnboarding {
  readonly packet: PolicyFoundrySelfOnboardingCliPacket;
  readonly artifacts: {
    readonly outputDir: string;
    readonly summaryPath: string;
    readonly readmePath: string;
    readonly onboardingPacketPath: string;
    readonly onboardingSessionPath: string;
    readonly coveragePath: string;
    readonly gatePlannerPath: string;
    readonly reviewHandoffPath: string;
    readonly redTeamFixturesPath: string;
    readonly reviewOnlyPatchPackPath: string;
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

function renderReadme(packet: PolicyFoundrySelfOnboardingCliPacket): string {
  return `# Attestor Policy Foundry self-onboarding packet

Generated at:

- ${packet.generatedAt}

Packet:

- version: ${packet.version}
- status: ${packet.status}
- digest: ${packet.digest}
- surfaces: ${packet.surfaceCount}
- shadow events: ${packet.shadowEventCount}
- coverage score: ${packet.coverageScore}
- gate plan status: ${packet.gatePlanStatus}
- review patch drafts: ${packet.patchCount}
- red-team fixture cases: ${packet.redTeamCaseCount}
- blockers: ${packet.blockerCount}
- next safe step: ${packet.nextSafeStep}

Safety boundary:

- approval required: ${packet.approvalRequired}
- auto enforce: ${packet.autoEnforce}
- raw payload stored: ${packet.rawPayloadStored}
- production ready: ${packet.productionReady}
- execution plan only: ${packet.executionPlanOnly}
- applies patches: ${packet.appliesPatches}
- deploys infrastructure: ${packet.deploysInfrastructure}
- issues credentials: ${packet.issuesCredentials}
- activates enforcement: ${packet.activatesEnforcement}
- non-bypassable claim allowed: ${packet.nonBypassableClaimAllowed}
- review material only: ${packet.reviewMaterialOnly}

# Source digests

- onboarding packet: ${packet.sourceDigests.onboardingPacketDigest}
- onboarding session: ${packet.sourceDigests.onboardingSessionDigest}
- coverage score: ${packet.sourceDigests.coverageScoreDigest}
- gate planner: ${packet.sourceDigests.gatePlannerDigest}
- review handoff: ${packet.sourceDigests.reviewHandoffDigest}
- red-team fixtures: ${packet.sourceDigests.redTeamFixtureDigest}
- review-only patch pack: ${packet.sourceDigests.reviewOnlyPatchPackDigest}

# Blockers

${formatList([...packet.blockers])}

# Review artifacts

- \`onboarding-packet.json\`
- \`onboarding-session.json\`
- \`coverage-score.json\`
- \`gate-planner.json\`
- \`review-handoff.json\`
- \`red-team-fixtures.json\`
- \`review-only-patch-pack.json\`

# Limitations

${formatList([...packet.limitations])}
`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${stringifySecretSafe(value)}\n`, 'utf8');
}

export function renderPolicyFoundrySelfOnboarding(
  options: RenderPolicyFoundrySelfOnboardingOptions = {},
): RenderedPolicyFoundrySelfOnboarding {
  const outputDir = resolve(
    options.outputDir
      ?? arg('output-dir', env('ATTESTOR_POLICY_FOUNDRY_SELF_ONBOARDING_OUTPUT_DIR') ?? '.attestor/policy-foundry/self-onboarding/latest')!,
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

  const packet = createPolicyFoundrySelfOnboardingCliPacket({
    generatedAt: options.generatedAt ?? arg('generated-at', env('ATTESTOR_POLICY_FOUNDRY_SELF_ONBOARDING_GENERATED_AT')),
    sessionId: options.sessionId ?? arg('session-id', env('ATTESTOR_POLICY_FOUNDRY_SESSION_ID')),
    tenantId: options.tenantId ?? arg('tenant-id', env('ATTESTOR_POLICY_FOUNDRY_TENANT_ID')),
    reviewerRef: options.reviewerRef ?? arg('reviewer-ref', env('ATTESTOR_POLICY_FOUNDRY_REVIEWER_REF')),
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
  const artifacts = {
    outputDir,
    summaryPath: resolve(outputDir, 'summary.json'),
    readmePath: resolve(outputDir, 'README.md'),
    onboardingPacketPath: resolve(outputDir, 'onboarding-packet.json'),
    onboardingSessionPath: resolve(outputDir, 'onboarding-session.json'),
    coveragePath: resolve(outputDir, 'coverage-score.json'),
    gatePlannerPath: resolve(outputDir, 'gate-planner.json'),
    reviewHandoffPath: resolve(outputDir, 'review-handoff.json'),
    redTeamFixturesPath: resolve(outputDir, 'red-team-fixtures.json'),
    reviewOnlyPatchPackPath: resolve(outputDir, 'review-only-patch-pack.json'),
  } as const;

  writeJson(artifacts.summaryPath, packet);
  writeFileSync(artifacts.readmePath, renderReadme(packet), 'utf8');
  writeJson(artifacts.onboardingPacketPath, packet.onboardingPacket);
  writeJson(artifacts.onboardingSessionPath, packet.onboardingSession);
  writeJson(artifacts.coveragePath, packet.coverage);
  writeJson(artifacts.gatePlannerPath, packet.gatePlanner);
  writeJson(artifacts.reviewHandoffPath, packet.reviewHandoff);
  writeJson(artifacts.redTeamFixturesPath, packet.redTeamFixtures);
  writeJson(artifacts.reviewOnlyPatchPackPath, packet.reviewOnlyPatchPack);

  return Object.freeze({ packet, artifacts: Object.freeze(artifacts) });
}

function printUsage(): void {
  console.log(`Usage:
  npm run policy-foundry:self-onboard -- --openapi=path/to/openapi.yaml --output-dir=.attestor/policy-foundry/self-onboarding/latest

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
  --output-dir=<path>            Default: .attestor/policy-foundry/self-onboarding/latest
  --session-id=<id>              Optional stable onboarding session id.
  --tenant-id=<id>               Optional tenant id; output stores only a digest.
  --reviewer-ref=<ref>           Optional reviewer reference.
  --attestor-base-url=<url>      HTTPS base URL used in review-draft templates.
  --default-domain=<domain>      Optional default domain for manifest declarations.
  --downstream-system=<name>     Optional downstream system label.
  --credential-posture=<posture> Optional credential posture for manifest declarations.

The renderer writes review material only. It does not apply patches, deploy
gateways, issue credentials, activate enforcement, or claim production readiness.`);
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }
  const result = renderPolicyFoundrySelfOnboarding();
  console.log(stringifySecretSafe({
    status: result.packet.status,
    digest: result.packet.digest,
    outputDir: result.artifacts.outputDir,
    summary: result.artifacts.summaryPath,
    readme: result.artifacts.readmePath,
    surfaceCount: result.packet.surfaceCount,
    coverageScore: result.packet.coverageScore,
    blockerCount: result.packet.blockerCount,
    patchCount: result.packet.patchCount,
    redTeamCaseCount: result.packet.redTeamCaseCount,
    nextFiles: [
      basename(result.artifacts.summaryPath),
      basename(result.artifacts.readmePath),
      basename(result.artifacts.onboardingSessionPath),
      basename(result.artifacts.coveragePath),
      basename(result.artifacts.gatePlannerPath),
      basename(result.artifacts.reviewOnlyPatchPackPath),
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
