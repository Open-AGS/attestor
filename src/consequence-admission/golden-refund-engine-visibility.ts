import { createHash } from 'node:crypto';
import {
  canonicalizeReleaseJson,
  type CanonicalReleaseJsonValue,
} from '../release-kernel/release-canonicalization.js';
import {
  evaluateConflictAbstentionGate,
} from './conflict-abstention-gate.js';
import {
  GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION,
  createGoldenRefundPolicyFoundryProjection,
  type GoldenRefundPolicyFoundryProjection,
} from './golden-refund-policy-foundry-projection.js';
import {
  GOLDEN_REFUND_RUNTIME_SMOKE_VERSION,
  runGoldenRefundRuntimeSmoke,
  type GoldenRefundRuntimeSmokeResult,
} from './golden-refund-runtime-smoke.js';
import {
  GOLDEN_REFUND_SHADOW_FIXTURES_VERSION,
  createGoldenRefundShadowFixtureSuite,
  type GoldenRefundShadowFixture,
  type GoldenRefundShadowFixtureSuite,
} from './golden-refund-shadow-fixtures.js';
import {
  fuseRelationshipAwareMonotoneHazard,
} from './relationship-aware-monotone-fusion.js';

export const GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION =
  'attestor.golden-refund-engine-visibility.v1';

export const GOLDEN_REFUND_ENGINE_VISIBILITY_SOURCE_ANCHORS = [
  'terraform-plan-preview-without-apply',
  'kubernetes-dry-run-no-persistence',
  'opentelemetry-trace-span-attributes',
  'stripe-idempotency-replay-discipline',
  'reproducible-builds-deterministic-artifact',
  'slsa-provenance-verifiable-artifact',
] as const;
export type GoldenRefundEngineVisibilitySourceAnchor =
  typeof GOLDEN_REFUND_ENGINE_VISIBILITY_SOURCE_ANCHORS[number];

export const GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER = [
  'shadow-envelope-projector',
  'signal-extractor',
  'relationship-detector',
  'relationship-aware-monotone-fusion',
  'conflict-abstention-gate',
  'human-comprehension-gate',
  'signed-assurance-packet',
] as const;
export type GoldenRefundEngineVisibilityGate =
  typeof GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER[number];

export const GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_COVERS = [
  'scenario',
  'expected-posture',
  'shadow-decision',
  'effective-decision',
  'packet-decision',
  'fusion-posture-and-scores',
  'fusion-reason-codes',
  'conflict-gate-outcome-and-scores',
  'conflict-gate-reason-codes',
  'human-comprehension-status-and-counts',
  'safety-boundary-flags',
] as const;

export const GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_EXCLUDES = [
  'timestamps',
  'latencies',
  'run-identifiers',
  'raw-payloads',
  'raw-customer-identifiers',
  'raw-payment-identifiers',
] as const;

export interface GoldenRefundEngineVisibilityMetrics {
  readonly signalCount: number;
  readonly relationshipCount: number;
  readonly opinionCount: number;
  readonly modulatorCount: number;
  readonly reasonLineCount: number;
  readonly activeQuestionCount: number;
  readonly evidenceCompletenessPercent: number;
  readonly fusedHazardScore: number;
  readonly conflictScore: number;
  readonly abstentionScore: number;
  readonly uncertaintyScore: number;
  readonly coverageGapScore: number;
  readonly reviewPressure: number;
  readonly blockPressure: number;
}

