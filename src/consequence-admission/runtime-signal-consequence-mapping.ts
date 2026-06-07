import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ACTION_RISK_INVENTORY_VERSION,
  ACTION_RISK_NEXT_STEPS,
  type ActionRiskNextStep,
  type ActionRiskSignal,
} from './action-risk-inventory.js';
import {
  CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES,
  CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
  type ConsequenceEnvelopeConsequenceClass,
} from './consequence-envelope-contract.js';
import {
  RUNTIME_SIGNAL_ENVELOPE_VERSION,
  type RuntimeSignalEnvelope,
} from './runtime-signal-envelope.js';
import {
  RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
  assertRuntimeSignalAuthorityBoundary,
} from './runtime-signal-authority-guard.js';

export const RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION =
  'attestor.runtime-signal-consequence-mapping.v1';

export const RUNTIME_SIGNAL_CONSEQUENCE_CANDIDATE_ORIGINS = [
  'declaration-surface',
  'observation-surface',
  'proposed-action-surface',
] as const;
export type RuntimeSignalConsequenceCandidateOrigin =
  typeof RUNTIME_SIGNAL_CONSEQUENCE_CANDIDATE_ORIGINS[number];

export const RUNTIME_SIGNAL_CONSEQUENCE_MISSING_CONTROLS = [
  'action-surface-missing',
  'target-system-missing',
  'tenant-binding-missing',
  'actor-binding-missing',
  'runtime-correlation-missing',
  'schema-digest-missing',
  'body-digest-missing',
  'policy-binding-missing',
  'evidence-binding-missing',
  'approval-binding-missing',
  'source-binding-missing',
  'gate-proof-missing',
  'replay-proof-missing',
] as const;
export type RuntimeSignalConsequenceMissingControl =
  typeof RUNTIME_SIGNAL_CONSEQUENCE_MISSING_CONTROLS[number];

export const RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_RULE_IDS = [
  'surface-explicit',
  'surface-from-operation-ref',
  'surface-unknown',
  'class-data-movement',
  'class-financial',
  'class-authority-change',
  'class-external-communication',
  'class-operational-execution',
  'class-programmable-money',
  'class-health-claims',
  'class-unknown',
  'missing-control-scan',
] as const;
export type RuntimeSignalConsequenceMappingRuleId =
  typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_RULE_IDS[number];

export const RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_REQUIRED_FIELDS = [
  'sourceSignalDigest',
  'sourceSignalKind',
  'sourceTrustLevel',
  'sourceSystem',
  'actionSurface',
  'actionSurfaceDigest',
  'downstreamSystem',
  'operationRef',
  'consequenceClass',
  'candidateOrigin',
  'missingControls',
  'riskSignals',
  'recommendedNextStep',
  'candidateDigest',
] as const;
export type RuntimeSignalConsequenceMappingRequiredField =
  typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_REQUIRED_FIELDS[number];

export interface RuntimeSignalConsequenceCandidate {
  readonly version: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly consequenceEnvelopeContractVersion: typeof CONSEQUENCE_ENVELOPE_CONTRACT_VERSION;
  readonly actionRiskInventoryVersion: typeof ACTION_RISK_INVENTORY_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly sourceSignalDigest: string;
  readonly sourceSignalKind: RuntimeSignalEnvelope['signalKind'];
  readonly sourceTrustLevel: RuntimeSignalEnvelope['sourceTrustLevel'];
  readonly sourceSystem: string;
  readonly actionSurface: string;
  readonly actionSurfaceDigest: string;
  readonly downstreamSystem: string | null;
  readonly operationRef: string | null;
  readonly consequenceClass: ConsequenceEnvelopeConsequenceClass;
  readonly candidateOrigin: RuntimeSignalConsequenceCandidateOrigin;
  readonly mappingRuleIds: readonly RuntimeSignalConsequenceMappingRuleId[];
  readonly missingControls: readonly RuntimeSignalConsequenceMissingControl[];
  readonly riskSignals: readonly ActionRiskSignal[];
  readonly recommendedNextStep: ActionRiskNextStep;
  readonly digestOnly: true;
  readonly reviewMaterialOnly: true;
  readonly rawPayloadStored: false;
  readonly rawPromptStored: false;
  readonly rawToolPayloadStored: false;
  readonly rawProviderBodyStored: false;
  readonly rawCustomerIdentifierStored: false;
  readonly rawTenantIdentifierStored: false;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly canonical: string;
  readonly candidateDigest: string;
}

