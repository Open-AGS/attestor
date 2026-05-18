import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  ASSURANCE_CASE_CONTRACT_VERSION,
  createAssuranceCaseDefeater,
  createAssuranceCaseNode,
  createAssuranceCaseTransition,
  type AssuranceCaseDefeater,
  type AssuranceCaseNode,
  type AssuranceCaseTransition,
} from './assurance-case-contract.js';
import {
  DECISION_TRACE_LOGGER_VERSION,
  type DecisionTraceSnapshot,
} from './decision-trace-logger.js';

export const TLA_TRACE_VALIDATOR_BRIDGE_VERSION =
  'attestor.tla-trace-validator-bridge.v1';

export const TLA_TRACE_VALIDATOR_SPEC_MODULE = 'AdmissionStateMachine';

export const TLA_TRACE_VALIDATOR_INVARIANTS = [
  'TypeOK',
  'NoAdmitWithoutAuthority',
  'NoEnforcementWithoutPacket',
  'NoCrossTenantLeak',
  'NoReviewBypass',
  'MonotoneFusion',
  'ReplaySafety',
] as const;
export type TlaTraceValidatorInvariant =
  typeof TLA_TRACE_VALIDATOR_INVARIANTS[number];

export const TLA_TRACE_VALIDATOR_SOURCE_ANCHORS = [
  'microsoft-tla-specifying-systems-design-first',
  'aws-formal-methods-design-bug-discovery',
  'aws-systems-correctness-formal-spec-practice',
  'apalache-tla-model-checker-documentation',
  'decision-trace-logger-offline-spec-check-boundary',
] as const;
export type TlaTraceValidatorSourceAnchor =
  typeof TLA_TRACE_VALIDATOR_SOURCE_ANCHORS[number];

export const TLA_TRACE_VALIDATOR_KINDS = [
  'tlc-report',
  'apalache-report',
  'external-trace-check-report',
] as const;
export type TlaTraceValidatorKind =
  typeof TLA_TRACE_VALIDATOR_KINDS[number];

export const TLA_TRACE_VALIDATOR_VERDICTS = [
  'valid',
  'invalid',
  'unknown',
  'not-run',
] as const;
export type TlaTraceValidatorVerdict =
  typeof TLA_TRACE_VALIDATOR_VERDICTS[number];

export const TLA_TRACE_VALIDATOR_OUTCOMES = [
  'tla-trace-evidence-ready',
  'tla-trace-held-for-trace-verification',
  'tla-trace-held-for-spec-binding',
  'tla-trace-held-for-validator-report',
  'tla-trace-open-rebutting-defeater',
  'tla-trace-open-undercutting-defeater',
  'tla-trace-rejected-boundary',
] as const;
export type TlaTraceValidatorOutcome =
  typeof TLA_TRACE_VALIDATOR_OUTCOMES[number];

export const TLA_TRACE_VALIDATOR_DANGER_FLAGS = [
  'trace-verification-failed',
  'trace-snapshot-empty',
  'spec-ref-missing',
  'config-ref-missing',
  'invariant-set-empty',
  'validator-report-missing',
  'validator-verdict-invalid',
  'validator-verdict-unknown',
  'validator-not-run',
  'counterexample-missing',
  'raw-trace-requested',
  'raw-spec-requested',
  'runtime-oracle-requested',
  'formal-proof-claimed',
  'policy-activation-requested',
  'live-enforcement-requested',
  'authority-action-requested',
] as const;
export type TlaTraceValidatorDangerFlag =
  typeof TLA_TRACE_VALIDATOR_DANGER_FLAGS[number];

export interface CreateTlaTraceValidatorBridgeInput {
  readonly snapshot: DecisionTraceSnapshot;
  readonly bridgeId: string;
  readonly evaluatedAt: string;
  readonly validatorRefDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly targetClaimNodeId: string;
  readonly specRefDigest?: string | null;
  readonly configRefDigest?: string | null;
  readonly invariantNames: readonly TlaTraceValidatorInvariant[];
  readonly validatorKind: TlaTraceValidatorKind;
  readonly validatorVerdict: TlaTraceValidatorVerdict;
  readonly validatorReportRefDigest?: string | null;
  readonly counterexampleRefDigest?: string | null;
  readonly evidenceNodeId?: string | null;
  readonly defeaterId?: string | null;
  readonly rawTraceRequested?: boolean | null;
  readonly rawSpecRequested?: boolean | null;
  readonly runtimeOracleRequested?: boolean | null;
  readonly formalProofClaimed?: boolean | null;
  readonly policyActivationRequested?: boolean | null;
  readonly liveEnforcementRequested?: boolean | null;
  readonly authorityActionRequested?: boolean | null;
}