export interface GoldenRefundEngineVisibilitySafetyBoundary {
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

export interface GoldenRefundEngineVisibilityScenarioRow {
  readonly scenario: GoldenRefundShadowFixture['scenario'];
  readonly fixtureId: string;
  readonly fixtureDigest: string;
  readonly expectedPosture: GoldenRefundShadowFixture['expectedPosture'];
  readonly shadowDecision: GoldenRefundShadowFixture['event']['decision']['shadowDecision'];
  readonly effectiveDecision: GoldenRefundShadowFixture['event']['decision']['effectiveDecision'];
  readonly packetDecision: 'admit' | 'narrow' | 'review' | 'block';
  readonly gateOrder: readonly GoldenRefundEngineVisibilityGate[];
  readonly fusionPosture: string;
  readonly conflictOutcome: string;
  readonly humanStatus: string;
  readonly reasonCodes: readonly string[];
  readonly metrics: GoldenRefundEngineVisibilityMetrics;
  readonly safetyBoundary: GoldenRefundEngineVisibilitySafetyBoundary;
  readonly noClaims: readonly string[];
  readonly decisionRelevantDigest: string;
}

export interface GoldenRefundEngineVisibilityDeterminismCheck {
  readonly version: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION;
  readonly iterations: number;
  readonly identicalInputRuns: number;
  readonly identicalInputUniqueDigests: number;
  readonly shuffledInputRuns: number;
  readonly shuffledInputUniqueDigests: number;
  readonly stable: boolean;
  readonly digestCovers: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_COVERS;
  readonly digestExcludes: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_EXCLUDES;
  readonly canonical: string;
  readonly digest: string;
}

export interface GoldenRefundEngineVisibilityReport {
  readonly version: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION;
  readonly step: 'G08';
  readonly generatedAt: string;
  readonly sourceFixtureSuiteVersion: typeof GOLDEN_REFUND_SHADOW_FIXTURES_VERSION;
  readonly sourceFixtureSuiteDigest: string;
  readonly sourcePolicyFoundryProjectionVersion:
    typeof GOLDEN_REFUND_POLICY_FOUNDRY_PROJECTION_VERSION;
  readonly sourcePolicyFoundryProjectionDigest: string;
  readonly sourceRuntimeSmokeVersion: typeof GOLDEN_REFUND_RUNTIME_SMOKE_VERSION;
  readonly sourceRuntimeSmokeDigest: string;
  readonly sourceAnchors: readonly GoldenRefundEngineVisibilitySourceAnchor[];
  readonly gateOrder: readonly GoldenRefundEngineVisibilityGate[];
  readonly scenarioCount: 8;
  readonly scenarios: readonly GoldenRefundEngineVisibilityScenarioRow[];
  readonly determinism: GoldenRefundEngineVisibilityDeterminismCheck;
  readonly digestCovers: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_COVERS;
  readonly digestExcludes: typeof GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_EXCLUDES;
  readonly markdownFirst: true;
  readonly jsonSecondary: true;
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
  readonly canonical: string;
  readonly digest: string;
}

const GENERATED_AT = '2026-05-19T09:30:00.000Z';

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

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function fixedScore(value: number): number {
  return Number(value.toFixed(6));
}

function completenessPercent(coverageGapScore: number): number {
  return Math.max(0, Math.min(100, Math.round((1 - coverageGapScore) * 100)));
}

function scenarioDigestMaterial(row: Omit<
  GoldenRefundEngineVisibilityScenarioRow,
  'decisionRelevantDigest'
>): CanonicalReleaseJsonValue {
  return {
    scenario: row.scenario,
    expectedPosture: row.expectedPosture,
    shadowDecision: row.shadowDecision,
    effectiveDecision: row.effectiveDecision,
    packetDecision: row.packetDecision,
    fusionPosture: row.fusionPosture,
    conflictOutcome: row.conflictOutcome,
    humanStatus: row.humanStatus,
    reasonCodes: row.reasonCodes,
    metrics: row.metrics,
    safetyBoundary: row.safetyBoundary,
    noClaims: row.noClaims,
  } as unknown as CanonicalReleaseJsonValue;
}

function safetyBoundary(): GoldenRefundEngineVisibilitySafetyBoundary {
  return Object.freeze({
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

function noClaims(): readonly string[] {
  return Object.freeze([
    'not-live-refund-execution',
    'not-target-system-call',
    'not-audit-plane-write',
    'not-policy-activation',
    'not-learning-or-training',
    'not-admission-authority',
    'not-production-ready',
  ]);
}

function rowFor(input: {
  readonly fixture: GoldenRefundShadowFixture;
  readonly smoke: GoldenRefundRuntimeSmokeResult['smokeResults'][number];
}): GoldenRefundEngineVisibilityScenarioRow {
  const pipeline = input.smoke.activation.pipeline;
  const reasonCodes = sortedUnique([
    ...input.fixture.reasonCodes,
    ...pipeline.fusion.reasonCodes,
    ...pipeline.conflictGate.reasonCodes,
    ...pipeline.humanComprehensionGate.reasonCodes,
    ...pipeline.assurancePacket.decisionBinding.reasonCodes,
  ]);
  const metrics = Object.freeze({
    signalCount: pipeline.counts.signalCount,
    relationshipCount: pipeline.counts.relationshipCount,
    opinionCount: pipeline.counts.opinionCount,
    modulatorCount: pipeline.counts.modulatorCount,
    reasonLineCount: pipeline.counts.reasonLineCount,
    activeQuestionCount: pipeline.counts.activeQuestionCount,
    evidenceCompletenessPercent: completenessPercent(
      pipeline.conflictGate.coverageGapScore,
    ),
    fusedHazardScore: fixedScore(pipeline.fusion.fusedHazardScore),
    conflictScore: fixedScore(pipeline.conflictGate.conflictScore),
    abstentionScore: fixedScore(pipeline.conflictGate.abstentionScore),
    uncertaintyScore: fixedScore(pipeline.conflictGate.uncertaintyScore),
    coverageGapScore: fixedScore(pipeline.conflictGate.coverageGapScore),
    reviewPressure: fixedScore(pipeline.conflictGate.reviewPressure),
    blockPressure: fixedScore(pipeline.conflictGate.blockPressure),
  } satisfies GoldenRefundEngineVisibilityMetrics);
  const material = Object.freeze({
    scenario: input.fixture.scenario,
    fixtureId: input.fixture.fixtureId,
    fixtureDigest: input.fixture.digest,
    expectedPosture: input.fixture.expectedPosture,
    shadowDecision: input.fixture.event.decision.shadowDecision,
    effectiveDecision: input.fixture.event.decision.effectiveDecision,
    packetDecision: pipeline.assurancePacket.decisionBinding.decision,
    gateOrder: GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER,
    fusionPosture: pipeline.fusion.posture,
    conflictOutcome: pipeline.conflictGate.outcome,
    humanStatus: pipeline.humanComprehensionGate.status,
    reasonCodes,
    metrics,
    safetyBoundary: safetyBoundary(),
    noClaims: noClaims(),
  });
  return Object.freeze({
    ...material,
    decisionRelevantDigest: digestFor(
      'golden-refund-engine-visibility.scenario-decision',
      scenarioDigestMaterial(material),
    ),
  });
}

function rotate<T>(values: readonly T[], offset: number): readonly T[] {
  if (values.length === 0) return Object.freeze([]);
  const normalized = offset % values.length;
  return Object.freeze([
    ...values.slice(normalized),
    ...values.slice(0, normalized),
  ]);
}

function shuffledDigestForSmoke(
  smoke: GoldenRefundRuntimeSmokeResult['smokeResults'][number],
  offset: number,
): string {
  const pipeline = smoke.activation.pipeline;
  const opinions = rotate(pipeline.opinions, offset);
  const relationships = rotate(pipeline.relationshipDetection.relationships, offset + 1);
  const modulators = rotate(pipeline.modulators, offset + 2);
  const fusion = fuseRelationshipAwareMonotoneHazard({
    envelopeRefDigest: pipeline.projection.envelopeRefDigest,
    opinions,
    relationships,
    modulators,
  });
  const conflictGate = evaluateConflictAbstentionGate({
    envelopeRefDigest: pipeline.projection.envelopeRefDigest,
    fusion,
    opinions,
    relationships,
    modulators,
  });
  return digestFor('golden-refund-engine-visibility.shuffled-order', {
    scenario: smoke.fixtureId,
    fusionPosture: fusion.posture,
    fusedHazardScore: fixedScore(fusion.fusedHazardScore),
    maxInputHazardScore: fixedScore(fusion.maxInputHazardScore),
    conflictPressure: fixedScore(fusion.conflictPressure),
    reviewPressure: fixedScore(fusion.reviewPressure),
    blockPressure: fixedScore(fusion.blockPressure),
    fusionReasonCodes: sortedUnique(fusion.reasonCodes),
    conflictOutcome: conflictGate.outcome,
    conflictScore: fixedScore(conflictGate.conflictScore),
    abstentionScore: fixedScore(conflictGate.abstentionScore),
    uncertaintyScore: fixedScore(conflictGate.uncertaintyScore),
    coverageGapScore: fixedScore(conflictGate.coverageGapScore),
    conflictReasonCodes: sortedUnique(conflictGate.reasonCodes),
    noLoosening: conflictGate.noLoosening,
    failClosedOnUncertainty: conflictGate.failClosedOnUncertainty,
  });
}

export function runGoldenRefundEngineVisibilityDeterminismCheck(
  iterations = 1000,
): GoldenRefundEngineVisibilityDeterminismCheck {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000) {
    throw new Error('Golden refund engine visibility determinism iterations must be 1..10000.');
  }
  const identicalDigests = new Set<string>();
  let baseSmoke: GoldenRefundRuntimeSmokeResult | null = null;
  for (let index = 0; index < iterations; index += 1) {
    const suite = createGoldenRefundShadowFixtureSuite();
    const projection = createGoldenRefundPolicyFoundryProjection(suite);
    const smoke = runGoldenRefundRuntimeSmoke(suite, projection);
    baseSmoke = smoke;
    const scenarioDigests = suite.fixtures.map((fixture, fixtureIndex) => {
      const smokeResult = smoke.smokeResults[fixtureIndex];
      if (!smokeResult) {
        throw new Error('Golden refund determinism check requires one smoke result per fixture.');
      }
      return rowFor({ fixture, smoke: smokeResult }).decisionRelevantDigest;
    });
    identicalDigests.add(digestFor('golden-refund-engine-visibility.identical-input', {
      scenarioDigests,
    }));
  }
  const shuffledDigests = new Set<string>();
  const smoke = baseSmoke ?? runGoldenRefundRuntimeSmoke();
  for (let index = 0; index < iterations; index += 1) {
    shuffledDigests.add(digestFor('golden-refund-engine-visibility.shuffled-suite', {
      scenarioDigests: smoke.smokeResults.map((item) =>
        shuffledDigestForSmoke(item, index)
      ),
    }));
  }
  const payload = {
    version: GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION,
    iterations,
    identicalInputRuns: iterations,
    identicalInputUniqueDigests: identicalDigests.size,
    shuffledInputRuns: iterations,
    shuffledInputUniqueDigests: shuffledDigests.size,
    stable: identicalDigests.size === 1 && shuffledDigests.size === 1,
    digestCovers: GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_COVERS,
    digestExcludes: GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_EXCLUDES,
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

export function createGoldenRefundEngineVisibilityReport(input?: {
  readonly suite?: GoldenRefundShadowFixtureSuite | null;
  readonly projection?: GoldenRefundPolicyFoundryProjection | null;
  readonly smoke?: GoldenRefundRuntimeSmokeResult | null;
  readonly determinismIterations?: number | null;
}): GoldenRefundEngineVisibilityReport {
  const suite = input?.suite ?? createGoldenRefundShadowFixtureSuite();
  const projection = input?.projection ?? createGoldenRefundPolicyFoundryProjection(suite);
  const smoke = input?.smoke ?? runGoldenRefundRuntimeSmoke(suite, projection);
  const scenarios = Object.freeze(suite.fixtures.map((fixture, index) => {
    const smokeResult = smoke.smokeResults[index];
    if (!smokeResult) {
      throw new Error('Golden refund engine visibility requires one smoke result per fixture.');
    }
    return rowFor({ fixture, smoke: smokeResult });
  }));
  const determinism = runGoldenRefundEngineVisibilityDeterminismCheck(
    input?.determinismIterations ?? 10,
  );
  const payload = {
    version: GOLDEN_REFUND_ENGINE_VISIBILITY_VERSION,
    step: 'G08',
    generatedAt: GENERATED_AT,
    sourceFixtureSuiteVersion: suite.version,
    sourceFixtureSuiteDigest: suite.digest,
    sourcePolicyFoundryProjectionVersion: projection.version,
    sourcePolicyFoundryProjectionDigest: projection.digest,
    sourceRuntimeSmokeVersion: smoke.version,
    sourceRuntimeSmokeDigest: smoke.digest,
    sourceAnchors: GOLDEN_REFUND_ENGINE_VISIBILITY_SOURCE_ANCHORS,
    gateOrder: GOLDEN_REFUND_ENGINE_VISIBILITY_GATE_ORDER,
    scenarioCount: scenarios.length,
    scenarios,
    determinism,
    digestCovers: GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_COVERS,
    digestExcludes: GOLDEN_REFUND_ENGINE_VISIBILITY_DIGEST_EXCLUDES,
    markdownFirst: true,
    jsonSecondary: true,
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
  } as const;
  const canonical = canonicalObject(payload as unknown as CanonicalReleaseJsonValue);
  return Object.freeze({
    ...payload,
    scenarioCount: 8,
    canonical: canonical.canonical,
    digest: canonical.digest,
  });
}

function scenarioTable(
  scenarios: readonly GoldenRefundEngineVisibilityScenarioRow[],
): string {
  const rows = scenarios.map((scenario) =>
    `| ${scenario.scenario} | ${scenario.expectedPosture} | ${scenario.fusionPosture} | ${scenario.conflictOutcome} | ${scenario.humanStatus} | ${scenario.metrics.evidenceCompletenessPercent}% | ${scenario.packetDecision} |`
  );
  return [
    '| Scenario | Expected posture | Fusion | Conflict gate | Human gate | Evidence | Packet |',
    '|---|---|---|---|---|---:|---|',
    ...rows,
  ].join('\n');
}

export function renderGoldenRefundEngineVisibilityMarkdown(
  report: GoldenRefundEngineVisibilityReport = createGoldenRefundEngineVisibilityReport(),
): string {
  return `## Engine Visibility

This section makes the Golden Path: Refund engine path inspectable. It is still
fixture-only, shadow-only, and preview-only.

The packet column is the unsigned shadow assurance packet guard output. It is
not a live refund approval and it cannot admit a downstream action.

${scenarioTable(report.scenarios)}

### Gate Trace

${report.gateOrder.map((gate, index) => `${index + 1}. ${gate}`).join('\n')}

### Determinism

- identical-input runs: ${report.determinism.identicalInputRuns}
- identical-input unique digests: ${report.determinism.identicalInputUniqueDigests}
- shuffled-input runs: ${report.determinism.shuffledInputRuns}
- shuffled-input unique digests: ${report.determinism.shuffledInputUniqueDigests}
- stable: ${report.determinism.stable}
- digest covers: ${report.digestCovers.join(', ')}
- digest excludes: ${report.digestExcludes.join(', ')}

### Safety Boundary

- target-system calls: ${report.noTargetSystemCall ? '0' : 'present'}
- audit writes: ${report.noAuditWrite ? '0' : 'present'}
- policy activation: ${report.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${report.noLearningActivation && report.noTrainingActivation ? '0' : 'present'}
- grants authority: ${report.grantsAuthority}
- can admit: ${report.canAdmit}
- production ready: ${report.productionReady}
`;
}

export function renderGoldenRefundEngineVisibilityJson(
  report: GoldenRefundEngineVisibilityReport = createGoldenRefundEngineVisibilityReport(),
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
