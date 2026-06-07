import {
  createRuntimeSignalIntegrationReadinessBridge,
  mapRuntimeSignalToConsequenceCandidate,
  normalizeRuntimeSignal,
  type RuntimeSignalConsequenceCandidate,
  type RuntimeSignalEnvelope,
  type RuntimeSignalGatePlacementKind,
  type RuntimeSignalIntegrationReadinessBridge,
  type RuntimeSignalNormalizerResult,
} from '../../src/consequence-admission/index.js';

export const RUNTIME_SIGNAL_EXAMPLE_PATH_VERSION =
  'attestor.runtime-signal-example-path.v1';

const digestA = `sha256:${'a'.repeat(64)}`;
const digestB = `sha256:${'b'.repeat(64)}`;
const digestC = `sha256:${'c'.repeat(64)}`;
const digestD = `sha256:${'d'.repeat(64)}`;
const eventTime = '2026-05-18T09:30:00Z';
const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';

export interface RuntimeSignalExampleGatePlan {
  readonly mode: RuntimeSignalIntegrationReadinessBridge['mode'];
  readonly placement: RuntimeSignalGatePlacementKind;
  readonly readinessStatus: RuntimeSignalIntegrationReadinessBridge['readiness']['status'];
  readonly nonBypassableClaimAllowed: false;
  readonly missingControls: readonly string[];
  readonly noGoReasons: readonly string[];
}

export interface RuntimeSignalExamplePathStep {
  readonly label: string;
  readonly sourceKind: RuntimeSignalNormalizerResult['sourceKind'];
  readonly normalizedSourceRef: string;
  readonly signalKind: RuntimeSignalEnvelope['signalKind'];
  readonly sourceTrustLevel: RuntimeSignalEnvelope['sourceTrustLevel'];
  readonly signalDigest: string;
  readonly actionSurface: string;
  readonly consequenceClass: RuntimeSignalConsequenceCandidate['consequenceClass'];
  readonly candidateDigest: string;
  readonly recommendedNextStep: RuntimeSignalConsequenceCandidate['recommendedNextStep'];
  readonly gatePlan: RuntimeSignalExampleGatePlan;
}

export interface RuntimeSignalExamplePath {
  readonly version: typeof RUNTIME_SIGNAL_EXAMPLE_PATH_VERSION;
  readonly scope: 'metadata-to-signal-to-candidate-to-gate-plan';
  readonly digestOnly: true;
  readonly reviewMaterialOnly: true;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly steps: readonly RuntimeSignalExamplePathStep[];
}

function summarizeStep(
  label: string,
  normalized: RuntimeSignalNormalizerResult,
): RuntimeSignalExamplePathStep {
  const candidate = mapRuntimeSignalToConsequenceCandidate(normalized.envelope);
  const bridge = createRuntimeSignalIntegrationReadinessBridge({
    envelope: normalized.envelope,
    candidate,
    workflowId: `example:${label}`,
    generatedAt: normalized.envelope.eventTime,
  });

  return Object.freeze({
    label,
    sourceKind: normalized.sourceKind,
    normalizedSourceRef: normalized.normalizedSourceRef,
    signalKind: normalized.envelope.signalKind,
    sourceTrustLevel: normalized.envelope.sourceTrustLevel,
    signalDigest: normalized.envelope.signalDigest,
    actionSurface: candidate.actionSurface,
    consequenceClass: candidate.consequenceClass,
    candidateDigest: candidate.candidateDigest,
    recommendedNextStep: candidate.recommendedNextStep,
    gatePlan: Object.freeze({
      mode: bridge.mode,
      placement: bridge.gatePlacement,
      readinessStatus: bridge.readiness.status,
      nonBypassableClaimAllowed: false,
      missingControls: candidate.missingControls,
      noGoReasons: bridge.readiness.noGoReasons,
    }),
  });
}

export function createRuntimeSignalExamplePath(): RuntimeSignalExamplePath {
  const openApiExport = normalizeRuntimeSignal({
    sourceKind: 'openapi-operation',
    sourceSystem: 'openapi.customer-api',
    eventTime,
    method: 'POST',
    path: '/api/v1/exports',
    operationId: 'createExport',
    inputSchemaDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });

  const mcpExportTool = normalizeRuntimeSignal({
    sourceKind: 'mcp-tool',
    sourceSystem: 'mcp.customer-tools',
    eventTime,
    serverRef: 'customer-mcp-server',
    toolName: 'export_customer_records',
    inputSchemaDigest: digestC,
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });

  const otelExportObservation = normalizeRuntimeSignal({
    sourceKind: 'otel-log',
    sourceSystem: 'otel.customer-gateway',
    eventTime,
    serviceName: 'export-gateway',
    logRecordRef: 'log:export-001',
    traceId,
    eventName: 'POST /api/v1/exports',
    bodyDigest: digestD,
    tenantRefDigest: digestA,
    actorRefDigest: digestB,
    runtimeRef: 'workflow:export-runner',
    actionSurface: 'data-export',
    downstreamSystem: 'export-service',
  });

  return Object.freeze({
    version: RUNTIME_SIGNAL_EXAMPLE_PATH_VERSION,
    scope: 'metadata-to-signal-to-candidate-to-gate-plan',
    digestOnly: true,
    reviewMaterialOnly: true,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    steps: Object.freeze([
      summarizeStep('openapi-export-route', openApiExport),
      summarizeStep('mcp-export-tool', mcpExportTool),
      summarizeStep('otel-export-observation', otelExportObservation),
    ]),
  });
}

if (process.argv[1]?.endsWith('metadata-to-gate-plan.ts')) {
  console.log(JSON.stringify(createRuntimeSignalExamplePath(), null, 2));
}
