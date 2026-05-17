import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
  type CanonicalShadowEvent,
  type CanonicalShadowEventRawMaterialPolicy,
} from './canonical-shadow-event-schema.js';
import {
  CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
  type ConsequenceEnvelopeActorAuthorityClass,
  type ConsequenceEnvelopeBlastRadiusEstimate,
  type ConsequenceEnvelopeContract,
  type ConsequenceEnvelopeConsequenceClass,
  type ConsequenceEnvelopeDigestRef,
  type ConsequenceEnvelopeHistoryDepthClass,
  type ConsequenceEnvelopeRawMaterialPolicy,
  type ConsequenceEnvelopeReversibilityClass,
  type ConsequenceEnvelopeTenantMaturityClass,
} from './consequence-envelope-contract.js';

export const SHADOW_ENVELOPE_PROJECTOR_VERSION =
  'attestor.shadow-envelope-projector.v1';

export const SHADOW_ENVELOPE_PROJECTOR_MODE = 'shadow-only';

export interface CreateShadowEnvelopeProjectionOptions {
  readonly actionTypeRegistryRefDigest?: string | null;
  readonly reversibilityClass?: ConsequenceEnvelopeReversibilityClass | null;
  readonly blastRadiusEstimate?: ConsequenceEnvelopeBlastRadiusEstimate | null;
  readonly tenantMaturityClass?: ConsequenceEnvelopeTenantMaturityClass | null;
  readonly historyDepthClass?: ConsequenceEnvelopeHistoryDepthClass | null;
  readonly coverageRefDigest?: string | null;
  readonly actorAuthorityClass?: ConsequenceEnvelopeActorAuthorityClass | null;
  readonly authorityRefDigest?: string | null;
  readonly reviewerRefDigest?: string | null;
  readonly freshnessWindowSeconds?: number | null;
  readonly deadlineAt?: string | null;
  readonly policyScopeRefDigest?: string | null;
  readonly rolloutRefDigest?: string | null;
  readonly candidateRefDigest?: string | null;
}

export interface ShadowEnvelopeProjectionRedactionSummary {
  readonly sourceRawMaterialPolicy: CanonicalShadowEventRawMaterialPolicy;
  readonly envelopeRawMaterialPolicy: ConsequenceEnvelopeRawMaterialPolicy;
  readonly rawPayloadRead: false;
  readonly rawPayloadForwarded: false;
  readonly rawPromptForwarded: false;
  readonly rawProviderBodyForwarded: false;
  readonly rawWalletMaterialForwarded: false;
  readonly rawCustomerIdentifierForwarded: false;
  readonly rawTenantIdentifierForwarded: false;
}

