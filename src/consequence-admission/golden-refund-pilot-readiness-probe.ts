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
  GOLDEN_REFUND_RUNTIME_SMOKE_VERSION,
  runGoldenRefundRuntimeSmoke,
  type GoldenRefundRuntimeSmokeResult,
} from './golden-refund-runtime-smoke.js';

export const GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION =
  'attestor.golden-refund-pilot-readiness-probe.v1';

export type GoldenRefundPilotReadinessVerdict =
  | 'ready-for-shadow-pilot'
  | 'not-ready';

export interface GoldenRefundPilotReadinessProbeDecision {
  readonly verdict: GoldenRefundPilotReadinessVerdict;
  readonly blockers: readonly string[];
}

export interface GoldenRefundPilotReadinessProbeResult {
  readonly version: typeof GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'G06';
  readonly generatedAt: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_REFUND_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly pilotReadinessPacketDigest: string;
  readonly pilotReadinessPacket: PilotReadinessPacket;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly decision: GoldenRefundPilotReadinessProbeDecision;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly deterministicReplay: true;
  readonly noTargetSystemCall: true;
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
  readonly productionReady: false;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenRefundPilotReadinessProbeDescriptor {
  readonly version: typeof GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'G06';
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_REFUND_RUNTIME_SMOKE_VERSION;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly shadowOnly: true;
  readonly fixtureOnly: true;
  readonly previewOnly: true;
  readonly noTargetSystemCall: true;
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
  readonly productionReady: false;
}

const GENERATED_AT = '2026-05-19T08:30:00.000Z';
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

function runtimeSmokeBlockers(smoke: GoldenRefundRuntimeSmokeResult): readonly string[] {
  const blockers = new Set<string>();
  if (smoke.version !== GOLDEN_REFUND_RUNTIME_SMOKE_VERSION) {
    blockers.add('golden-refund-runtime-smoke-version-mismatch');
  }
  if (smoke.step !== 'G05') blockers.add('golden-refund-runtime-smoke-step-mismatch');
  if (smoke.scenarioCount !== 5 || smoke.scenarioResults.length !== 5) {
    blockers.add('golden-refund-runtime-smoke-scenario-count-invalid');
  }
  if (smoke.allScenariosCompleted !== true) {
    blockers.add('golden-refund-runtime-smoke-incomplete');
  }
  if (smoke.executionMode !== 'shadow-only') {
    blockers.add('golden-refund-runtime-smoke-not-shadow-only');
  }
  if (smoke.fixtureOnly !== true) blockers.add('golden-refund-runtime-smoke-not-fixture-only');
  if (smoke.noTargetSystemCall !== true) {
    blockers.add('golden-refund-runtime-smoke-target-system-call-risk');
  }
  if (smoke.noAuditWrite !== true) blockers.add('golden-refund-runtime-smoke-audit-write-risk');
  if (smoke.noPolicyActivation !== true) {
    blockers.add('golden-refund-runtime-smoke-policy-activation-risk');
  }
  if (smoke.noLearningActivation !== true || smoke.noTrainingActivation !== true) {
    blockers.add('golden-refund-runtime-smoke-learning-activation-risk');
  }
  if (
    smoke.grantsAuthority ||
    smoke.canAdmit ||
    smoke.activatesEnforcement ||
    smoke.autoEnforce ||
    smoke.productionReady
  ) {
    blockers.add('golden-refund-runtime-smoke-authority-overclaim-risk');
  }
  if (smoke.rawPayloadRead || smoke.rawPayloadStored) {
    blockers.add('golden-refund-runtime-smoke-raw-payload-risk');
  }
  return Object.freeze([...blockers].sort());
}

function createReadinessPacket(
  smoke: GoldenRefundRuntimeSmokeResult,
  blockers: readonly string[],
): PilotReadinessPacket {
  return createPilotReadinessPacket({
    generatedAt: GENERATED_AT,
    pilotRefDigest: digestFor('golden-refund-pilot', smoke.digest),
    tenantRefDigest: digestFor('golden-refund-tenant', 'fixture-only-tenant'),
    requesterRefDigest: digestFor('golden-refund-requester', 'fixture-only-requester'),
    targetSystemRefDigest: digestFor('golden-refund-target-system', 'refund-system-shadow'),
    integrationOwnerRefDigest: digestFor(
      'golden-refund-integration-owner',
      'fixture-only-integration-owner',
    ),
    systemOfRecordOwnerRefDigest: digestFor(
      'golden-refund-system-of-record-owner',
      'fixture-only-system-owner',
    ),
    targetRecipeRefs: Object.freeze([
      'golden-path:refund',
      smoke.sourceFixtureSuiteDigest,
      smoke.sourcePolicyFoundryProjectionDigest,
      smoke.digest,
    ]),
    stage: 'shadow-entry',
    rolloutMode: 'shadow-only',
    approvalPathDigest: digestFor('golden-refund-approval-path', smoke.digest),
    reviewerQueueDigest: digestFor('golden-refund-reviewer-queue', smoke.digest),
    rollbackPlanDigest: digestFor('golden-refund-rollback-plan', smoke.digest),
    decisionLogDigest: digestFor('golden-refund-decision-log', smoke.digest),
    runbookDigest: digestFor('golden-refund-runbook', smoke.digest),
    nonClaimsAccepted: blockers.length === 0,
  });
}

export function createGoldenRefundPilotReadinessProbe(
  smoke: GoldenRefundRuntimeSmokeResult = runGoldenRefundRuntimeSmoke(),
): GoldenRefundPilotReadinessProbeResult {
  const smokeBlockers = runtimeSmokeBlockers(smoke);
  const packet = createReadinessPacket(smoke, smokeBlockers);
  const decisionBlockers = Object.freeze([
    ...smokeBlockers,
    ...packet.decision.blockers,
  ]);
  if (packet.decision.verdict === 'ready-for-scoped-pilot') {
    throw new Error('Golden refund pilot readiness probe cannot emit scoped pilot verdicts.');
  }
  const verdict: GoldenRefundPilotReadinessVerdict =
    decisionBlockers.length > 0 ? 'not-ready' : packet.decision.verdict;
  const payload = {
    version: GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION,
    step: 'G06',
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

export function goldenRefundPilotReadinessProbeDescriptor():
GoldenRefundPilotReadinessProbeDescriptor {
  return Object.freeze({
    version: GOLDEN_REFUND_PILOT_READINESS_PROBE_VERSION,
    step: 'G06',
    sourceRuntimeSmokeVersion: GOLDEN_REFUND_RUNTIME_SMOKE_VERSION,
    pilotReadinessPacketVersion: PILOT_READINESS_PACKET_VERSION,
    allowedVerdicts: ALLOWED_VERDICTS,
    scopedPilotVerdictExcluded: true,
    shadowOnly: true,
    fixtureOnly: true,
    previewOnly: true,
    noTargetSystemCall: true,
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
    productionReady: false,
  });
}
