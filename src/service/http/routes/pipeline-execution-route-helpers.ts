import { createHash } from 'node:crypto';
import type {
  ConnectorExecutionResult,
} from '../../../connectors/connector-interface.js';
import type { SchemaAttestation } from '../../../connectors/schema-attestation.js';
import type { ExecutionEvidence } from '../../../financial/types.js';
import type { KeylessSigner } from '../../../signing/keyless-signer.js';
import type {
  FinanceFilingReleaseCandidate,
} from '../../../release-layer/finance.js';
import type {
  CapabilityBoundaryDescriptor,
  OutputContractDescriptor,
  ReleaseActorReference,
  ReleaseEvaluationRequest,
  ReleaseEvaluationScopeContext,
  ReleaseTargetKind,
} from '../../../release-layer/index.js';

type ConnectorSchemaAttestation = NonNullable<ConnectorExecutionResult['schemaAttestation']>;

export type PipelineConnectorExecution = ExecutionEvidence & {
  schemaAttestation?: ConnectorSchemaAttestation | SchemaAttestation | null;
};

export interface RequestSignerPair {
  signer: KeylessSigner;
  reviewer: KeylessSigner;
}

interface ReleaseMaterialShape {
  readonly target: {
    readonly kind: ReleaseTargetKind;
    readonly id: string;
    readonly displayName?: string;
  };
  readonly outputContract: OutputContractDescriptor;
  readonly capabilityBoundary: CapabilityBoundaryDescriptor;
  readonly hashBundle: {
    readonly outputHash: string;
    readonly consequenceHash: string;
  };
}

interface ReleaseShadowSummary {
  readonly targetId: string;
  readonly decisionId: string;
  readonly decisionStatus: string;
  readonly policyVersion: string;
  readonly policyRolloutMode: string | null;
  readonly policyEvaluationMode: string | null;
  readonly wouldBlockIfEnforced: boolean;
  readonly wouldRequireReview: boolean;
  readonly wouldRequireToken: boolean;
  readonly outputHash: string;
  readonly consequenceHash: string;
}

export interface FinanceCommunicationReleaseSummary extends ReleaseShadowSummary {
  readonly preview: {
    readonly recipientId: string;
    readonly channelId: string;
    readonly subject: string;
  };
}

export interface FinanceActionReleaseSummary extends ReleaseShadowSummary {
  readonly preview: {
    readonly workflowId: string;
    readonly actionType: string;
    readonly requestedTransition: string;
  };
}

export interface FinanceFilingReleaseSummary {
  readonly targetId: string;
  readonly decisionId: string;
  readonly decisionStatus: string;
  readonly policyVersion: string;
  readonly introspectionRequired: boolean;
  readonly outputHash: string;
  readonly consequenceHash: string;
  readonly tokenId: string | null;
  readonly token: string | null;
  readonly expiresAt: string | null;
  readonly evidencePackId: string | null;
  readonly evidencePackPath: string | null;
  readonly evidencePackDigest: string | null;
  readonly reviewQueueId: string | null;
  readonly reviewQueuePath: string | null;
  readonly tenantId: string;
  readonly senderConstrained: boolean;
  readonly presentationRequired: 'sender-constrained' | null;
  readonly tokenIssueStatus: 'not-required' | 'issued' | 'blocked';
  readonly reasonCodes: readonly string[];
  readonly candidate: FinanceFilingReleaseCandidate;
}

function connectorSchemaHash(result: ConnectorExecutionResult): string {
  return createHash('sha256')
    .update(JSON.stringify({ columns: result.columns, columnTypes: result.columnTypes }))
    .digest('hex')
    .slice(0, 16);
}

const STRICT_SHA256_ARTIFACT_DIGEST = /^sha256:[0-9a-f]{64}$/u;

export function financeEvidenceChainArtifactDigest(runId: string, terminalHash: string): string {
  const normalized = terminalHash.trim();
  if (STRICT_SHA256_ARTIFACT_DIGEST.test(normalized)) {
    return normalized;
  }
  return `sha256:${createHash('sha256')
    .update(JSON.stringify({ runId, terminalHash: normalized }))
    .digest('hex')}`;
}

function supportedExecutionProvider(provider: string): ExecutionEvidence['provider'] {
  return provider === 'fixture' || provider === 'sqlite' || provider === 'postgres'
    ? provider
    : undefined;
}

export function connectorExecutionEvidenceFromResult(
  result: ConnectorExecutionResult,
): PipelineConnectorExecution {
  return {
    success: result.success,
    durationMs: result.durationMs,
    rowCount: result.rowCount,
    columns: result.columns,
    columnTypes: result.columnTypes,
    rows: result.rows,
    error: result.error,
    schemaHash: connectorSchemaHash(result),
    provider: supportedExecutionProvider(result.provider),
    executionContextHash: result.executionContextHash,
    schemaAttestation: result.schemaAttestation ?? null,
  };
}

export function releaseEvaluationRequest(input: {
  id: string;
  createdAt: string;
  material: ReleaseMaterialShape;
  requester: ReleaseActorReference;
  context: ReleaseEvaluationScopeContext;
}): ReleaseEvaluationRequest {
  return {
    id: input.id,
    createdAt: input.createdAt,
    outputHash: input.material.hashBundle.outputHash,
    consequenceHash: input.material.hashBundle.consequenceHash,
    outputContract: input.material.outputContract,
    capabilityBoundary: input.material.capabilityBoundary,
    requester: input.requester,
    context: input.context,
    target: input.material.target,
  };
}