export interface RuntimeSignalConsequenceMappingDescriptor {
  readonly version: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION;
  readonly runtimeSignalEnvelopeVersion: typeof RUNTIME_SIGNAL_ENVELOPE_VERSION;
  readonly consequenceEnvelopeContractVersion: typeof CONSEQUENCE_ENVELOPE_CONTRACT_VERSION;
  readonly actionRiskInventoryVersion: typeof ACTION_RISK_INVENTORY_VERSION;
  readonly runtimeSignalAuthorityGuardVersion: typeof RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION;
  readonly consequenceClasses: typeof CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES;
  readonly candidateOrigins: typeof RUNTIME_SIGNAL_CONSEQUENCE_CANDIDATE_ORIGINS;
  readonly missingControls: typeof RUNTIME_SIGNAL_CONSEQUENCE_MISSING_CONTROLS;
  readonly mappingRuleIds: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_RULE_IDS;
  readonly requiredFields: typeof RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_REQUIRED_FIELDS;
  readonly ruleBasedCandidateOnly: true;
  readonly mapsToExistingConsequenceClasses: true;
  readonly proofSignalsHandledByProofIntake: true;
  readonly digestOnly: true;
  readonly reviewMaterialOnly: true;
  readonly grantsAuthority: false;
  readonly canGrantAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly productionReady: false;
  readonly outputIsDecisionSupportOnly: true;
  readonly nonClaims: readonly string[];
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const SOURCE_BINDING_MISSING_LEVELS = new Set<RuntimeSignalEnvelope['sourceTrustLevel']>([
  'declared',
  'observed',
]);

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

function assertDigest(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new Error(`Runtime signal consequence mapping ${fieldName} must be a sha256 digest reference.`);
  }
  return value;
}

function assertEnvelopeBoundary(envelope: RuntimeSignalEnvelope): void {
  try {
    assertRuntimeSignalAuthorityBoundary({
      signalKind: envelope.signalKind,
      sourceTrustLevel: envelope.sourceTrustLevel,
      target: envelope,
      targetLabel: 'runtime-signal-envelope',
    });
  } catch {
    throw new Error('Runtime signal consequence mapping requires a no-authority runtime signal envelope.');
  }
  if (
    envelope.version !== RUNTIME_SIGNAL_ENVELOPE_VERSION ||
    envelope.rawPayloadStored !== false ||
    envelope.rawPromptStored !== false ||
    envelope.rawToolPayloadStored !== false ||
    envelope.rawProviderBodyStored !== false ||
    envelope.rawCustomerIdentifierStored !== false ||
    envelope.rawTenantIdentifierStored !== false ||
    envelope.grantsAuthority !== false ||
    envelope.canGrantAuthority !== false ||
    envelope.canAdmit !== false ||
    envelope.activatesEnforcement !== false ||
    envelope.autoEnforce !== false ||
    envelope.productionReady !== false ||
    envelope.outputIsDecisionSupportOnly !== true
  ) {
    throw new Error('Runtime signal consequence mapping requires a no-authority runtime signal envelope.');
  }
  assertDigest(envelope.signalDigest, 'envelope.signalDigest');
  if (envelope.signalKind === 'enforcement-proof') {
    throw new Error('Runtime signal consequence mapping does not turn enforcement-proof signals into action candidates.');
  }
}

function candidateOriginFor(
  signalKind: RuntimeSignalEnvelope['signalKind'],
): RuntimeSignalConsequenceCandidateOrigin {
  switch (signalKind) {
    case 'declaration':
      return 'declaration-surface';
    case 'observation':
      return 'observation-surface';
    case 'proposed-action':
      return 'proposed-action-surface';
    case 'enforcement-proof':
      throw new Error('Runtime signal consequence mapping proof signals are RS10 proof-intake material.');
  }
}

function candidateActionSurfaceFor(envelope: RuntimeSignalEnvelope): {
  readonly value: string;
  readonly ruleId: RuntimeSignalConsequenceMappingRuleId;
} {
  if (envelope.actionSurface) {
    return Object.freeze({
      value: envelope.actionSurface,
      ruleId: 'surface-explicit',
    });
  }
  if (envelope.operationRef) {
    return Object.freeze({
      value: envelope.operationRef,
      ruleId: 'surface-from-operation-ref',
    });
  }
  return Object.freeze({
    value: 'unknown',
    ruleId: 'surface-unknown',
  });
}

function hasAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function consequenceClassFor(envelope: RuntimeSignalEnvelope): {
  readonly value: ConsequenceEnvelopeConsequenceClass;
  readonly ruleId: RuntimeSignalConsequenceMappingRuleId;
} {
  const text = [
    envelope.actionSurface,
    envelope.operationRef,
    envelope.downstreamSystem,
    envelope.sourceSystem,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  if (
    hasAny(text, [
      /\b(wallet|crypto|chain|onchain|blockchain|safe|smart-contract)\b/u,
      /\b(x402|swap|bridge|bundler|solver)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'programmable-money', ruleId: 'class-programmable-money' });
  }
  if (
    hasAny(text, [
      /\b(refund|charge|invoice|payment|payout|settlement|ledger|money|fiscal|bank|billing)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'financial', ruleId: 'class-financial' });
  }
  if (
    hasAny(text, [
      /\b(export|download|extract|share|replicate|sync|record|records|report|dataset|data)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'data-movement', ruleId: 'class-data-movement' });
  }
  if (
    hasAny(text, [
      /\b(admin|role|permission|access|identity|iam|grant|revoke|secret|key)\b/u,
      /\b(user|group|membership)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'authority-change', ruleId: 'class-authority-change' });
  }
  if (
    hasAny(text, [
      /\b(email|message|sms|notify|notification|publish|slack|webhook|communication)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'external-communication', ruleId: 'class-external-communication' });
  }
  if (
    hasAny(text, [
      /\b(deploy|restart|delete|job|run|execute|workflow|provision|scale|backup|restore|release)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'operational-execution', ruleId: 'class-operational-execution' });
  }
  if (
    hasAny(text, [
      /\b(health|medical|diagnosis|triage|clinical|patient)\b/u,
    ])
  ) {
    return Object.freeze({ value: 'health-claims', ruleId: 'class-health-claims' });
  }
  return Object.freeze({ value: 'unknown', ruleId: 'class-unknown' });
}

function missingControlsFor(
  envelope: RuntimeSignalEnvelope,
): readonly RuntimeSignalConsequenceMissingControl[] {
  const missing: RuntimeSignalConsequenceMissingControl[] = [];
  if (!envelope.actionSurface && !envelope.operationRef) missing.push('action-surface-missing');
  if (!envelope.downstreamSystem) missing.push('target-system-missing');
  if (!envelope.tenantRefDigest) missing.push('tenant-binding-missing');
  if (!envelope.actorRefDigest) missing.push('actor-binding-missing');
  if (!envelope.runtimeRef && !envelope.traceId && !envelope.runId) {
    missing.push('runtime-correlation-missing');
  }
  if (!envelope.inputSchemaDigest) missing.push('schema-digest-missing');
  if (envelope.signalKind !== 'declaration' && !envelope.argumentOrBodyDigest) {
    missing.push('body-digest-missing');
  }
  if (envelope.policyRefs.length === 0) missing.push('policy-binding-missing');
  if (envelope.evidenceRefs.length === 0) missing.push('evidence-binding-missing');
  if (envelope.approvalRefs.length === 0) missing.push('approval-binding-missing');
  if (SOURCE_BINDING_MISSING_LEVELS.has(envelope.sourceTrustLevel)) {
    missing.push('source-binding-missing');
  }
  missing.push('gate-proof-missing', 'replay-proof-missing');
  return Object.freeze(missing);
}

function riskSignalsFor(
  missingControls: readonly RuntimeSignalConsequenceMissingControl[],
): readonly ActionRiskSignal[] {
  const signals = new Set<ActionRiskSignal>();
  if (missingControls.includes('policy-binding-missing')) signals.add('policy-gap');
  if (
    missingControls.includes('evidence-binding-missing') ||
    missingControls.includes('source-binding-missing')
  ) {
    signals.add('evidence-gap');
  }
  if (
    missingControls.includes('approval-binding-missing') ||
    missingControls.includes('actor-binding-missing')
  ) {
    signals.add('authority-gap');
  }
  if (
    missingControls.includes('tenant-binding-missing') ||
    missingControls.includes('action-surface-missing') ||
    missingControls.includes('schema-digest-missing') ||
    missingControls.includes('body-digest-missing')
  ) {
    signals.add('scope-gap');
  }
  if (
    missingControls.includes('target-system-missing') ||
    missingControls.includes('gate-proof-missing') ||
    missingControls.includes('replay-proof-missing')
  ) {
    signals.add('adapter-gap');
  }
  return Object.freeze([...signals].sort());
}

function recommendedNextStepFor(
  missingControls: readonly RuntimeSignalConsequenceMissingControl[],
): ActionRiskNextStep {
  if (missingControls.includes('policy-binding-missing')) return 'define-policy';
  if (
    missingControls.includes('evidence-binding-missing') ||
    missingControls.includes('source-binding-missing')
  ) {
    return 'bind-evidence';
  }
  if (
    missingControls.includes('approval-binding-missing') ||
    missingControls.includes('actor-binding-missing')
  ) {
    return 'bind-authority';
  }
  if (
    missingControls.includes('tenant-binding-missing') ||
    missingControls.includes('action-surface-missing') ||
    missingControls.includes('schema-digest-missing') ||
    missingControls.includes('body-digest-missing')
  ) {
    return 'bind-scope';
  }
  if (
    missingControls.includes('target-system-missing') ||
    missingControls.includes('gate-proof-missing') ||
    missingControls.includes('replay-proof-missing')
  ) {
    return 'prepare-adapter';
  }
  return 'candidate-for-review';
}

function assertKnownNextStep(value: ActionRiskNextStep): ActionRiskNextStep {
  if (!ACTION_RISK_NEXT_STEPS.includes(value)) {
    throw new Error('Runtime signal consequence mapping selected an unknown next step.');
  }
  return value;
}

export function mapRuntimeSignalToConsequenceCandidate(
  envelope: RuntimeSignalEnvelope,
): RuntimeSignalConsequenceCandidate {
  assertEnvelopeBoundary(envelope);

  const actionSurface = candidateActionSurfaceFor(envelope);
  const consequenceClass = consequenceClassFor(envelope);
  const missingControls = missingControlsFor(envelope);
  const riskSignals = riskSignalsFor(missingControls);
  const recommendedNextStep = assertKnownNextStep(
    recommendedNextStepFor(missingControls),
  );
  const actionSurfaceDigest = canonicalObject({
    actionSurface: actionSurface.value,
  }).digest;

  const payload = {
    version: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    consequenceEnvelopeContractVersion: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    actionRiskInventoryVersion: ACTION_RISK_INVENTORY_VERSION,
    runtimeSignalAuthorityGuardVersion: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    sourceSignalDigest: envelope.signalDigest,
    sourceSignalKind: envelope.signalKind,
    sourceTrustLevel: envelope.sourceTrustLevel,
    sourceSystem: envelope.sourceSystem,
    actionSurface: actionSurface.value,
    actionSurfaceDigest,
    downstreamSystem: envelope.downstreamSystem,
    operationRef: envelope.operationRef,
    consequenceClass: consequenceClass.value,
    candidateOrigin: candidateOriginFor(envelope.signalKind),
    mappingRuleIds: Object.freeze([
      actionSurface.ruleId,
      consequenceClass.ruleId,
      'missing-control-scan',
    ] satisfies RuntimeSignalConsequenceMappingRuleId[]),
    missingControls,
    riskSignals,
    recommendedNextStep,
    digestOnly: true,
    reviewMaterialOnly: true,
    rawPayloadStored: false,
    rawPromptStored: false,
    rawToolPayloadStored: false,
    rawProviderBodyStored: false,
    rawCustomerIdentifierStored: false,
    rawTenantIdentifierStored: false,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
  } as const;
  assertRuntimeSignalAuthorityBoundary({
    signalKind: envelope.signalKind,
    sourceTrustLevel: envelope.sourceTrustLevel,
    target: payload,
    targetLabel: 'runtime-signal-consequence-candidate',
  });
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    candidateDigest: canonical.digest,
  });
}

