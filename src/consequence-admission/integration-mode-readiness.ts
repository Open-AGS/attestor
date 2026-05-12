import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionDomain,
} from './taxonomy.js';

export const ATTESTOR_INTEGRATION_MODE_READINESS_VERSION =
  'attestor.integration-mode-readiness.v1';

export const ATTESTOR_INTEGRATION_MODES = [
  'advisory-api',
  'shadow-capture-sdk',
  'sdk-gate',
  'gateway-proxy',
  'mcp-tool-gateway',
  'sidecar-ext-authz',
  'provider-native-connector',
] as const;
export type AttestorIntegrationMode = typeof ATTESTOR_INTEGRATION_MODES[number];

export const ATTESTOR_CREDENTIAL_ISOLATION_POSTURES = [
  'not-required',
  'agent-held-static-secret',
  'agent-held-scoped-secret',
  'short-lived-downscoped-token',
  'gateway-held-secret',
  'provider-native-delegation',
] as const;
export type AttestorCredentialIsolationPosture =
  typeof ATTESTOR_CREDENTIAL_ISOLATION_POSTURES[number];

export const ATTESTOR_INTEGRATION_BYPASS_RISKS = [
  'critical',
  'high',
  'medium',
  'low',
] as const;
export type AttestorIntegrationBypassRisk =
  typeof ATTESTOR_INTEGRATION_BYPASS_RISKS[number];

export const ATTESTOR_INTEGRATION_READINESS_STATUSES = [
  'no-go',
  'shadow-ready',
  'advisory-only',
  'enforcement-incomplete',
  'scoped-enforce-eligible',
] as const;
export type AttestorIntegrationReadinessStatus =
  typeof ATTESTOR_INTEGRATION_READINESS_STATUSES[number];

export const ATTESTOR_INTEGRATION_NO_GO_REASONS = [
  'missing-admission-call',
  'missing-shadow-capture',
  'missing-downstream-contract',
  'missing-verifier',
  'missing-adapter-or-proxy',
  'agent-direct-credential-exposed',
  'missing-credential-isolation',
  'missing-presentation-binding',
  'missing-replay-protection',
  'missing-idempotency-key',
  'missing-tenant-boundary',
  'missing-policy-simulation',
  'missing-customer-approval',
  'missing-red-team-replay',
  'generated-artifacts-unreviewed',
] as const;
export type AttestorIntegrationNoGoReason =
  typeof ATTESTOR_INTEGRATION_NO_GO_REASONS[number];

export const ATTESTOR_GENERATED_INTEGRATION_ARTIFACT_KINDS = [
  'sdk-snippet',
  'verifier-helper-config',
  'protected-adapter-skeleton',
  'gateway-proxy-config',
  'mcp-tool-gateway-config',
  'sidecar-ext-authz-config',
  'provider-native-connector-plan',
  'credential-isolation-plan',
  'policy-twin-backtest',
  'red-team-replay-fixture',
] as const;
export type AttestorGeneratedIntegrationArtifactKind =
  typeof ATTESTOR_GENERATED_INTEGRATION_ARTIFACT_KINDS[number];

export const ATTESTOR_INTEGRATION_CONTROL_KINDS = [
  'admission-call',
  'shadow-capture',
  'downstream-contract',
  'verifier',
  'protected-adapter',
  'gateway-proxy',
  'mcp-tool-gateway',
  'sidecar-ext-authz',
  'provider-native-connector',
  'presentation-binding',
  'replay-protection',
  'idempotency-key',
  'tenant-boundary',
  'policy-simulation',
  'customer-approval',
  'red-team-replay',
  'generated-artifacts-reviewed',
] as const;
export type AttestorIntegrationControlKind =
  typeof ATTESTOR_INTEGRATION_CONTROL_KINDS[number];

export interface AttestorIntegrationModeSignals {
  readonly admissionCallObserved?: boolean | null;
  readonly shadowCaptureObserved?: boolean | null;
  readonly downstreamContractBound?: boolean | null;
  readonly verifierImplemented?: boolean | null;
  readonly protectedAdapterImplemented?: boolean | null;
  readonly gatewayProxyConfigured?: boolean | null;
  readonly mcpToolGatewayConfigured?: boolean | null;
  readonly sidecarExtAuthzConfigured?: boolean | null;
  readonly providerNativeConnectorConfigured?: boolean | null;
  readonly presentationBindingImplemented?: boolean | null;
  readonly replayProtectionImplemented?: boolean | null;
  readonly idempotencyKeyRequired?: boolean | null;
  readonly tenantBoundaryProven?: boolean | null;
  readonly policySimulationAvailable?: boolean | null;
  readonly customerApprovalRecorded?: boolean | null;
  readonly redTeamReplayPassed?: boolean | null;
  readonly generatedArtifactsReviewed?: boolean | null;
}

