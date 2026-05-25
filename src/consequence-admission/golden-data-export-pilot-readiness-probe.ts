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
  GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION,
  runGoldenDataExportRuntimeSmoke,
  type GoldenDataExportRuntimeSmokeResult,
} from './golden-data-export-runtime-smoke.js';

export const GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION =
  'attestor.golden-data-export-pilot-readiness-probe.v1';

export type GoldenDataExportPilotReadinessVerdict =
  | 'ready-for-shadow-pilot'
  | 'not-ready';

export interface GoldenDataExportPilotReadinessProbeDecision {
  readonly verdict: GoldenDataExportPilotReadinessVerdict;
  readonly blockers: readonly string[];
}

export interface GoldenDataExportPilotReadinessProbeResult {
  readonly version: typeof GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'D03';
  readonly generatedAt: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly pilotReadinessPacketVersion: typeof PILOT_READINESS_PACKET_VERSION;
  readonly pilotReadinessPacketDigest: string;
  readonly pilotReadinessPacket: PilotReadinessPacket;
  readonly allowedVerdicts: readonly ['ready-for-shadow-pilot', 'not-ready'];
  readonly scopedPilotVerdictExcluded: true;
  readonly decision: GoldenDataExportPilotReadinessProbeDecision;
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

export interface GoldenDataExportPilotReadinessProbeDescriptor {
  readonly version: typeof GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION;
  readonly step: 'D03';
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION;
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

const GENERATED_AT = '2026-05-25T10:45:00.000Z';
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
  smoke: GoldenDataExportRuntimeSmokeResult,
): readonly string[] {
  const blockers = new Set<string>();
  if (smoke.version !== GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION) {
    blockers.add('golden-data-export-runtime-smoke-version-mismatch');
  }
  if (smoke.step !== 'D03') blockers.add('golden-data-export-runtime-smoke-step-mismatch');
  if (smoke.scenarioCount !== 8 || smoke.scenarioResults.length !== 8) {
    blockers.add('golden-data-export-runtime-smoke-scenario-count-invalid');
  }
  if (smoke.allScenariosCompleted !== true) {
    blockers.add('golden-data-export-runtime-smoke-incomplete');
  }
  if (smoke.executionMode !== 'shadow-only') {
    blockers.add('golden-data-export-runtime-smoke-not-shadow-only');
  }
  if (smoke.fixtureOnly !== true) blockers.add('golden-data-export-runtime-smoke-not-fixture-only');
  if (smoke.noTargetSystemCall !== true) {
    blockers.add('golden-data-export-runtime-smoke-target-system-call-risk');
  }
  if (smoke.noAuditWrite !== true) blockers.add('golden-data-export-runtime-smoke-audit-write-risk');
  if (smoke.noPolicyActivation !== true) {
    blockers.add('golden-data-export-runtime-smoke-policy-activation-risk');
  }
  if (smoke.noLearningActivation !== true || smoke.noTrainingActivation !== true) {
    blockers.add('golden-data-export-runtime-smoke-learning-activation-risk');
  }
  if (
    smoke.grantsAuthority ||
    smoke.canAdmit ||
    smoke.activatesEnforcement ||
    smoke.autoEnforce ||
    smoke.productionReady
  ) {
    blockers.add('golden-data-export-runtime-smoke-authority-overclaim-risk');
  }
  if (smoke.rawPayloadRead || smoke.rawPayloadStored) {
    blockers.add('golden-data-export-runtime-smoke-raw-payload-risk');
  }
  return Object.freeze([...blockers].sort());
}

function createReadinessPacket(
  smoke: GoldenDataExportRuntimeSmokeResult,
  blockers: readonly string[],
): PilotReadinessPacket {
  return createPilotReadinessPacket({
    generatedAt: GENERATED_AT,
    pilotRefDigest: digestFor('golden-data-export-pilot', smoke.digest),
    tenantRefDigest: digestFor('golden-data-export-tenant', 'fixture-only-tenant'),
    requesterRefDigest: digestFor('golden-data-export-requester', 'fixture-only-requester'),
    targetSystemRefDigest: digestFor('golden-data-export-target-system', 'warehouse-shadow'),
    integrationOwnerRefDigest: digestFor(
      'golden-data-export-integration-owner',
      'fixture-only-integration-owner',
    ),
    systemOfRecordOwnerRefDigest: digestFor(
      'golden-data-export-system-of-record-owner',
      'fixture-only-system-owner',
    ),
    targetRecipeRefs: Object.freeze([
      'golden-path:controlled-data-export',
      smoke.sourceFixtureSuiteDigest,
      smoke.sourcePolicyFoundryProjectionDigest,
      smoke.digest,
    ]),
    stage: 'shadow-entry',
    rolloutMode: 'shadow-only',
    approvalPathDigest: digestFor('golden-data-export-approval-path', smoke.digest),
    reviewerQueueDigest: digestFor('golden-data-export-reviewer-queue', smoke.digest),
    rollbackPlanDigest: digestFor('golden-data-export-rollback-plan', smoke.digest),
    decisionLogDigest: digestFor('golden-data-export-decision-log', smoke.digest),
    runbookDigest: digestFor('golden-data-export-runbook', smoke.digest),
    nonClaimsAccepted: blockers.length === 0,
  });
}

export function createGoldenDataExportPilotReadinessProbe(
  smoke: GoldenDataExportRuntimeSmokeResult = runGoldenDataExportRuntimeSmoke(),
): GoldenDataExportPilotReadinessProbeResult {
  const smokeBlockers = runtimeSmokeBlockers(smoke);
  const packet = createReadinessPacket(smoke, smokeBlockers);
  const decisionBlockers = Object.freeze([
    ...smokeBlockers,
    ...packet.decision.blockers,
  ]);
  if (packet.decision.verdict === 'ready-for-scoped-pilot') {
    throw new Error('Golden data export pilot readiness probe cannot emit scoped pilot verdicts.');
  }
  const verdict: GoldenDataExportPilotReadinessVerdict =
    decisionBlockers.length > 0 ? 'not-ready' : packet.decision.verdict;
  const payload = {
    version: GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION,
    step: 'D03',
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

export function goldenDataExportPilotReadinessProbeDescriptor():
  GoldenDataExportPilotReadinessProbeDescriptor {
  return Object.freeze({
    version: GOLDEN_DATA_EXPORT_PILOT_READINESS_PROBE_VERSION,
    step: 'D03',
    sourceRuntimeSmokeVersion: GOLDEN_DATA_EXPORT_RUNTIME_SMOKE_VERSION,
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
