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
  GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION,
  runGoldenProgrammableMoneyRuntimeSmoke,
  type GoldenProgrammableMoneyRuntimeSmokeResult,
} from './golden-programmable-money-runtime-smoke.js';

export const GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION =
  'attestor.golden-programmable-money-pilot-readiness-probe.v1';

export type GoldenProgrammableMoneyPilotReadinessVerdict =
  | 'ready-for-shadow-pilot'
  | 'not-ready';

export interface GoldenProgrammableMoneyPilotReadinessProbeDecision {
  readonly verdict: GoldenProgrammableMoneyPilotReadinessVerdict;
  readonly blockers: readonly string[];
}

export interface GoldenProgrammableMoneyPilotReadinessProbeResult {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'P03';
  readonly generatedAt: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly pilotReadinessPacketDigest: string;
  readonly pilotReadinessPacket: PilotReadinessPacket;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly decision: GoldenProgrammableMoneyPilotReadinessProbeDecision;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noProviderCall: true;
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
  readonly rawTransactionPayloadRead: false;
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialRead: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenProgrammableMoneyPilotReadinessProbeDescriptor {
  readonly version: typeof GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'P03';
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
  readonly noWalletCall: true;
  readonly noSigning: true;
  readonly noBroadcast: true;
  readonly noCustodyCallback: true;
  readonly noBundlerCall: true;
  readonly noFacilitatorCall: true;
  readonly noSolverCall: true;
  readonly noProviderCall: true;
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
  readonly rawTransactionPayloadRead: false;
  readonly rawTransactionPayloadStored: false;
  readonly rawWalletMaterialRead: false;
  readonly rawWalletMaterialStored: false;
  readonly rawCustomerIdentifiersRead: false;
  readonly rawCustomerIdentifiersStored: false;
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-26T15:30:00.000Z';
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
  smoke: GoldenProgrammableMoneyRuntimeSmokeResult,
): readonly string[] {
  const blockers = new Set<string>();
  if (smoke.version !== GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION) {
    blockers.add('golden-programmable-money-runtime-smoke-version-mismatch');
  }
  if (smoke.step !== 'P03') blockers.add('golden-programmable-money-runtime-smoke-step-mismatch');
  if (smoke.scenarioCount !== 8 || smoke.scenarioResults.length !== 8) {
    blockers.add('golden-programmable-money-runtime-smoke-scenario-count-invalid');
  }
  if (smoke.allScenariosCompleted !== true) {
    blockers.add('golden-programmable-money-runtime-smoke-incomplete');
  }
  if (smoke.executionMode !== 'shadow-only') {
    blockers.add('golden-programmable-money-runtime-smoke-not-shadow-only');
  }
  if (smoke.fixtureOnly !== true) {
    blockers.add('golden-programmable-money-runtime-smoke-not-fixture-only');
  }
  if (smoke.noTargetSystemCall !== true || smoke.noWalletCall !== true) {
    blockers.add('golden-programmable-money-runtime-smoke-target-system-call-risk');
  }
  if (
    smoke.noSigning !== true ||
    smoke.noBroadcast !== true ||
    smoke.noCustodyCallback !== true ||
    smoke.noBundlerCall !== true ||
    smoke.noFacilitatorCall !== true ||
    smoke.noSolverCall !== true ||
    smoke.noProviderCall !== true
  ) {
    blockers.add('golden-programmable-money-runtime-smoke-adapter-side-effect-risk');
  }
  if (smoke.noAuditWrite !== true) {
    blockers.add('golden-programmable-money-runtime-smoke-audit-write-risk');
  }
  if (smoke.noPolicyActivation !== true) {
    blockers.add('golden-programmable-money-runtime-smoke-policy-activation-risk');
  }
  if (smoke.noLearningActivation !== true || smoke.noTrainingActivation !== true) {
    blockers.add('golden-programmable-money-runtime-smoke-learning-activation-risk');
  }
  if (
    smoke.grantsAuthority ||
    smoke.canAdmit ||
    smoke.activatesEnforcement ||
    smoke.autoEnforce ||
    smoke.productionReady
  ) {
    blockers.add('golden-programmable-money-runtime-smoke-authority-overclaim-risk');
  }
  if (
    smoke.rawPayloadRead ||
    smoke.rawPayloadStored ||
    smoke.rawTransactionPayloadRead ||
    smoke.rawTransactionPayloadStored ||
    smoke.rawWalletMaterialRead ||
    smoke.rawWalletMaterialStored ||
    smoke.rawCustomerIdentifiersRead ||
    smoke.rawCustomerIdentifiersStored
  ) {
    blockers.add('golden-programmable-money-runtime-smoke-raw-crypto-material-risk');
  }
  return Object.freeze([...blockers].sort());
}

function createReadinessPacket(
  smoke: GoldenProgrammableMoneyRuntimeSmokeResult,
  blockers: readonly string[],
): PilotReadinessPacket {
  return createPilotReadinessPacket({
    generatedAt: GENERATED_AT,
    pilotRefDigest: digestFor('golden-programmable-money-pilot', smoke.digest),
    tenantRefDigest: digestFor('golden-programmable-money-tenant', 'fixture-only-tenant'),
    requesterRefDigest: digestFor(
      'golden-programmable-money-requester',
      'fixture-only-requester',
    ),
    targetSystemRefDigest: digestFor(
      'golden-programmable-money-target-system',
      'programmable-money-shadow',
    ),
    integrationOwnerRefDigest: digestFor(
      'golden-programmable-money-integration-owner',
      'fixture-only-integration-owner',
    ),
    systemOfRecordOwnerRefDigest: digestFor(
      'golden-programmable-money-system-of-record-owner',
      'fixture-only-system-owner',
    ),
    targetRecipeRefs: Object.freeze([
      'golden-path:programmable-money',
      'programmable-money-shadow',
      smoke.sourceFixtureSuiteDigest,
      smoke.sourcePolicyFoundryProjectionDigest,
      smoke.digest,
    ]),
    stage: 'shadow-entry',
    rolloutMode: 'shadow-only',
    approvalPathDigest: digestFor('golden-programmable-money-approval-path', smoke.digest),
    reviewerQueueDigest: digestFor('golden-programmable-money-reviewer-queue', smoke.digest),
    rollbackPlanDigest: digestFor('golden-programmable-money-rollback-plan', smoke.digest),
    decisionLogDigest: digestFor('golden-programmable-money-decision-log', smoke.digest),
    runbookDigest: digestFor('golden-programmable-money-runbook', smoke.digest),
    nonClaimsAccepted: blockers.length === 0,
  });
}

export function createGoldenProgrammableMoneyPilotReadinessProbe(
  smoke: GoldenProgrammableMoneyRuntimeSmokeResult =
    runGoldenProgrammableMoneyRuntimeSmoke(),
): GoldenProgrammableMoneyPilotReadinessProbeResult {
  const smokeBlockers = runtimeSmokeBlockers(smoke);
  const packet = createReadinessPacket(smoke, smokeBlockers);
  const decisionBlockers = Object.freeze([
    ...smokeBlockers,
    ...packet.decision.blockers,
  ]);
  if (packet.decision.verdict === 'ready-for-scoped-pilot') {
    throw new Error(
      'Golden programmable money pilot readiness probe cannot emit scoped pilot verdicts.',
    );
  }
  const verdict: GoldenProgrammableMoneyPilotReadinessVerdict =
    decisionBlockers.length > 0 ? 'not-ready' : packet.decision.verdict;
  const payload = {
    version: GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION,
    step: 'P03',
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
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noProviderCall: true,
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
    rawTransactionPayloadRead: false,
    rawTransactionPayloadStored: false,
    rawWalletMaterialRead: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
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

export function goldenProgrammableMoneyPilotReadinessProbeDescriptor():
  GoldenProgrammableMoneyPilotReadinessProbeDescriptor {
  return Object.freeze({
    version: GOLDEN_PROGRAMMABLE_MONEY_PILOT_READINESS_PROBE_VERSION,
    step: 'P03',
    sourceRuntimeSmokeVersion: GOLDEN_PROGRAMMABLE_MONEY_RUNTIME_SMOKE_VERSION,
    pilotReadinessPacketVersion: PILOT_READINESS_PACKET_VERSION,
    allowedVerdicts: ALLOWED_VERDICTS,
    scopedPilotVerdictExcluded: true,
    shadowOnly: true,
    fixtureOnly: true,
    previewOnly: true,
    noTargetSystemCall: true,
    noWalletCall: true,
    noSigning: true,
    noBroadcast: true,
    noCustodyCallback: true,
    noBundlerCall: true,
    noFacilitatorCall: true,
    noSolverCall: true,
    noProviderCall: true,
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
    rawTransactionPayloadRead: false,
    rawTransactionPayloadStored: false,
    rawWalletMaterialRead: false,
    rawWalletMaterialStored: false,
    rawCustomerIdentifiersRead: false,
    rawCustomerIdentifiersStored: false,
    productionReady: false,
  });
}
