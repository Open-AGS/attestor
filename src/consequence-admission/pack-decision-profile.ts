import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import type {
  ConsequenceAdmissionCheck,
  ConsequenceAdmissionCheckOutcome,
  ConsequenceAdmissionDecision,
  ConsequenceAdmissionPackFamily,
  ConsequenceAdmissionResponse,
} from './index.js';

export const CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION =
  'attestor.consequence-admission-pack-decision-profile.v1';

export const CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES = [
  'execution-ready',
  'constrained-ready',
  'human-review-required',
  'blocked',
  'unsupported-pack',
] as const;
export type ConsequenceAdmissionPackDecisionPosture =
  typeof CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES[number];

export const CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS = [
  'proceed',
  'proceed-with-constraints',
  'route-to-finance-review',
  'run-crypto-preflight',
  'collect-proof-material',
  'resolve-required-checks',
  'block-downstream',
  'route-to-operator-review',
] as const;
export type ConsequenceAdmissionPackDecisionRecommendedAction =
  typeof CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS[number];

export const CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_SEVERITIES = [
  'info',
  'warn',
  'block',
] as const;
export type ConsequenceAdmissionPackDecisionSignalSeverity =
  typeof CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_SEVERITIES[number];

export const CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS = [
  'native-decision-mapping',
  'required-check-failure',
  'proof-readiness',
  'finance-release-token-posture',
  'finance-review-queue-posture',
  'finance-authority-chain-posture',
  'finance-runtime-quota-posture',
  'crypto-package-boundary-posture',
  'crypto-adapter-readiness-posture',
  'crypto-plan-posture',
  'crypto-required-step-posture',
  'unsupported-pack-family',
] as const;
export type ConsequenceAdmissionPackDecisionSignalKind =
  typeof CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS[number];

type PackDecisionPrimitive = string | number | boolean | null;

export interface ConsequenceAdmissionPackDecisionSignal {
  readonly signalId: string;
  readonly kind: ConsequenceAdmissionPackDecisionSignalKind;
  readonly severity: ConsequenceAdmissionPackDecisionSignalSeverity;
  readonly packFamily: ConsequenceAdmissionPackFamily;
  readonly checkKind: ConsequenceAdmissionCheck['kind'] | null;
  readonly checkOutcome: ConsequenceAdmissionCheckOutcome | null;
  readonly decision: ConsequenceAdmissionDecision;
  readonly reasonCodes: readonly string[];
  readonly summary: string;
  readonly modelSafeFeedback: readonly string[];
}

export interface ConsequenceAdmissionPackDecisionCheckSummary {
  readonly totalChecks: number;
  readonly requiredCheckCount: number;
  readonly requiredFailCount: number;
  readonly warnCount: number;
  readonly passCount: number;
  readonly failedRequiredKinds: readonly ConsequenceAdmissionCheck['kind'][];
}

export interface ConsequenceAdmissionPackDecisionProofSummary {
  readonly proofCount: number;
  readonly proofKinds: readonly string[];
  readonly hasReleaseToken: boolean;
  readonly hasEvidencePack: boolean;
  readonly hasAdmissionPlan: boolean;
  readonly hasSimulationReference: boolean;
}

