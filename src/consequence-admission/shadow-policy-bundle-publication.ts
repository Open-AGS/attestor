import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ShadowPolicyPromotionSimulation,
  ShadowPolicyPromotionRuleSimulation,
} from './shadow-policy-promotion-simulation.js';

export const SHADOW_POLICY_BUNDLE_PUBLICATION_VERSION =
  'attestor.shadow-policy-bundle-publication.v1';
export const SHADOW_POLICY_BUNDLE_SIGNING_PAYLOAD_VERSION =
  'attestor.shadow-policy-bundle-signing-payload.v1';

export const SHADOW_POLICY_BUNDLE_SIGNATURE_ALGORITHMS = [
  'ed25519',
  'external-kms',
] as const;
export type ShadowPolicyBundleSignatureAlgorithm =
  typeof SHADOW_POLICY_BUNDLE_SIGNATURE_ALGORITHMS[number];

export const SHADOW_POLICY_BUNDLE_SIGNING_BOUNDARIES = [
  'runtime-memory',
  'runtime-file-pem',
  'external-kms-hsm',
] as const;
export type ShadowPolicyBundleSigningBoundary =
  typeof SHADOW_POLICY_BUNDLE_SIGNING_BOUNDARIES[number];

export type ShadowPolicyBundleSignatureStatus =
  | 'unsigned'
  | 'signed-evaluation'
  | 'signed-production';

export interface ShadowPolicyBundleSigningRuleDigest {
  readonly ruleId: string;
  readonly candidateDigest: string;
  readonly sourceReportDigest: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly targetMode: ShadowPolicyPromotionRuleSimulation['targetMode'];
  readonly ruleDigest: string;
}