export interface TlaTraceValidatorBridgeRecord {
  readonly version: typeof TLA_TRACE_VALIDATOR_BRIDGE_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly specModuleName: typeof TLA_TRACE_VALIDATOR_SPEC_MODULE;
  readonly bridgeId: string;
  readonly bridgeRefDigest: string;
  readonly evaluatedAt: string;
  readonly validatorRefDigest: string;
  readonly tenantRefDigest: string;
  readonly scopeDigest: string;
  readonly targetClaimNodeId: string;
  readonly traceSnapshotDigest: string;
  readonly traceId: string;
  readonly traceRootDigest: string | null;
  readonly traceEntryCount: number;
  readonly traceVerificationValid: boolean;
  readonly specRefDigest: string | null;
  readonly configRefDigest: string | null;
  readonly invariantNames: readonly TlaTraceValidatorInvariant[];
  readonly validatorKind: TlaTraceValidatorKind;
  readonly validatorVerdict: TlaTraceValidatorVerdict;
  readonly validatorReportRefDigest: string | null;
  readonly counterexampleRefDigest: string | null;
  readonly evidenceBodyDigest: string;
  readonly transitionReasonDigest: string;
  readonly evidenceNode: AssuranceCaseNode | null;
  readonly openDefeater: AssuranceCaseDefeater | null;
  readonly evidenceTransition: AssuranceCaseTransition | null;
  readonly defeaterTransition: AssuranceCaseTransition | null;
  readonly evidenceNodeDigest: string | null;
  readonly openDefeaterDigest: string | null;
  readonly outcome: TlaTraceValidatorOutcome;
  readonly dangerFlags: readonly TlaTraceValidatorDangerFlag[];
  readonly reasonCodes: readonly string[];
  readonly formalSpecEvidenceReady: boolean;
  readonly opensRebuttingDefeater: boolean;
  readonly opensUndercuttingDefeater: boolean;
  readonly digestOnly: true;
  readonly noRawTrace: true;
  readonly noRawSpec: true;
  readonly doesNotRunModelChecker: true;
  readonly notRuntimeOracle: true;
  readonly noFormalProofClaim: true;
  readonly noPolicyActivation: true;
  readonly noLiveEnforcement: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface TlaTraceValidatorBridgeDescriptor {
  readonly version: typeof TLA_TRACE_VALIDATOR_BRIDGE_VERSION;
  readonly assuranceCaseContractVersion: typeof ASSURANCE_CASE_CONTRACT_VERSION;
  readonly decisionTraceLoggerVersion: typeof DECISION_TRACE_LOGGER_VERSION;
  readonly specModuleName: typeof TLA_TRACE_VALIDATOR_SPEC_MODULE;
  readonly invariants: readonly TlaTraceValidatorInvariant[];
  readonly sourceAnchors: readonly TlaTraceValidatorSourceAnchor[];
  readonly validatorKinds: readonly TlaTraceValidatorKind[];
  readonly validatorVerdicts: readonly TlaTraceValidatorVerdict[];
  readonly outcomes: readonly TlaTraceValidatorOutcome[];
  readonly dangerFlags: readonly TlaTraceValidatorDangerFlag[];
  readonly createsEvidenceNodeOnValidReport: true;
  readonly opensRebuttingDefeaterOnInvalidReport: true;
  readonly opensUndercuttingDefeaterOnUnknownReport: true;
  readonly requiresVerifiedDecisionTrace: true;
  readonly requiresValidatorReportForEvidence: true;
  readonly digestOnly: true;
  readonly noRawTrace: true;
  readonly noRawSpec: true;
  readonly doesNotRunModelChecker: true;
  readonly notRuntimeOracle: true;
  readonly noFormalProofClaim: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly productionReady: false;
  readonly nonClaims: readonly string[];
}

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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

function normalizeIdentifier(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(`TLA trace validator bridge ${fieldName} requires a string.`);
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 1024 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new Error(
      `TLA trace validator bridge ${fieldName} must be non-empty, bounded, and control-free.`,
    );
  }
  return normalized;
}

