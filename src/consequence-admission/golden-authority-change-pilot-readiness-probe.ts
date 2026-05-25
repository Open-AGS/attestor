import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  createPilotReadinessPacket,
  PILOT_READINESS_PACKET_VERSION,
  type PilotReadinessPacket,
} from './pilot-readiness-packet.js';
import {
  GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION,
  runGoldenAuthorityChangeRuntimeSmoke,
  type GoldenAuthorityChangeRuntimeSmokeResult,
} from './golden-authority-change-runtime-smoke.js';

export const GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION =
  'attestor.golden-authority-change-pilot-readiness-probe.v1';

export type GoldenAuthorityChangePilotReadinessVerdict =
  | 'ready-for-shadow-pilot'
  | 'not-ready';

export interface GoldenAuthorityChangePilotReadinessProbeDecision {
  readonly verdict: GoldenAuthorityChangePilotReadinessVerdict;
  readonly blockers: readonly string[];
}

export interface GoldenAuthorityChangePilotReadinessProbeResult {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'A03';
  readonly generatedAt: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly pilotReadinessPacketDigest: string;
  readonly pilotReadinessPacket: PilotReadinessPacket;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly decision: GoldenAuthorityChangePilotReadinessProbeDecision;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
  readonly noAuditWrite: true;
  readonly noExternalEventBus: true;
  readonly noExternalTraceExport: true;
  readonly noExternalLineageExport: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenAuthorityChangePilotReadinessProbeDescriptor {
  readonly version: typeof GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'A03';
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly noIdentityProviderCall: true;
  readonly noAccessChange: true;
  readonly noAuditWrite: true;
  readonly noPolicyActivation: true;
  readonly noLearningActivation: true;
  readonly noTrainingActivation: true;
  readonly grantsAuthority: false;
  readonly canAdmit: false;
  readonly activatesEnforcement: false;
  readonly autoEnforce: false;
  readonly rawPayloadRead: false;
  readonly rawPayloadStored: false;
  readonly rawIdentityAttributesRead: false;
  readonly rawIdentityAttributesStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-25T11:30:00.000Z';
const ALLOWED_VERDICTS = Object.freeze([
  'ready-for-shadow-pilot',
  'not-ready',
] as const);

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

function digestFor(kind: string, value: CanonicalReleaseJsonValue): string {
  return canonicalObject({ kind, value }).digest;
}

function runtimeSmokeBlockers(
  smoke: GoldenAuthorityChangeRuntimeSmokeResult,
): readonly string[] {
  const blockers = new Set<string>();
  if (smoke.version !== GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION) {
    blockers.add('golden-authority-change-runtime-smoke-version-mismatch');
  }
  if (smoke.step !== 'A03') blockers.add('golden-authority-change-runtime-smoke-step-mismatch');
  if (smoke.scenarioCount !== 8 || smoke.scenarioResults.length !== 8) {
    blockers.add('golden-authority-change-runtime-smoke-scenario-count-invalid');
  }
  if (smoke.allScenariosCompleted !== true) {
    blockers.add('golden-authority-change-runtime-smoke-incomplete');
  }
  if (smoke.executionMode !== 'shadow-only') {
    blockers.add('golden-authority-change-runtime-smoke-not-shadow-only');
  }
  if (smoke.fixtureOnly !== true) blockers.add('golden-authority-change-runtime-smoke-not-fixture-only');
  if (smoke.noTargetSystemCall !== true) {
    blockers.add('golden-authority-change-runtime-smoke-target-system-call-risk');
  }
  if (smoke.noIdentityProviderCall !== true || smoke.noAccessChange !== true) {
    blockers.add('golden-authority-change-runtime-smoke-identity-provider-call-risk');
  }
  if (smoke.noAuditWrite !== true) blockers.add('golden-authority-change-runtime-smoke-audit-write-risk');
  if (smoke.noPolicyActivation !== true) {
    blockers.add('golden-authority-change-runtime-smoke-policy-activation-risk');
  }
  if (smoke.noLearningActivation !== true || smoke.noTrainingActivation !== true) {
    blockers.add('golden-authority-change-runtime-smoke-learning-activation-risk');
  }
  if (
    smoke.grantsAuthority ||
    smoke.canAdmit ||
    smoke.activatesEnforcement ||
    smoke.autoEnforce ||
    smoke.productionReady
  ) {
    blockers.add('golden-authority-change-runtime-smoke-authority-overclaim-risk');
  }
  if (
    smoke.rawPayloadRead ||
    smoke.rawPayloadStored ||
    smoke.rawIdentityAttributesRead ||
    smoke.rawIdentityAttributesStored
  ) {
    blockers.add('golden-authority-change-runtime-smoke-raw-identity-risk');
  }
  return Object.freeze([...blockers].sort());
}

function createReadinessPacket(
  smoke: GoldenAuthorityChangeRuntimeSmokeResult,
  blockers: readonly string[],
): PilotReadinessPacket {
  return createPilotReadinessPacket({
    generatedAt: GENERATED_AT,
    pilotRefDigest: digestFor('golden-authority-change-pilot', smoke.digest),
    tenantRefDigest: digestFor('golden-authority-change-tenant', 'fixture-only-tenant'),
    requesterRefDigest: digestFor('golden-authority-change-requester', 'fixture-only-requester'),
    targetSystemRefDigest: digestFor('golden-authority-change-target-system', 'identity-workflow-shadow'),
    integrationOwnerRefDigest: digestFor(
      'golden-authority-change-integration-owner',
      'fixture-only-integration-owner',
    ),
    systemOfRecordOwnerRefDigest: digestFor(
      'golden-authority-change-system-of-record-owner',
      'fixture-only-system-owner',
    ),
    targetRecipeRefs: Object.freeze([
      'golden-path:authority-change',
      'identity-workflow-gate',
      smoke.sourceFixtureSuiteDigest,
      smoke.sourcePolicyFoundryProjectionDigest,
      smoke.digest,
    ]),
    stage: 'shadow-entry',
    rolloutMode: 'shadow-only',
    approvalPathDigest: digestFor('golden-authority-change-approval-path', smoke.digest),
    reviewerQueueDigest: digestFor('golden-authority-change-reviewer-queue', smoke.digest),
    rollbackPlanDigest: digestFor('golden-authority-change-rollback-plan', smoke.digest),
    decisionLogDigest: digestFor('golden-authority-change-decision-log', smoke.digest),
    runbookDigest: digestFor('golden-authority-change-runbook', smoke.digest),
    nonClaimsAccepted: blockers.length === 0,
  });
}

export function createGoldenAuthorityChangePilotReadinessProbe(
  smoke: GoldenAuthorityChangeRuntimeSmokeResult = runGoldenAuthorityChangeRuntimeSmoke(),
): GoldenAuthorityChangePilotReadinessProbeResult {
  const smokeBlockers = runtimeSmokeBlockers(smoke);
  const packet = createReadinessPacket(smoke, smokeBlockers);
  const decisionBlockers = Object.freeze([
    ...smokeBlockers,
    ...packet.decision.blockers,
  ]);
  if (packet.decision.verdict === 'ready-for-scoped-pilot') {
    throw new Error('Golden authority change pilot readiness probe cannot emit scoped pilot verdicts.');
  }
  const verdict: GoldenAuthorityChangePilotReadinessVerdict =
    decisionBlockers.length > 0 ? 'not-ready' : packet.decision.verdict;
  const payload = {
    version: GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION,
    step: 'A03',
    generatedAt: GENERATED_AT,
    sourceRuntimeSmokeVersion: smoke.version,
    sourceRuntimeSmokeDigest: smoke.digest,
    pilotReadinessPacketVersion: packet.version,
    pilotReadinessPacketDigest: packet.digest,
    allowedVerdicts: ALLOWED_VERDICTS,
    scopedPilotVerdictExcluded: true,
    decision: {
      verdict,
      blockers: decisionBlockers,
    },
    shadowOnly: true,
    fixtureOnly: true,
    previewOnly: true,
    deterministicReplay: true,
    noTargetSystemCall: true,
    noIdentityProviderCall: true,
    noAccessChange: true,
    noAuditWrite: true,
    noExternalEventBus: true,
    noExternalTraceExport: true,
    noExternalLineageExport: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawIdentityAttributesRead: false,
    rawIdentityAttributesStored: false,
    productionReady: false,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    pilotReadinessPacket: packet,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function goldenAuthorityChangePilotReadinessProbeDescriptor():
  GoldenAuthorityChangePilotReadinessProbeDescriptor {
  return Object.freeze({
    version: GOLDEN_AUTHORITY_CHANGE_PILOT_READINESS_PROBE_VERSION,
    step: 'A03',
    sourceRuntimeSmokeVersion: GOLDEN_AUTHORITY_CHANGE_RUNTIME_SMOKE_VERSION,
    pilotReadinessPacketVersion: PILOT_READINESS_PACKET_VERSION,
    allowedVerdicts: ALLOWED_VERDICTS,
    scopedPilotVerdictExcluded: true,
    shadowOnly: true,
    fixtureOnly: true,
    previewOnly: true,
    noTargetSystemCall: true,
    noIdentityProviderCall: true,
    noAccessChange: true,
    noAuditWrite: true,
    noPolicyActivation: true,
    noLearningActivation: true,
    noTrainingActivation: true,
    grantsAuthority: false,
    canAdmit: false,
    activatesEnforcement: false,
    autoEnforce: false,
    rawPayloadRead: false,
    rawPayloadStored: false,
    rawIdentityAttributesRead: false,
    rawIdentityAttributesStored: false,
    productionReady: false,
  });
}