export interface ShadowPolicyBundleSigningPayload {
  readonly version: typeof SHADOW_POLICY_BUNDLE_SIGNING_PAYLOAD_VERSION;
  readonly tenantId: string;
  readonly sourcePacketId: string;
  readonly sourcePacketDigest: string;
  readonly sourceBundleDraftDigest: string;
  readonly sourceSimulationId: string;
  readonly sourceSimulationDigest: string;
  readonly targetModes: readonly ShadowPolicyPromotionRuleSimulation['targetMode'][];
  readonly ruleCount: number;
  readonly ruleDigests: readonly ShadowPolicyBundleSigningRuleDigest[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowPolicyBundlePublicationSignature {
  readonly algorithm: ShadowPolicyBundleSignatureAlgorithm;
  readonly signature: string;
  readonly signerRef: string;
  readonly publicKeyFingerprint: string | null;
  readonly signedAt: string;
  readonly signingBoundary: ShadowPolicyBundleSigningBoundary;
  readonly productionReady: boolean;
}

export interface ShadowPolicyBundlePublication {
  readonly version: typeof SHADOW_POLICY_BUNDLE_PUBLICATION_VERSION;
  readonly publicationId: string;
  readonly generatedAt: string;
  readonly tenantId: string;
  readonly sourcePacketId: string;
  readonly sourcePacketDigest: string;
  readonly sourceBundleDraftDigest: string;
  readonly sourceSimulationId: string;
  readonly sourceSimulationDigest: string;
  readonly signingPayload: ShadowPolicyBundleSigningPayload;
  readonly signatureStatus: ShadowPolicyBundleSignatureStatus;
  readonly signatureRequired: true;
  readonly signature: ShadowPolicyBundlePublicationSignature | null;
  readonly publicationReady: boolean;
  readonly activationReady: false;
  readonly remainingActivationBlockers: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowPolicyBundlePublicationInput {
  readonly simulation: ShadowPolicyPromotionSimulation;
  readonly signature?: ShadowPolicyBundlePublicationSignature | null;
  readonly generatedAt?: string | null;
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

function hashCanonical(value: CanonicalReleaseJsonValue): string {
  return canonicalObject(value).digest;
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fallback: string,
  fieldName: string,
): string {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow policy bundle publication ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeIdentifier(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Shadow policy bundle publication ${fieldName} requires a non-empty value.`);
  }
  return normalized;
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function ruleDigest(rule: ShadowPolicyPromotionRuleSimulation): string {
  return hashCanonical({
    ruleId: rule.ruleId,
    candidateDigest: rule.candidateDigest,
    sourceReportDigest: rule.sourceReportDigest,
    actionSurface: rule.actionSurface,
    domain: rule.domain,
    targetMode: rule.targetMode,
    suggestedValidationActions: rule.suggestedValidationActions,
    requiredControls: rule.requiredControls,
    reasonCodes: rule.reasonCodes,
  } as unknown as CanonicalReleaseJsonValue);
}

function createSigningRuleDigest(
  rule: ShadowPolicyPromotionRuleSimulation,
): ShadowPolicyBundleSigningRuleDigest {
  return Object.freeze({
    ruleId: rule.ruleId,
    candidateDigest: rule.candidateDigest,
    sourceReportDigest: rule.sourceReportDigest,
    actionSurface: rule.actionSurface,
    domain: rule.domain,
    targetMode: rule.targetMode,
    ruleDigest: ruleDigest(rule),
  });
}

function normalizeSignature(
  signature: ShadowPolicyBundlePublicationSignature | null | undefined,
): ShadowPolicyBundlePublicationSignature | null {
  if (!signature) return null;
  if (!SHADOW_POLICY_BUNDLE_SIGNATURE_ALGORITHMS.includes(signature.algorithm)) {
    throw new Error(
      `Shadow policy bundle publication signature algorithm must be one of: ${SHADOW_POLICY_BUNDLE_SIGNATURE_ALGORITHMS.join(', ')}.`,
    );
  }
  if (!SHADOW_POLICY_BUNDLE_SIGNING_BOUNDARIES.includes(signature.signingBoundary)) {
    throw new Error(
      `Shadow policy bundle publication signingBoundary must be one of: ${SHADOW_POLICY_BUNDLE_SIGNING_BOUNDARIES.join(', ')}.`,
    );
  }
  return Object.freeze({
    algorithm: signature.algorithm,
    signature: normalizeIdentifier(signature.signature, 'signature.signature'),
    signerRef: normalizeIdentifier(signature.signerRef, 'signature.signerRef'),
    publicKeyFingerprint: signature.publicKeyFingerprint === null
      ? null
      : normalizeIdentifier(signature.publicKeyFingerprint, 'signature.publicKeyFingerprint'),
    signedAt: normalizeIsoTimestamp(signature.signedAt, new Date().toISOString(), 'signature.signedAt'),
    signingBoundary: signature.signingBoundary,
    productionReady: signature.productionReady,
  });
}

function signatureStatusFor(
  signature: ShadowPolicyBundlePublicationSignature | null,
): ShadowPolicyBundleSignatureStatus {
  if (!signature) return 'unsigned';
  return signature.productionReady ? 'signed-production' : 'signed-evaluation';
}

function publicationIdFor(input: {
  readonly tenantId: string;
  readonly signingPayloadDigest: string;
  readonly signatureStatus: ShadowPolicyBundleSignatureStatus;
  readonly signature: string | null;
}): string {
  return `policy-bundle-publication:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

function remainingActivationBlockers(input: {
  readonly simulation: ShadowPolicyPromotionSimulation;
  readonly signatureStatus: ShadowPolicyBundleSignatureStatus;
}): readonly string[] {
  const blockers = new Set(input.simulation.remainingActivationBlockers);
  if (input.signatureStatus === 'unsigned') {
    blockers.add('bundle-signature-required');
  } else {
    blockers.delete('bundle-signature-required');
    if (input.signatureStatus === 'signed-evaluation') {
      blockers.add('production-signing-provider-required');
    }
  }
  return Object.freeze([...blockers].sort());
}

export function createShadowPolicyBundleSigningPayload(
  simulation: ShadowPolicyPromotionSimulation,
): ShadowPolicyBundleSigningPayload {
  const ruleDigests = Object.freeze(
    simulation.ruleSimulations
      .map(createSigningRuleDigest)
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
  const payload = {
    version: SHADOW_POLICY_BUNDLE_SIGNING_PAYLOAD_VERSION,
    tenantId: simulation.tenantId,
    sourcePacketId: simulation.sourcePacketId,
    sourcePacketDigest: simulation.sourcePacketDigest,
    sourceBundleDraftDigest: simulation.sourceBundleDraftDigest,
    sourceSimulationId: simulation.simulationId,
    sourceSimulationDigest: simulation.digest,
    targetModes: uniqueSorted(simulation.ruleSimulations.map((rule) => rule.targetMode)),
    ruleCount: ruleDigests.length,
    ruleDigests,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createShadowPolicyBundlePublication(
  input: CreateShadowPolicyBundlePublicationInput,
): ShadowPolicyBundlePublication {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const simulation = input.simulation;
  const signingPayload = createShadowPolicyBundleSigningPayload(simulation);
  const signature = normalizeSignature(input.signature);
  const signatureStatus = signatureStatusFor(signature);
  const blockers = remainingActivationBlockers({ simulation, signatureStatus });
  const payload = {
    version: SHADOW_POLICY_BUNDLE_PUBLICATION_VERSION,
    publicationId: publicationIdFor({
      tenantId: simulation.tenantId,
      signingPayloadDigest: signingPayload.digest,
      signatureStatus,
      signature: signature?.signature ?? null,
    }),
    generatedAt,
    tenantId: simulation.tenantId,
    sourcePacketId: simulation.sourcePacketId,
    sourcePacketDigest: simulation.sourcePacketDigest,
    sourceBundleDraftDigest: simulation.sourceBundleDraftDigest,
    sourceSimulationId: simulation.simulationId,
    sourceSimulationDigest: simulation.digest,
    signingPayload,
    signatureStatus,
    signatureRequired: true,
    signature,
    publicationReady: signatureStatus !== 'unsigned' && simulation.simulationReady,
    activationReady: false,
    remainingActivationBlockers: blockers,
    approvalRequired: true,
    autoEnforce: false,
    rawPayloadStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}