export interface ConsequenceAdmissionPackDecisionProfile {
  readonly version: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION;
  readonly profileId: string;
  readonly createdAt: string;
  readonly admissionId: string;
  readonly admissionDigest: string;
  readonly packFamily: ConsequenceAdmissionPackFamily;
  readonly nativeSurface: string | null;
  readonly decision: ConsequenceAdmissionDecision;
  readonly allowed: boolean;
  readonly failClosed: boolean;
  readonly posture: ConsequenceAdmissionPackDecisionPosture;
  readonly recommendedAction: ConsequenceAdmissionPackDecisionRecommendedAction;
  readonly checkSummary: ConsequenceAdmissionPackDecisionCheckSummary;
  readonly proofSummary: ConsequenceAdmissionPackDecisionProofSummary;
  readonly facts: Readonly<Record<string, PackDecisionPrimitive>>;
  readonly signals: readonly ConsequenceAdmissionPackDecisionSignal[];
  readonly modelSafeFeedback: readonly string[];
  readonly rawPayloadStored: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly rawWalletMetadataStored: false;
  readonly rawPaymentDataStored: false;
  readonly privatePolicyThresholdsStored: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface ConsequenceAdmissionPackDecisionProfileDescriptor {
  readonly version: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION;
  readonly supportedPackFamilies: readonly ['finance', 'crypto'];
  readonly postures: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES;
  readonly recommendedActions: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS;
  readonly signalKinds: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS;
  readonly signalSeverities: typeof CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_SEVERITIES;
  readonly modelSafe: true;
  readonly rawPayloadStored: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly rawWalletMetadataStored: false;
  readonly rawPaymentDataStored: false;
  readonly privatePolicyThresholdsStored: false;
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

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function contextString(
  response: ConsequenceAdmissionResponse,
  key: string,
): string | null {
  const value = response.operationalContext[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function contextNumber(
  response: ConsequenceAdmissionResponse,
  key: string,
): number | null {
  const value = response.operationalContext[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function contextBoolean(
  response: ConsequenceAdmissionResponse,
  key: string,
): boolean | null {
  const value = response.operationalContext[key];
  return typeof value === 'boolean' ? value : null;
}

function checkSummaryFor(
  checks: readonly ConsequenceAdmissionCheck[],
): ConsequenceAdmissionPackDecisionCheckSummary {
  const failedRequiredKinds = checks
    .filter((check) => check.required && check.outcome === 'fail')
    .map((check) => check.kind);

  return Object.freeze({
    totalChecks: checks.length,
    requiredCheckCount: checks.filter((check) => check.required).length,
    requiredFailCount: failedRequiredKinds.length,
    warnCount: checks.filter((check) => check.outcome === 'warn').length,
    passCount: checks.filter((check) => check.outcome === 'pass').length,
    failedRequiredKinds: Object.freeze([...new Set(failedRequiredKinds)].sort()),
  });
}

function proofSummaryFor(
  response: ConsequenceAdmissionResponse,
): ConsequenceAdmissionPackDecisionProofSummary {
  const proofKinds = uniqueSorted(response.proof.map((proof) => proof.kind));

  return Object.freeze({
    proofCount: response.proof.length,
    proofKinds,
    hasReleaseToken: response.proof.some((proof) => proof.kind === 'release-token'),
    hasEvidencePack: response.proof.some(
      (proof) => proof.kind === 'release-evidence-pack',
    ),
    hasAdmissionPlan: response.proof.some((proof) => proof.kind === 'admission-plan'),
    hasSimulationReference: response.proof.some(
      (proof) => proof.kind === 'external-reference',
    ),
  });
}

function checkFor(
  response: ConsequenceAdmissionResponse,
  kind: ConsequenceAdmissionCheck['kind'],
): ConsequenceAdmissionCheck | null {
  return response.checks.find((check) => check.kind === kind) ?? null;
}

function severityForOutcome(
  outcome: ConsequenceAdmissionCheckOutcome | null,
): ConsequenceAdmissionPackDecisionSignalSeverity {
  if (outcome === 'fail') return 'block';
  if (outcome === 'warn' || outcome === 'not-applicable') return 'warn';
  return 'info';
}

function signal(input: {
  readonly response: ConsequenceAdmissionResponse;
  readonly kind: ConsequenceAdmissionPackDecisionSignalKind;
  readonly severity: ConsequenceAdmissionPackDecisionSignalSeverity;
  readonly check?: ConsequenceAdmissionCheck | null;
  readonly reasonCodes?: readonly string[];
  readonly summary: string;
}): ConsequenceAdmissionPackDecisionSignal {
  const reasonCodes = uniqueSorted(input.reasonCodes ?? input.check?.reasonCodes ?? []);
  const checkKind = input.check?.kind ?? null;
  const checkOutcome = input.check?.outcome ?? null;

  return Object.freeze({
    signalId: [
      input.response.request.packFamily,
      input.kind,
      input.severity,
      checkKind ?? 'none',
      ...reasonCodes,
    ].join(':'),
    kind: input.kind,
    severity: input.severity,
    packFamily: input.response.request.packFamily,
    checkKind,
    checkOutcome,
    decision: input.response.decision,
    reasonCodes,
    summary: input.summary,
    modelSafeFeedback: Object.freeze([
      `pack:${input.response.request.packFamily}`,
      `decision:${input.response.decision}`,
      `signal:${input.kind}`,
      `severity:${input.severity}`,
      ...reasonCodes.map((reason) => `reason:${reason}`),
    ]),
  });
}

function nativeDecisionSignal(
  response: ConsequenceAdmissionResponse,
): ConsequenceAdmissionPackDecisionSignal {
  const severity: ConsequenceAdmissionPackDecisionSignalSeverity =
    response.decision === 'block'
      ? 'block'
      : response.decision === 'review'
        ? 'warn'
        : 'info';

  return signal({
    response,
    kind: 'native-decision-mapping',
    severity,
    reasonCodes: response.reasonCodes,
    summary:
      response.nativeDecision === null
        ? 'No native pack decision was attached to this admission response.'
        : `${response.nativeDecision.surface} mapped ${response.nativeDecision.value} to ${response.decision}.`,
  });
}

function requiredFailureSignals(
  response: ConsequenceAdmissionResponse,
): readonly ConsequenceAdmissionPackDecisionSignal[] {
  return Object.freeze(
    response.checks
      .filter((check) => check.required && check.outcome === 'fail')
      .map((check) =>
        signal({
          response,
          kind: 'required-check-failure',
          severity: 'block',
          check,
          summary: `${check.kind} failed and the pack decision must remain fail-closed.`,
        }),
      ),
  );
}

function proofReadinessSignal(
  response: ConsequenceAdmissionResponse,
): ConsequenceAdmissionPackDecisionSignal {
  const proofSummary = proofSummaryFor(response);
  const severity: ConsequenceAdmissionPackDecisionSignalSeverity =
    response.decision === 'admit' && proofSummary.proofCount === 0 ? 'block' : 'info';

  return signal({
    response,
    kind: 'proof-readiness',
    severity,
    reasonCodes: proofSummary.proofKinds.map((kind) => `proof:${kind}`),
    summary:
      proofSummary.proofCount > 0
        ? 'Digest-bound proof references are attached to the pack decision.'
        : 'No digest-bound proof references are attached to the pack decision.',
  });
}

function financeSignals(
  response: ConsequenceAdmissionResponse,
): readonly ConsequenceAdmissionPackDecisionSignal[] {
  const authority = checkFor(response, 'authority');
  const enforcement = checkFor(response, 'enforcement');
  const proofSummary = proofSummaryFor(response);
  const usageEnforced = contextBoolean(response, 'usageEnforced');
  const rateLimitEnforced = contextBoolean(response, 'rateLimitEnforced');
  const releaseDecisionPresent = contextString(response, 'releaseDecisionId') !== null;

  return Object.freeze([
    signal({
      response,
      kind: 'finance-release-token-posture',
      severity: proofSummary.hasReleaseToken || response.decision !== 'admit'
        ? 'info'
        : 'warn',
      check: enforcement,
      reasonCodes: proofSummary.hasReleaseToken
        ? ['finance-release-token-present']
        : ['finance-release-token-missing'],
      summary: proofSummary.hasReleaseToken
        ? 'A release-token proof reference is present for downstream finance enforcement.'
        : 'No release-token proof reference is present for downstream finance enforcement.',
    }),
    signal({
      response,
      kind: 'finance-review-queue-posture',
      severity: response.decision === 'review' ? 'warn' : 'info',
      reasonCodes: response.proof.some((proof) => proof.kind === 'local-artifact')
        ? ['finance-review-queue-present']
        : ['finance-review-queue-not-present'],
      summary: response.proof.some((proof) => proof.kind === 'local-artifact')
        ? 'A review queue reference is present and automatic release must hold.'
        : 'No finance review queue reference is attached.',
    }),
    signal({
      response,
      kind: 'finance-authority-chain-posture',
      severity: severityForOutcome(authority?.outcome ?? null),
      check: authority,
      summary:
        authority?.outcome === 'pass'
          ? 'Finance authority closure is present in model-safe check form.'
          : 'Finance authority closure is missing, warned, or failed.',
    }),
    signal({
      response,
      kind: 'finance-runtime-quota-posture',
      severity: usageEnforced === false || rateLimitEnforced === false ? 'warn' : 'info',
      reasonCodes: [
        usageEnforced === false ? 'finance-usage-not-enforced' : 'finance-usage-observed',
        rateLimitEnforced === false
          ? 'finance-rate-limit-not-enforced'
          : 'finance-rate-limit-observed',
        releaseDecisionPresent
          ? 'finance-release-decision-present'
          : 'finance-release-decision-not-present',
      ],
      summary:
        'Finance runtime quota, rate-limit, and release-decision posture is summarized without exposing tenant or customer identifiers.',
    }),
  ]);
}

function cryptoSignals(
  response: ConsequenceAdmissionResponse,
): readonly ConsequenceAdmissionPackDecisionSignal[] {
  const adapter = checkFor(response, 'adapter-readiness');
  const requiredStepCount = contextNumber(response, 'requiredStepCount') ?? 0;
  const blockedReasonCount = contextNumber(response, 'blockedReasonCount') ?? 0;
  const route = response.request.entryPoint.route;
  const packageSubpath = response.request.entryPoint.packageSubpath;

  return Object.freeze([
    signal({
      response,
      kind: 'crypto-package-boundary-posture',
      severity: route === null && packageSubpath === 'attestor/crypto-execution-admission'
        ? 'info'
        : 'block',
      reasonCodes: route === null
        ? ['crypto-hosted-route-not-claimed']
        : ['crypto-hosted-route-claimed'],
      summary:
        'Crypto pack decision stays on the package boundary and does not claim a hosted execution route.',
    }),
    signal({
      response,
      kind: 'crypto-adapter-readiness-posture',
      severity: severityForOutcome(adapter?.outcome ?? null),
      check: adapter,
      summary:
        adapter?.outcome === 'pass'
          ? 'Crypto adapter readiness passed for the selected package surface.'
          : 'Crypto adapter readiness requires preflight, evidence, or operator resolution.',
    }),
    signal({
      response,
      kind: 'crypto-plan-posture',
      severity: blockedReasonCount > 0 || response.decision === 'block'
        ? 'block'
        : response.decision === 'review'
          ? 'warn'
          : 'info',
      reasonCodes: [
        `crypto-blocked-reason-count:${blockedReasonCount}`,
        `crypto-required-step-count:${requiredStepCount}`,
      ],
      summary:
        'Crypto plan posture is summarized by blocked reason and required step counts, not raw wallet or transaction payloads.',
    }),
    signal({
      response,
      kind: 'crypto-required-step-posture',
      severity: requiredStepCount > 0 ? 'warn' : 'info',
      reasonCodes: [`crypto-required-step-count:${requiredStepCount}`],
      summary:
        requiredStepCount > 0
          ? 'The crypto admission plan still has required steps before execution.'
          : 'The crypto admission plan has no remaining required steps.',
    }),
  ]);
}

function unsupportedPackSignal(
  response: ConsequenceAdmissionResponse,
): ConsequenceAdmissionPackDecisionSignal {
  return signal({
    response,
    kind: 'unsupported-pack-family',
    severity: 'warn',
    reasonCodes: [`unsupported-pack:${response.request.packFamily}`],
    summary:
      'No pack-specific decision logic is available for this pack family yet.',
  });
}

function factsFor(
  response: ConsequenceAdmissionResponse,
): Readonly<Record<string, PackDecisionPrimitive>> {
  const base = {
    checkCount: response.checks.length,
    proofCount: response.proof.length,
    nativeDecisionValue: response.nativeDecision?.value ?? null,
    nativeSurface: response.nativeDecision?.surface ?? null,
  };

  if (response.request.packFamily === 'finance') {
    return Object.freeze({
      ...base,
      hostedRoute: response.request.entryPoint.route,
      hasReleaseToken: proofSummaryFor(response).hasReleaseToken,
      hasEvidencePack: proofSummaryFor(response).hasEvidencePack,
      hasReviewQueueReference: response.proof.some((proof) => proof.kind === 'local-artifact'),
      usageEnforced: contextBoolean(response, 'usageEnforced'),
      rateLimitEnforced: contextBoolean(response, 'rateLimitEnforced'),
      releaseDecisionPresent: contextString(response, 'releaseDecisionId') !== null,
      releasePolicyVersionPresent: contextString(response, 'releasePolicyVersion') !== null,
    });
  }

  if (response.request.packFamily === 'crypto') {
    return Object.freeze({
      ...base,
      hostedRouteClaimed: response.request.entryPoint.route !== null,
      packageSubpath: response.request.entryPoint.packageSubpath,
      surface: contextString(response, 'surface'),
      adapterKind: contextString(response, 'adapterKind'),
      consequenceKind: contextString(response, 'consequenceKind'),
      standardsCount: contextNumber(response, 'standardsCount'),
      requiredHandoffArtifactCount: contextNumber(response, 'requiredHandoffArtifactCount'),
      requiredStepCount: contextNumber(response, 'requiredStepCount'),
      blockedReasonCount: contextNumber(response, 'blockedReasonCount'),
      nextActionCount: contextNumber(response, 'nextActionCount'),
      planDigestPresent: contextString(response, 'planDigest') !== null,
      simulationDigestPresent: contextString(response, 'simulationDigest') !== null,
    });
  }

  return Object.freeze(base);
}

function postureFor(input: {
  readonly response: ConsequenceAdmissionResponse;
  readonly checkSummary: ConsequenceAdmissionPackDecisionCheckSummary;
}): ConsequenceAdmissionPackDecisionPosture {
  if (input.response.request.packFamily !== 'finance' && input.response.request.packFamily !== 'crypto') {
    return 'unsupported-pack';
  }
  if (input.response.decision === 'block') return 'blocked';
  if (input.checkSummary.requiredFailCount > 0) return 'human-review-required';
  if (input.response.decision === 'review') return 'human-review-required';
  if (input.response.decision === 'narrow') return 'constrained-ready';
  return input.response.allowed ? 'execution-ready' : 'human-review-required';
}

function recommendedActionFor(input: {
  readonly response: ConsequenceAdmissionResponse;
  readonly posture: ConsequenceAdmissionPackDecisionPosture;
  readonly signals: readonly ConsequenceAdmissionPackDecisionSignal[];
}): ConsequenceAdmissionPackDecisionRecommendedAction {
  const { response, posture, signals } = input;

  if (posture === 'blocked' || signals.some((entry) => entry.severity === 'block')) {
    return response.decision === 'block' ? 'block-downstream' : 'resolve-required-checks';
  }
  if (response.request.packFamily === 'finance') {
    if (signals.some((entry) => entry.reasonCodes.includes('finance-review-queue-present'))) {
      return 'route-to-finance-review';
    }
    if (posture === 'human-review-required') return 'route-to-operator-review';
  }
  if (response.request.packFamily === 'crypto') {
    const adapter = checkFor(response, 'adapter-readiness');
    if (adapter?.outcome === 'warn' || adapter?.outcome === 'fail') {
      return 'run-crypto-preflight';
    }
    if (response.proof.length === 0) return 'collect-proof-material';
    if (posture === 'human-review-required') return 'route-to-operator-review';
  }
  if (posture === 'constrained-ready') return 'proceed-with-constraints';
  if (posture === 'execution-ready') return 'proceed';
  return 'route-to-operator-review';
}

function profileIdFor(input: {
  readonly admissionDigest: string;
  readonly createdAt: string;
}): string {
  return canonicalObject({
    version: CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
    admissionDigest: input.admissionDigest,
    createdAt: input.createdAt,
  }).digest;
}

export function createConsequenceAdmissionPackDecisionProfile(
  response: ConsequenceAdmissionResponse,
): ConsequenceAdmissionPackDecisionProfile {
  const checkSummary = checkSummaryFor(response.checks);
  const proofSummary = proofSummaryFor(response);
  const packSignals =
    response.request.packFamily === 'finance'
      ? financeSignals(response)
      : response.request.packFamily === 'crypto'
        ? cryptoSignals(response)
        : [unsupportedPackSignal(response)];
  const signals = Object.freeze([
    nativeDecisionSignal(response),
    proofReadinessSignal(response),
    ...requiredFailureSignals(response),
    ...packSignals,
  ]);
  const posture = postureFor({ response, checkSummary });
  const recommendedAction = recommendedActionFor({ response, posture, signals });
  const createdAt = response.decidedAt;
  const modelSafeFeedback = uniqueSorted([
    `pack:${response.request.packFamily}`,
    `decision:${response.decision}`,
    `posture:${posture}`,
    `action:${recommendedAction}`,
    ...signals.flatMap((entry) => entry.modelSafeFeedback),
  ]);
  const canonicalPayload = {
    version: CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
    profileId: profileIdFor({ admissionDigest: response.digest, createdAt }),
    createdAt,
    admissionId: response.admissionId,
    admissionDigest: response.digest,
    packFamily: response.request.packFamily,
    nativeSurface: response.nativeDecision?.surface ?? null,
    decision: response.decision,
    allowed: response.allowed,
    failClosed: response.failClosed,
    posture,
    recommendedAction,
    checkSummary,
    proofSummary,
    facts: factsFor(response),
    signals,
    modelSafeFeedback,
    rawPayloadStored: false,
    rawCustomerIdentifiersStored: false,
    rawWalletMetadataStored: false,
    rawPaymentDataStored: false,
    privatePolicyThresholdsStored: false,
  } as const;
  const canonical = canonicalObject(canonicalPayload as unknown as CanonicalReleaseJsonValue);

  return Object.freeze({
    ...canonicalPayload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function consequenceAdmissionPackDecisionProfileLabel(
  profile: ConsequenceAdmissionPackDecisionProfile,
): string {
  return [
    `consequence-pack-decision:${profile.profileId}`,
    `pack:${profile.packFamily}`,
    `decision:${profile.decision}`,
    `posture:${profile.posture}`,
    `action:${profile.recommendedAction}`,
  ].join(' / ');
}

export function consequenceAdmissionPackDecisionProfileDescriptor():
ConsequenceAdmissionPackDecisionProfileDescriptor {
  return Object.freeze({
    version: CONSEQUENCE_ADMISSION_PACK_DECISION_PROFILE_VERSION,
    supportedPackFamilies: ['finance', 'crypto'] as const,
    postures: CONSEQUENCE_ADMISSION_PACK_DECISION_POSTURES,
    recommendedActions: CONSEQUENCE_ADMISSION_PACK_DECISION_RECOMMENDED_ACTIONS,
    signalKinds: CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_KINDS,
    signalSeverities: CONSEQUENCE_ADMISSION_PACK_DECISION_SIGNAL_SEVERITIES,
    modelSafe: true,
    rawPayloadStored: false,
    rawCustomerIdentifiersStored: false,
    rawWalletMetadataStored: false,
    rawPaymentDataStored: false,
    privatePolicyThresholdsStored: false,
  });
}