export interface EvaluateAttestorIntegrationModeReadinessInput {
  readonly workflowId: string;
  readonly mode: AttestorIntegrationMode;
  readonly credentialIsolation: AttestorCredentialIsolationPosture;
  readonly signals?: AttestorIntegrationModeSignals | null;
  readonly generatedArtifacts?: readonly AttestorGeneratedIntegrationArtifactKind[] | null;
  readonly actionSurface?: string | null;
  readonly domain?: ConsequenceAdmissionDomain | null;
  readonly downstreamSystem?: string | null;
  readonly generatedAt?: string | null;
}

export interface AttestorIntegrationModeControlStatus {
  readonly control: AttestorIntegrationControlKind;
  readonly required: boolean;
  readonly present: boolean;
  readonly failClosed: boolean;
  readonly missingReason: AttestorIntegrationNoGoReason | null;
}

export interface AttestorIntegrationModeProfile {
  readonly mode: AttestorIntegrationMode;
  readonly humanLabel: string;
  readonly enforcementCapable: boolean;
  readonly nonBypassableCandidate: boolean;
  readonly defaultBypassRisk: AttestorIntegrationBypassRisk;
  readonly requiredControls: readonly AttestorIntegrationControlKind[];
  readonly recommendedArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
}

export interface AttestorIntegrationAutomationPlan {
  readonly automationSafe: true;
  readonly safeAutomations: readonly string[];
  readonly approvalGatedAutomations: readonly string[];
  readonly prohibitedAutomations: readonly string[];
}

export interface AttestorIntegrationModeReadiness {
  readonly version: typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION;
  readonly generatedAt: string;
  readonly workflowId: string;
  readonly actionSurface: string | null;
  readonly domain: ConsequenceAdmissionDomain | null;
  readonly downstreamSystem: string | null;
  readonly mode: AttestorIntegrationMode;
  readonly credentialIsolation: AttestorCredentialIsolationPosture;
  readonly profile: AttestorIntegrationModeProfile;
  readonly status: AttestorIntegrationReadinessStatus;
  readonly bypassRisk: AttestorIntegrationBypassRisk;
  readonly nonBypassableClaimAllowed: boolean;
  readonly enforcementCapable: boolean;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly controlStatuses: readonly AttestorIntegrationModeControlStatus[];
  readonly missingControls: readonly AttestorIntegrationControlKind[];
  readonly noGoReasons: readonly AttestorIntegrationNoGoReason[];
  readonly generatedArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
  readonly missingRecommendedArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
  readonly automation: AttestorIntegrationAutomationPlan;
  readonly nextSafeStep: string;
  readonly canonical: string;
  readonly digest: string;
}

export interface AttestorIntegrationModeReadinessDescriptor {
  readonly version: typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION;
  readonly modes: typeof ATTESTOR_INTEGRATION_MODES;
  readonly credentialIsolationPostures: typeof ATTESTOR_CREDENTIAL_ISOLATION_POSTURES;
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly nonBypassableRequiresCredentialIsolation: true;
  readonly generatedArtifactsNeedReview: true;
}