function normalizeDigest(value: string | null | undefined, fieldName: string): string {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!SHA256_DIGEST_PATTERN.test(normalized)) {
    throw new Error(`TLA trace validator bridge ${fieldName} must be a sha256 digest.`);
  }
  return normalized;
}

function normalizeOptionalDigest(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return normalizeDigest(value, fieldName);
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string): string {
  const timestamp = new Date(value ?? '');
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`TLA trace validator bridge ${fieldName} must be an ISO timestamp.`);
  }
  return timestamp.toISOString();
}

function normalizeEnumValue<const Values extends readonly string[]>(
  value: string | null | undefined,
  values: Values,
  fieldName: string,
): Values[number] {
  const normalized = normalizeIdentifier(value, fieldName);
  if (!values.includes(normalized)) {
    throw new Error(`TLA trace validator bridge ${fieldName} is not supported.`);
  }
  return normalized as Values[number];
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function shortDigest(digest: string): string {
  return digest.slice('sha256:'.length, 'sha256:'.length + 16);
}

function bodyDigest(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({
    kind,
    version: TLA_TRACE_VALIDATOR_BRIDGE_VERSION,
    value,
  }).digest;
}

function assertSnapshot(snapshot: DecisionTraceSnapshot): void {
  if (snapshot.version !== DECISION_TRACE_LOGGER_VERSION) {
    throw new Error('TLA trace validator bridge snapshot version mismatch.');
  }
  if (snapshot.verification.version !== DECISION_TRACE_LOGGER_VERSION) {
    throw new Error('TLA trace validator bridge trace verification version mismatch.');
  }
  if (snapshot.rawPayloadStored !== false || snapshot.digestOnly !== true) {
    throw new Error('TLA trace validator bridge requires digest-only decision traces.');
  }
  if (snapshot.writesAuditPlane !== false || snapshot.signatureIncluded !== false) {
    throw new Error('TLA trace validator bridge only accepts non-authority trace snapshots.');
  }
}

function normalizeInvariantNames(
  invariants: readonly TlaTraceValidatorInvariant[],
): readonly TlaTraceValidatorInvariant[] {
  return uniqueSorted(
    invariants.map((invariant, index) =>
      normalizeEnumValue(
        invariant,
        TLA_TRACE_VALIDATOR_INVARIANTS,
        `invariantNames[${index}]`,
      ) as TlaTraceValidatorInvariant),
  );
}

function flagsFor(input: {
  readonly snapshot: DecisionTraceSnapshot;
  readonly specRefDigest: string | null;
  readonly configRefDigest: string | null;
  readonly invariantNames: readonly TlaTraceValidatorInvariant[];
  readonly validatorVerdict: TlaTraceValidatorVerdict;
  readonly validatorReportRefDigest: string | null;
  readonly counterexampleRefDigest: string | null;
  readonly rawTraceRequested: boolean;
  readonly rawSpecRequested: boolean;
  readonly runtimeOracleRequested: boolean;
  readonly formalProofClaimed: boolean;
  readonly policyActivationRequested: boolean;
  readonly liveEnforcementRequested: boolean;
  readonly authorityActionRequested: boolean;
}): readonly TlaTraceValidatorDangerFlag[] {
  const flags = new Set<TlaTraceValidatorDangerFlag>();
  if (!input.snapshot.verification.valid) {
    flags.add('trace-verification-failed');
  }
  if (input.snapshot.entryCount === 0 || input.snapshot.entries.length === 0) {
    flags.add('trace-snapshot-empty');
  }
  if (input.specRefDigest === null) {
    flags.add('spec-ref-missing');
  }
  if (input.configRefDigest === null) {
    flags.add('config-ref-missing');
  }
  if (input.invariantNames.length === 0) {
    flags.add('invariant-set-empty');
  }
  if (
    input.validatorVerdict !== 'not-run' &&
    input.validatorReportRefDigest === null
  ) {
    flags.add('validator-report-missing');
  }
  if (input.validatorVerdict === 'invalid') {
    flags.add('validator-verdict-invalid');
    if (input.counterexampleRefDigest === null) {
      flags.add('counterexample-missing');
    }
  }
  if (input.validatorVerdict === 'unknown') {
    flags.add('validator-verdict-unknown');
  }
  if (input.validatorVerdict === 'not-run') {
    flags.add('validator-not-run');
  }
  if (input.rawTraceRequested) {
    flags.add('raw-trace-requested');
  }
  if (input.rawSpecRequested) {
    flags.add('raw-spec-requested');
  }
  if (input.runtimeOracleRequested) {
    flags.add('runtime-oracle-requested');
  }
  if (input.formalProofClaimed) {
    flags.add('formal-proof-claimed');
  }
  if (input.policyActivationRequested) {
    flags.add('policy-activation-requested');
  }
  if (input.liveEnforcementRequested) {
    flags.add('live-enforcement-requested');
  }
  if (input.authorityActionRequested) {
    flags.add('authority-action-requested');
  }
  return uniqueSorted([...flags]);
}

function outcomeFor(flags: readonly TlaTraceValidatorDangerFlag[]):
  TlaTraceValidatorOutcome {
  if (
    flags.includes('raw-trace-requested') ||
    flags.includes('raw-spec-requested') ||
    flags.includes('runtime-oracle-requested') ||
    flags.includes('formal-proof-claimed') ||
    flags.includes('policy-activation-requested') ||
    flags.includes('live-enforcement-requested') ||
    flags.includes('authority-action-requested')
  ) {
    return 'tla-trace-rejected-boundary';
  }
  if (
    flags.includes('trace-verification-failed') ||
    flags.includes('trace-snapshot-empty')
  ) {
    return 'tla-trace-held-for-trace-verification';
  }
  if (
    flags.includes('spec-ref-missing') ||
    flags.includes('config-ref-missing') ||
    flags.includes('invariant-set-empty')
  ) {
    return 'tla-trace-held-for-spec-binding';
  }
  if (
    flags.includes('validator-report-missing') ||
    flags.includes('validator-not-run')
  ) {
    return 'tla-trace-held-for-validator-report';
  }
  if (flags.includes('validator-verdict-invalid')) {
    return 'tla-trace-open-rebutting-defeater';
  }
  if (flags.includes('validator-verdict-unknown')) {
    return 'tla-trace-open-undercutting-defeater';
  }
  return 'tla-trace-evidence-ready';
}

function reasonCodesFor(input: {
  readonly outcome: TlaTraceValidatorOutcome;
  readonly flags: readonly TlaTraceValidatorDangerFlag[];
  readonly validatorKind: TlaTraceValidatorKind;
  readonly validatorVerdict: TlaTraceValidatorVerdict;
}): readonly string[] {
  const reasons = new Set<string>([
    `tla-trace-outcome:${input.outcome}`,
    `tla-trace-validator-kind:${input.validatorKind}`,
    `tla-trace-validator-verdict:${input.validatorVerdict}`,
    ...input.flags.map((flag) => `tla-trace-flag:${flag}`),
  ]);
  if (input.flags.length === 0) {
    reasons.add('tla-trace-formal-spec-evidence-ready');
  }
  return uniqueSorted([...reasons]);
}

export function createTlaTraceValidatorBridge(
  input: CreateTlaTraceValidatorBridgeInput,
): TlaTraceValidatorBridgeRecord {
  assertSnapshot(input.snapshot);
  const bridgeId = normalizeIdentifier(input.bridgeId, 'bridgeId');
  const evaluatedAt = normalizeIsoTimestamp(input.evaluatedAt, 'evaluatedAt');
  const validatorRefDigest = normalizeDigest(input.validatorRefDigest, 'validatorRefDigest');
  const tenantRefDigest = normalizeDigest(input.tenantRefDigest, 'tenantRefDigest');
  const scopeDigest = normalizeDigest(input.scopeDigest, 'scopeDigest');
  const targetClaimNodeId = normalizeIdentifier(input.targetClaimNodeId, 'targetClaimNodeId');
  const specRefDigest = normalizeOptionalDigest(input.specRefDigest, 'specRefDigest');
  const configRefDigest = normalizeOptionalDigest(input.configRefDigest, 'configRefDigest');
  const invariantNames = normalizeInvariantNames(input.invariantNames);
  const validatorKind = normalizeEnumValue(
    input.validatorKind,
    TLA_TRACE_VALIDATOR_KINDS,
    'validatorKind',
  ) as TlaTraceValidatorKind;
  const validatorVerdict = normalizeEnumValue(
    input.validatorVerdict,
    TLA_TRACE_VALIDATOR_VERDICTS,
    'validatorVerdict',
  ) as TlaTraceValidatorVerdict;
  const validatorReportRefDigest = normalizeOptionalDigest(
    input.validatorReportRefDigest,
    'validatorReportRefDigest',
  );
  const counterexampleRefDigest = normalizeOptionalDigest(
    input.counterexampleRefDigest,
    'counterexampleRefDigest',
  );
  const flags = flagsFor({
    snapshot: input.snapshot,
    specRefDigest,
    configRefDigest,
    invariantNames,
    validatorVerdict,
    validatorReportRefDigest,
    counterexampleRefDigest,
    rawTraceRequested: input.rawTraceRequested === true,
    rawSpecRequested: input.rawSpecRequested === true,
    runtimeOracleRequested: input.runtimeOracleRequested === true,
    formalProofClaimed: input.formalProofClaimed === true,
    policyActivationRequested: input.policyActivationRequested === true,
    liveEnforcementRequested: input.liveEnforcementRequested === true,
    authorityActionRequested: input.authorityActionRequested === true,
  });
  const outcome = outcomeFor(flags);
  const reasonCodes = reasonCodesFor({
    outcome,
    flags,
    validatorKind,
    validatorVerdict,
  });
  const bridgeRefDigest = bodyDigest('tla-trace-validator-bridge-ref', {
    bridgeId,
    traceSnapshotDigest: input.snapshot.digest,
    specRefDigest,
    configRefDigest,
    invariantNames,
    validatorKind,
    validatorVerdict,
    validatorReportRefDigest,
    counterexampleRefDigest,
  } as CanonicalReleaseJsonValue);
  const evidenceBodyDigest = bodyDigest('tla-trace-validator-evidence-body', {
    bridgeId,
    bridgeRefDigest,
    traceSnapshotDigest: input.snapshot.digest,
    traceId: input.snapshot.traceId,
    traceRootDigest: input.snapshot.rootDigest,
    traceEntryCount: input.snapshot.entryCount,
    traceVerificationValid: input.snapshot.verification.valid,
    specModuleName: TLA_TRACE_VALIDATOR_SPEC_MODULE,
    specRefDigest,
    configRefDigest,
    invariantNames,
    validatorKind,
    validatorVerdict,
    validatorReportRefDigest,
    counterexampleRefDigest,
    reasonCodes,
  } as CanonicalReleaseJsonValue);
  const transitionReasonDigest = bodyDigest('tla-trace-validator-transition-reason', {
    reasonCodes,
  } as CanonicalReleaseJsonValue);
  const formalSpecEvidenceReady = outcome === 'tla-trace-evidence-ready';
  const opensRebuttingDefeater = outcome === 'tla-trace-open-rebutting-defeater';
  const opensUndercuttingDefeater = outcome === 'tla-trace-open-undercutting-defeater';
  const evidenceNode = formalSpecEvidenceReady
    ? createAssuranceCaseNode({
        nodeId: normalizeIdentifier(
          input.evidenceNodeId ??
            `evidence:tla-trace-validation:${shortDigest(bridgeRefDigest)}`,
          'evidenceNodeId',
        ),
        kind: 'evidence',
        title: 'TLA+ trace validation evidence',
        bodyDigest: evidenceBodyDigest,
        tenantRefDigest,
        scopeDigest,
        createdByRefDigest: validatorRefDigest,
        createdAt: evaluatedAt,
        sourceStandards: ['living-assurance-case', 'eliminative-argumentation'],
      })
    : null;
  const openDefeater = opensRebuttingDefeater || opensUndercuttingDefeater
    ? createAssuranceCaseDefeater({
        defeaterId: normalizeIdentifier(
          input.defeaterId ??
            `defeater:tla-trace-validation:${shortDigest(bridgeRefDigest)}`,
          'defeaterId',
        ),
        kind: opensRebuttingDefeater ? 'rebutting' : 'undercutting',
        state: 'open',
        attacksNodeId: targetClaimNodeId,
        reasonDigest: evidenceBodyDigest,
        tenantRefDigest,
        openedByRefDigest: validatorRefDigest,
        openedAt: evaluatedAt,
      })
    : null;
  const evidenceTransition = evidenceNode === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:create:${evidenceNode.nodeId}`,
        transitionKind: 'create-node',
        actorRefDigest: validatorRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        nodeId: evidenceNode.nodeId,
        evidenceRefDigest: bridgeRefDigest,
      });
  const defeaterTransition = openDefeater === null
    ? null
    : createAssuranceCaseTransition({
        transitionId: `transition:open:${openDefeater.defeaterId}`,
        transitionKind: 'open-defeater',
        actorRefDigest: validatorRefDigest,
        occurredAt: evaluatedAt,
        reasonDigest: transitionReasonDigest,
        defeaterId: openDefeater.defeaterId,
        fromState: null,
        toState: 'open',
        evidenceRefDigest: bridgeRefDigest,
      });
  const core: Omit<TlaTraceValidatorBridgeRecord, 'canonical' | 'digest'> = {
    version: TLA_TRACE_VALIDATOR_BRIDGE_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    specModuleName: TLA_TRACE_VALIDATOR_SPEC_MODULE,
    bridgeId,
    bridgeRefDigest,
    evaluatedAt,
    validatorRefDigest,
    tenantRefDigest,
    scopeDigest,
    targetClaimNodeId,
    traceSnapshotDigest: input.snapshot.digest,
    traceId: input.snapshot.traceId,
    traceRootDigest: input.snapshot.rootDigest,
    traceEntryCount: input.snapshot.entryCount,
    traceVerificationValid: input.snapshot.verification.valid,
    specRefDigest,
    configRefDigest,
    invariantNames,
    validatorKind,
    validatorVerdict,
    validatorReportRefDigest,
    counterexampleRefDigest,
    evidenceBodyDigest,
    transitionReasonDigest,
    evidenceNode,
    openDefeater,
    evidenceTransition,
    defeaterTransition,
    evidenceNodeDigest: evidenceNode?.digest ?? null,
    openDefeaterDigest: openDefeater?.digest ?? null,
    outcome,
    dangerFlags: flags,
    reasonCodes,
    formalSpecEvidenceReady,
    opensRebuttingDefeater,
    opensUndercuttingDefeater,
    digestOnly: true,
    noRawTrace: true,
    noRawSpec: true,
    doesNotRunModelChecker: true,
    notRuntimeOracle: true,
    noFormalProofClaim: true,
    noPolicyActivation: true,
    noLiveEnforcement: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
  };
  const canonical = canonicalObject(core as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({ ...core, ...canonical });
}

export function tlaTraceValidatorBridgeDescriptor():
  TlaTraceValidatorBridgeDescriptor {
  return Object.freeze({
    version: TLA_TRACE_VALIDATOR_BRIDGE_VERSION,
    assuranceCaseContractVersion: ASSURANCE_CASE_CONTRACT_VERSION,
    decisionTraceLoggerVersion: DECISION_TRACE_LOGGER_VERSION,
    specModuleName: TLA_TRACE_VALIDATOR_SPEC_MODULE,
    invariants: TLA_TRACE_VALIDATOR_INVARIANTS,
    sourceAnchors: TLA_TRACE_VALIDATOR_SOURCE_ANCHORS,
    validatorKinds: TLA_TRACE_VALIDATOR_KINDS,
    validatorVerdicts: TLA_TRACE_VALIDATOR_VERDICTS,
    outcomes: TLA_TRACE_VALIDATOR_OUTCOMES,
    dangerFlags: TLA_TRACE_VALIDATOR_DANGER_FLAGS,
    createsEvidenceNodeOnValidReport: true,
    opensRebuttingDefeaterOnInvalidReport: true,
    opensUndercuttingDefeaterOnUnknownReport: true,
    requiresVerifiedDecisionTrace: true,
    requiresValidatorReportForEvidence: true,
    digestOnly: true,
    noRawTrace: true,
    noRawSpec: true,
    doesNotRunModelChecker: true,
    notRuntimeOracle: true,
    noFormalProofClaim: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    productionReady: false,
    nonClaims: Object.freeze([
      'not-tlc-runner',
      'not-apalache-runner',
      'not-formal-proof',
      'not-runtime-oracle',
      'not-policy-activation',
      'not-live-enforcement',
      'not-production-ready',
    ]),
  });
}
