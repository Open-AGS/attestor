import type {
  GoldenProgrammableMoneyReviewerSandboxResult,
} from './golden-programmable-money-reviewer-sandbox-types.js';

function list(items: readonly string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none';
}

export function renderGoldenProgrammableMoneyReviewerSandboxMarkdown(
  result: GoldenProgrammableMoneyReviewerSandboxResult,
): string {
  const decision = result.decisionSummary;
  return `# Golden Path: Programmable Money Reviewer Sandbox

Status: ${result.inputStatus}

## Practical Contrast

Without Attestor for this local input:

- no Attestor issue-code report
- no digest-bound policy, authority, adapter, preflight, replay, settlement, or receipt material
- no explicit no-claim boundary before a wallet-facing or payment-facing side effect

With Attestor for this local input:

- result status: ${result.inputStatus}
- engine ran: ${result.engineRan}
- visible gate stages: ${result.gateOrder.length}
- issue codes: ${result.issueCodes.length}
- wallet calls: ${result.safetyBoundary.noWalletCall ? '0' : 'present'}
- signatures: ${result.safetyBoundary.noSigning ? '0' : 'present'}
- broadcasts: ${result.safetyBoundary.noBroadcast ? '0' : 'present'}
- custody callbacks: ${result.safetyBoundary.noCustodyCallback ? '0' : 'present'}
- bundler calls: ${result.safetyBoundary.noBundlerCall ? '0' : 'present'}
- facilitator calls: ${result.safetyBoundary.noFacilitatorCall ? '0' : 'present'}
- solver calls: ${result.safetyBoundary.noSolverCall ? '0' : 'present'}
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Input Boundary

- engine scope: ${result.engineScope}
- requested action surface: ${result.requestedActionSurface ?? 'not provided'}
- engine ran: ${result.engineRan}
- input digest: ${result.inputDigest ?? 'none'}

## Schema Errors

${list(result.schemaErrors)}

## Issue Codes

${list(result.issueCodes)}

## Decision Summary

- expected posture: ${result.expectedPosture ?? 'none'}
- shadow decision: ${decision?.shadowDecision ?? 'none'}
- effective decision: ${decision?.effectiveDecision ?? 'none'}
- packet decision: ${decision?.packetDecision ?? 'none'}
- fusion posture: ${decision?.fusionPosture ?? 'none'}
- conflict outcome: ${decision?.conflictOutcome ?? 'none'}
- human gate: ${decision?.humanStatus ?? 'none'}
- evidence completeness: ${decision?.evidenceCompletenessPercent ?? 0}%
- decision digest: ${decision?.decisionRelevantDigest ?? 'none'}

## Gate Trace

${result.gateOrder.map((gate, index) => `${index + 1}. ${gate}`).join('\n')}

## No-Claims

${list(result.noClaims)}

## Safety Boundary

- target-system calls: ${result.safetyBoundary.noTargetSystemCall ? '0' : 'present'}
- wallet calls: ${result.safetyBoundary.noWalletCall ? '0' : 'present'}
- signing: ${result.safetyBoundary.noSigning ? '0' : 'present'}
- broadcasts: ${result.safetyBoundary.noBroadcast ? '0' : 'present'}
- custody callbacks: ${result.safetyBoundary.noCustodyCallback ? '0' : 'present'}
- bundler calls: ${result.safetyBoundary.noBundlerCall ? '0' : 'present'}
- facilitator calls: ${result.safetyBoundary.noFacilitatorCall ? '0' : 'present'}
- solver calls: ${result.safetyBoundary.noSolverCall ? '0' : 'present'}
- provider calls: ${result.safetyBoundary.noProviderCall ? '0' : 'present'}
- audit writes: ${result.safetyBoundary.noAuditWrite ? '0' : 'present'}
- policy activation: ${result.safetyBoundary.noPolicyActivation ? '0' : 'present'}
- learning/training activation: ${result.safetyBoundary.noLearningActivation && result.safetyBoundary.noTrainingActivation ? '0' : 'present'}
- grants authority: ${result.safetyBoundary.grantsAuthority}
- can admit: ${result.safetyBoundary.canAdmit}
- production ready: ${result.safetyBoundary.productionReady}
`;
}

export function renderGoldenProgrammableMoneyReviewerSandboxJson(
  result: GoldenProgrammableMoneyReviewerSandboxResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