const PROFILE_BY_MODE: Record<AttestorIntegrationMode, AttestorIntegrationModeProfile> = {
  'advisory-api': profile({
    mode: 'advisory-api',
    humanLabel: 'Advisory admission API only',
    enforcementCapable: false,
    nonBypassableCandidate: false,
    defaultBypassRisk: 'critical',
    requiredControls: ['admission-call'],
    recommendedArtifacts: ['sdk-snippet', 'policy-twin-backtest'],
  }),
  'shadow-capture-sdk': profile({
    mode: 'shadow-capture-sdk',
    humanLabel: 'Shadow capture SDK',
    enforcementCapable: false,
    nonBypassableCandidate: false,
    defaultBypassRisk: 'high',
    requiredControls: ['admission-call', 'shadow-capture'],
    recommendedArtifacts: ['sdk-snippet', 'policy-twin-backtest', 'red-team-replay-fixture'],
  }),
  'sdk-gate': profile({
    mode: 'sdk-gate',
    humanLabel: 'Customer SDK gate',
    enforcementCapable: true,
    nonBypassableCandidate: false,
    defaultBypassRisk: 'medium',
    requiredControls: [
      'admission-call',
      'downstream-contract',
      'verifier',
      'presentation-binding',
      'replay-protection',
      'idempotency-key',
      'tenant-boundary',
      'policy-simulation',
      'customer-approval',
      'red-team-replay',
      'generated-artifacts-reviewed',
    ],
    recommendedArtifacts: [
      'sdk-snippet',
      'verifier-helper-config',
      'protected-adapter-skeleton',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
  }),
  'gateway-proxy': profile({
    mode: 'gateway-proxy',
    humanLabel: 'Gateway proxy',
    enforcementCapable: true,
    nonBypassableCandidate: true,
    defaultBypassRisk: 'low',
    requiredControls: [
      'admission-call',
      'downstream-contract',
      'verifier',
      'gateway-proxy',
      'presentation-binding',
      'replay-protection',
      'idempotency-key',
      'tenant-boundary',
      'policy-simulation',
      'customer-approval',
      'red-team-replay',
      'generated-artifacts-reviewed',
    ],
    recommendedArtifacts: [
      'gateway-proxy-config',
      'verifier-helper-config',
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
  }),
  'mcp-tool-gateway': profile({
    mode: 'mcp-tool-gateway',
    humanLabel: 'MCP tool gateway',
    enforcementCapable: true,
    nonBypassableCandidate: true,
    defaultBypassRisk: 'low',
    requiredControls: [
      'admission-call',
      'downstream-contract',
      'verifier',
      'mcp-tool-gateway',
      'presentation-binding',
      'replay-protection',
      'idempotency-key',
      'tenant-boundary',
      'policy-simulation',
      'customer-approval',
      'red-team-replay',
      'generated-artifacts-reviewed',
    ],
    recommendedArtifacts: [
      'mcp-tool-gateway-config',
      'verifier-helper-config',
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
  }),
  'sidecar-ext-authz': profile({
    mode: 'sidecar-ext-authz',
    humanLabel: 'Sidecar external authorization',
    enforcementCapable: true,
    nonBypassableCandidate: true,
    defaultBypassRisk: 'low',
    requiredControls: [
      'admission-call',
      'downstream-contract',
      'verifier',
      'sidecar-ext-authz',
      'presentation-binding',
      'replay-protection',
      'idempotency-key',
      'tenant-boundary',
      'policy-simulation',
      'customer-approval',
      'red-team-replay',
      'generated-artifacts-reviewed',
    ],
    recommendedArtifacts: [
      'sidecar-ext-authz-config',
      'verifier-helper-config',
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
  }),
  'provider-native-connector': profile({
    mode: 'provider-native-connector',
    humanLabel: 'Provider-native connector',
    enforcementCapable: true,
    nonBypassableCandidate: true,
    defaultBypassRisk: 'low',
    requiredControls: [
      'admission-call',
      'downstream-contract',
      'verifier',
      'provider-native-connector',
      'presentation-binding',
      'replay-protection',
      'idempotency-key',
      'tenant-boundary',
      'policy-simulation',
      'customer-approval',
      'red-team-replay',
      'generated-artifacts-reviewed',
    ],
    recommendedArtifacts: [
      'provider-native-connector-plan',
      'verifier-helper-config',
      'credential-isolation-plan',
      'policy-twin-backtest',
      'red-team-replay-fixture',
    ],
  }),
};

const MISSING_REASON_BY_CONTROL: Record<
  AttestorIntegrationControlKind,
  AttestorIntegrationNoGoReason
> = {
  'admission-call': 'missing-admission-call',
  'shadow-capture': 'missing-shadow-capture',
  'downstream-contract': 'missing-downstream-contract',
  verifier: 'missing-verifier',
  'protected-adapter': 'missing-adapter-or-proxy',
  'gateway-proxy': 'missing-adapter-or-proxy',
  'mcp-tool-gateway': 'missing-adapter-or-proxy',
  'sidecar-ext-authz': 'missing-adapter-or-proxy',
  'provider-native-connector': 'missing-adapter-or-proxy',
  'presentation-binding': 'missing-presentation-binding',
  'replay-protection': 'missing-replay-protection',
  'idempotency-key': 'missing-idempotency-key',
  'tenant-boundary': 'missing-tenant-boundary',
  'policy-simulation': 'missing-policy-simulation',
  'customer-approval': 'missing-customer-approval',
  'red-team-replay': 'missing-red-team-replay',
  'generated-artifacts-reviewed': 'generated-artifacts-unreviewed',
};

function profile(value: AttestorIntegrationModeProfile): AttestorIntegrationModeProfile {
  return Object.freeze(value);
}

function canonicalObject(value: CanonicalReleaseJsonValue): {
  readonly canonical: string;
  readonly digest: string;
} {
  const canonical = canonicalizeReleaseJson(value);
  return Object.freeze({
    canonical,
    digest: `sha256:${createHash('sha256').update(canonical).digest('hex')}`,
  });
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Attestor integration mode readiness ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeString(value: string, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Attestor integration mode readiness ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Attestor integration mode readiness ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function normalizeOptionalString(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) return null;
  return normalizeString(value, fieldName);
}

function normalizeMode(mode: AttestorIntegrationMode): AttestorIntegrationMode {
  if (!ATTESTOR_INTEGRATION_MODES.includes(mode)) {
    throw new Error(
      `Attestor integration mode readiness mode must be one of: ${ATTESTOR_INTEGRATION_MODES.join(', ')}.`,
    );
  }
  return mode;
}

function normalizeCredentialIsolation(
  value: AttestorCredentialIsolationPosture,
): AttestorCredentialIsolationPosture {
  if (!ATTESTOR_CREDENTIAL_ISOLATION_POSTURES.includes(value)) {
    throw new Error(
      `Attestor integration mode readiness credentialIsolation must be one of: ${ATTESTOR_CREDENTIAL_ISOLATION_POSTURES.join(', ')}.`,
    );
  }
  return value;
}

function normalizeArtifacts(
  values: readonly AttestorGeneratedIntegrationArtifactKind[] | null | undefined,
): readonly AttestorGeneratedIntegrationArtifactKind[] {
  const artifacts = new Set<AttestorGeneratedIntegrationArtifactKind>();
  for (const value of values ?? []) {
    if (!ATTESTOR_GENERATED_INTEGRATION_ARTIFACT_KINDS.includes(value)) {
      throw new Error(
        `Attestor integration mode readiness generatedArtifacts contains unsupported artifact: ${value}.`,
      );
    }
    artifacts.add(value);
  }
  return Object.freeze([...artifacts].sort());
}

function signalPresent(
  control: AttestorIntegrationControlKind,
  signals: AttestorIntegrationModeSignals,
): boolean {
  switch (control) {
    case 'admission-call':
      return signals.admissionCallObserved === true;
    case 'shadow-capture':
      return signals.shadowCaptureObserved === true;
    case 'downstream-contract':
      return signals.downstreamContractBound === true;
    case 'verifier':
      return signals.verifierImplemented === true;
    case 'protected-adapter':
      return signals.protectedAdapterImplemented === true;
    case 'gateway-proxy':
      return signals.gatewayProxyConfigured === true;
    case 'mcp-tool-gateway':
      return signals.mcpToolGatewayConfigured === true;
    case 'sidecar-ext-authz':
      return signals.sidecarExtAuthzConfigured === true;
    case 'provider-native-connector':
      return signals.providerNativeConnectorConfigured === true;
    case 'presentation-binding':
      return signals.presentationBindingImplemented === true;
    case 'replay-protection':
      return signals.replayProtectionImplemented === true;
    case 'idempotency-key':
      return signals.idempotencyKeyRequired === true;
    case 'tenant-boundary':
      return signals.tenantBoundaryProven === true;
    case 'policy-simulation':
      return signals.policySimulationAvailable === true;
    case 'customer-approval':
      return signals.customerApprovalRecorded === true;
    case 'red-team-replay':
      return signals.redTeamReplayPassed === true;
    case 'generated-artifacts-reviewed':
      return signals.generatedArtifactsReviewed === true;
  }
}

function controlStatus(
  control: AttestorIntegrationControlKind,
  requiredControls: readonly AttestorIntegrationControlKind[],
  signals: AttestorIntegrationModeSignals,
): AttestorIntegrationModeControlStatus {
  const required = requiredControls.includes(control);
  const present = signalPresent(control, signals);
  return Object.freeze({
    control,
    required,
    present,
    failClosed: true,
    missingReason: required && !present ? MISSING_REASON_BY_CONTROL[control] : null,
  });
}

function credentialIsolationMissing(
  credentialIsolation: AttestorCredentialIsolationPosture,
): boolean {
  return credentialIsolation === 'agent-held-static-secret' ||
    credentialIsolation === 'agent-held-scoped-secret';
}

function bypassRisk(input: {
  readonly profile: AttestorIntegrationModeProfile;
  readonly credentialIsolation: AttestorCredentialIsolationPosture;
  readonly missingControls: readonly AttestorIntegrationControlKind[];
}): AttestorIntegrationBypassRisk {
  if (input.credentialIsolation === 'agent-held-static-secret') return 'critical';
  if (input.credentialIsolation === 'agent-held-scoped-secret') return 'high';
  if (!input.profile.enforcementCapable) return input.profile.defaultBypassRisk;
  if (input.missingControls.some((control) =>
    ['verifier', 'downstream-contract', 'gateway-proxy', 'mcp-tool-gateway', 'sidecar-ext-authz', 'provider-native-connector'].includes(control)
  )) {
    return 'high';
  }
  if (input.missingControls.length > 0) return 'medium';
  return input.profile.defaultBypassRisk;
}

function uniqueReasons(
  reasons: readonly AttestorIntegrationNoGoReason[],
): readonly AttestorIntegrationNoGoReason[] {
  return Object.freeze([...new Set(reasons)].sort());
}

function statusFor(input: {
  readonly mode: AttestorIntegrationMode;
  readonly profile: AttestorIntegrationModeProfile;
  readonly bypassRisk: AttestorIntegrationBypassRisk;
  readonly noGoReasons: readonly AttestorIntegrationNoGoReason[];
  readonly missingControls: readonly AttestorIntegrationControlKind[];
  readonly signals: AttestorIntegrationModeSignals;
}): AttestorIntegrationReadinessStatus {
  if (input.noGoReasons.includes('missing-admission-call')) return 'no-go';
  if (input.mode === 'shadow-capture-sdk') {
    return input.signals.shadowCaptureObserved === true ? 'shadow-ready' : 'no-go';
  }
  if (input.mode === 'advisory-api') return 'advisory-only';
  if (input.noGoReasons.includes('agent-direct-credential-exposed')) return 'no-go';
  if (input.bypassRisk === 'critical') return 'no-go';
  if (input.missingControls.length > 0) return 'enforcement-incomplete';
  if (input.profile.enforcementCapable) return 'scoped-enforce-eligible';
  return 'advisory-only';
}

function missingRecommendedArtifacts(input: {
  readonly profile: AttestorIntegrationModeProfile;
  readonly generatedArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
}): readonly AttestorGeneratedIntegrationArtifactKind[] {
  const present = new Set(input.generatedArtifacts);
  return Object.freeze(input.profile.recommendedArtifacts.filter((artifact) => !present.has(artifact)));
}

function automationPlan(): AttestorIntegrationAutomationPlan {
  return Object.freeze({
    automationSafe: true,
    safeAutomations: Object.freeze([
      'discover-action-surface',
      'generate-shadow-capture-snippet',
      'generate-verifier-or-proxy-config',
      'generate-credential-isolation-plan',
      'run-policy-twin-backtest',
      'run-red-team-replay',
      'open-review-packet',
    ]),
    approvalGatedAutomations: Object.freeze([
      'publish-policy-candidate',
      'activate-provider-connector',
      'rotate-or-issue-downstream-credential',
      'promote-to-scoped-enforce',
    ]),
    prohibitedAutomations: Object.freeze([
      'auto-enforce-without-customer-approval',
      'expand-credential-scope',
      'treat-llm-output-as-policy-authority',
      'store-raw-payloads-or-provider-bodies',
      'claim-production-readiness',
    ]),
  });
}

function nextSafeStep(input: {
  readonly status: AttestorIntegrationReadinessStatus;
  readonly mode: AttestorIntegrationMode;
  readonly noGoReasons: readonly AttestorIntegrationNoGoReason[];
  readonly missingArtifacts: readonly AttestorGeneratedIntegrationArtifactKind[];
}): string {
  if (input.status === 'scoped-enforce-eligible') {
    return 'Prepare customer-controlled scoped enforcement review. This contract does not auto-enforce.';
  }
  if (input.noGoReasons.includes('agent-direct-credential-exposed')) {
    return 'Move the downstream credential behind a gateway, proxy, provider connector, or short-lived downscoped credential before enforcement.';
  }
  if (input.noGoReasons.includes('missing-admission-call')) {
    return 'Add the admission or shadow capture call before evaluating policy or enforcement readiness.';
  }
  if (input.noGoReasons.includes('missing-adapter-or-proxy')) {
    return 'Generate and review the adapter, proxy, MCP gateway, sidecar, or provider connector artifact for this mode.';
  }
  if (input.noGoReasons.includes('generated-artifacts-unreviewed')) {
    return 'Review the generated integration artifacts before treating this workflow as enforceable.';
  }
  if (input.missingArtifacts.length > 0) {
    return `Generate the missing integration artifact: ${input.missingArtifacts[0]}.`;
  }
  if (input.mode === 'shadow-capture-sdk') {
    return 'Continue shadow capture until Policy Foundry has enough representative traffic.';
  }
  return 'Resolve the remaining readiness blockers before moving toward enforcement.';
}

export function evaluateAttestorIntegrationModeReadiness(
  input: EvaluateAttestorIntegrationModeReadinessInput,
): AttestorIntegrationModeReadiness {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const workflowId = normalizeString(input.workflowId, 'workflowId');
  const mode = normalizeMode(input.mode);
  const credentialIsolation = normalizeCredentialIsolation(input.credentialIsolation);
  const signals = input.signals ?? {};
  const profile = PROFILE_BY_MODE[mode];
  const generatedArtifacts = normalizeArtifacts(input.generatedArtifacts);
  const controlStatuses = Object.freeze(
    ATTESTOR_INTEGRATION_CONTROL_KINDS.map((control) =>
      controlStatus(control, profile.requiredControls, signals)
    ),
  );
  const missingControls = Object.freeze(
    controlStatuses
      .filter((control) => control.required && !control.present)
      .map((control) => control.control),
  );
  const missingReasons = controlStatuses
    .map((control) => control.missingReason)
    .filter((reason): reason is AttestorIntegrationNoGoReason => reason !== null);
  const credentialReasons: AttestorIntegrationNoGoReason[] = credentialIsolationMissing(credentialIsolation)
    ? ['agent-direct-credential-exposed', 'missing-credential-isolation']
    : [];
  const noGoReasons = uniqueReasons([...missingReasons, ...credentialReasons]);
  const risk = bypassRisk({
    profile,
    credentialIsolation,
    missingControls,
  });
  const status = statusFor({
    mode,
    profile,
    bypassRisk: risk,
    noGoReasons,
    missingControls,
    signals,
  });
  const missingArtifacts = missingRecommendedArtifacts({
    profile,
    generatedArtifacts,
  });
  const nonBypassableClaimAllowed =
    profile.nonBypassableCandidate &&
    risk === 'low' &&
    status === 'scoped-enforce-eligible' &&
    !credentialIsolationMissing(credentialIsolation);
  const payload = {
    version: ATTESTOR_INTEGRATION_MODE_READINESS_VERSION as typeof ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
    generatedAt,
    workflowId,
    actionSurface: normalizeOptionalString(input.actionSurface, 'actionSurface'),
    domain: input.domain ?? null,
    downstreamSystem: normalizeOptionalString(input.downstreamSystem, 'downstreamSystem'),
    mode,
    credentialIsolation,
    profile,
    status,
    bypassRisk: risk,
    nonBypassableClaimAllowed,
    enforcementCapable: profile.enforcementCapable,
    approvalRequired: true as const,
    autoEnforce: false as const,
    rawPayloadStored: false as const,
    productionReady: false as const,
    controlStatuses,
    missingControls,
    noGoReasons,
    generatedArtifacts,
    missingRecommendedArtifacts: missingArtifacts,
    automation: automationPlan(),
    nextSafeStep: nextSafeStep({
      status,
      mode,
      noGoReasons,
      missingArtifacts,
    }),
  };
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function attestorIntegrationModeReadinessDescriptor(): AttestorIntegrationModeReadinessDescriptor {
  return Object.freeze({
    version: ATTESTOR_INTEGRATION_MODE_READINESS_VERSION,
    modes: ATTESTOR_INTEGRATION_MODES,
    credentialIsolationPostures: ATTESTOR_CREDENTIAL_ISOLATION_POSTURES,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
    nonBypassableRequiresCredentialIsolation: true,
    generatedArtifactsNeedReview: true,
  });
}