export function runtimeSignalConsequenceMappingDescriptor(): RuntimeSignalConsequenceMappingDescriptor {
  return Object.freeze({
    version: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_VERSION,
    runtimeSignalEnvelopeVersion: RUNTIME_SIGNAL_ENVELOPE_VERSION,
    consequenceEnvelopeContractVersion: CONSEQUENCE_ENVELOPE_CONTRACT_VERSION,
    actionRiskInventoryVersion: ACTION_RISK_INVENTORY_VERSION,
    runtimeSignalAuthorityGuardVersion: RUNTIME_SIGNAL_AUTHORITY_GUARD_VERSION,
    consequenceClasses: CONSEQUENCE_ENVELOPE_CONSEQUENCE_CLASSES,
    candidateOrigins: RUNTIME_SIGNAL_CONSEQUENCE_CANDIDATE_ORIGINS,
    missingControls: RUNTIME_SIGNAL_CONSEQUENCE_MISSING_CONTROLS,
    mappingRuleIds: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_RULE_IDS,
    requiredFields: RUNTIME_SIGNAL_CONSEQUENCE_MAPPING_REQUIRED_FIELDS,
    ruleBasedCandidateOnly: true,
    mapsToExistingConsequenceClasses: true,
    proofSignalsHandledByProofIntake: true,
    digestOnly: true,
    reviewMaterialOnly: true,
    grantsAuthority: false,
    canGrantAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    productionReady: false,
    outputIsDecisionSupportOnly: true,
    nonClaims: Object.freeze([
      'not-authority',
      'not-admission',
      'not-gate-plan',
      'not-enforcement-proof-intake',
      'not-production-ready',
    ]),
  });
}
