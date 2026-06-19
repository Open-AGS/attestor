import {
  GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS,
  type GenericAdmissionMode,
} from '../../src/consequence-admission/index.js';
import {
  effectiveDecisionForGenericAdmissionMode,
  reduceGenericAdmissionShadowDecision,
} from '../../src/consequence-admission/generic-hard-invariants.js';
import {
  GENERIC_ADMISSION_MODES,
  assert,
  baseMoneyAdmission,
  createGenericAdmissionEnvelope,
  markPassed,
} from './helpers.js';

function booleansFromMask(mask: number, width: number): readonly boolean[] {
  return Object.freeze(Array.from({ length: width }, (_, index) => (mask & (1 << index)) !== 0));
}

function expectedShadowDecision(input: {
  readonly blocks: readonly boolean[];
  readonly reviewReasons: readonly string[];
  readonly narrows: readonly boolean[];
}) {
  if (input.blocks.some(Boolean)) return 'would_block';
  if (input.reviewReasons.length > 0) return 'would_review';
  if (input.narrows.some(Boolean)) return 'would_narrow';
  return 'would_admit';
}

function expectedEffectiveDecision(
  mode: GenericAdmissionMode,
  shadowDecision: ReturnType<typeof expectedShadowDecision>,
) {
  if (mode === 'observe' || mode === 'warn') return 'admit';
  if (mode === 'review') return shadowDecision === 'would_admit' ? 'admit' : 'review';
  if (shadowDecision === 'would_block') return 'block';
  if (shadowDecision === 'would_review') return 'review';
  if (shadowDecision === 'would_narrow') return 'narrow';
  return 'admit';
}

export function runCombinatorialInvariantTests(): void {
  const blockingWidth = GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS.length;
  const narrowingWidth = 2;
  for (let blockMask = 0; blockMask < 1 << blockingWidth; blockMask += 1) {
    const blocks = booleansFromMask(blockMask, blockingWidth);
    for (let narrowMask = 0; narrowMask < 1 << narrowingWidth; narrowMask += 1) {
      const narrows = booleansFromMask(narrowMask, narrowingWidth);
      for (const reviewReasons of [[], ['review-required']] as const) {
        const shadowDecision = reduceGenericAdmissionShadowDecision({
          blockingGuardOutcomes: blocks,
          narrowingGuardOutcomes: narrows,
          reviewReasons,
        });
        const expectedShadow = expectedShadowDecision({ blocks, narrows, reviewReasons });
        assert.equal(shadowDecision, expectedShadow);
        for (const mode of GENERIC_ADMISSION_MODES) {
          assert.equal(
            effectiveDecisionForGenericAdmissionMode(mode, shadowDecision),
            expectedEffectiveDecision(mode, expectedShadow),
          );
        }
      }
    }
  }
  markPassed();

  const envelope = createGenericAdmissionEnvelope(baseMoneyAdmission('enforce'));
  const guardIds = envelope.guardOutcomes.map((entry) => entry.guardId);
  assert.deepEqual(
    guardIds,
    [...GENERIC_ADMISSION_GUARD_OUTCOME_TRACE_GUARD_IDS],
  );
  for (const outcome of envelope.guardOutcomes) {
    assert.equal(outcome.rawPayloadStored, false);
    assert.deepEqual(outcome.reasonCodes, [...outcome.reasonCodes].sort());
  }
  markPassed();
}