export interface ShadowEnvelopeProjection {
  readonly version: typeof SHADOW_ENVELOPE_PROJECTOR_VERSION;
  readonly accepts: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly produces: typeof CONSEQUENCE_ENVELOPE_CONTRACT_VERSION;
  readonly projectionMode: typeof SHADOW_ENVELOPE_PROJECTOR_MODE;
  readonly sourceEventDigest: string;
  readonly envelopeRefDigest: string;
  readonly tenantBindingDigest: string;
  readonly idempotencyKeyDigest: string;
  readonly redaction: ShadowEnvelopeProjectionRedactionSummary;
  readonly envelope: ConsequenceEnvelopeContract;
  readonly rawPayloadRead: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ShadowEnvelopeProjectorDescriptor {
  readonly version: typeof SHADOW_ENVELOPE_PROJECTOR_VERSION;
  readonly accepts: typeof CANONICAL_SHADOW_EVENT_SCHEMA_VERSION;
  readonly produces: typeof CONSEQUENCE_ENVELOPE_CONTRACT_VERSION;
  readonly projectionMode: typeof SHADOW_ENVELOPE_PROJECTOR_MODE;
  readonly deterministic: true;
  readonly preservesTenantBinding: true;
  readonly preservesRedactionBoundary: true;
  readonly sourceEventMutationAllowed: false;
  readonly rawPayloadRead: false;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
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

function digestValue(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`Shadow envelope projector ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Shadow envelope projector ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function assertCanonicalShadowEvent(event: CanonicalShadowEvent): void {
  if (event.version !== CANONICAL_SHADOW_EVENT_SCHEMA_VERSION) {
    throw new Error('Shadow envelope projector input must use canonical shadow event schema v1.');
  }
  normalizeDigest(event.digest, 'sourceEvent.digest');
  normalizeDigest(event.tenantRefDigest, 'sourceEvent.tenantRefDigest');
  normalizeDigest(event.actorRefDigest, 'sourceEvent.actorRefDigest');
  if (event.rawPayloadStored !== false || event.rawMaterialBoundary.rawPayloadStored !== false) {
    throw new Error('Shadow envelope projector input must not store raw payload material.');
  }
  if (event.autoEnforce !== false) {
    throw new Error('Shadow envelope projector input must be shadow-only.');
  }
}

function mapRawMaterialPolicy(
  policy: CanonicalShadowEventRawMaterialPolicy,
): ConsequenceEnvelopeRawMaterialPolicy {
  if (policy === 'metadata-only') return 'redacted-summary';
  return 'digest-only';
}

function consequenceClassFor(
  event: CanonicalShadowEvent,
): ConsequenceEnvelopeConsequenceClass {
  return (
    event.observed.consequenceClass ??
    event.inferred.consequenceClass ??
    'unknown'
  );
}

function actionTypeValueFor(event: CanonicalShadowEvent): string {
  return (
    event.observed.actionName ??
    event.inferred.actionName ??
    event.observed.actionKind ??
    event.inferred.actionKind ??
    'unknown-action'
  );
}

function firstDigest(...values: readonly (string | null | undefined)[]): string | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return normalizeDigest(value, 'digest candidate');
  }
  return null;
}

function digestRefs<K extends ConsequenceEnvelopeDigestRef['kind']>(
  kind: K,
  digests: readonly (string | null | undefined)[],
): readonly ConsequenceEnvelopeDigestRef<K>[] {
  const refs: ConsequenceEnvelopeDigestRef<K>[] = [];
  const seen = new Set<string>();
  for (const digest of digests) {
    if (digest === null || digest === undefined) continue;
    const normalized = normalizeDigest(digest, `${kind} ref`);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    refs.push(Object.freeze({ kind, digest: normalized }));
  }
  return Object.freeze(refs);
}

function projectEnvelope(
  event: CanonicalShadowEvent,
  options: CreateShadowEnvelopeProjectionOptions,
): ConsequenceEnvelopeContract {
  const actionTypeValue = actionTypeValueFor(event);
  const targetSystemRefDigest = event.observed.targetSystem
    ? digestValue('target-system', event.observed.targetSystem)
    : digestValue('target-system', {
      sourceEventDigest: event.digest,
      fallback: 'unknown-target-system',
    });
  const actionTypeRegistryRefDigest = normalizeOptionalDigest(
    options.actionTypeRegistryRefDigest,
    'actionTypeRegistryRefDigest',
  ) ?? digestValue('action-type-registry', {
    sourceEventDigest: event.digest,
    actionTypeValue,
  });
  const authorityRefDigest = normalizeOptionalDigest(
    options.authorityRefDigest,
    'authorityRefDigest',
  ) ?? firstDigest(
    event.observed.authorityDelta?.permissionRefDigest,
    event.inferred.authorityDelta?.permissionRefDigest,
    event.observed.authorityDelta?.principalRefDigest,
    event.inferred.authorityDelta?.principalRefDigest,
  );
  const reviewerRefDigest = normalizeOptionalDigest(
    options.reviewerRefDigest,
    'reviewerRefDigest',
  ) ?? event.approvalRefs[0]?.digest ?? null;
  const policyBundleRefDigest = event.policyRefs[0]?.digest ?? null;
  const replayRefDigest = normalizeOptionalDigest(event.replayRefDigest, 'replayRefDigest');

  return Object.freeze({
    version: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    sourceEventRef: Object.freeze({
      kind: 'shadow-event',
      digest: event.digest,
    }),
    canonicalActionType: Object.freeze({
      value: actionTypeValue,
      source: event.observed.actionName || event.observed.actionKind
        ? 'integration-declaration'
        : 'operator-registered',
      registryRefDigest: actionTypeRegistryRefDigest,
    }),
    consequenceClass: consequenceClassFor(event),
    reversibilityClass: options.reversibilityClass ?? 'irreversible',
    blastRadiusEstimate: options.blastRadiusEstimate ?? 'tenant',
    tenantContext: Object.freeze({
      tenantRefDigest: event.tenantRefDigest,
      maturityClass: options.tenantMaturityClass ?? 'shadow-observed',
      historyDepthClass: options.historyDepthClass ?? 'low',
      coverageRefDigest: normalizeOptionalDigest(
        options.coverageRefDigest,
        'coverageRefDigest',
      ),
    }),
    actorContext: Object.freeze({
      actorRefDigest: event.actorRefDigest,
      authorityClass: options.actorAuthorityClass ?? (authorityRefDigest ? 'observed' : 'none'),
      authorityRefDigest,
      reviewerRefDigest,
    }),
    timingContext: Object.freeze({
      requestedAt: event.occurredAt,
      freshnessWindowSeconds: options.freshnessWindowSeconds ?? null,
      freshnessPosture: 'unknown',
      deadlineAt: normalizeIsoTimestamp(options.deadlineAt, 'deadlineAt'),
    }),
    priorChain: Object.freeze(replayRefDigest
      ? [
        Object.freeze({
          relationship: 'replay-related',
          eventRefDigest: replayRefDigest,
          distance: 1,
        }),
      ]
      : []),
    evidenceRefs: Object.freeze([
      ...digestRefs(
        'evidence',
        event.evidenceRefs
          .filter((ref) => ref.kind === 'evidence')
          .map((ref) => ref.digest),
      ),
      ...digestRefs('approval', event.approvalRefs.map((ref) => ref.digest)),
      ...digestRefs('receipt', event.receiptRefs.map((ref) => ref.digest)),
    ]),
    authorityRefs: Object.freeze([
      ...digestRefs('authority', [authorityRefDigest]),
      ...digestRefs('approval', event.approvalRefs.map((ref) => ref.digest)),
    ]),
    policyScope: Object.freeze({
      policyBundleRefDigest,
      policyScopeRefDigest: normalizeOptionalDigest(
        options.policyScopeRefDigest,
        'policyScopeRefDigest',
      ),
      rolloutRefDigest: normalizeOptionalDigest(options.rolloutRefDigest, 'rolloutRefDigest'),
      candidateRefDigest: normalizeOptionalDigest(
        options.candidateRefDigest,
        'candidateRefDigest',
      ),
    }),
    targetSystemRef: Object.freeze({
      kind: 'target-system',
      digest: targetSystemRefDigest,
    }),
    resourceRefs: digestRefs('resource', [
      event.observed.resourceRefDigest,
      event.inferred.resourceRefDigest,
    ]),
    counterpartyRefs: Object.freeze([]),
    rawMaterialBoundary: Object.freeze({
      policy: mapRawMaterialPolicy(event.rawMaterialBoundary.policy),
      rawPayloadStored: false,
      rawPromptStored: false,
      rawToolPayloadStored: false,
      rawProviderBodyStored: false,
      rawCustomerIdentifierStored: false,
      rawTenantIdentifierStored: false,
      rawWalletMaterialStored: false,
      rawPaymentDetailStored: false,
      rawDownstreamBodyStored: false,
      rawPrivateThresholdStored: false,
    }),
    grantsAuthority: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  });
}

export function createShadowEnvelopeProjection(
  event: CanonicalShadowEvent,
  options: CreateShadowEnvelopeProjectionOptions = {},
): ShadowEnvelopeProjection {
  assertCanonicalShadowEvent(event);
  const envelope = projectEnvelope(event, options);
  const envelopeCanonical = canonicalObject(envelope as unknown as CanonicalReleaseJsonValue);
  const tenantBindingDigest = digestValue('shadow-envelope-tenant-binding', {
    sourceEventDigest: event.digest,
    sourceTenantRefDigest: event.tenantRefDigest,
    envelopeTenantRefDigest: envelope.tenantContext.tenantRefDigest,
  });
  const idempotencyKeyDigest = digestValue('shadow-envelope-idempotency', {
    sourceEventDigest: event.digest,
    projectorVersion: SHADOW_ENVELOPE_PROJECTOR_VERSION,
  });
  const payload = {
    version: SHADOW_ENVELOPE_PROJECTOR_VERSION,
    accepts: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    produces: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    projectionMode: SHADOW_ENVELOPE_PROJECTOR_MODE,
    sourceEventDigest: event.digest,
    envelopeRefDigest: envelopeCanonical.digest,
    tenantBindingDigest,
    idempotencyKeyDigest,
    redaction: {
      sourceRawMaterialPolicy: event.rawMaterialBoundary.policy,
      envelopeRawMaterialPolicy: envelope.rawMaterialBoundary.policy,
      rawPayloadRead: false,
      rawPayloadForwarded: false,
      rawPromptForwarded: false,
      rawProviderBodyForwarded: false,
      rawWalletMaterialForwarded: false,
      rawCustomerIdentifierForwarded: false,
      rawTenantIdentifierForwarded: false,
    },
    envelope,
    rawPayloadRead: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function shadowEnvelopeProjectorDescriptor(): ShadowEnvelopeProjectorDescriptor {
  return Object.freeze({
    version: SHADOW_ENVELOPE_PROJECTOR_VERSION,
    accepts: CANONICAL_SHADOW_EVENT_SCHEMA_VERSION,
    produces: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    projectionMode: SHADOW_ENVELOPE_PROJECTOR_MODE,
    deterministic: true,
    preservesTenantBinding: true,
    preservesRedactionBoundary: true,
    sourceEventMutationAllowed: false,
    rawPayloadRead: false,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-live-enforcement',
      'not-signal-extraction',
      'not-fusion-runner',
      'not-tla-checked',
      'not-authority-granting',
      'not-production-ready',
    ]),
  });
}
