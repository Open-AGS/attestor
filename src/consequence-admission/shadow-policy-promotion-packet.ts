import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  PolicyDiscoveryControlClosure,
} from './policy-discovery-candidates.js';
import type {
  ShadowPolicyPromotionDraft,
  ShadowPolicyPromotionDraftEntry,
} from './shadow-policy-promotion-draft.js';

export const SHADOW_POLICY_PROMOTION_PACKET_VERSION =
  'attestor.shadow-policy-promotion-packet.v1';

export const SHADOW_POLICY_BUNDLE_DRAFT_VERSION =
  'attestor.shadow-policy-bundle-draft.v1';

export const SHADOW_POLICY_PROMOTION_VALIDATION_ACTIONS = [
  'audit',
  'warn',
  'hold-for-review',
  'enforce-decision',
] as const;
export type ShadowPolicyPromotionValidationAction =
  typeof SHADOW_POLICY_PROMOTION_VALIDATION_ACTIONS[number];

export interface ShadowPolicyPromotionPacketRule {
  readonly ruleId: string;
  readonly sourceEntryId: string;
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly sourceReportId: string | null;
  readonly sourceReportDigest: string | null;
  readonly actionSurface: string | null;
  readonly domain: string | null;
  readonly targetMode: ShadowPolicyPromotionDraftEntry['proposedMode'];
  readonly suggestedValidationActions: readonly ShadowPolicyPromotionValidationAction[];
  readonly requiredControls: readonly PolicyDiscoveryControlClosure[];
  readonly reasonCodes: readonly string[];
  readonly sourceRecommendationKinds: ShadowPolicyPromotionDraftEntry['sourceRecommendationKinds'];
  readonly affectedEvents: number;
  readonly confidence: number;
  readonly severity: ShadowPolicyPromotionDraftEntry['highestSeverity'];
  readonly summary: string;
  readonly approvalTrailDigest: string;
  readonly enforcementState: 'packet-draft-only';
}

export interface ShadowPolicyBundleDraft {
  readonly version: typeof SHADOW_POLICY_BUNDLE_DRAFT_VERSION;
  readonly activationState: 'not-activated';
  readonly signatureStatus: 'unsigned';
  readonly signatureRequired: true;
  readonly sourceDraftDigest: string;
  readonly targetModes: readonly ShadowPolicyPromotionDraftEntry['proposedMode'][];
  readonly ruleCount: number;
  readonly rules: readonly ShadowPolicyPromotionPacketRule[];
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowPolicyPromotionGate {
  readonly gate: string;
  readonly status: 'pass' | 'block';
  readonly summary: string;
}

export interface ShadowPolicyPromotionPacket {
  readonly version: typeof SHADOW_POLICY_PROMOTION_PACKET_VERSION;
  readonly packetId: string;
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly sourceDraftVersion: ShadowPolicyPromotionDraft['version'];
  readonly sourceDraftDigest: string;
  readonly sourceStatus: ShadowPolicyPromotionDraft['sourceStatus'];
  readonly sourceCandidateDigests: readonly string[];
  readonly sourceReportIds: readonly string[];
  readonly sourceReportDigests: readonly string[];
  readonly bundleDraft: ShadowPolicyBundleDraft;
  readonly gates: readonly ShadowPolicyPromotionGate[];
  readonly reviewReady: boolean;
  readonly activationReady: false;
  readonly activationBlockers: readonly string[];
  readonly approvalRequired: true;
  readonly autoEnforce: false;
  readonly rawPayloadStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface CreateShadowPolicyPromotionPacketInput {
  readonly draft: ShadowPolicyPromotionDraft;
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
    throw new Error(`Shadow policy promotion packet ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function validationActionsFor(
  mode: ShadowPolicyPromotionDraftEntry['proposedMode'],
): readonly ShadowPolicyPromotionValidationAction[] {
  if (mode === 'observe') return Object.freeze(['audit']);
  if (mode === 'warn') return Object.freeze(['warn', 'audit']);
  if (mode === 'review') return Object.freeze(['hold-for-review', 'audit']);
  return Object.freeze(['enforce-decision', 'audit']);
}

function ruleIdFor(entry: ShadowPolicyPromotionDraftEntry): string {
  return `policy-rule:${hashCanonical({
    entryId: entry.entryId,
    candidateDigest: entry.candidateDigest,
    sourceReportDigest: entry.sourceReportDigest,
    targetMode: entry.proposedMode,
  } as unknown as CanonicalReleaseJsonValue)}`;
}

function createRule(entry: ShadowPolicyPromotionDraftEntry): ShadowPolicyPromotionPacketRule {
  return Object.freeze({
    ruleId: ruleIdFor(entry),
    sourceEntryId: entry.entryId,
    candidateId: entry.candidateId,
    candidateDigest: entry.candidateDigest,
    sourceReportId: entry.sourceReportId,
    sourceReportDigest: entry.sourceReportDigest,
    actionSurface: entry.actionSurface,
    domain: entry.domain,
    targetMode: entry.proposedMode,
    suggestedValidationActions: validationActionsFor(entry.proposedMode),
    requiredControls: entry.requiredControls,
    reasonCodes: entry.reasonCodes,
    sourceRecommendationKinds: entry.sourceRecommendationKinds,
    affectedEvents: entry.affectedEvents,
    confidence: entry.confidence,
    severity: entry.highestSeverity,
    summary: entry.summary,
    approvalTrailDigest: entry.approvalTrailDigest,
    enforcementState: 'packet-draft-only',
  });
}

function createBundleDraft(
  draft: ShadowPolicyPromotionDraft,
  rules: readonly ShadowPolicyPromotionPacketRule[],
): ShadowPolicyBundleDraft {
  const payload = {
    version: SHADOW_POLICY_BUNDLE_DRAFT_VERSION,
    activationState: 'not-activated',
    signatureStatus: 'unsigned',
    signatureRequired: true,
    sourceDraftDigest: draft.digest,
    targetModes: uniqueSorted(rules.map((rule) => rule.targetMode)),
    ruleCount: rules.length,
    rules,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function createGate(
  gate: string,
  status: ShadowPolicyPromotionGate['status'],
  summary: string,
): ShadowPolicyPromotionGate {
  return Object.freeze({ gate, status, summary });
}

function createGates(draft: ShadowPolicyPromotionDraft): readonly ShadowPolicyPromotionGate[] {
  return Object.freeze([
    createGate(
      'source-draft-ready',
      draft.promotionReady ? 'pass' : 'block',
      draft.promotionReady
        ? 'Source promotion draft has approved candidates with source simulation bindings.'
        : `Source promotion draft is blocked: ${draft.blockers.join(', ') || 'unknown blocker'}.`,
    ),
    createGate(
      'policy-simulation-required',
      'block',
      'A later step must simulate this policy bundle draft before activation.',
    ),
    createGate(
      'bundle-signature-required',
      'block',
      'A later step must sign the policy bundle with a production signing boundary before activation.',
    ),
    createGate(
      'downstream-verification-required',
      'block',
      'A later step must bind downstream verification before any customer system treats the packet as enforceable.',
    ),
  ]);
}

function activationBlockers(gates: readonly ShadowPolicyPromotionGate[]): readonly string[] {
  return Object.freeze(gates
    .filter((gate) => gate.status === 'block')
    .map((gate) => gate.gate)
    .sort());
}

function packetIdFor(input: {
  readonly tenantId: string;
  readonly sourceDraftDigest: string;
  readonly bundleDraftDigest: string;
}): string {
  return `policy-promotion-packet:${hashCanonical(input as unknown as CanonicalReleaseJsonValue)}`;
}

export function createShadowPolicyPromotionPacket(
  input: CreateShadowPolicyPromotionPacketInput,
): ShadowPolicyPromotionPacket {
  const generatedAt = normalizeIsoTimestamp(
    input.generatedAt,
    new Date().toISOString(),
    'generatedAt',
  );
  const draft = input.draft;
  const rules = Object.freeze(
    draft.entries
      .map((entry) => createRule(entry))
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
  const bundleDraft = createBundleDraft(draft, rules);
  const gates = createGates(draft);
  const blockers = activationBlockers(gates);
  const payload = {
    version: SHADOW_POLICY_PROMOTION_PACKET_VERSION,
    packetId: packetIdFor({
      tenantId: draft.tenantId,
      sourceDraftDigest: draft.digest,
      bundleDraftDigest: bundleDraft.digest,
    }),
    tenantId: draft.tenantId,
    generatedAt,
    sourceDraftVersion: draft.version,
    sourceDraftDigest: draft.digest,
    sourceStatus: draft.sourceStatus,
    sourceCandidateDigests: draft.candidateDigests,
    sourceReportIds: draft.sourceReportIds,
    sourceReportDigests: draft.sourceReportDigests,
    bundleDraft,
    gates,
    reviewReady: draft.promotionReady,
    activationReady: false,
    activationBlockers: blockers,
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
